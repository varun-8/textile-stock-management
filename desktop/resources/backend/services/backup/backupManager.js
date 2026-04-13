// Phase 10: Backup Manager
// Automated database backup with retention policies

const { exec } = require('child_process');
const { promises: fs } = require('fs');
const path = require('path');

class BackupManager {
  constructor(mongoUrl, backupDir) {
    this.mongoUrl = mongoUrl;
    this.backupDir = backupDir;
    this.backups = [];
    this.backupIntervals = [];

    // Retention policies
    this.retentionPolicy = {
      hourly: { count: 24, interval: 60 * 60 * 1000 },     // Keep 24 hourly
      daily: { count: 30, interval: 24 * 60 * 60 * 1000 },   // Keep 30 daily
      weekly: { count: 12, interval: 7 * 24 * 60 * 60 * 1000 }, // Keep 12 weekly
      monthly: { count: 12, interval: 30 * 24 * 60 * 60 * 1000 } // Keep 12 monthly
    };
  }

  /**
   * Create manual backup
   */
  async createBackup(tag = 'manual') {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupName = `backup_${tag}_${timestamp}`;
      const backupPath = path.join(this.backupDir, backupName);

      console.log(`💾 Creating backup: ${backupName}`);

      // Execute mongodump
      await new Promise((resolve, reject) => {
        exec(
          `mongodump --uri "${this.mongoUrl}" --out "${backupPath}"`,
          (error, stdout, stderr) => {
            if (error) reject(error);
            else resolve();
          }
        );
      });

      const backup = {
        name: backupName,
        path: backupPath,
        tag,
        createdAt: Date.now(),
        size: await this.getBackupSize(backupPath)
      };

      this.backups.push(backup);
      console.log(`✅ Backup created: ${backupName} (${backup.size} MB)`);

      return backup;
    } catch (error) {
      console.error(`❌ Backup failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Schedule automatic backups
   */
  scheduleBackups(intervalMs = 60 * 60 * 1000) {
    console.log(`📅 Scheduling backups every ${intervalMs / 60000} minutes`);

    const interval = setInterval(async () => {
      try {
        await this.createBackup('hourly');
        await this.enforceRetentionPolicy();
      } catch (error) {
        console.error('Scheduled backup failed:', error.message);
      }
    }, intervalMs);

    this.backupIntervals.push(interval);
  }

  /**
   * Restore from backup
   */
  async restoreFromBackup(backupName) {
    try {
      const backup = this.backups.find(b => b.name === backupName);
      if (!backup) throw new Error(`Backup not found: ${backupName}`);

      console.log(`📥 Restoring from backup: ${backupName}`);

      // Execute mongorestore
      await new Promise((resolve, reject) => {
        exec(
          `mongorestore --uri "${this.mongoUrl}" --dir "${backup.path}"`,
          (error, stdout, stderr) => {
            if (error) reject(error);
            else resolve();
          }
        );
      });

      console.log(`✅ Restore completed: ${backupName}`);
      return true;
    } catch (error) {
      console.error(`❌ Restore failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Enforce retention policy
   */
  async enforceRetentionPolicy() {
    const now = Date.now();

    for (const [type, { count, interval }] of Object.entries(this.retentionPolicy)) {
      const backupsOfType = this.backups.filter(b => b.tag === type);
      
      // Keep only recent backups
      while (backupsOfType.length > count) {
        const oldest = backupsOfType.shift();
        await this.deleteBackup(oldest.name);
      }
    }
  }

  /**
   * Delete old backup
   */
  async deleteBackup(backupName) {
    try {
      const backup = this.backups.find(b => b.name === backupName);
      if (!backup) return;

      await fs.rm(backup.path, { recursive: true, force: true });
      this.backups = this.backups.filter(b => b.name !== backupName);
      console.log(`🗑️ Deleted old backup: ${backupName}`);
    } catch (error) {
      console.error(`Failed to delete backup: ${error.message}`);
    }
  }

  /**
   * Get backup size in MB
   */
  async getBackupSize(dirPath) {
    try {
      const stats = await fs.stat(dirPath);
      return Math.round(stats.size / 1024 / 1024);
    } catch {
      return 0;
    }
  }

  /**
   * List backups
   */
  listBackups() {
    return this.backups.sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Stop scheduled backups
   */
  stopScheduling() {
    this.backupIntervals.forEach(interval => clearInterval(interval));
    this.backupIntervals = [];
  }
}

module.exports = { BackupManager };
