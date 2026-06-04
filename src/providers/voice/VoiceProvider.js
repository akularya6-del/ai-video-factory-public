'use strict';

/**
 * VoiceProvider — Abstract base class.
 *
 * All voice providers MUST implement these methods.
 * This is the abstraction layer that makes swapping ElevenLabs → OpenAI TTS
 * → Azure → Google a single config change (VOICE_PROVIDER env var).
 */
class VoiceProvider {
  /**
   * Synthesize text to speech and write audio to outputPath.
   *
   * @param {string} text         - Narration text to synthesize
   * @param {string} outputPath   - Local filesystem path to write the audio file
   * @param {Object} [options]    - Provider-specific options
   *
   * @returns {Promise<VoiceResult>}
   * @property {string}  outputPath      - Path of the written audio file
   * @property {number}  duration_seconds - Estimated audio duration
   * @property {number}  file_size_bytes
   * @property {number}  cost_usd
   * @property {string}  provider        - Provider name
   * @property {string}  voice_id
   */
  async synthesize(text, outputPath, options = {}) {
    throw new Error(`[VoiceProvider] synthesize() not implemented by ${this.getName()}`);
  }

  /**
   * List available voices for this provider.
   * @returns {Promise<Array<{id: string, name: string}>>}
   */
  async getVoices() {
    throw new Error(`[VoiceProvider] getVoices() not implemented by ${this.getName()}`);
  }

  /**
   * @returns {string} Provider identifier, e.g. 'elevenlabs'
   */
  getName() {
    throw new Error('[VoiceProvider] getName() not implemented');
  }

  /**
   * Estimate audio duration from text.
   * 130 WPM is a typical narration pace.
   *
   * @param {string} text
   * @returns {number} Estimated duration in seconds
   */
  estimateDuration(text) {
    const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
    return Math.round((wordCount / 130) * 60);
  }
}

module.exports = VoiceProvider;
