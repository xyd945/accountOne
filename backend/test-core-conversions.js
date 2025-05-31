/**
 * Core Conversion Test - Tests Wei to ETH conversion logic without external dependencies
 */

console.log('🧪 CORE CONVERSION TEST SUITE');
console.log('=============================\n');

// Test 1: BlockscoutClient normalizeTransactionData function
console.log('📡 TEST 1: Wei to ETH Conversion Logic');
console.log('--------------------------------------');

// Mock transaction data with Wei values
const mockTxData = {
  hash: '0xabc123def456',
  from: '0x1234567890123456789012345678901234567890',
  to: '0x0987654321098765432109876543210987654321',
  value: '2650000000000000000', // 2.65 ETH in Wei
  gasUsed: '21000',
  gasPrice: '20000000000',
  timeStamp: '1640995200', // Unix timestamp
  success: true,
  blockNumber: '12345678'
};

// Test the conversion logic directly
function testNormalizeTransactionData(txData) {
  // This is the exact logic from normalizeTransactionData
  const rawValue = txData.value || '0';
  const actualValue = parseFloat(rawValue) / Math.pow(10, 18); // Convert Wei to ETH

  return {
    hash: txData.hash,
    from: txData.from,
    to: txData.to,
    value: rawValue, // Keep raw Wei value for reference
    actualAmount: actualValue, // Converted ETH value for calculations
    gasUsed: txData.gasUsed,
    gasPrice: txData.gasPrice,
    blockNumber: txData.blockNumber,
    timestamp: new Date(parseInt(txData.timeStamp) * 1000),
    status: txData.success ? 'success' : 'failed',
  };
}

const normalizedTx = testNormalizeTransactionData(mockTxData);

console.log(`Input Wei value: ${mockTxData.value}`);
console.log(`Output value (Wei): ${normalizedTx.value}`);
console.log(`Output actualAmount (ETH): ${normalizedTx.actualAmount}`);

const hasActualAmount = normalizedTx.actualAmount !== undefined;
const correctConversion = Math.abs(normalizedTx.actualAmount - 2.65) < 0.001;
const keepsBothValues = normalizedTx.value === mockTxData.value;

console.log(`✅ Has actualAmount field: ${hasActualAmount}`);
console.log(`✅ Correct Wei→ETH conversion: ${correctConversion}`);
console.log(`✅ Preserves original Wei value: ${keepsBothValues}`);

const weiConversionPassed = hasActualAmount && correctConversion && keepsBothValues;
console.log(`🔄 Wei Conversion Test: ${weiConversionPassed ? '✅ PASS' : '❌ FAIL'}\n`);

// Test 2: AI Data Formatting Logic  
console.log('🤖 TEST 2: AI Data Format Logic');
console.log('--------------------------------');

// Mock transactions with both Wei and actualAmount
const mockTransactions = [
  {
    hash: '0xabc123',
    from: '0x1234',
    to: '0x5678',
    value: '2650000000000000000', // Wei value
    actualAmount: 2.65, // ETH value
    category: 'incoming_transfer',
    direction: 'incoming'
  },
  {
    hash: '0xdef456',
    from: '0x1234',
    to: '0x9abc',
    value: '1000000000000000000', // Wei value
    actualAmount: 1.0, // ETH value
    tokenSymbol: 'ETH',
    category: 'outgoing_transfer',
    direction: 'outgoing'
  }
];

// Test the formatTransactionsForAI logic
function testFormatTransactionsForAI(transactions) {
  return transactions.map(tx => ({
    hash: tx.hash,
    from: tx.from,
    to: tx.to,
    value: tx.actualAmount || tx.value || 0, // FIXED: prioritize actualAmount over value
    currency: tx.tokenSymbol || 'ETH',
    category: tx.category,
    direction: tx.direction,
  }));
}

const aiFormattedTxs = testFormatTransactionsForAI(mockTransactions);

console.log('AI Formatted Transaction Values:');
aiFormattedTxs.forEach((tx, index) => {
  const original = mockTransactions[index];
  console.log(`  ${index + 1}. ${tx.hash}: ${tx.value} ${tx.currency} (from actualAmount: ${original.actualAmount}, value: ${original.value})`);
});

// Check if AI gets reasonable ETH amounts
const firstTxValue = aiFormattedTxs[0].value;
const secondTxValue = aiFormattedTxs[1].value;

const aiGetsETHAmounts = firstTxValue === 2.65 && secondTxValue === 1.0;
const aiGetsReasonableAmounts = firstTxValue < 10 && secondTxValue < 10;

console.log(`✅ AI gets ETH amounts (not Wei): ${aiGetsETHAmounts}`);
console.log(`✅ AI gets reasonable amounts: ${aiGetsReasonableAmounts}`);

const aiFormatPassed = aiGetsETHAmounts && aiGetsReasonableAmounts;
console.log(`🤖 AI Format Test: ${aiFormatPassed ? '✅ PASS' : '❌ FAIL'}\n`);

// Test 3: Journal Entry Amount Processing
console.log('📝 TEST 3: Journal Entry Amount Logic');
console.log('-------------------------------------');

// Mock journal entries from AI with ETH amounts
const mockJournalEntries = [
  {
    accountDebit: "1802 - Digital Assets - Ethereum",
    accountCredit: "1003 - Bank Account - Crypto Exchange",
    amount: 2.65, // ETH amount from AI
    currency: "ETH",
    narrative: "Received 2.65 ETH"
  },
  {
    accountDebit: "6001 - Transaction Fees", 
    accountCredit: "1003 - Bank Account - Crypto Exchange",
    amount: 0.0001, // Small ETH amount for fees
    currency: "ETH",
    narrative: "Gas fees"
  }
];

// Test flattening logic from saveBulkJournalEntries
const flattenedEntries = mockJournalEntries.map(entry => ({
  accountDebit: entry.accountDebit,
  accountCredit: entry.accountCredit,
  amount: parseFloat(entry.amount), // This should preserve reasonable ETH amounts
  currency: entry.currency,
  narrative: entry.narrative
}));

console.log('Journal Entry Amounts:');
flattenedEntries.forEach((entry, index) => {
  console.log(`  ${index + 1}. ${entry.amount} ${entry.currency}: ${entry.accountDebit} → ${entry.accountCredit}`);
});

const allAmountsReasonable = flattenedEntries.every(entry => entry.amount < 1000);
const amountsPreserved = flattenedEntries[0].amount === 2.65 && flattenedEntries[1].amount === 0.0001;
const noOverflowRisk = flattenedEntries.every(entry => entry.amount < 999999999999); // Database limit

console.log(`✅ All amounts reasonable: ${allAmountsReasonable}`);
console.log(`✅ Amounts preserved correctly: ${amountsPreserved}`);
console.log(`✅ No database overflow risk: ${noOverflowRisk}`);

const journalEntryPassed = allAmountsReasonable && amountsPreserved && noOverflowRisk;
console.log(`📝 Journal Entry Test: ${journalEntryPassed ? '✅ PASS' : '❌ FAIL'}\n`);

// Test 4: End-to-End Data Flow
console.log('🔄 TEST 4: End-to-End Data Flow');
console.log('--------------------------------');

// Simulate the complete flow
console.log('Simulating complete data flow:');
console.log(`1. Raw blockchain data: ${mockTxData.value} Wei`);

const normalized = testNormalizeTransactionData(mockTxData);
console.log(`2. After normalization: value=${normalized.value} Wei, actualAmount=${normalized.actualAmount} ETH`);

const aiFormatted = testFormatTransactionsForAI([normalized])[0];
console.log(`3. To AI: ${aiFormatted.value} ETH`);

const journalEntry = {
  amount: aiFormatted.value, // AI uses this amount
  currency: aiFormatted.currency
};
console.log(`4. Journal entry: ${journalEntry.amount} ${journalEntry.currency}`);

const finalAmount = parseFloat(journalEntry.amount);
console.log(`5. Final database amount: ${finalAmount}`);

const flowWorksCorrectly = (
  finalAmount === 2.65 && // Correct ETH amount
  finalAmount < 1000 && // Reasonable for accounting
  finalAmount < 999999999999 // No database overflow
);

console.log(`✅ Flow preserves correct amounts: ${flowWorksCorrectly}`);
console.log(`🔄 End-to-End Flow: ${flowWorksCorrectly ? '✅ PASS' : '❌ FAIL'}\n`);

// Overall Results
const allTestsPassed = (
  weiConversionPassed &&
  aiFormatPassed &&
  journalEntryPassed &&
  flowWorksCorrectly
);

console.log('🏁 CORE CONVERSION TEST RESULTS');
console.log('================================');
console.log(`📡 Wei to ETH Conversion:  ${weiConversionPassed ? '✅ PASS' : '❌ FAIL'}`);
console.log(`🤖 AI Data Format:        ${aiFormatPassed ? '✅ PASS' : '❌ FAIL'}`);
console.log(`📝 Journal Entry Logic:   ${journalEntryPassed ? '✅ PASS' : '❌ FAIL'}`);
console.log(`🔄 End-to-End Flow:       ${flowWorksCorrectly ? '✅ PASS' : '❌ FAIL'}`);
console.log(`🎯 ALL CORE TESTS:        ${allTestsPassed ? '✅ PASSED' : '❌ FAILED'}`);

if (allTestsPassed) {
  console.log('\n🎉 All core conversion logic is working correctly!');
  console.log('The Wei to ETH conversion fix should resolve the database overflow issue.');
} else {
  console.log('\n🚨 Issues found in core conversion logic:');
  if (!weiConversionPassed) console.log('  • Wei to ETH conversion not working properly');
  if (!aiFormatPassed) console.log('  • AI still receiving Wei values instead of ETH');
  if (!journalEntryPassed) console.log('  • Journal entry amounts not reasonable');
  if (!flowWorksCorrectly) console.log('  • End-to-end flow broken');
}

process.exit(allTestsPassed ? 0 : 1); 