require('dotenv').config();
const blockscoutClient = require('./src/services/blockscoutClient');
const AIClientFactory = require('./src/services/aiClients/index');

async function testXYDTokenParsing() {
  console.log('🧪 Testing XYD Token Transfer Parsing...\n');

  try {
    // Use the actual transaction hash from your test
    const txHash = '0xedc0e7fff545af2931d80852d3d10331bb91f9c96b3e70047274fbaf51b06f91';
    const description = 'I receive some XYD token from our designer as a refund.';

    console.log('📋 Step 1: Fetching transaction data from Coston2...');
    const txData = await blockscoutClient.getTransactionInfo(txHash);
    
    console.log('✅ Transaction fetched:', {
      hash: txData.hash,
      from: txData.from,
      to: txData.to,
      type: txData.type,
      status: txData.status,
      tokenTransfers: txData.tokenTransfers?.length || 0
    });

    console.log('\n📋 Step 2: Checking token transfer detection...');
    
    if (txData.tokenTransfer) {
      console.log('✅ Token transfer detected:', {
        symbol: txData.tokenTransfer.tokenSymbol,
        amount: txData.tokenTransfer.actualAmount,
        from: txData.tokenTransfer.from,
        to: txData.tokenTransfer.to,
        contractAddress: txData.tokenTransfer.contractAddress
      });
    } else {
      console.log('❌ No token transfer detected in transaction data');
      console.log('Raw token transfers:', txData.tokenTransfers);
    }

    console.log('\n📋 Step 3: Testing AI analysis...');
    
    // Test the AI analysis with the updated prompt - AIClientFactory is already an instance
    const journalEntries = await AIClientFactory.analyzeTransaction(txData, description);

    console.log('✅ AI Analysis completed:', {
      entriesCount: journalEntries.length,
      entries: journalEntries.map(e => ({
        debit: e.accountDebit,
        credit: e.accountCredit,
        amount: e.amount,
        currency: e.currency,
        narrative: e.narrative.substring(0, 50) + '...'
      }))
    });

    console.log('\n📋 Step 4: Validating results...');
    
    let hasXYDEntry = false;
    let hasValidAmount = false;
    let properAccounts = false;

    journalEntries.forEach((entry, index) => {
      console.log(`\nEntry ${index + 1}:`);
      console.log(`- Debit: ${entry.accountDebit}`);
      console.log(`- Credit: ${entry.accountCredit}`);
      console.log(`- Amount: ${entry.amount} ${entry.currency}`);
      console.log(`- Narrative: ${entry.narrative}`);

      // Check if this is the XYD entry
      if (entry.currency === 'XYD' || entry.narrative.toLowerCase().includes('xyd')) {
        hasXYDEntry = true;
        
        // Check if amount is valid (not NaN and > 0)
        if (!isNaN(entry.amount) && entry.amount > 0) {
          hasValidAmount = true;
        }
        
        // Check if accounts are appropriate for a refund
        if (entry.accountDebit.includes('Digital Assets') && 
            (entry.accountCredit.includes('Accounts Payable') || 
             entry.accountCredit.includes('Payable'))) {
          properAccounts = true;
        }
      }
    });

    console.log('\n🎯 Test Results:');
    console.log(`- Has XYD Token Entry: ${hasXYDEntry ? '✅' : '❌'}`);
    console.log(`- Has Valid Amount (not NaN): ${hasValidAmount ? '✅' : '❌'}`);
    console.log(`- Uses Proper Accounts: ${properAccounts ? '✅' : '❌'}`);

    if (hasXYDEntry && hasValidAmount && properAccounts) {
      console.log('\n🎉 SUCCESS: XYD token parsing is working correctly!');
      console.log('✅ The system can now handle Coston2 token transfers properly');
    } else {
      console.log('\n❌ ISSUES FOUND:');
      if (!hasXYDEntry) console.log('- No XYD token entry created');
      if (!hasValidAmount) console.log('- Amount is NaN or invalid');
      if (!properAccounts) console.log('- Incorrect account mapping');
    }

    console.log('\n📋 Next Steps:');
    console.log('1. Test with the frontend interface');
    console.log('2. Verify journal entries are saved to database');
    console.log('3. Check that reports show XYD holdings correctly');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testXYDTokenParsing(); 