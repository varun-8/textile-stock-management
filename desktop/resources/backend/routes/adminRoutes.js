const express = require('express');
const backupService = require('../services/backupService');
const cloudBackupRoutes = require('../services/backup/cloudBackupRoutes');
const AuditLog = require('../models/AuditLog');
const Scanner = require('../models/Scanner');
const Barcode = require('../models/Barcode');
const ClothRoll = require('../models/ClothRoll');
const Employee = require('../models/Employee');
const Session = require('../models/Session');
const MissedScan = require('../models/MissedScan');
const Size = require('../models/Size');
const User = require('../models/User');
const DeliveryChallan = require('../models/DeliveryChallan');
const Quotation = require('../models/Quotation');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { issuePairingToken } = require('../middleware/authMiddleware');
const { getWorkspaceCode } = require('../utils/workspace');
const { normalizePieces, totalFromPieces } = require('../utils/rollPieces');
const { detectMissingSequences } = require('../utils/missingSequenceService');
const { ensureInstallApk } = require('../services/installApkService');
const { getConfigPath, getDefaultBackupDir, resolveBackupPath } = require('../utils/runtimePaths');
const HTTP_PORT = parseInt(process.env.HTTP_PORT || '5000', 10);
const HTTPS_PORT = parseInt(process.env.PORT || '5001', 10);

module.exports = function createAdminRouter(io, cloudBackupManager) {
    const router = express.Router();

// Get Audit Logs
router.get('/audit-logs', async (req, res) => {
    try {
        const logs = await AuditLog.find()
            .sort({ timestamp: -1 })
            .limit(100)
            .lean();
        res.json(logs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const DEFAULT_DC_TEMPLATE = {
    layoutMode: 'printed',
    companyName: '',
    subTitle: '',
    documentTitle: 'DELIVERY NOTE',
    gstin: '',
    address: '',
    phoneText: '',
    tableHeaderColor: '#1a5c1a',
    showPartyAddress: true,
    showQuality: true,
    showFolding: true,
    showLotNo: true,
    showBillNo: true,
    showBillPreparedBy: true,
    showVehicle: true,
    showDriver: true,
    logoDataUrl: '',
    logoDataUrl2: '',
    companyNameSize: 16,
    subTitleSize: 8,
    addressSize: 7.5
};

const createTemplateId = () => `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const sanitizeDcTemplate = (body = {}) => {
    const safeTemplate = {
        layoutMode: ['modern', 'printed'].includes(String(body.layoutMode || ''))
            ? String(body.layoutMode)
            : DEFAULT_DC_TEMPLATE.layoutMode,
        companyName: String(body.companyName || DEFAULT_DC_TEMPLATE.companyName).trim().slice(0, 120),
        subTitle: String(body.subTitle || DEFAULT_DC_TEMPLATE.subTitle).trim().slice(0, 160),
        documentTitle: String(body.documentTitle || DEFAULT_DC_TEMPLATE.documentTitle).trim().slice(0, 80),
        gstin: String(body.gstin || '').trim().slice(0, 64),
        address: String(body.address || '').trim().slice(0, 400),
        phoneText: String(body.phoneText || '').trim().slice(0, 80),
        tableHeaderColor: /^#[0-9a-fA-F]{6}$/.test(String(body.tableHeaderColor || ''))
            ? String(body.tableHeaderColor)
            : DEFAULT_DC_TEMPLATE.tableHeaderColor,
        showPartyAddress: body.showPartyAddress !== false,
        showQuality: body.showQuality !== false,
        showFolding: body.showFolding !== false,
        showLotNo: body.showLotNo !== false,
        showBillNo: body.showBillNo !== false,
        showBillPreparedBy: body.showBillPreparedBy !== false,
        showVehicle: body.showVehicle !== false,
        showDriver: body.showDriver !== false,
        logoDataUrl: typeof body.logoDataUrl === 'string' ? body.logoDataUrl : '',
        logoDataUrl2: typeof body.logoDataUrl2 === 'string' ? body.logoDataUrl2 : '',
        companyNameSize: parseFloat(body.companyNameSize) || 16,
        subTitleSize: parseFloat(body.subTitleSize) || 8,
        addressSize: parseFloat(body.addressSize) || 7.5
    };

    if (safeTemplate.logoDataUrl && !safeTemplate.logoDataUrl.startsWith('data:image/')) {
        throw new Error('Invalid logo format. Please upload a valid image file.');
    }
    if (safeTemplate.logoDataUrl2 && !safeTemplate.logoDataUrl2.startsWith('data:image/')) {
        throw new Error('Invalid right logo format. Please upload a valid image file.');
    }
    if (safeTemplate.logoDataUrl && safeTemplate.logoDataUrl.length > 5000000) {
        throw new Error('Logo image is too large. Please upload a smaller image.');
    }
    if (safeTemplate.logoDataUrl2 && safeTemplate.logoDataUrl2.length > 5000000) {
        throw new Error('Right logo image is too large. Please upload a smaller image.');
    }

    return safeTemplate;
};

const readDcTemplatesConfig = (config) => {
    const templates = [];

    if (Array.isArray(config.dcTemplates)) {
        config.dcTemplates.forEach((tpl) => {
            if (!tpl || typeof tpl !== 'object') return;
            try {
                templates.push({
                    id: String(tpl.id || createTemplateId()),
                    name: String(tpl.name || 'Untitled Template').trim().slice(0, 80) || 'Untitled Template',
                    config: sanitizeDcTemplate(tpl.config || tpl)
                });
            } catch (_) {
                // Skip malformed templates and continue.
            }
        });
    }

    if (templates.length === 0) {
        const legacy = config.dcTemplate && typeof config.dcTemplate === 'object'
            ? config.dcTemplate
            : DEFAULT_DC_TEMPLATE;
        templates.push({
            id: 'tpl-default',
            name: 'Default Template',
            config: sanitizeDcTemplate(legacy)
        });
    }

    let activeTemplateId = String(config.activeDcTemplateId || '').trim();
    if (!activeTemplateId || !templates.some((t) => t.id === activeTemplateId)) {
        activeTemplateId = templates[0].id;
    }

    return { templates, activeTemplateId };
};

const persistDcTemplatesConfig = (config, templates, activeTemplateId) => {
    const safeTemplates = templates.map((tpl) => ({
        id: String(tpl.id),
        name: String(tpl.name || 'Untitled Template').trim().slice(0, 80) || 'Untitled Template',
        config: sanitizeDcTemplate(tpl.config || {})
    }));
    const safeActiveId = safeTemplates.some((t) => t.id === activeTemplateId)
        ? activeTemplateId
        : safeTemplates[0].id;

    config.dcTemplates = safeTemplates;
    config.activeDcTemplateId = safeActiveId;
    config.dcTemplate = safeTemplates.find((t) => t.id === safeActiveId).config;
    return { templates: safeTemplates, activeTemplateId: safeActiveId };
};

const readConfigFile = () => {
    const configPath = getConfigPath();
    const fs = require('fs');
    if (!fs.existsSync(configPath)) {
        return {};
    }
    return JSON.parse(fs.readFileSync(configPath));
};

const writeConfigFile = (config) => {
    const configPath = getConfigPath();
    const fs = require('fs');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
};

// Get Backup Path
router.get('/config/backup-path', (req, res) => {
    try {
        const config = readConfigFile();
        res.json({ path: resolveBackupPath(config.backupPath || getDefaultBackupDir()) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update Backup Path
router.post('/config/backup-path', (req, res) => {
    try {
        const config = readConfigFile();
        config.backupPath = req.body.path || getDefaultBackupDir();
        writeConfigFile(config);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get Delivery Challan Template Config
router.get('/config/dc-template', (req, res) => {
    try {
        const config = readConfigFile();
        const { templates, activeTemplateId } = readDcTemplatesConfig(config);
        const active = templates.find((t) => t.id === activeTemplateId) || templates[0];
        res.json({
            ...DEFAULT_DC_TEMPLATE,
            ...(active?.config || {}),
            templateId: active?.id || 'tpl-default',
            templateName: active?.name || 'Default Template'
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// List all Delivery Challan templates
router.get('/config/dc-templates', (req, res) => {
    try {
        const config = readConfigFile();
        const { templates, activeTemplateId } = readDcTemplatesConfig(config);
        res.json({
            activeTemplateId,
            templates: templates.map((tpl) => ({
                id: tpl.id,
                name: tpl.name,
                config: { ...DEFAULT_DC_TEMPLATE, ...(tpl.config || {}) }
            }))
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update Delivery Challan Template Config
router.post('/config/dc-template', (req, res) => {
    try {
        const body = req.body || {};
        const config = readConfigFile();
        const { templates, activeTemplateId } = readDcTemplatesConfig(config);
        const safeTemplate = sanitizeDcTemplate(body);
        const requestedId = String(body.templateId || '').trim();
        const templateName = String(body.templateName || '').trim().slice(0, 80) || 'Untitled Template';

        let nextTemplates = [...templates];
        let nextActiveId = activeTemplateId;

        const existingIndex = requestedId
            ? nextTemplates.findIndex((t) => t.id === requestedId)
            : -1;

        if (existingIndex >= 0) {
            nextTemplates[existingIndex] = {
                ...nextTemplates[existingIndex],
                name: templateName,
                config: safeTemplate
            };
            nextActiveId = nextTemplates[existingIndex].id;
        } else {
            const newTemplateId = requestedId || createTemplateId();
            nextTemplates.push({
                id: newTemplateId,
                name: templateName,
                config: safeTemplate
            });
            nextActiveId = newTemplateId;
        }

        const persisted = persistDcTemplatesConfig(config, nextTemplates, nextActiveId);
        writeConfigFile(config);
        const active = persisted.templates.find((t) => t.id === persisted.activeTemplateId);

        // Broadcast socket event to ALL connected clients (HTTP and HTTPS)
        if (req.broadcastSocket) {
            req.broadcastSocket('template_update', { 
                templateId: active?.id,
                templateName: active?.name,
                timestamp: new Date()
            });
        } else if (io) {
            io.emit('template_update', { 
                templateId: active?.id,
                templateName: active?.name,
                timestamp: new Date()
            });
        }

        res.json({
            success: true,
            activeTemplateId: persisted.activeTemplateId,
            dcTemplate: { ...DEFAULT_DC_TEMPLATE, ...(active?.config || {}) },
            templateId: active?.id,
            templateName: active?.name,
            templates: persisted.templates.map((tpl) => ({
                id: tpl.id,
                name: tpl.name,
                config: { ...DEFAULT_DC_TEMPLATE, ...(tpl.config || {}) }
            }))
        });
    } catch (err) {
        const status = String(err.message || '').includes('Invalid') || String(err.message || '').includes('large') ? 400 : 500;
        res.status(status).json({ error: err.message });
    }
});

// Set active Delivery Challan template
router.post('/config/dc-template/select', (req, res) => {
    try {
        const templateId = String(req.body?.templateId || '').trim();
        if (!templateId) {
            return res.status(400).json({ error: 'templateId is required' });
        }

        const config = readConfigFile();
        const { templates } = readDcTemplatesConfig(config);
        const exists = templates.some((tpl) => tpl.id === templateId);
        if (!exists) {
            return res.status(404).json({ error: 'Template not found' });
        }

        const persisted = persistDcTemplatesConfig(config, templates, templateId);
        writeConfigFile(config);
        const active = persisted.templates.find((tpl) => tpl.id === persisted.activeTemplateId);

        // Broadcast socket event to ALL connected clients (HTTP and HTTPS)
        if (req.broadcastSocket) {
            req.broadcastSocket('template_update', { 
                templateId: active?.id,
                templateName: active?.name,
                timestamp: new Date()
            });
        } else if (io) {
            io.emit('template_update', { 
                templateId: active?.id,
                templateName: active?.name,
                timestamp: new Date()
            });
        }

        res.json({
            success: true,
            activeTemplateId: persisted.activeTemplateId,
            dcTemplate: { ...DEFAULT_DC_TEMPLATE, ...(active?.config || {}) },
            templateId: active?.id,
            templateName: active?.name
        });
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

// Download Backup
router.get('/backup/download/:filename', (req, res) => {
    const filename = req.params.filename;

    // Basic validation to prevent directory traversal
    if (!filename || !filename.endsWith('.json')) {
        return res.status(400).json({ error: 'Invalid filename' });
    }

    const path = require('path');
    const fs = require('fs');
    const backupDir = backupService.getBackupDir();
    const filePath = path.join(backupDir, filename);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Backup file not found' });
    }

    res.download(filePath, filename);
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

        res.json({ ip: lanIp || 'localhost', httpPort: HTTP_PORT, httpsPort: HTTPS_PORT });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Check whether installable APK is available on server
router.get('/apk-status', async (req, res) => {
    try {
        let lanIp = 'localhost';
        const interfaces = os.networkInterfaces();
        for (const addrs of Object.values(interfaces)) {
            for (const addr of addrs || []) {
                if (addr.family === 'IPv4' && !addr.internal) {
                    lanIp = addr.address;
                    break;
                }
            }
            if (lanIp !== 'localhost') break;
        }

        const apkState = ensureInstallApk();
        const resolvedPath = apkState.exists ? apkState.target : null;
        const exists = Boolean(resolvedPath);
        const stats = exists ? fs.statSync(resolvedPath) : null;
        const fileName = exists ? path.basename(resolvedPath) : 'LoomTrack.apk';
        const relativePath = `/pwa/${fileName}`;

        res.json({
            exists,
            fileName,
            relativePath,
            installUrl: `https://${lanIp}:${HTTPS_PORT}${relativePath}`,
            pwaUrl: `https://${lanIp}:${HTTPS_PORT}/pwa/index.html`,
            resolvedPath,
            checkedPaths: apkState.checkedPaths || [resolvedPath].filter(Boolean),
            restoredFrom: apkState.copied ? apkState.source : null,
            size: stats ? stats.size : 0,
            lastModified: stats ? stats.mtime : null
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get All Paired Scanners (with online/offline status)
router.get('/scanners', async (req, res) => {
    try {
        // DISABLE CACHING: Scanner list must always be fresh (real-time)
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');

        // Use lean() to get plain JS objects instead of Mongoose documents
        // Reduces memory by ~40% and speeds up JSON serialization
        const scanners = await Scanner.find()
            .select('uuid fingerprint name status pairedAt lastSeen repairCount currentEmployee')
            .sort({ pairedAt: -1 })
            .lean();

        // Threshold for "Online" is 30 seconds (matching frontend polling + batch interval)
        const NOW = new Date();
        const THRESHOLD_MS = 30 * 1000;

        res.json(scanners.map(s => {
            const lastSeenTime = s.lastSeen ? new Date(s.lastSeen).getTime() : 0;
            const isOnline = (NOW.getTime() - lastSeenTime) < THRESHOLD_MS;

            return {
                scannerId: s.uuid,
                fingerprint: s.fingerprint,
                name: s.name,
                status: isOnline ? 'ONLINE' : 'OFFLINE',
                pairedAt: s.pairedAt,
                lastSeen: s.lastSeen,
                repairCount: s.repairCount || 0,
                currentEmployee: s.currentEmployee || null
            };
        }));

        // Emit socket event for real-time scanner updates
        if (io) io.emit('scanners_list_updated', scanners.length);

    } catch (err) {
        console.error('❌ Error fetching scanners:', err);
        res.status(500).json({ error: err.message });
    }
});

// Issue short-lived pairing token for QR setup links
router.get('/pairing-token', (req, res) => {
    const workspaceCode = getWorkspaceCode(req.query?.workspaceCode);
    const token = issuePairingToken(workspaceCode);
    res.json({ token, workspaceCode, expiresIn: process.env.PAIRING_TOKEN_TTL || '10m' });
});

// Register a New Scanner (called when mobile app pairs)
router.post('/scanners', async (req, res) => {
    try {
        // DISABLE CACHING: Ensure immediate visibility
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');

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

        // Emit socket event for real-time updates
        if (io) io.emit('scanner_registered', { scannerId: scanner.uuid, name: scanner.name });

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
        // DISABLE CACHING: Ensure deleted scanner is never served from cache
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');

        const result = await Scanner.deleteOne({ uuid: req.params.scannerId });
        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'Scanner not found' });
        }

        // Emit socket event for real-time updates
        if (io) io.emit('scanner_deleted', { scannerId: req.params.scannerId });

        res.json({ success: true, message: 'Scanner removed' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// System Wipe
router.post('/system/wipe', async (req, res) => {
    try {
        const { password } = req.body;
        const systemPassword = process.env.SYSTEM_WIPE_PASSWORD || 'developmentkey95';

        if (password !== systemPassword) {
            return res.status(401).json({ error: 'Incorrect wipe password. Operation aborted.' });
        }

        console.log('⚠️ SYSTEM WIPE INITIATED');

        // Wipe all transactional and configuration data
        await Promise.all([
            Barcode.deleteMany({}),
            ClothRoll.deleteMany({}),
            Employee.deleteMany({}),
            Session.deleteMany({}),
            Scanner.deleteMany({}),
            MissedScan.deleteMany({}),
            Size.deleteMany({}),
            DeliveryChallan.deleteMany({}),
            Quotation.deleteMany({}),
            User.deleteMany({}),
            AuditLog.deleteMany({})
        ]);

        console.log('✅ SYSTEM WIPE COMPLETE');
        res.json({ success: true, message: 'All system data has been wiped successfully.' });
    } catch (err) {
        console.error('❌ SYSTEM WIPE FAILED:', err);
        res.status(500).json({ error: err.message });
    }
});

// --- INVENTORY MANAGEMENT (DASHBOARD) ---

// Update Roll Details
router.put('/inventory/update', async (req, res) => {
    try {
        const { barcode, metre, weight, percentage, pieces, pieceLengths, status, type } = req.body;
        const targetStatus = status || type;

        const clothRoll = await ClothRoll.findOne({ barcode });
        if (!clothRoll) {
            return res.status(404).json({ error: 'Roll not found in inventory' });
        }

        const normalizedPieces = normalizePieces(pieces ?? pieceLengths, metre);
        const totalMetre = totalFromPieces(normalizedPieces);

        clothRoll.metre = totalMetre;
        clothRoll.weight = weight;
        clothRoll.percentage = percentage;
        clothRoll.pieces = normalizedPieces;

        // Ensure status is valid before assignment
        if (targetStatus && ['IN', 'OUT'].includes(targetStatus)) {
            clothRoll.status = targetStatus;
        }

        // Log history - use valid status for enum or default to current
        clothRoll.transactionHistory.push({
            status: clothRoll.status,
            details: `Desktop Edit: ${totalMetre}m, ${weight}kg, ${percentage}%`,
            date: new Date()
        });

        await clothRoll.save();

        const barcodeDoc = await Barcode.findOne({ full_barcode: barcode });
        if (barcodeDoc) {
            const lifecycleStatus = clothRoll.status === 'IN' ? 'USED_IN_STOCK_IN' : 'USED_IN_DISPATCH';
            barcodeDoc.status = 'Used';
            barcodeDoc.lifecycleStatus = lifecycleStatus;
            barcodeDoc.lastPrintedAt = barcodeDoc.lastPrintedAt || new Date();
            barcodeDoc.lastPrintedBy = barcodeDoc.lastPrintedBy || 'Admin';
            barcodeDoc.lifecycleHistory = Array.isArray(barcodeDoc.lifecycleHistory) ? barcodeDoc.lifecycleHistory : [];
            barcodeDoc.lifecycleHistory.push({
                action: lifecycleStatus,
                note: `Inventory updated via desktop (${clothRoll.status})`,
                by: req.admin?.username || 'Admin',
                at: new Date()
            });
            await barcodeDoc.save();
        }

        await AuditLog.create({
            action: 'INVENTORY_EDIT',
            user: 'Admin',
            details: { barcode, metre: totalMetre, pieces: normalizedPieces, weight, percentage, status: clothRoll.status },
            ipAddress: req.ip
        });

        res.json({ success: true, data: clothRoll });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete Roll
// Mark Barcode as Damaged (Hide from Missing)
router.patch('/missing/damaged/:barcode', async (req, res) => {
    try {
        const { barcode } = req.params;
        const result = await MissedScan.findOneAndUpdate(
            { barcode },
            {
                status: 'DAMAGED',
                issueType: 'SEQUENCE_MISSING',
                resolutionAction: 'MARK_DAMAGED',
                resolutionNote: req.body?.note || 'Marked as damaged',
                resolvedAt: new Date(),
                resolvedBy: req.admin?.username || 'Admin'
            },
            { new: true }
        );

        if (!result) return res.status(404).json({ error: 'Barcode not found in missing list' });

        // Audit logging
        await AuditLog.create({
            action: 'MARK_DAMAGED',
            user: 'Admin',
            details: { barcode },
            ipAddress: req.ip
        });

        res.json({ success: true, message: 'Barcode marked as damaged and hidden.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/missing/audit-sequences', async (req, res) => {
    try {
        const summary = await detectMissingSequences({ triggeredBy: req.admin?.username || 'admin-audit' });

        await AuditLog.create({
            action: 'INVENTORY_EDIT',
            user: req.admin?.username || 'Admin',
            details: { action: 'SEQUENCE_AUDIT_RUN', ...summary },
            ipAddress: req.ip
        });

        res.json({ success: true, ...summary });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/missing/list', async (req, res) => {
    try {
        const { status = 'PENDING', limit = 100 } = req.query;
        const query = {};
        if (status) {
            query.status = status;
        }

        const items = await MissedScan.find(query)
            .sort({ detectedAt: -1, resolvedAt: -1 })
            .limit(Math.max(1, Math.min(Number(limit) || 100, 500)))
            .lean();

        res.json(items);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.patch('/missing/lost/:barcode', async (req, res) => {
    try {
        const { barcode } = req.params;
        const note = String(req.body?.note || 'Marked as lost').trim();

        const entry = await MissedScan.findOneAndUpdate(
            { barcode },
            {
                status: 'LOST',
                issueType: 'SEQUENCE_MISSING',
                resolutionAction: 'MARK_LOST',
                resolutionNote: note,
                resolvedAt: new Date(),
                resolvedBy: req.admin?.username || 'Admin'
            },
            { new: true }
        );

        if (!entry) return res.status(404).json({ error: 'Barcode not found in missing list' });

        await AuditLog.create({
            action: 'INVENTORY_EDIT',
            user: req.admin?.username || 'Admin',
            details: { action: 'MISSING_MARK_LOST', barcode, note },
            ipAddress: req.ip
        });

        res.json({ success: true, entry });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.patch('/missing/ignore/:barcode', async (req, res) => {
    try {
        const { barcode } = req.params;
        const note = String(req.body?.note || 'Ignored by admin').trim();

        const entry = await MissedScan.findOneAndUpdate(
            { barcode },
            {
                status: 'IGNORED',
                issueType: 'SEQUENCE_MISSING',
                resolutionAction: 'IGNORE',
                resolutionNote: note,
                resolvedAt: new Date(),
                resolvedBy: req.admin?.username || 'Admin'
            },
            { new: true }
        );

        if (!entry) return res.status(404).json({ error: 'Barcode not found in missing list' });

        await AuditLog.create({
            action: 'INVENTORY_EDIT',
            user: req.admin?.username || 'Admin',
            details: { action: 'MISSING_IGNORE', barcode, note },
            ipAddress: req.ip
        });

        res.json({ success: true, entry });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.patch('/missing/create-entry/:barcode', async (req, res) => {
    try {
        const { barcode } = req.params;
        const note = String(req.body?.note || 'Create entry action recorded').trim();

        const entry = await MissedScan.findOneAndUpdate(
            { barcode },
            {
                status: 'RESOLVED',
                issueType: 'SEQUENCE_MISSING',
                resolutionAction: 'CREATE_ENTRY',
                resolutionNote: note,
                resolvedAt: new Date(),
                resolvedBy: req.admin?.username || 'Admin'
            },
            { new: true }
        );

        if (!entry) return res.status(404).json({ error: 'Barcode not found in missing list' });

        await AuditLog.create({
            action: 'INVENTORY_EDIT',
            user: req.admin?.username || 'Admin',
            details: { action: 'MISSING_CREATE_ENTRY', barcode, note },
            ipAddress: req.ip
        });

        res.json({ success: true, entry });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/inventory/delete/:barcode', async (req, res) => {
    try {
        const { barcode } = req.params;

        const result = await ClothRoll.deleteOne({ barcode });

        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'Roll not found' });
        }

        // Check if this was a generated barcode
        const validBarcode = await Barcode.findOne({ full_barcode: barcode });

        if (validBarcode) {
            const barcodeDoc = await Barcode.findOne({ full_barcode: validBarcode.full_barcode });
            if (barcodeDoc) {
                barcodeDoc.lifecycleStatus = 'MISSING';
                barcodeDoc.lifecycleHistory = Array.isArray(barcodeDoc.lifecycleHistory) ? barcodeDoc.lifecycleHistory : [];
                barcodeDoc.lifecycleHistory.push({
                    action: 'MISSING',
                    note: 'Stock deleted and moved to missing',
                    by: req.user?.username || 'Admin',
                    at: new Date()
                });
                await barcodeDoc.save();
            }

            // Re-add to MissedScan as PENDING
            try {
                await MissedScan.create({
                    barcode: validBarcode.full_barcode,
                    year: validBarcode.year,
                    size: validBarcode.size,
                    sequence: validBarcode.sequence,
                    status: 'PENDING',
                    issueType: 'UNREGISTERED_ROLL',
                    detectedAt: new Date()
                });
            } catch (ignore) {
                // Ignore if already exists (shouldn't happen if logic is correct)
                console.log("Re-insert missing ignored:", ignore.message);
            }
        }

        // Audit Log
        await AuditLog.create({
            action: 'DELETE',
            user: 'Admin',
            details: { barcode },
            ipAddress: req.ip
        });

        res.json({ success: true, message: 'Stock Deleted and moved to Missing' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

    // Integrate Cloud Backup Routes
    if (cloudBackupManager) {
        cloudBackupRoutes(router, cloudBackupManager);
    }

    return router;
};
