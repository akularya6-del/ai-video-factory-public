'use strict';

const fs      = require('fs');
const path    = require('path');
const axios   = require('axios');
const VoiceProvider = require('./VoiceProvider');
const config  = require('../../config/env');
const logger  = require('../../utils/logger');

const ELEVENLABS_BASE_URL = 'https://api.elevenlabs.io/v1';

/**
 * ElevenLabsProvider — Milestone 2
 *
 * Synthesizes narration text using the ElevenLabs TTS API.
 * Audio is streamed and written directly to a local file.
 *
 * Free tier: ~10,000 chars/month
 * Pricing:   ~$0.30/1K chars (Creator plan)
 *
 * Docs: https://docs.elevenlabs.io/api-reference/text-to-speech
 */
class ElevenLabsProvider extends VoiceProvider {
  constructor() {
    super();
    this._apiKey  = null;
    this._voiceId = null;
    this._modelId = null;
  }

  getName() { return 'elevenlabs'; }

  _init() {
    if (!this._apiKey) {
      const key = process.env.ELEVENLABS_API_KEY;
      if (!key || key.trim() === '') {
        throw new Error('[ElevenLabs] ELEVENLABS_API_KEY is not set in .env');
      }
      this._apiKey  = key.trim();
      this._voiceId = config.elevenlabs.voiceId;
      this._modelId = config.elevenlabs.modelId;
    }
  }

  /**
   * @param {string} text        - Full narration text
   * @param {string} outputPath  - Local path to write .mp3
   * @param {Object} [options]
   * @param {string} [options.voiceId]   - Override default voice
   * @param {number} [options.stability] - 0-1 (default 0.5)
   * @param {number} [options.similarity_boost] - 0-1 (default 0.75)
   */
  async synthesize(text, outputPath, options = {}) {
    this._init();

    const voiceId   = options.voiceId || this._voiceId;
    const stability = options.stability ?? 0.5;
    const similarity_boost = options.similarity_boost ?? 0.75;

    logger.debug('[ElevenLabs] Synthesizing', {
      chars:   text.length,
      voiceId,
      modelId: this._modelId,
    });

    const url = `${ELEVENLABS_BASE_URL}/text-to-speech/${voiceId}`;

    const response = await axios.post(
      url,
      {
        text,
        model_id: this._modelId,
        voice_settings: { stability, similarity_boost },
      },
      {
        headers: {
          'xi-api-key':   this._apiKey,
          'Content-Type': 'application/json',
          'Accept':       'audio/mpeg',
        },
        responseType: 'arraybuffer',
        timeout:      60_000,
      }
    );

    // Validate we got audio back
    const contentType = response.headers['content-type'] || '';
    if (!contentType.includes('audio') && !contentType.includes('mpeg')) {
      // Try to parse as error JSON
      const errText = Buffer.from(response.data).toString('utf8');
      throw new Error(`[ElevenLabs] Unexpected content-type: ${contentType}. Body: ${errText.slice(0, 200)}`);
    }

    // Write audio to disk
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, Buffer.from(response.data));

    const stats          = fs.statSync(outputPath);
    const file_size_bytes = stats.size;
    const duration_seconds = this.estimateDuration(text);
    const cost_usd         = this._computeCost(text.length);

    logger.debug('[ElevenLabs] Synthesis complete', {
      file_size_bytes,
      duration_seconds,
      cost_usd,
      outputPath,
    });

    return {
      outputPath,
      duration_seconds,
      file_size_bytes,
      cost_usd,
      provider: this.getName(),
      voice_id: voiceId,
      model_id: this._modelId,
      char_count: text.length,
    };
  }

  async getVoices() {
    this._init();
    const response = await axios.get(`${ELEVENLABS_BASE_URL}/voices`, {
      headers: { 'xi-api-key': this._apiKey },
      timeout: 10_000,
    });
    return response.data.voices.map((v) => ({
      id:   v.voice_id,
      name: v.name,
    }));
  }

  /**
   * ElevenLabs charges per character.
   * Free: 10,000 chars/month
   * Creator: $22/mo = 100K chars → ~$0.00022/char
   * Using Creator plan rates as approximation.
   */
  _computeCost(charCount) {
    const COST_PER_CHAR = 0.00030; // $0.30 per 1000 chars (Creator plan)
    return parseFloat((charCount * COST_PER_CHAR / 1000 * 1000).toFixed(8));
  }
}

module.exports = new ElevenLabsProvider();
