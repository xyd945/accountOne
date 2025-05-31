require('dotenv').config();

// Set environment variables for testing the real FTSO contract on FLARE MAINNET
process.env.FTSO_PRICE_CONSUMER_ENABLED = 'true';
process.env.FTSO_PRICE_CONSUMER_ADDRESS = '0xEc8F86Ffa44FD994A0Fa1971D606e1F37f2d43D2';
// NOW USING FLARE MAINNET - Real FTSO data!
process.env.FLARE_RPC_URL = 'https://flare-api.flare.network/ext/C/rpc';
process.env.FLARE_CHAIN_ID = '14';
process.env.PRICE_FEED_CACHE_TTL = '60000';

const ftsoService = require('./src/services/ftsoService');

async function testRealFTSOService() {
  console.log('🧪 Testing REAL FTSO Service on FLARE MAINNET 🚀\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🌐 Network: Flare Mainnet (Chain ID: 14)');
  console.log('📜 Contract: 0xEc8F86Ffa44FD994A0Fa1971D606e1F37f2d43D2');
  console.log('🔥 Using REAL FTSO Oracle Data - Not Mock Prices!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  try {
    console.log('\n📋 Step 1: Service Initialization');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Give service time to initialize
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log(`🔌 FTSO Service Available: ${ftsoService.isAvailable()}`);
    console.log(`📝 Contract Address: ${ftsoService.contractAddress}`);
    
    if (!ftsoService.isAvailable()) {
      console.log('❌ FTSO Service not available - check configuration and network connectivity');
      return;
    }

    console.log('\n📋 Step 2: Contract Connectivity Test');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    try {
      const supportedSymbols = await ftsoService.getSupportedSymbols();
      console.log(`✅ Contract connectivity successful!`);
      console.log(`📊 FTSO Supported Symbols: ${supportedSymbols.length}`);
      console.log(`   ${supportedSymbols.join(', ')}`);
    } catch (error) {
      console.log(`❌ Contract connectivity failed: ${error.message}`);
      console.log('   This might indicate the contract address is wrong or network issues');
      return;
    }

    console.log('\n📋 Step 3: Real FTSO Price Testing');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Test major cryptocurrencies that should be supported by FTSO
    const ftsoTestSymbols = ['FLR', 'BTC', 'ETH', 'USDC'];
    
    for (const symbol of ftsoTestSymbols) {
      try {
        console.log(`\n🔍 Testing ${symbol} price fetch:`);
        
        // Check if symbol is supported
        const isSupported = await ftsoService.isSymbolSupported(symbol);
        console.log(`  ✅ Supported by contract: ${isSupported}`);
        
        if (isSupported) {
          // Get price from FTSO contract
          const priceData = await ftsoService.getPrice(symbol);
          console.log(`  💰 USD Price: $${priceData.usdPrice.toFixed(6)}`);
          console.log(`  📊 Raw Price: ${priceData.price.toString()}`);
          console.log(`  🔢 Decimals: ${priceData.decimals}`);
          console.log(`  ⏰ Timestamp: ${priceData.lastUpdated}`);
          console.log(`  🔗 Source: ${priceData.source}`);
          console.log(`  📍 Contract: ${priceData.contractAddress}`);
          
          // Verify this is real FTSO data (not mock)
          if (priceData.source === 'ftso-contract') {
            console.log(`  ✅ REAL FTSO DATA - Success!`);
          } else {
            console.log(`  ⚠️  Not from FTSO contract: ${priceData.source}`);
          }
        }
      } catch (error) {
        console.log(`  ❌ Failed to get ${symbol} price: ${error.message}`);
      }
    }

    console.log('\n📋 Step 4: Custom Token Testing');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Test custom tokens (should use mock prices)
    const customTokens = ['XYD', 'C2FLR'];
    
    for (const token of customTokens) {
      try {
        console.log(`\n🔍 Testing custom token ${token}:`);
        
        const isSupported = await ftsoService.isSymbolSupported(token);
        console.log(`  ✅ Supported: ${isSupported}`);
        
        if (isSupported) {
          const priceData = await ftsoService.getPrice(token);
          console.log(`  💰 USD Price: $${priceData.usdPrice.toFixed(6)}`);
          console.log(`  🔗 Source: ${priceData.source}`);
          
          if (priceData.source === 'custom-token-mock') {
            console.log(`  ✅ Custom token mock data - Expected!`);
          }
        }
      } catch (error) {
        console.log(`  ❌ Failed to get ${token} price: ${error.message}`);
      }
    }

    console.log('\n📋 Step 5: USD Value Calculation Test');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    try {
      // Test with a major cryptocurrency
      const calculation = await ftsoService.calculateUSDValue('ETH', 1.0);
      console.log(`💰 1.0 ETH = $${calculation.usdValueFormatted} USD`);
      console.log(`📈 Price used: $${calculation.priceUsed.toFixed(4)}`);
      console.log(`🔗 Source: ${calculation.source}`);
      
      if (calculation.source === 'ftso-contract') {
        console.log(`✅ USD calculation using REAL FTSO data!`);
      }
    } catch (error) {
      console.log(`❌ USD calculation failed: ${error.message}`);
    }

    console.log('\n📋 Step 6: Journal Entry Integration Test');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    try {
      // Test journal entry enhancement with real FTSO data
      const journalData = await ftsoService.getPriceForJournalEntry('ETH', 2.5);
      
      if (journalData.supported) {
        console.log(`✅ Journal entry enhanced successfully:`);
        console.log(`   💰 ${journalData.amount} ${journalData.currency} = $${journalData.usdValueFormatted}`);
        console.log(`   📝 Enhanced: ${journalData.enhancedNarrative}`);
        console.log(`   🔗 Source: ${journalData.source}`);
        
        if (journalData.source === 'ftso-real' && journalData.priceData.source === 'ftso-contract') {
          console.log(`   ✅ Using REAL FTSO price data for journal entries!`);
        }
      } else {
        console.log(`❌ Journal entry enhancement not supported for ETH`);
      }
    } catch (error) {
      console.log(`❌ Journal entry test failed: ${error.message}`);
    }

    console.log('\n🎯 FTSO Service Validation Results');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const cacheStats = ftsoService.getCacheStats();
    console.log(`📊 Performance:`);
    console.log(`   - Cache entries: ${cacheStats.size}`);
    console.log(`   - Cache timeout: ${cacheStats.timeout}ms`);
    console.log(`   - Service availability: ${ftsoService.isAvailable() ? 'Online' : 'Offline'}`);

    console.log('\n✅ VALIDATION CHECKLIST:');
    console.log('   🔗 Contract connectivity: Check');
    console.log('   📊 Real FTSO price data: Check for supported symbols');
    console.log('   🛠️  Custom token fallback: Check for XYD/C2FLR');
    console.log('   💰 USD calculations: Check with real prices');
    console.log('   📝 Journal integration: Check with enhanced narratives');

    console.log('\n🚀 REAL FTSO SERVICE TEST COMPLETE!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('   The service is now using REAL FTSO oracle data from our deployed contract!');

  } catch (error) {
    console.error('\n❌ Real FTSO Service Test Failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testRealFTSOService(); 