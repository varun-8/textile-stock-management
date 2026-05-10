const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const backupFile = 'C:\\Users\\Vishnunandhan\\AppData\\Roaming\\desktop\\backend-data\\backups\\backup-BOOT-2026-04-30T06-15-36-578Z.json';

async function restoreBackup() {
  try {
    console.log('📂 Reading backup file:', backupFile);
    const backupData = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
    
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect('mongodb://127.0.0.1:27017/textile-stock-management');
    
    const db = mongoose.connection.db;
    console.log('✅ Connected to MongoDB\n');
    
    const collections = backupData.data || {};
    let totalRestored = 0;
    
    for (const [collectionName, records] of Object.entries(collections)) {
      if (!Array.isArray(records)) {
        console.log(`⏭️  Skipping ${collectionName} (not an array)`);
        continue;
      }
      
      if (records.length === 0) {
        console.log(`⏭️  Skipping ${collectionName} (empty)`);
        continue;
      }
      
      try {
        const collection = db.collection(collectionName);
        
        // Clear existing data
        await collection.deleteMany({});
        
        // Insert backup data
        const result = await collection.insertMany(records);
        const count = result.insertedIds.length;
        totalRestored += count;
        
        console.log(`✅ ${collectionName}: Restored ${count} records`);
      } catch (err) {
        console.error(`❌ Error restoring ${collectionName}:`, err.message);
      }
    }
    
    console.log(`\n📊 Total Records Restored: ${totalRestored}`);
    console.log('✨ Backup restoration complete!');
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Restoration failed:', err.message);
    process.exit(1);
  }
}

restoreBackup();
