#!/usr/bin/env node
'use strict';

/**
 * github-action.js
 * 
 * Invoked by GitHub Actions to generate and post a video for a specific channel.
 * Uses pre-loaded scripts from content/channel_X/scripts.json to bypass AI generation costs.
 * 
 * Usage:
 *   node scripts/github-action.js --channel=channel_1
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const voiceService    = require('../src/services/VoiceService');
const captionService  = require('../src/services/CaptionService');
const renderService   = require('../src/services/RenderService');
const youtubeProvider = require('../src/providers/social/YouTubeProvider');
const logger          = require('../src/utils/logger');
const config          = require('../src/config/env');

// Parse --channel argument
const args = process.argv.slice(2);
const channelArg = args.find(a => a.startsWith('--channel='));
if (!channelArg) {
  logger.error('Missing --channel= argument (e.g. --channel=channel_1)');
  process.exit(1);
}
const channel = channelArg.split('=')[1];

// Paths
const scriptsPath = path.join(__dirname, '..', 'content', channel, 'scripts.json');
const outputDir   = path.resolve(config.ffmpeg.rendersOutput || './renders');

async function main() {
  logger.info(`🤖 GitHub Action Pipeline Started for ${channel}`);

  // 1. Read scripts.json
  if (!fs.existsSync(scriptsPath)) {
    logger.error(`Scripts file not found: ${scriptsPath}`);
    process.exit(1);
  }

  const scriptsData = JSON.parse(fs.readFileSync(scriptsPath, 'utf-8'));
  const scriptIndex = scriptsData.findIndex(s => !s.used);

  if (scriptIndex === -1) {
    logger.error(`No unused scripts left in ${channel}! Please add more.`);
    process.exit(1);
  }

  const story = scriptsData[scriptIndex];
  logger.info(`📝 Selected Script: "${story.title}" (ID: ${story.id})`);

  const jobId = `gh_${Date.now()}_${uuidv4().substring(0, 8)}`;

  try {
    // 2. Voice Generation
    logger.info('🎙️ Generating Voice...');
    const voiceResult = await voiceService.generateVoice({ 
      text: story.story, 
      outputDir, 
      videoJobId: jobId 
    });

    // 3. Captions
    logger.info('📝 Generating Captions...');
    const captionPath = path.join(outputDir, `${jobId}_captions.ass`);
    const captionResult = await captionService.generateCaptions({
      text: story.story,
      audioPath: voiceResult.outputPath,
      durationSeconds: voiceResult.duration_seconds,
      outputPath: captionPath,
      videoJobId: jobId,
    });

    // 4. Render Video
    logger.info('🎬 Rendering Video...');
    const videoOutputPath = path.join(outputDir, `${jobId}_final.mp4`);
    const renderResult = await renderService.render({
      gameplayPath: path.join(__dirname, '..', 'footage', 'gameplay', 'G1_lite.mp4'),
      startSeconds: 0,
      durationSeconds: voiceResult.duration_seconds,
      audioPath: voiceResult.outputPath,
      srtPath: captionResult.outputPath,
      outputPath: videoOutputPath,
    });

    // 5. YouTube Upload
    logger.info('📺 Uploading to YouTube...');
    
    // Set dynamic credentials based on channel
    const envVarName = `YOUTUBE_REFRESH_TOKEN_${channel.toUpperCase()}`;
    const token = process.env[envVarName];
    if (token) {
      youtubeProvider.setChannelToken(token);
    } else {
      logger.warn(`Missing env var ${envVarName} — falling back to default or failing.`);
    }

    const youtubeUrl = await youtubeProvider.uploadVideo(
      renderResult.outputPath,
      story.title,
      `${story.title}\n\n#shorts #storytime #redditstories`
    );

    if (youtubeUrl) {
      logger.info(`✅ Successfully published to ${youtubeUrl}`);
    } else {
      logger.error('❌ Upload failed or provider not configured.');
      process.exit(1);
    }

    // 6. Mark script as used and save
    scriptsData[scriptIndex].used = true;
    fs.writeFileSync(scriptsPath, JSON.stringify(scriptsData, null, 2), 'utf-8');
    logger.info('💾 Saved scripts.json (marked as used)');

    logger.info('🏁 Pipeline complete!');
    process.exit(0);

  } catch (err) {
    logger.error('❌ Pipeline failed:', { error: err.message, stack: err.stack });
    process.exit(1);
  }
}

main();
