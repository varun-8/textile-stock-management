const https = require('https');
const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/license/status',
    method: 'GET',
    rejectUnauthorized: false
};
const req = https.request(options, res => {
    console.log(`StatusCode: ${res.statusCode}`);
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => console.log('Body:', data));
});
req.on('error', e => console.error(e));
req.end();
