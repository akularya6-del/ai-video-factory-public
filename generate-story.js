#!/usr/bin/env node
'use strict';

/**
 * generate-story.js — Milestone 1 CLI runner
 *
 * Usage:
 *   node generate-story.js --topic "revenge" --length 90 --style dramatic
 *   node generate-story.js --topic "betrayal" --out ./output/story.json
 *
 * Environment:
 *   Requires OPENAI_API_KEY in .env (or environment)
 */

const path = require('path');
const fs   = require('fs');
const storyService = require('./src/services/StoryService');
const logger       = require('./src/utils/logger');

// ── Parse CLI args ──────────────────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  const out  = {};
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--topic':   out.topic          = args[++i]; break;
      case '--length':  out.length_seconds = parseInt(args[++i], 10); break;
      case '--style':   out.style          = args[++i]; break;
      case '--out':     out.outFile        = args[++i]; break;
      case '--help':    printHelp(); process.exit(0); break;
    }
  }
  return out;
}

function printHelp() {
  console.log(`
AI Video Factory — Milestone 1: Generate Story

Usage:
  node generate-story.js --topic <topic> [options]

Options:
  --topic   <string>   Story topic (required)
  --length  <number>   Target duration in seconds (default: 90)
  --style   <string>   Style: dramatic|horror|comedy|inspirational|revenge (default: dramatic)
  --out     <path>     Save output JSON to file (optional)
  --help               Show this help

Example:
  node generate-story.js --topic "revenge" --length 90 --style revenge
`);
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs();

  if (!args.topic) {
    console.error('❌ Error: --topic is required\n');
    printHelp();
    process.exit(1);
  }

  console.log('\n🎬 AI Video Factory — Milestone 1: Story Generation');
  console.log('═══════════════════════════════════════════════════');
  console.log(`📌 Topic:    ${args.topic}`);
  console.log(`⏱️  Length:   ${args.length_seconds || 90}s`);
  console.log(`🎭 Style:    ${args.style || 'dramatic'}`);
  console.log('');

  try {
    const result = await storyService.generateStory({
      topic:          args.topic,
      length_seconds: args.length_seconds || 90,
      style:          args.style || 'dramatic',
    });

    // ── Display results ───────────────────────────────────────────────────
    console.log('✅ Story generated successfully!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📝 TITLE:\n   ${result.story.title}\n`);
    console.log(`🎣 HOOK:\n   ${result.story.hook}\n`);
    console.log(`📖 STORY (${result.story.word_count} words):\n`);
    console.log(result.story.story);
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📣 DESCRIPTION:\n   ${result.story.description}\n`);
    console.log(`🏷️  HASHTAGS: ${result.story.hashtags.map(h => '#' + h).join(' ')}\n`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 STATS:');
    console.log(`   Model:             ${result.model}`);
    console.log(`   Prompt tokens:     ${result.usage.prompt_tokens}`);
    console.log(`   Completion tokens: ${result.usage.completion_tokens}`);
    console.log(`   Total tokens:      ${result.usage.total_tokens}`);
    console.log(`   Estimated cost:    $${result.cost_usd}`);
    console.log(`   Duration:          ${result.duration_ms}ms`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // ── Optionally save to file ───────────────────────────────────────────
    if (args.outFile) {
      const outPath = path.resolve(args.outFile);
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf8');
      console.log(`💾 Output saved to: ${outPath}\n`);
    }

    process.exit(0);

  } catch (err) {
    console.error('\n❌ Story generation failed:');
    console.error(`   ${err.message}`);
    if (err.code === 'QUALITY_GATE_FAILED') {
      console.error(`   (word count was ${err.word_count} — try a longer --length)`);
    }
    if (err.code === 'VALIDATION_ERROR') {
      console.error('   Schema errors:', err.validationErrors?.map(e => e.message).join(', '));
    }
    process.exit(1);
  }
}

main();
