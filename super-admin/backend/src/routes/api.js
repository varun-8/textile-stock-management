const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');

const authController = require('../controllers/authController');
const licenseController = require('../controllers/licenseController');
const clientSystemController = require('../controllers/clientSystemController');
const adminController = require('../controllers/adminController');
const { requireAuth, requireRole } = require('../middleware/auth');

// Rate limiting for auth routes
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit each IP to 10 login requests per windowMs
    message: { error: 'Too many login attempts, please try again later' }
});

// Auth Routes
router.post('/auth/login', authLimiter, authController.login);
router.get('/auth/me', requireAuth, authController.getMe);
router.put('/auth/me/password', requireAuth, authController.changePassword);

// License Routes (Manager + Super Admin)
router.get('/licenses', requireAuth, licenseController.listLicenses);
router.post('/licenses/issue', requireAuth, requireRole(['SUPER_ADMIN', 'MANAGER']), licenseController.issueLicense);
router.post('/licenses/reset-code', requireAuth, requireRole(['SUPER_ADMIN', 'MANAGER']), licenseController.issueResetCode);
router.post('/licenses/sync', requireAuth, requireRole(['SUPER_ADMIN']), licenseController.syncOfflineLicense);

// Client & System Routes
router.get('/clients', requireAuth, clientSystemController.listClients);
router.post('/clients/register', requireAuth, requireRole(['SUPER_ADMIN', 'MANAGER']), clientSystemController.registerClient);
router.get('/systems', requireAuth, requireRole(['SUPER_ADMIN']), clientSystemController.listSystems);
router.post('/systems/:systemId/block', requireAuth, requireRole(['SUPER_ADMIN']), clientSystemController.blockSystem);
router.post('/systems/:systemId/deactivate', requireAuth, requireRole(['SUPER_ADMIN']), clientSystemController.deactivateSystem);

// Admin & Team Routes (Super Admin only)
router.get('/team-members', requireAuth, requireRole(['SUPER_ADMIN']), adminController.listTeamMembers);
router.post('/team-members', requireAuth, requireRole(['SUPER_ADMIN']), adminController.createTeamMember);
router.get('/audit-log', requireAuth, requireRole(['SUPER_ADMIN']), adminController.listAuditLog);

// Profile Routes
router.get('/company-profile', requireAuth, adminController.getProfile);
router.put('/company-profile', requireAuth, requireRole(['SUPER_ADMIN']), adminController.updateProfile);

// Dashboard Stats (Shared)
router.get('/dashboard', requireAuth, async (req, res) => {
    try {
        const License = require('../models/License');
        const Client = require('../models/Client');
        const System = require('../models/System');
        const User = require('../models/User');
        const AuditLog = require('../models/AuditLog');

        const [licenses, clients, systems, users, recentAudit] = await Promise.all([
            License.countDocuments(),
            Client.countDocuments(),
            System.countDocuments(),
            User.countDocuments(),
            AuditLog.find().sort({ createdAt: -1 }).limit(10)
        ]);

        const blockedSystems = await System.countDocuments({ status: 'BLOCKED' });
        const deactivatedSystems = await System.countDocuments({ status: 'DEACTIVATED' });

        res.json({
            stats: {
                licenses,
                clients,
                systems,
                blockedSystems,
                deactivatedSystems,
                teamMembers: users
            },
            recentAudit
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
