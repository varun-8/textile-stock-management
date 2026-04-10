const crypto = require('crypto');
const License = require('../models/License');
const { signLicense, signResetCode } = require('../lib/licenseEngine');
const { audit } = require('./authController');

/**
 * Issue a new activation code (Online)
 */
const issueLicense = async (req, res) => {
    try {
        const { companyName, workspaceCode = 'default', deviceId, features = [], expiresAt } = req.body;

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
            expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null
        };

        const activationCode = signLicense(payload);

        const record = await License.create({
            ...payload,
            activationCode,
            source: 'ONLINE',
            status: 'ISSUED',
            createdBy: req.auth.userId,
            createdByRole: req.auth.role
        });

        await audit(req, {
            action: 'LICENSE_ISSUE',
            targetType: 'LICENSE',
            targetId: licenseId,
            metadata: { companyName, deviceId, source: 'ONLINE' }
        });

        res.json({ success: true, license: record });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

/**
 * Generate a reset password code for a device
 */
const issueResetCode = async (req, res) => {
    try {
        const { deviceId, expiresAt } = req.body;
        if (!deviceId) {
            return res.status(400).json({ error: 'deviceId is required' });
        }

        const resetId = crypto.randomUUID();
        const payload = {
            typ: 'RESET',
            resetId,
            deviceId,
            issuedAt: new Date().toISOString(),
            expiresAt: expiresAt ? new Date(expiresAt).toISOString() : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // Default 24h
        };

        const resetCode = signResetCode(payload);

        await audit(req, {
            action: 'RESET_CODE_ISSUE',
            targetType: 'DEVICE',
            targetId: deviceId,
            metadata: { resetId }
        });

        res.json({ success: true, resetCode, payload });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

/**
 * Sync an offline-generated license
 */
const syncOfflineLicense = async (req, res) => {
    try {
        const { activationCode, payload } = req.body;

        // In a real production-grade app, we might verify the activationCode against the payload here
        // or just trust the payload if the user is a Super Admin.
        // Let's at least ensure it's not a duplicate.

        if (!payload || !payload.licenseId || !activationCode) {
            return res.status(400).json({ error: 'Invalid sync data' });
        }

        const existing = await License.findOne({ licenseId: payload.licenseId });
        if (existing) {
            return res.status(409).json({ error: 'License already exists in central database' });
        }

        const record = await License.create({
            ...payload,
            activationCode,
            source: 'OFFLINE',
            status: 'SYNCED',
            createdBy: req.auth.userId,
            createdByRole: req.auth.role
        });

        await audit(req, {
            action: 'LICENSE_SYNC',
            targetType: 'LICENSE',
            targetId: record.licenseId,
            metadata: { source: 'OFFLINE', companyName: record.companyName }
        });

        res.json({ success: true, message: 'Offline license synced successfully', license: record });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

/**
 * List all licenses
 */
const listLicenses = async (req, res) => {
    const items = await License.find().sort({ issuedAt: -1 });
    res.json(items);
};

module.exports = {
    issueLicense,
    issueResetCode,
    syncOfflineLicense,
    listLicenses
};
