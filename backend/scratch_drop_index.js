const mongoose = require('mongoose');

async function run() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/textile-stock-management');
        const DeliveryChallan = mongoose.model('DeliveryChallan', new mongoose.Schema({}, { strict: false }));
        try {
            await DeliveryChallan.collection.dropIndex('sourceBatchId_1');
            console.log('Index dropped successfully.');
        } catch(e) {
            console.log('Index drop error (might not exist):', e.message);
        }
    } catch(e) {
        console.error(e);
    } finally {
        mongoose.disconnect();
    }
}
run();
