/**
 * Cloud Backup API Endpoints
 * Add these routes to your adminRoutes.js file
 */

const express = require('express');

/**
 * Example code to add to backend/routes/adminRoutes.js:
 * 
 * Place these routes inside your router to handle cloud backup operations
 */

const cloudBackupRoutes = (router, cloudBackupManager) => {
  // Get cloud backup configuration and status
  router.get('/cloud-backup/status', async (req, res) => {
    try {
      const status = await cloudBackupManager.getStatus();
      res.json(status);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Test cloud connection
  router.post('/cloud-backup/test-connection', async (req, res) => {
    try {
      const result = await cloudBackupManager.testConnection();
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get available cloud providers
  router.get('/cloud-backup/providers', (req, res) => {
    try {
      const { getAvailableProviders } = require('../services/backup/cloudProviders/index');
      const providers = getAvailableProviders();
      res.json(providers);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Update cloud configuration
  router.post('/cloud-backup/configure', async (req, res) => {
    try {
      const { provider, applicationKeyId, applicationKey, bucketName, enabled } = req.body;
      
      const newConfig = {
        enabled: enabled !== false,
        provider,
        applicationKeyId,
        applicationKey,
        bucketName
      };

      const status = await cloudBackupManager.updateConfig(newConfig);
      
      // Persist config to environment or database
      if (req.backupConfig) {
        Object.assign(req.backupConfig, newConfig);
      }

      res.json({ success: true, status });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // List cloud backups
  router.get('/cloud-backup/list', async (req, res) => {
    try {
      const backups = await cloudBackupManager.listCloudBackups();
      res.json(backups);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Upload backup to cloud
  router.post('/cloud-backup/upload/:backupName', async (req, res) => {
    try {
      const { backupName } = req.params;
      const backupPath = require('path').join(
        require('path').dirname(__dirname),
        'backups',
        backupName
      );

      const result = await cloudBackupManager.uploadBackupSync(backupPath);
      res.json({ success: true, result });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Download backup from cloud
  router.post('/cloud-backup/download/:backupName', async (req, res) => {
    try {
      const { backupName } = req.params;
      const localPath = require('path').join(
        require('path').dirname(__dirname),
        'backups',
        `restored_${backupName}`
      );

      await cloudBackupManager.downloadBackup(backupName, localPath);
      
      // Send file to client
      res.download(localPath, `${backupName}.tar.gz`, (err) => {
        if (err) console.error('Error sending file:', err);
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Delete backup from cloud
  router.delete('/cloud-backup/:backupName', async (req, res) => {
    try {
      const { backupName } = req.params;
      await cloudBackupManager.deleteCloudBackup(backupName);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Sync local backups to cloud
  router.post('/cloud-backup/sync', async (req, res) => {
    try {
      const result = await cloudBackupManager.syncLocalToCloud();
      res.json({ success: true, result });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get backup timing configuration
  router.get('/cloud-backup/timing', (req, res) => {
    try {
      const intervalMinutes = global.CLOUD_BACKUP_INTERVAL 
        ? global.CLOUD_BACKUP_INTERVAL / 60 / 1000 
        : 60;
      
      res.json({
        intervalMinutes,
        intervalMilliseconds: global.CLOUD_BACKUP_INTERVAL,
        description: `Cloud backup scheduled ${intervalMinutes} minutes after local backup completes`
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Update backup timing configuration
  router.post('/cloud-backup/timing', (req, res) => {
    try {
      const { intervalMinutes } = req.body;
      
      if (!intervalMinutes || intervalMinutes < 1 || intervalMinutes > 1440) {
        return res.status(400).json({ 
          error: 'intervalMinutes must be between 1 and 1440 (1 day)' 
        });
      }

      // Update global interval
      global.CLOUD_BACKUP_INTERVAL = intervalMinutes * 60 * 1000;
      
      res.json({
        success: true,
        intervalMinutes,
        intervalMilliseconds: global.CLOUD_BACKUP_INTERVAL,
        message: `Cloud backup timing updated: ${intervalMinutes} minutes after local backup`
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
};

module.exports = cloudBackupRoutes;
