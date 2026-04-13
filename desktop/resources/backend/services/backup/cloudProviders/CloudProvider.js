/**
 * Abstract Cloud Provider Interface
 * All cloud providers must implement these methods
 */
class CloudProvider {
  constructor(config) {
    this.config = config;
    this.name = 'CloudProvider'; // Override in subclass
  }

  /**
   * Initialize connection to cloud service
   * @returns {Promise<boolean>}
   */
  async connect() {
    throw new Error('connect() must be implemented');
  }

  /**
   * Upload file to cloud
   * @param {string} localPath - Local file path
   * @param {string} cloudPath - Remote path in cloud storage
   * @returns {Promise<{url: string, size: number, timestamp: string}>}
   */
  async uploadFile(localPath, cloudPath) {
    throw new Error('uploadFile() must be implemented');
  }

  /**
   * Download file from cloud
   * @param {string} cloudPath - Remote path in cloud storage
   * @param {string} localPath - Where to save locally
   * @returns {Promise<boolean>}
   */
  async downloadFile(cloudPath, localPath) {
    throw new Error('downloadFile() must be implemented');
  }

  /**
   * List all backups in cloud
   * @returns {Promise<Array>} Array of backup objects
   */
  async listBackups() {
    throw new Error('listBackups() must be implemented');
  }

  /**
   * Delete file from cloud
   * @param {string} cloudPath - Remote path to delete
   * @returns {Promise<boolean>}
   */
  async deleteFile(cloudPath) {
    throw new Error('deleteFile() must be implemented');
  }

  /**
   * Get file info from cloud
   * @param {string} cloudPath - Remote path
   * @returns {Promise<{size: number, timestamp: string, url: string}>}
   */
  async getFileInfo(cloudPath) {
    throw new Error('getFileInfo() must be implemented');
  }

  /**
   * Check if provider is properly configured
   * @returns {boolean}
   */
  isConfigured() {
    throw new Error('isConfigured() must be implemented');
  }

  /**
   * Get provider status info
   * @returns {Promise<{connected: boolean, message: string}>}
   */
  async getStatus() {
    throw new Error('getStatus() must be implemented');
  }
}

module.exports = CloudProvider;
