const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const CompanyProfile = require('../models/CompanyProfile');
const { audit } = require('./authController');

/**
 * List all team members (Super Admin only)
 */
const listTeamMembers = async (req, res) => {
    const users = await User.find().select('-passwordHash').sort({ createdAt: -1 });
    res.json(users);
};

/**
 * Create a new team member (Super Admin only)
 */
const createTeamMember = async (req, res) => {
    try {
        const { email, fullName, password, role = 'MANAGER' } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const existing = await User.findOne({ email: email.toLowerCase().trim() });
        if (existing) {
            return res.status(409).json({ error: 'Email already exists' });
        }

        const userId = crypto.randomUUID();
        const passwordHash = await bcrypt.hash(password, 10);

        const user = await User.create({
            userId,
            email: email.toLowerCase().trim(),
            fullName,
            passwordHash,
            role,
            active: true,
            createdBy: req.auth.userId
        });

        await audit(req, {
            action: 'TEAM_MEMBER_CREATE',
            targetType: 'USER',
            targetId: userId,
            metadata: { email, role }
        });

        const userObj = user.toObject();
        delete userObj.passwordHash;
        res.json({ success: true, user: userObj });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

/**
 * List audit logs (Super Admin only)
 */
const listAuditLog = async (req, res) => {
    const logs = await AuditLog.find().sort({ createdAt: -1 }).limit(200);
    res.json(logs);
};

/**
 * Get company profile
 */
const getProfile = async (req, res) => {
    let profile = await CompanyProfile.findOne();
    if (!profile) {
        profile = await CompanyProfile.create({}); // Create default
    }
    res.json(profile);
};

/**
 * Update company profile (Super Admin only)
 */
const updateProfile = async (req, res) => {
    try {
        let profile = await CompanyProfile.findOne();
        if (!profile) {
            profile = new CompanyProfile();
        }

        const fields = ['companyName', 'portalTitle', 'supportEmail', 'supportPhone', 'billingEmail', 'address', 'brandColor'];
        fields.forEach(field => {
            if (req.body[field] !== undefined) {
                profile[field] = req.body[field];
            }
        });

        profile.updatedAt = new Date();
        profile.updatedBy = req.auth.userId;
        await profile.save();

        await audit(req, {
            action: 'COMPANY_PROFILE_UPDATE',
            targetType: 'COMPANY',
            targetId: profile.companyName,
            metadata: { fields: Object.keys(req.body) }
        });

        res.json({ success: true, profile });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = {
    listTeamMembers,
    createTeamMember,
    listAuditLog,
    getProfile,
    updateProfile
};
