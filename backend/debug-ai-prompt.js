require('dotenv').config();

const BlockscoutClient = require('./src/services/blockscoutClient');
const GeminiClient = require('./src/services/aiClients/geminiClient');

async function debugAIPrompt() {
  console.log('🔍 DEBUGGING AI PROMPT FOR XYD TOKEN TRANSFER');
  console.log('=============================================\n');

  const TEST_WALLET = '0x862847B44845eD331dc8FA211Df3C01eCBB1b38C';
  
  try {
    // Get raw transaction data
    console.log('📡 Step 1: Fetching transaction data...');
    const walletData = await BlockscoutClient.getWalletTransactions(TEST_WALLET, {
      limit: 3,
      includeTokens: true,
      includeInternal: true
    });

    // Find the XYD token transfer
    const xydTransaction = walletData.transactions.find(tx => tx.tokenSymbol === 'XYD');
    
    if (!xydTransaction) {
      console.log('❌ No XYD transaction found!');
      return;
    }

    console.log(`✅ Found XYD transaction: ${xydTransaction.hash}`);
    console.log(`Token Symbol: ${xydTransaction.tokenSymbol}`);
    console.log(`Actual Amount: ${xydTransaction.actualAmount}`);
    console.log(`Is Token Transfer: ${xydTransaction.isTokenTransfer}\n`);

    // Create the prompt data as the AI would receive it
    console.log('📝 Step 2: Creating AI prompt data...');
    const gemini = new GeminiClient();
    
    // Group transactions as they would be in bulk analysis
    const transactionGroups = gemini.groupTransactionsByCategory([xydTransaction]);
    const tokenTransferGroup = transactionGroups.token_transfer;
    
    if (!tokenTransferGroup || tokenTransferGroup.length === 0) {
      console.log('❌ No token_transfer group created!');
      return;
    }

    console.log('✅ Token transfer group created with 1 transaction\n');

    // Get the chart of accounts
    const chartOfAccounts = await gemini.getFormattedChartOfAccounts();

    // Get the category template
    const ifrsTemplates = require('./src/services/aiClients/enhancedIfrsTemplates.json');
    const categoryTemplate = ifrsTemplates.categoryAnalysisTemplates.token_transfer;

    // Build the actual prompt that would be sent to AI
    console.log('🔧 Step 3: Building AI prompt...');
    const prompt = gemini.buildCategoryAnalysisPrompt(
      'token_transfer',
      tokenTransferGroup,
      TEST_WALLET,
      chartOfAccounts,
      categoryTemplate
    );

    console.log('📋 FULL AI PROMPT BEING SENT:');
    console.log('='.repeat(80));
    console.log(prompt);
    console.log('='.repeat(80));

    // Check specific parts of the prompt
    console.log('\n🔍 PROMPT ANALYSIS:');
    console.log('──────────────────');
    
    const containsXYD = prompt.includes('XYD');
    const containsCorrectTokenRules = prompt.includes('DETECTED TOKENS IN THIS CATEGORY: XYD');
    const containsTransactionData = prompt.includes('100 XYD');
    const containsWarningEmojis = prompt.includes('🚨');
    
    console.log(`Contains "XYD": ${containsXYD}`);
    console.log(`Contains token detection rules: ${containsCorrectTokenRules}`);
    console.log(`Contains transaction with 100 XYD: ${containsTransactionData}`);
    console.log(`Contains warning emojis: ${containsWarningEmojis}`);

    // Check the formatTransactionsForPrompt output specifically
    console.log('\n📄 TRANSACTION FORMATTING CHECK:');
    console.log('──────────────────────────────────');
    const formattedTransactions = gemini.formatTransactionsForPrompt(tokenTransferGroup);
    console.log('Formatted transactions output:');
    console.log(formattedTransactions);

  } catch (error) {
    console.log(`❌ Debug failed: ${error.message}`);
    console.log(`Stack: ${error.stack}`);
  }
}

// Run the debug
if (require.main === module) {
  debugAIPrompt()
    .then(() => {
      console.log('\n🏁 AI prompt debug completed');
    })
    .catch(error => {
      console.error('💥 Debug failed:', error.message);
    });
}

module.exports = debugAIPrompt; 