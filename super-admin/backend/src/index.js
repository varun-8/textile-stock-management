const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const apiRoutes = require('./routes/api');
const { seedSuperAdmin } = require('./controllers/authController');

const app = express();
const PORT = process.env.PORT || 8080;
const MONGODB_URI = process.env.ADMIN_MONGODB_URI || 'mongodb://127.0.0.1:27017/loomtrack-admin';

// Security & Middleware
app.use(helmet({
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: false
}));

const allowedOrigins = (process.env.SUPER_ADMIN_ALLOWED_ORIGINS || '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));

app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

// X-Robots-Tag for sensitive administrative portals
app.use((req, res, next) => {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
    next();
});

// API Routes
app.use('/api', apiRoutes);

// Database Connection & Server Start
mongoose.connect(MONGODB_URI)
    .then(async () => {
        console.log('✅ Connected to MongoDB (Admin Dedicated):', MONGODB_URI);
        
        // Seed the initial Super Admin account
        await seedSuperAdmin();
        
        app.listen(PORT, () => {
            console.log(`🚀 Super Admin Backend running on port ${PORT}`);
        });
    })
    .catch(err => {
        console.error('❌ MongoDB Connection Error:', err);
        process.exit(1);
    });
