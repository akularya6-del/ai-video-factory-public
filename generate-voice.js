#!/usr/bin/env node
'use strict';

/**
 * generate-voice.js — Milestone 2 CLI runner
 *
 * Can be run standalone (provide --text) or chained after generate-story.js
 * by reading the saved story JSON (--story-file).
 *
 * Usage:
 *   node generate-voice.js --story-file ./output/test-story.json
 *   node generate-voice.js --text "Your narration text here" --out ./output/
 */

const path = require('path');
const fs   = require('fs');
const voiceService = require('./src/services/VoiceService');
const logger       = require('./src/utils/logger');

function parseArgs() {
  const args = process.argv.slice(2);
  const out  = {};
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--story-file': out.storyFile  = args[++i]; break;
      case '--text':       out.text       = args[++i]; break;
      case '--out':        out.outputDir  = args[++i]; break;
      case '--provider':   out.provider   = args[++i]; break;
      case '--help':       printHelp(); process.exit(0); break;
    }
  }
  return out;
}

function printHelp() {
  console.log(`
AI Video Factory — Milestone 2: Generate Voice

Usage:
  node generate-voice.js --story-file <path>  [options]
  node generate-voice.js --text "<text>"       [options]

Options:
  --story-file <path>   Path to story JSON from Milestone 1
  --text       <string> Raw narration text (alternative to --story-file)
  --out        <path>   Output directory for audio file (default: ./output/)
  --provider   <name>   Voice provider: elevenlabs|openai_tts (default: from .env)
  --help                Show this help

Example:
  node generate-voice.js --story-file ./output/test-story.json
  node generate-voice.js --text "Your name is Alex and today is the worst day of your life." --out ./output/
`);
}

async function main() {
  const args = parseArgs();

  let text;
  let storyData = null;

  // ── Resolve input text ──────────────────────────────────────────────────
  if (args.storyFile) {
    const filePath = path.resolve(args.storyFile);
    if (!fs.existsSync(filePath)) {
      console.error(`❌ Story file not found: ${filePath}`);
      process.exit(1);
    }
    storyData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    text = storyData.story?.story;
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

  const outputDir = path.resolve(args.outputDir || './output');

  console.log('\n🎬 AI Video Factory — Milestone 2: Voice Generation');
  console.log('═══════════════════════════════════════════════════');
  console.log(`🎙️  Provider: ${args.provider || process.env.VOICE_PROVIDER || 'elevenlabs'}`);
  console.log(`📝 Text length: ${text.length} chars (~${Math.round(text.split(/\s+/).length / 130 * 60)}s audio)`);
  console.log(`📁 Output dir: ${outputDir}`);
  if (storyData?.story?.title) {
    console.log(`📌 Story: ${storyData.story.title}`);
  }
  console.log('');

  try {
    const result = await voiceService.generateVoice({
      text,
      outputDir,
      videoJobId:   `milestone2_${Date.now()}`,
      providerName: args.provider || null,
    });

    console.log('\n✅ Voice generated successfully!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🔊 Audio file:     ${result.outputPath}`);
    console.log(`⏱️  Est. duration:  ${result.duration_seconds}s`);
    console.log(`📦 File size:      ${(result.file_size_bytes / 1024).toFixed(1)} KB`);
    console.log(`💰 Cost:           $${result.cost_usd}`);
    console.log(`🎤 Provider:       ${result.provider}`);
    console.log(`🎵 Voice ID:       ${result.voice_id}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    process.exit(0);

  } catch (err) {
    console.error('\n❌ Voice generation failed:');
    console.error(`   ${err.message}`);
    if (err.response?.status === 401) {
      console.error('   → Check your ELEVENLABS_API_KEY in .env');
    }
    if (err.response?.status === 422) {
      console.error('   → Text may be too long or contain unsupported characters');
    }
    process.exit(1);
  }
}

main();
