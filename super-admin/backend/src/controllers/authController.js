const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { JWT_SECRET } = require('../middleware/auth');

const SESSION_TOKEN_TTL = '12h';

/**
 * Utility to log audit events
 */
const audit = async (req, { action, outcome = 'SUCCESS', targetType = 'AUTH', targetId, metadata = {} }) => {
    try {
        await AuditLog.create({
            auditId: crypto.randomUUID(),
            action,
            outcome,
            targetType,
            targetId,
            metadata,
            actorId: req.auth?.userId || null,
            actorEmail: req.auth?.email || null,
            actorRole: req.auth?.role || null,
            ip: req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress,
            userAgent: req.headers['user-agent']
        });
    } catch (err) {
        console.error('Audit Log Error:', err);
    }
};

/**
 * Login Controller
 */
const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const user = await User.findOne({ email: email.toLowerCase().trim() });
        if (!user) {
            console.log(`[Auth] Login failed: User not found (${email})`);
            await audit(req, { action: 'LOGIN', outcome: 'DENIED', targetId: email, metadata: { reason: 'User not found' } });
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        if (!user.active) {
            console.log(`[Auth] Login failed: Account inactive (${email})`);
            await audit(req, { action: 'LOGIN', outcome: 'DENIED', targetId: email, metadata: { reason: 'Account deactivated' } });
            return res.status(401).json({ error: 'Account deactivated' });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            console.log(`[Auth] Login failed: Password mismatch (${email})`);
            await audit(req, { action: 'LOGIN', outcome: 'DENIED', targetId: user.userId, metadata: { reason: 'Password mismatch' } });
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { userId: user.userId, role: user.role },
            JWT_SECRET,
            { expiresIn: SESSION_TOKEN_TTL }
        );

        await audit(req, {
            action: 'LOGIN',
            outcome: 'SUCCESS',
            targetId: user.userId,
            metadata: { role: user.role }
        });

        res.json({
            success: true,
            token,
            user: {
                userId: user.userId,
                email: user.email,
                fullName: user.fullName,
                role: user.role
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

/**
 * Get current user info
 */
const getMe = async (req, res) => {
    res.json({
        user: {
            userId: req.user.userId,
            email: req.user.email,
            fullName: req.user.fullName,
            role: req.user.role,
            active: req.user.active
        }
    });
};

/**
 * Update password for current user
 */
const changePassword = async (req, res) => {
    try {
        const { currentPassword, nextPassword } = req.body;
        if (!currentPassword || !nextPassword) {
            return res.status(400).json({ error: 'currentPassword and nextPassword are required' });
        }

        const isMatch = await req.user.comparePassword(currentPassword);
        if (!isMatch) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }

        req.user.passwordHash = await bcrypt.hash(nextPassword, 10);
        await req.user.save();

        await audit(req, {
            action: 'PASSWORD_CHANGE',
            targetType: 'USER',
            targetId: req.user.userId,
            metadata: { selfService: true }
        });

        res.json({ success: true, message: 'Password updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

/**
 * Seed Super Admin if none exists
 */
const seedSuperAdmin = async () => {
    const email = (process.env.SUPER_ADMIN_EMAIL || 'superadmin@gmail.com').toLowerCase().trim();
    const password = process.env.SUPER_ADMIN_PASSWORD || 'password123';
    const passwordHash = await bcrypt.hash(password, 10);

    const rootUser = await User.findOne({ userId: 'super-admin-root' });
    
    if (!rootUser) {
        await User.create({
            userId: 'super-admin-root',
            email,
            fullName: 'Root Super Admin',
            passwordHash,
            role: 'SUPER_ADMIN',
            active: true,
            createdBy: 'SYSTEM'
        });
        console.log('✅ Created Root Super Admin:', email);
    } else {
        // Update credentials to match latest .env
        rootUser.email = email;
        rootUser.passwordHash = passwordHash;
        await rootUser.save();
        console.log('✅ Verified Root Super Admin credentials:', email);
    }
};

module.exports = {
    login,
    getMe,
    changePassword,
    seedSuperAdmin,
    audit
};
