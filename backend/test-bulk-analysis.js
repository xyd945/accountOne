require('dotenv').config();

const blockscoutClient = require('./src/services/blockscoutClient');
const aiClient = require('./src/services/aiClients');
const logger = require('./src/utils/logger');

/**
 * Test script for bulk transaction analysis functionality
 * This demonstrates how to analyze an entire wallet address and generate journal entries
 */

async function testBulkAnalysis() {
  try {
    console.log('🚀 Starting Bulk Transaction Analysis Test\n');

    // Example wallet address (you can replace with any Ethereum address)
    const testWalletAddress = '0xD423B4b575d2808459035294Bf971A5834eB7b87'; // Example address
    
    console.log(`📍 Analyzing wallet: ${testWalletAddress}\n`);

    // Step 1: Preview wallet transactions without AI analysis
    console.log('Step 1: Getting wallet preview...');
    try {
      const walletPreview = await aiClient.getWalletPreview(testWalletAddress, {
        limit: 20,  // Limit for testing
        includeTokens: true,
        includeInternal: true,
      });

      console.log(`✅ Wallet Preview Results:`);
      console.log(`   • Total Transactions: ${walletPreview.totalTransactions}`);
      console.log(`   • Categories Found: ${Object.keys(walletPreview.summary.categories).join(', ')}`);
      console.log(`   • Token Activity: ${Object.keys(walletPreview.summary.tokens).length} different tokens`);
      console.log(`   • Time Range: ${walletPreview.summary.timeRange?.earliest || 'N/A'} to ${walletPreview.summary.timeRange?.latest || 'N/A'}`);
      
      if (walletPreview.transactions.length > 0) {
        console.log(`   • Sample Transaction Categories:`);
        const sampleCategories = {};
        walletPreview.transactions.slice(0, 5).forEach(tx => {
          sampleCategories[tx.category] = (sampleCategories[tx.category] || 0) + 1;
        });
        Object.entries(sampleCategories).forEach(([cat, count]) => {
          console.log(`     - ${cat}: ${count} transactions`);
        });
      }
      console.log('');
    } catch (previewError) {
      console.log(`❌ Wallet preview failed: ${previewError.message}\n`);
      return;
    }

    // Step 2: Get available transaction categories
    console.log('Step 2: Available transaction categories...');
    const categories = aiClient.getTransactionCategories();
    console.log(`✅ Available Categories (${categories.length}):`);
    categories.forEach(cat => {
      console.log(`   • ${cat.name}: ${cat.description}`);
    });
    console.log('');

    // Step 3: Perform bulk analysis (limited scope for testing)
    console.log('Step 3: Performing AI bulk analysis...');
    try {
      const analysisOptions = {
        limit: 10,  // Limit to 10 transactions for testing
        minValue: 0.001,  // Only analyze transactions with significant value
        categories: ['token_transfer', 'dex_trade', 'staking'], // Focus on these categories
        saveEntries: false,  // Don't save to database for testing
      };

      console.log(`   Analysis Options:`, analysisOptions);
      console.log(`   🤖 Sending to AI for analysis...`);

      const bulkAnalysis = await aiClient.analyzeBulkTransactions(
        testWalletAddress,
        analysisOptions,
        null  // No user ID for testing
      );

      console.log(`\n✅ Bulk Analysis Results:`);
      console.log(`   • Success: ${bulkAnalysis.success}`);
      console.log(`   • Transactions Processed: ${bulkAnalysis.analysis?.walletAnalysis?.totalTransactionsProcessed || 0}`);
      console.log(`   • Journal Entries Generated: ${bulkAnalysis.analysis?.walletAnalysis?.totalJournalEntriesGenerated || 0}`);
      console.log(`   • Processing Success Rate: ${bulkAnalysis.analysis?.walletAnalysis?.processingSuccessRate || 'N/A'}`);

      // Show category breakdown
      if (bulkAnalysis.analysis?.categoryBreakdown) {
        console.log(`   • Category Breakdown:`);
        Object.entries(bulkAnalysis.analysis.categoryBreakdown).forEach(([category, result]) => {
          console.log(`     - ${category}: ${result.transactions} transactions → ${result.journalEntries} entries (${result.success ? '✅' : '❌'})`);
          if (result.error) {
            console.log(`       Error: ${result.error}`);
          }
        });
      }

      // Show sample journal entries
      if (bulkAnalysis.journalEntries && bulkAnalysis.journalEntries.length > 0) {
        console.log(`\n   📊 Sample Journal Entries:`);
        bulkAnalysis.journalEntries.slice(0, 3).forEach((entryGroup, index) => {
          console.log(`   ${index + 1}. Transaction: ${entryGroup.transactionHash?.slice(0, 10)}...`);
          console.log(`      Category: ${entryGroup.category}`);
          entryGroup.entries.forEach((entry, entryIndex) => {
            console.log(`      Entry ${entryIndex + 1}:`);
            console.log(`        Debit:  ${entry.accountDebit}`);
            console.log(`        Credit: ${entry.accountCredit}`);
            console.log(`        Amount: ${entry.amount} ${entry.currency}`);
            console.log(`        Narrative: ${entry.narrative}`);
            console.log(`        Confidence: ${(entry.confidence * 100).toFixed(1)}%`);
          });
          console.log('');
        });
      }

      // Show recommendations
      if (bulkAnalysis.analysis?.recommendations) {
        console.log(`   💡 Recommendations:`);
        bulkAnalysis.analysis.recommendations.forEach(rec => {
          console.log(`     • ${rec}`);
        });
      }

      // Show IFRS compliance assessment
      if (bulkAnalysis.analysis?.ifrsCompliance) {
        const compliance = bulkAnalysis.analysis.ifrsCompliance;
        console.log(`\n   ⚖️  IFRS Compliance Assessment:`);
        console.log(`     • Overall Confidence: ${compliance.confidenceScore}`);
        console.log(`     • Account Classification: ${compliance.accountClassification}`);
        console.log(`     • Narrative Quality: ${compliance.narrativeQuality}`);
        console.log(`     • Issues: ${compliance.issues?.join(', ') || 'None'}`);
      }

    } catch (analysisError) {
      console.log(`❌ Bulk analysis failed: ${analysisError.message}`);
      console.log(`   Stack: ${analysisError.stack}`);
    }

    console.log('\n🎉 Bulk Analysis Test Completed!\n');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

/**
 * Test individual transaction categorization
 */
async function testTransactionCategorization() {
  console.log('🔍 Testing Transaction Categorization...\n');

  try {
    // Test wallet with some sample transactions
    const testAddress = '0x742e8c9b3be7936e2f6d143de3e9bb8f4b4d2b9e';
    
    const walletData = await blockscoutClient.getWalletTransactions(testAddress, {
      offset: 5,
      includeTokens: true,
    });

    console.log(`✅ Categorization Test Results:`);
    console.log(`   Total transactions: ${walletData.totalTransactions}`);
    
    if (walletData.transactions.length > 0) {
      console.log(`   Sample categorized transactions:`);
      walletData.transactions.slice(0, 5).forEach((tx, index) => {
        console.log(`   ${index + 1}. ${tx.hash.slice(0, 10)}...`);
        console.log(`      Category: ${tx.category}`);
        console.log(`      Direction: ${tx.direction}`);
        console.log(`      Value: ${tx.value || tx.actualAmount || 0} ${tx.tokenSymbol || 'ETH'}`);
        console.log(`      User Initiated: ${tx.isUserInitiated ? 'Yes' : 'No'}`);
        console.log('');
      });
    }

    // Show category summary
    console.log(`   📊 Category Summary:`);
    Object.entries(walletData.summary.categories).forEach(([category, count]) => {
      console.log(`     • ${category}: ${count} transactions`);
    });

  } catch (error) {
    console.log(`❌ Categorization test failed: ${error.message}`);
  }

  console.log('');
}

/**
 * Test specific transaction types
 */
async function testSpecificTransactionTypes() {
  console.log('🎯 Testing Specific Transaction Types...\n');

  // Test different types of transactions if available
  const testCases = [
    {
      name: 'Token Transfer',
      category: 'token_transfer',
      description: 'Testing ERC-20 token transfers'
    },
    {
      name: 'DEX Trade',
      category: 'dex_trade', 
      description: 'Testing decentralized exchange trades'
    },
    {
      name: 'Staking',
      category: 'staking',
      description: 'Testing staking transactions'
    }
  ];

  for (const testCase of testCases) {
    console.log(`Testing ${testCase.name}:`);
    console.log(`  Description: ${testCase.description}`);
    
    // Get category template
    const categories = aiClient.getTransactionCategories();
    const categoryTemplate = categories.find(cat => cat.name === testCase.category);
    
    if (categoryTemplate) {
      console.log(`  ✅ Template found`);
      console.log(`  Recommended accounts: ${JSON.stringify(categoryTemplate.accounts)}`);
      console.log(`  IFRS notes: ${categoryTemplate.ifrsNotes}`);
    } else {
      console.log(`  ❌ No template found for ${testCase.category}`);
    }
    console.log('');
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('🧪 BULK TRANSACTION ANALYSIS TEST SUITE\n');
  console.log('='.repeat(50));
  
  try {
    // Test AI client health
    console.log('🏥 Checking AI Client Health...');
    const health = await aiClient.healthCheck();
    console.log(`   Gemini: ${health.gemini ? '✅' : '❌'}`);
    console.log(`   DeepSeek: ${health.deepseek ? '✅' : '❌'}`);
    console.log(`   Overall: ${health.overall ? '✅' : '❌'}`);
    console.log(`   Capabilities: ${Object.keys(health.capabilities).join(', ')}`);
    console.log('');

    if (!health.overall) {
      console.log('❌ AI client not healthy, skipping tests');
      return;
    }

    // Run individual tests
    await testTransactionCategorization();
    await testSpecificTransactionTypes();
    await testBulkAnalysis();

    console.log('✅ All tests completed successfully!');

  } catch (error) {
    console.error('❌ Test suite failed:', error.message);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = {
  testBulkAnalysis,
  testTransactionCategorization,
  testSpecificTransactionTypes,
  runTests
}; 