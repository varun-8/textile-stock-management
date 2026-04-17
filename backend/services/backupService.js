const cron = require('node-cron');
const fs = require('fs-extra');
const path = require('path');
const mongoose = require('mongoose');

// Import all models
const Barcode = require('../models/Barcode');
const ClothRoll = require('../models/ClothRoll');
const AuditLog = require('../models/AuditLog');
const Employee = require('../models/Employee');
const MissedScan = require('../models/MissedScan');
const Scanner = require('../models/Scanner');
const Session = require('../models/Session');
const Size = require('../models/Size');
const User = require('../models/User');
const DeliveryChallan = require('../models/DeliveryChallan');
const Quotation = require('../models/Quotation');
const { getConfigPath, getDefaultBackupDir, resolveBackupPath } = require('../utils/runtimePaths');

const BACKUP_MODEL_DEFS = [
    { key: 'barcodes', model: Barcode },
    { key: 'clothRolls', model: ClothRoll },
    { key: 'auditLogs', model: AuditLog },
    { key: 'employees', model: Employee },
    { key: 'missedScans', model: MissedScan },
    { key: 'scanners', model: Scanner },
    { key: 'sessions', model: Session },
    { key: 'sizes', model: Size },
    { key: 'users', model: User },
    { key: 'deliveryChallans', model: DeliveryChallan },
    { key: 'quotations', model: Quotation }
];

const getBackupDir = () => {
    let backupPath = getDefaultBackupDir();
    try {
        const configPath = getConfigPath();
        if (fs.existsSync(configPath)) {
            const config = fs.readJsonSync(configPath);
            if (config.backupPath) backupPath = config.backupPath;
        }
    } catch (err) {
        console.error('Error reading config:', err);
    }
    const configuredPath = resolveBackupPath(backupPath);

    try {
        fs.ensureDirSync(configuredPath);
        return configuredPath;
    } catch (err) {
        const fallbackPath = getDefaultBackupDir();
        try {
            fs.ensureDirSync(fallbackPath);
            console.warn(`[Backup] Backup path not writable (${configuredPath}). Using fallback: ${fallbackPath}`);
            return fallbackPath;
        } catch (fallbackErr) {
            console.error('[Backup] Unable to create configured or fallback backup directory.', fallbackErr);
            throw fallbackErr;
        }
    }
};

const performBackup = async (type = 'AUTO') => {
    const backupDir = getBackupDir();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup-${type}-${timestamp}.json`;
    const filePath = path.join(backupDir, filename);

    console.log(`[Backup] Starting ${type} backup in ${backupDir}...`);

    try {
        const configPath = getConfigPath();
        const configSnapshot = (await fs.pathExists(configPath))
            ? await fs.readJson(configPath)
            : null;

        const data = {};
        const licenseDir = path.join(__dirname, '../license-data');
        const licenseSnapshot = {};
        if (await fs.pathExists(licenseDir)) {
            const files = await fs.readdir(licenseDir);
            for (const file of files) {
                if (file.endsWith('.json')) {
                    const content = await fs.readJson(path.join(licenseDir, file)).catch(() => null);
                    if (content) licenseSnapshot[file] = content;
                }
            }
        }

        let totalDocs = 0;
        for (const def of BACKUP_MODEL_DEFS) {
            const docs = await def.model.find({}).lean();
            data[def.key] = docs;
            totalDocs += docs.length;
        }

        const backupData = {
            metadata: {
                timestamp: new Date(),
                version: '1.2',
                type
            },
            configSnapshot,
            licenseSnapshot,
            data
        };

        await fs.writeJson(filePath, backupData, { spaces: 2 });
        console.log(`[Backup] Saved to ${filePath}`);

        // Log the success
        await AuditLog.create({
            action: 'BACKUP',
            details: { filename, type, totalDocs },
            user: 'System'
        });

        // Cleanup old backups (Keep last 7 days)
        await cleanupOldBackups();

        // Trigger cloud backup asynchronously (non-blocking)
        // Upload will happen after CLOUD_BACKUP_INTERVAL_MINUTES delay
        if (global.cloudBackupManager && global.CLOUD_BACKUP_INTERVAL) {
            setTimeout(() => {
                global.cloudBackupManager.uploadBackupAsync(filePath)
                    .catch(err => console.log('[Cloud Backup] Upload failed:', err.message));
            }, global.CLOUD_BACKUP_INTERVAL);
        }

        return { success: true, filename };
    } catch (err) {
        console.error('[Backup] Failed:', err);
        return { success: false, error: err.message };
    }
};

const cleanupOldBackups = async () => {
    try {
        const backupDir = getBackupDir();
        const files = await fs.readdir(backupDir);
        const now = Date.now();
        const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

        for (const file of files) {
            const filePath = path.join(backupDir, file);
            const stats = await fs.stat(filePath);
            if (now - stats.mtimeMs > SEVEN_DAYS) {
                await fs.remove(filePath);
                console.log(`[Backup] Deleted old backup: ${file}`);
            }
        }
    } catch (err) {
        console.error('[Backup] Cleanup failed:', err);
    }
};

const restoreBackup = async (filename) => {
    const backupDir = getBackupDir();
    const filePath = path.join(backupDir, filename);
    if (!fs.existsSync(filePath)) {
        throw new Error('Backup file not found');
    }

    try {
        console.log(`[Restore] Restoring from ${filename}...`);
        const backup = await fs.readJson(filePath);
        const backupData = backup?.data || {};

        const legacyMap = {
            barcodes: backupData.barcodes,
            clothRolls: backupData.clothRolls,
            auditLogs: backupData.auditLogs,
            employees: backupData.employees,
            missedScans: backupData.missedScans,
            scanners: backupData.scanners,
            sessions: backupData.sessions,
            sizes: backupData.sizes,
            users: backupData.users,
            deliveryChallans: backupData.deliveryChallans,
            quotations: backupData.quotations
        };

        for (const def of BACKUP_MODEL_DEFS) {
            const rows = Array.isArray(legacyMap[def.key]) ? legacyMap[def.key] : [];
            await def.model.deleteMany({});
            if (rows.length > 0) {
                await def.model.insertMany(rows);
            }
        }

        if (backup.configSnapshot && typeof backup.configSnapshot === 'object') {
            await fs.writeJson(getConfigPath(), backup.configSnapshot, { spaces: 2 });
        }

        if (backup.licenseSnapshot && typeof backup.licenseSnapshot === 'object') {
            const licenseDir = path.join(__dirname, '../license-data');
            await fs.ensureDir(licenseDir);
            for (const [file, content] of Object.entries(backup.licenseSnapshot)) {
                await fs.writeJson(path.join(licenseDir, file), content, { spaces: 2 });
            }
        }

        console.log('[Restore] Complete');

        await AuditLog.create({
            action: 'RESTORE',
            details: { filename },
            user: 'Admin'
        });

        return { success: true };
    } catch (err) {
        console.error('[Restore] Failed:', err);
        throw err;
    }
};

// Schedule Daily Backup - First Boot in Morning, then at 6:00 AM
const scheduleBackup = () => {
    const lastBackupFile = path.join(getBackupDir(), '.lastBackupDate');
    
    // Check if backup was already done today on startup
    const checkAndBackupOnBoot = async () => {
        try {
            const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
            
            // Read last backup date
            let lastBackupDate = null;
            try {
                if (fs.existsSync(lastBackupFile)) {
                    lastBackupDate = fs.readFileSync(lastBackupFile, 'utf8').trim();
                }
            } catch (err) {
                console.log('[Backup] No last backup date found');
            }
            
            // If backup wasn't done today, do it now
            if (lastBackupDate !== today) {
                console.log('[Scheduler] First boot detected - executing backup now...');
                await performBackup('BOOT');
                fs.writeFileSync(lastBackupFile, today);
            } else {
                console.log('[Scheduler] Backup already done today at boot');
            }
        } catch (err) {
            console.error('[Scheduler] Error during boot backup check:', err.message);
        }
    };
    
    // Check on startup
    console.log('[Scheduler] Checking for pending backups...');
    checkAndBackupOnBoot();
    
    // Schedule daily backup at 6:00 AM
    cron.schedule('0 6 * * *', () => {
        console.log('[Scheduler] 6:00 AM backup triggered');
        performBackup('AUTO');
        try {
            const today = new Date().toISOString().split('T')[0];
            fs.writeFileSync(lastBackupFile, today);
        } catch (err) {
            console.error('[Scheduler] Error updating backup date:', err.message);
        }
    });
    
    console.log('[Scheduler] Daily backup scheduled for 6:00 AM (and on first morning boot)');
};

// Initialize scheduler
scheduleBackup();

module.exports = {
    performBackup,
    restoreBackup,
    listBackups: async () => fs.readdir(getBackupDir()),
    getBackupDir
};
