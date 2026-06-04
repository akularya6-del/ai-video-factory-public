'use strict';

const fs     = require('fs');
const path   = require('path');
const { OpenAI } = require('openai');
const logger = require('../utils/logger');

// ── Emoji lookup table ────────────────────────────────────────────────────────
// Maps individual words (lowercase, stripped of punctuation) to an emoji suffix.
// Words not in this map get no emoji — keeps it from being overwhelming.
const EMOJI_MAP = {
  // Emotions
  love: '❤️', loved: '❤️', loving: '❤️',
  hate: '😤', hated: '😤',
  angry: '😡', anger: '😡', furious: '😡', rage: '🔥',
  happy: '😊', happiness: '😊', joy: '😊', joyful: '😊',
  sad: '😢', sadness: '😢', crying: '😭', cried: '😭', tears: '😭',
  fear: '😨', scared: '😨', terrified: '😱', terror: '😱',
  shock: '😱', shocked: '😱', stunned: '😲', surprised: '😲',
  hurt: '💔', broken: '💔', heartbreak: '💔', heartbroken: '💔',
  pain: '💔', painful: '💔',
  hope: '✨', hopeful: '✨',
  lonely: '😔', alone: '😔', darkness: '🌑',
  proud: '🏆', pride: '🏆',
  shame: '😔', ashamed: '😔', guilt: '😔', guilty: '😔',
  laugh: '😂', laughing: '😂', laughed: '😂',
  smile: '😊', smiled: '😊', smiling: '😊',
  cry: '😭',

  // Actions & drama
  betrayed: '🔪', betrayal: '🔪', betray: '🔪',
  revenge: '⚔️', vengeance: '⚔️',
  fight: '👊', fighting: '👊', fought: '👊', punch: '👊',
  run: '🏃', running: '🏃', ran: '🏃', escape: '🏃',
  kill: '💀', killed: '💀', death: '💀', dead: '💀', died: '💀', die: '💀',
  blood: '🩸', bleeding: '🩸',
  win: '🏆', winning: '🏆', won: '🏆', winner: '🏆',
  lose: '😞', lost: '😞', failure: '😞', failed: '😞',
  money: '💰', rich: '💰', wealth: '💰',
  secret: '🤫', whispered: '🤫', whisper: '🤫',
  lie: '🤥', lied: '🤥', lies: '🤥', lying: '🤥',
  truth: '💡', discovered: '💡', realized: '💡', realised: '💡',
  trust: '🤝', trusted: '🤝',
  power: '💪', strong: '💪', strength: '💪',
  weak: '😓', weakness: '😓',
  scream: '😱', screamed: '😱', screaming: '😱',
  silence: '🤫', silent: '🤫',
  cold: '🥶', frozen: '🥶', ice: '❄️',
  fire: '🔥', burn: '🔥', burning: '🔥', burned: '🔥',
  dark: '🌑', darkness: '🌑', night: '🌙',
  light: '💡', bright: '💡', dawn: '🌅', sunrise: '🌅',
  trap: '🪤', trapped: '🪤',
  gun: '🔫', shot: '🔫', bullet: '🔫',
  knife: '🔪', stabbed: '🔪',
  prison: '⛓️', locked: '🔒', chains: '⛓️',
  free: '🕊️', freedom: '🕊️', escape: '🕊️',

  // Story beats
  story: '📖', remember: '💭', remembered: '💭', memory: '💭',
  plan: '🧠', thought: '💭', thinking: '🧠', think: '🧠',
  revenge: '⚔️', justice: '⚖️',
  friendship: '🤝', friend: '🤝', friends: '🤝',
  family: '👨‍👩‍👧', mother: '👩', father: '👨', son: '👦', daughter: '👧',
  brother: '👦', sister: '👧',
  boss: '💼', work: '💼', job: '💼',
  school: '🏫', teacher: '📚',
  war: '⚔️', battle: '⚔️', enemy: '😤',
  forgive: '🕊️', forgiveness: '🕊️', forgave: '🕊️',
  redemption: '🙏', redeem: '🙏', saved: '🙏',
  apology: '🙏', sorry: '🙏', apologize: '🙏',
  pray: '🙏', prayed: '🙏', prayer: '🙏',
  god: '✝️', heaven: '👼', angel: '👼',

  // Intensity words (no emoji but common)
  never: '❌', nothing: '❌', nobody: '👤',
  everything: '🌍', world: '🌍',
  heart: '❤️', soul: '✨',
  back: '🔙', finally: '⏰', moment: '⏰',
  always: '♾️', forever: '♾️', end: '🔚',
  rise: '⬆️', fall: '⬇️', down: '⬇️', up: '⬆️',
};

/**
 * CaptionService — Milestone 3 (v2)
 *
 * Generates ASS subtitle files with:
 *   - One word per caption (instant "pop" feel)
 *   - Scale-in pop animation per word (fscx0→110→100 in 200ms)
 *   - Emoji appended to high-impact words automatically
 *   - Bold Impact font, large size, bottom-centered, white + black outline
 *
 * ASS (Advanced SubStation Alpha) is used instead of SRT because it supports
 * per-entry animations (\t transform tags) that SRT cannot express.
 * The `ass` FFmpeg filter (from ffmpeg-full / libass) renders ASS natively.
 */
class CaptionService {
  /**
   * Generate an ASS caption file from narration text + audio duration.
   *
   * @param {Object} input
   * @param {string} input.text              - Full narration text
   * @param {number} input.durationSeconds   - Actual audio duration
   * @param {string} input.outputPath        - Where to write the .ass file
   * @param {Object} [input.options]
   * @param {number} [input.options.wordsPerChunk=1]    - Words per caption (1 = pop style)
   * @param {number} [input.options.minDurationMs=180]  - Min ms per word (fast pace)
   * @param {number} [input.options.maxDurationMs=1200] - Max ms per word
   * @param {number} [input.options.gapMs=0]            - Gap between words (0 = seamless)
   * @param {boolean}[input.options.useEmoji=true]      - Append emoji to matching words
   * @param {string} [input.options.fontName='Impact']
   * @param {number} [input.options.fontSize=88]        - Larger for one-word style
   *
   * @returns {Promise<CaptionResult>}
   */
  async generateCaptions(input) {
    const {
      text,
      durationSeconds,
      outputPath,
      options = {},
    } = input;

    if (!text?.trim())          throw new Error('[CaptionService] text is required');
    if (!durationSeconds || durationSeconds <= 0)
                                throw new Error('[CaptionService] durationSeconds must be > 0');
    if (!outputPath)            throw new Error('[CaptionService] outputPath is required');

    // Swap .srt → .ass extension if caller passed wrong extension
    const assPath = outputPath.replace(/\.srt$/i, '.ass');

    const wordsPerChunk  = options.wordsPerChunk  ?? 1;
    const minDurationMs  = options.minDurationMs  ?? 180;
    const maxDurationMs  = options.maxDurationMs  ?? 1200;
    const gapMs          = options.gapMs          ?? 0;
    const useEmoji       = options.useEmoji       ?? true;
    const fontName       = options.fontName       || 'Anton';
    const fontSize       = options.fontSize       || 120;

    const step = logger.step('caption_generation', {
      char_count: text.length,
      durationSeconds,
      wordsPerChunk,
      outputPath: assPath,
    });

    try {
      const words      = this._tokenize(text);
      const totalWords = words.length;
      if (totalWords === 0) throw new Error('[CaptionService] text contains no words');

      let entries = [];
      const totalDurationMs = durationSeconds * 1000;

      // 1. Try to get perfect word-level timestamps using Whisper if audio is provided
      if (input.audioPath && process.env.OPENAI_API_KEY) {
        try {
          const openai = new OpenAI();
          const transcription = await openai.audio.transcriptions.create({
            file: fs.createReadStream(input.audioPath),
            model: 'whisper-1',
            response_format: 'verbose_json',
            timestamp_granularities: ['word']
          });

          if (transcription.words && transcription.words.length > 0) {
            entries = transcription.words.map((w, i) => {
              // Whisper timestamps are in seconds
              const start = w.start * 1000;
              let end = w.end * 1000;
              
              // Ensure we don't exceed the total duration
              if (end > totalDurationMs || i === transcription.words.length - 1) {
                end = totalDurationMs;
              }

              return {
                index: i + 1,
                start,
                end,
                text: w.word
              };
            });
            logger.info('[CaptionService] Successfully synced captions using Whisper API');
          }
        } catch (whisperErr) {
          logger.warn('[CaptionService] Whisper sync failed, falling back to proportional timing', whisperErr);
        }
      }

      // 2. Fallback to heuristic proportional timing
      if (entries.length === 0) {
        const chunks = this._chunkWords(words, wordsPerChunk);
        entries = this._assignTimestamps(chunks, totalDurationMs);
        logger.info('[CaptionService] Synced captions using proportional heuristic');
      }

      // Add emojis and keyword highlighting
      for (const entry of entries) {
        // Keyword heuristic: > 5 chars, ALL CAPS (len > 1), or ends in !/?
        const cleanWord = entry.text.replace(/[^a-zA-Z]/g, '');
        const isLong = cleanWord.length > 5;
        const isCaps = cleanWord.length > 1 && cleanWord === cleanWord.toUpperCase();
        const hasEmotion = /[!?]/.test(entry.text);
        
        if (isLong || isCaps || hasEmotion) {
          entry.text = `{\\c&H0000E6FF&}${entry.text}`; // BGR format for #FFE600 (Yellow)
        }

        if (useEmoji) {
          const emoji = this._lookupEmoji(entry.text);
          if (emoji) entry.text = `${entry.text} ${emoji}`;
        }
      }

      // Render ASS file
      const assContent = this._renderASS(entries, fontName, fontSize);

      fs.mkdirSync(path.dirname(assPath), { recursive: true });
      fs.writeFileSync(assPath, assContent, 'utf8');

      const stats = fs.statSync(assPath);

      const duration_ms = step.done({
        entryCount:      entries.length,
        totalWords,
        durationSeconds,
        file_size_bytes: stats.size,
        outputPath:      assPath,
        format:          'ass',
      });

      return {
        outputPath:      assPath,
        entryCount:      entries.length,
        totalWords,
        durationSeconds,
        file_size_bytes: stats.size,
        format:          'ass',
        duration_ms,
      };

    } catch (err) {
      step.fail(err);
      throw err;
    }
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  _tokenize(text) {
    return text.replace(/\n+/g, ' ').trim().split(/\s+/).filter(Boolean);
  }

  _chunkWords(words, chunkSize) {
    const chunks = [];
    for (let i = 0; i < words.length; i += chunkSize) {
      chunks.push(words.slice(i, i + chunkSize).join(' '));
    }
    return chunks;
  }

  _assignTimestamps(chunks, totalDurationMs) {
    const entries = [];
    
    // Calculate total "weight" of all chunks to distribute time proportionally.
    // Base weight is character count. We add artificial weight for punctuation 
    // because TTS engines pause longer at commas and periods.
    const chunksWithWeight = chunks.map(chunk => {
      let weight = chunk.length;
      if (/[.,]/.test(chunk)) weight += 6;   // Small pause
      if (/[!?]/.test(chunk)) weight += 10;  // Large pause
      // Minimum weight so tiny words like "a" or "I" don't flash too fast
      if (weight < 4) weight = 4;
      return { text: chunk, weight };
    });

    const totalWeight = chunksWithWeight.reduce((sum, c) => sum + c.weight, 0);
    
    let cursor = 0;
    for (let i = 0; i < chunksWithWeight.length; i++) {
      const { text, weight } = chunksWithWeight[i];
      
      let duration = (weight / totalWeight) * totalDurationMs;
      
      const start = cursor;
      let end   = cursor + duration;
      
      // Ensure we don't exceed total duration
      if (end > totalDurationMs || i === chunksWithWeight.length - 1) {
        end = totalDurationMs;
      }

      entries.push({ index: i + 1, start, end, text });
      cursor = end;
    }

    return entries;
  }

  /**
   * Look up the emoji for a word chunk.
   * Strips punctuation, lowercases, checks the map.
   */
  _lookupEmoji(chunk) {
    // For multi-word chunks, check each word and return first match
    const words = chunk.split(/\s+/);
    for (const word of words) {
      const clean = word.toLowerCase().replace(/[^a-z']/g, '');
      if (EMOJI_MAP[clean]) return EMOJI_MAP[clean];
    }
    return null;
  }

  /**
   * Render ASS subtitle file.
   *
   * Pop animation breakdown:
   *   \fscx0\fscy0          — start at scale 0 (invisible)
   *   \t(0,120,\fscx110\fscy110)   — grow to 110% in first 120ms (overshoot)
   *   \t(120,220,\fscx100\fscy100) — settle back to 100% by 220ms
   *
   * This creates a satisfying elastic "pop" on every word.
   *
   * Colors are in ASS ABGR hex format:
   *   &H00FFFFFF = opaque white  (primary text)
   *   &H00000000 = opaque black  (outline)
   *   &HCC000000 = 80% black     (shadow/box)
   */
  _renderASS(entries, fontName, fontSize) {
    //   PrimaryColour   = &H00FFFFFF = White text
    //   OutlineColour   = &H00000000 = Opaque black outline (~8-12px)
    //   BackColour      = &H80000000 = Semi-transparent black shadow
    //   BorderStyle=1   = outline + shadow mode
    //   Outline=10      = thick black stroke
    //   Shadow=4        = slight drop shadow
    //   Alignment=5     = dead center of screen
    const header = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${fontName},${fontSize},&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,2,0,1,10,4,5,40,40,220,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text`;

    // Pop-up animation: scale 0→120% in 80ms (overshoot), then settle 120→100% in 100ms (bounce)
    const POP = '{\\fscx0\\fscy0\\t(0,80,\\fscx120\\fscy120)\\t(80,180,\\fscx100\\fscy100)}';

    const dialogueLines = entries.map(({ start, end, text }) => {
      const s = this._formatASSTime(start);
      const e = this._formatASSTime(end);
      // Uppercase all words — reads better in single-word pop style
      const display = text.toUpperCase();
      return `Dialogue: 0,${s},${e},Default,,0,0,0,,${POP}${display}`;
    });

    return [header, ...dialogueLines].join('\n') + '\n';
  }

  /**
   * ASS time format: H:MM:SS.cc  (centiseconds, not milliseconds)
   */
  _formatASSTime(ms) {
    const totalCs = Math.round(ms / 10); // centiseconds
    const cs      = totalCs % 100;
    const totalS  = Math.floor(totalCs / 100);
    const s       = totalS % 60;
    const totalM  = Math.floor(totalS / 60);
    const m       = totalM % 60;
    const h       = Math.floor(totalM / 60);

    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
  }
}

module.exports = new CaptionService();
