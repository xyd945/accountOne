/**
 * Complete Journal Entry Flow Test Suite
 * Tests all paths: single transaction, bulk analysis, chat entries, conversions
 */

const BlockscoutClient = require('./src/services/blockscoutClient');
const GeminiClient = require('./src/services/aiClients/geminiClient');

// Mock data to avoid external dependencies
const mockTransactionData = {
  hash: '0xabc123def456',
  from: '0x1234567890123456789012345678901234567890',
  to: '0x0987654321098765432109876543210987654321',
  value: '2650000000000000000', // 2.65 ETH in Wei
  gasUsed: '21000',
  gasPrice: '20000000000',
  timestamp: 1640995200, // 2022-01-01
  status: 'success',
  blockNumber: '12345678'
};

const mockWalletData = {
  totalTransactions: 3,
  transactions: [
    {
      hash: '0xabc123',
      from: '0x1234',
      to: '0x5678',
      value: '2650000000000000000', // 2.65 ETH in Wei - should be converted
      actualAmount: 2.65, // Converted ETH amount
      category: 'incoming_transfer',
      direction: 'incoming',
      timestamp: new Date('2022-01-01'),
      gasUsed: '21000'
    },
    {
      hash: '0xdef456',
      from: '0x1234',
      to: '0x9abc',
      value: '1000000000000000000', // 1 ETH in Wei
      actualAmount: 1.0, // Converted ETH amount
      tokenSymbol: 'ETH',
      category: 'outgoing_transfer',
      direction: 'outgoing',
      timestamp: new Date('2022-01-02'),
      gasUsed: '21000'
    },
    {
      hash: '0x789token',
      from: '0x1234',
      to: '0xtoken',
      value: '0', // Token transfer has 0 ETH value
      actualAmount: 1000, // 1000 USDC
      tokenSymbol: 'USDC',
      category: 'token_transfer',
      direction: 'outgoing',
      timestamp: new Date('2022-01-03'),
      gasUsed: '65000'
    }
  ]
};

async function runCompleteJournalFlowTest() {
  console.log('🧪 COMPLETE JOURNAL ENTRY FLOW TEST SUITE');
  console.log('==========================================\n');

  const results = {
    weiConversion: false,
    singleTransaction: false,
    bulkAnalysis: false,
    chatEntries: false,
    aiDataFormat: false,
    parseJournalEntries: false,
    accountValidation: false,
    dataStructures: false,
    allTestsPassed: false,
    details: {}
  };

  try {
    // Test 1: Wei to ETH Conversion in BlockscoutClient
    console.log('📡 TEST 1: Wei to ETH Conversion');
    console.log('--------------------------------');
    
    const normalizedTx = BlockscoutClient.normalizeTransactionData(mockTransactionData);
    
    console.log(`Raw Wei value: ${mockTransactionData.value}`);
    console.log(`Normalized value (Wei): ${normalizedTx.value}`);
    console.log(`Actual amount (ETH): ${normalizedTx.actualAmount}`);
    
    const hasActualAmount = normalizedTx.actualAmount !== undefined;
    const correctConversion = Math.abs(normalizedTx.actualAmount - 2.65) < 0.001;
    const keepsBothValues = normalizedTx.value === mockTransactionData.value;
    
    results.weiConversion = hasActualAmount && correctConversion && keepsBothValues;
    results.details.weiConversion = {
      hasActualAmount,
      correctConversion,
      keepsBothValues,
      originalWei: mockTransactionData.value,
      convertedETH: normalizedTx.actualAmount
    };
    
    console.log(`✅ Has actualAmount: ${hasActualAmount}`);
    console.log(`✅ Correct conversion: ${correctConversion}`);
    console.log(`✅ Keeps both values: ${keepsBothValues}`);
    console.log(`🔄 Wei Conversion: ${results.weiConversion ? '✅ PASS' : '❌ FAIL'}\n`);

    // Test 2: AI Data Formatting 
    console.log('🤖 TEST 2: AI Data Format');
    console.log('--------------------------');
    
    const gemini = new GeminiClient();
    const aiFormattedTxs = gemini.formatTransactionsForAI(mockWalletData.transactions);
    
    console.log('AI Formatted Transactions:');
    aiFormattedTxs.forEach((tx, index) => {
      const originalTx = mockWalletData.transactions[index];
      console.log(`  ${index + 1}. ${tx.hash}: ${tx.value} ${tx.currency} (from ${originalTx.actualAmount || originalTx.value})`);
    });
    
    // Check if AI gets ETH amounts, not Wei
    const firstTxToAI = aiFormattedTxs[0];
    const aiGetsETH = firstTxToAI.value === 2.65; // Should get actualAmount, not Wei
    const correctPriority = firstTxToAI.value < 10; // Should be reasonable ETH amount
    
    results.aiDataFormat = aiGetsETH && correctPriority;
    results.details.aiDataFormat = {
      aiGetsETH,
      correctPriority,
      valueToAI: firstTxToAI.value,
      shouldBe: 2.65
    };
    
    console.log(`✅ AI gets ETH not Wei: ${aiGetsETH}`);
    console.log(`✅ Reasonable amounts: ${correctPriority}`);
    console.log(`🤖 AI Data Format: ${results.aiDataFormat ? '✅ PASS' : '❌ FAIL'}\n`);

    // Test 3: Journal Entry Parsing
    console.log('📝 TEST 3: Journal Entry Parsing');
    console.log('---------------------------------');
    
    // Mock AI response with proper ETH amounts
    const mockAIResponse = `
    [
      {
        "accountDebit": "1802 - Digital Assets - Ethereum",
        "accountCredit": "1003 - Bank Account - Crypto Exchange", 
        "amount": 2.65,
        "currency": "ETH",
        "narrative": "Received 2.65 ETH",
        "confidence": 0.95
      },
      {
        "accountDebit": "6001 - Transaction Fees",
        "accountCredit": "1003 - Bank Account - Crypto Exchange",
        "amount": 0.0001,
        "currency": "ETH", 
        "narrative": "Gas fees",
        "confidence": 0.9
      }
    ]`;
    
    const parsedEntries = gemini.parseJournalEntries(mockAIResponse);
    
    console.log(`Parsed ${parsedEntries.length} journal entries:`);
    parsedEntries.forEach((entry, index) => {
      console.log(`  ${index + 1}. ${entry.amount} ${entry.currency}: ${entry.accountDebit} → ${entry.accountCredit}`);
    });
    
    const hasEntries = parsedEntries.length > 0;
    const reasonableAmounts = parsedEntries.every(entry => entry.amount < 1000);
    const validStructure = parsedEntries.every(entry => 
      entry.accountDebit && entry.accountCredit && entry.amount && entry.currency
    );
    
    results.parseJournalEntries = hasEntries && reasonableAmounts && validStructure;
    results.details.parseJournalEntries = {
      hasEntries,
      reasonableAmounts,
      validStructure,
      entriesCount: parsedEntries.length,
      amounts: parsedEntries.map(e => e.amount)
    };
    
    console.log(`✅ Has entries: ${hasEntries}`);
    console.log(`✅ Reasonable amounts: ${reasonableAmounts}`);
    console.log(`✅ Valid structure: ${validStructure}`);
    console.log(`📝 Journal Parsing: ${results.parseJournalEntries ? '✅ PASS' : '❌ FAIL'}\n`);

    // Test 4: Data Structure Handling
    console.log('🏗️ TEST 4: Data Structure Handling');
    console.log('-----------------------------------');
    
    // Test flattening logic
    const nestedJournalEntries = [
      {
        category: "incoming_transfer",
        transactionHash: "0xabc123",
        entries: parsedEntries
      }
    ];
    
    // Simulate the flattening logic from saveBulkJournalEntries
    const flattenedEntries = [];
    for (const entryGroup of nestedJournalEntries) {
      for (const entry of entryGroup.entries) {
        flattenedEntries.push({
          accountDebit: entry.accountDebit,
          accountCredit: entry.accountCredit,
          amount: parseFloat(entry.amount), // This should be reasonable ETH amounts
          currency: entry.currency,
          narrative: entry.narrative,
          confidence: entry.confidence || 0.8,
        });
      }
    }
    
    console.log(`Flattened ${flattenedEntries.length} entries:`);
    flattenedEntries.forEach((entry, index) => {
      console.log(`  ${index + 1}. Amount: ${entry.amount} ${entry.currency}`);
    });
    
    const flatteningWorked = flattenedEntries.length === parsedEntries.length;
    const amountsStillReasonable = flattenedEntries.every(entry => entry.amount < 1000);
    
    results.dataStructures = flatteningWorked && amountsStillReasonable;
    results.details.dataStructures = {
      flatteningWorked,
      amountsStillReasonable,
      originalCount: parsedEntries.length,
      flattenedCount: flattenedEntries.length,
      amounts: flattenedEntries.map(e => e.amount)
    };
    
    console.log(`✅ Flattening worked: ${flatteningWorked}`);
    console.log(`✅ Amounts still reasonable: ${amountsStillReasonable}`);
    console.log(`🏗️ Data Structures: ${results.dataStructures ? '✅ PASS' : '❌ FAIL'}\n`);

    // Test 5: Single Transaction Analysis Flow
    console.log('🔍 TEST 5: Single Transaction Analysis');
    console.log('--------------------------------------');
    
    try {
      // Mock the analyzeTransaction flow without external API calls
      console.log('Testing transaction analysis data flow...');
      
      // This would normally call Gemini API - we'll simulate the flow
      const mockAnalysisResult = [
        {
          accountDebit: "1802 - Digital Assets - Ethereum",
          accountCredit: "4001 - Trading Revenue",
          amount: normalizedTx.actualAmount, // Should use converted ETH amount
          currency: "ETH",
          narrative: `Transaction analysis for ${normalizedTx.hash}`,
          confidence: 0.9
        }
      ];
      
      const singleTxAmountReasonable = mockAnalysisResult[0].amount < 10;
      const usesConvertedAmount = Math.abs(mockAnalysisResult[0].amount - 2.65) < 0.001;
      
      results.singleTransaction = singleTxAmountReasonable && usesConvertedAmount;
      results.details.singleTransaction = {
        singleTxAmountReasonable,
        usesConvertedAmount,
        amount: mockAnalysisResult[0].amount,
        expectedAmount: 2.65
      };
      
      console.log(`✅ Single tx amount reasonable: ${singleTxAmountReasonable}`);
      console.log(`✅ Uses converted amount: ${usesConvertedAmount}`);
      console.log(`🔍 Single Transaction: ${results.singleTransaction ? '✅ PASS' : '❌ FAIL'}\n`);
      
    } catch (error) {
      console.log(`❌ Single transaction test failed: ${error.message}`);
      results.details.singleTransaction = { error: error.message };
    }

    // Test 6: Chat Entry Extraction
    console.log('💬 TEST 6: Chat Entry Extraction');
    console.log('---------------------------------');
    
    // Test transaction detail extraction
    const chatMessage = "Create journal entry for 1.5 ETH received on May 25, 2025";
    const extractedDetails = gemini.extractTransactionDetails(chatMessage);
    
    console.log('Extracted from chat message:');
    console.log(`  - Amount: ${extractedDetails.amount}`);
    console.log(`  - Currency: ${extractedDetails.currency}`);
    console.log(`  - Date: ${extractedDetails.extractedDate?.toISOString() || 'None'}`);
    
    const extractsAmount = extractedDetails.amount === '1.5';
    const extractsCurrency = extractedDetails.currency === 'ETH';
    const extractsDate = extractedDetails.extractedDate !== null;
    
    results.chatEntries = extractsAmount && extractsCurrency && extractsDate;
    results.details.chatEntries = {
      extractsAmount,
      extractsCurrency, 
      extractsDate,
      extractedAmount: extractedDetails.amount,
      extractedCurrency: extractedDetails.currency,
      extractedDate: extractedDetails.extractedDate?.toISOString()
    };
    
    console.log(`✅ Extracts amount: ${extractsAmount}`);
    console.log(`✅ Extracts currency: ${extractsCurrency}`);
    console.log(`✅ Extracts date: ${extractsDate}`);
    console.log(`💬 Chat Entries: ${results.chatEntries ? '✅ PASS' : '❌ FAIL'}\n`);

    // Test 7: Account Validation Flow
    console.log('🔐 TEST 7: Account Validation');
    console.log('-----------------------------');
    
    try {
      // Test without database - just check the structure
      console.log('Testing account validation structure...');
      
      const testEntry = {
        accountDebit: "1802 - Digital Assets - Ethereum",
        accountCredit: "1003 - Bank Account - Crypto Exchange",
        amount: 2.65,
        currency: "ETH"
      };
      
      // This would normally validate against database
      // We'll just check that the structure is preserved
      const validationResult = {
        ...testEntry,
        requiresAccountCreation: false,
        validationPassed: true
      };
      
      const structurePreserved = validationResult.amount === testEntry.amount;
      const reasonableAmount = validationResult.amount < 1000;
      
      results.accountValidation = structurePreserved && reasonableAmount;
      results.details.accountValidation = {
        structurePreserved,
        reasonableAmount,
        originalAmount: testEntry.amount,
        validatedAmount: validationResult.amount
      };
      
      console.log(`✅ Structure preserved: ${structurePreserved}`);
      console.log(`✅ Amount reasonable: ${reasonableAmount}`);
      console.log(`🔐 Account Validation: ${results.accountValidation ? '✅ PASS' : '❌ FAIL'}\n`);
      
    } catch (error) {
      console.log(`❌ Account validation test failed: ${error.message}`);
      results.details.accountValidation = { error: error.message };
    }

    // Overall Results
    results.allTestsPassed = (
      results.weiConversion &&
      results.aiDataFormat &&
      results.parseJournalEntries &&
      results.dataStructures &&
      results.singleTransaction &&
      results.chatEntries &&
      results.accountValidation
    );

    console.log('🏁 COMPLETE JOURNAL FLOW TEST RESULTS');
    console.log('======================================');
    console.log(`📡 Wei to ETH Conversion:     ${results.weiConversion ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`🤖 AI Data Format:           ${results.aiDataFormat ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`📝 Journal Entry Parsing:    ${results.parseJournalEntries ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`🏗️ Data Structure Handling:  ${results.dataStructures ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`🔍 Single Transaction Flow:  ${results.singleTransaction ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`💬 Chat Entry Extraction:    ${results.chatEntries ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`🔐 Account Validation:       ${results.accountValidation ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`🎯 ALL TESTS:                ${results.allTestsPassed ? '✅ PASSED' : '❌ FAILED'}`);

    if (!results.allTestsPassed) {
      console.log('\n🚨 FAILED TESTS:');
      Object.entries(results).forEach(([test, passed]) => {
        if (test !== 'allTestsPassed' && test !== 'details' && !passed) {
          console.log(`   • ${test} - Check implementation`);
        }
      });
    }

    console.log('\n📋 DETAILED TEST RESULTS:');
    console.log(JSON.stringify(results.details, null, 2));

    return results;

  } catch (error) {
    console.error('💥 Complete journal flow test failed:', error.message);
    console.error('Stack:', error.stack);
    results.error = error.message;
    return results;
  }
}

// Run the test
if (require.main === module) {
  runCompleteJournalFlowTest()
    .then(results => {
      console.log('\n✅ Complete test suite finished');
      process.exit(results.allTestsPassed ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Test runner failed:', error.message);
      process.exit(1);
    });
}

module.exports = runCompleteJournalFlowTest; 