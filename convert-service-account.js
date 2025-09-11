// Script to convert service account key to Base64 for Vercel deployment
const fs = require('fs');
const path = require('path');

try {
  // Read the service account key file
  const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');
  const serviceAccountData = fs.readFileSync(serviceAccountPath, 'utf8');
  
  // Convert to Base64
  const base64Key = Buffer.from(serviceAccountData).toString('base64');
  
  console.log('🔑 Service Account Key converted to Base64:');
  console.log('='.repeat(80));
  console.log(base64Key);
  console.log('='.repeat(80));
  console.log('\n📋 Instructions for Vercel deployment:');
  console.log('1. Copy the Base64 string above');
  console.log('2. Go to your Vercel project dashboard');
  console.log('3. Go to Settings → Environment Variables');
  console.log('4. Add a new environment variable:');
  console.log('   - Name: SERVICE_ACCOUNT_KEY_BASE64');
  console.log('   - Value: [paste the Base64 string above]');
  console.log('   - Environment: Production, Preview, Development');
  console.log('5. Redeploy your project');
  
} catch (error) {
  console.error('❌ Error converting service account key:', error.message);
  console.log('Make sure serviceAccountKey.json exists in the current directory');
}
