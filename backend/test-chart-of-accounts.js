require('dotenv').config();

const accountService = require('./src/services/accountService');

async function testChartOfAccounts() {
  console.log('📊 CHART OF ACCOUNTS ANALYSIS');
  console.log('==============================\n');

  try {
    // Get all accounts
    const accounts = await accountService.getChartOfAccounts();
    
    console.log(`Total accounts: ${accounts.length}\n`);
    
    // Filter digital asset accounts
    const digitalAssetAccounts = accounts.filter(account => 
      account.name.toLowerCase().includes('digital') && 
      account.name.toLowerCase().includes('asset')
    );
    
    console.log('📱 DIGITAL ASSET ACCOUNTS:');
    console.log('─'.repeat(50));
    if (digitalAssetAccounts.length === 0) {
      console.log('❌ NO digital asset accounts found!');
    } else {
      digitalAssetAccounts.forEach(account => {
        console.log(`${account.code} - ${account.name} (${account.account_type})`);
      });
    }
    
    // Look for specific crypto accounts
    console.log('\n🔍 SEARCHING FOR SPECIFIC CRYPTO ACCOUNTS:');
    console.log('─'.repeat(50));
    
    const cryptoTerms = ['ethereum', 'eth', 'bitcoin', 'btc', 'usdc', 'other'];
    
    cryptoTerms.forEach(term => {
      const found = accounts.filter(account => 
        account.name.toLowerCase().includes(term)
      );
      
      console.log(`${term.toUpperCase()}:`);
      if (found.length === 0) {
        console.log(`  ❌ No accounts found with "${term}"`);
      } else {
        found.forEach(account => {
          console.log(`  ✅ ${account.code} - ${account.name} (${account.account_type})`);
        });
      }
    });
    
    // Check what the AI service thinks is available
    console.log('\n🤖 AI SERVICE FORMATTED ACCOUNTS:');
    console.log('─'.repeat(50));
    
    const GeminiClient = require('./src/services/aiClients/geminiClient');
    const gemini = new GeminiClient();
    const formattedAccounts = await gemini.getFormattedChartOfAccounts();
    
    console.log('AI sees these accounts:');
    console.log(formattedAccounts.substring(0, 1000) + '...');
    
    return {
      totalAccounts: accounts.length,
      digitalAssetAccounts: digitalAssetAccounts.length,
      hasEthereumAccount: accounts.some(acc => acc.name.toLowerCase().includes('ethereum')),
      hasOtherAccount: accounts.some(acc => acc.name.toLowerCase().includes('other')),
      formattedAccountsPreview: formattedAccounts.substring(0, 500)
    };
    
  } catch (error) {
    console.log(`❌ Test failed: ${error.message}`);
    console.log('Stack:', error.stack);
    return { error: error.message };
  }
}

// Run the test
if (require.main === module) {
  testChartOfAccounts()
    .then(results => {
      console.log('\n🏁 Chart of Accounts Analysis Completed');
      console.log('Results:', JSON.stringify(results, null, 2));
    })
    .catch(error => {
      console.error('💥 Test failed:', error.message);
    });
}

module.exports = testChartOfAccounts; 