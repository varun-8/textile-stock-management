const mongoose = require('mongoose');

async function fixIndexes() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/textile-stock-management');
        console.log('Connected to MongoDB');

        const collection = mongoose.connection.collection('sizes');

        // List Indexes
        const indexes = await collection.indexes();
        console.log('Current Indexes:', indexes);

        // Drop 'value_1' if it exists
        const valueIndex = indexes.find(idx => idx.name === 'value_1');
        if (valueIndex) {
            console.log("Dropping obsolete index 'value_1'...");
            await collection.dropIndex('value_1');
            console.log("Dropped 'value_1'.");
        } else {
            console.log("'value_1' index not found.");
        }

        // Mongoose will recreate necessary indexes on restart, but we can check code_1 too
        const codeIndex = indexes.find(idx => idx.name === 'code_1');
        if (!codeIndex) {
            console.log("Note: 'code_1' index might be missing, restarting the app should create it.");
        }

        console.log('Done.');
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

fixIndexes();
