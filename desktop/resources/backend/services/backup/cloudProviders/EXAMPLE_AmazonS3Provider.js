/**
 * Example: Amazon S3 Cloud Provider Template
 * 
 * HOW TO ADD A NEW CLOUD PROVIDER:
 * 1. Copy this file and rename (e.g., AmazonS3Provider.js)
 * 2. Replace all S3-specific code
 * 3. Add to cloudProviders/index.js PROVIDERS map
 * 4. That's it! The system will automatically support it
 * 
 * Example implementation for S3:
 */

const CloudProvider = require('./CloudProvider');
const AWS = require('aws-sdk');

class AmazonS3Provider extends CloudProvider {
  constructor(config) {
    super(config);
    this.name = 'Amazon S3';
    this.s3Client = null;
    this.bucketName = config.bucket || 'textile-backups';
  }

  async connect() {
    try {
      if (!this.config.accessKeyId || !this.config.secretAccessKey) {
        throw new Error('Missing S3 credentials (accessKeyId, secretAccessKey)');
      }

      this.s3Client = new AWS.S3({
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey,
        region: this.config.region || 'us-east-1'
      });

      // Test connection
      await this.s3Client.headBucket({ Bucket: this.bucketName }).promise();

      console.log(`✅ AWS S3 connected. Bucket: ${this.bucketName}`);
      return true;
    } catch (error) {
      console.error(`❌ S3 connection failed: ${error.message}`);
      throw error;
    }
  }

  async uploadFile(localPath, cloudPath) {
    try {
      const fs = require('fs');
      const fileContent = fs.readFileSync(localPath);

      const params = {
        Bucket: this.bucketName,
        Key: cloudPath,
        Body: fileContent,
        ContentType: 'application/octet-stream'
      };

      const result = await this.s3Client.upload(params).promise();

      return {
        url: result.Location,
        size: fileContent.length,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error(`❌ S3 upload failed: ${error.message}`);
      throw error;
    }
  }

  async downloadFile(cloudPath, localPath) {
    try {
      const params = {
        Bucket: this.bucketName,
        Key: cloudPath
      };

      const data = await this.s3Client.getObject(params).promise();
      const fs = require('fs').promises;
      const path = require('path');

      await fs.mkdir(path.dirname(localPath), { recursive: true });
      await fs.writeFile(localPath, data.Body);

      return true;
    } catch (error) {
      console.error(`❌ S3 download failed: ${error.message}`);
      throw error;
    }
  }

  async listBackups() {
    try {
      const params = {
        Bucket: this.bucketName,
        Prefix: 'backups/'
      };

      const data = await this.s3Client.listObjectsV2(params).promise();

      return (data.Contents || []).map(obj => ({
        name: obj.Key.replace('backups/', ''),
        size: obj.Size,
        timestamp: obj.LastModified.toISOString(),
        provider: 'S3'
      }));
    } catch (error) {
      console.error(`❌ S3 list failed: ${error.message}`);
      return [];
    }
  }

  async deleteFile(cloudPath) {
    try {
      const params = {
        Bucket: this.bucketName,
        Key: cloudPath
      };

      await this.s3Client.deleteObject(params).promise();
      return true;
    } catch (error) {
      console.error(`❌ S3 delete failed: ${error.message}`);
      throw error;
    }
  }

  async getFileInfo(cloudPath) {
    try {
      const params = {
        Bucket: this.bucketName,
        Key: cloudPath
      };

      const data = await this.s3Client.headObject(params).promise();

      return {
        size: data.ContentLength,
        timestamp: data.LastModified.toISOString(),
        url: `https://${this.bucketName}.s3.amazonaws.com/${cloudPath}`
      };
    } catch (error) {
      console.error(`❌ S3 getFileInfo failed: ${error.message}`);
      throw error;
    }
  }

  isConfigured() {
    return !!(this.config.accessKeyId && this.config.secretAccessKey && this.config.bucket);
  }

  async getStatus() {
    try {
      if (!this.isConfigured()) {
        return {
          connected: false,
          message: 'S3 not configured'
        };
      }

      if (!this.s3Client) {
        await this.connect();
      }

      return {
        connected: true,
        message: `Connected to S3 bucket: ${this.bucketName}`,
        provider: this.name,
        bucket: this.bucketName
      };
    } catch (error) {
      return {
        connected: false,
        message: `S3 connection error: ${error.message}`
      };
    }
  }
}

module.exports = AmazonS3Provider;

/**
 * TO USE THIS PROVIDER:
 * 
 * 1. Install AWS SDK:
 *    npm install aws-sdk
 * 
 * 2. Add to cloudProviders/index.js:
 *    const AmazonS3Provider = require('./AmazonS3Provider');
 *    
 *    const PROVIDERS = {
 *      'aws-s3': {
 *        name: 'Amazon S3',
 *        class: AmazonS3Provider,
 *        configFields: ['accessKeyId', 'secretAccessKey', 'bucket', 'region'],
 *        docUrl: 'https://aws.amazon.com/s3/',
 *        description: 'Amazon S3 Cloud Storage'
 *      },
 *      // ... other providers
 *    }
 * 
 * 3. Done! Frontend will automatically support it
 */
