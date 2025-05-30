require('dotenv').config();
const axios = require('axios');

async function testJournalEntriesAPI() {
  console.log('🧪 Testing Journal Entries API Endpoint\n');

  const baseURL = process.env.API_URL || 'http://localhost:3001';
  
  try {
    // Test the journal entries endpoint
    console.log('📝 Testing GET /api/reports/journal-entries');
    console.log('URL:', `${baseURL}/api/reports/journal-entries`);
    
    const response = await axios.get(`${baseURL}/api/reports/journal-entries`, {
      params: {
        limit: 10,
      },
      headers: {
        'Content-Type': 'application/json',
        // Note: In a real test, you'd need a valid auth token
        // 'Authorization': 'Bearer your-test-token'
      },
      timeout: 10000,
    });

    console.log('✅ API Response Status:', response.status);
    console.log('✅ Response Data Structure:');
    console.log('- Entries count:', response.data.entries?.length || 0);
    console.log('- Pagination:', response.data.pagination);
    
    if (response.data.entries && response.data.entries.length > 0) {
      console.log('\n📊 Sample Entry:');
      const sampleEntry = response.data.entries[0];
      console.log('- ID:', sampleEntry.id);
      console.log('- Account Debit:', sampleEntry.account_debit);
      console.log('- Account Credit:', sampleEntry.account_credit);
      console.log('- Amount:', sampleEntry.amount, sampleEntry.currency);
      console.log('- Entry Date:', sampleEntry.entry_date);
      console.log('- AI Confidence:', sampleEntry.ai_confidence);
      console.log('- Is Reviewed:', sampleEntry.is_reviewed);
    }

  } catch (error) {
    if (error.response) {
      console.log('❌ API Error Response:');
      console.log('- Status:', error.response.status);
      console.log('- Status Text:', error.response.statusText);
      console.log('- Data:', error.response.data);
      
      if (error.response.status === 401) {
        console.log('\n💡 Note: 401 Unauthorized is expected without a valid auth token');
        console.log('   This confirms the endpoint exists and requires authentication');
      }
    } else if (error.code === 'ECONNREFUSED') {
      console.log('❌ Connection refused - Backend server is not running');
      console.log('💡 Start the backend server with: npm run dev');
    } else {
      console.log('❌ Request Error:', error.message);
    }
  }

  console.log('\n📋 Summary:');
  console.log('- Journal entries API endpoint: /api/reports/journal-entries');
  console.log('- Expected parameters: limit, page, start, end, account, currency');
  console.log('- Authentication: Required (Bearer token)');
  console.log('- Response format: { entries: [], pagination: {} }');
}

testJournalEntriesAPI().catch(console.error); 