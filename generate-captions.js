#!/usr/bin/env node
'use strict';

/**
 * generate-captions.js — Milestone 3 CLI runner
 *
 * Usage:
 *   node generate-captions.js --story-file ./output/test-story.json --duration 78
 *   node generate-captions.js --text "Your narration text" --duration 60 --out ./output/
 *
 * The --duration should match the actual audio duration from Milestone 2.
 */

const path = require('path');
const fs   = require('fs');
const captionService = require('./src/services/CaptionService');

function parseArgs() {
  const args = process.argv.slice(2);
  const out  = {};
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--story-file':     out.storyFile   = args[++i]; break;
      case '--text':           out.text        = args[++i]; break;
      case '--duration':       out.duration    = parseFloat(args[++i]); break;
      case '--out':            out.outputDir   = args[++i]; break;
      case '--words-per-chunk': out.wordsPerChunk = parseInt(args[++i], 10); break;
      case '--help':           printHelp(); process.exit(0); break;
    }
  }
  return out;
}

function printHelp() {
  console.log(`
AI Video Factory — Milestone 3: Generate Captions

Usage:
  node generate-captions.js --story-file <path> --duration <seconds> [options]
  node generate-captions.js --text "<text>" --duration <seconds>       [options]

Options:
  --story-file      <path>    Path to story JSON (from Milestone 1)
  --text            <string>  Raw narration text
  --duration        <number>  Audio duration in seconds (from Milestone 2 output)
  --out             <path>    Output directory (default: ./output/)
  --words-per-chunk <number>  Words per caption card (default: 4)
  --help                      Show this help

Example:
  node generate-captions.js --story-file ./output/test-story.json --duration 78
`);
}

async function main() {
  const args = parseArgs();

  let text;
  let outputFileName = 'captions';

  // ── Resolve input ───────────────────────────────────────────────────────
  if (args.storyFile) {
    const filePath = path.resolve(args.storyFile);
    if (!fs.existsSync(filePath)) {
      console.error(`❌ Story file not found: ${filePath}`);
      process.exit(1);
    }
    const storyData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    text = storyData.story?.story;
    outputFileName = `captions_${storyData.story?.title?.replace(/[^a-z0-9]/gi, '_').slice(0, 30) || 'story'}`;
    if (!text) {
      console.error('❌ story.story field not found in JSON file');
      process.exit(1);
    }
  } else if (args.text) {
    text = args.text;
  } else {
    console.error('❌ Either --story-file or --text is required\n');
    printHelp();
    process.exit(1);
  }

  // Use estimated duration if not provided
  const wordCount      = text.trim().split(/\s+/).length;
  const durationSeconds = args.duration ?? Math.round(wordCount / 130 * 60);

  const outputDir  = path.resolve(args.outputDir || './output');
  const outputPath = path.join(outputDir, `${outputFileName}.srt`);

  console.log('\n🎬 AI Video Factory — Milestone 3: Caption Generation');
  console.log('═══════════════════════════════════════════════════');
  console.log(`📝 Words:      ${wordCount}`);
  console.log(`⏱️  Duration:   ${durationSeconds}s`);
  console.log(`🔤 Chunk size: ${args.wordsPerChunk || 4} words per caption`);
  console.log(`📁 Output:     ${outputPath}`);
  console.log('');

  try {
    const result = await captionService.generateCaptions({
      text,
      durationSeconds,
      outputPath,
      options: {
        wordsPerChunk: args.wordsPerChunk || 4,
      },
    });

    console.log('\n✅ Captions generated successfully!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📄 SRT file:     ${result.outputPath}`);
    console.log(`🔢 Entries:      ${result.entryCount} captions`);
    console.log(`📝 Total words:  ${result.totalWords}`);
    console.log(`⏱️  Duration:     ${result.durationSeconds}s`);
    console.log(`📦 File size:    ${result.file_size_bytes} bytes`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n📋 PREVIEW (first 10 entries):');
    console.log('');

    // Show preview of first 10 SRT entries
    const lines = result.srtContent.split('\n');
    const previewLines = lines.slice(0, Math.min(40, lines.length));
    console.log(previewLines.join('\n'));
    if (lines.length > 40) {
      console.log(`... and ${result.entryCount - 10} more entries\n`);
    }

    process.exit(0);

  } catch (err) {
    console.error('\n❌ Caption generation failed:');
    console.error(`   ${err.message}`);
    process.exit(1);
  }
}

main();
