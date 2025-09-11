// Test script to verify backend endpoints
const baseUrl = 'http://localhost:3000/api';

async function testEndpoint(endpoint, method = 'GET', body = null) {
  try {
    console.log(`\n🧪 Testing ${method} ${endpoint}`);
    
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(`${baseUrl}${endpoint}`, options);
    console.log(`📡 Status: ${response.status}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Success:', data);
      return data;
    } else {
      const errorText = await response.text();
      console.log('❌ Error:', errorText);
      return null;
    }
  } catch (error) {
    console.log('🚫 Network Error:', error.message);
    return null;
  }
}

async function runTests() {
  console.log('🚀 Starting backend tests...');
  
  // Test basic connectivity
  await testEndpoint('/test');
  
  // Test restaurant endpoint
  await testEndpoint('/restaurant');
  
  // Test auth endpoints
  await testEndpoint('/auth/test');
  await testEndpoint('/auth/verify-token', 'POST', { idToken: 'test_token', role: 'restaurant_owner' });
  await testEndpoint('/auth/google-signin', 'POST', { idToken: 'test_token', role: 'restaurant_owner' });
  await testEndpoint('/auth/email-signin', 'POST', { idToken: 'test_token', role: 'restaurant_owner' });
  
  console.log('\n🏁 Tests completed!');
}

runTests().catch(console.error);
