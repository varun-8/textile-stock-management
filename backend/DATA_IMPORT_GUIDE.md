# Data Import & Backup Recovery Guide

## Overview
This guide ensures that backup files can be correctly imported, especially with the new `employeeName` field added to ClothRoll records.

## Pre-Import Verification

### Step 1: Verify Backup File Integrity
```bash
cd backend
node verify_backup_import.js
```

This script will:
- ✅ Check the latest backup file
- ✅ Validate employeeName field coverage
- ✅ Verify schema compliance
- ✅ Report any issues before import

**Expected Output:**
```
✅ Connected to MongoDB
📊 Total ClothRoll records in backup: XXXX
📋 EmployeeName Field Coverage:
   ✅ With employeeName: XXXX
   ⚠️  Without employeeName: XX
   📊 Coverage: XX.X%
```

### Step 2: Data Migration (if needed)
If coverage is below 80%, run the migration script:

```bash
node migrate_employee_name.js
```

This will:
- Extract employeeName from transaction history
- Backfill missing employeeName fields
- Create new backup with complete data

## Import Process

### Via API (Recommended)
```bash
POST /api/admin/restore
Content-Type: application/json

{
    "filename": "backup-AUTO-2026-05-13T06-00-00-000Z.json"
}
```

### Manual Restore (Advanced)
Edit `restore-backup.js` to specify the backup file:
```javascript
const backupFile = 'path/to/backup-file.json';
```

Then run:
```bash
node restore-backup.js
```

## Import Validation Checklist

### Before Import
- [ ] Verify backup file exists and is readable
- [ ] Check employeeName coverage (should be >80%)
- [ ] Ensure sufficient disk space for import
- [ ] Close all active connections to database
- [ ] Create system backup before restore

### During Import
- [ ] Monitor console for errors
- [ ] Check for duplicate key errors
- [ ] Verify collection counts match source

### After Import
- [ ] Verify ClothRoll record count: `node check_db.js`
- [ ] Verify employeeName field is populated
- [ ] Run audit: `db.clothrolls.find({ employeeName: null }).count()`
- [ ] Test inventory views (Inbound, Stock In, Out, etc.)

## Troubleshooting

### Issue: "employeeName field is missing"
**Cause:** Import from older backup without the field
**Solution:**
```bash
# After restore, run migration
node migrate_employee_name.js
```

### Issue: "Duplicate key error" on import
**Cause:** Records already exist in database
**Solution:**
```bash
# Clear database before restore
use textile-stock-management
db.clothrolls.deleteMany({})
# Then retry import
```

### Issue: "Import partially failed"
**Cause:** Some records failed validation
**Solution:**
```bash
# Check record count
db.clothrolls.countDocuments()

# Check for records missing employeeName
db.clothrolls.find({ 
    $or: [
        { employeeName: { $exists: false } },
        { employeeName: null }
    ]
}).count()

# If needed, run migration again
node migrate_employee_name.js
```

## Data Integrity Verification

After importing, verify data integrity:

```bash
# Check ClothRoll documents
node check_db.js

# Verify counts for each status
db.clothrolls.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } }
])

# Check employeeName distribution
db.clothrolls.aggregate([
    { $group: { _id: '$employeeName', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
])
```

## Backup File Format

The backup file includes:
```json
{
  "metadata": {
    "timestamp": "2026-05-13T06:00:00.000Z",
    "version": "1.2",
    "type": "AUTO"
  },
  "configSnapshot": { ... },
  "licenseSnapshot": { ... },
  "data": {
    "clothRolls": [
      {
        "_id": "ObjectId",
        "barcode": "26-M-0001",
        "status": "IN",
        "metre": 45.5,
        "weight": 12.3,
        "percentage": 27.03,
        "employeeName": "John Doe",        <-- New field
        "employeeId": "E001",
        "transactionHistory": [...],
        "createdAt": "...",
        "updatedAt": "..."
      }
    ],
    "barcodes": [...],
    "sessions": [...],
    "deliveryChallans": [...]
  }
}
```

## Automated Import with Validation

Use the import helper for hands-off restoration:

```javascript
const { performBackup, restoreBackup } = require('./services/backupService');

// Restore with verification
async function safeRestore(filename) {
    try {
        console.log('🔄 Starting safe restore...');
        
        // 1. Verify backup exists
        const backups = await fs.readdir('./backups');
        if (!backups.includes(filename)) {
            throw new Error('Backup not found');
        }
        
        // 2. Create safety backup
        console.log('🔒 Creating safety backup...');
        await performBackup('SAFETY_BEFORE_RESTORE');
        
        // 3. Perform restore
        console.log('📥 Importing data...');
        await restoreBackup(filename);
        
        // 4. Verify import
        console.log('✅ Import successful - verifying data...');
        const ClothRoll = require('./models/ClothRoll');
        const count = await ClothRoll.countDocuments();
        const namedCount = await ClothRoll.countDocuments({ employeeName: { $ne: null } });
        
        console.log(`✅ Total records: ${count}`);
        console.log(`✅ Named records: ${namedCount}`);
        
        if (namedCount / count > 0.8) {
            console.log('✨ Import verification: PASSED');
        }
    } catch (err) {
        console.error('❌ Import failed:', err.message);
        throw err;
    }
}
```

## Recovery from Failed Import

If import fails or corrupts data:

```bash
# 1. Stop the application
# 2. Check available backups
ls -la backups/

# 3. Restore from safety backup (created before failed import)
cd backend
node restore-backup.js
# (Edit the file to point to SAFETY backup)

# 4. Restart application
npm start
```

## Cloud Backup Integration

Backups are automatically uploaded to Backblaze B2 after creation. To restore from cloud:

```bash
node manual_backup.js cloud
```

This downloads the latest cloud backup and verifies its integrity before import.

---

**Last Updated:** May 13, 2026  
**Backup Version:** 1.2  
**Employee Name Field:** ✅ Integrated
