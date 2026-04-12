# Cloud Backup Manual Control Guide

## Overview
- **Cloud Backup Interval**: 1440 minutes (24 hours per day)
- **Automatic**: Backups trigger on **first morning boot** + daily at **6:00 AM**
- **Manual Trigger**: Use `manual_backup.js` script for on-demand backups
- **Listing**: View last 5 backups from B2 and local storage

---

## Quick Commands

### Trigger Backup Now
```bash
node manual_backup.js backup
```
Creates a local backup + uploads to Backblaze B2 immediately

### Upload Existing Backup
```bash
node manual_backup.js upload
```
Uploads the most recent local backup to cloud

### List All Backups
```bash
node manual_backup.js list
```
Shows last 5 backups from both B2 cloud and local storage

### List Only Local Backups
```bash
node manual_backup.js local
```
Shows last 5 local backups only

### List Only Cloud Backups
```bash
node manual_backup.js cloud
```
Shows last 5 backups from B2 only

### Help
```bash
node manual_backup.js help
```
Shows complete help message

---

## Usage Examples

### Example 1: Manual Daily Backup
```bash
# In backend folder
node manual_backup.js backup

# Output:
# 🔐 Cloud Backup Manager - Manual Control
# 📅 Creating local backup...
# ✅ Local backup created: backup-2026-04-13-143022.tar.gz
# ☁️  Uploading to cloud (Backblaze B2)...
# ✅ Cloud upload successful!
#    File: backup-2026-04-13-143022.tar.gz
#    Size: 45.23 MB
#    Upload time: 12345 ms
```

### Example 2: Check Backup Status
```bash
node manual_backup.js list

# Output:
# 🔐 Cloud Backup Manager - Manual Control
# 📋 Fetching backups from B2...
# 
# ✅ Found 3 backups:
# 
# 1. backup-2026-04-13-143022.tar.gz
#    Size: 45.23 MB
#    Uploaded: 4/13/2026, 2:30:22 PM
#    ID: 4a48fe8d28f78f27a6230513
# 
# 2. backup-2026-04-12-000000.tar.gz
#    Size: 44.98 MB
#    Uploaded: 4/12/2026, 12:00:00 AM
#    ID: 4a48fe8d28f78f27a6230512
# 
# 📂 Local backups in: G:\textile-stock-management\backend\backups
# 
# 📦 Last 3 local backups:
# 
# 1. backup-2026-04-13-143022.tar.gz
#    Size: 45.23 MB
#    Modified: 4/13/2026, 2:15:30 PM
```

---

## Configuration

### Required Environment Variables
Add to `.env` file in backend folder:

```env
# Cloud Backup Settings
CLOUD_BACKUP_ENABLED=true
CLOUD_BACKUP_PROVIDER=backblaze-b2
CLOUD_BACKUP_INTERVAL_MINUTES=1440

# Backblaze B2 Credentials (from B2 Application Keys)
B2_APPLICATION_KEY_ID=your_key_id_here
B2_APPLICATION_KEY=your_app_key_here
B2_BUCKET_NAME=textile-stock-backups
```

### Backup Interval Settings

| Interval | Frequency | Cost Impact |
|----------|-----------|------------|
| 60 | Every hour | ❌ High (24x/day) |
| 360 | Every 6 hours | ⚠️ Medium (4x/day) |
| 1440 | Once per day | ✅ Low (1x/day) |
| 10080 | Once per week | ✅✅ Very Low (1x/week) |

**Current Setting**: 1440 minutes = **Daily backups**

To Change Interval:
```bash
# Edit .env
CLOUD_BACKUP_INTERVAL_MINUTES=10080  # Once per week

# Restart server
npm start
```

---

## Automatic Backup Schedule

The system creates automatic backups at **first morning boot** and then daily at **6:00 AM**.

1. **First Morning Boot** - System starts up, creates backup immediately
2. **Check** - System verifies if today's backup already exists
3. **Execute** - If no backup today, create one + upload to cloud
4. **Daily 6:00 AM** - Subsequent daily backups scheduled for 6:00 AM
5. **Upload to B2** - Cloud upload happens within minutes (respects 1440 min interval)

Example Timeline:
```
Day 1:
- 07:00 AM: System boots → Backup created → Uploaded to B2
- 06:00 AM: (Daily trigger, but backup already done today)

Day 2:
- 06:00 AM: Daily backup + upload to B2
- 06:00 AM + 1440 min: Next cloud upload scheduled
```

---

## Cost Optimization

### API Call Reduction
- **Previous (60 min intervals)**: 24 API calls/day = 720/month
- **Current (1440 min intervals)**: 1 API call/day = 30/month
- **Savings**: ~96.7% reduction in API calls

### Backblaze B2 Pricing
- **API Calls**: $0.006 per 10,000 calls
- **Storage**: ~$0.013 per GB/month
- **Download**: $0.003 per GB (first 1 GB free daily)

**Monthly Cost Estimate**:
- 1 backup/day = ~0.18 API calls = $0.00001/month
- 45 MB backup × 30 days = 1.35 GB = ~$0.02/month
- **Total**: ~$0.02/month (minimal)

---

## Troubleshooting

### Issue: "Cloud backup disabled: Missing required fields"
**Solution**: Check `.env` file has all B2 credentials configured

### Issue: Local backup fails with "Permission denied"
**Solution**: Ensure `BACKUP_PATH` directory has write permissions

### Issue: Cloud upload timeout
**Solution**: Check internet connection, B2 bucket exists, credentials valid

### Issue: "Cloud backup not enabled"
**Solution**: Make sure `.env` has `CLOUD_BACKUP_ENABLED=true`

### Check Current Settings
```bash
# View cloud backup status (call via API)
curl https://localhost:5001/api/admin/cloud-backup/status
```

---

## For Developers

### Script Location
- `backend/manual_backup.js` - Manual backup trigger script
- `backend/services/backup/cloudBackupManager.js` - Cloud manager class
- `backend/services/backupService.js` - Local backup logic
- `backend/.env` - Configuration

### How It Works
```
┌─ Automatic (every 24hrs) ─────────────────┐
│                                           │
│  1. 23:00 - Create local backup           │
│  2. Store in ./backups folder             │
│  3. Wait 1440 minutes (24 hours)          │
│  4. Upload to B2 (23:00 next day)         │
│  5. Log to audit trail                    │
└───────────────────────────────────────────┘

┌─ Manual (on request) ──────────────────┐
│                                        │
│  1. Run: node manual_backup.js backup  │
│  2. Create local backup immediately    │
│  3. Upload to B2 immediately           │
│  4. Show result and timing             │
└────────────────────────────────────────┘
```

### API Endpoints Available
```
GET  /api/admin/cloud-backup/status   - View current settings
GET  /api/admin/cloud-backup/timing   - Get backup timing (minutes)
POST /api/admin/cloud-backup/timing   - Update backup timing
     Body: { intervalMinutes: 1440 }
```

---

## Support

For B2 setup issues:
1. Login to [Backblaze B2](https://www.backblaze.com/b2/cloud-storage/)
2. Go to App Keys section
3. Create new Application Key
4. Copy Key ID and App Key to `.env`
5. Ensure bucket `textile-stock-backups` is created

---

**Last Updated**: April 13, 2026  
**Backup Interval**: 1440 minutes (24 hours)  
**Cost**: ~$0.02/month for 1.35 GB average
