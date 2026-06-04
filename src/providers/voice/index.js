'use strict';

const config = require('../../config/env');

/**
 * VoiceProvider factory.
 * Returns the correct provider based on the VOICE_PROVIDER env var.
 * Adding a new provider requires only adding an entry to the map below.
 */
const PROVIDERS = {
  elevenlabs: () => require('./ElevenLabsProvider'),
  openai_tts: () => require('./OpenAITTSProvider'),
  // azure:   () => require('./AzureProvider'),   // future
  // google:  () => require('./GoogleTTSProvider'), // future
};

function getVoiceProvider(name) {
  const providerName = name || config.voice.provider || 'elevenlabs';
  const factory = PROVIDERS[providerName];

  if (!factory) {
    const available = Object.keys(PROVIDERS).join(', ');
    throw new Error(
      `[VoiceProvider] Unknown provider: "${providerName}". Available: ${available}`
    );
  }

  return factory();
}

module.exports = { getVoiceProvider };
