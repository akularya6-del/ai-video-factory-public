'use strict';

const fs      = require('fs');
const path    = require('path');
const { execSync } = require('child_process');
const VoiceProvider = require('./VoiceProvider');
const logger  = require('../../utils/logger');

/**
 * OpenAITTSProvider — Full implementation using OpenAI Speech API.
 *
 * Model:    gpt-4o-mini-tts  (high quality, cost-efficient)
 * Fallback: tts-1            (lower latency)
 *
 * Pricing:  gpt-4o-mini-tts: $0.60/1M chars  (~$0.0006/1K chars)
 *           tts-1:           $15.00/1M chars  (~$0.015/1K chars)
 *
 * Docs: https://platform.openai.com/docs/api-reference/audio/createSpeech
 *
 * Advantages over ElevenLabs free tier:
 *  - No monthly character cap
 *  - Same API key already in use
 *  - gpt-4o-mini-tts is very natural sounding
 */
class OpenAITTSProvider extends VoiceProvider {
  constructor() {
    super();
    this._client = null;
  }

  getName() { return 'openai_tts'; }

  _getClient() {
    if (!this._client) {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey || apiKey.trim() === '' || apiKey.startsWith('sk-...')) {
        throw new Error('[OpenAITTS] OPENAI_API_KEY is not set in .env');
      }
      // Use the openai SDK directly — it has first-class audio support
      const OpenAI = require('openai');
      this._client = new OpenAI({ apiKey: apiKey.trim(), timeout: 60_000 });
    }
    return this._client;
  }

  /**
   * @param {string} text        - Narration text to synthesize
   * @param {string} outputPath  - Local path to write the audio file
   * @param {Object} [options]
   * @param {string} [options.model]       - Override model (default: gpt-4o-mini-tts)
   * @param {string} [options.voice]       - alloy|ash|coral|echo|fable|onyx|nova|sage|shimmer (default: onyx)
   * @param {string} [options.format]      - mp3|opus|aac|flac|wav|pcm (default: mp3)
   * @param {number} [options.speed]       - 0.25-4.0 (default: 1.0)
   * @param {string} [options.instructions] - Voice style instructions (gpt-4o-mini-tts only)
   */
  async synthesize(text, outputPath, options = {}) {
    const client = this._getClient();

    const model        = options.model    || 'gpt-4o-mini-tts';
    const voice        = options.voice    || 'nova';    // Warm, cute female narration voice
    const format       = options.format   || 'mp3';
    const speed        = options.speed    ?? 1.7;   // 1.7x fast-paced narration
    const instructions = options.instructions || this._buildInstructions();

    logger.debug('[OpenAITTS] Synthesizing', {
      model,
      voice,
      chars: text.length,
      outputPath,
    });

    // Build request params — instructions only supported on gpt-4o-mini-tts
    const params = {
      model,
      input: text,
      voice,
      response_format: format,
      speed,
    };

    if (model === 'gpt-4o-mini-tts' && instructions) {
      params.instructions = instructions;
    }

    // Stream response to file
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });

    const response = await client.audio.speech.create(params);

    // The OpenAI SDK returns a Response object — pipe the buffer to disk
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(outputPath, buffer);

    const stats           = fs.statSync(outputPath);
    const file_size_bytes = stats.size;

    // Probe actual duration from the rendered audio file.
    // At speed > 1.0 the output is shorter than the text-estimated duration.
    // Caption timing MUST use the actual duration, not the estimate.
    const duration_seconds = this._probeDuration(outputPath) || this.estimateDuration(text, speed);
    const cost_usd         = this._computeCost(model, text.length);

    logger.debug('[OpenAITTS] Synthesis complete', {
      file_size_bytes,
      duration_seconds,
      cost_usd,
      model,
      voice,
    });

    return {
      outputPath,
      duration_seconds,
      file_size_bytes,
      cost_usd,
      provider:  this.getName(),
      voice_id:  voice,
      model_id:  model,
      char_count: text.length,
    };
  }

  async getVoices() {
    return [
      { id: 'alloy',   name: 'Alloy — neutral, balanced' },
      { id: 'ash',     name: 'Ash — clear, conversational' },
      { id: 'coral',   name: 'Coral — warm, engaging' },
      { id: 'echo',    name: 'Echo — deep, calm' },
      { id: 'fable',   name: 'Fable — expressive, British' },
      { id: 'onyx',    name: 'Onyx — deep, authoritative (recommended for narration)' },
      { id: 'nova',    name: 'Nova — friendly, upbeat' },
      { id: 'sage',    name: 'Sage — calm, thoughtful' },
      { id: 'shimmer', name: 'Shimmer — clear, warm, feminine' },
    ];
  }

  /**
   * System instructions for the gpt-4o-mini-tts model.
   * These guide the *style* of delivery, not the words.
   */
  _buildInstructions() {
    return `You are a professional narrator for short-form YouTube story videos.
Speak in a calm but gripping tone — like a seasoned storyteller.
Pace yourself: slow down on emotional moments, speed up slightly on action.
Emphasize key words naturally. Do not rush. Make every word land.`;
  }

  /**
   * Cost per character for each model.
   * gpt-4o-mini-tts: $0.60 per 1M chars
   * tts-1:           $15.00 per 1M chars
   * tts-1-hd:        $30.00 per 1M chars
   */
  /**
   * Probe the actual duration of an audio file using ffprobe.
   * Returns duration in seconds, or null if ffprobe is unavailable.
   */
  _probeDuration(filePath) {
    const ffprobeCandidates = [
      '/opt/homebrew/opt/ffmpeg-full/bin/ffprobe',
      '/opt/homebrew/bin/ffprobe',
      '/usr/local/bin/ffprobe',
    ];
    const ffprobe = ffprobeCandidates.find(p => { try { return fs.existsSync(p); } catch { return false; } }) || 'ffprobe';
    try {
      const out = execSync(
        `"${ffprobe}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`,
        { encoding: 'utf8', timeout: 10000 }
      ).trim();
      const dur = parseFloat(out);
      return isNaN(dur) ? null : dur;
    } catch {
      return null;
    }
  }

  /**
   * Estimate duration from character count and speed multiplier.
   * Fallback when ffprobe is not available.
   */
  estimateDuration(text, speed = 1.0) {
    // ~150 words/min natural speech → ~13 chars/sec
    const baseSecs = text.split(/\s+/).length / 2.5; // ~150 wpm
    return Math.round(baseSecs / speed);
  }

  _computeCost(model, charCount) {
    const pricing = {
      'gpt-4o-mini-tts': 0.60  / 1_000_000,
      'tts-1':           15.00 / 1_000_000,
      'tts-1-hd':        30.00 / 1_000_000,
    };
    const rate = pricing[model] ?? pricing['gpt-4o-mini-tts'];
    return parseFloat((charCount * rate).toFixed(8));
  }
}

module.exports = new OpenAITTSProvider();
