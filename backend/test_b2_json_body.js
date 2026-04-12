/**
 * Test B2 with JSON body
 */
require('dotenv').config();
const https = require('https');

const keyId = process.env.B2_APPLICATION_KEY_ID;
const appKey = process.env.B2_APPLICATION_KEY;

console.log('\n🔐 Testing B2 API with JSON body\n');

const auth = Buffer.from(`${keyId}:${appKey}`).toString('base64');

// Try with empty JSON body
const body = '{}';

const options = {
  hostname: 'api.backblazeb2.com',
  port: 443,
  path: '/b2api/v2/b2_authorize_account',
  method: 'POST',
  headers: {
    'Authorization': `Basic ${auth}`,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body)
  }
};

console.log('Headers:', options.headers);
console.log(`Body: ${body}\n`);

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log(`Status: ${res.statusCode}\n`);
    try {
      const json = JSON.parse(data);
      if (res.statusCode === 200) {
        console.log('✅ SUCCESS!');
        console.log(JSON.stringify(json, null, 2));
      } else {
        console.log('❌ Error:', json.message);
      }
    } catch(e) {
      console.log(data);
    }
  });
});

req.on('error', (err) => {
  console.error(`Error: ${err.message}`);
});

req.write(body);
req.end();
