require('dotenv').config();

const BlockscoutClient = require('./src/services/blockscoutClient');

async function testFixedBlockscoutClient() {
  console.log('🔧 TESTING FIXED BLOCKSCOUT CLIENT');
  console.log('=================================\n');

  const testHash = '0x4fe7096f9232c2f1b69736dc6a5de6d247ca23514f9337e9abd45c3ab5f9e126';
  const wallet = '0x862847B44845eD331dc8FA211Df3C01eCBB1b38C';
  
  console.log(`Testing transaction: ${testHash}`);
  console.log(`Wallet: ${wallet}\n`);

  try {
    // Test 1: Single transaction processing
    console.log('📊 TEST 1: Single Transaction Processing');
    console.log('─'.repeat(50));
    
    const txData = await BlockscoutClient.getTransactionInfo(testHash);
    
    console.log('✅ Transaction processed successfully!');
    console.log(`Hash: ${txData.hash}`);
    console.log(`Network Currency: ${txData.networkCurrency}`);
    console.log(`Native Value: ${txData.actualAmount} ${txData.networkCurrency}`);
    console.log(`Gas Fee: ${txData.gasFee} ${txData.networkCurrency}`);
    console.log(`Gas Used: ${txData.gasUsed.toLocaleString()}`);
    console.log(`Gas Price: ${txData.gasPrice.toLocaleString()} Wei`);
    console.log(`Is Token Transfer: ${txData.isTokenTransfer}`);
    
    if (txData.isTokenTransfer && txData.tokenTransfer) {
      console.log('\n🪙 Token Transfer Details:');
      console.log(`  Token: ${txData.tokenTransfer.tokenSymbol} (${txData.tokenTransfer.tokenName})`);
      console.log(`  Amount: ${txData.tokenTransfer.tokenAmount} ${txData.tokenTransfer.tokenSymbol}`);
      console.log(`  From: ${txData.tokenTransfer.from}`);
      console.log(`  To: ${txData.tokenTransfer.to}`);
      console.log(`  Contract: ${txData.tokenTransfer.tokenContract}`);
    }
    
    // Verify the fix
    console.log('\n🔍 VERIFICATION:');
    console.log('─'.repeat(30));
    
    const gasCorrect = txData.gasFee > 0.001 && txData.gasFee < 0.002; // Should be ~0.001305
    const currencyCorrect = txData.networkCurrency === 'C2FLR';
    const tokenCorrect = txData.isTokenTransfer && txData.tokenTransfer?.tokenAmount === 100;
    const symbolCorrect = txData.tokenTransfer?.tokenSymbol === 'XYD';
    
    console.log(`✅ Gas fee correct (${txData.gasFee} C2FLR): ${gasCorrect ? 'YES' : 'NO'}`);
    console.log(`✅ Currency correct (C2FLR): ${currencyCorrect ? 'YES' : 'NO'}`);
    console.log(`✅ Token amount correct (100 XYD): ${tokenCorrect ? 'YES' : 'NO'}`);
    console.log(`✅ Token symbol correct (XYD): ${symbolCorrect ? 'YES' : 'NO'}`);
    
    const allCorrect = gasCorrect && currencyCorrect && tokenCorrect && symbolCorrect;
    console.log(`\n🎯 ALL FIXES WORKING: ${allCorrect ? '✅ YES' : '❌ NO'}`);

    // Test 2: Wallet bulk analysis
    console.log('\n\n📊 TEST 2: Wallet Bulk Analysis');
    console.log('─'.repeat(50));
    
    const walletData = await BlockscoutClient.getWalletTransactions(wallet, { limit: 5 });
    
    console.log(`✅ Found ${walletData.totalTransactions} transactions`);
    console.log(`✅ Categories: ${Object.keys(walletData.summary.categories).join(', ')}`);
    
    // Find our test transaction in the results
    const testTx = walletData.transactions.find(tx => tx.hash === testHash);
    
    if (testTx) {
      console.log('\n🎯 Test Transaction in Bulk Results:');
      console.log(`  Category: ${testTx.category}`);
      console.log(`  Direction: ${testTx.direction}`);
      console.log(`  Amount: ${testTx.actualAmount} ${testTx.currency}`);
      console.log(`  Gas Fee: ${testTx.gasFee} ${testTx.gasCurrency}`);
      console.log(`  Token Symbol: ${testTx.tokenSymbol || 'N/A'}`);
      
      const bulkCorrect = (
        testTx.category === 'token_transfer' &&
        testTx.currency === 'XYD' &&
        testTx.actualAmount === 100 &&
        testTx.gasCurrency === 'C2FLR'
      );
      
      console.log(`\n🎯 BULK ANALYSIS CORRECT: ${bulkCorrect ? '✅ YES' : '❌ NO'}`);
      
      return {
        singleTransaction: allCorrect,
        bulkAnalysis: bulkCorrect,
        allTestsPassed: allCorrect && bulkCorrect
      };
    } else {
      console.log('❌ Test transaction not found in bulk results');
      return {
        singleTransaction: allCorrect,
        bulkAnalysis: false,
        allTestsPassed: false
      };
    }

  } catch (error) {
    console.log(`❌ Test failed: ${error.message}`);
    console.log('Stack:', error.stack);
    return {
      error: error.message,
      allTestsPassed: false
    };
  }
}

// Run the test
if (require.main === module) {
  testFixedBlockscoutClient()
    .then(results => {
      console.log('\n🏁 FIXED BLOCKSCOUT CLIENT TEST COMPLETED');
      console.log('Results:', JSON.stringify(results, null, 2));
      
      if (results.allTestsPassed) {
        console.log('\n🎉 SUCCESS! The BlockscoutClient fixes are working correctly!');
        console.log('✅ Token transfers properly detected');
        console.log('✅ Gas fees calculated in C2FLR');
        console.log('✅ XYD amounts correctly processed');
        console.log('✅ Bulk analysis working');
      } else {
        console.log('\n❌ Some tests failed - need further investigation');
      }
    })
    .catch(error => {
      console.error('💥 Test failed:', error.message);
    });
}

module.exports = testFixedBlockscoutClient; 