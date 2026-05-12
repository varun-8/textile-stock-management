const mongoose = require('mongoose');

async function run() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/textile-stock-management');
        const Session = mongoose.model('Session', new mongoose.Schema({}, { strict: false }));
        const ClothRoll = mongoose.model('ClothRoll', new mongoose.Schema({}, { strict: false }));
        
        const outBatches = await Session.find({ 
            status: 'COMPLETED',
            type: 'OUT'
        }).sort({ createdAt: -1 }).lean();
        
        console.log(`Found ${outBatches.length} COMPLETED OUT batches.`);

        const batchesWithRolls = await Promise.all(outBatches.map(async (batch) => {
            const rolls = await ClothRoll.find({
                'transactionHistory.sessionId': batch._id,
                status: 'RESERVED',
                $or: [
                    { dcId: { $exists: false } },
                    { dcId: null }
                ]
            }).lean();
            
            return {
                batchId: batch._id,
                rollCount: rolls.length
            };
        }));
        
        console.log(batchesWithRolls);

    } catch(e) {
        console.error(e);
    } finally {
        mongoose.disconnect();
    }
}
run();
