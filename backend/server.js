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
const { issueAdminToken, requireAdminAuth, requireScannerAuth } = require('./middleware/authMiddleware');
const { requireLicense } = require('./middleware/licenseMiddleware');

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

if (!fs.existsSync(TLS_KEY_PATH) || !fs.existsSync(TLS_CERT_PATH)) {
    throw new Error('TLS certificate files are missing. Set TLS_KEY_PATH and TLS_CERT_PATH.');
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

const httpsOptions = {
    key: fs.readFileSync(TLS_KEY_PATH),
    cert: fs.readFileSync(TLS_CERT_PATH)
};

const HTTP_PORT = parseInt(process.env.HTTP_PORT || '5001', 10);
const HTTPS_PORT = parseInt(process.env.PORT || '5000', 10);

const httpsServer = https.createServer(httpsOptions, app);
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
    if (origin === 'capacitor://localhost' || origin === 'ionic://localhost' || origin === 'http://localhost') return true;
    if (allowedOrigins.length === 0) return true;
    if (isPrivateNetworkOrigin(origin)) return true;
    return allowedOrigins.includes(origin);
};

const io = new Server(httpsServer, {
    cors: {
        origin: true,
        methods: ['GET', 'POST']
    }
});

// Middleware
if (helmet) {
    app.use(helmet({
        crossOriginResourcePolicy: false
    }));
}
app.use(cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));
app.use(express.json({ limit: '8mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

if (rateLimit) {
    const authLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 20,
        standardHeaders: true,
        legacyHeaders: false
    });
    app.use('/api/login', authLimiter);
    app.use('/api/auth', authLimiter);
}

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
  <title>Opening Prodexa...</title>
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
      <h1>Opening Prodexa</h1>
      <p>Loading the scanner app and pairing details.</p>
      <a href="${target}">Tap if it does not open automatically</a>
    </div>
  </div>
  <script>window.location.replace(${JSON.stringify(target)});</script>
</body>
</html>`);
});

app.get('/pwa/ProdexaMobile.apk', (req, res, next) => {
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
app.use('/pwa', express.static(path.join(__dirname, 'public/pwa')));

// Attach IO to request for routes
app.use((req, res, next) => {
    req.io = io;
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

// Database Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/textile-stock-management').then(() => {
    console.log('Connected to MongoDB Local (textile-stock-management)');
}).catch(err => {
    console.error('MongoDB Connection Error:', err);
});

// Routes
const barcodeRoutes = require('./routes/barcodeRoutes');
const mobileRoutes = require('./routes/mobileRoutes');
const statsRoutes = require('./routes/statsRoutes');
const adminRoutes = require('./routes/adminRoutes');
const licenseRoutes = require('./routes/licenseRoutes');

// Init Services
require('./services/backupService');

app.use('/api/license', licenseRoutes);

// New Endpoint: Get Server IP (for Desktop to generate QR)
// Auth Routes (Open for pairing/login)
app.use(requireLicense);
app.use('/api/mobile', requireScannerAuth, mobileRoutes);
app.use('/api/barcode', requireAdminAuth, barcodeRoutes);
app.use('/api/stats', requireAdminAuth, statsRoutes);
app.use('/api/admin', requireAdminAuth, adminRoutes);
app.use('/api/sessions', require('./routes/sessionRoutes'));
app.use('/api/reports', requireAdminAuth, require('./routes/reportsRoutes'));
app.use('/api/sizes', require('./routes/sizesRoutes'));
app.use('/api/employees', require('./routes/employeeRoutes'));
app.use('/api/dc', requireAdminAuth, require('./routes/dcRoutes'));
app.use('/api/quotations', requireAdminAuth, require('./routes/quotationRoutes'));
app.use('/api/auth', require('./routes/authRoutes'));

app.get('/api/auth/ping', (req, res) => {
    res.json({ success: true, message: 'pong' });
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

// Error Handling Middleware (Must be last)
app.use(errorHandler);

// Socket.IO
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 5000;
httpsServer.listen(HTTPS_PORT, '0.0.0.0', () => {
    const localIp = getLocalIp();
    console.log(`HTTPS Server running on port ${HTTPS_PORT}`);
    console.log(`- Local Access:   https://localhost:${HTTPS_PORT}`);
    console.log(`- Network Access: https://${localIp}:${HTTPS_PORT} (Use this IP for Mobile)`);
    console.log(`- Hostname:       https://stock-system.local:${HTTPS_PORT}`);
});

httpServer.listen(HTTP_PORT, '0.0.0.0', () => {
    const localIp = getLocalIp();
    console.log(`HTTP Server running on port ${HTTP_PORT}`);
    console.log(`- Local Access:   http://localhost:${HTTP_PORT}`);
    console.log(`- Network Access: http://${localIp}:${HTTP_PORT} (Use this for mobile pairing/install in dev)`);
});
