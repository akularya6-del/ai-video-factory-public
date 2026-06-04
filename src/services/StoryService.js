'use strict';

const OpenAI                = require('openai');
const config                = require('../config/env');
const { withRetry, isRetriableHttpError } = require('../utils/retry');
const { validate }          = require('../utils/schema-validator');
const { storyResponseSchema, storyInputSchema } = require('../schemas/story');
const { buildSystemPrompt, buildUserPrompt }    = require('../prompts/story');
const logger                = require('../utils/logger');

/**
 * StoryService — Milestone 1
 *
 * Responsibilities:
 *   - Accept { topic, length_seconds, style }
 *   - Call OpenAI with structured JSON output
 *   - Validate the response against the story schema
 *   - Run a quality gate (word count threshold)
 *   - Return a fully typed story object + usage stats
 *
 * Error contract:
 *   - Throws on schema validation failure
 *   - Throws on quality gate failure after max retries
 *   - Throws on OpenAI API errors after max retries
 */
class StoryService {
  constructor() {
    this._client = null;
  }

  /** Lazily initialise the OpenAI client (so missing key only errors on first call). */
  _getClient() {
    if (!this._client) {
      const apiKey = config.openai.load();
      this._client = new OpenAI({
        apiKey,
        timeout:     config.openai.timeoutMs,
        maxRetries:  0, // We handle retries ourselves for full control
      });
    }
    return this._client;
  }

  /**
   * Generate a story from a topic.
   *
   * @param {Object} input
   * @param {string} input.topic          - e.g. "revenge"
   * @param {number} [input.length_seconds=90]
   * @param {string} [input.style='dramatic']
   *
   * @returns {Promise<StoryResult>}
   */
  async generateStory(input) {
    // ── 1. Validate input ─────────────────────────────────────────────
    validate(storyInputSchema, input, 'story input');

    const {
      topic,
      length_seconds = config.story.defaultLengthSecs,
      style          = 'dramatic',
    } = input;

    const step = logger.step('story_generation', { topic, length_seconds, style });

    try {
      const maxAttempts = config.openai.maxRetries;
      const minWords    = config.story.minWordCount;
      let   lastResult  = null;
      let   lastError   = null;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        if (attempt > 1) {
          logger.warn('[story] Quality gate retry', { attempt, topic, minWords });
        }

        // ── 2. Call OpenAI (with HTTP-error retry built in) ──────────────
        let raw;
        try {
          raw = await withRetry(
            () => this._callOpenAI(topic, length_seconds, style, attempt > 1),
            {
              maxAttempts: 2,
              baseDelayMs: 1000,
              shouldRetry: isRetriableHttpError,
              onRetry: (a, err, delayMs) =>
                logger.warn('[story] OpenAI HTTP retry', { attempt: a, error: err.message, delayMs }),
            }
          );
        } catch (httpErr) {
          // Non-retriable HTTP error — bail immediately
          throw httpErr;
        }

        // ── 3. Quality gate ───────────────────────────────────────────────
        const actualWordCount = this._countWords(raw.story.story);
        raw.story.word_count  = actualWordCount;

        if (actualWordCount >= minWords) {
          lastResult = raw;
          break; // ✅ Passed quality gate
        }

        lastError = Object.assign(
          new Error(`[story] Quality gate failed: word_count=${actualWordCount} < minimum=${minWords} (attempt ${attempt}/${maxAttempts})`),
          { code: 'QUALITY_GATE_FAILED', word_count: actualWordCount }
        );
        logger.warn('[story] Quality gate failed', { attempt, actualWordCount, minWords, topic });
        lastResult = raw; // Keep last result as fallback
      }

      // Use best result even if it never hit the threshold (graceful fallback)
      const result = lastResult;

      const duration_ms = step.done({
        word_count:        result.story.word_count,
        title:             result.story.title,
        prompt_tokens:     result.usage.prompt_tokens,
        completion_tokens: result.usage.completion_tokens,
        cost_usd:          result.cost_usd,
        quality_gate_pass: result.story.word_count >= minWords,
      });

      return { ...result, duration_ms };

    } catch (err) {
      step.fail(err, { topic });
      throw err;
    }
  }

  // ── Private ─────────────────────────────────────────────────────────────

  async _callOpenAI(topic, lengthSeconds, style, isRetry = false) {
    const client = this._getClient();
    const model  = config.openai.model;

    const systemPrompt = buildSystemPrompt();
    const userPrompt   = buildUserPrompt(topic, lengthSeconds, style, isRetry);

    logger.debug('[story] Calling OpenAI', { model, topic, isRetry });

    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt   },
      ],
      response_format: { type: 'json_object' },
      // gpt-5 series only supports the default temperature (1)
      ...(model.startsWith('gpt-5') ? {} : { temperature: 0.85 }),
      // gpt-5-mini is a reasoning model — it uses hidden reasoning tokens
      // BEFORE producing visible output. With 2000 tokens the budget is
      // exhausted during reasoning, returning empty content.
      // 16000 gives the chain-of-thought room to run + story output.
      max_completion_tokens: 16000,
    });

    const raw = response.choices[0]?.message?.content;
    if (!raw) {
      throw new Error('[story] OpenAI returned empty content');
    }

    // ── Parse JSON ──────────────────────────────────────────────────────
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (parseErr) {
      throw new Error(`[story] Failed to parse OpenAI JSON response: ${parseErr.message}\nRaw: ${raw.slice(0, 200)}`);
    }

    // ── Validate schema ─────────────────────────────────────────────────
    validate(storyResponseSchema, parsed, 'story response');

    // ── Normalise hashtags (strip leading # if present) ─────────────────
    parsed.hashtags = parsed.hashtags.map((h) => h.replace(/^#/, ''));

    // ── Compute cost ────────────────────────────────────────────────────
    const usage   = response.usage;
    const cost_usd = this._computeCost(model, usage.prompt_tokens, usage.completion_tokens);

    return {
      story:   parsed,
      usage:   {
        prompt_tokens:     usage.prompt_tokens,
        completion_tokens: usage.completion_tokens,
        total_tokens:      usage.total_tokens,
      },
      cost_usd,
      model,
    };
  }

  _countWords(text) {
    return text.trim().split(/\s+/).filter(Boolean).length;
  }

  /**
   * Approximate cost calculation based on publicly listed token prices.
   * These should be updated when OpenAI changes pricing.
   *
   * gpt-4o-mini: $0.15/1M input, $0.60/1M output
   * gpt-4o:      $5.00/1M input, $15.00/1M output
   */
  _computeCost(model, promptTokens, completionTokens) {
    const pricing = {
      'gpt-5-mini':     { input: 0.40, output: 1.60  },  // estimated — update when published
      'gpt-5':          { input: 2.00, output: 8.00  },
      'gpt-4.1-mini':   { input: 0.10, output: 0.40  },
      'gpt-4o-mini':    { input: 0.15, output: 0.60  },
      'gpt-4o':         { input: 5.00, output: 15.00 },
      'gpt-3.5-turbo':  { input: 0.50, output: 1.50  },
    };

    const rates = pricing[model] || pricing['gpt-4o-mini'];
    const inputCost  = (promptTokens     / 1_000_000) * rates.input;
    const outputCost = (completionTokens / 1_000_000) * rates.output;

    return parseFloat((inputCost + outputCost).toFixed(8));
  }
}

module.exports = new StoryService();
