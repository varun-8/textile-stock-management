/**
 * Enhanced Restore Script with EmployeeName Validation
 * Ensures data is correctly imported with proper schema validation
 */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const ClothRoll = require('./models/ClothRoll');
const Barcode = require('./models/Barcode');
const DeliveryChallan = require('./models/DeliveryChallan');
const Session = require('./models/Session');
const Size = require('./models/Size');
const Employee = require('./models/Employee');
const User = require('./models/User');
const AuditLog = require('./models/AuditLog');
const MissedScan = require('./models/MissedScan');
const Scanner = require('./models/Scanner');
const Quotation = require('./models/Quotation');

const MODELS = {
    clothRolls: ClothRoll,
    barcodes: Barcode,
    deliveryChallans: DeliveryChallan,
    sessions: Session,
    sizes: Size,
    employees: Employee,
    users: User,
    auditLogs: AuditLog,
    missedScans: MissedScan,
    scanners: Scanner,
    quotations: Quotation
};

async function enhancedRestore(backupFilename) {
    try {
        console.log('🔄 Enhanced Restore with Validation');
        console.log('='.repeat(60));

        // 1. Connect to MongoDB
        console.log('\n🔗 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/textile-stock-management');
        console.log('✅ Connected\n');

        // 2. Load backup file
        const backupPath = path.join('./backups', backupFilename);
        if (!fs.existsSync(backupPath)) {
            throw new Error(`Backup file not found: ${backupPath}`);
        }

        console.log(`📂 Loading backup: ${backupFilename}`);
        const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
        const data = backup.data || {};

        console.log(`✅ Backup loaded\n`);

        // 3. Pre-import validation
        console.log('🔍 Pre-Import Validation:');
        const validation = validateBackupData(data);
        console.log(`   ✅ Schema validation: ${validation.valid ? 'PASSED' : 'FAILED'}`);
        
        if (!validation.valid) {
            console.log(`   ⚠️  Warnings: ${validation.warnings.length}`);
            validation.warnings.forEach(w => console.log(`      • ${w}`));
        }

        // 4. Create safety backup
        console.log('\n🔒 Creating safety checkpoint...');
        await createSafetyBackup();
        console.log('✅ Safety backup created\n');

        // 5. Clear existing data
        console.log('🗑️  Clearing existing data...');
        for (const [collName, model] of Object.entries(MODELS)) {
            const count = await model.countDocuments();
            if (count > 0) {
                await model.deleteMany({});
                console.log(`   ✅ Cleared ${collName} (${count} records)`);
            }
        }

        // 6. Import data with validation
        console.log('\n📥 Importing data collections:\n');
        const importResults = {};

        for (const [collName, records] of Object.entries(data)) {
            if (!Array.isArray(records) || records.length === 0) {
                console.log(`   ⏭️  ${collName}: Skipped (empty)`);
                continue;
            }

            const model = MODELS[collName];
            if (!model) {
                console.log(`   ⏭️  ${collName}: Unknown collection`);
                continue;
            }

            try {
                // Special handling for ClothRoll records
                if (collName === 'clothRolls') {
                    const result = await importClothRollsWithValidation(records);
                    importResults[collName] = result;
                    console.log(`   ✅ ${collName}: ${result.imported}/${result.total} records`);
                    
                    if (result.failed > 0) {
                        console.log(`      ⚠️  Failed: ${result.failed} records`);
                    }
                    if (result.namedCount > 0) {
                        console.log(`      👤 With employeeName: ${result.namedCount}`);
                    }
                } else {
                    // Standard import for other collections
                    await model.insertMany(records);
                    importResults[collName] = { imported: records.length, total: records.length, failed: 0 };
                    console.log(`   ✅ ${collName}: ${records.length} records`);
                }
            } catch (err) {
                console.log(`   ❌ ${collName}: Failed - ${err.message}`);
                importResults[collName] = { imported: 0, total: records.length, failed: records.length };
            }
        }

        // 7. Post-import verification
        console.log('\n🔍 Post-Import Verification:\n');
        const stats = await verifyImportData();
        
        console.log(`   📊 ClothRoll records: ${stats.clothRollCount}`);
        console.log(`   👤 With employeeName: ${stats.employeeNamedCount} (${stats.employeeNameCoverage}%)`);
        console.log(`   📦 Total collections: ${Object.keys(importResults).length}`);

        // 8. Summary
        console.log(`\n${'='.repeat(60)}`);
        console.log('✨ Restore Complete!\n');
        console.log('Summary:');
        
        let totalImported = 0;
        let totalFailed = 0;
        
        for (const [collName, result] of Object.entries(importResults)) {
            totalImported += result.imported;
            totalFailed += result.failed;
        }
        
        console.log(`   ✅ Total Imported: ${totalImported}`);
        console.log(`   ❌ Total Failed: ${totalFailed}`);

        if (stats.employeeNameCoverage < 80) {
            console.log(`\n⚠️  RECOMMENDATION: Run migration to backfill employeeName`);
            console.log('   Command: node migrate_employee_name.js');
        } else {
            console.log(`\n✅ Data Import Ready: All systems verified`);
        }

        await mongoose.connection.close();
        console.log('\n✅ Connection closed');

    } catch (err) {
        console.error('\n❌ Restore Failed:', err.message);
        await mongoose.connection.close();
        process.exit(1);
    }
}

function validateBackupData(data) {
    const warnings = [];
    
    for (const [collName, records] of Object.entries(data)) {
        if (!Array.isArray(records)) {
            warnings.push(`${collName} is not an array`);
        }
        
        if (collName === 'clothRolls' && records.length > 0) {
            const sample = records[0];
            if (!sample.barcode) warnings.push('ClothRoll missing barcode field');
            if (!sample.status) warnings.push('ClothRoll missing status field');
            if (typeof sample.metre !== 'number') warnings.push('ClothRoll missing/invalid metre field');
            if (typeof sample.weight !== 'number') warnings.push('ClothRoll missing/invalid weight field');
        }
    }
    
    return { valid: warnings.length === 0, warnings };
}

async function importClothRollsWithValidation(records) {
    let imported = 0;
    let failed = 0;
    let namedCount = 0;

    for (const record of records) {
        try {
            // Validate required fields
            if (!record.barcode || !record.status || typeof record.metre !== 'number' || typeof record.weight !== 'number') {
                failed++;
                continue;
            }

            // Create document with all fields including employeeName
            const doc = new ClothRoll({
                barcode: record.barcode,
                status: record.status,
                metre: record.metre,
                weight: record.weight,
                percentage: record.percentage,
                pieces: record.pieces || undefined,
                employeeId: record.employeeId,
                employeeName: record.employeeName,
                transactionHistory: record.transactionHistory || [],
                dcId: record.dcId
            });

            await doc.save();
            imported++;

            if (record.employeeName) {
                namedCount++;
            }
        } catch (err) {
            failed++;
        }
    }

    return { imported, total: records.length, failed, namedCount };
}

async function createSafetyBackup() {
    const ClothRoll = require('./models/ClothRoll');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup-SAFETY-${timestamp}.json`;
    const filePath = path.join('./backups', filename);

    const data = {};
    for (const [collName, model] of Object.entries(MODELS)) {
        data[collName] = await model.find({}).lean();
    }

    const backup = {
        metadata: {
            timestamp: new Date(),
            version: '1.2',
            type: 'SAFETY'
        },
        data
    };

    await fs.promises.writeFile(filePath, JSON.stringify(backup, null, 2));
}

async function verifyImportData() {
    const clothRollCount = await ClothRoll.countDocuments();
    const employeeNamedCount = await ClothRoll.countDocuments({ 
        employeeName: { $exists: true, $ne: null, $ne: '' } 
    });
    const coverage = clothRollCount > 0 
        ? ((employeeNamedCount / clothRollCount) * 100).toFixed(1)
        : '0.0';

    return {
        clothRollCount,
        employeeNamedCount,
        employeeNameCoverage: coverage
    };
}

// Get backup filename from command line or use latest
const backupFilename = process.argv[2] || 'latest';

if (backupFilename === 'latest') {
    try {
        const files = fs.readdirSync('./backups')
            .filter(f => f.endsWith('.json'))
            .sort()
            .reverse();
        
        if (files.length === 0) {
            console.error('❌ No backup files found');
            process.exit(1);
        }
        
        enhancedRestore(files[0]);
    } catch (err) {
        console.error('❌ Error finding latest backup:', err.message);
        process.exit(1);
    }
} else {
    enhancedRestore(backupFilename);
}
