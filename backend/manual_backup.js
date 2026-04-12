/**
 * Manual Cloud Backup Script
 * Triggers on-demand backups and lists available backups from B2
 * 
 * Usage:
 *   node manual_backup.js backup       - Trigger immediate backup
 *   node manual_backup.js list         - List last 5 backups from B2
 *   node manual_backup.js upload       - Upload existing backup to cloud
 */

require('dotenv').config();
const path = require('path');
const fs = require('fs').promises;
const BackupService = require('./services/backupService');
const CloudBackupManager = require('./services/backup/cloudBackupManager');

const command = process.argv[2] || 'help';

async function getCloudBackupDir() {
  try {
    const configPath = path.join(__dirname, 'config.json');
    const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
    const backupDir = config.backupPath || path.join(__dirname, './backups');
    
    // Ensure directory exists
    await fs.mkdir(backupDir, { recursive: true });
    return backupDir;
  } catch (error) {
    console.log('⚠️  Using default backup directory');
    const defaultDir = path.join(__dirname, './backups');
    await fs.mkdir(defaultDir, { recursive: true });
    return defaultDir;
  }
}

async function createLocalBackup() {
  try {
    console.log('\n📅 Creating local backup...');
    const backup = await BackupService.createBackup();
    if (backup.success) {
      console.log('✅ Local backup created:', backup.fileName);
      return backup.filePath;
    } else {
      console.error('❌ Local backup failed:', backup.message);
      return null;
    }
  } catch (error) {
    console.error('❌ Error creating local backup:', error.message);
    return null;
  }
}

async function uploadToCloud(filePath) {
  try {
    if (!filePath) {
      console.log('🔄 Creating new backup first...');
      filePath = await createLocalBackup();
    }
    
    if (!filePath) {
      console.error('❌ No backup file to upload');
      return false;
    }

    const backupDir = await getCloudBackupDir();
    const cloudConfig = {
      enabled: process.env.CLOUD_BACKUP_ENABLED === 'true',
      provider: process.env.CLOUD_BACKUP_PROVIDER,
      applicationKeyId: process.env.B2_APPLICATION_KEY_ID,
      applicationKey: process.env.B2_APPLICATION_KEY,
      bucketName: process.env.B2_BUCKET_NAME
    };

    if (!cloudConfig.enabled || !cloudConfig.provider) {
      console.error('❌ Cloud backup not enabled in .env');
      return false;
    }

    console.log('\n☁️  Uploading to cloud (Backblaze B2)...');
    const manager = new CloudBackupManager(backupDir, cloudConfig);
    
    const result = await manager.uploadBackupSync(filePath);
    
    if (result && result.success !== false) {
      console.log('✅ Cloud upload successful!');
      console.log('   File:', result.fileName || path.basename(filePath));
      if (result.fileSize) console.log('   Size:', (result.fileSize / 1024 / 1024).toFixed(2), 'MB');
      if (result.uploadTime) console.log('   Upload time:', result.uploadTime, 'ms');
      return true;
    } else {
      console.error('❌ Cloud upload failed:', result?.message || 'Unknown error');
      return false;
    }
  } catch (error) {
    console.error('❌ Error uploading to cloud:', error.message);
    return false;
  }
}

async function listBackupsFromCloud() {
  try {
    const backupDir = await getCloudBackupDir();
    const cloudConfig = {
      enabled: process.env.CLOUD_BACKUP_ENABLED === 'true',
      provider: process.env.CLOUD_BACKUP_PROVIDER,
      applicationKeyId: process.env.B2_APPLICATION_KEY_ID,
      applicationKey: process.env.B2_APPLICATION_KEY,
      bucketName: process.env.B2_BUCKET_NAME
    };

    if (!cloudConfig.enabled || !cloudConfig.provider) {
      console.error('❌ Cloud backup not enabled in .env');
      return;
    }

    console.log('\n📋 Fetching backups from B2...');
    const manager = new CloudBackupManager(backupDir, cloudConfig);
    
    const result = await manager.listBackups(5); // Get last 5
    
    if (result.success) {
      console.log(`\n✅ Found ${result.backups.length} backups:\n`);
      
      result.backups.forEach((backup, index) => {
        const uploadDate = new Date(backup.uploadTime || backup.fileInfo.uploadTimestamp).toLocaleString();
        const size = (backup.fileSize / 1024 / 1024).toFixed(2);
        console.log(`${index + 1}. ${backup.fileName}`);
        console.log(`   Size: ${size} MB`);
        console.log(`   Uploaded: ${uploadDate}`);
        console.log(`   ID: ${backup.fileId}\n`);
      });
    } else {
      console.error('❌ Failed to list backups:', result.message);
    }
  } catch (error) {
    console.error('❌ Error listing backups:', error.message);
  }
}

async function listLocalBackups() {
  try {
    const backupDir = await getCloudBackupDir();
    console.log('\n📂 Local backups in:', backupDir);
    
    const files = await fs.readdir(backupDir);
    const backups = files
      .filter(f => f.endsWith('.gz') || f.endsWith('.tar') || f.endsWith('.zip'))
      .sort()
      .reverse()
      .slice(0, 5);

    if (backups.length === 0) {
      console.log('📭 No local backups found');
      return;
    }

    console.log(`\n📦 Last ${backups.length} local backups:\n`);
    
    for (let i = 0; i < backups.length; i++) {
      const filePath = path.join(backupDir, backups[i]);
      const stat = await fs.stat(filePath);
      const size = (stat.size / 1024 / 1024).toFixed(2);
      const modified = stat.mtime.toLocaleString();
      
      console.log(`${i + 1}. ${backups[i]}`);
      console.log(`   Size: ${size} MB`);
      console.log(`   Modified: ${modified}\n`);
    }
  } catch (error) {
    console.error('❌ Error listing local backups:', error.message);
  }
}

async function main() {
  console.log('\n🔐 Cloud Backup Manager - Manual Control\n');
  
  switch (command.toLowerCase()) {
    case 'backup':
      console.log('Creating local + cloud backup...');
      const filePath = await createLocalBackup();
      if (filePath) {
        await uploadToCloud(filePath);
      }
      break;

    case 'upload':
      console.log('Uploading to cloud...');
      await uploadToCloud();
      break;

    case 'list':
      console.log('Listing backups from B2 and local storage...');
      await listBackupsFromCloud();
      await listLocalBackups();
      break;

    case 'local':
      await listLocalBackups();
      break;

    case 'cloud':
      await listBackupsFromCloud();
      break;

    case 'help':
    default:
      console.log('Usage: node manual_backup.js <command>\n');
      console.log('Commands:');
      console.log('  backup    - Create local backup + upload to B2');
      console.log('  upload    - Upload existing backup to B2');
      console.log('  list      - Show last 5 backups (both local & cloud)');
      console.log('  local     - Show last 5 local backups only');
      console.log('  cloud     - Show last 5 cloud backups from B2 only');
      console.log('  help      - Show this help message\n');
      console.log('Environment variables required:');
      console.log('  CLOUD_BACKUP_ENABLED=true');
      console.log('  CLOUD_BACKUP_PROVIDER=backblaze-b2');
      console.log('  B2_APPLICATION_KEY_ID=<your-key-id>');
      console.log('  B2_APPLICATION_KEY=<your-app-key>');
      console.log('  B2_BUCKET_NAME=textile-stock-backups\n');
      break;
  }

  process.exit(0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
