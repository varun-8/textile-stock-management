/**
 * Backblaze B2 Cloud Backup Provider
 * Implements CloudProvider interface for B2 storage
 */

const B2 = require('backblaze-b2');
const fs = require('fs').promises;
const path = require('path');
const CloudProvider = require('./CloudProvider');

class BackblazeB2Provider extends CloudProvider {
  constructor(config) {
    super(config);
    this.name = 'Backblaze B2';
    this.b2Client = null;
    this.bucketId = null;
    this.bucketName = config.bucketName || 'textile-backups';
  }

  /**
   * Initialize B2 connection
   */
  async connect() {
    try {
      if (!this.config.applicationKeyId || !this.config.applicationKey) {
        throw new Error('Missing B2 credentials (applicationKeyId, applicationKey)');
      }

      this.b2Client = new B2({
        applicationKeyId: this.config.applicationKeyId,
        applicationKey: this.config.applicationKey
      });

      // Test connection by authorizing
      await this.b2Client.authorize();

      // Get bucket (create if doesn't exist)
      await this.getBucketOrCreate();

      console.log(`✅ Backblaze B2 connected. Bucket: ${this.bucketName}`);
      return true;
    } catch (error) {
      console.error(`❌ B2 connection failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get bucket or create if missing
   */
  async getBucketOrCreate() {
    try {
      // List buckets
      const response = await this.b2Client.listBuckets();
      let bucket = response.buckets.find(b => b.bucketName === this.bucketName);

      if (!bucket) {
        console.log(`Creating B2 bucket: ${this.bucketName}`);
        const createResponse = await this.b2Client.createBucket({
          bucketName: this.bucketName,
          bucketType: 'allPrivate',
          cors: []
        });
        bucket = createResponse;
      }

      this.bucketId = bucket.bucketId;
      return bucket;
    } catch (error) {
      console.error(`Failed to get/create bucket: ${error.message}`);
      throw error;
    }
  }

  /**
   * Upload file to B2
   */
  async uploadFile(localPath, cloudPath) {
    try {
      if (!this.b2Client) await this.connect();

      const fileContent = await fs.readFile(localPath);
      const fileName = path.basename(cloudPath || localPath);

      // Ensure bucket is set
      if (!this.bucketId) {
        await this.getBucketOrCreate();
      }

      console.log(`📤 Uploading ${fileName} to B2...`);

      // Get upload URL
      const urlResponse = await this.b2Client.getUploadUrl({
        bucketId: this.bucketId
      });

      // Upload file
      const uploadResponse = await this.b2Client.uploadFile({
        uploadUrl: urlResponse.uploadUrl,
        uploadAuthToken: urlResponse.authorizationToken,
        fileName: cloudPath || fileName,
        contentType: 'application/octet-stream',
        data: fileContent,
        onUploadProgress: (event) => {
          const percent = Math.round((event.loaded / event.total) * 100);
          console.log(`  Upload progress: ${percent}%`);
        }
      });

      console.log(`✅ Upload complete: ${fileName} (${fileContent.length} bytes)`);

      return {
        url: uploadResponse.fileInfo?.action === 'upload' 
          ? `b2://${this.bucketName}/${uploadResponse.fileName}`
          : null,
        size: fileContent.length,
        timestamp: new Date().toISOString(),
        fileId: uploadResponse.fileId
      };
    } catch (error) {
      console.error(`❌ B2 upload failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Download file from B2
   */
  async downloadFile(cloudPath, localPath) {
    try {
      if (!this.b2Client) await this.connect();

      console.log(`📥 Downloading ${cloudPath} from B2...`);

      // List files to find the one we want
      const fileName = path.basename(cloudPath);
      const listResponse = await this.b2Client.listFileNames({
        bucketId: this.bucketId,
        startFileName: fileName,
        maxFileCount: 1
      });

      const file = listResponse.files?.find(f => f.fileName === fileName);
      if (!file) {
        throw new Error(`File not found: ${cloudPath}`);
      }

      // Download file
      const downloadResponse = await this.b2Client.downloadFileById({
        fileId: file.fileId
      });

      // Save to local path
      await fs.mkdir(path.dirname(localPath), { recursive: true });
      await fs.writeFile(localPath, downloadResponse.data);

      console.log(`✅ Download complete: ${fileName}`);
      return true;
    } catch (error) {
      console.error(`❌ B2 download failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * List all backups in B2
   */
  async listBackups() {
    try {
      if (!this.b2Client) await this.connect();

      const response = await this.b2Client.listFileNames({
        bucketId: this.bucketId,
        maxFileCount: 1000
      });

      return (response.files || []).map(file => ({
        name: file.fileName,
        size: file.size,
        timestamp: new Date(file.uploadTimestamp).toISOString(),
        fileId: file.fileId,
        provider: 'B2'
      }));
    } catch (error) {
      console.error(`❌ B2 list failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Delete file from B2
   */
  async deleteFile(cloudPath) {
    try {
      if (!this.b2Client) await this.connect();

      const fileName = path.basename(cloudPath);
      
      // Find file to get fileId
      const listResponse = await this.b2Client.listFileNames({
        bucketId: this.bucketId,
        startFileName: fileName,
        maxFileCount: 1
      });

      const file = listResponse.files?.find(f => f.fileName === fileName);
      if (!file) {
        throw new Error(`File not found: ${cloudPath}`);
      }

      // Delete file
      await this.b2Client.deleteFileVersion({
        fileId: file.fileId,
        fileName: file.fileName
      });

      console.log(`✅ Deleted from B2: ${fileName}`);
      return true;
    } catch (error) {
      console.error(`❌ B2 delete failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get file info from B2
   */
  async getFileInfo(cloudPath) {
    try {
      if (!this.b2Client) await this.connect();

      const fileName = path.basename(cloudPath);
      
      const listResponse = await this.b2Client.listFileNames({
        bucketId: this.bucketId,
        startFileName: fileName,
        maxFileCount: 1
      });

      const file = listResponse.files?.find(f => f.fileName === fileName);
      if (!file) {
        throw new Error(`File not found: ${cloudPath}`);
      }

      return {
        size: file.size,
        timestamp: new Date(file.uploadTimestamp).toISOString(),
        url: `https://f${this.b2Client.getAuthToken().slice(0, 3)}.backblazeb2.com/b2api/v1/file/${this.bucketId}/${file.fileName}`
      };
    } catch (error) {
      console.error(`❌ B2 getFileInfo failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check if provider is configured
   */
  isConfigured() {
    return !!(this.config.applicationKeyId && this.config.applicationKey);
  }

  /**
   * Get status info
   */
  async getStatus() {
    try {
      if (!this.isConfigured()) {
        return {
          connected: false,
          message: 'B2 not configured (missing credentials)',
          provider: this.name
        };
      }

      if (!this.b2Client) {
        await this.connect();
      }

      return {
        connected: true,
        message: `Connected to B2 bucket: ${this.bucketName}`,
        provider: this.name,
        bucket: this.bucketName
      };
    } catch (error) {
      return {
        connected: false,
        message: `B2 connection error: ${error.message}`,
        provider: this.name
      };
    }
  }
}

module.exports = BackblazeB2Provider;
