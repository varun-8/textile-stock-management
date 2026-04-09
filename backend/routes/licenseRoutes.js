const express = require('express');
const router = express.Router();
const {
    activateLicense,
    getDeviceId,
    getLicenseStatus,
    verifyResetCode
} = require('../services/licenseService');
const { resetAdminPassword } = require('../services/adminCredentialService');

router.get('/status', (req, res) => {
    res.json(getLicenseStatus());
});

router.get('/device', (req, res) => {
    res.json({
        deviceId: getDeviceId(),
        license: getLicenseStatus()
    });
});

router.post('/activate', (req, res) => {
    try {
        const activationCode = String(req.body?.activationCode || '').trim();
        if (!activationCode) {
            return res.status(400).json({ error: 'activationCode is required' });
        }

        const status = activateLicense(activationCode);
        res.json({ success: true, license: status });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.post('/reset-password', async (req, res) => {
    try {
        const resetCode = String(req.body?.resetCode || '').trim();
        const newPassword = String(req.body?.newPassword || '').trim();

        if (!resetCode || !newPassword) {
            return res.status(400).json({ error: 'resetCode and newPassword are required' });
        }

        verifyResetCode(resetCode);
        await resetAdminPassword(newPassword);

        res.json({ success: true, message: 'Admin password updated successfully.' });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;
