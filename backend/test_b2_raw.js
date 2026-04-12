/**
 * Test B2 using raw HTTP API (bypass library)
 */
require('dotenv').config();
const https = require('https');
const { URL } = require('url');

const keyId = process.env.B2_APPLICATION_KEY_ID;
const appKey = process.env.B2_APPLICATION_KEY;

console.log('\n🔧 Testing B2 with raw HTTP API\n');
console.log(`Key ID: ${keyId}`);
console.log(`Key: ${appKey?.substring(0, 10)}...`);

// B2 requires base64 encoding of "keyId:appKey"
const credentials = Buffer.from(`${keyId}:${appKey}`).toString('base64');

const options = {
  hostname: 'api.backblazeb2.com',
  port: 443,
  path: '/b2api/v2/b2_authorize_account',
  method: 'POST',
  headers: {
    'Authorization': `Basic ${credentials}`,
    'Content-Length': 0
  }
};

console.log('📡 Calling B2 authorize API...\n');

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log(`Status: ${res.statusCode}`);
    console.log(`Headers:`, res.headers);
    console.log(`\nResponse Body:`);
    
    try {
      const json = JSON.parse(data);
      console.log(JSON.stringify(json, null, 2));
      
      if (res.statusCode === 200) {
        console.log('\n✅ B2 Authorization successful!');
        console.log(`Account ID: ${json.accountId}`);
      } else {
        console.log('\n❌ B2 returned an error');
        console.log(`Error: ${json.code || json.message || 'Unknown'}`);
      }
    } catch (e) {
      console.log(data);
    }
  });
});

req.on('error', (e) => {
  console.error(`❌ Request error: ${e.message}`);
});

req.end();
