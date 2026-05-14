/**
 * Migration Script: Populate employeeName field from transactionHistory
 * This ensures data consistency and backup integrity for the new employeeName field
 * Run once to backfill existing records
 */

const mongoose = require('mongoose');
require('dotenv').config();

const ClothRoll = require('./models/ClothRoll');

async function migrateEmployeeName() {
    try {
        console.log('🔄 Starting employeeName migration...');
        console.log(`📦 Connecting to MongoDB: ${process.env.MONGO_URI}`);

        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        console.log('✅ Connected to MongoDB');

        // 1. Count total records
        const totalRecords = await ClothRoll.countDocuments({});
        console.log(`📊 Total ClothRoll records: ${totalRecords}`);

        // 2. Count records with employeeName already set
        const recordsWithName = await ClothRoll.countDocuments({ employeeName: { $exists: true, $ne: null, $ne: '' } });
        console.log(`✅ Records with employeeName: ${recordsWithName}`);

        // 3. Find records WITHOUT employeeName
        const recordsToMigrate = await ClothRoll.countDocuments({
            $or: [
                { employeeName: { $exists: false } },
                { employeeName: null },
                { employeeName: '' }
            ]
        });
        console.log(`⚠️  Records to migrate: ${recordsToMigrate}`);

        if (recordsToMigrate === 0) {
            console.log('✨ All records already have employeeName populated!');
            await mongoose.connection.close();
            return;
        }

        // 4. Migrate records by extracting employeeName from transactionHistory
        const recordsToUpdate = await ClothRoll.find({
            $or: [
                { employeeName: { $exists: false } },
                { employeeName: null },
                { employeeName: '' }
            ]
        }).select('_id barcode transactionHistory employeeName status');

        console.log(`\n📝 Processing ${recordsToUpdate.length} records...\n`);

        let updated = 0;
        let skipped = 0;

        for (const record of recordsToUpdate) {
            let employeeName = null;

            // Try to get latest employeeName from transactionHistory
            if (record.transactionHistory && record.transactionHistory.length > 0) {
                // Find the most recent transaction with employeeName
                for (let i = record.transactionHistory.length - 1; i >= 0; i--) {
                    if (record.transactionHistory[i].employeeName) {
                        employeeName = record.transactionHistory[i].employeeName;
                        break;
                    }
                }
            }

            if (employeeName) {
                await ClothRoll.updateOne(
                    { _id: record._id },
                    { $set: { employeeName } }
                );
                updated++;

                if (updated % 100 === 0) {
                    console.log(`✅ Updated ${updated}/${recordsToUpdate.length} records...`);
                }
            } else {
                // If no employeeName found in history, set to 'Unknown'
                await ClothRoll.updateOne(
                    { _id: record._id },
                    { $set: { employeeName: 'Unknown' } }
                );
                skipped++;
            }
        }

        console.log(`\n✨ Migration Complete!`);
        console.log(`   ✅ Updated: ${updated}`);
        console.log(`   ⚠️  Set to 'Unknown': ${skipped}`);
        console.log(`   📊 Total migrated: ${updated + skipped}/${recordsToUpdate.length}`);

        // 5. Verify results
        const finalCount = await ClothRoll.countDocuments({ employeeName: { $exists: true, $ne: null, $ne: '' } });
        console.log(`\n🔍 Final verification: ${finalCount}/${totalRecords} records have employeeName`);

        if (finalCount === totalRecords) {
            console.log('✅ Data integrity confirmed - All records properly backed up!');
        } else {
            console.log(`⚠️  Warning: ${totalRecords - finalCount} records still missing employeeName`);
        }

        await mongoose.connection.close();
        console.log('🔐 Connection closed');

    } catch (err) {
        console.error('❌ Migration Error:', err.message);
        process.exit(1);
    }
}

// Run migration
migrateEmployeeName();
