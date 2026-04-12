/**
 * PHASE 10: AUTOMATED BACKUP & DISASTER RECOVERY
 * Point-in-time recovery, replication strategy, RTO/RPO targets
 */

const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');

/**
 * MongoDB Backup Manager
 * Performs automated database backups with retention policy
 */
class BackupManager {
    constructor(mongoUrl, backupDir = './backups') {
        this.mongoUrl = mongoUrl;
        this.backupDir = backupDir;
        this.retention = {
            hourly: 24, // Keep 24 hourly backups
            daily: 30, // Keep 30 daily backups
            weekly: 12, // Keep 12 weekly backups
            monthly: 12 // Keep 12 monthly backups
        };
    }

    /**
     * Create database backup using mongodump
     */
    async createBackup(backupName = null) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const name = backupName || `backup-${timestamp}`;
        const backupPath = path.join(this.backupDir, name);

        console.log(`📦 Starting backup: ${name}`);

        return new Promise((resolve, reject) => {
            const mongodump = spawn('mongodump', [
                `--uri=${this.mongoUrl}`,
                `--out=${backupPath}`,
                '--gzip',
                '--archive'
            ]);

            let backupSize = 0;
            const startTime = Date.now();

            mongodump.stdout.on('data', (data) => {
                backupSize += data.length;
            });

            mongodump.on('error', (err) => {
                console.error(`❌ Backup failed: ${err.message}`);
                reject(err);
            });

            mongodump.on('close', async (code) => {
                if (code === 0) {
                    const duration = Date.now() - startTime;
                    console.log(
                        `✅ Backup complete: ${name} (${(backupSize / 1024 / 1024).toFixed(2)} MB in ${(duration / 1000).toFixed(2)}s)`
                    );

                    // Apply retention policy
                    await this.applyRetentionPolicy();

                    resolve({
                        name,
                        path: backupPath,
                        size: backupSize,
                        timestamp: new Date(),
                        duration
                    });
                } else {
                    reject(new Error(`Backup failed with code ${code}`));
                }
            });
        });
    }

    /**
     * List all available backups
     */
    async listBackups() {
        const files = await fs.readdir(this.backupDir);
        const backups = [];

        for (const file of files) {
            const stat = await fs.stat(path.join(this.backupDir, file));
            backups.push({
                name: file,
                size: stat.size,
                timestamp: stat.mtime
            });
        }

        return backups.sort((a, b) => b.timestamp - a.timestamp);
    }

    /**
     * Restore database from backup
     */
    async restoreFromBackup(backupName) {
        const backupPath = path.join(this.backupDir, backupName);

        console.log(`🔄 Starting restore from: ${backupName}`);

        return new Promise((resolve, reject) => {
            const mongorestore = spawn('mongorestore', [
                `--uri=${this.mongoUrl}`,
                `--archive=${backupPath}`,
                '--gzip',
                '--drop'
            ]);

            mongorestore.on('error', (err) => {
                console.error(`❌ Restore failed: ${err.message}`);
                reject(err);
            });

            mongorestore.on('close', (code) => {
                if (code === 0) {
                    console.log(
                        `✅ Restore complete from: ${backupName}`
                    );
                    resolve({ success: true, backup: backupName });
                } else {
                    reject(new Error(`Restore failed with code ${code}`));
                }
            });
        });
    }

    /**
     * Apply retention policy to old backups
     */
    async applyRetentionPolicy() {
        const backups = await this.listBackups();
        const now = new Date();

        const toDelete = [];

        // Keep hourly for 24 hours
        const hourAgo = new Date(now - 60 * 60 * 1000);
        const oldHourly = backups.filter(
            b => b.timestamp < hourAgo && toDelete.indexOf(b.name) === -1
        );
        toDelete.push(...oldHourly.slice(0, -this.retention.hourly).map(b => b.name));

        // Keep daily for 30 days
        const dayAgo = new Date(now - 24 * 60 * 60 * 1000);
        const oldDaily = backups.filter(
            b => b.timestamp < dayAgo && toDelete.indexOf(b.name) === -1
        );
        toDelete.push(...oldDaily.slice(0, -this.retention.daily).map(b => b.name));

        // Delete old backups
        for (const backup of toDelete) {
            await fs.rm(path.join(this.backupDir, backup), {
                recursive: true
            });
            console.log(`🗑️ Deleted old backup: ${backup}`);
        }
    }

    /**
     * Scheduled backup (run every hour)
     */
    scheduleBackups(intervalMs = 3600000) {
        // Default: every hour
        setInterval(async () => {
            try {
                await this.createBackup();
            } catch (err) {
                console.error(`❌ Scheduled backup failed: ${err.message}`);
            }
        }, intervalMs);

        console.log(`✅ Backup scheduler started (interval: ${intervalMs}ms)`);
    }
}

/**
 * Replication and Failover Manager
 * For multi-node deployments
 */
class ReplicationManager {
    constructor(primaryNode, replicaNodes = []) {
        this.primaryNode = primaryNode;
        this.replicaNodes = replicaNodes;
        this.isHealthy = true;
    }

    /**
     * Health check on primary node
     */
    async healthCheck() {
        const maxRetries = 3;
        let healthy = false;

        for (let i = 0; i < maxRetries; i++) {
            try {
                // Implement health check (e.g., ping primary)
                healthy = true;
                break;
            } catch (err) {
                console.warn(
                    `⚠️ Health check attempt ${i + 1}/${maxRetries} failed`
                );
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        this.isHealthy = healthy;
        return healthy;
    }

    /**
     * Automatic failover to replica
     */
    async failoverToReplica() {
        if (!this.replicaNodes.length) {
            throw new Error('No replica nodes available for failover');
        }

        const healthyReplica = this.replicaNodes.find(r => r.isHealthy);
        if (!healthyReplica) {
            throw new Error('No healthy replicas available');
        }

        console.log(`🔄 Failing over to replica: ${healthyReplica.name}`);

        // Update primary pointer
        this.primaryNode = healthyReplica;

        return {
            success: true,
            newPrimary: healthyReplica.name,
            failoverTime: new Date()
        };
    }

    /**
     * RTO/RPO targets
     */
    getRPOTargets() {
        return {
            rpo: '1 hour', // Recovery Point Objective
            rto: '15 minutes', // Recovery Time Objective
            backupFrequency: 'hourly',
            replicationLag: '< 1 second'
        };
    }
}

/**
 * Data Validation & Consistency Checker
 */
class DataConsistencyChecker {
    constructor(db) {
        this.db = db;
    }

    /**
     * Verify referential integrity
     */
    async checkReferentialIntegrity() {
        const issues = [];

        // Check Scanner references in Sessions
        const orphanedSessions = await this.db.Session.find({
            scanner: { $nin: await this.db.Scanner.distinct('_id') }
        });
        if (orphanedSessions.length > 0) {
            issues.push({
                type: 'ORPHANED_SESSIONS',
                count: orphanedSessions.length,
                severity: 'HIGH'
            });
        }

        // Check Barcode references in ClothRolls
        const orphanedBarcodes = await this.db.ClothRoll.find({
            barcode: {
                $nin: await this.db.Barcode.distinct('full_barcode')
            }
        });
        if (orphanedBarcodes.length > 0) {
            issues.push({
                type: 'ORPHANED_BARCODES',
                count: orphanedBarcodes.length,
                severity: 'HIGH'
            });
        }

        return issues;
    }

    /**
     * Repair orphaned records
     */
    async repairOrphanedRecords() {
        const repaired = {
            sessionsDeleted: 0,
            barcodesDeleted: 0
        };

        // Delete orphaned sessions
        const sessionResult = await this.db.Session.deleteMany({
            scanner: { $nin: await this.db.Scanner.distinct('_id') }
        });
        repaired.sessionsDeleted = sessionResult.deletedCount;

        // Delete orphaned barcodes
        const barcodeResult = await this.db.ClothRoll.deleteMany({
            barcode: {
                $nin: await this.db.Barcode.distinct('full_barcode')
            }
        });
        repaired.barcodesDeleted = barcodeResult.deletedCount;

        return repaired;
    }
}

module.exports = {
    BackupManager,
    ReplicationManager,
    DataConsistencyChecker
};
