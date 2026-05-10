const mongoose = require('mongoose');

async function fixCollectionNames() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect('mongodb://127.0.0.1:27017/textile-stock-management');
    
    const db = mongoose.connection.db;
    console.log('✅ Connected\n');
    console.log('📝 Fixing collection names (mixed-case → lowercase)...\n');
    
    const renames = [
      { from: 'clothRolls', to: 'clothrolls' },
      { from: 'deliveryChallans', to: 'deliverychallans' },
      { from: 'auditLogs', to: 'auditlogs' },
      { from: 'missedScans', to: 'missedscans' },
    ];
    
    for (const { from, to } of renames) {
      try {
        // Check if source collection exists
        const source = await db.listCollections({ name: from }).toArray();
        if (source.length === 0) {
          console.log(`⏭️  ${from} not found (skipped)`);
          continue;
        }
        
        // Check if target already exists and has data
        const target = await db.listCollections({ name: to }).toArray();
        if (target.length > 0) {
          const sourceCount = await db.collection(from).countDocuments();
          const targetCount = await db.collection(to).countDocuments();
          console.log(`⚠️  Both ${from} (${sourceCount} docs) and ${to} (${targetCount} docs) exist`);
          console.log(`   Merging ${sourceCount} docs from ${from} to ${to}...`);
          
          if (sourceCount > 0) {
            const docs = await db.collection(from).find({}).toArray();
            await db.collection(to).insertMany(docs);
            console.log(`   ✅ Merged ${sourceCount} documents`);
          }
          await db.collection(from).deleteMany({});
          await db.dropCollection(from);
          console.log(`   ✅ Dropped empty ${from}\n`);
        } else {
          // Simple rename
          await db.collection(from).rename(to);
          console.log(`✅ Renamed: ${from} → ${to}\n`);
        }
      } catch (err) {
        console.error(`❌ Error processing ${from}:`, err.message, '\n');
      }
    }
    
    // Verify final state
    console.log('📊 Final collection state:');
    const collections = await db.listCollections().toArray();
    for (const col of collections) {
      const count = await db.collection(col.name).countDocuments();
      if (count > 0) {
        console.log(`   ✅ ${col.name}: ${count} documents`);
      }
    }
    
    console.log('\n✨ Collection fix complete!');
    mongoose.connection.close();
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

fixCollectionNames();
