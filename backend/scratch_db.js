const mongoose = require('mongoose');

async function run() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/textile-stock-management');
        
        const Session = mongoose.model('Session', new mongoose.Schema({}, { strict: false }));
        const ClothRoll = mongoose.model('ClothRoll', new mongoose.Schema({}, { strict: false }));
        
        const sessions = await Session.find({ type: 'OUT' }).lean();
        console.log('OUT Sessions:');
        for (const s of sessions) {
            console.log(`- ${s._id} | Code: ${s.batchCode} | Status: ${s.status}`);
        }
        
        const reservedRolls = await ClothRoll.find({ status: 'RESERVED' }).lean();
        console.log('\nRESERVED Rolls:');
        for (const r of reservedRolls) {
            const dcId = r.dcId;
            const txs = (r.transactionHistory || []).map(tx => tx.sessionId);
            console.log(`- ${r.barcode} | dcId: ${dcId} | Tx Sessions: ${txs.join(', ')}`);
        }
        
    } catch(e) {
        console.error(e);
    } finally {
        mongoose.disconnect();
    }
}
run();
