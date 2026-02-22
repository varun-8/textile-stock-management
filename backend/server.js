require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { Server } = require('socket.io');
const cors = require('cors');
const morgan = require('morgan');
const errorHandler = require('./middleware/errorMiddleware');
const { issueAdminToken, requireAdminAuth, requireScannerAuth } = require('./middleware/authMiddleware');

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

const httpsOptions = {
    key: fs.readFileSync(TLS_KEY_PATH),
    cert: fs.readFileSync(TLS_CERT_PATH)
};

const server = https.createServer(httpsOptions, app);

const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

const isOriginAllowed = (origin) => {
    if (!origin) return true;
    if (origin.startsWith('file://')) return true;
    if (allowedOrigins.length === 0) return true;
    return allowedOrigins.includes(origin);
};

const io = new Server(server, {
    cors: {
        origin: (origin, callback) => {
            if (isOriginAllowed(origin)) return callback(null, true);
            return callback(new Error('CORS blocked'), false);
        },
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
    origin: (origin, callback) => {
        if (isOriginAllowed(origin)) return callback(null, true);
        return callback(new Error('CORS blocked'), false);
    },
    credentials: true
}));
app.use(express.json({ limit: '2mb' }));
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

// Init Services
require('./services/backupService');

app.use('/api/mobile', requireScannerAuth, mobileRoutes);
app.use('/api/barcode', requireAdminAuth, barcodeRoutes);
app.use('/api/stats', requireAdminAuth, statsRoutes);
app.use('/api/admin', requireAdminAuth, adminRoutes);
app.use('/api/sessions', require('./routes/sessionRoutes'));
app.use('/api/reports', requireAdminAuth, require('./routes/reportsRoutes'));
app.use('/api/sizes', requireAdminAuth, require('./routes/sizesRoutes'));
app.use('/api/employees', require('./routes/employeeRoutes'));

// New Endpoint: Get Server IP (for Desktop to generate QR)
// Auth Routes (Open for pairing/login)
app.use('/api/auth', require('./routes/authRoutes'));

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    if (username === process.env.APP_USERNAME && password === process.env.APP_PASSWORD) {
        const token = issueAdminToken({
            username,
            role: 'ADMIN'
        });
        return res.json({ success: true, message: 'Authenticated', token });
    }
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
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
server.listen(PORT, '0.0.0.0', () => {
    const localIp = getLocalIp();
    console.log(`HTTPS Server running on port ${PORT}`);
    console.log(`- Local Access:   https://localhost:${PORT}`);
    console.log(`- Network Access: https://${localIp}:${PORT} (Use this IP for Mobile)`);
    console.log(`- Hostname:       https://stock-system.local:${PORT}`);
});
