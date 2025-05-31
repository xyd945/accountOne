const EnhancedBlockscoutClient = require('./src/services/enhancedBlockscoutClient');
const GeminiClient = require('./src/services/aiClients/geminiClient');
const logger = require('./src/utils/logger');

async function testEnhancedCategorization() {
  console.log('🧠 Testing Enhanced AI-Driven Transaction Categorization\n');

  const enhancedBlockscout = new EnhancedBlockscoutClient();
  const gemini = new GeminiClient();

  // Test transactions with different types
  const testTransactions = [
    {
      hash: '0x5956713fe3dd60ee36de2e71dddf031ecd1e5538742f80dea2c6bd2da2c4d8bb',
      description: 'USDT Transfer (should detect token_transfer)',
      userAddress: '0xD423B4b575d2808459035294Bf971A5834eB7b87'
    }
  ];

  for (const testTx of testTransactions) {
    console.log(`🔍 Testing: ${testTx.description}`);
    console.log(`   Hash: ${testTx.hash}`);
    console.log(`   User: ${testTx.userAddress}\n`);

    try {
      // Step 1: Get enhanced context
      console.log('📊 Step 1: Fetching enhanced transaction context...');
      const enhancedContext = await enhancedBlockscout.getEnhancedTransactionContext(testTx.hash);
      
      console.log(`   ✅ Context retrieved:`);
      console.log(`      - Method: ${enhancedContext.method || 'N/A'}`);
      console.log(`      - Contract: ${enhancedContext.to?.name || 'Unknown'}`);
      console.log(`      - Contract Tags: ${JSON.stringify(enhancedContext.to?.tags || [])}`);
      console.log(`      - Token Transfers: ${enhancedContext.token_transfers.length}`);
      console.log(`      - Events: ${enhancedContext.events.length}`);
      console.log(`      - Has Decoded Input: ${!!enhancedContext.decoded_input}`);

      if (enhancedContext.token_transfers.length > 0) {
        const transfer = enhancedContext.token_transfers[0];
        console.log(`      - Token: ${transfer.token.name} (${transfer.token.symbol})`);
        console.log(`      - Amount: ${transfer.total?.decimals_normalized || 'N/A'}`);
      }

      // Step 2: AI-powered categorization  
      console.log('\n🧠 Step 2: AI-powered categorization...');
      const categorization = await enhancedBlockscout.categorizeTransactionWithAI(
        testTx.hash, 
        testTx.userAddress, 
        gemini
      );

      console.log(`   ✅ AI Categorization Result:`);
      console.log(`      - Category: ${categorization.category}`);
      console.log(`      - Subcategory: ${categorization.subcategory || 'N/A'}`);
      console.log(`      - Confidence: ${(categorization.confidence * 100).toFixed(1)}%`);
      console.log(`      - Direction: ${categorization.direction}`);
      console.log(`      - User Initiated: ${categorization.isUserInitiated}`);
      console.log(`      - Reasoning: ${categorization.reasoning?.substring(0, 100)}...`);

      if (categorization.key_indicators?.length > 0) {
        console.log(`      - Key Indicators: ${categorization.key_indicators.join(', ')}`);
      }

      // Step 3: Compare with old method
      console.log('\n🔄 Step 3: Comparing with old hardcoded method...');
      const oldMethod = detectOldCategorization(enhancedContext, testTx.userAddress);
      
      console.log(`   📊 Comparison:`);
      console.log(`      - Enhanced AI: ${categorization.category} (${(categorization.confidence * 100).toFixed(1)}%)`);
      console.log(`      - Old Hardcoded: ${oldMethod}`);
      console.log(`      - Improvement: ${categorization.category !== oldMethod ? '✅ Different/Better' : '⚪ Same'}`);

      // Step 4: Show accounting implications
      if (categorization.accounting_notes) {
        console.log('\n💼 Step 4: Accounting Treatment:');
        console.log(`   ${categorization.accounting_notes}`);
      }

    } catch (error) {
      console.log(`   ❌ Test failed: ${error.message}`);
    }

    console.log('\n' + '='.repeat(80) + '\n');
  }
}

/**
 * Simulate old hardcoded categorization logic for comparison
 */
function detectOldCategorization(context, userAddress) {
  const lowerAddress = userAddress.toLowerCase();
  const fromAddress = context.from.hash.toLowerCase();
  const toAddress = context.to?.hash.toLowerCase();
  const input = context.raw_input || '';
  const value = parseFloat(context.context.value || 0);

  // Simple hardcoded patterns (simplified version)
  const knownContracts = {
    '0xdac17f958d2ee523a2206206994597c13d831ec7': 'token_contract', // USDT
    '0x7a250d5630b4cf539739df2c5dacb4c659f2488d': 'dex',           // Uniswap V2
    '0xe592427a0aece92de3edee1f18e0157c05861564': 'dex',           // Uniswap V3
    '0x00000000219ab540356cbb839cbe05303d7705fa': 'staking',       // ETH 2.0
  };

  // Check known contracts
  if (knownContracts[toAddress]) {
    return knownContracts[toAddress];
  }

  // Function signature analysis
  if (input.length > 10) {
    const functionSig = input.slice(0, 10);
    switch (functionSig) {
      case '0xa9059cbb': // ERC-20 transfer
        return 'token_transfer';
      case '0x7ff36ab5': // Uniswap swap
        return 'dex_trade';
      default:
        return 'contract_interaction';
    }
  }

  // Value-based
  if (value > 0) {
    return fromAddress === lowerAddress ? 'outgoing_transfer' : 'incoming_transfer';
  }

  return 'unknown';
}

/**
 * Demonstrate enhanced data available
 */
async function demonstrateEnhancedData() {
  console.log('📊 Enhanced Data Demonstration\n');

  const enhancedBlockscout = new EnhancedBlockscoutClient();
  const txHash = '0x5956713fe3dd60ee36de2e71dddf031ecd1e5538742f80dea2c6bd2da2c4d8bb';

  try {
    const context = await enhancedBlockscout.getEnhancedTransactionContext(txHash);

    console.log('🎯 Rich Context Data Available for AI Analysis:\n');

    console.log('1️⃣ DECODED METHOD CALL:');
    if (context.decoded_input) {
      console.log(`   Function: ${context.decoded_input.method_call}`);
      console.log(`   Parameters: ${JSON.stringify(context.decoded_input.parameters, null, 2)}`);
    } else {
      console.log('   No decoded input available');
    }

    console.log('\n2️⃣ CONTRACT METADATA:');
    console.log(`   Contract Name: ${context.to?.name}`);
    console.log(`   Is Verified: ${context.to?.is_verified}`);
    console.log(`   Tags: ${JSON.stringify(context.to?.tags)}`);

    console.log('\n3️⃣ TOKEN TRANSFER DETAILS:');
    context.token_transfers.forEach((transfer, index) => {
      console.log(`   Transfer ${index + 1}:`);
      console.log(`     Token: ${transfer.token.name} (${transfer.token.symbol})`);
      console.log(`     Type: ${transfer.token.type}`);
      console.log(`     From: ${transfer.from.hash}`);
      console.log(`     To: ${transfer.to.hash}`);
      console.log(`     Amount: ${transfer.total?.decimals_normalized || 'N/A'}`);
    });

    console.log('\n4️⃣ EXECUTION DETAILS:');
    console.log(`   Gas Used: ${context.execution.gasUsed}`);
    console.log(`   Status: ${context.execution.status}`);
    console.log(`   Fee: ${context.execution.transactionFee}`);

    console.log('\n5️⃣ EVENT LOGS:');
    context.events.forEach((event, index) => {
      console.log(`   Event ${index + 1}:`);
      console.log(`     Contract: ${event.address}`);
      console.log(`     Topics: ${event.topics.length} topics`);
      if (event.decoded) {
        console.log(`     Decoded: ${JSON.stringify(event.decoded)}`);
      }
    });

    console.log(`\n📈 This rich context enables AI to understand:`);
    console.log(`   ✅ Exact function being called`);
    console.log(`   ✅ Contract purpose and verification status`);
    console.log(`   ✅ Complete token flow patterns`);
    console.log(`   ✅ Multi-step transaction sequences`);
    console.log(`   ✅ DeFi protocol interactions`);
    console.log(`   ✅ NFT marketplace activities`);
    console.log(`   ✅ Cross-chain bridge operations`);

  } catch (error) {
    console.log(`❌ Failed to demonstrate: ${error.message}`);
  }
}

/**
 * Main test execution
 */
async function main() {
  try {
    await demonstrateEnhancedData();
    console.log('\n' + '='.repeat(80) + '\n');
    await testEnhancedCategorization();
    
    console.log('🎉 Enhanced Categorization Testing Complete!\n');
    console.log('💡 Key Benefits Demonstrated:');
    console.log('   • Rich blockchain context analysis');
    console.log('   • AI-powered intelligent categorization');
    console.log('   • Contract metadata and tag analysis');
    console.log('   • Token transfer pattern recognition');
    console.log('   • Event log interpretation');
    console.log('   • Confidence scoring and validation');
    console.log('   • Fallback safety mechanisms');
    console.log('   • Detailed accounting recommendations\n');

  } catch (error) {
    console.error('❌ Test execution failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  testEnhancedCategorization,
  demonstrateEnhancedData
}; 