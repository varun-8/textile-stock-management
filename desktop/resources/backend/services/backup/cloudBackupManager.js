/**
 * Cloud Backup Manager
 * Handles integration between local backups and cloud providers
 * Provides unified interface for backup operations
 */

const fs = require('fs').promises;
const path = require('path');
const { createProvider, validateConfig } = require('./cloudProviders/index');

class CloudBackupManager {
  constructor(backupDir, cloudConfig = null) {
    this.backupDir = backupDir;
    this.cloudConfig = cloudConfig || {};
    this.provider = null;
    this.enabled = false;

    // Initialize provider if configured
    if (this.cloudConfig.enabled && this.cloudConfig.provider) {
      this.initializeProvider();
    }
  }

  /**
   * Initialize cloud provider
   */
  initializeProvider() {
    try {
      const validation = validateConfig(this.cloudConfig.provider, this.cloudConfig);
      
      if (!validation.valid) {
        console.warn(`⚠️ Cloud backup disabled: ${validation.error}`);
        this.enabled = false;
        return;
      }

      this.provider = createProvider(this.cloudConfig.provider, this.cloudConfig);
      this.enabled = true;
      console.log(`✅ Cloud backup initialized: ${this.provider.name}`);
    } catch (error) {
      console.error(`❌ Failed to initialize cloud provider: ${error.message}`);
      this.enabled = false;
    }
  }

  /**
   * Upload backup to cloud (async, non-blocking)
   */
  async uploadBackupAsync(backupPath) {
    if (!this.enabled || !this.provider) {
      console.log('⏭️ Cloud backup disabled, skipping upload');
      return null;
    }

    try {
      // Run in background, don't wait
      setImmediate(async () => {
        try {
          console.log(`📤 Starting background cloud upload: ${path.basename(backupPath)}`);
          const result = await this.provider.uploadFile(
            backupPath,
            `backups/${path.basename(backupPath)}`
          );
          console.log(`✅ Cloud upload completed: ${result.url || 'success'}`);
        } catch (error) {
          console.error(`❌ Background cloud upload failed: ${error.message}`);
          // Don't throw - background task should not break backup process
        }
      });

      return { queued: true };
    } catch (error) {
      console.error(`❌ Failed to queue cloud upload: ${error.message}`);
      return null;
    }
  }

  /**
   * Upload backup to cloud (wait for completion)
   */
  async uploadBackupSync(backupPath) {
    if (!this.enabled || !this.provider) {
      console.log('⏭️ Cloud backup disabled, skipping upload');
      return null;
    }

    try {
      return await this.provider.uploadFile(
        backupPath,
        `backups/${path.basename(backupPath)}`
      );
    } catch (error) {
      console.error(`❌ Cloud upload failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Download backup from cloud
   */
  async downloadBackup(cloudBackupName, localPath) {
    if (!this.enabled || !this.provider) {
      throw new Error('Cloud backup not enabled');
    }

    try {
      return await this.provider.downloadFile(
        `backups/${cloudBackupName}`,
        localPath
      );
    } catch (error) {
      console.error(`❌ Cloud download failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * List cloud backups
   */
  async listCloudBackups() {
    if (!this.enabled || !this.provider) {
      return [];
    }

    try {
      return await this.provider.listBackups();
    } catch (error) {
      console.error(`❌ Failed to list cloud backups: ${error.message}`);
      return [];
    }
  }

  /**
   * Delete backup from cloud
   */
  async deleteCloudBackup(cloudBackupName) {
    if (!this.enabled || !this.provider) {
      throw new Error('Cloud backup not enabled');
    }

    try {
      return await this.provider.deleteFile(`backups/${cloudBackupName}`);
    } catch (error) {
      console.error(`❌ Cloud delete failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Sync local backups to cloud
   */
  async syncLocalToCloud() {
    if (!this.enabled || !this.provider) {
      console.log('⏭️ Cloud backup disabled, skipping sync');
      return { synced: 0 };
    }

    try {
      const files = await fs.readdir(this.backupDir);
      const backupFiles = files.filter(f => f.startsWith('backup_'));
      
      let synced = 0;
      for (const file of backupFiles) {
        try {
          const filePath = path.join(this.backupDir, file);
          await this.provider.uploadFile(
            filePath,
            `backups/${file}`
          );
          synced++;
        } catch (error) {
          console.error(`Failed to sync ${file}: ${error.message}`);
        }
      }

      console.log(`✅ Synced ${synced}/${backupFiles.length} backups to cloud`);
      return { synced, total: backupFiles.length };
    } catch (error) {
      console.error(`❌ Sync to cloud failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get cloud provider status
   */
  async getStatus() {
    if (!this.enabled || !this.provider) {
      return {
        enabled: false,
        provider: this.cloudConfig.provider || 'none',
        message: 'Cloud backup not configured'
      };
    }

    try {
      return {
        enabled: true,
        ...(await this.provider.getStatus())
      };
    } catch (error) {
      return {
        enabled: false,
        provider: this.cloudConfig.provider,
        message: `Error: ${error.message}`
      };
    }
  }

  /**
   * Update cloud configuration
   */
  async updateConfig(newConfig) {
    this.cloudConfig = { ...this.cloudConfig, ...newConfig };
    this.provider = null;
    this.enabled = false;
    
    if (this.cloudConfig.enabled && this.cloudConfig.provider) {
      this.initializeProvider();
    }

    return this.getStatus();
  }

  /**
   * List available backups from cloud (returns last N backups)
   */
  async listBackups(limit = 5) {
    try {
      if (!this.enabled || !this.provider) {
        return {
          success: false,
          message: 'Cloud backup not enabled',
          backups: []
        };
      }

      const backups = await this.listCloudBackups();
      
      // Sort by upload time, newest first
      const sorted = backups.sort((a, b) => {
        const timeA = a.uploadTime || a.fileInfo?.uploadTimestamp || 0;
        const timeB = b.uploadTime || b.fileInfo?.uploadTimestamp || 0;
        return timeB - timeA;
      });

      // Return last N backups
      const limited = sorted.slice(0, limit);

      return {
        success: true,
        backups: limited,
        total: backups.length,
        returned: limited.length
      };
    } catch (error) {
      console.error(`❌ Error listing backups: ${error.message}`);
      return {
        success: false,
        message: error.message,
        backups: []
      };
    }
  }

  /**
   * Test cloud connection
   */
  async testConnection() {
    try {
      if (!this.enabled || !this.provider) {
        return {
          success: false,
          message: 'Cloud provider not initialized'
        };
      }

      await this.provider.connect();
      return {
        success: true,
        message: `Connected successfully to ${this.provider.name}`
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  }
}

module.exports = CloudBackupManager;
