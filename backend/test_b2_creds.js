/**
 * Simple B2 credential verification test
 */
require('dotenv').config();
const B2 = require('backblaze-b2');

async function testB2Credentials() {
  console.log('\n🧪 Testing B2 Credentials...\n');
  
  const keyId = process.env.B2_APPLICATION_KEY_ID;
  const appKey = process.env.B2_APPLICATION_KEY;
  const bucketName = process.env.B2_BUCKET_NAME;
  
  console.log('📋 Configuration loaded:');
  console.log(`   KeyId: ${keyId ? keyId.substring(0, 10) + '...' : 'MISSING'}`);
  console.log(`   AppKey: ${appKey ? appKey.substring(0, 10) + '...' : 'MISSING'}`);
  console.log(`   Bucket: ${bucketName}\n`);
  
  if (!keyId || !appKey) {
    console.error('❌ Missing credentials in .env');
    process.exit(1);
  }
  
  try {
    console.log('🔗 Attempting B2 connection...');
    const b2 = new B2({
      applicationKeyId: keyId,
      applicationKey: appKey
    });
    
    console.log('🔐 Authorizing with B2...');
    const authData = await b2.authorize();
    
    console.log('✅ Authorization successful!');
    console.log(`   Account ID: ${authData.accountId}`);
    console.log(`   Auth Token: ${authData.authToken.substring(0, 20)}...\n`);
    
    console.log('📦 Listing buckets...');
    const bucketsResponse = await b2.listBuckets();
    
    console.log(`✅ Found ${bucketsResponse.buckets.length} bucket(s):`);
    bucketsResponse.buckets.forEach(b => {
      const marker = b.bucketName === bucketName ? ' ← TARGET BUCKET' : '';
      console.log(`   - ${b.bucketName} (ID: ${b.bucketId})${marker}`);
    });
    
    const targetBucket = bucketsResponse.buckets.find(b => b.bucketName === bucketName);
    if (targetBucket) {
      console.log(`\n✅ Target bucket "${bucketName}" found and accessible!`);
      console.log(`   Bucket ID: ${targetBucket.bucketId}`);
      console.log(`   Type: ${targetBucket.bucketType}`);
    } else {
      console.warn(`\n⚠️  Target bucket "${bucketName}" not found in account`);
      console.log('   This might be normal if the bucket needs to be created.');
    }
    
    console.log('\n✅ B2 credentials are valid and working!\n');
    
  } catch (error) {
    console.error('\n❌ B2 Connection Failed');
    console.error(`Error: ${error.message}`);
    
    if (error.response?.status === 401) {
      console.error('\n📌 Status 401 indicates:');
      console.error('   - Application Key ID is incorrect');
      console.error('   - Application Key is incorrect');
      console.error('   - Application Key has been revoked');
      console.error('   - Application Key has insufficient permissions');
      console.error('\n   Action: Verify credentials in .env file match B2 dashboard');
    }
    
    if (error.response?.status === 400) {
      console.error('\n📌 Status 400 indicates:');
      console.error('   - Invalid request format');
      console.error('   - Malformed credentials');
    }
    
    process.exit(1);
  }
}

testB2Credentials();
