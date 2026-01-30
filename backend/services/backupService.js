const cron = require('node-cron');
const fs = require('fs-extra');
const path = require('path');
const mongoose = require('mongoose');
const Barcode = require('../models/Barcode');
const ClothRoll = require('../models/ClothRoll');
const AuditLog = require('../models/AuditLog');

const BACKUP_DIR = path.join(__dirname, '../backups');

// Ensure backup dir exists
fs.ensureDirSync(BACKUP_DIR);

const performBackup = async (type = 'AUTO') => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup-${type}-${timestamp}.json`;
    const filePath = path.join(BACKUP_DIR, filename);

    console.log(`[Backup] Starting ${type} backup...`);

    try {
        const barcodes = await Barcode.find({});
        const clothRolls = await ClothRoll.find({});
        const auditLogs = await AuditLog.find({});

        const backupData = {
            metadata: {
                timestamp: new Date(),
                version: '1.0',
                type
            },
            data: {
                barcodes,
                clothRolls,
                auditLogs
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
        const files = await fs.readdir(BACKUP_DIR);
        const now = Date.now();
        const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

        for (const file of files) {
            const filePath = path.join(BACKUP_DIR, file);
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
    const filePath = path.join(BACKUP_DIR, filename);
    if (!fs.existsSync(filePath)) {
        throw new Error('Backup file not found');
    }

    try {
        console.log(`[Restore] Restoring from ${filename}...`);
        const backup = await fs.readJson(filePath);

        // Clear current data (DANGEROUS - Handle with care)
        // ideally transaction, but for this file-based restore we just wipe and insert
        await Barcode.deleteMany({});
        await ClothRoll.deleteMany({});
        await AuditLog.deleteMany({});

        if (backup.data.barcodes.length) await Barcode.insertMany(backup.data.barcodes);
        if (backup.data.clothRolls.length) await ClothRoll.insertMany(backup.data.clothRolls);
        if (backup.data.auditLogs.length) await AuditLog.insertMany(backup.data.auditLogs);

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

module.exports = { performBackup, restoreBackup, listBackups: async () => fs.readdir(BACKUP_DIR) };
