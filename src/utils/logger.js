'use strict';

/**
 * Structured logger.
 * Outputs JSON lines to stdout for easy ingestion by any log aggregator.
 * Level order: debug < info < warn < error
 */

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

function getConfiguredLevel() {
  const lvl = (process.env.LOG_LEVEL || 'info').toLowerCase();
  return LEVELS[lvl] !== undefined ? lvl : 'info';
}

function log(level, message, meta = {}) {
  const configuredLevel = getConfiguredLevel();
  if (LEVELS[level] < LEVELS[configuredLevel]) return;

  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta,
  };

  const line = JSON.stringify(entry);
  if (level === 'error') {
    process.stderr.write(line + '\n');
  } else {
    process.stdout.write(line + '\n');
  }
}

const logger = {
  debug: (msg, meta)  => log('debug', msg, meta),
  info:  (msg, meta)  => log('info',  msg, meta),
  warn:  (msg, meta)  => log('warn',  msg, meta),
  error: (msg, meta)  => log('error', msg, meta),

  /**
   * Log the start of a pipeline step.
   * Returns a `done(output, meta?)` function that logs completion + duration.
   */
  step(stepName, input = {}) {
    const start = Date.now();
    log('info', `[step:start] ${stepName}`, { step: stepName, input });
    return {
      done(output = {}, extra = {}) {
        const duration_ms = Date.now() - start;
        log('info', `[step:done] ${stepName}`, { step: stepName, duration_ms, output, ...extra });
        return duration_ms;
      },
      fail(err, extra = {}) {
        const duration_ms = Date.now() - start;
        log('error', `[step:fail] ${stepName}`, {
          step:       stepName,
          duration_ms,
          error:      err?.message || String(err),
          stack:      err?.stack,
          ...extra,
        });
        return duration_ms;
      },
    };
  },
};

module.exports = logger;
