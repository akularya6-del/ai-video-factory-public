'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

/**
 * Central environment configuration with validation.
 * All env vars are accessed through this module — never process.env directly.
 */

function requireEnv(name) {
  const val = process.env[name];
  if (!val || val.trim() === '' || val.startsWith('sk-...') || val === 'your-key-here') {
    throw new Error(`[config] Missing required environment variable: ${name}`);
  }
  return val.trim();
}

function optionalEnv(name, defaultValue = '') {
  return (process.env[name] || defaultValue).trim();
}

const config = {
  app: {
    nodeEnv:  optionalEnv('NODE_ENV', 'development'),
    logLevel: optionalEnv('LOG_LEVEL', 'info'),
  },

  openai: {
    apiKey:       null, // loaded lazily — only required when story service is used
    model:        optionalEnv('OPENAI_MODEL', 'gpt-4o-mini'),
    maxRetries:   parseInt(optionalEnv('OPENAI_MAX_RETRIES', '3'), 10),
    timeoutMs:    parseInt(optionalEnv('OPENAI_TIMEOUT_MS', '120000'), 10),
  },

  story: {
    minWordCount:       parseInt(optionalEnv('STORY_MIN_WORD_COUNT', '200'), 10),
    qualityThreshold:   parseFloat(optionalEnv('STORY_QUALITY_THRESHOLD', '70')),
    defaultLengthSecs:  parseInt(optionalEnv('DEFAULT_STORY_LENGTH_SECONDS', '90'), 10),
  },

  elevenlabs: {
    apiKey:     null, // loaded lazily
    voiceId:    optionalEnv('ELEVENLABS_VOICE_ID', '21m00Tcm4TlvDq8ikWAM'),
    modelId:    optionalEnv('ELEVENLABS_MODEL_ID', 'eleven_monolingual_v1'),
  },

  voice: {
    provider: optionalEnv('VOICE_PROVIDER', 'openai_tts'),
  },

  aws: {
    accessKeyId:     optionalEnv('AWS_ACCESS_KEY_ID'),
    secretAccessKey: optionalEnv('AWS_SECRET_ACCESS_KEY'),
    region:          optionalEnv('AWS_REGION', 'us-east-1'),
    s3Bucket:        optionalEnv('S3_BUCKET_NAME'),
    s3BasePrefix:    optionalEnv('S3_BASE_PREFIX', 'v1'),
  },

  database: {
    url: optionalEnv('DATABASE_URL'),
  },

  youtube: {
    clientId:      optionalEnv('YOUTUBE_CLIENT_ID'),
    clientSecret:  optionalEnv('YOUTUBE_CLIENT_SECRET'),
    redirectUri:   optionalEnv('YOUTUBE_REDIRECT_URI', 'http://localhost:3000/oauth2callback'),
    refreshToken:  optionalEnv('YOUTUBE_REFRESH_TOKEN'),
    defaultPrivacy: optionalEnv('YOUTUBE_DEFAULT_PRIVACY', 'private'),
  },

  ffmpeg: {
    path:          optionalEnv('FFMPEG_PATH', '/usr/local/bin/ffmpeg'),
    footageBase:   optionalEnv('FOOTAGE_BASE_PATH', './footage/gameplay'),
    rendersOutput: optionalEnv('RENDERS_OUTPUT_PATH', './renders'),
    resolution:    optionalEnv('VIDEO_RESOLUTION', '1080x1920'),
    fps:           parseInt(optionalEnv('VIDEO_FPS', '30'), 10),
  },
};

/** Load and validate OpenAI key — call this before using OpenAI. */
config.openai.load = function () {
  if (!config.openai.apiKey) {
    config.openai.apiKey = requireEnv('OPENAI_API_KEY');
  }
  return config.openai.apiKey;
};

module.exports = config;
