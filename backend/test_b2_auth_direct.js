/**
 * Test B2 with proper HTTP Basic Auth
 */
require('dotenv').config();
const https = require('https');

const keyId = process.env.B2_APPLICATION_KEY_ID;
const appKey = process.env.B2_APPLICATION_KEY;

console.log('\n🔐 Testing B2 with direct HTTPS + proper Basic Auth\n');

// Create proper Basic Auth header
const auth = Buffer.from(`${keyId}:${appKey}`).toString('base64');

const options = {
  hostname: 'api.backblazeb2.com',
  port: 443,
  path: '/b2api/v2/b2_authorize_account',
  method: 'POST',
  headers: {
    'Authorization': `Basic ${auth}`,
    'Content-Type': 'application/json',
    'Content-Length': '0'  // Empty body for authorize
  }
};

console.log('📡 Sending B2 authorization request...\n');

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log(`HTTP Status: ${res.statusCode}\n`);
    
    try {
      const json = JSON.parse(data);
      
      if (res.statusCode === 200) {
        console.log('✅ B2 Authorization SUCCESS!\n');
        console.log(`Account ID: ${json.accountId}`);
        console.log(`Auth Token: ${json.authToken.substring(0, 30)}...`);
        console.log(`API URL: ${json.apiUrl}`);
      } else {
        console.log('❌ B2 returned error\n');
        console.log(`Error Code: ${json.code}`);
        console.log(`Message: ${json.message}`);
      }
    } catch (e) {
      console.log('Raw response:', data);
    }
  });
});

req.on('error', (error) => {
  console.error(`❌ Request failed: ${error.message}`);
});

req.end();
