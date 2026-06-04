'use strict';

/**
 * src/providers/storage/S3Provider.js
 *
 * Handles uploading the rendered video file to AWS S3.
 */

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');
const config = require('../../config/env');
const logger = require('../../utils/logger');

class S3Provider {
  constructor() {
    this.client = null;
    this.bucket = config.aws.s3Bucket;
    this.basePrefix = config.aws.s3BasePrefix || 'renders';

    if (config.aws.accessKeyId && config.aws.secretAccessKey && config.aws.region && this.bucket) {
      this.client = new S3Client({
        region: config.aws.region,
        credentials: {
          accessKeyId: config.aws.accessKeyId,
          secretAccessKey: config.aws.secretAccessKey,
        },
      });
      logger.info('[S3Provider] Initialized AWS S3 Client', { bucket: this.bucket, region: config.aws.region });
    } else {
      logger.warn('[S3Provider] Missing AWS configuration. S3 upload will be disabled.');
    }
  }

  isConfigured() {
    return this.client !== null;
  }

  /**
   * Uploads a file to S3.
   * @param {string} filePath - Absolute path to the local file.
   * @param {string} objectName - Name of the file in S3.
   * @returns {Promise<string|null>} - The public S3 URL of the uploaded file, or null if disabled/failed.
   */
  async uploadVideo(filePath, objectName) {
    if (!this.isConfigured()) return null;

    const fileStream = fs.createReadStream(filePath);
    const key = `${this.basePrefix}/${objectName}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: fileStream,
      ContentType: 'video/mp4',
      // If the bucket doesn't block public access, this makes the object readable:
      // ACL: 'public-read', 
    });

    try {
      logger.info('[S3Provider] Uploading file to S3...', { key, bucket: this.bucket });
      await this.client.send(command);
      
      const s3Url = `https://${this.bucket}.s3.${config.aws.region}.amazonaws.com/${key}`;
      logger.info('[S3Provider] File uploaded successfully', { url: s3Url });
      return s3Url;
    } catch (err) {
      logger.error('[S3Provider] Failed to upload to S3', { error: err.message, key });
      throw err;
    }
  }
}

module.exports = new S3Provider();
