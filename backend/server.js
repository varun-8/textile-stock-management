require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const https = require('https');
const fs = require('fs');
const { Server } = require('socket.io');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();

// Load Certificates
const httpsOptions = {
    key: fs.readFileSync('./stock-system.local-key.pem'),
    cert: fs.readFileSync('./stock-system.local.pem')
};

const server = https.createServer(httpsOptions, app);
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

const morgan = require('morgan');
const errorHandler = require('./middleware/errorMiddleware');

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(morgan('dev')); // Logging for diagnostics

// Serve PWA Static Files
const path = require('path');
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
mongoose.connect('mongodb://127.0.0.1:27017/textile-stock-management').then(() => {
    console.log('Connected to MongoDB Local (textile-stock-management)');
}).catch(err => {
    console.error('MongoDB Connection Error:', err);
});

// Authentication Middleware
const authenticate = async (req, res, next) => {
    // 1. Admin Login (Desktop) - Uses Body
    if (req.path === '/api/login' || req.path.startsWith('/api/auth')) return next();

    // 2. Mobile Routes - Require Scanner Identity
    if (req.path.startsWith('/api/mobile')) {
        const scannerId = req.headers['x-scanner-id'];

        if (!scannerId) {
            // Allow initial scan/ping ? No, enforce strict pairing.
            // Exception: If we want to allow 'check-connectivity', maybe.
            // But strict is better.
            return res.status(401).json({ error: 'Missing logic: Scanner Not Paired' });
        }

        // Optional: Cache this check or check DB every time?
        // For local LAN, DB check is fast (<2ms).
        const Scanner = require('./models/Scanner');
        const validScanner = await Scanner.findOne({ uuid: scannerId, status: 'ACTIVE' });

        if (!validScanner) {
            return res.status(403).json({ error: 'Scanner Unauthorized or Disabled' });
        }

        // Pass scanner info to route
        req.scanner = validScanner;
        return next();
    }

    // 3. Admin Routes - Allow for now (Assuming Desktop is trusted or implementation pending)
    // For this refactor, we leave existing Admin Auth Logic (Body Check) for desktop routes if any,
    // or just let them pass as they are mostly local.
    // The previous implementation had a "Pass All" logic.
    next();
};

app.use(authenticate);

// Routes
const barcodeRoutes = require('./routes/barcodeRoutes');
const mobileRoutes = require('./routes/mobileRoutes');
const statsRoutes = require('./routes/statsRoutes');
const adminRoutes = require('./routes/adminRoutes');
const authRoutes = require('./routes/adminRoutes'); // Will fix path in next step if typo

// Init Services
require('./services/backupService');

app.use('/api/barcode', barcodeRoutes);
app.use('/api/mobile', mobileRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/sessions', require('./routes/sessionRoutes')); // New Session Routes
app.use('/api/reports', require('./routes/reportsRoutes'));
app.use('/api/sizes', require('./routes/sizesRoutes'));
app.use('/api/employees', require('./routes/employeeRoutes'));

// New Endpoint: Get Server IP (for Desktop to generate QR)
app.get('/api/admin/server-ip', (req, res) => {
    res.json({ ip: getLocalIp() });
});

// Auth Routes (Open for pairing/login)
app.use('/api/auth', require('./routes/authRoutes'));

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    // DEBUG LOG
    console.log('Login Attempt:');
    console.log('Received:', { username, password });
    console.log('Expected:', { user: process.env.APP_USERNAME, pass: process.env.APP_PASSWORD });

    if (username === process.env.APP_USERNAME && password === process.env.APP_PASSWORD) {
        return res.json({ success: true, message: 'Authenticated' });
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
