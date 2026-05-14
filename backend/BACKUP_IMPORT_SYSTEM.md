# Data Backup & Import Recovery System

## 🎯 Overview

This system ensures that all data, including the new `employeeName` field, is properly backed up and can be restored with full integrity validation.

### Key Features
- ✅ Automated daily backups at boot and 6:00 AM
- ✅ Cloud backup integration (Backblaze B2)
- ✅ Pre-import validation and verification
- ✅ EmployeeName field tracking and migration
- ✅ Safety checkpoints before restoration
- ✅ Comprehensive error handling and recovery

---

## 📦 Backup Creation Process

### Automatic Backups
Backups are created automatically:
1. **First morning boot** - System creates backup on startup
2. **Daily at 6:00 AM** - Scheduled backup
3. **Cloud upload** - After 24-hour interval (configurable)

### Manual Backups
```bash
curl -X POST http://localhost:5000/api/admin/backup \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "filename": "backup-MANUAL-2026-05-13T10-30-00-000Z.json"
}
```

### Backup File Location
Default: `./backend/backups/`
Custom: Configure via admin settings or `.env`

---

## 🔍 Pre-Import Verification

### Step 1: Check Backup Integrity
```bash
cd backend
node verify_backup_import.js
```

**Output Includes:**
- ✅ Total records in backup
- ✅ EmployeeName field coverage
- ✅ Collection summary
- ✅ Import readiness status

### Step 2: Check Current Database Status
```bash
node check_db.js
```

**Verifies:**
- ✅ Database connection
- ✅ Record counts
- ✅ Index status
- ✅ Field distribution

---

## 📥 Data Import Methods

### Method 1: Via Admin API (Recommended)
```bash
POST /api/admin/restore
Content-Type: application/json
Authorization: Bearer ADMIN_TOKEN

{
  "filename": "backup-AUTO-2026-05-13T06-00-00-000Z.json"
}
```

### Method 2: Enhanced Restore Script
```bash
# Restore latest backup
cd backend
node restore_enhanced.js

# OR specify a backup file
node restore_enhanced.js backup-AUTO-2026-05-13T06-00-00-000Z.json
```

**Process:**
1. ✅ Validates backup file
2. ✅ Creates safety checkpoint
3. ✅ Clears existing data
4. ✅ Imports collections with validation
5. ✅ Verifies employeeName coverage
6. ✅ Reports success/failures

### Method 3: Cloud Restore
```bash
cd backend
node manual_backup.js cloud
```

---

## 🔄 Data Migration & Backfill

### Situation: Old Backups Without EmployeeName
```bash
cd backend
node migrate_employee_name.js
```

**Process:**
1. ✅ Scans existing ClothRoll records
2. ✅ Extracts employeeName from transaction history
3. ✅ Backfills missing fields
4. ✅ Verifies coverage (>80% target)
5. ✅ Reports migration results

**Example Output:**
```
✨ Migration Complete!
   ✅ Updated: 1,250 records
   ⚠️  Set to 'Unknown': 50 records
   📊 Total migrated: 1,300/1,300

🔍 Final verification: 1,300/1,300 records have employeeName
✅ Data integrity confirmed - All records properly backed up!
```

---

## ✅ Post-Import Verification

### Verify Import Success
```bash
# Check total record count
db.clothrolls.countDocuments()

# Check employeeName distribution
db.clothrolls.aggregate([
    { $group: { _id: '$employeeName', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
])

# Check for missing employeeName
db.clothrolls.find({ 
    $or: [
        { employeeName: { $exists: false } },
        { employeeName: null }
    ]
}).count()
```

### Test Application Features
- ✅ Verify Inbound Analysis displays employee names
- ✅ Check Stock In/Out logs show operators
- ✅ Test Dispatch Queue views
- ✅ Verify Dashboard operations log

---

## 🛡️ Recovery Procedures

### Complete Database Recovery
```bash
cd backend

# 1. List available backups
ls -la backups/

# 2. Restore from specific backup
node restore_enhanced.js backup-SAFETY-2026-05-13T09-45-00-000Z.json

# 3. Verify restoration
node check_db.js
```

### Partial Data Recovery
```bash
# If only ClothRoll data needs recovery
db.clothrolls.deleteMany({})

# Then restore via API with specific backup
POST /api/admin/restore
```

### Recovery from Corrupted Import
1. **Safety Backup Automatic**
   - System automatically creates SAFETY backup before any restore
   - Located in `./backups/backup-SAFETY-*.json`

2. **Restore Safety Backup**
   ```bash
   node restore_enhanced.js backup-SAFETY-LATEST.json
   ```

3. **Verify Success**
   ```bash
   node verify_backup_import.js
   ```

---

## 📊 Complete Workflow Example

### Scenario: Replace data with backup after data corruption

```bash
cd backend

# Step 1: Verify backup exists and is valid
echo "🔍 Checking backups..."
ls -la backups/*.json | tail -5

# Step 2: Verify what's in the backup
echo "✅ Verifying backup data..."
node verify_backup_import.js

# Step 3: Check current database
echo "📊 Current database status..."
node check_db.js

# Step 4: Restore from backup
echo "📥 Starting enhanced restore..."
node restore_enhanced.js

# Step 5: Verify import success
echo "🔍 Verifying import..."
node check_db.js

# Step 6: If employeeName needs backfill
echo "👤 Checking employee name coverage..."
# (Review output from restore)

# If coverage < 80%, run migration
echo "📝 Backfilling employeeName field..."
node migrate_employee_name.js

# Step 7: Final verification
echo "✨ Final status check..."
node check_db.js
```

---

## 🔧 Configuration

### Backup Settings (.env)
```env
# Backup location
BACKUP_PATH=./backend/backups

# Cloud backup (Backblaze B2)
CLOUD_BACKUP_ENABLED=true
CLOUD_BACKUP_PROVIDER=backblaze-b2
CLOUD_BACKUP_INTERVAL_MINUTES=1440

# B2 credentials
B2_APPLICATION_KEY_ID=your_key_id
B2_APPLICATION_KEY=your_app_key
B2_BUCKET_NAME=textile-stock-backups
```

### Change Backup Schedule
Edit `backend/services/backupService.js`:
```javascript
// Current: Daily at 6:00 AM
cron.schedule('0 6 * * *', () => {
    performBackup('AUTO');
});

// To change to every 12 hours:
cron.schedule('0 */12 * * *', () => {
    performBackup('AUTO');
});
```

---

## 📋 Scripts Reference

| Script | Purpose | Command |
|--------|---------|---------|
| `backupService.js` | Core backup/restore logic | Integrated in app |
| `verify_backup_import.js` | Validate backup before import | `node verify_backup_import.js` |
| `restore_enhanced.js` | Advanced restore with validation | `node restore_enhanced.js [filename]` |
| `migrate_employee_name.js` | Backfill employeeName field | `node migrate_employee_name.js` |
| `restore-backup.js` | Legacy restore script | `node restore-backup.js` |
| `check_db.js` | Database health check | `node check_db.js` |
| `manual_backup.js` | Manual cloud backup control | `node manual_backup.js [command]` |

---

## ⚠️ Important Notes

1. **Always Verify Before Import**
   - Run `verify_backup_import.js` before restoring
   - Check employeeName coverage percentage
   - Ensure sufficient disk space

2. **Safety Checkpoints**
   - `restore_enhanced.js` automatically creates SAFETY backup
   - Previous backup is preserved in case of rollback
   - Never delete backup files without verification

3. **EmployeeName Integrity**
   - Required field for operator tracking
   - Automatically extracted from transaction history during migration
   - If missing, falls back to "Unknown"

4. **Cloud Backup**
   - Automatic upload after 24 hours (configurable)
   - Manual upload: `node manual_backup.js backup`
   - Free tier: ~$0.02/month for typical usage

---

## 🚨 Emergency Recovery

**Database completely lost?**

1. Restore latest cloud backup
   ```bash
   node manual_backup.js cloud
   node restore_enhanced.js backup-latest.json
   ```

2. If cloud backup unavailable, restore from safety checkpoint
   ```bash
   node restore_enhanced.js backup-SAFETY-latest.json
   ```

3. Verify all data with post-import checks
   ```bash
   node verify_backup_import.js
   node check_db.js
   ```

---

**Last Updated:** May 13, 2026  
**Version:** 1.2  
**Status:** ✅ Production Ready
