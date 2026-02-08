const mongoose = require('mongoose');

async function checkDBs() {
    try {
        // Check 'textile-stock-management'
        const conn1 = await mongoose.createConnection('mongodb://127.0.0.1:27017/textile-stock-management').asPromise();
        const count1 = await conn1.collection('barcodes').countDocuments();
        const userCount1 = await conn1.collection('users').countDocuments();
        console.log(`DB 'textile-stock-management': Barcodes=${count1}, Users=${userCount1}`);
        await conn1.close();

        // Check 'test'
        const conn2 = await mongoose.createConnection('mongodb://127.0.0.1:27017/test').asPromise();
        const count2 = await conn2.collection('barcodes').countDocuments();
        const userCount2 = await conn2.collection('users').countDocuments();
        console.log(`DB 'test': Barcodes=${count2}, Users=${userCount2}`);
        await conn2.close();

    } catch (err) {
        console.error(err);
    }
}

checkDBs();
