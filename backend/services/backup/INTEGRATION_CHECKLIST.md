# Cloud Backup Integration Checklist

## Phase 1: Install Dependencies ✅

```bash
cd backend
npm install backblaze-b2 dotenv
```

**Time: ~2 minutes**

---

## Phase 2: Environment Setup

### Create/Update `.env` file in `/backend`

```env
# Backblaze B2 Credentials
B2_APPLICATION_KEY_ID=your_key_id_here
B2_APPLICATION_KEY=your_application_key_here
B2_BUCKET_NAME=your-bucket-name

# Cloud Backup Configuration
CLOUD_BACKUP_PROVIDER=backblaze-b2
CLOUD_BACKUP_ENABLED=true
```

**Where to get credentials:**
1. Go to https://www.backblaze.com/b2/cloud-storage/
2. Sign up for free account (5GB free tier)
3. Create Application Key in account settings
4. Copy Application Key ID & Application Key
5. Create a bucket named `textile-stock-backups` (or your choice)
6. Copy bucket name to .env

**Time: ~5 minutes**

---

## Phase 3: Backend Integration

### Step 1: Update `backend/server.js`

Find where you initialize middleware (around line 30-50):

```javascript
// Add these imports at the TOP of file
const { CloudBackupManager } = require('./services/backup/cloudBackupManager');
const cloudBackupRoutes = require('./services/backup/cloudBackupRoutes');
```

Find where you initialize database connection (around line 80-100):

```javascript
// After database check, add this:
const cloudBackupConfig = {
  provider: process.env.CLOUD_BACKUP_PROVIDER || 'backblaze-b2',
  credentials: {
    applicationKeyId: process.env.B2_APPLICATION_KEY_ID,
    applicationKey: process.env.B2_APPLICATION_KEY,
    bucketName: process.env.B2_BUCKET_NAME
  },
  enabled: process.env.CLOUD_BACKUP_ENABLED === 'true'
};

const cloudBackupManager = new CloudBackupManager(cloudBackupConfig);
// Make it global so routes can access it
global.cloudBackupManager = cloudBackupManager;
```

Or call it before app starts:
```javascript
app.listen(5050, () => {
  console.log('Server running on port 5050');
  // Initialize cloud backup after server starts
  if (cloudBackupConfig.enabled) {
    cloudBackupManager.getStatus().then(status => {
      console.log('✅ Cloud backup status:', status);
    }).catch(err => {
      console.log('⚠️ Cloud backup not configured:', err.message);
    });
  }
});
```

**Time: ~3 minutes**

### Step 2: Update `backend/routes/adminRoutes.js`

Find where other routes are imported (top of file):

```javascript
// Add this import
const cloudBackupRoutes = require('../services/backup/cloudBackupRoutes');
```

Find where routes are registered as middleware (around line 15-25):

```javascript
// Add this line with other route registrations
cloudBackupRoutes(router, global.cloudBackupManager);
```

**Exact location**: Look for lines like:
```javascript
router.get('/dashboard', dashboardRoutes.getDashboard);
router.post('/users', userRoutes.createUser);
// ADD THIS LINE BELOW:
cloudBackupRoutes(router, global.cloudBackupManager);
```

**Time: ~2 minutes**

---

## Phase 4: Test Integration

### Test 1: Check Server Starts Without Errors
```bash
cd backend
npm start
```

**Expected output:**
```
✅ Express server running on port 5050
✅ Cloud backup status: { connected: true, provider: 'backblaze-b2' }
```

**Time: ~1 minute**

### Test 2: Test Cloud Connection Endpoint

```bash
curl -X POST http://localhost:5050/api/admin/cloud-backup/test-connection
```

**Expected response:**
```json
{
  "success": true,
  "provider": "backblaze-b2",
  "message": "Successfully connected to Backblaze B2"
}
```

**Time: ~1 minute**

### Test 3: List Provider Configuration
```bash
curl http://localhost:5050/api/admin/cloud-backup/providers
```

**Expected response:**
```json
{
  "providers": [
    {
      "id": "backblaze-b2",
      "name": "Backblaze B2",
      "configFields": ["applicationKeyId", "applicationKey", "bucketName"],
      "status": "connected"
    }
  ]
}
```

**Time: ~1 minute**

---

## Phase 5: Auto Cloud Backup on Local Backup

### Option A: Trigger Cloud Backup After Local Backup (RECOMMENDED)

In `backend/routes/adminRoutes.js`, find the local backup creation code:

```javascript
router.post('/backup', async (req, res) => {
  // ... existing local backup code ...
  
  // After successful local backup, add:
  if (global.cloudBackupManager && process.env.CLOUD_BACKUP_ENABLED === 'true') {
    global.cloudBackupManager.uploadBackupAsync(backupFileName)
      .catch(err => console.error('❌ Cloud backup failed:', err));
    // Note: uploadBackupAsync is non-blocking, doesn't delay response
  }
  
  res.json({ success: true, backup: backupFileName });
});
```

**Time: ~2 minutes**

### Option B: Manual Cloud Backup Upload

Users can manually trigger via API:

```bash
curl -X POST http://localhost:5050/api/admin/cloud-backup/upload/backup_2025_01_15_10_30.json
```

**Time: ~1 minute for each upload**

---

## Phase 6: Add to Settings Page (OPTIONAL)

### Update Desktop App Settings Component

In `desktop/src/components/Settings.jsx`, add Cloud Backup tab:

```jsx
// In the Tab list:
<Tab label="Cloud Backup" value="cloud-backup" />

// In the Tab panels:
<TabPanel value="cloud-backup">
  <CloudBackupSettings />
</TabPanel>
```

Create new file `desktop/src/components/CloudBackupSettings.jsx`:
```jsx
import { useState, useEffect } from 'react';
import { Button, Select, FormControl, InputLabel, MenuItem } from '@mui/material';
import axios from 'axios';

export default function CloudBackupSettings() {
  const [providers, setProviders] = useState([]);
  const [selectedProvider, setSelectedProvider] = useState('backblaze-b2');
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    fetchProviders();
    checkConnection();
  }, []);

  const fetchProviders = async () => {
    try {
      const res = await axios.get('http://localhost:5050/api/admin/cloud-backup/providers');
      setProviders(res.data.providers);
    } catch (err) {
      console.error('Failed to fetch providers:', err);
    }
  };

  const checkConnection = async () => {
    try {
      const res = await axios.post('http://localhost:5050/api/admin/cloud-backup/test-connection');
      setIsConnected(res.data.success);
    } catch (err) {
      setIsConnected(false);
    }
  };

  const handleTestConnection = async () => {
    await checkConnection();
    alert(isConnected ? '✅ Connected!' : '❌ Connection failed');
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>Cloud Backup Configuration</h2>
      
      <FormControl style={{ marginBottom: '20px', minWidth: 200 }}>
        <InputLabel>Cloud Provider</InputLabel>
        <Select
          value={selectedProvider}
          onChange={(e) => setSelectedProvider(e.target.value)}
          label="Cloud Provider"
        >
          {providers.map(p => (
            <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
          ))}
        </Select>
      </FormControl>

      <div>
        <Button 
          variant="contained" 
          onClick={handleTestConnection}
          style={{ marginRight: '10px' }}
        >
          Test Connection
        </Button>
        <span>{isConnected ? '✅ Connected' : '❌ Disconnected'}</span>
      </div>
    </div>
  );
}
```

**Time: ~10 minutes (optional)**

---

## Phase 7: Verify Everything Works

### Full Integration Test

1. **Start backend**: `npm start` in `/backend`
2. **Start desktop**: `npm start` in `/desktop`
3. **Create local backup** via Settings → Backup → Create Backup
4. **Verify cloud upload**: 
   ```bash
   curl http://localhost:5050/api/admin/cloud-backup/list
   ```
5. **Check backup appears** in cloud backup list

**Expected output:**
```json
{
  "backups": [
    {
      "name": "backup_2025_01_15_10_30.json",
      "size": 2048576,
      "uploadedAt": "2025-01-15T10:31:00Z",
      "provider": "backblaze-b2"
    }
  ]
}
```

**Time: ~5 minutes**

---

## Troubleshooting

### Issue: "CloudBackupManager not found"
**Solution**: Check import path in server.js is correct

### Issue: "B2 credentials invalid"
**Solution**: 
1. Double-check B2_APPLICATION_KEY_ID and B2_APPLICATION_KEY in .env
2. Ensure bucket name matches exactly
3. Test credentials in B2 dashboard

### Issue: "Cloud backup uploads very slow"
**Solution**: This is normal for first upload (data already compressed). Future uploads are incremental.

### Issue: "Cloud backup not triggering automatically"
**Solution**: 
1. Set `CLOUD_BACKUP_ENABLED=true` in .env
2. Ensure route integration is added to adminRoutes.js
3. Check backend console for errors

---

## Next Steps After Integration

### Adding AWS S3 Support Later

1. Create new file: `backend/services/backup/cloudProviders/AmazonS3Provider.js`
2. Copy `EXAMPLE_AmazonS3Provider.js` as template
3. Update credentials in provider
4. Add to PROVIDERS map in `index.js`
5. Change `CLOUD_BACKUP_PROVIDER=aws-s3` in .env
6. **That's it!** No other changes needed

See `SCALABILITY_REFERENCE.md` for detailed instructions.

---

## Summary Timeline

| Phase | Time | Status |
|-------|------|--------|
| Install Dependencies | 2 min | ⏳ TODO |
| Environment Setup | 5 min | ⏳ TODO |
| Backend Integration | 5 min | ⏳ TODO |
| Test Integration | 3 min | ⏳ TODO |
| Auto Backup Setup | 2 min | ⏳ TODO |
| Settings UI (optional) | 10 min | ⏳ OPTIONAL |
| **TOTAL** | **~17 minutes** | 🚀 READY |

---

## Files Modified Reference

✅ = Ready to use, just follow checklist

| File | Status | Lines Added |
|------|--------|-------------|
| `.env` | ✅ Ready | 5 lines |
| `backend/server.js` | ✅ Ready | 15 lines |
| `backend/routes/adminRoutes.js` | ✅ Ready | 2 lines |
| `backend/services/backup/cloudProviders/` | ✅ Created | 7 files |
| `backend/services/backup/cloudBackupManager.js` | ✅ Created | 250 lines |
| `backend/services/backup/cloudBackupRoutes.js` | ✅ Created | 180 lines |

All new code is ready - just follow the checklist above!
