const express = require('express');
const router = express.Router();
const backupService = require('../services/backupService');
const AuditLog = require('../models/AuditLog');
const Scanner = require('../models/Scanner');
const os = require('os');

// Get Audit Logs
router.get('/audit-logs', async (req, res) => {
    try {
        const logs = await AuditLog.find().sort({ timestamp: -1 }).limit(100);
        res.json(logs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Manual Backup
router.post('/backup', async (req, res) => {
    try {
        const result = await backupService.performBackup('MANUAL');
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// List Backups
router.get('/backups', async (req, res) => {
    try {
        const backups = await backupService.listBackups();
        // Sort by date desc (parse filename or stat) - simple string sort is okay for ISO filenames
        res.json(backups.sort().reverse());
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Restore Backup
router.post('/restore', async (req, res) => {
    const { filename } = req.body;
    if (!filename) return res.status(400).json({ error: 'Filename required' });

    try {
        await backupService.restoreBackup(filename);
        res.json({ success: true, message: 'System Restored Successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get Server LAN IP
router.get('/server-ip', (req, res) => {
    try {
        const interfaces = os.networkInterfaces();
        let lanIp = '';

        // Find first non-internal IPv4 address
        for (const [name, addrs] of Object.entries(interfaces)) {
            for (const addr of addrs) {
                if (addr.family === 'IPv4' && !addr.internal) {
                    lanIp = addr.address;
                    break;
                }
            }
            if (lanIp) break;
        }

        res.json({ ip: lanIp || 'localhost' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get All Paired Scanners
router.get('/scanners', async (req, res) => {
    try {
        const scanners = await Scanner.find().sort({ pairedAt: -1 });
        console.log(`📋 GET /scanners - Found ${scanners.length} scanners`);
        if (scanners.length > 0) {
            console.log('📋 Scanners:', scanners.map(s => ({ id: s.uuid, name: s.label, status: s.status })));
        }
        res.json(scanners.map(s => ({
            scannerId: s.uuid,
            name: s.name,
            status: s.status,
            pairedAt: s.pairedAt,
            lastSeen: s.lastSeen
        })));
    } catch (err) {
        console.error('❌ Error fetching scanners:', err);
        res.status(500).json({ error: err.message });
    }
});

// Register a New Scanner (called when mobile app pairs)
router.post('/scanners', async (req, res) => {
    try {
        const { scannerId, name } = req.body;

        console.log('📱 POST /scanners - Registering scanner:', { scannerId, name });

        if (!scannerId) {
            return res.status(400).json({ error: 'scannerId required' });
        }

        // Check if scanner already exists
        let scanner = await Scanner.findOne({ uuid: scannerId });

        if (scanner) {
            // Update existing scanner
            scanner.lastSeen = new Date();
            scanner.status = 'ACTIVE';
            await scanner.save();
            console.log(`✅ Updated existing scanner: ${scannerId}`);
        } else {
            // Create new scanner
            scanner = new Scanner({
                uuid: scannerId,
                name: name || `Scanner ${scannerId.substring(0, 8)}`,
                status: 'ACTIVE',
                pairedAt: new Date(),
                lastSeen: new Date()
            });
            await scanner.save();
            console.log(`✅ Created new scanner: ${scannerId} with label: ${scanner.name}`);
        }

        res.json({
            success: true,
            message: 'Scanner registered',
            scanner: {
                scannerId: scanner.uuid,
                name: scanner.name,
                status: scanner.status
            }
        });
    } catch (err) {
        console.error('❌ Error registering scanner:', err);
        res.status(500).json({ error: err.message });
    }
});

// Delete Scanner
router.delete('/scanners/:scannerId', async (req, res) => {
    try {
        const result = await Scanner.deleteOne({ uuid: req.params.scannerId });
        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'Scanner not found' });
        }
        res.json({ success: true, message: 'Scanner removed' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
