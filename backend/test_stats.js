const https = require('https');

const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/sizes',
    method: 'GET',
    rejectUnauthorized: false
};

const req = https.request(options, res => {
    console.log(`StatusCode: ${res.statusCode}`);
    let data = '';

    res.on('data', chunk => {
        data += chunk;
    });

    res.on('end', () => {
        console.log('Response Body:');
        try {
            const json = JSON.parse(data);
            console.log(JSON.stringify(json, null, 2));
        } catch (e) {
            console.log(data);
        }
    });
});

req.on('error', error => {
    console.error(error);
});

req.end();
