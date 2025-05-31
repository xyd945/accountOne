require('dotenv').config();

// Set environment variables for FTSO testing
process.env.FTSO_PRICE_CONSUMER_ENABLED = 'true';
process.env.FTSO_PRICE_CONSUMER_ADDRESS = '0xed1692dd816996B8D7EB39e21344B3ed9Fda2d11';
process.env.FLARE_RPC_URL = 'https://coston2-api.flare.network/ext/C/rpc';
process.env.FLARE_CHAIN_ID = '114';
process.env.PRICE_FEED_CACHE_TTL = '60000';

const GeminiClient = require('./src/services/aiClients/geminiClient');
const ftsoService = require('./src/services/ftsoService');

const TEST_USER_ID = '53f5afe6-cb6a-4436-8a3a-45e57a6db798';

async function testFTSOJournalCreation() {
  console.log('💎 TEST 4: FTSO-Enhanced Journal Entry Creation');
  console.log('===============================================\n');
  
  // Test case that should create ETH entries (not "Digital Assets - Other")
  const testInput = {
    message: "The company received 2.5 ETH as payment for consulting services on Feb 15, 2025",
    expectedCurrency: "ETH",
    expectsRealPrice: true
  };

  console.log(`🧪 Testing: "${testInput.message}"`);
  console.log('Expected: ETH should map to "Digital Assets - Ethereum", NOT "Digital Assets - Other"');
  console.log('Expected: Gas fees should be in C2FLR, NOT ETH');
  console.log('─'.repeat(80));

  try {
    // Step 1: Check FTSO service first
    console.log('📡 Step 1: Checking FTSO Service');
    console.log(`FTSO Available: ${ftsoService.isAvailable()}`);
    
    if (ftsoService.isAvailable()) {
      const ethPrice = await ftsoService.getPrice('ETH');
      console.log(`ETH/USD Price: $${ethPrice.usdPrice}`);
      console.log(`Price Source: ${ethPrice.source}`);
    }
    
    // Step 2: Create journal entry with AI
    console.log('\n🤖 Step 2: Creating Journal Entry with AI');
    const gemini = new GeminiClient();
    const response = await gemini.chatResponse(
      testInput.message,
      { user: { id: TEST_USER_ID, email: 'test@example.com' } }
    );

    console.log('\n📋 AI Response Analysis:');
    console.log(`Response Length: ${response.response?.length || 0} characters`);
    console.log(`Journal Entries Created: ${response.journalEntries?.length || 0}`);
    
    if (response.journalEntries && response.journalEntries.length > 0) {
      console.log('\n📊 Journal Entries Details:');
      response.journalEntries.forEach((entry, index) => {
        console.log(`\nEntry ${index + 1}:`);
        console.log(`  Debit Account:  ${entry.accountDebit}`);
        console.log(`  Credit Account: ${entry.accountCredit}`);
        console.log(`  Amount:         ${entry.amount}`);
        console.log(`  Currency:       ${entry.currency}`);
        console.log(`  Narrative:      ${entry.narrative}`);
        
        // Check for issues
        const issues = [];
        if (entry.currency === 'ETH' && entry.accountDebit.includes('Other')) {
          issues.push('❌ ETH mapped to "Digital Assets - Other" instead of "Digital Assets - Ethereum"');
        }
        if (entry.currency === 'ETH' && entry.accountDebit === 'Digital Assets - Ethereum') {
          issues.push('✅ ETH correctly mapped to "Digital Assets - Ethereum"');
        }
        if (entry.narrative?.toLowerCase().includes('gas') && entry.currency === 'ETH') {
          issues.push('❌ Gas fees recorded in ETH instead of C2FLR');
        }
        if (entry.narrative?.toLowerCase().includes('gas') && entry.currency === 'C2FLR') {
          issues.push('✅ Gas fees correctly recorded in C2FLR');
        }
        
        if (issues.length > 0) {
          console.log('  Issues Found:');
          issues.forEach(issue => console.log(`    ${issue}`));
        }
      });
    } else {
      console.log('❌ No journal entries were created!');
      console.log('Response preview:', response.response?.substring(0, 200));
    }

    console.log('\n📝 Full AI Response:');
    console.log('─'.repeat(80));
    console.log(response.response);
    console.log('─'.repeat(80));

    return {
      hasJournalEntries: response.journalEntries && response.journalEntries.length > 0,
      journalEntries: response.journalEntries || [],
      response: response.response,
      issues: []
    };

  } catch (error) {
    console.log(`❌ Test failed: ${error.message}`);
    console.log('Stack:', error.stack);
    return { error: error.message };
  }
}

// Run the test
if (require.main === module) {
  testFTSOJournalCreation()
    .then(results => {
      console.log('\n🏁 FTSO Journal Creation Test Completed');
      console.log('Results:', JSON.stringify(results, null, 2));
    })
    .catch(error => {
      console.error('💥 Test failed:', error.message);
    });
}

module.exports = testFTSOJournalCreation; 