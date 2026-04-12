/**
 * Verify exact credentials encoding
 */
require('dotenv').config();

const keyId = process.env.B2_APPLICATION_KEY_ID;
const appKey = process.env.B2_APPLICATION_KEY;

console.log('\n📋 Credential Values:\n');
console.log(`KeyID: "${keyId}"`);
console.log(`AppKey: "${appKey}"`);

// Check if + is preserved
if (appKey.includes('+')) {
  console.log('\n✅ Plus sign (+) detected in key');
} else {
  console.log('\n⚠️  WARNING: Plus sign (+) NOT found in key - may have been corrupted');
}

// Test base64 encoding
const credentials = Buffer.from(`${keyId}:${appKey}`).toString('base64');
console.log(`\nBase64 encoded: ${credentials}`);

// Try to decode it back
const decoded = Buffer.from(credentials, 'base64').toString('utf-8');
console.log(`Decoded back: ${decoded}`);

if (decoded === `${keyId}:${appKey}`) {
  console.log('\n✅ Base64 encoding/decoding works correctly');
} else {
  console.log('\n❌ Base64 mismatch!');
  console.log(`Expected: ${keyId}:${appKey}`);
  console.log(`Got: ${decoded}`);
}

// Try the axios/http approach manually
console.log('\n\n🔧 Testing with axios...');
const axios = require('axios');

const config = {
  method: 'post',
  url: 'https://api.backblazeb2.com/b2api/v2/b2_authorize_account',
  auth: {
    username: keyId,
    appKey: appKey
  },
  headers: {
    'Content-Type': 'application/json'
  }
};

console.log('Axios config:', { 
  url: config.url, 
  auth: { username: config.auth.username, appKey: config.auth.appKey ? 'present' : 'missing' }
});

axios(config)
  .then(response => {
    console.log('\n✅ Authorization successful!');
    console.log(JSON.stringify(response.data, null, 2));
  })
  .catch(error => {
    console.log('\n❌ Authorization failed');
    if (error.response) {
      console.log(`Status: ${error.response.status}`);
      console.log(`Data:`, error.response.data);
    } else {
      console.log(`Error: ${error.message}`);
    }
  });
