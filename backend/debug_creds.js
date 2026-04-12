/**
 * Debug: Check exact credential values
 */
require('dotenv').config();

console.log('\n🔍 DEBUG: Exact credential values\n');

const keyId = process.env.B2_APPLICATION_KEY_ID;
const appKey = process.env.B2_APPLICATION_KEY;

console.log('B2_APPLICATION_KEY_ID:');
console.log(`  Value: "${keyId}"`);
console.log(`  Length: ${keyId ? keyId.length : 0}`);
console.log(`  Hex chars: ${keyId ? [...keyId].map(c => c.charCodeAt(0)).join(',') : 'N/A'}`);

console.log('\nB2_APPLICATION_KEY:');
console.log(`  Value: "${appKey}"`);
console.log(`  Length: ${appKey ? appKey.length : 0}`);
console.log(`  Hex chars: ${appKey ? [...appKey].map(c => c.charCodeAt(0)).join(',') : 'N/A'}`);

// Check for trailing spaces or invisible characters
if (keyId && keyId !== keyId.trim()) {
  console.log('\n⚠️  WARNING: B2_APPLICATION_KEY_ID has leading/trailing whitespace');
  console.log(`  Trimmed: "${keyId.trim()}"`);
}

if (appKey && appKey !== appKey.trim()) {
  console.log('\n⚠️  WARNING: B2_APPLICATION_KEY has leading/trailing whitespace');
  console.log(`  Trimmed: "${appKey.trim()}"`);
}

console.log('\n✅ If values look correct above, the credential rejection is from B2 API (not parsing issue)');
