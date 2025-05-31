require('dotenv').config();

const aiClient = require('./src/services/aiClients');

async function analyzeWallet(walletAddress, options = {}) {
  try {
    console.log('🔍 Starting Wallet Analysis');
    console.log('='.repeat(50));
    console.log(`📍 Wallet Address: ${walletAddress}`);
    console.log(`⚙️  Options:`, JSON.stringify(options, null, 2));
    console.log('');

    // Step 1: Quick preview (no AI analysis)
    console.log('📊 Step 1: Getting wallet preview...');
    const preview = await aiClient.getWalletPreview(walletAddress, {
      limit: 10,
      includeTokens: true,
      includeInternal: true,
    });

    console.log(`✅ Found ${preview.totalTransactions} total transactions`);
    console.log(`📈 Categories detected:`, Object.keys(preview.summary.categories));
    console.log(`🪙 Tokens found:`, Object.keys(preview.summary.tokens));
    console.log('');

    // Step 2: Full AI analysis and journal entry generation
    console.log('🤖 Step 2: AI Analysis and Journal Entry Generation...');
    const analysis = await aiClient.analyzeBulkTransactions(
      walletAddress,
      {
        limit: options.limit || 5, // Keep small for demo
        minValue: options.minValue || 0.001,
        categories: options.categories,
        saveEntries: options.saveEntries || false, // Don't save by default
        includeTokens: true,
        includeInternal: true,
      },
      null // No user ID for demo
    );

    console.log(`✅ Analysis completed!`);
    console.log(`📊 Results Summary:`);
    console.log(`   • Transactions Processed: ${analysis.analysis?.walletAnalysis?.totalTransactionsProcessed || 0}`);
    console.log(`   • Journal Entries Generated: ${analysis.analysis?.walletAnalysis?.totalJournalEntriesGenerated || 0}`);
    console.log(`   • Success Rate: ${analysis.analysis?.walletAnalysis?.processingSuccessRate || 'N/A'}`);
    console.log('');

    // Step 3: Show sample journal entries
    if (analysis.journalEntries && analysis.journalEntries.length > 0) {
      console.log('💰 Sample Generated Journal Entries:');
      console.log('-'.repeat(40));
      
      analysis.journalEntries.slice(0, 3).forEach((entryGroup, index) => {
        console.log(`\n${index + 1}. Transaction: ${entryGroup.transactionHash?.slice(0, 10)}...`);
        console.log(`   Category: ${entryGroup.category}`);
        
        entryGroup.entries.forEach((entry, entryIndex) => {
          console.log(`   Entry ${entryIndex + 1}:`);
          console.log(`     Debit:  ${entry.accountDebit}`);
          console.log(`     Credit: ${entry.accountCredit}`);
          console.log(`     Amount: ${entry.amount} ${entry.currency}`);
          console.log(`     Narrative: ${entry.narrative}`);
          console.log(`     Confidence: ${(entry.confidence * 100).toFixed(1)}%`);
        });
      });
    }

    // Step 4: Show recommendations
    if (analysis.analysis?.recommendations) {
      console.log('\n💡 AI Recommendations:');
      analysis.analysis.recommendations.forEach(rec => {
        console.log(`   • ${rec}`);
      });
    }

    console.log('\n🎉 Wallet analysis completed successfully!');
    return analysis;

  } catch (error) {
    console.error('❌ Wallet analysis failed:', error.message);
    console.error('Stack:', error.stack);
    throw error;
  }
}

// Command line usage
async function main() {
  const walletAddress = process.argv[2] || '0xD423B4b575d2808459035294Bf971A5834eB7b87';
  
  const options = {
    limit: 5,              // Analyze 5 transactions for demo
    minValue: 0.001,       // Only significant transactions
    categories: ['staking', 'dex_trade', 'token_transfer'], // Focus on these
    saveEntries: false,    // Don't save to database (demo only)
  };

  try {
    await analyzeWallet(walletAddress, options);
  } catch (error) {
    console.error('Fatal error:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { analyzeWallet }; 