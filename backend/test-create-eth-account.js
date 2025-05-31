require('dotenv').config();

const accountService = require('./src/services/accountService');

async function createEthereumAccount() {
  console.log('🔧 FIXING ETH ACCOUNT MAPPING ISSUE');
  console.log('==================================\n');

  try {
    // Check if Ethereum account already exists
    console.log('🔍 Checking for existing Ethereum accounts...');
    const existingAccounts = await accountService.getChartOfAccounts();
    const ethAccounts = existingAccounts.filter(acc => 
      acc.name.toLowerCase().includes('ethereum') || 
      acc.name.toLowerCase().includes('eth')
    );
    
    if (ethAccounts.length > 0) {
      console.log('✅ Found existing Ethereum accounts:');
      ethAccounts.forEach(acc => {
        console.log(`  ${acc.code} - ${acc.name} (${acc.account_type})`);
      });
      return { existing: true, accounts: ethAccounts };
    }
    
    console.log('❌ No Ethereum account found. Creating one...\n');
    
    // Create the Digital Assets - Ethereum account
    const ethereumAccount = {
      name: 'Digital Assets - Ethereum',
      code: '1802', // This might conflict with C2FLR, let's try 1805
      account_type: 'ASSET',
      account_category_id: null, // Will be set by service
      description: 'Ethereum (ETH) cryptocurrency holdings',
      is_active: true
    };
    
    // Check if code 1802 is taken (it is, by C2FLR)
    const code1802Account = existingAccounts.find(acc => acc.code === '1802');
    if (code1802Account) {
      console.log(`⚠️  Code 1802 is taken by: ${code1802Account.name}`);
      ethereumAccount.code = '1805'; // Use next available
      console.log(`✅ Using code 1805 instead`);
    }
    
    console.log('🛠️  Creating account:', JSON.stringify(ethereumAccount, null, 2));
    
    // Create the account
    const createdAccount = await accountService.createAccount(ethereumAccount);
    
    console.log('✅ Successfully created Ethereum account!');
    console.log(`   Code: ${createdAccount.code}`);
    console.log(`   Name: ${createdAccount.name}`);
    console.log(`   Type: ${createdAccount.account_type}`);
    console.log(`   ID: ${createdAccount.id}`);
    
    // Verify it's in the chart of accounts now
    console.log('\n🔍 Verifying account creation...');
    const updatedAccounts = await accountService.getChartOfAccounts();
    const newEthAccount = updatedAccounts.find(acc => 
      acc.name.toLowerCase().includes('ethereum')
    );
    
    if (newEthAccount) {
      console.log('✅ Account verified in chart of accounts');
      console.log(`   ${newEthAccount.code} - ${newEthAccount.name} (${newEthAccount.account_type})`);
    } else {
      console.log('❌ Account not found in chart of accounts after creation');
    }
    
    return { 
      created: true, 
      account: createdAccount,
      verified: !!newEthAccount
    };
    
  } catch (error) {
    console.log(`❌ Failed to create Ethereum account: ${error.message}`);
    console.log('Stack:', error.stack);
    return { error: error.message };
  }
}

// Run the test
if (require.main === module) {
  createEthereumAccount()
    .then(results => {
      console.log('\n🏁 Ethereum Account Creation Completed');
      console.log('Results:', JSON.stringify(results, null, 2));
    })
    .catch(error => {
      console.error('💥 Test failed:', error.message);
    });
}

module.exports = createEthereumAccount; 