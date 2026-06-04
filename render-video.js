#!/usr/bin/env node
'use strict';

/**
 * render-video.js — Milestone 4 CLI runner
 *
 * Chains Milestones 1-3 assets into a final MP4 video.
 *
 * Usage (full pipeline from story JSON + audio + captions):
 *   node render-video.js \
 *     --story-file ./output/test-story.json \
 *     --audio      ./output/<audio>.mp3 \
 *     --srt        ./output/<captions>.srt \
 *     --out        ./renders/
 *
 * Usage (full auto — runs story + voice + captions + render in one shot):
 *   node render-video.js --topic "revenge" --style revenge --auto
 */

const path  = require('path');
const fs    = require('fs');
const gameplayService = require('./src/services/GameplayService');
const renderService   = require('./src/services/RenderService');
const storyService    = require('./src/services/StoryService');
const voiceService    = require('./src/services/VoiceService');
const captionService  = require('./src/services/CaptionService');

function parseArgs() {
  const args = process.argv.slice(2);
  const out  = {};
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--story-file': out.storyFile  = args[++i]; break;
      case '--audio':      out.audioPath  = args[++i]; break;
      case '--srt':        out.srtPath    = args[++i]; break;
      case '--out':        out.outputDir  = args[++i]; break;
      case '--topic':      out.topic      = args[++i]; break;
      case '--length':     out.length     = parseInt(args[++i], 10); break;
      case '--style':      out.style      = args[++i]; break;
      case '--auto':       out.auto       = true; break;
      case '--help':       printHelp(); process.exit(0); break;
    }
  }
  return out;
}

function printHelp() {
  console.log(`
AI Video Factory — Milestone 4: Render Video

Mode A — manual (use existing assets):
  node render-video.js --story-file <path> --audio <path> --srt <path> [--out <dir>]

Mode B — auto (run all steps end-to-end):
  node render-video.js --auto --topic "revenge" [--length 90] [--style revenge] [--out <dir>]

Options:
  --story-file <path>   Path to story JSON (from Milestone 1)
  --audio      <path>   Path to narration .mp3 (from Milestone 2)
  --srt        <path>   Path to captions .srt (from Milestone 3)
  --topic      <string> Story topic (used with --auto)
  --length     <number> Duration in seconds (default: 90)
  --style      <string> Story style (default: dramatic)
  --out        <dir>    Output directory for final MP4 (default: ./renders/)
  --auto               Run the full pipeline automatically
  --help               Show this help

Example:
  node render-video.js --auto --topic "betrayal" --style dramatic
`);
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function findLatestFile(dir, ext) {
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir)
    .filter((f) => f.endsWith(ext))
    .map((f) => ({ name: f, mtime: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  return files.length > 0 ? path.join(dir, files[0].name) : null;
}

function printSection(title) {
  console.log(`\n${'─'.repeat(52)}`);
  console.log(`  ${title}`);
  console.log(`${'─'.repeat(52)}`);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args      = parseArgs();
  const outputDir = path.resolve(args.outputDir || './renders');
  const jobId     = `render_${Date.now()}`;

  console.log('\n🎬 AI Video Factory — Milestone 4: Video Render');
  console.log('═══════════════════════════════════════════════════');

  let storyData, audioPath, srtPath;

  // ── MODE B: Auto pipeline ─────────────────────────────────────────────
  if (args.auto) {
    if (!args.topic) {
      console.error('❌ --topic is required with --auto\n');
      printHelp();
      process.exit(1);
    }

    const lengthSecs = args.length || 90;
    console.log(`🤖 Auto mode: generating full pipeline for "${args.topic}"`);

    // Step 1: Story
    printSection('Step 1/4 — Generating Story');
    const storyResult = await storyService.generateStory({
      topic:          args.topic,
      length_seconds: lengthSecs,
      style:          args.style || 'dramatic',
    });
    storyData = storyResult;
    const storyJsonPath = path.join(outputDir, `${jobId}_story.json`);
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(storyJsonPath, JSON.stringify(storyResult, null, 2));
    console.log(`✅ Story: "${storyResult.story.title}" (${storyResult.story.word_count} words)`);

    // Step 2: Voice
    printSection('Step 2/4 — Generating Voice');
    const voiceResult = await voiceService.generateVoice({
      text:       storyResult.story.story,
      outputDir,
      videoJobId: jobId,
    });
    audioPath = voiceResult.outputPath;
    const actualDuration = voiceResult.duration_seconds;
    console.log(`✅ Audio: ${(voiceResult.file_size_bytes / 1024).toFixed(0)} KB, ~${actualDuration}s`);

    // Step 3: Captions
    printSection('Step 3/4 — Generating Captions');
    srtPath = path.join(outputDir, `${jobId}_captions.srt`);
    const captionResult = await captionService.generateCaptions({
      text:            storyResult.story.story,
      durationSeconds: actualDuration,
      outputPath:      srtPath,
    });
    console.log(`✅ Captions: ${captionResult.entryCount} entries`);

  } else {
    // ── MODE A: Manual — use provided asset paths ───────────────────────
    if (!args.storyFile && !args.audioPath) {
      // Try to find latest files automatically
      const latestStory = findLatestFile('./output', '.json');
      const latestAudio = findLatestFile('./output', '.mp3');
      const latestSrt   = findLatestFile('./output', '.srt');

      if (latestStory && latestAudio && latestSrt) {
        console.log('ℹ️  No args provided — using latest files from ./output/');
        args.storyFile = latestStory;
        args.audioPath = latestAudio;
        args.srtPath   = latestSrt;
      } else {
        console.error('❌ Please provide --story-file, --audio, and --srt, or use --auto\n');
        printHelp();
        process.exit(1);
      }
    }

    if (!args.audioPath) {
      console.error('❌ --audio <path> is required in manual mode\n');
      process.exit(1);
    }
    if (!args.srtPath) {
      console.error('❌ --srt <path> is required in manual mode\n');
      process.exit(1);
    }

    audioPath = path.resolve(args.audioPath);
    srtPath   = path.resolve(args.srtPath);

    if (args.storyFile) {
      storyData = JSON.parse(fs.readFileSync(path.resolve(args.storyFile), 'utf8'));
    }
  }

  // ── Step 4: Render ───────────────────────────────────────────────────────
  printSection('Step 4/4 — Selecting Footage & Rendering');

  const audioStats = fs.statSync(audioPath);
  // Estimate duration from file size if we don't have it from auto mode:
  // MP3 @ 128kbps ≈ 16KB/s
  const durationSeconds = storyData?.story
    ? Math.round(storyData.story.word_count / 130 * 60)
    : Math.round(audioStats.size / 16000);

  // Select gameplay segment
  console.log(`🎮 Selecting ${durationSeconds}s gameplay segment from footage/gameplay/...`);
  const segment = await gameplayService.selectSegment({ durationSeconds });
  console.log(`   File:  ${segment.fileName}`);
  console.log(`   Start: ${segment.startSeconds.toFixed(1)}s / ${Math.floor(segment.totalDuration)}s total`);

  // Build output path
  const outputPath = path.join(outputDir, `${jobId}_final.mp4`);

  console.log(`\n🎞️  Rendering to: ${outputPath}`);
  console.log('   (this may take 30-120 seconds depending on duration)...\n');

  const renderResult = await renderService.render({
    gameplayPath:    segment.filePath,
    startSeconds:    segment.startSeconds,
    audioPath,
    srtPath,
    outputPath,
    durationSeconds,
  });

  // ── Print final summary ──────────────────────────────────────────────────
  console.log('\n✅ Video rendered successfully!\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  if (storyData?.story?.title) {
    console.log(`📌 Title:        ${storyData.story.title}`);
  }
  console.log(`🎞️  Output:       ${renderResult.outputPath}`);
  console.log(`📦 File size:    ${renderResult.file_size_mb} MB`);
  console.log(`⏱️  Render time:  ${renderResult.render_time_s}s`);
  console.log(`🎮 Footage:      ${segment.fileName} @ ${segment.startSeconds.toFixed(1)}s`);
  console.log(`🔤 Captions:     ${path.basename(srtPath)}`);
  console.log(`🔊 Audio:        ${path.basename(audioPath)}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('💡 FFmpeg command used:');
  console.log(`   ${renderResult.ffmpegCommand.slice(0, 200)}...`);
  console.log('');

  process.exit(0);
}

main().catch((err) => {
  console.error('\n❌ Render failed:', err.message);
  process.exit(1);
});
