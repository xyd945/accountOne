/**
 * Comprehensive Pipeline Test
 * Tests the complete flow from blockchain data to journal entry saving
 * Ensures Wei to ETH conversion works throughout the entire system
 */

const BlockscoutClient = require('./src/services/blockscoutClient');
const GeminiClient = require('./src/services/aiClients/geminiClient');
const journalEntryService = require('./src/services/journalEntryService');

async function runComprehensiveTest() {
  console.log('🧪 COMPREHENSIVE PIPELINE TEST');
  console.log('===============================\n');

  const testWalletAddress = '0x224F597aabAcB821e96F0dd0E703175ebC9CfcDC';
  const testUserId = '53f5afe6-cb6a-4436-8a3a-45e57a6db798';
  
  let results = {
    blockscoutConversion: false,
    aiDataFormat: false,
    journalAmounts: false,
    databaseSave: false,
    endToEndWorking: false,
    details: {}
  };

  try {
    console.log('📡 STEP 1: Testing Blockscout Wei Conversion');
    console.log('---------------------------------------------');
    
    // Test Blockscout client conversion
    const walletData = await BlockscoutClient.getWalletTransactions(testWalletAddress, {
      limit: 3,
      includeTokens: true,
      includeInternal: true,
    });

    console.log(`✅ Retrieved ${walletData.totalTransactions} transactions`);
    
    if (walletData.transactions.length > 0) {
      const firstTx = walletData.transactions[0];
      console.log('📊 First Transaction Analysis:');
      console.log(`   - Hash: ${firstTx.hash}`);
      console.log(`   - Raw Value (Wei): ${firstTx.value}`);
      console.log(`   - Actual Amount (ETH): ${firstTx.actualAmount}`);
      
      // Test conversion worked
      const hasActualAmount = firstTx.actualAmount !== undefined;
      const isReasonableAmount = firstTx.actualAmount < 1000; // Should be reasonable ETH amount
      
      results.blockscoutConversion = hasActualAmount && isReasonableAmount;
      results.details.blockscout = {
        hasActualAmount,
        isReasonableAmount,
        rawValue: firstTx.value,
        actualAmount: firstTx.actualAmount
      };
      
      console.log(`   - Has actualAmount: ${hasActualAmount ? '✅' : '❌'}`);
      console.log(`   - Reasonable amount: ${isReasonableAmount ? '✅' : '❌'}`);
    }

    console.log(`\n🔄 Blockscout Conversion: ${results.blockscoutConversion ? '✅ PASS' : '❌ FAIL'}\n`);

    // Filter transactions for AI processing
    const gemini = new GeminiClient();
    const filtered = gemini.filterTransactionsForAnalysis(walletData.transactions, {
      limit: 2,
      minValue: 0.001
    });

    console.log('🤖 STEP 2: Testing AI Data Format');
    console.log('----------------------------------');
    
    // Test formatTransactionsForAI
    const aiFormattedTxs = gemini.formatTransactionsForAI(filtered, 'incoming_transfer');
    
    if (aiFormattedTxs.length > 0) {
      const firstAiTx = aiFormattedTxs[0];
      console.log('📊 AI Formatted Transaction:');
      console.log(`   - Hash: ${firstAiTx.hash}`);
      console.log(`   - Value sent to AI: ${firstAiTx.value}`);
      console.log(`   - Currency: ${firstAiTx.currency}`);
      
      // Check if AI gets reasonable ETH amounts (not Wei)
      const aiGetsReasonableAmount = parseFloat(firstAiTx.value) < 1000;
      
      results.aiDataFormat = aiGetsReasonableAmount;
      results.details.aiFormat = {
        valueToAI: firstAiTx.value,
        isReasonable: aiGetsReasonableAmount,
        currency: firstAiTx.currency
      };
      
      console.log(`   - AI gets reasonable amount: ${aiGetsReasonableAmount ? '✅' : '❌'}`);
    }

    console.log(`\n🤖 AI Data Format: ${results.aiDataFormat ? '✅ PASS' : '❌ FAIL'}\n`);

    console.log('🧠 STEP 3: Testing Full AI Analysis');
    console.log('------------------------------------');
    
    // Test full AI analysis (without saving)
    const analysis = await gemini.analyzeBulkTransactions(
      testWalletAddress,
      {
        limit: 1, // Just one transaction to avoid big operations
        minValue: 0.001,
        saveEntries: false, // Don't save yet
        includeTokens: true,
        includeInternal: false,
      },
      null // No user ID
    );

    console.log(`✅ AI Analysis completed`);
    console.log(`   - Transactions processed: ${analysis.analysis?.walletAnalysis?.totalTransactionsProcessed || 0}`);
    console.log(`   - Journal entries generated: ${analysis.analysis?.walletAnalysis?.totalJournalEntriesGenerated || 0}`);

    if (analysis.journalEntries && analysis.journalEntries.length > 0) {
      console.log('\n📊 Generated Journal Entry Analysis:');
      
      // Flatten entries for analysis
      const allEntries = analysis.journalEntries.flatMap(group => group.entries);
      
      allEntries.slice(0, 3).forEach((entry, index) => {
        const amount = parseFloat(entry.amount);
        const isReasonable = amount < 1000000; // Should not be in Wei range
        
        console.log(`   Entry ${index + 1}:`);
        console.log(`      - Amount: ${amount} ${entry.currency}`);
        console.log(`      - Reasonable: ${isReasonable ? '✅' : '❌'}`);
        console.log(`      - Debit: ${entry.accountDebit}`);
        console.log(`      - Credit: ${entry.accountCredit}`);
        
        if (index === 0) {
          results.journalAmounts = isReasonable;
          results.details.journalEntry = {
            amount,
            currency: entry.currency,
            isReasonable,
            debit: entry.accountDebit,
            credit: entry.accountCredit
          };
        }
      });
    }

    console.log(`\n🧠 Journal Entry Amounts: ${results.journalAmounts ? '✅ PASS' : '❌ FAIL'}\n`);

    console.log('💾 STEP 4: Testing Database Save');
    console.log('---------------------------------');
    
    // Test database save with small, safe transaction
    if (results.journalAmounts) {
      try {
        const miniAnalysis = await gemini.analyzeBulkTransactions(
          testWalletAddress,
          {
            limit: 1,
            minValue: 0.001,
            saveEntries: true,
            includeTokens: true,
            includeInternal: false,
          },
          testUserId
        );

        const saveSuccessful = miniAnalysis.saved;
        const noOverflowError = !miniAnalysis.error || !miniAnalysis.error.includes('numeric field overflow');
        
        results.databaseSave = saveSuccessful && noOverflowError;
        results.details.database = {
          saveSuccessful,
          noOverflowError,
          error: miniAnalysis.error || null,
          entriesSaved: miniAnalysis.journalEntries?.length || 0
        };
        
        console.log(`   - Save successful: ${saveSuccessful ? '✅' : '❌'}`);
        console.log(`   - No overflow error: ${noOverflowError ? '✅' : '❌'}`);
        console.log(`   - Entries saved: ${miniAnalysis.journalEntries?.length || 0}`);
        
        if (miniAnalysis.error) {
          console.log(`   - Error: ${miniAnalysis.error}`);
        }
        
      } catch (saveError) {
        console.log(`   - Save failed: ❌ ${saveError.message}`);
        results.details.database = {
          saveSuccessful: false,
          error: saveError.message
        };
      }
    } else {
      console.log('   - Skipping database test due to unreasonable amounts');
    }

    console.log(`\n💾 Database Save: ${results.databaseSave ? '✅ PASS' : '❌ FAIL'}\n`);

    // Overall assessment
    results.endToEndWorking = (
      results.blockscoutConversion &&
      results.aiDataFormat &&
      results.journalAmounts &&
      results.databaseSave
    );

    console.log('🏁 COMPREHENSIVE TEST RESULTS');
    console.log('==============================');
    console.log(`📡 Blockscout Wei Conversion: ${results.blockscoutConversion ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`🤖 AI Data Format:           ${results.aiDataFormat ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`🧠 Journal Entry Amounts:    ${results.journalAmounts ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`💾 Database Save:            ${results.databaseSave ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`🎯 END-TO-END PIPELINE:      ${results.endToEndWorking ? '✅ WORKING' : '❌ BROKEN'}`);

    if (!results.endToEndWorking) {
      console.log('\n🚨 ISSUES FOUND:');
      
      if (!results.blockscoutConversion) {
        console.log('   • Blockscout conversion not working properly');
      }
      if (!results.aiDataFormat) {
        console.log('   • AI still receiving Wei values instead of ETH');
      }
      if (!results.journalAmounts) {
        console.log('   • Journal entries contain unreasonable amounts');
      }
      if (!results.databaseSave) {
        console.log('   • Database save failing (likely numeric overflow)');
      }
    }

    console.log('\n📋 DETAILED RESULTS:');
    console.log(JSON.stringify(results.details, null, 2));

    return results;

  } catch (error) {
    console.error('💥 Comprehensive test failed:', error.message);
    results.error = error.message;
    return results;
  }
}

// Run the test
if (require.main === module) {
  runComprehensiveTest()
    .then(results => {
      console.log('\n✅ Test completed');
      process.exit(results.endToEndWorking ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Test runner failed:', error.message);
      process.exit(1);
    });
}

module.exports = runComprehensiveTest; 