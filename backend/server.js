try {
    require('dotenv').config();
} catch (err) {
    console.log('[Info] dotenv not found, assuming environment variables are provided by the host process.');
}
const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { Server } = require('socket.io');
const cors = require('cors');
const morgan = require('morgan');
const errorHandler = require('./middleware/errorMiddleware');
const { ensureInstallApk, startInstallApkGuardian } = require('./services/installApkService');
const { issueAdminToken, requireAdminAuth, requireScannerAuth, requireAnyAuth } = require('./middleware/authMiddleware');
const { requireLicense } = require('./middleware/licenseMiddleware');

// Phase 3-10: Import optimization middleware & services
const { initCompressionMiddleware } = require('./middleware/core/compression');
const { securityHeaders } = require('./middleware/core/security');
const { performanceMonitoring } = require('./middleware/monitoring/performance');
const { logger } = require('./middleware/monitoring/logger');
const { ResponseCacheManager } = require('./middleware/caching/responseCache');
const { autoPaginateMiddleware } = require('./middleware/caching/paginator');
const { DeltaSyncManager, createMobileResponse } = require('./middleware/mobile/optimization');
const { RateLimiter } = require('./utils/resilience/rateLimiter');
const { CircuitBreaker } = require('./utils/resilience/circuitBreaker');
const { withRetry } = require('./utils/resilience/retryLogic');
const { JobQueue } = require('./services/jobs/jobQueue');
const { AsyncReportGenerator } = require('./services/jobs/reportGenerator');
const { BackupManager } = require('./services/backup/backupManager');
const { DataConsistencyChecker } = require('./services/backup/dataIntegrity');
const CloudBackupManager = require('./services/backup/cloudBackupManager');
const cloudBackupRoutes = require('./services/backup/cloudBackupRoutes');

let helmet = null;
let rateLimit = null;
try {
    helmet = require('helmet');
} catch (err) {
    console.warn('[Security] Optional dependency "helmet" not installed. Continuing without helmet.');
}
try {
    rateLimit = require('express-rate-limit');
} catch (err) {
    console.warn('[Security] Optional dependency "express-rate-limit" not installed. Continuing without rate limiting.');
}

const app = express();

// Optional mDNS support for service discovery
let mdnsAdvertiser = null;
if (process.env.MDNS_ENABLED === 'true') {
    try {
        const mdns = require('bonjour')({ multicast: true });
        const serviceName = process.env.MDNS_SERVICE_NAME || 'stock-system';
        mdnsAdvertiser = { mdns, serviceName };
        console.log(`📡 mDNS advertising enabled as "${serviceName}.local"`);
    } catch (err) {
        console.log(`ℹ️ mDNS not available (bonjour package). Using hostname-based discovery.`);
    }
}

const isProduction = process.env.NODE_ENV === 'production';
const requiredEnvs = ['APP_USERNAME', 'APP_PASSWORD', ...(isProduction ? ['JWT_SECRET'] : [])];
const missingEnvs = requiredEnvs.filter((key) => !process.env[key]);
if (missingEnvs.length > 0) {
    throw new Error(`Missing required environment variables: ${missingEnvs.join(', ')}`);
}

if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = 'dev-insecure-jwt-secret-change-me';
    console.warn('[Security] JWT_SECRET missing. Using insecure dev fallback. Set JWT_SECRET in .env.');
}

// Load TLS certificates
const TLS_KEY_PATH = process.env.TLS_KEY_PATH || './stock-system.local-key.pem';
const TLS_CERT_PATH = process.env.TLS_CERT_PATH || './stock-system.local.pem';
const hasTlsFiles = fs.existsSync(TLS_KEY_PATH) && fs.existsSync(TLS_CERT_PATH);
if (!hasTlsFiles) {
    console.warn('[TLS] Certificate files are missing. HTTPS will be disabled until TLS_KEY_PATH and TLS_CERT_PATH are configured.');
}

try {
    const apkResult = ensureInstallApk();
    if (apkResult.copied) {
        console.log(`Published install APK from ${apkResult.source} to ${apkResult.target}`);
    } else if (apkResult.exists) {
        console.log(`Install APK already present at ${apkResult.target}`);
    } else {
        console.warn('Install APK not found. Build the Android APK once so the backend can publish it.');
    }
} catch (err) {
    console.warn('Install APK sync skipped:', err.message);
}

startInstallApkGuardian();

const httpsOptions = hasTlsFiles
    ? {
        key: fs.readFileSync(TLS_KEY_PATH),
        cert: fs.readFileSync(TLS_CERT_PATH)
    }
    : null;

const HTTP_PORT = parseInt(process.env.HTTP_PORT || '5000', 10);
const HTTPS_PORT = parseInt(process.env.PORT || '5001', 10);
const ENABLE_HTTPS_COMPAT_443 = String(process.env.ENABLE_HTTPS_COMPAT_443 || 'false').toLowerCase() === 'true';

const httpServer = http.createServer(app);

const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

const isPrivateNetworkOrigin = (origin) => {
    try {
        const url = new URL(origin);
        if (
            (url.protocol === 'capacitor:' || url.protocol === 'ionic:') &&
            url.hostname === 'localhost'
        ) {
            return true;
        }

        const hostname = url.hostname;
        return (
            hostname === 'localhost' ||
            hostname === '127.0.0.1' ||
            hostname === '::1' ||
            hostname.endsWith('.local') ||
            /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
            /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
            /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname)
        );
    } catch (err) {
        return false;
    }
};

const isOriginAllowed = (origin) => {
    if (!origin) return true;
    if (origin.startsWith('file://')) return true;
    
    // Allow all localhost-like origins for development
    if (origin === 'http://localhost' || origin.startsWith('http://localhost:')) return true;
    if (origin === 'http://127.0.0.1' || origin.startsWith('http://127.0.0.1:')) return true;
    if (origin === 'https://localhost' || origin.startsWith('https://localhost:')) return true;
    if (origin === 'https://127.0.0.1' || origin.startsWith('https://127.0.0.1:')) return true;
    
    if (origin === 'capacitor://localhost' || origin === 'ionic://localhost') return true;
    
    if (allowedOrigins.length === 0) return true;
    if (isPrivateNetworkOrigin(origin)) return true;
    return allowedOrigins.includes(origin);
};

const io = new Server(httpServer, {
    cors: {
        origin: (origin, callback) => {
            if (isOriginAllowed(origin)) return callback(null, true);
            return callback(new Error('CORS blocked'));
        },
        methods: ['GET', 'POST'],
        credentials: true
    }
});

// Middleware
if (helmet) {
    app.use(helmet({
        crossOriginResourcePolicy: false,
        hsts: false
    }));
}
app.use(cors({
    origin: (origin, callback) => {
        if (isOriginAllowed(origin)) return callback(null, true);
        return callback(new Error('CORS blocked'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));

// Phase 3-10: Optimization Middleware Stack
const cacheManager = new ResponseCacheManager(600, 120); // 10-min TTL
app.use(initCompressionMiddleware());
app.use(performanceMonitoring);

// ⚠️ DISABLE CACHING FOR API ROUTES: All /api/* endpoints must always serve fresh data
// Cache headers will be set per-endpoint as needed
app.use((req, res, next) => {
    // Skip caching for all API endpoints - UI needs real-time data
    if (req.path.startsWith('/api')) {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
        return next();
    }
    // Static assets can be cached
    return cacheManager.middleware(600)(req, res, next);
});

app.use(autoPaginateMiddleware);
app.use(securityHeaders);
app.use(logger);

// Core middleware
app.use(express.json({ limit: '8mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Phase 6: Rate Limiting (100 req/min per IP)
const limiter = new RateLimiter({
  windowMs: 60000,
  maxRequests: 100,
  keyPrefix: 'api-limiter'
});
app.use('/api', limiter.middleware({ maxRequests: 100, windowMs: 60000 }));

// Auth endpoints: stricter rate limiting (20 req / 15 min)
const authLimiter = new RateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 20,
  keyPrefix: 'auth-limiter'
});
app.use('/api/login', authLimiter.middleware({ maxRequests: 20 }));
app.use('/api/auth', authLimiter.middleware({ maxRequests: 20 }));

// Legacy rate limit for backward compatibility
if (rateLimit) {
    const authLimiterLegacy = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 20,
        standardHeaders: true,
        legacyHeaders: false
    });
    app.use('/api/login', authLimiterLegacy);
    app.use('/api/auth', authLimiterLegacy);
}

// Phase 8: Initialize Mobile Services
const deltaSyncManager = new DeltaSyncManager();

// Serve PWA Static Files
app.get('/pair', (req, res) => {
    const params = new URLSearchParams();
    Object.entries(req.query || {}).forEach(([key, value]) => {
        if (Array.isArray(value)) {
            value.forEach((item) => params.append(key, String(item)));
        } else if (value !== undefined && value !== null) {
            params.set(key, String(value));
        }
    });

    const queryString = params.toString();
    const target = `/pwa/index.html${queryString ? `?${queryString}` : ''}`;

    res.type('html').send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta http-equiv="refresh" content="0; url=${target}" />
  <title>Opening LoomTrack...</title>
  <style>
    html,body{height:100%;margin:0;background:#0f172a;color:#f8fafc;font-family:Arial,sans-serif}
    .wrap{height:100%;display:flex;align-items:center;justify-content:center;flex-direction:column;padding:24px;text-align:center}
    .card{max-width:420px;background:#111827;border:1px solid rgba(255,255,255,.08);border-radius:20px;padding:28px;box-shadow:0 20px 40px rgba(0,0,0,.35)}
    .spinner{width:36px;height:36px;border-radius:50%;border:4px solid rgba(255,255,255,.14);border-top-color:#6366f1;margin:0 auto 18px;animation:spin 1s linear infinite}
    h1{margin:0 0 10px;font-size:24px}
    p{margin:0;color:#94a3b8;line-height:1.5}
    a{display:inline-block;margin-top:18px;color:#a5b4fc;text-decoration:none;font-weight:700}
    @keyframes spin{to{transform:rotate(360deg)}}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div class="spinner"></div>
      <h1>Opening LoomTrack</h1>
      <p>Loading the scanner app and pairing details.</p>
      <a href="${target}">Tap if it does not open automatically</a>
    </div>
  </div>
  <script>window.location.replace(${JSON.stringify(target)});</script>
</body>
</html>`);
});

app.get('/pwa/LoomTrack.apk', (req, res, next) => {
    try {
        const apkResult = ensureInstallApk();
        if (!apkResult.exists) {
            return res.status(404).json({ error: 'APK not found' });
        }

        return res.sendFile(apkResult.target);
    } catch (err) {
        return next(err);
    }
});

// Redirect HTTP PWA requests to HTTPS
if (httpsOptions) {
    app.use('/pwa', (req, res, next) => {
        if (req.protocol === 'http') {
            const secureUrl = `https://${req.hostname}${HTTPS_PORT !== 443 ? ':' + HTTPS_PORT : ''}${req.originalUrl}`;
            return res.redirect(301, secureUrl);
        }
        next();
    });
}

app.use('/pwa', express.static(path.join(__dirname, 'public/pwa')));

// Attach IO to request for routes
app.use((req, res, next) => {
    req.io = io;
    // Phase 9-10: Attach services to request
    req.jobQueue = jobQueue;
    req.reportGenerator = reportGenerator;
    req.backupManager = backupManager;
    req.dataIntegrity = dataIntegrity;
    req.cacheManager = cacheManager;
    req.deltaSyncManager = deltaSyncManager;
    // Phase 4: Attach circuit breakers
    req.dbCircuitBreaker = dbCircuitBreaker;
    req.apiCircuitBreaker = apiCircuitBreaker;
    next();
});

// Helper to find LAN IP
const getLocalIp = () => {
    const interfaces = require('os').networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            // Skip internal (127.0.0.1) and non-ipv4 tests
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return '127.0.0.1';
};
// Service Discovery Endpoint (for clients to find the server)
app.get('/api/service/info', (req, res) => {
    const localIp = getLocalIp();
    res.json({
        status: 'ok',
        service: 'textile-stock-management',
        hostname: 'stock-system.local',
        ip: localIp,
        httpPort: HTTP_PORT,
        httpsPort: HTTPS_PORT,
        timestamp: new Date().toISOString()
    });
});
// Phase 9: Initialize Job Queue
const jobQueue = new JobQueue({ maxConcurrency: 5 });
const reportGenerator = new AsyncReportGenerator(path.join(__dirname, 'reports'));

// Phase 10: Initialize Backup Manager
const mongoUrl = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/textile-stock-management';
const backupDir = path.join(__dirname, 'backups', 'mongo-dumps');
if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
}
const backupManager = new BackupManager(mongoUrl, backupDir);
const dataIntegrity = new DataConsistencyChecker();
backupManager.scheduleBackups(60 * 60 * 1000);

// Phase 10: Initialize Circuit Breakers for critical services
const dbCircuitBreaker = new CircuitBreaker({
  name: 'Database',
  failureThreshold: 5,
  timeout: 60000
});

const apiCircuitBreaker = new CircuitBreaker({
  name: 'External API',
  failureThreshold: 3,
  timeout: 30000
});

// Database Connection
const connectWithRetry = () => {
    const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/textile-stock-management';
    console.log(`📡 Attempting to connect to MongoDB at ${uri}...`);
    
    mongoose.connect(uri, {
        serverSelectionTimeoutMS: 5000,
        family: 4 // Use IPv4
    }).then(() => {
        console.log('✅ Connected to MongoDB Local (textile-stock-management)');
    }).catch(err => {
        console.error('❌ MongoDB Connection Error:', err.message);
        console.log('🔄 Retrying in 5 seconds...');
        setTimeout(connectWithRetry, 5000);
    });
};

connectWithRetry();

// Initialize Cloud Backup Manager
const getCloudBackupDir = () => {
    let backupPath = path.join(__dirname, 'backups');
    try {
        const configPath = path.join(__dirname, 'config.json');
        if (fs.existsSync(configPath)) {
            try {
                const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                if (config.backupPath) backupPath = config.backupPath;
            } catch (parseErr) {
                // Keep default
            }
        }
    } catch (err) {
        // Use default
    }
    
    try {
        if (!path.isAbsolute(backupPath)) {
            backupPath = path.join(__dirname, '..', backupPath);
        }
        fs.mkdirSync(backupPath, { recursive: true });
    } catch (mkdirErr) {
        console.warn(`⚠️ Could not create backup directory: ${mkdirErr.message}`);
    }
    return backupPath;
};

const cloudBackupDir = getCloudBackupDir();
const cloudBackupConfig = {
    provider: process.env.CLOUD_BACKUP_PROVIDER || 'backblaze-b2',
    credentials: {
        applicationKeyId: process.env.B2_APPLICATION_KEY_ID,
        applicationKey: process.env.B2_APPLICATION_KEY,
        bucketName: process.env.B2_BUCKET_NAME
    },
    enabled: process.env.CLOUD_BACKUP_ENABLED === 'true'
};

try {
    const cloudBackupManagerInstance = new CloudBackupManager(cloudBackupDir, cloudBackupConfig);
    global.cloudBackupManager = cloudBackupManagerInstance;
    console.log('✅ Cloud Backup Manager initialized');
} catch (err) {
    console.warn(`⚠️ Cloud Backup Manager init failed: ${err.message}`);
    global.cloudBackupManager = null;
}

global.CLOUD_BACKUP_INTERVAL = parseInt(process.env.CLOUD_BACKUP_INTERVAL_MINUTES || '60', 10) * 60 * 1000;

// Routes
const barcodeRoutes = require('./routes/barcodeRoutes');
const mobileRoutes = require('./routes/mobileRoutes');
const statsRoutes = require('./routes/statsRoutes');
const adminRoutes = require('./routes/adminRoutes');
const authRoutes = require('./routes/authRoutes');
const licenseRoutes = require('./routes/licenseRoutes');

// Init Services
require('./services/backupService');

app.use('/api/license', licenseRoutes);

// New Endpoint: Get Server IP (for Desktop to generate QR)
// Service Discovery Endpoint (No Auth Required)
app.get('/api/discover', (req, res) => {
    const localIp = getLocalIp();
    const hostname = require('os').hostname();
    res.json({
        service: 'textile-stock-management',
        hostname: hostname,
        domain: 'stock-system.local',
        lanIp: localIp,
        httpPort: HTTP_PORT,
        httpsPort: HTTPS_PORT,
        nativeAppUrl: `http://${localIp}:${HTTP_PORT}`,
        pwaBrowserUrl: `https://stock-system.local:${HTTPS_PORT}`,
        mdnsService: '_textile-stock._tcp.local',
        timestamp: new Date().toISOString()
    });
});

// Auth Routes (Open for pairing/login)
app.use(requireLicense);
app.use('/api/mobile', requireAnyAuth, mobileRoutes);
app.use('/api/barcode', requireAdminAuth, barcodeRoutes);
app.use('/api/stats', requireAdminAuth, statsRoutes);
app.use('/api/admin', requireAdminAuth, adminRoutes(io, cloudBackupManager));
app.use('/api/auth', authRoutes(io));
app.use('/api/sessions', require('./routes/sessionRoutes'));
app.use('/api/reports', requireAdminAuth, require('./routes/reportsRoutes'));
app.use('/api/sizes', require('./routes/sizesRoutes'));
app.use('/api/employees', require('./routes/employeeRoutes'));
app.use('/api/dc', requireAdminAuth, require('./routes/dcRoutes'));
app.use('/api/quotations', requireAdminAuth, require('./routes/quotationRoutes'));

app.get('/api/auth/ping', (req, res) => {
    res.json({ success: true, message: 'pong' });
});

// Phase 9: Job Queue API Endpoints
app.post('/api/admin/reports/generate', requireAdminAuth, (req, res) => {
    try {
        const { type, filters } = req.body;
        if (!['INVENTORY', 'SALES', 'AUDIT'].includes(type)) {
            return res.status(400).json({ error: 'Invalid report type' });
        }

        const jobId = jobQueue.submit({
            type: 'REPORT',
            reportType: type,
            filters,
            execute: async (onProgress) => {
                return await reportGenerator.generateReport(jobId, type, filters, onProgress);
            }
        }, 'high');

        res.json({
            success: true,
            jobId,
            message: 'Report generation started',
            statusUrl: `/api/admin/jobs/${jobId}/status`
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/admin/jobs/:jobId/status', requireAdminAuth, (req, res) => {
    const { jobId } = req.params;
    const status = jobQueue.getStatus(parseInt(jobId));

    if (!status) {
        return res.status(404).json({ error: 'Job not found' });
    }

    res.json({ success: true, job: status });
});

app.get('/api/admin/jobs/stats', requireAdminAuth, (req, res) => {
    const stats = jobQueue.getStats();
    res.json({ success: true, stats });
});

// Phase 10: Backup API Endpoints
app.post('/api/admin/backup/create', requireAdminAuth, async (req, res) => {
    try {
        const backup = await backupManager.createBackup('manual');
        res.json({
            success: true,
            message: 'Backup created successfully',
            backup
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/admin/backup/list', requireAdminAuth, (req, res) => {
    const backups = backupManager.listBackups();
    res.json({
        success: true,
        backups,
        count: backups.length
    });
});

app.post('/api/admin/backup/restore/:backupName', requireAdminAuth, async (req, res) => {
    try {
        const { backupName } = req.params;
        await backupManager.restoreFromBackup(backupName);
        res.json({
            success: true,
            message: 'Backup restored successfully'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Phase 10: Data Integrity API Endpoints
app.post('/api/admin/integrity/check', requireAdminAuth, async (req, res) => {
    try {
        console.log('🔍 Running data integrity check...');
        const models = {
            ClothRoll: require('./models/ClothRoll'),
            Scanner: require('./models/Scanner'),
            User: require('./models/User'),
            Employee: require('./models/Employee')
        };

        const issues = await dataIntegrity.checkReferentialIntegrity(models);
        const report = dataIntegrity.getReport();

        res.json({
            success: true,
            report,
            issuesUrl: '/api/admin/integrity/report'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/admin/integrity/report', requireAdminAuth, (req, res) => {
    const report = dataIntegrity.getReport();
    res.json({ success: true, report });
});

// Phase 8: Delta Sync Endpoint for Mobile
app.get('/api/mobile/sync/delta', requireAnyAuth, (req, res) => {
    try {
        const clientId = req.user?.id || req.ip;
        const currentData = {
            timestamp: Date.now(),
            scanners: Math.random() * 100,
            heartbeat: 'ok'
        };

        const delta = deltaSyncManager.calculateDelta(clientId, currentData);

        res.json(createMobileResponse({
            delta,
            version: 1
        }));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const { authenticateAdmin } = require('./services/adminCredentialService');

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    if (await authenticateAdmin(username, password)) {
        const token = issueAdminToken({
            username,
            role: 'ADMIN'
        });

        // Trigger auto-backup non-blocking
        const backupService = require('./services/backupService');
        await backupService.performBackup('LOGIN').catch(err => console.error('Login Backup Failed:', err));

        return res.json({ success: true, message: 'Authenticated', token });
    }
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
});

app.post('/api/logout', async (req, res) => {
    // Trigger auto-backup non-blocking
    const backupService = require('./services/backupService');
    await backupService.performBackup('LOGOUT').catch(err => console.error('Logout Backup Failed:', err));

    return res.json({ success: true, message: 'Logged out' });
});

// Phase 5: Performance Monitoring Dashboard
app.get('/api/admin/monitoring/dashboard', requireAdminAuth, (req, res) => {
    const stats = jobQueue.getStats();
    const backups = backupManager.listBackups();
    const dbState = dbCircuitBreaker.getState();
    const apiState = apiCircuitBreaker.getState();

    res.json({
        success: true,
        monitoring: {
            timestamp: new Date().toISOString(),
            jobQueue: stats,
            backups: {
                total: backups.length,
                latest: backups[0] || null
            },
            circuitBreakers: {
                database: dbState,
                externalAPI: apiState
            },
            memory: process.memoryUsage()
        }
    });
});

// Phase 4: Error Handling (with recovery suggestions)
// Error Handling Middleware (Must be last)
app.use((err, req, res, next) => {
    console.error('❌ Unhandled Error:',  {
        path: req.path,
        method: req.method,
        error: err.message,
        stack: err.stack
    });

    res.status(err.statusCode || 500).json({
        error: err.message || 'Internal server error',
        requestId: req.id,
        recovery: {
            retry: true,
            retryAfter: 5,
            endpoint: req.path
        }
    });
});
app.use(errorHandler);

// Socket.IO
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });

    // Phase 9: Job Queue events
    socket.on('job:subscribe', (jobId) => {
        socket.join(`job:${jobId}`);
        console.log(`📊 Client subscribed to job ${jobId}`);
    });

    socket.on('job:unsubscribe', (jobId) => {
        socket.leave(`job:${jobId}`);
    });

    // Phase 10: Backup events
    socket.on('backup:listen', () => {
        socket.join('backup:updates');
        console.log('📌 Client listening to backup updates');
    });

    socket.on('backup:unlisten', () => {
        socket.leave('backup:updates');
    });
});

// Monitor job completions and emit to subscribed clients
setInterval(() => {
    const stats = jobQueue.getStats();
    if (stats.completed > 0) {
        io.emit('jobs:updated', stats);
    }
}, 5000);

const PORT = process.env.PORT || 5000;
const startHttpsServer = (port, label) => {
    if (!httpsOptions) {
        return null;
    }
    const server = https.createServer(httpsOptions, app);
    
    // Attach Socket.IO to HTTPS server for PWA
    const ioHttps = new Server(server, {
        cors: {
            origin: (origin, callback) => {
                if (isOriginAllowed(origin)) return callback(null, true);
                return callback(new Error('CORS blocked'));
            },
            methods: ['GET', 'POST'],
            credentials: true
        }
    });
    
    // Share socket handlers between HTTP and HTTPS
    ioHttps.on('connection', (socket) => {
        // Reuse all handlers from io
        for (const event of Object.keys(io._events || {})) {
            if (typeof io._events[event] === 'function') {
                ioHttps.on(event, io._events[event]);
            }
        }
    });
    
    server.on('error', (err) => {
        console.error(`${label} HTTPS server failed on port ${port}:`, err.message);
        if (label === 'Primary') {
            console.error('Primary HTTPS port is unavailable. Another backend instance may already be running.');
            process.exit(1);
        }
    });
    server.listen(port, '0.0.0.0', () => {
        const localIp = getLocalIp();
        console.log(`${label} HTTPS Server running on port ${port}`);
        console.log(`- Local Access:   https://localhost:${port}`);
        console.log(`- Network Access: https://${localIp}:${port} (Use this IP for Mobile)`);
        console.log(`- Hostname:       https://stock-system.local:${port}`);
    });
    return server;
};

startHttpsServer(HTTPS_PORT, 'Primary');

if (httpsOptions && ENABLE_HTTPS_COMPAT_443 && HTTPS_PORT !== 443) {
    startHttpsServer(443, 'Compatibility');
}

httpServer.on('error', (err) => {
    console.error(`HTTP server failed on port ${HTTP_PORT}:`, err.message);
    console.error('HTTP port is unavailable. Another backend instance may already be running.');
    process.exit(1);
});

httpServer.listen(HTTP_PORT, '0.0.0.0', () => {
    const localIp = getLocalIp();
    console.log(`HTTP Server running on port ${HTTP_PORT}`);
    console.log(`- Local Access:   http://localhost:${HTTP_PORT}`);
    console.log(`- Network Access: http://${localIp}:${HTTP_PORT}`);
});
