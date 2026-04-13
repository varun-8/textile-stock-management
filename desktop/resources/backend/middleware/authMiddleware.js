const crypto = require('crypto');
const Scanner = require('../models/Scanner');
let jwt = null;
try {
    jwt = require('jsonwebtoken');
} catch (err) {
    console.warn('[Security] Optional dependency "jsonwebtoken" not installed. Using fallback token signer.');
}

const ADMIN_TOKEN_TTL = process.env.ADMIN_TOKEN_TTL || '12h';
const PAIRING_TOKEN_TTL = process.env.PAIRING_TOKEN_TTL || '10m';
const DEFAULT_WORKSPACE_CODE = process.env.WORKSPACE_CODE || 'default';

const getJwtSecret = () => {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        if (process.env.NODE_ENV === 'production') {
            throw new Error('JWT_SECRET is required in production');
        }
        return 'dev-insecure-jwt-secret-change-me';
    }
    return secret;
};

const encodeBase64Url = (obj) => {
    return Buffer.from(JSON.stringify(obj))
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
};

const decodeBase64Url = (str) => {
    const padded = str.replace(/-/g, '+').replace(/_/g, '/')
        + '='.repeat((4 - (str.length % 4)) % 4);
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
};

const parseExpiryToSeconds = (ttl) => {
    if (typeof ttl === 'number') return ttl;
    if (/^\d+$/.test(ttl)) return parseInt(ttl, 10);
    const m = String(ttl).match(/^(\d+)([smhd])$/i);
    if (!m) return 12 * 60 * 60;
    const n = parseInt(m[1], 10);
    const u = m[2].toLowerCase();
    if (u === 's') return n;
    if (u === 'm') return n * 60;
    if (u === 'h') return n * 60 * 60;
    return n * 24 * 60 * 60;
};

const signFallbackToken = (payload, expiresIn) => {
    const exp = Math.floor(Date.now() / 1000) + parseExpiryToSeconds(expiresIn);
    const header = encodeBase64Url({ alg: 'HS256', typ: 'JWT' });
    const body = encodeBase64Url({ ...payload, exp });
    const sig = crypto
        .createHmac('sha256', getJwtSecret())
        .update(`${header}.${body}`)
        .digest('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
    return `${header}.${body}.${sig}`;
};

const verifyFallbackToken = (token) => {
    const parts = String(token || '').split('.');
    if (parts.length !== 3) throw new Error('Invalid token');
    const [header, body, sig] = parts;
    const expected = crypto
        .createHmac('sha256', getJwtSecret())
        .update(`${header}.${body}`)
        .digest('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
    if (sig !== expected) throw new Error('Invalid token signature');
    const decoded = decodeBase64Url(body);
    if (!decoded.exp || decoded.exp < Math.floor(Date.now() / 1000)) {
        throw new Error('Token expired');
    }
    return decoded;
};

const signToken = (payload, expiresIn) => {
    if (jwt) return jwt.sign(payload, getJwtSecret(), { expiresIn });
    return signFallbackToken(payload, expiresIn);
};

const verifyToken = (token) => {
    if (jwt) return jwt.verify(token, getJwtSecret());
    return verifyFallbackToken(token);
};

const issueAdminToken = (payload) => {
    return signToken(payload, ADMIN_TOKEN_TTL);
};

const issuePairingToken = (workspaceCode = DEFAULT_WORKSPACE_CODE) => {
    return signToken({ type: 'PAIRING', workspaceCode }, PAIRING_TOKEN_TTL);
};

const getBearerToken = (req) => {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) return null;
    return authHeader.substring('Bearer '.length).trim();
};

const requireAdminAuth = (req, res, next) => {
    try {
        let token = getBearerToken(req);
        if (!token && req.query.token) {
            token = req.query.token;
        }

        if (!token) {
            return res.status(401).json({ error: 'Admin token required' });
        }

        const decoded = verifyToken(token);
        req.admin = decoded;
        return next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired admin token' });
    }
};

const requireScannerAuth = async (req, res, next) => {
    try {
        const scannerId = req.headers['x-scanner-id'];
        if (!scannerId) {
            return res.status(401).json({ error: 'Scanner ID is required' });
        }

        const workspaceCode = process.env.WORKSPACE_CODE || 'default';
        const scannerQuery = {
            uuid: scannerId,
            status: 'ACTIVE',
            $or: [
                { workspaceCode },
                { workspaceCode: { $exists: false } },
                { workspaceCode: null }
            ]
        };
        const scanner = await Scanner.findOne(scannerQuery);
        if (!scanner) {
            return res.status(403).json({ error: 'Scanner unauthorized or disabled' });
        }

        req.scanner = scanner;
        return next();
    } catch (err) {
        return res.status(500).json({ error: 'Scanner auth failed' });
    }
};

const requireAnyAuth = async (req, res, next) => {
    try {
        let token = getBearerToken(req);
        if (!token && req.query.token) {
            token = req.query.token;
        }

        if (token) {
            try {
                const decoded = verifyToken(token);
                req.admin = decoded;
                req.authType = 'ADMIN';
                return next();
            } catch (err) {
                // If token exists but is invalid, we don't immediately fail
                // We'll fall through to see if it's a valid scanner request
            }
        }

        // Fallback to scanner authentication
        // requireScannerAuth is async, so we await it
        await requireScannerAuth(req, res, next);
    } catch (err) {
        console.error('[Auth] requireAnyAuth failed:', err.message);
        res.status(401).json({ error: err.message || 'Authentication required' });
    }
};

module.exports = {
    issueAdminToken,
    issuePairingToken,
    verifyToken,
    requireAdminAuth,
    requireScannerAuth,
    requireAnyAuth
};
