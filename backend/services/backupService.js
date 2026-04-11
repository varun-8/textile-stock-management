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

const getConfigPath = () => path.join(__dirname, '../config.json');

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
    let backupPath = './backups';
    try {
        const configPath = getConfigPath();
        if (fs.existsSync(configPath)) {
            const config = fs.readJsonSync(configPath);
            if (config.backupPath) backupPath = config.backupPath;
        }
    } catch (err) {
        console.error('Error reading config:', err);
    }
    const configuredPath = path.isAbsolute(backupPath) ? backupPath : path.join(__dirname, '..', backupPath);

    try {
        fs.ensureDirSync(configuredPath);
        return configuredPath;
    } catch (err) {
        const fallbackPath = path.join(__dirname, '..', 'backups');
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

// Schedule Daily Backup at 23:00 (11 PM)
cron.schedule('0 23 * * *', () => {
    performBackup('AUTO');
});

console.log('[Scheduler] Daily backup scheduled for 23:00');

module.exports = {
    performBackup,
    restoreBackup,
    listBackups: async () => fs.readdir(getBackupDir()),
    getBackupDir
};
