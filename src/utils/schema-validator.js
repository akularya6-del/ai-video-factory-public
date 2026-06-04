'use strict';

const Ajv = require('ajv');
const ajv = new Ajv({ allErrors: true, verbose: true });

/**
 * Validates data against a JSON schema.
 * Throws a descriptive ValidationError on failure.
 *
 * @param {Object} schema  - AJV-compatible JSON schema
 * @param {any}    data    - Data to validate
 * @param {string} context - Label for error messages (e.g. 'story response')
 * @returns {any} - The validated data (unchanged)
 */
function validate(schema, data, context = 'data') {
  const valid = ajv.validate(schema, data);
  if (!valid) {
    const messages = ajv.errors
      .map((e) => `  • ${e.instancePath || '(root)'} ${e.message}`)
      .join('\n');
    const err = new Error(`[schema] Validation failed for ${context}:\n${messages}`);
    err.code = 'VALIDATION_ERROR';
    err.validationErrors = ajv.errors;
    throw err;
  }
  return data;
}

module.exports = { validate };
