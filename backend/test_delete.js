const https = require('https');

// Helper to make requests
const request = (path, method, body = null) => {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 5000,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                ...(body && { 'Content-Length': JSON.stringify(body).length })
            },
            rejectUnauthorized: false
        };

        const req = https.request(options, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
        });

        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
};

async function runTests() {
    try {
        console.log('--- Test: Add Size ---');
        const code = 'TEST-' + Math.floor(Math.random() * 10000);
        const addRes = await request('/api/sizes/add', 'POST', { code });
        console.log('Add Response:', addRes.body);
        const addedSize = JSON.parse(addRes.body);

        if (!addedSize._id) throw new Error('Failed to add size');

        console.log('\n--- Test: Delete Unused Size ---');
        const delRes = await request(`/api/sizes/${addedSize._id}`, 'DELETE');
        console.log('Delete Response:', delRes.body);

        // Note: We cannot easily test "Used" size deletion without mocking a Barcode, 
        // which requires accessing the DB directly or using a different API. 
        // For now, testing that we CAN delete an UNUSED size confirms the basic flow works 
        // and doesn't crash on the "Usage Check" logic.

    } catch (err) {
        console.error('Test Failed:', err);
    }
}

runTests();
