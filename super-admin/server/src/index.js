const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const crypto = require('crypto');
const { signLicense, signResetCode } = require('./lib/licenseCrypto');
const { listLicenses, saveLicense, updateLicense } = require('./store');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;
const ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || 'change-me';
const SESSION_TOKEN_TTL_MS = Number(process.env.SUPER_ADMIN_TOKEN_TTL_MS || 12 * 60 * 60 * 1000);
const sessions = new Map();

if (process.env.NODE_ENV === 'production') {
    if (!process.env.SUPER_ADMIN_PASSWORD) {
        throw new Error('SUPER_ADMIN_PASSWORD is required in production');
    }
    if (!process.env.LICENSE_PRIVATE_KEY_PEM && !process.env.LICENSE_PRIVATE_KEY_PATH) {
        throw new Error('LICENSE_PRIVATE_KEY_PEM or LICENSE_PRIVATE_KEY_PATH is required in production');
    }
    if (!process.env.LICENSE_PUBLIC_KEY_PEM && !process.env.LICENSE_PUBLIC_KEY_PATH) {
        throw new Error('LICENSE_PUBLIC_KEY_PEM or LICENSE_PUBLIC_KEY_PATH is required in production');
    }
}

app.use(helmet({
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: false
}));
app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        return callback(null, true);
    },
    credentials: true
}));
app.use(express.json({ limit: '1mb' }));
app.use((req, res, next) => {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
    next();
});

const publicDir = path.resolve(__dirname, '../public');
if (fs.existsSync(publicDir)) {
    app.use(express.static(publicDir, {
        index: false,
        extensions: ['html']
    }));
}

const requireAdmin = (req, res, next) => {
    const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    const session = token ? sessions.get(token) : null;
    if (!session || session.expiresAt < Date.now()) {
        return res.status(401).json({ error: 'Admin authentication required' });
    }
    req.admin = session;
    next();
};

app.get('/api/health', (req, res) => {
    res.json({ ok: true });
});

app.post('/api/auth/login', (req, res) => {
    const password = String(req.body?.password || '');
    if (password !== ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Invalid password' });
    }

    const token = crypto.randomUUID();
    sessions.set(token, {
        id: token,
        role: 'SUPER_ADMIN',
        expiresAt: Date.now() + SESSION_TOKEN_TTL_MS
    });

    res.json({ success: true, token });
});

app.post('/api/auth/logout', (req, res) => {
    const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (token) sessions.delete(token);
    res.json({ success: true });
});

app.get('/api/licenses', requireAdmin, (req, res) => {
    res.json(listLicenses());
});

app.post('/api/licenses/issue', requireAdmin, (req, res) => {
    try {
        const companyName = String(req.body?.companyName || '').trim();
        const workspaceCode = String(req.body?.workspaceCode || '').trim() || 'default';
        const deviceId = String(req.body?.deviceId || '').trim();
        const features = Array.isArray(req.body?.features) ? req.body.features : [];
        const expiresAt = req.body?.expiresAt ? new Date(req.body.expiresAt).toISOString() : null;

        if (!companyName || !deviceId) {
            return res.status(400).json({ error: 'companyName and deviceId are required' });
        }

        const licenseId = crypto.randomUUID();
        const payload = {
            typ: 'LICENSE',
            licenseId,
            companyName,
            workspaceCode,
            deviceId,
            features,
            issuedAt: new Date().toISOString(),
            expiresAt
        };

        const activationCode = signLicense(payload);
        const record = {
            ...payload,
            activationCode,
            status: 'ISSUED'
        };

        saveLicense(record);

        res.json({ success: true, license: record });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/licenses/reset-code', requireAdmin, (req, res) => {
    try {
        const deviceId = String(req.body?.deviceId || '').trim();
        if (!deviceId) {
            return res.status(400).json({ error: 'deviceId is required' });
        }

        const payload = {
            typ: 'RESET',
            resetId: crypto.randomUUID(),
            deviceId,
            issuedAt: new Date().toISOString(),
            expiresAt: req.body?.expiresAt ? new Date(req.body.expiresAt).toISOString() : null
        };

        const resetCode = signResetCode(payload);
        res.json({ success: true, resetCode, payload });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/licenses/:licenseId/revoke', requireAdmin, (req, res) => {
    const { licenseId } = req.params;
    const updated = updateLicense(licenseId, (license) => ({
        ...license,
        status: 'REVOKED',
        revokedAt: new Date().toISOString(),
        revokedBy: req.admin.id
    }));

    if (!updated) {
        return res.status(404).json({ error: 'License not found' });
    }

    res.json({ success: true, license: updated });
});

app.get('/robots.txt', (req, res) => {
    res.type('text/plain').send('User-agent: *\nDisallow: /\n');
});

app.use((req, res) => {
    const file = path.join(publicDir, 'index.html');
    if (fs.existsSync(file)) {
        return res.sendFile(file);
    }
    res.status(404).send('Not found');
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Super admin running on port ${PORT}`);
});
