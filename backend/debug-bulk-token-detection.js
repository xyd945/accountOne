require('dotenv').config();

const BlockscoutClient = require('./src/services/blockscoutClient');
const GeminiClient = require('./src/services/aiClients/geminiClient');

async function debugBulkTokenDetection() {
  console.log('🔍 DEBUGGING BULK ANALYSIS - XYD TOKEN DETECTION');
  console.log('================================================\n');

  const TEST_WALLET = '0x862847B44845eD331dc8FA211Df3C01eCBB1b38C';
  const XYD_TOKEN_CONTRACT = '0xA05FecE52B5ba199c03FD265B567c0F1C7a84891';
  
  console.log(`Testing wallet: ${TEST_WALLET}`);
  console.log(`XYD token contract: ${XYD_TOKEN_CONTRACT}\n`);

  try {
    // Step 1: Get raw transaction data from Blockscout
    console.log('📡 STEP 1: Fetching raw transaction data...');
    const walletData = await BlockscoutClient.getWalletTransactions(TEST_WALLET, {
      limit: 10,
      includeTokens: true,
      includeInternal: true
    });

    console.log(`✅ Found ${walletData.totalTransactions} transactions`);
    console.log(`Categories: ${Object.keys(walletData.summary.categories).join(', ')}\n`);

    // Step 2: Analyze individual transactions for token detection
    console.log('🔍 STEP 2: Analyzing transaction token detection...');
    console.log('─'.repeat(80));

    let xydTransactions = [];
    let ethTransactions = [];
    let issues = [];

    walletData.transactions.slice(0, 5).forEach((tx, index) => {
      console.log(`\nTransaction ${index + 1}:`);
      console.log(`  Hash: ${tx.hash}`);
      console.log(`  Category: ${tx.category}`);
      console.log(`  Direction: ${tx.direction}`);
      console.log(`  Actual Amount: ${tx.actualAmount}`);
      console.log(`  Token Symbol: ${tx.tokenSymbol || 'NONE'}`);
      console.log(`  Network Currency: ${tx.networkCurrency || 'UNKNOWN'}`);
      console.log(`  Is Token Transfer: ${tx.isTokenTransfer || false}`);
      
      if (tx.tokenTransfer) {
        console.log(`  Token Transfer Details:`);
        console.log(`    Token: ${tx.tokenTransfer.tokenSymbol}`);
        console.log(`    Amount: ${tx.tokenTransfer.tokenAmount}`);
        console.log(`    From: ${tx.tokenTransfer.from}`);
        console.log(`    To: ${tx.tokenTransfer.to}`);
      }
      
      // Categorize the transaction
      if (tx.tokenSymbol === 'XYD' || 
          (tx.tokenTransfer && tx.tokenTransfer.tokenSymbol === 'XYD')) {
        xydTransactions.push(tx);
        console.log(`  ✅ Correctly identified as XYD token transfer`);
      } else if (tx.tokenSymbol === 'ETH' || 
                 (!tx.tokenSymbol && tx.actualAmount > 0)) {
        ethTransactions.push(tx);
        
        // Check if this might actually be an XYD transaction misidentified
        if (tx.to?.toLowerCase() === XYD_TOKEN_CONTRACT.toLowerCase() ||
            tx.from?.toLowerCase() === XYD_TOKEN_CONTRACT.toLowerCase()) {
          issues.push(`Transaction ${index + 1}: Involves XYD contract but detected as ETH`);
          console.log(`  ❌ ISSUE: Involves XYD contract but detected as ETH`);
        } else {
          console.log(`  ℹ️ Appears to be genuine ETH/C2FLR transaction`);
        }
      } else {
        console.log(`  ⚠️ Unknown transaction type`);
      }
    });

    console.log('\n📊 STEP 3: Transaction Summary');
    console.log('─'.repeat(40));
    console.log(`XYD token transactions: ${xydTransactions.length}`);
    console.log(`ETH/C2FLR transactions: ${ethTransactions.length}`);
    console.log(`Issues found: ${issues.length}`);
    
    if (issues.length > 0) {
      console.log('\n❌ ISSUES DETECTED:');
      issues.forEach(issue => console.log(`  ${issue}`));
    }

    // Step 3: Test how AI processes this data
    console.log('\n🤖 STEP 4: Testing AI processing of transaction data...');
    console.log('─'.repeat(60));

    const gemini = new GeminiClient();
    
    // Get transaction groups as they would be processed in bulk analysis
    const transactionGroups = gemini.groupTransactionsByCategory(walletData.transactions.slice(0, 3));
    
    console.log('Transaction groups created:');
    Object.entries(transactionGroups).forEach(([category, txs]) => {
      console.log(`  ${category}: ${txs.length} transactions`);
      
      txs.forEach((tx, i) => {
        console.log(`    ${i + 1}. ${tx.hash.slice(0, 10)}... - ${tx.tokenSymbol || 'NO_TOKEN'} - ${tx.actualAmount}`);
      });
    });

    // Step 4: Test formatTransactionsForAI
    console.log('\n📝 STEP 5: Testing transaction formatting for AI...');
    console.log('─'.repeat(50));

    if (transactionGroups.token_transfer && transactionGroups.token_transfer.length > 0) {
      const formattedTxs = gemini.formatTransactionsForAI(transactionGroups.token_transfer, 'token_transfer');
      
      console.log('Formatted token transfer transactions:');
      formattedTxs.forEach((tx, i) => {
        console.log(`Transaction ${i + 1}:`);
        console.log(`  Hash: ${tx.hash}`);
        console.log(`  Value: ${tx.value}`);
        console.log(`  Currency: ${tx.currency}`);
        console.log(`  Category: ${tx.category}`);
        console.log(`  Direction: ${tx.direction}`);
        
        if (tx.currency === 'ETH' && tx.hash.includes('xyd')) {
          console.log(`  ❌ PROBLEM: XYD transaction formatted as ETH!`);
        } else if (tx.currency === 'XYD') {
          console.log(`  ✅ Correctly formatted as XYD`);
        }
      });
    } else {
      console.log('No token_transfer category found in groups');
    }

    // Step 5: Test a small bulk analysis
    console.log('\n🔬 STEP 6: Testing actual bulk analysis...');
    console.log('─'.repeat(45));

    try {
      const bulkResult = await gemini.analyzeBulkTransactions(
        TEST_WALLET,
        { limit: 3, includeTokens: true },
        null // Don't save for testing
      );

      console.log(`Bulk analysis completed: ${bulkResult.success}`);
      console.log(`Journal entries generated: ${bulkResult.journalEntries?.length || 0}`);
      
      if (bulkResult.journalEntries && bulkResult.journalEntries.length > 0) {
        console.log('\nAnalyzing generated journal entries:');
        
        bulkResult.journalEntries.forEach((entryGroup, i) => {
          if (entryGroup.entries) {
            // Nested structure
            entryGroup.entries.forEach((entry, j) => {
              console.log(`Entry ${i + 1}.${j + 1}:`);
              console.log(`  Currency: ${entry.currency}`);
              console.log(`  Amount: ${entry.amount}`);
              console.log(`  Debit: ${entry.accountDebit}`);
              console.log(`  Credit: ${entry.accountCredit}`);
              
              if (entry.currency === 'ETH' && entryGroup.transactionHash) {
                console.log(`  ❌ ISSUE: ETH currency in entry for hash ${entryGroup.transactionHash}`);
              }
            });
          } else {
            // Flat structure
            console.log(`Entry ${i + 1}:`);
            console.log(`  Currency: ${entryGroup.currency}`);
            console.log(`  Amount: ${entryGroup.amount}`);
          }
        });
      }

    } catch (bulkError) {
      console.log(`❌ Bulk analysis failed: ${bulkError.message}`);
    }

  } catch (error) {
    console.log(`❌ Debug failed: ${error.message}`);
    console.log(`Stack: ${error.stack}`);
  }
}

// Run the debug
if (require.main === module) {
  debugBulkTokenDetection()
    .then(() => {
      console.log('\n🏁 Bulk token detection debug completed');
    })
    .catch(error => {
      console.error('💥 Debug failed:', error.message);
    });
}

module.exports = debugBulkTokenDetection; 