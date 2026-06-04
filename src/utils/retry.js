'use strict';

/**
 * Exponential backoff retry utility.
 *
 * @param {Function} fn          - Async function to retry
 * @param {Object}   opts
 * @param {number}   opts.maxAttempts  - Total attempts (default 3)
 * @param {number}   opts.baseDelayMs  - Initial delay in ms (default 1000)
 * @param {number}   opts.maxDelayMs   - Max delay cap in ms (default 30000)
 * @param {Function} opts.onRetry      - Optional callback(attempt, error, delayMs)
 * @param {Function} opts.shouldRetry  - Optional predicate(error) → bool (default: always)
 * @returns {Promise<any>}
 */
async function withRetry(fn, opts = {}) {
  const {
    maxAttempts = 3,
    baseDelayMs = 1000,
    maxDelayMs  = 30000,
    onRetry     = null,
    shouldRetry = () => true,
  } = opts;

  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastError = err;

      const isLast = attempt === maxAttempts;
      const retriable = shouldRetry(err);

      if (isLast || !retriable) {
        throw err;
      }

      // Exponential backoff with jitter: delay = min(base * 2^(attempt-1), max) + jitter
      const exponential = baseDelayMs * Math.pow(2, attempt - 1);
      const jitter      = Math.floor(Math.random() * 500);
      const delayMs     = Math.min(exponential + jitter, maxDelayMs);

      if (onRetry) {
        onRetry(attempt, err, delayMs);
      }

      await sleep(delayMs);
    }
  }

  throw lastError;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Returns true for HTTP errors that are safe to retry.
 * 429 (rate limit), 5xx (server errors). NOT 4xx auth/validation errors.
 */
function isRetriableHttpError(err) {
  const status = err?.status || err?.response?.status || err?.statusCode;
  if (!status) return true; // Network errors (no status) are retriable
  if (status === 429) return true;
  if (status >= 500) return true;
  return false;
}

module.exports = { withRetry, sleep, isRetriableHttpError };
