# 🚀 Deployment & Quick Start Guide

## ✅ FULLY IMPLEMENTED - ALL 10 PHASES INTEGRATED

---

## 📦 Pre-Deployment Checklist

### System Requirements
```bash
✅ Node.js 16+ 
✅ MongoDB 4.4+ (local or Atlas)
✅ MongoDB Tools (mongodump/mongorestore)
✅ 2GB+ free disk (for backups)
✅ Internet (Cloud deployment) or LAN (Local deployment)
```

### Install MongoDB Tools (for Phase 10 Backup/Restore)

**Windows:**
```bash
choco install mongodb-database-tools
# Verify: mongodump --version
```

**macOS:**
```bash
brew tap mongodb/brew
brew install mongodb-database-tools
# Verify: mongodump --version
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get install -y mongodb-database-tools
# Verify: mongodump --version
```

---

## 🚀 Deployment Steps

### Step 1: Verify Architecture
```bash
cd g:\textile-stock-management
node verify-architecture.js

# Output should show:
# ✅ ALL ARCHITECTURE CHECKS PASSED ✅
```

### Step 2: Install Dependencies
```bash
cd backend
npm install

# Should complete without errors
```

### Step 3: Configure Environment (.env)
```bash
# backend/.env

# Database Connection
MONGODB_URI=mongodb://127.0.0.1:27017/textile-stock-management

# Server Configuration
HTTP_PORT=5000
PORT=5001
NODE_ENV=development

# Security
APP_USERNAME=admin
APP_PASSWORD=your-password-here
JWT_SECRET=your-jwt-secret

# TLS (HTTPS)
TLS_KEY_PATH=./stock-system.local-key.pem
TLS_CERT_PATH=./stock-system.local.pem

# CORS Origins
CORS_ALLOWED_ORIGINS=http://localhost:5000,http://localhost:3000
```

### Step 4: Start the Server
```bash
cd backend
npm start

# Verify startup logs:
# 🚀 Initializing optimization middleware stack (Phases 3-10)...
# ✅ Optimization middleware initialized
# 📋 Initializing Job Queue (Phase 9)...
# 💾 Initializing Backup Manager (Phase 10)...
# ⚡ Circuit Breakers initialized
```

### Step 5: Test the System
```bash
# Test basic connectivity
curl http://localhost:5000/api/auth/ping
# Response: { "success": true, "message": "pong" }

# Test compression
curl -H "Accept-Encoding: gzip" \
  http://localhost:5000/api/admin/scanners \
  -H "Authorization: Bearer YOUR_TOKEN"
# Should show: Content-Encoding: gzip

# Test monitoring dashboard
curl http://localhost:5000/api/admin/monitoring/dashboard \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 📊 PERFORMANCE VERIFICATION

### 1. Check Compression (Phase 3)
```bash
# Uncompressed response
curl -i http://localhost:5000/api/admin/scanners \
  -H "Authorization: Bearer YOUR_TOKEN" | grep Content-Length
# Original: ~12000 bytes

# Compressed response
curl -i -H "Accept-Encoding: gzip" \
  http://localhost:5000/api/admin/scanners \
  -H "Authorization: Bearer YOUR_TOKEN" | grep Content-Length
# Compressed: ~3000 bytes (75% save)
```

### 2. Monitor Response Times (Phase 5)
```bash
curl -i http://localhost:5000/api/admin/scanners \
  -H "Authorization: Bearer YOUR_TOKEN" | grep X-Response-Time
# X-Response-Time: 42ms
# X-Memory-Delta: 256KB
```

### 3. Test Rate Limiting (Phase 6)
```bash
# Simulate 101 requests in 1 minute interval
for i in {1..101}; do
  curl http://localhost:5000/api/test \
    -H "Authorization: Bearer YOUR_TOKEN"
  sleep 0.6
done

# On request #101, should receive:
# 429 Too Many Requests
# Retry-After: 3
```

### 4. Verify Caching (Phase 7)
```bash
# First request (cache miss)
curl -i http://localhost:5000/api/admin/scanners \
  -H "Authorization: Bearer YOUR_TOKEN" | grep X-Cache
# X-Cache: MISS

# Second request (cache hit)
curl -i http://localhost:5000/api/admin/scanners \
  -H "Authorization: Bearer YOUR_TOKEN" | grep X-Cache
# X-Cache: HIT
```

### 5. Test Job Queue (Phase 9)
```bash
# Generate async report
RESPONSE=$(curl -X POST http://localhost:5000/api/admin/reports/generate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type": "INVENTORY"}')

JOB_ID=$(echo $RESPONSE | jq -r '.jobId')

# Check status
curl http://localhost:5000/api/admin/jobs/$JOB_ID/status \
  -H "Authorization: Bearer YOUR_TOKEN"
# Response: { "job": { "status": "PROCESSING", "progress": 50 } }
```

### 6. Test Backup (Phase 10)
```bash
# Create backup
curl -X POST http://localhost:5000/api/admin/backup/create \
  -H "Authorization: Bearer YOUR_TOKEN"
# Response: { "backup": { "name": "backup_manual_...", "size": 245 } }

# List backups
curl http://localhost:5000/api/admin/backup/list \
  -H "Authorization: Bearer YOUR_TOKEN"
# Response: { "backups": [...], "count": 5 }
```

---

## 🎯 PRODUCTION DEPLOYMENT

### AWS/Cloud Deployment

#### 1. Prepare for Cloud
```bash
# Update MongoDB URI
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/textile-stock

# Update CORS
CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://api.yourdomain.com

# Set secure JWT
JWT_SECRET=$(openssl rand -base64 32)
```

#### 2. Docker Support
```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app
COPY backend /app

RUN npm ci --only=production

EXPOSE 5000 5001

CMD ["npm", "start"]
```

#### 3. Deploy to AWS Elastic Beanstalk
```bash
eb init -p "Node.js 18 running on 64-bit Amazon Linux 2"
eb create textile-stock-prod
eb deploy
```

#### 4. Setup S3 Backups
```javascript
// Store backups to S3
const backup = await backupManager.createBackup('hourly');
await s3.uploadFile({
  Bucket: 'textile-stock-backups',
  Key: `backups/${backup.name}.tar.gz`,
  Body: fs.createReadStream(backup.path)
});
```

---

## 🔧 CONFIGURATION EXAMPLES

### Enable SSL/HTTPS for Production
```bash
# Generate self-signed certificate (development)
openssl req -x509 -nodes -days 365 \
  -newkey rsa:2048 \
  -keyout stock-system.local-key.pem \
  -out stock-system.local.pem

# Update .env
TLS_KEY_PATH=./stock-system.local-key.pem
TLS_CERT_PATH=./stock-system.local.pem
ENABLE_HTTPS_COMPAT_443=true
```

### Increase Job Queue Concurrency (for high volume)
In `server.js`:
```javascript
const jobQueue = new JobQueue({ 
  maxConcurrency: 10,  // Increase from 5 to 10
  resultTTL: 3600000 
});
```

### Customize Rate Limiting
In `server.js`:
```javascript
const limiter = new RateLimiter({
  windowMs: 60000,
  maxRequests: 200,  // Increase from 100 to 200
  keyPrefix: 'api-limiter'
});
```

### Auto-start Backups
```javascript
// In server.js, start backups after DB connection
mongoose.connect(mongoUrl).then(() => {
  console.log('Connected to MongoDB');
  // Schedule hourly backups
  backupManager.scheduleBackups(60 * 60 * 1000);
});
```

---

## 📈 MONITORING & ALERTS

### Key Metrics to Monitor

| Metric | Target | Alert |
|--------|--------|-------|
| Response Time | <100ms | >500ms |
| DB Writes/Hour | <300 | >1000 |
| Memory Usage | <256MB | >512MB |
| Backup Success | 100% | Failed backup |
| Circuit Breaker | CLOSED | OPEN |
| Job Queue | <50 pending | >100 pending |

### Setup Monitoring Dashboard
```bash
# Access monitoring
curl http://localhost:5000/api/admin/monitoring/dashboard \
  -H "Authorization: Bearer YOUR_TOKEN" | jq

# Output shows:
{
  "jobQueue": { "total": 5, "pending": 1, "processing": 2, "completed": 2 },
  "backups": { "total": 24, "latest": {...} },
  "circuitBreakers": {
    "database": { "state": "CLOSED", "failures": 0 },
    "externalAPI": { "state": "CLOSED", "failures": 0 }
  },
  "memory": { "heapUsed": 128000000, "external": 5000000 }
}
```

---

## 🐛 DEBUGGING

### Enable Verbose Logging
```bash
NODE_DEBUG=* npm start
```

### Check Backup Directory
```bash
# List backups
ls -lah backend/backups/mongo-dumps/

# Check specific backup
tar -tzf backend/backups/mongo-dumps/backup_hourly_*.tar.gz | head -20
```

### Monitor Database Performance
```bash
# SSH into MongoDB
mongo mongodb://127.0.0.1:27017/textile-stock-management

# Check slow queries
db.setProfilingLevel(1, { slowms: 100 })
db.system.profile.find().limit(5).sort({ ts: -1 }).pretty()
```

### Verify Circuit Breaker State
```bash
curl http://localhost:5000/api/admin/monitoring/dashboard \
  -H "Authorization: Bearer YOUR_TOKEN" | jq '.monitoring.circuitBreakers'

# Output:
{
  "database": { "state": "CLOSED", "failures": 0, "successes": 0 },
  "externalAPI": { "state": "CLOSED", "failures": 0, "successes": 0 }
}
```

---

## ⚠️ TROUBLESHOOTING

### Issue: "Backup Manager initialization failed"
**Solution:**
```bash
# Install MongoDB tools
# Windows: choco install mongodb-database-tools
# macOS: brew install mongodb-database-tools
# Linux: sudo apt-get install mongodb-database-tools
```

### Issue: "Rate limiting too aggressive"
**Solution:** Adjust in `server.js`:
```javascript
const limiter = new RateLimiter({
  windowMs: 60000,
  maxRequests: 200  // Increase limit
});
```

### Issue: "Circuit breaker stuck in OPEN state"
**Solution:** Check database connectivity:
```bash
mongo $MONGODB_URI --eval "db.adminCommand('ping')"
```

### Issue: "Jobs not processing"
**Solution:** Check job queue logs:
```bash
# Monitor job queue stats
curl http://localhost:5000/api/admin/jobs/stats \
  -H "Authorization: Bearer YOUR_TOKEN" | jq
```

### Issue: "Backups failing on schedule"
**Solution:** Verify mongodump path and permissions:
```bash
which mongodump
ls -la backend/backups/
```

---

## 📚 TESTING ENDPOINTS

### Create Postman Collection
```json
{
  "info": {
    "name": "Textile Stock Optimization API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Auth",
      "item": [
        { "name": "Login", "request": { "method": "POST", "url": "http://localhost:5000/api/login" } },
        { "name": "Ping", "request": { "method": "GET", "url": "http://localhost:5000/api/auth/ping" } }
      ]
    },
    {
      "name": "Monitor",
      "item": [
        { "name": "Dashboard", "request": { "method": "GET", "url": "http://localhost:5000/api/admin/monitoring/dashboard" } }
      ]
    },
    {
      "name": "Reports",
      "item": [
        { "name": "Generate", "request": { "method": "POST", "url": "http://localhost:5000/api/admin/reports/generate" } },
        { "name": "Status", "request": { "method": "GET", "url": "http://localhost:5000/api/admin/jobs/1/status" } }
      ]
    },
    {
      "name": "Backup",
      "item": [
        { "name": "Create", "request": { "method": "POST", "url": "http://localhost:5000/api/admin/backup/create" } },
        { "name": "List", "request": { "method": "GET", "url": "http://localhost:5000/api/admin/backup/list" } }
      ]
    }
  ]
}
```

---

## ✅ DEPLOYMENT CHECKLIST

- [ ] Verify architecture: `node verify-architecture.js`
- [ ] Install dependencies: `npm install`
- [ ] Configure .env file
- [ ] Install MongoDB tools
- [ ] Start server: `npm start`
- [ ] Test basic connectivity: `curl http://localhost:5000/api/auth/ping`
- [ ] Verify compression: Check `Content-Encoding: gzip`
- [ ] Create test backup: `POST /api/admin/backup/create`
- [ ] Generate test report: `POST /api/admin/reports/generate`
- [ ] Monitor dashboard: `GET /api/admin/monitoring/dashboard`
- [ ] Review startup logs for all ✅ marks
- [ ] Test rate limiting (send 100+ requests)
- [ ] Verify cache hits and misses
- [ ] Deploy to production when ready

---

## 🎯 PRODUCTION READY ✅

All 10 optimization phases are **fully integrated and production-ready**!

**Next:** Deploy using your preferred platform (AWS, Azure, DigitalOcean, or on-premise)

---

**Need help?** Check [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed documentation.
