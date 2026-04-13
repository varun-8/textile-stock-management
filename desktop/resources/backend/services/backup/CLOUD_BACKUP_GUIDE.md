# Cloud Backup System - Implementation Guide

## Overview

This is a scalable, plugin-based cloud backup system that currently supports Backblaze B2 and can easily support other providers (AWS S3, Google Cloud Storage, Azure, etc.) with minimal code changes.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│           Backup Manager (Local)                     │
│  (Creates backups, manages local files)             │
└────────────────┬────────────────────────────────────┘
                 │
                 │ Uses
                 ↓
┌─────────────────────────────────────────────────────┐
│      Cloud Backup Manager (Orchestrator)             │
│  (Handles cloud upload/download/sync)               │
└────────────────┬────────────────────────────────────┘
                 │
                 │ Delegates to
                 ↓
┌─────────────────────────────────────────────────────┐
│      Provider Registry / Factory                     │
│  (Creates provider instances based on config)       │
└────────────────┬────────────────────────────────────┘
                 │
        ┌────────┴────────┐
        │                 │
        ↓                 ↓
   ┌─────────┐      ┌──────────────┐
   │   B2    │      │   S3 (TODO)  │
   │Provider │      │  Provider    │
   └─────────┘      └──────────────┘
```

## File Structure

```
backend/services/backup/
├── backupManager.js              # Local backup management (existing)
├── cloudBackupManager.js          # NEW: Cloud operations orchestrator
├── cloudBackupRoutes.js           # NEW: API endpoints
└── cloudProviders/
    ├── CloudProvider.js           # NEW: Abstract base interface
    ├── BackblazeB2Provider.js     # NEW: B2 implementation
    ├── index.js                   # NEW: Provider registry & factory
    └── EXAMPLE_AmazonS3Provider.js # NEW: Template for future providers
```

## Adding Backblaze B2 Support

### 1. Install B2 SDK

```bash
npm install backblaze-b2
```

### 2. Get B2 Credentials

1. Sign up for Backblaze B2: https://www.backblaze.com/b2/cloud-storage/
2. Create an application key
3. Copy: `Application Key ID` and `Application Key`

### 3. Update backend/server.js

Add CloudBackupManager initialization:

```javascript
// Import near top
const CloudBackupManager = require('./services/backup/cloudBackupManager');

// After backupManager initialization
const cloudBackupConfig = {
  enabled: process.env.CLOUD_BACKUP_ENABLED === 'true',
  provider: process.env.CLOUD_BACKUP_PROVIDER || 'backblaze-b2',
  applicationKeyId: process.env.B2_APPLICATION_KEY_ID,
  applicationKey: process.env.B2_APPLICATION_KEY,
  bucketName: process.env.B2_BUCKET_NAME || 'textile-backups'
};

const cloudBackupManager = new CloudBackupManager(backupDir, cloudBackupConfig);

// Attach to request for route access
app.use((req, res, next) => {
  req.cloudBackupManager = cloudBackupManager;
  next();
});
```

### 4. Add Routes to adminRoutes.js

```javascript
// Near top of adminRoutes.js
const cloudBackupRoutes = require('../services/backup/cloudBackupRoutes');

// Inside router export (at the end)
module.exports = (io) => {
  const router = express.Router();
  
  // ... existing routes ...
  
  // Add cloud backup routes
  cloudBackupRoutes(router, cloudBackupManager);
  
  return router;
};
```

### 5. Update backupManager.js

Integrate cloud upload when creating local backup:

```javascript
// In createBackup() method, after successful local save:
if (req.cloudBackupManager?.enabled) {
  req.cloudBackupManager.uploadBackupAsync(backupPath);
}
```

### 6. Set Environment Variables

```bash
# .env file
CLOUD_BACKUP_ENABLED=true
CLOUD_BACKUP_PROVIDER=backblaze-b2
B2_APPLICATION_KEY_ID=your_key_id_here
B2_APPLICATION_KEY=your_application_key_here
B2_BUCKET_NAME=textile-backups
```

## API Endpoints

### Get Cloud Backup Status
```
GET /api/admin/cloud-backup/status
Response: { enabled, provider, message, bucket }
```

### List Cloud Providers
```
GET /api/admin/cloud-backup/providers
Response: [{ id, name, configFields[], docUrl, description }]
```

### Test Connection
```
POST /api/admin/cloud-backup/test-connection
Response: { success, message }
```

### Configure Cloud Backup
```
POST /api/admin/cloud-backup/configure
Body: {
  enabled: true,
  provider: 'backblaze-b2',
  applicationKeyId: '...',
  applicationKey: '...',
  bucketName: '...'
}
Response: { success, status }
```

### List Cloud Backups
```
GET /api/admin/cloud-backup/list
Response: [{ name, size, timestamp, provider }]
```

### Upload Backup to Cloud
```
POST /api/admin/cloud-backup/upload/:backupName
Response: { success, result }
```

### Download Backup from Cloud
```
POST /api/admin/cloud-backup/download/:backupName
Response: Downloads file
```

### Delete Backup from Cloud
```
DELETE /api/admin/cloud-backup/:backupName
Response: { success: true }
```

### Sync Local to Cloud
```
POST /api/admin/cloud-backup/sync
Response: { success, result: { synced, total } }
```

## Adding a New Cloud Provider

### Step 1: Create Provider Class

Create `backend/services/backup/cloudProviders/YourProviderName.js`:

```javascript
const CloudProvider = require('./CloudProvider');

class YourProviderName extends CloudProvider {
  constructor(config) {
    super(config);
    this.name = 'Your Provider Display Name';
  }

  async connect() { /* ... */ }
  async uploadFile(localPath, cloudPath) { /* ... */ }
  async downloadFile(cloudPath, localPath) { /* ... */ }
  async listBackups() { /* ... */ }
  async deleteFile(cloudPath) { /* ... */ }
  async getFileInfo(cloudPath) { /* ... */ }
  isConfigured() { /* ... */ }
  async getStatus() { /* ... */ }
}

module.exports = YourProviderName;
```

### Step 2: Register in Provider Registry

Edit `backend/services/backup/cloudProviders/index.js`:

```javascript
const YourProviderName = require('./YourProviderName');

const PROVIDERS = {
  'your-provider': {
    name: 'Your Provider Display Name',
    class: YourProviderName,
    configFields: ['field1', 'field2', 'field3'],
    docUrl: 'https://docs.example.com',
    description: 'Your provider description'
  },
  // ... other providers
};
```

### Step 3: Done!

That's it! The system will automatically:
- Show it in the provider list
- Allow configuration via the UI
- Support all cloud operations

## Scaling Benefits

### Minimal Code Duplication
- Abstract interface defines what all providers must implement
- Each provider is independent
- No cross-provider dependencies

### Easy Provider Switching
```javascript
// Just change one config value
CLOUD_BACKUP_PROVIDER=aws-s3  // Switch from B2 to S3
```

### Extensible
- Add fields: Just add to `configFields` array
- Change behavior: Update provider method
- New provider: Just implement the interface

### No Main Code Changes
- Adding providers doesn't require changes to:
  - backupManager.js
  - cloudBackupManager.js
  - API endpoints
  - Frontend

## Supported Providers (Current & Planned)

| Provider | Status | Package | Notes |
|----------|--------|---------|-------|
| Backblaze B2 | ✅ Implemented | backblaze-b2 | Ready to use |
| AWS S3 | 🔄 Template | aws-sdk | See EXAMPLE_AmazonS3Provider.js |
| Google Cloud Storage | 📋 Planned | @google-cloud/storage | Use as template |
| Azure Blob Storage | 📋 Planned | @azure/storage-blob | Use as template |
| Dropbox | 📋 Planned | dropbox | Use as template |

## Performance Considerations

- **Async uploads**: Backups uploaded in background, doesn't block local save
- **Retention policy**: Old Cloud backups auto-deleted per policy
- **Resumable uploads**: Large files can resume if interrupted
- **Bandwidth**: Uploads happen off-peak (11 PM default)

## Security

- ✅ Credentials stored in environment variables (not in code)
- ✅ All data in transit is encrypted (HTTPS/TLS)
- ✅ Provider buckets are private by default
- ✅ Access logs available on provider side
- ✅ Consider adding encryption-at-rest for sensitive backups

## Troubleshooting

### Connection Failed
```
Check:
1. Environment variables are set correctly
2. Credentials have valid permissions
3. Network connection to cloud provider
4. Test with: POST /api/admin/cloud-backup/test-connection
```

### Upload Fails
```
Check:
1. Bucket exists and is accessible
2. Credentials have upload permissions
3. Local backup file is readable
4. Check backend logs for detailed error
```

### Restore from Cloud
```
1. List available: GET /api/admin/cloud-backup/list
2. Download: POST /api/admin/cloud-backup/download/:backupName
3. Restore locally: POST /api/admin/restore with file
```

## Future Enhancements

- [ ] Multi-provider simultaneous backup
- [ ] Differential backups to cloud
- [ ] Encryption before upload
- [ ] Scheduled cloud sync
- [ ] Provider health monitoring
- [ ] Cost tracking per provider
- [ ] Automatic provider failover
