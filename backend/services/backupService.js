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

const getConfigPath = () => path.join(__dirname, '../config.json');

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
    const fullPath = path.isAbsolute(backupPath) ? backupPath : path.join(__dirname, '..', backupPath);
    fs.ensureDirSync(fullPath);
    return fullPath;
};

const performBackup = async (type = 'AUTO') => {
    const backupDir = getBackupDir();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup-${type}-${timestamp}.json`;
    const filePath = path.join(backupDir, filename);

    console.log(`[Backup] Starting ${type} backup in ${backupDir}...`);

    try {
        const barcodes = await Barcode.find({});
        const clothRolls = await ClothRoll.find({});
        const auditLogs = await AuditLog.find({});
        const employees = await Employee.find({});
        const missedScans = await MissedScan.find({});
        const scanners = await Scanner.find({});
        const sessions = await Session.find({});
        const sizes = await Size.find({});
        const users = await User.find({});

        const backupData = {
            metadata: {
                timestamp: new Date(),
                version: '1.1',
                type
            },
            data: {
                barcodes,
                clothRolls,
                auditLogs,
                employees,
                missedScans,
                scanners,
                sessions,
                sizes,
                users
            }
        };

        await fs.writeJson(filePath, backupData, { spaces: 2 });
        console.log(`[Backup] Saved to ${filePath}`);

        // Log the success
        await AuditLog.create({
            action: 'BACKUP',
            details: { filename, type, size: barcodes.length + clothRolls.length },
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

        const restoreOps = [
            { model: Barcode, data: backup.data.barcodes },
            { model: ClothRoll, data: backup.data.clothRolls },
            { model: AuditLog, data: backup.data.auditLogs },
            { model: Employee, data: backup.data.employees },
            { model: MissedScan, data: backup.data.missedScans },
            { model: Scanner, data: backup.data.scanners },
            { model: Session, data: backup.data.sessions },
            { model: Size, data: backup.data.sizes },
            { model: User, data: backup.data.users }
        ];

        for (const op of restoreOps) {
            if (op.model) {
                await op.model.deleteMany({});
                if (op.data && op.data.length > 0) {
                    await op.model.insertMany(op.data);
                }
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
