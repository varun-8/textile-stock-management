const https = require('https');

const postData = JSON.stringify({
    code: 'TEST-SIZE-' + Math.floor(Math.random() * 1000)
});

const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/sizes/add',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': postData.length
    },
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
        console.log(data);
    });
});

req.on('error', error => {
    console.error(error);
});

req.write(postData);
req.end();
