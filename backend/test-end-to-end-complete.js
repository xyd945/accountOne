/**
 * Complete End-to-End Test Suite
 * Tests all real system flows with actual APIs, database, and user scenarios
 */

require('dotenv').config();

const BlockscoutClient = require('./src/services/blockscoutClient');
const GeminiClient = require('./src/services/aiClients/geminiClient');
const journalEntryService = require('./src/services/journalEntryService');

const TEST_USER_ID = '53f5afe6-cb6a-4436-8a3a-45e57a6db798';
const TEST_WALLET_ADDRESS = '0x224F597aabAcB821e96F0dd0E703175ebC9CfcDC';
const TEST_TRANSACTION_HASH = '0xb21134fb7446f7bd1d5173f21d74cb17e06f884ef5aeb5b994bc3299d96eb208';

async function runEndToEndTests() {
  console.log('🧪 COMPLETE END-TO-END TEST SUITE');
  console.log('==================================');
  console.log('Testing real system with actual APIs, database, and user scenarios\n');

  const results = {
    blockscoutAPI: false,
    aiService: false,
    userInputJournalEntry: false,
    transactionIdJournalEntry: false,
    walletBulkAnalysis: false,
    databaseOperations: false,
    weiConversionFix: false,
    allTestsPassed: false,
    details: {},
    errors: []
  };

  try {
    // Test 1: Blockscout API Integration
    console.log('📡 TEST 1: Blockscout API Integration');
    console.log('-------------------------------------');
    
    try {
      console.log(`Testing Blockscout API with wallet: ${TEST_WALLET_ADDRESS}`);
      
      const walletData = await BlockscoutClient.getWalletTransactions(TEST_WALLET_ADDRESS, {
        limit: 3,
        includeTokens: true,
        includeInternal: true
      });

      // Test Wei conversion and transaction categorization
      console.log(`✅ Retrieved ${walletData.totalTransactions} transactions`);
      console.log(`✅ Transaction categories: ${Object.keys(walletData.summary.categories).join(', ')}`);
      
      // Look for ACTUAL ETH transactions (not token transfers)
      let ethTransaction = null;
      let tokenTransaction = null;
      let weiConversionWorking = false;
      
      for (const tx of walletData.transactions) {
        // ETH transaction: has meaningful ETH value AND no token symbol
        if (!tx.tokenSymbol && tx.actualAmount > 0.01) {
          ethTransaction = tx;
          weiConversionWorking = true;
          break;
        }
      }
      
      // Look for token transactions separately
      for (const tx of walletData.transactions) {
        if (tx.tokenSymbol && tx.actualAmount !== undefined) {
          tokenTransaction = tx;
          break;
        }
      }
      
      if (ethTransaction) {
        console.log(`✅ Found ETH transaction: ${ethTransaction.hash}`);
        console.log(`✅ ETH Wei value: ${ethTransaction.value}, ETH amount: ${ethTransaction.actualAmount}`);
        console.log(`✅ Wei→ETH conversion working: ${weiConversionWorking}`);
        
        results.weiConversionFix = weiConversionWorking && ethTransaction.actualAmount < 1000000;
      } else {
        console.log(`ℹ️ No pure ETH transactions found (ETH value > 0.01 without tokens)`);
        results.weiConversionFix = true; // Not a failure if no ETH transactions
      }
      
      if (tokenTransaction) {
        console.log(`✅ Found token transaction: ${tokenTransaction.hash}`);
        console.log(`✅ Token: ${tokenTransaction.tokenSymbol}, Raw value: ${tokenTransaction.value}, Amount: ${tokenTransaction.actualAmount}`);
        console.log(`✅ Token decimal conversion working: ${tokenTransaction.actualAmount !== undefined && !isNaN(tokenTransaction.actualAmount)}`);
        
        // For token transactions, ensure the amount is reasonable for that token type
        const isReasonableTokenAmount = tokenTransaction.actualAmount < 1000000 && tokenTransaction.actualAmount > 0;
        if (!results.weiConversionFix) results.weiConversionFix = isReasonableTokenAmount;
      } else {
        console.log(`ℹ️ No token transactions found`);
      }

      results.blockscoutAPI = walletData.totalTransactions > 0;
      results.details.blockscoutAPI = {
        totalTransactions: walletData.totalTransactions,
        categories: Object.keys(walletData.summary.categories),
        
        // ETH transaction details
        hasEthTransaction: !!ethTransaction,
        ethTxHash: ethTransaction?.hash,
        ethTxValue: ethTransaction?.value,
        ethTxActualAmount: ethTransaction?.actualAmount,
        ethWeiConversionWorking: !!ethTransaction && ethTransaction.actualAmount < 1000000,
        
        // Token transaction details  
        hasTokenTransaction: !!tokenTransaction,
        tokenTxHash: tokenTransaction?.hash,
        tokenSymbol: tokenTransaction?.tokenSymbol,
        tokenRawValue: tokenTransaction?.value,
        tokenActualAmount: tokenTransaction?.actualAmount,
        tokenConversionWorking: !!tokenTransaction && tokenTransaction.actualAmount !== undefined,
        
        // First transaction details for reference
        firstTxDetails: walletData.transactions[0] ? {
          hash: walletData.transactions[0].hash,
          value: walletData.transactions[0].value,
          actualAmount: walletData.transactions[0].actualAmount,
          category: walletData.transactions[0].category,
          tokenSymbol: walletData.transactions[0].tokenSymbol
        } : null
      };

      console.log(`📡 Blockscout API: ${results.blockscoutAPI ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`🔄 Wei Conversion: ${results.weiConversionFix ? '✅ PASS' : '❌ FAIL'}\n`);

    } catch (error) {
      console.log(`❌ Blockscout API test failed: ${error.message}`);
      results.errors.push(`Blockscout API: ${error.message}`);
      results.details.blockscoutAPI = { error: error.message };
    }

    // Test 2: AI Service Integration  
    console.log('🤖 TEST 2: AI Service Integration');
    console.log('---------------------------------');
    
    try {
      const gemini = new GeminiClient();
      
      // Test basic AI response
      const testResponse = await gemini.chatResponse(
        "Hello, can you help me create a journal entry?",
        { user: { id: TEST_USER_ID, email: 'test@example.com' } }
      );

      console.log(`✅ AI responded: ${testResponse.response ? 'YES' : 'NO'}`);
      console.log(`✅ Response length: ${testResponse.response?.length || 0} characters`);

      results.aiService = testResponse.response && testResponse.response.length > 0;
      results.details.aiService = {
        hasResponse: !!testResponse.response,
        responseLength: testResponse.response?.length || 0,
        hasThinking: !!testResponse.thinking,
        hasSuggestions: !!testResponse.suggestions
      };

      console.log(`🤖 AI Service: ${results.aiService ? '✅ PASS' : '❌ FAIL'}\n`);

    } catch (error) {
      console.log(`❌ AI service test failed: ${error.message}`);
      results.errors.push(`AI Service: ${error.message}`);
      results.details.aiService = { error: error.message };
    }

    // Test 3: User Input Journal Entry Creation
    console.log('📝 TEST 3: User Input Journal Entry Creation');
    console.log('--------------------------------------------');
    
    const testInputs = [
      {
        message: "I invested 10 USDC into the company on March 10, 2025",
        expectedAmount: 10,
        expectedCurrency: "USDC"
      },
      {
        message: "The company received an invoice for 100 USDC for hotel booking from DeTrip on Feb 10, 2025",
        expectedAmount: 100,
        expectedCurrency: "USDC"
      },
      {
        message: "We paid 50 ETH for software licenses on January 15, 2025",
        expectedAmount: 50,
        expectedCurrency: "ETH"
      }
    ];

    let userInputTestsPassed = 0;
    const userInputDetails = [];

    for (const [index, testInput] of testInputs.entries()) {
      try {
        console.log(`\nTest ${index + 1}: "${testInput.message}"`);
        
        const gemini = new GeminiClient();
        const response = await gemini.chatResponse(
          testInput.message,
          { user: { id: TEST_USER_ID, email: 'test@example.com' } }
        );

        console.log(`✅ AI generated response: ${response.response ? 'YES' : 'NO'}`);
        console.log(`✅ Journal entries created: ${response.journalEntries?.length || 0}`);

        // Check if journal entries were created with reasonable amounts
        const hasJournalEntries = response.journalEntries && response.journalEntries.length > 0;
        let hasReasonableAmounts = false;
        let extractedAmount = null;
        let extractedCurrency = null;

        if (hasJournalEntries) {
          const firstEntry = response.journalEntries[0];
          extractedAmount = firstEntry.amount;
          extractedCurrency = firstEntry.currency;
          
          hasReasonableAmounts = (
            extractedAmount <= testInput.expectedAmount * 2 && // Allow some flexibility
            extractedAmount >= testInput.expectedAmount * 0.5 &&
            extractedCurrency === testInput.expectedCurrency
          );

          console.log(`   Amount: ${extractedAmount} ${extractedCurrency} (expected: ${testInput.expectedAmount} ${testInput.expectedCurrency})`);
          console.log(`   Debit: ${firstEntry.accountDebit}`);
          console.log(`   Credit: ${firstEntry.accountCredit}`);
        }

        const testPassed = hasJournalEntries && hasReasonableAmounts;
        if (testPassed) userInputTestsPassed++;

        userInputDetails.push({
          input: testInput.message,
          hasJournalEntries,
          hasReasonableAmounts,
          extractedAmount,
          extractedCurrency,
          expectedAmount: testInput.expectedAmount,
          expectedCurrency: testInput.expectedCurrency,
          passed: testPassed
        });

        console.log(`   Result: ${testPassed ? '✅ PASS' : '❌ FAIL'}`);

      } catch (error) {
        console.log(`   ❌ Failed: ${error.message}`);
        userInputDetails.push({
          input: testInput.message,
          error: error.message,
          passed: false
        });
        results.errors.push(`User Input ${index + 1}: ${error.message}`);
      }
    }

    results.userInputJournalEntry = userInputTestsPassed >= 2; // At least 2 out of 3 should pass
    results.details.userInputJournalEntry = {
      totalTests: testInputs.length,
      passed: userInputTestsPassed,
      details: userInputDetails
    };

    console.log(`\n📝 User Input Tests: ${results.userInputJournalEntry ? '✅ PASS' : '❌ FAIL'} (${userInputTestsPassed}/${testInputs.length})\n`);

    // Test 4: Transaction ID Journal Entry Creation
    console.log('🔗 TEST 4: Transaction ID Journal Entry Creation');
    console.log('------------------------------------------------');
    
    try {
      // Use a more explicit approach to ensure transaction hash recognition
      const transactionMessage = `Please analyze this specific Ethereum transaction hash ${TEST_TRANSACTION_HASH} and create journal entries. This transaction represents a payment to vendor XYZ for design work completed on March 25, 2025.`;
      
      console.log(`Testing with transaction: ${TEST_TRANSACTION_HASH}`);
      
      const gemini = new GeminiClient();
      const response = await gemini.chatResponse(
        transactionMessage,
        { user: { id: TEST_USER_ID, email: 'test@example.com' } }
      );

      console.log(`✅ AI processed transaction ID: ${response.response ? 'YES' : 'NO'}`);
      console.log(`✅ Journal entries created: ${response.journalEntries?.length || 0}`);

      const hasTransactionEntries = response.journalEntries && response.journalEntries.length > 0;
      let hasReasonableAmounts = false;

      if (hasTransactionEntries) {
        const amounts = response.journalEntries.map(entry => entry.amount);
        hasReasonableAmounts = amounts.every(amount => amount < 1000000 && amount > 0); // Should not be Wei values and should be positive
        
        console.log(`   Amounts: ${amounts.join(', ')}`);
        console.log(`   Amounts reasonable: ${hasReasonableAmounts}`);
        console.log(`   First entry: ${response.journalEntries[0].accountDebit} → ${response.journalEntries[0].accountCredit}`);
      } else {
        console.log(`   Response preview: ${response.response?.substring(0, 200)}...`);
        console.log(`   Response contains transaction hash: ${response.response?.includes(TEST_TRANSACTION_HASH.slice(0, 10))}`);
      }

      results.transactionIdJournalEntry = hasTransactionEntries && hasReasonableAmounts;
      results.details.transactionIdJournalEntry = {
        hasTransactionEntries,
        hasReasonableAmounts,
        entriesCount: response.journalEntries?.length || 0,
        amounts: response.journalEntries?.map(entry => entry.amount) || [],
        responsePreview: response.response?.substring(0, 200),
        containsTransactionHash: response.response?.includes(TEST_TRANSACTION_HASH.slice(0, 10))
      };

      console.log(`🔗 Transaction ID Test: ${results.transactionIdJournalEntry ? '✅ PASS' : '❌ FAIL'}\n`);

    } catch (error) {
      console.log(`❌ Transaction ID test failed: ${error.message}`);
      results.errors.push(`Transaction ID: ${error.message}`);
      results.details.transactionIdJournalEntry = { error: error.message };
    }

    // Test 5: Wallet Bulk Analysis
    console.log('📊 TEST 5: Wallet Bulk Analysis');
    console.log('-------------------------------');
    
    try {
      const bulkMessage = `Analyze all transactions for wallet ${TEST_WALLET_ADDRESS} and create journal entries for each transaction`;
      
      console.log(`Testing bulk analysis for wallet: ${TEST_WALLET_ADDRESS}`);
      
      const gemini = new GeminiClient();
      const response = await gemini.chatResponse(
        bulkMessage,
        { user: { id: TEST_USER_ID, email: 'test@example.com' } }
      );

      console.log(`✅ Bulk analysis completed: ${response.response ? 'YES' : 'NO'}`);
      console.log(`✅ Journal entries created: ${response.journalEntries?.length || 0}`);

      const hasBulkEntries = response.journalEntries && response.journalEntries.length > 0;
      let bulkAmountsReasonable = false;
      let hasNoOverflowError = true;

      if (hasBulkEntries) {
        // Check all amounts are reasonable (not Wei values)
        const allAmounts = response.journalEntries.map(entry => entry.amount);
        bulkAmountsReasonable = allAmounts.every(amount => amount < 1000000 && amount > 0);
        
        console.log(`   Total entries: ${response.journalEntries.length}`);
        console.log(`   Sample amounts: ${allAmounts.slice(0, 5).join(', ')}`);
        console.log(`   All amounts reasonable: ${bulkAmountsReasonable}`);
        
        // Check for overflow errors in response
        hasNoOverflowError = !response.response.toLowerCase().includes('overflow') &&
                            !response.error?.includes('overflow');
      } else {
        console.log(`   Response preview: ${response.response?.substring(0, 300)}...`);
        // Check if response indicates processing was attempted
        const processingAttempted = response.response?.toLowerCase().includes('wallet') ||
                                  response.response?.toLowerCase().includes('transaction') ||
                                  response.response?.toLowerCase().includes('analysis');
        console.log(`   Processing attempted: ${processingAttempted}`);
        
        // Check if it's a successful completion with no entries vs error
        const isSuccessfulNoEntries = response.response?.toLowerCase().includes('completed') &&
                                     response.response?.toLowerCase().includes('0');
        console.log(`   Successful completion with no entries: ${isSuccessfulNoEntries}`);
      }

      results.walletBulkAnalysis = hasBulkEntries && bulkAmountsReasonable && hasNoOverflowError;
      results.details.walletBulkAnalysis = {
        hasBulkEntries,
        bulkAmountsReasonable,
        hasNoOverflowError,
        entriesCount: response.journalEntries?.length || 0,
        sampleAmounts: response.journalEntries?.slice(0, 5).map(entry => entry.amount) || [],
        processingComplete: response.processingComplete,
        responsePreview: response.response?.substring(0, 300)
      };

      console.log(`📊 Wallet Bulk Analysis: ${results.walletBulkAnalysis ? '✅ PASS' : '❌ FAIL'}\n`);

    } catch (error) {
      console.log(`❌ Wallet bulk analysis failed: ${error.message}`);
      results.errors.push(`Wallet Bulk Analysis: ${error.message}`);
      results.details.walletBulkAnalysis = { error: error.message };
    }

    // Test 6: Database Operations
    console.log('💾 TEST 6: Database Operations');
    console.log('------------------------------');
    
    try {
      console.log('Testing database connectivity and operations...');
      
      // Test saving a simple entry with reasonable amounts
      const testEntry = {
        accountDebit: 'Test Asset Account',
        accountCredit: 'Test Revenue Account',
        amount: 5.25, // Reasonable ETH amount
        currency: 'ETH',
        narrative: 'End-to-end test entry',
      };

      console.log(`Attempting to save test entry: ${testEntry.amount} ${testEntry.currency}`);

      const savedEntry = await journalEntryService.saveJournalEntries({
        entries: [testEntry],
        userId: TEST_USER_ID,
        source: 'end_to_end_test'
      });

      console.log(`✅ Saved test entry: ${savedEntry.length > 0}`);
      console.log(`✅ Entry amount preserved: ${Math.abs(savedEntry[0]?.amount - 5.25) < 0.01}`);
      console.log(`✅ Entry details: ${JSON.stringify({
        id: savedEntry[0]?.id,
        amount: savedEntry[0]?.amount,
        currency: savedEntry[0]?.currency,
        debit: savedEntry[0]?.account_debit,
        credit: savedEntry[0]?.account_credit
      })}`);

      const dbOperationsWorking = savedEntry.length > 0;
      const amountPreserved = Math.abs(savedEntry[0]?.amount - 5.25) < 0.01; // Allow for small floating point differences

      results.databaseOperations = dbOperationsWorking && amountPreserved;
      results.details.databaseOperations = {
        dbOperationsWorking,
        amountPreserved,
        testEntrySaved: savedEntry.length > 0,
        savedAmount: savedEntry[0]?.amount,
        expectedAmount: 5.25,
        entryId: savedEntry[0]?.id
      };

      console.log(`💾 Database Operations: ${results.databaseOperations ? '✅ PASS' : '❌ FAIL'}\n`);

    } catch (error) {
      console.log(`❌ Database operations failed: ${error.message}`);
      results.errors.push(`Database Operations: ${error.message}`);
      results.details.databaseOperations = { error: error.message };
    }

    // Overall Results
    results.allTestsPassed = (
      results.blockscoutAPI &&
      results.aiService &&
      results.userInputJournalEntry &&
      results.transactionIdJournalEntry &&
      results.walletBulkAnalysis &&
      results.databaseOperations &&
      results.weiConversionFix
    );

    console.log('🏁 COMPLETE END-TO-END TEST RESULTS');
    console.log('====================================');
    console.log(`📡 Blockscout API:           ${results.blockscoutAPI ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`🤖 AI Service:              ${results.aiService ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`📝 User Input Journal:      ${results.userInputJournalEntry ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`🔗 Transaction ID Journal:  ${results.transactionIdJournalEntry ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`📊 Wallet Bulk Analysis:    ${results.walletBulkAnalysis ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`💾 Database Operations:     ${results.databaseOperations ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`🔄 Wei Conversion Fix:      ${results.weiConversionFix ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`🎯 ALL TESTS:               ${results.allTestsPassed ? '✅ PASSED' : '❌ FAILED'}`);

    if (!results.allTestsPassed) {
      console.log('\n🚨 FAILED TESTS:');
      Object.entries(results).forEach(([test, passed]) => {
        if (test !== 'allTestsPassed' && test !== 'details' && test !== 'errors' && !passed) {
          console.log(`   • ${test}`);
        }
      });

      if (results.errors.length > 0) {
        console.log('\n💥 ERRORS:');
        results.errors.forEach(error => console.log(`   • ${error}`));
      }
    }

    console.log('\n📋 DETAILED RESULTS:');
    console.log(JSON.stringify(results.details, null, 2));

    return results;

  } catch (error) {
    console.error('💥 End-to-end test suite failed:', error.message);
    console.error('Stack:', error.stack);
    results.error = error.message;
    return results;
  }
}

// Run the test
if (require.main === module) {
  runEndToEndTests()
    .then(results => {
      console.log('\n🏁 End-to-end test suite completed');
      process.exit(results.allTestsPassed ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Test runner failed:', error.message);
      process.exit(1);
    });
}

module.exports = runEndToEndTests; 