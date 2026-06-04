'use strict';

/**
 * src/providers/social/YouTubeProvider.js
 *
 * Handles uploading the rendered video file to YouTube via the Data API v3.
 */

const { google } = require('googleapis');
const fs = require('fs');
const config = require('../../config/env');
const logger = require('../../utils/logger');

class YouTubeProvider {
  constructor() {
    this.oauth2Client = null;
    this.youtube = null;

    if (config.youtube.clientId && config.youtube.clientSecret) {
      this.oauth2Client = new google.auth.OAuth2(
        config.youtube.clientId,
        config.youtube.clientSecret,
        config.youtube.redirectUri
      );
      
      // Default to env token if present
      if (config.youtube.refreshToken) {
        this.setChannelToken(config.youtube.refreshToken);
      }
    } else {
      logger.warn('[YouTubeProvider] Missing YouTube client config. Upload will be disabled.');
    }
  }

  /**
   * Sets the refresh token for a specific channel dynamically.
   * @param {string} refreshToken 
   */
  setChannelToken(refreshToken) {
    if (!this.oauth2Client) return;
    this.oauth2Client.setCredentials({ refresh_token: refreshToken });
    this.youtube = google.youtube({ version: 'v3', auth: this.oauth2Client });
    logger.info('[YouTubeProvider] Channel credentials active');
  }

  isConfigured() {
    return this.youtube !== null;
  }

  /**
   * Uploads a video to YouTube.
   * @param {string} filePath - Absolute path to the local video file.
   * @param {string} title - Video title.
   * @param {string} description - Video description.
   * @returns {Promise<string|null>} - The public YouTube URL of the uploaded video, or null if disabled/failed.
   */
  async uploadVideo(filePath, title, description) {
    if (!this.isConfigured()) return null;

    const fileSize = fs.statSync(filePath).size;
    
    try {
      logger.info('[YouTubeProvider] Uploading video to YouTube...', { title, fileSize });
      
      const response = await this.youtube.videos.insert({
        part: 'snippet,status',
        requestBody: {
          snippet: {
            title: title.substring(0, 100), // Max title length is 100
            description: description.substring(0, 5000), // Max description is 5000
            tags: ['AI', 'Shorts', 'Storytime', 'Funny', 'Animation'],
            categoryId: '24', // Entertainment
          },
          status: {
            privacyStatus: config.youtube.defaultPrivacy || 'public', // private, unlisted, or public
            selfDeclaredMadeForKids: false,
          },
        },
        media: {
          body: fs.createReadStream(filePath),
        },
      });
      
      const videoId = response.data.id;
      const youtubeUrl = `https://youtube.com/shorts/${videoId}`;
      
      logger.info('[YouTubeProvider] Video uploaded successfully to YouTube', { url: youtubeUrl });
      return youtubeUrl;
    } catch (err) {
      logger.error('[YouTubeProvider] Failed to upload to YouTube', { error: err.message });
      throw err;
    }
  }
}

module.exports = new YouTubeProvider();
