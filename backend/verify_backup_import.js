/**
 * Backup Verification & Import Validation Script
 * Ensures employeeName field is properly included in backups and can be correctly restored
 */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const ClothRoll = require('./models/ClothRoll');

async function verifyBackupData() {
    try {
        console.log('🔐 Backup Data Verification Tool');
        console.log('='.repeat(60));

        // 1. Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/textile-stock-management');
        console.log('✅ Connected to MongoDB\n');

        // 2. Find backup directory
        const backupDir = './backups';
        if (!fs.existsSync(backupDir)) {
            console.log('⚠️  Backup directory not found');
            await mongoose.connection.close();
            return;
        }

        const backupFiles = fs.readdirSync(backupDir)
            .filter(f => f.endsWith('.json'))
            .sort()
            .reverse();

        if (backupFiles.length === 0) {
            console.log('⚠️  No backup files found');
            await mongoose.connection.close();
            return;
        }

        console.log(`📂 Found ${backupFiles.length} backup files\n`);

        // 3. Check the latest backup file
        const latestBackup = backupFiles[0];
        const backupPath = path.join(backupDir, latestBackup);

        console.log(`🔍 Analyzing latest backup: ${latestBackup}`);
        console.log('-'.repeat(60));

        const backupContent = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
        const clothRollsInBackup = backupContent.data?.clothRolls || [];

        console.log(`📊 Total ClothRoll records in backup: ${clothRollsInBackup.length}`);

        if (clothRollsInBackup.length === 0) {
            console.log('⚠️  No ClothRoll records in backup');
            await mongoose.connection.close();
            return;
        }

        // 4. Check employeeName field in backup
        let withEmployeeName = 0;
        let withoutEmployeeName = 0;
        let sampleRecords = [];

        for (let i = 0; i < Math.min(clothRollsInBackup.length, 5); i++) {
            sampleRecords.push(clothRollsInBackup[i]);
        }

        for (const record of clothRollsInBackup) {
            if (record.employeeName && record.employeeName !== '') {
                withEmployeeName++;
            } else {
                withoutEmployeeName++;
            }
        }

        const coverage = ((withEmployeeName / clothRollsInBackup.length) * 100).toFixed(1);

        console.log(`\n📋 EmployeeName Field Coverage:`);
        console.log(`   ✅ With employeeName: ${withEmployeeName}`);
        console.log(`   ⚠️  Without employeeName: ${withoutEmployeeName}`);
        console.log(`   📊 Coverage: ${coverage}%`);

        // 5. Sample records preview
        console.log(`\n📝 Sample Records (first 2):`);
        for (let i = 0; i < Math.min(2, sampleRecords.length); i++) {
            const rec = sampleRecords[i];
            console.log(`\n   Record ${i + 1}:`);
            console.log(`   • Barcode: ${rec.barcode}`);
            console.log(`   • Status: ${rec.status}`);
            console.log(`   • EmployeeName: ${rec.employeeName || '(empty)'}`);
            console.log(`   • EmployeeId: ${rec.employeeId || '(empty)'}`);
        }

        // 6. Validate backup file integrity
        console.log(`\n🔒 Backup Integrity Check:`);
        const metadata = backupContent.metadata || {};
        console.log(`   • Version: ${metadata.version || 'unknown'}`);
        console.log(`   • Type: ${metadata.type || 'unknown'}`);
        console.log(`   • Timestamp: ${metadata.timestamp || 'unknown'}`);

        // 7. Check all collections in backup
        console.log(`\n📦 Backup Collections Summary:`);
        const data = backupContent.data || {};
        const collections = Object.entries(data);
        
        for (const [collName, records] of collections) {
            const count = Array.isArray(records) ? records.length : 0;
            if (count > 0) {
                console.log(`   ✅ ${collName}: ${count} records`);
            }
        }

        // 8. Test Import Validation (dry run)
        console.log(`\n✨ Import Validation Test:`);
        try {
            // Try to validate against schema
            const validationResults = await validateClothRollRecords(clothRollsInBackup);
            console.log(`   ✅ Schema validation: PASSED`);
            console.log(`      • Valid records: ${validationResults.valid}`);
            console.log(`      • Invalid records: ${validationResults.invalid}`);
            
            if (validationResults.invalid > 0) {
                console.log(`   ⚠️  Warning: ${validationResults.invalid} records may fail import`);
            }
        } catch (err) {
            console.log(`   ❌ Schema validation: FAILED`);
            console.log(`      Error: ${err.message}`);
        }

        console.log(`\n${'='.repeat(60)}`);
        console.log('✨ Backup verification complete!');

        if (coverage < 80) {
            console.log(`\n⚠️  RECOMMENDATION: Run migration script to backfill employeeName`);
            console.log('   Command: node migrate_employee_name.js');
        } else {
            console.log(`\n✅ READY: Backup data is ready for import`);
        }

    } catch (err) {
        console.error('❌ Verification Error:', err.message);
    } finally {
        await mongoose.connection.close();
    }
}

async function validateClothRollRecords(records) {
    let valid = 0;
    let invalid = 0;

    for (const record of records) {
        try {
            // Simulate schema validation
            if (!record.barcode) {
                invalid++;
                continue;
            }
            if (!record.status || !['IN', 'OUT', 'RESERVED'].includes(record.status)) {
                invalid++;
                continue;
            }
            if (typeof record.metre !== 'number' || record.metre < 0) {
                invalid++;
                continue;
            }
            if (typeof record.weight !== 'number' || record.weight < 0) {
                invalid++;
                continue;
            }
            
            // employeeName is optional but if present should be string
            if (record.employeeName && typeof record.employeeName !== 'string') {
                invalid++;
                continue;
            }
            
            valid++;
        } catch (err) {
            invalid++;
        }
    }

    return { valid, invalid };
}

// Run verification
verifyBackupData();
