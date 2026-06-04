'use strict';

const fs   = require('fs');
const path = require('path');
const logger = require('../utils/logger');

/**
 * GameplayService — Milestone 4
 *
 * Selects a random segment from available gameplay footage files.
 * Ensures the selected segment is long enough for the target duration.
 *
 * Footage is scanned from FOOTAGE_BASE_PATH at runtime.
 * Adding new footage = drop a .mp4 into footage/gameplay/ — no code change.
 *
 * Input:  { durationSeconds, footageDir? }
 * Output: { filePath, startSeconds, durationSeconds, fileName, totalDuration }
 */
class GameplayService {
  /**
   * Select a random gameplay segment that fits the required duration.
   *
   * @param {Object} input
   * @param {number} input.durationSeconds   - Required segment length
   * @param {string} [input.footageDir]      - Override FOOTAGE_BASE_PATH
   * @param {number} [input.bufferSeconds=5] - Extra buffer beyond duration for safety
   *
   * @returns {Promise<GameplaySegment>}
   */
  async selectSegment(input) {
    const {
      durationSeconds,
      footageDir    = process.env.FOOTAGE_BASE_PATH || './footage/gameplay',
      bufferSeconds = 5,
    } = input;

    if (!durationSeconds || durationSeconds <= 0) {
      throw new Error('[GameplayService] durationSeconds must be a positive number');
    }

    const step = logger.step('gameplay_selection', { durationSeconds, footageDir });

    try {
      // ── 1. Scan for .mp4 files ────────────────────────────────────────
      const absFootageDir = path.resolve(footageDir);

      if (!fs.existsSync(absFootageDir)) {
        throw new Error(
          `[GameplayService] Footage directory not found: ${absFootageDir}\n` +
          `  → Create it and add .mp4 files, or update FOOTAGE_BASE_PATH in .env`
        );
      }

      const files = fs.readdirSync(absFootageDir)
        .filter((f) => f.toLowerCase().endsWith('.mp4'))
        .map((f) => path.join(absFootageDir, f));

      if (files.length === 0) {
        throw new Error(`[GameplayService] No .mp4 files found in: ${absFootageDir}`);
      }

      // ── 2. Probe each file for duration (cache in memory per process) ─
      const probed = await this._probeFiles(files);

      // ── 3. Filter files that are long enough ──────────────────────────
      const minRequired = durationSeconds + bufferSeconds;
      const eligible    = probed.filter((f) => f.duration >= minRequired);

      if (eligible.length === 0) {
        const available = probed.map((f) => `${f.name} (${Math.floor(f.duration)}s)`).join(', ');
        throw new Error(
          `[GameplayService] No footage file is long enough for ${durationSeconds}s segment.\n` +
          `  Available files: ${available}\n` +
          `  Minimum required: ${minRequired}s`
        );
      }

      // ── 4. Pick a random eligible file ───────────────────────────────
      const chosen = eligible[Math.floor(Math.random() * eligible.length)];

      // ── 5. Pick a random start time within the safe window ────────────
      const maxStart    = chosen.duration - durationSeconds - bufferSeconds;
      const startSeconds = maxStart > 0
        ? parseFloat((Math.random() * maxStart).toFixed(3))
        : 0;

      const result = {
        filePath:        chosen.path,
        fileName:        chosen.name,
        startSeconds,
        durationSeconds,
        totalDuration:   chosen.duration,
      };

      step.done(result);
      return result;

    } catch (err) {
      step.fail(err);
      throw err;
    }
  }

  // ── Private ─────────────────────────────────────────────────────────────

  /** Cache to avoid re-probing the same files multiple times per process run. */
  _cache = new Map();

  async _probeFiles(filePaths) {
    const results = [];
    for (const filePath of filePaths) {
      if (this._cache.has(filePath)) {
        results.push(this._cache.get(filePath));
        continue;
      }

      const duration = await this._probeDuration(filePath);
      const entry = {
        path:     filePath,
        name:     path.basename(filePath),
        duration,
      };
      this._cache.set(filePath, entry);
      results.push(entry);
    }
    return results;
  }

  /** Use ffprobe to get video duration in seconds. */
  _probeDuration(filePath) {
    return new Promise((resolve, reject) => {
      const { execFile } = require('child_process');
      execFile('ffprobe', [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        filePath,
      ], (err, stdout) => {
        if (err) return reject(new Error(`[GameplayService] ffprobe failed for ${filePath}: ${err.message}`));
        try {
          const data     = JSON.parse(stdout);
          const duration = parseFloat(data.format?.duration || '0');
          if (!duration) return reject(new Error(`[GameplayService] Could not read duration from ${filePath}`));
          resolve(duration);
        } catch (parseErr) {
          reject(new Error(`[GameplayService] ffprobe parse error: ${parseErr.message}`));
        }
      });
    });
  }
}

module.exports = new GameplayService();
