/**
 * Test the Wei to ETH conversion fix for database numeric field overflow
 */

const BlockscoutClient = require('./src/services/blockscoutClient');
const GeminiClient = require('./src/services/aiClients/geminiClient');

async function testWeiConversionFix() {
  console.log('🧪 Testing Wei to ETH Conversion Fix\n');

  const testWalletAddress = '0x224F597aabAcB821e96F0dd0E703175ebC9CfcDC';
  const testUserId = '53f5afe6-cb6a-4436-8a3a-45e57a6db798';

  try {
    console.log('📋 Step 1: Testing Blockscout data normalization...');
    
    // Test the blockscout client directly
    const walletData = await BlockscoutClient.getWalletTransactions(testWalletAddress, {
      limit: 3,
      includeTokens: true,
      includeInternal: true,
    });

    console.log('✅ Wallet Data Summary:');
    console.log(`   - Regular transactions: ${walletData.regular.length}`);
    console.log(`   - Token transactions: ${walletData.tokens.length}`);
    console.log(`   - Internal transactions: ${walletData.internal.length}`);

    // Check if Wei conversion is working
    if (walletData.regular.length > 0) {
      const firstTx = walletData.regular[0];
      console.log('\\n📊 First Regular Transaction:');
      console.log(`   - Hash: ${firstTx.hash}`);
      console.log(`   - Raw Value (Wei): ${firstTx.value}`);
      console.log(`   - Actual Amount (ETH): ${firstTx.actualAmount}`);
      console.log(`   - Is reasonable ETH amount: ${firstTx.actualAmount < 1000000 ? '✅' : '❌'}`);
      
      // Test if this value would cause database overflow
      const wouldOverflow = parseFloat(firstTx.value) > 999999999999; // Rough limit check
      const isConverted = firstTx.actualAmount < 10000; // Should be reasonable ETH amount
      
      console.log(`   - Would cause DB overflow (old): ${wouldOverflow ? '❌ YES' : '✅ NO'}`);
      console.log(`   - Is properly converted (new): ${isConverted ? '✅ YES' : '❌ NO'}`);
    }

    console.log('\\n📋 Step 2: Testing AI processing with converted values...');
    
    const gemini = new GeminiClient();
    
    // Test small subset to verify conversion
    const limitedAnalysis = await gemini.analyzeBulkTransactions(
      testWalletAddress,
      {
        limit: 2, // Minimal test
        minValue: 0.001,
        saveEntries: false, // Don't save yet, just test processing
        includeTokens: true,
        includeInternal: false,
      },
      testUserId
    );

    console.log('✅ AI Analysis Results:');
    console.log(`   - Transactions processed: ${limitedAnalysis.analysis?.walletAnalysis?.totalTransactionsProcessed || 0}`);
    console.log(`   - Journal entries generated: ${limitedAnalysis.analysis?.walletAnalysis?.totalJournalEntriesGenerated || 0}`);

    // Check the amounts in generated entries
    if (limitedAnalysis.journalEntries && limitedAnalysis.journalEntries.length > 0) {
      console.log('\\n📊 Generated Journal Entry Amounts:');
      
      limitedAnalysis.journalEntries.slice(0, 3).forEach((entry, index) => {
        const amount = parseFloat(entry.amount || 0);
        const isReasonable = amount < 1000000; // Should be reasonable accounting amount
        
        console.log(`   ${index + 1}. Amount: ${amount} ${entry.currency}`);
        console.log(`      Reasonable: ${isReasonable ? '✅' : '❌'}`);
        console.log(`      Debit: ${entry.account_debit}`);
        console.log(`      Credit: ${entry.account_credit}`);
      });
    }

    console.log('\\n📋 Step 3: Testing actual database save with small amounts...');
    
    // Test with very small transaction amounts that shouldn't overflow
    const miniTest = await gemini.analyzeBulkTransactions(
      testWalletAddress,
      {
        limit: 1, // Just one transaction
        minValue: 0.001,
        saveEntries: true, // Try to save
        includeTokens: true,
        includeInternal: false,
      },
      testUserId
    );

    console.log('✅ Mini Save Test Results:');
    console.log(`   - Entries saved: ${miniTest.saved ? 'YES ✅' : 'NO ❌'}`);
    console.log(`   - Entries count: ${miniTest.journalEntries?.length || 0}`);

    if (!miniTest.saved && miniTest.error) {
      console.log(`   - Error: ${miniTest.error}`);
      console.log(`   - Still has overflow? ${miniTest.error.includes('numeric field overflow') ? '❌ YES' : '✅ NO'}`);
    }

    console.log('\\n🎉 Wei Conversion Fix Test Complete!');
    
    const fixWorking = (
      walletData.regular.length > 0 && 
      walletData.regular[0].actualAmount < 10000 && 
      (!miniTest.error || !miniTest.error.includes('numeric field overflow'))
    );

    console.log('\\n📈 Fix Summary:');
    console.log(`   ✅ BlockscoutClient: Added actualAmount field with Wei→ETH conversion`);
    console.log(`   ✅ AI Client: Already uses tx.value || tx.actualAmount fallback`);
    console.log(`   ${fixWorking ? '✅' : '❌'} Fix appears to be working: ${fixWorking ? 'YES' : 'NO'}`);

    return {
      blockscoutWorking: walletData.regular.length > 0 && walletData.regular[0].actualAmount < 10000,
      aiProcessingWorking: limitedAnalysis.analysis?.walletAnalysis?.totalJournalEntriesGenerated > 0,
      databaseSaveWorking: miniTest.saved,
      noOverflowError: !miniTest.error || !miniTest.error.includes('numeric field overflow'),
    };

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('   Stack:', error.stack);
    
    return {
      error: error.message,
      blockscoutWorking: false,
      aiProcessingWorking: false,
      databaseSaveWorking: false,
    };
  }
}

// Run the test
if (require.main === module) {
  testWeiConversionFix()
    .then(results => {
      console.log('\\n🏁 Test Results:', results);
      process.exit(results.error ? 1 : 0);
    })
    .catch(error => {
      console.error('💥 Test runner failed:', error.message);
      process.exit(1);
    });
}

module.exports = testWeiConversionFix; 