const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-loomtrack-key-2026';

/**
 * Middleware to require authentication via JWT
 */
const requireAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);

        const user = await User.findOne({ userId: decoded.userId });
        if (!user || !user.active) {
            return res.status(401).json({ error: 'Invalid user or account deactivated' });
        }

        // Attach user and role info to the request
        req.user = user;
        req.auth = {
            userId: user.userId,
            email: user.email,
            role: user.role
        };

        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
};

/**
 * Middleware to require specific roles
 * @param {string[]} allowedRoles 
 */
const requireRole = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.auth || !allowedRoles.includes(req.auth.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        next();
    };
};

module.exports = {
    requireAuth,
    requireRole,
    JWT_SECRET
};
