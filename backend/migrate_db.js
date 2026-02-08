const mongoose = require('mongoose');

async function migrate() {
    console.log('Starting Migration...');
    const sourceURI = 'mongodb://127.0.0.1:27017/test';
    const targetURI = 'mongodb://127.0.0.1:27017/textile-stock-management';

    let srcConn, tgtConn;

    try {
        srcConn = await mongoose.createConnection(sourceURI).asPromise();
        console.log('Connected to Source (test)');

        tgtConn = await mongoose.createConnection(targetURI).asPromise();
        console.log('Connected to Target (textile-stock-management)');

        const collections = ['users', 'barcodes', 'clothrolls', 'scanners', 'sizes', 'auditlogs', 'missedscans'];

        for (const colName of collections) {
            const srcCol = srcConn.collection(colName);
            const tgtCol = tgtConn.collection(colName);

            const count = await srcCol.countDocuments();
            if (count === 0) {
                console.log(`Checking ${colName}: Empty in source, skipping.`);
                continue;
            }

            console.log(`Migrating ${colName} (${count} docs)...`);
            const docs = await srcCol.find().toArray();

            // Insert into target. Use try/catch for dup key errors if re-running
            try {
                if (docs.length > 0) {
                    // Check if target is empty to avoid duplicates
                    const targetCount = await tgtCol.countDocuments();
                    if (targetCount === 0) {
                        await tgtCol.insertMany(docs);
                        console.log(`  -> Copied ${docs.length} docs.`);
                    } else {
                        console.log(`  -> Target ${colName} not empty (${targetCount}), skipping to avoid duplicates.`);
                        // Optional: Upsert? No, safer to skip for now.
                    }
                }
            } catch (err) {
                console.error(`  -> Error copying ${colName}:`, err.message);
            }
        }

        console.log('Migration Complete.');

    } catch (err) {
        console.error('Migration Failed:', err);
    } finally {
        if (srcConn) await srcConn.close();
        if (tgtConn) await tgtConn.close();
    }
}

migrate();
