'use strict';

const path    = require('path');
const { getVoiceProvider } = require('../providers/voice');
const { withRetry, isRetriableHttpError } = require('../utils/retry');
const logger  = require('../utils/logger');
const config  = require('../config/env');

/**
 * VoiceService — Milestone 2
 *
 * Orchestrates TTS synthesis via the configured VoiceProvider.
 * Handles:
 *  - Provider selection (via factory)
 *  - Output path management
 *  - Retry on transient failures
 *  - Step logging + cost tracking
 *
 * Input:  { text, outputDir, videoJobId?, options? }
 * Output: { outputPath, duration_seconds, file_size_bytes, cost_usd, provider, voice_id }
 */
class VoiceService {
  /**
   * Generate narration audio from text.
   *
   * @param {Object} input
   * @param {string} input.text          - Narration text (from StoryService)
   * @param {string} input.outputDir     - Directory to write audio file into
   * @param {string} [input.videoJobId]  - Used to name the output file
   * @param {string} [input.providerName] - Override VOICE_PROVIDER env var
   * @param {Object} [input.options]     - Passed through to provider.synthesize()
   *
   * @returns {Promise<VoiceResult>}
   */
  async generateVoice(input) {
    const {
      text,
      outputDir,
      videoJobId  = `local_${Date.now()}`,
      providerName = null,
      options      = {},
    } = input;

    if (!text || text.trim().length === 0) {
      throw new Error('[VoiceService] text is required and must not be empty');
    }
    if (!outputDir) {
      throw new Error('[VoiceService] outputDir is required');
    }

    const provider   = getVoiceProvider(providerName);
    const outputPath = path.join(outputDir, `${videoJobId}_narration.mp3`);

    const step = logger.step('voice_generation', {
      provider: provider.getName(),
      char_count: text.length,
      estimated_duration_s: provider.estimateDuration(text),
      outputPath,
    });

    try {
      const result = await withRetry(
        () => provider.synthesize(text, outputPath, options),
        {
          maxAttempts: config.openai.maxRetries,
          baseDelayMs: 2000,
          shouldRetry: (err) => {
            // Never retry config/auth errors — they won't fix themselves
            if (err.message?.includes('is not set in .env')) return false;
            if (err.message?.includes('not implemented'))    return false;
            if (err?.response?.status === 401) return false;
            if (err?.response?.status === 422) return false;
            return isRetriableHttpError(err);
          },
          onRetry: (attempt, err, delayMs) => {
            logger.warn('[VoiceService] Retry', {
              attempt,
              provider: provider.getName(),
              error:    err.message,
              delayMs,
            });
          },
        }
      );

      step.done({
        duration_seconds: result.duration_seconds,
        file_size_bytes:  result.file_size_bytes,
        cost_usd:         result.cost_usd,
        outputPath:       result.outputPath,
      });

      return result;

    } catch (err) {
      step.fail(err, { provider: provider.getName() });
      throw err;
    }
  }
}

module.exports = new VoiceService();
