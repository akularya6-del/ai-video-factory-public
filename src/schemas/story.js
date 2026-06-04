'use strict';

/**
 * JSON Schema for the story generation response.
 * Enforced on every OpenAI response before any downstream step uses the data.
 */
const storyResponseSchema = {
  type: 'object',
  required: ['hook', 'title', 'description', 'hashtags', 'story', 'word_count'],
  additionalProperties: true,
  properties: {
    hook: {
      type: 'string',
      minLength: 10,
      description: '1-2 punchy opening sentences that hook the viewer',
    },
    title: {
      type: 'string',
      minLength: 5,
      maxLength: 100,
      description: 'YouTube-ready video title',
    },
    description: {
      type: 'string',
      minLength: 20,
      maxLength: 5000,
      description: 'YouTube video description',
    },
    hashtags: {
      type: 'array',
      minItems: 3,
      maxItems: 20,
      items: {
        type: 'string',
        pattern: '^#?[\\w]+$',
      },
      description: 'Hashtag list (with or without leading #)',
    },
    story: {
      type: 'string',
      minLength: 100,
      description: 'Full narration text for TTS',
    },
    word_count: {
      type: 'integer',
      minimum: 1,
    },
  },
};

/**
 * JSON Schema for the generateStory() input.
 */
const storyInputSchema = {
  type: 'object',
  required: ['topic'],
  additionalProperties: false,
  properties: {
    topic: {
      type: 'string',
      minLength: 1,
      maxLength: 200,
    },
    length_seconds: {
      type: 'integer',
      minimum: 15,
      maximum: 600,
      default: 90,
    },
    style: {
      type: 'string',
      enum: ['dramatic', 'horror', 'comedy', 'inspirational', 'revenge'],
      default: 'dramatic',
    },
  },
};

module.exports = { storyResponseSchema, storyInputSchema };
