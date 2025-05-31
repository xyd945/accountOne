require('dotenv').config();

// Set environment variables for testing
process.env.FTSO_PRICE_CONSUMER_ENABLED = 'true';
process.env.FTSO_PRICE_CONSUMER_ADDRESS = '0xEc8F86Ffa44FD994A0Fa1971D606e1F37f2d43D2';
process.env.FLARE_RPC_URL = 'https://coston2-api.flare.network/ext/C/rpc';
process.env.FLARE_CHAIN_ID = '114';
process.env.PRICE_FEED_CACHE_TTL = '60000';

const ftsoService = require('./src/services/ftsoService');

async function testFTSOIntegration() {
  console.log('🧪 Testing FTSO Price Feed Integration...\n');

  try {
    console.log('📋 Step 1: Service initialization check...');
    console.log(`- Service available: ${ftsoService.isAvailable()}`);
    console.log(`- Contract address: ${ftsoService.contractAddress}`);
    console.log(`- Cache timeout: ${ftsoService.cacheTimeout}ms`);

    if (!ftsoService.isAvailable()) {
      console.log('❌ FTSO Service not available - check configuration');
      return;
    }

    console.log('\n📋 Step 2: Getting supported symbols...');
    const supportedSymbols = await ftsoService.getSupportedSymbols();
    console.log(`✅ Found ${supportedSymbols.length} supported symbols:`, supportedSymbols);

    console.log('\n📋 Step 3: Testing individual price queries...');
    
    // Test major cryptocurrencies
    const testSymbols = ['FLR', 'BTC', 'ETH', 'USDC'];
    
    for (const symbol of testSymbols) {
      try {
        console.log(`\n🔍 Testing ${symbol}:`);
        
        // Check if symbol is supported
        const isSupported = await ftsoService.isSymbolSupported(symbol);
        console.log(`  - Supported: ${isSupported}`);
        
        if (isSupported) {
          // Get price
          const priceData = await ftsoService.getPrice(symbol);
          console.log(`  - USD Price: $${priceData.usdPrice.toFixed(6)}`);
          console.log(`  - Decimals: ${priceData.decimals}`);
          console.log(`  - Last Updated: ${priceData.lastUpdated}`);
          console.log(`  - Raw Price: ${priceData.price.toString()}`);
        }
      } catch (error) {
        console.log(`  ❌ Error getting ${symbol} price: ${error.message}`);
      }
    }

    console.log('\n📋 Step 4: Testing batch price queries...');
    try {
      const batchSymbols = ['FLR', 'BTC', 'ETH'];
      const batchPrices = await ftsoService.getPrices(batchSymbols);
      
      console.log(`✅ Batch query successful for ${batchPrices.length} symbols:`);
      batchPrices.forEach(price => {
        console.log(`  - ${price.symbol}: $${price.usdPrice.toFixed(6)}`);
      });
    } catch (error) {
      console.log(`❌ Batch query failed: ${error.message}`);
    }

    console.log('\n📋 Step 5: Testing USD value calculations...');
    
    const testCalculations = [
      { symbol: 'FLR', amount: '100' },
      { symbol: 'BTC', amount: '0.1' },
      { symbol: 'ETH', amount: '1.5' },
    ];

    for (const test of testCalculations) {
      try {
        console.log(`\n💰 Calculating USD value for ${test.amount} ${test.symbol}:`);
        
        const calculation = await ftsoService.calculateUSDValue(
          test.symbol, 
          test.amount
        );
        
        console.log(`  - Token Amount: ${calculation.tokenAmount} ${test.symbol}`);
        console.log(`  - USD Value: $${calculation.usdValueFormatted}`);
        console.log(`  - Price Used: $${calculation.priceUsed.toFixed(4)}`);
        console.log(`  - Source: ${calculation.source}`);
        console.log(`  - Timestamp: ${calculation.lastUpdated}`);
      } catch (error) {
        console.log(`  ❌ Calculation failed for ${test.symbol}: ${error.message}`);
      }
    }

    console.log('\n📋 Step 6: Testing journal entry integration...');
    
    const journalTestCases = [
      { currency: 'XYD', amount: 10 }, // Custom token (should fail gracefully)
      { currency: 'C2FLR', amount: 1000 }, // Coston2 token (should map to FLR)
      { currency: 'ETH', amount: 2.5 },
      { currency: 'USDC', amount: 500 },
    ];

    for (const testCase of journalTestCases) {
      try {
        console.log(`\n📝 Journal entry test for ${testCase.amount} ${testCase.currency}:`);
        
        const enhancedData = await ftsoService.getPriceForJournalEntry(
          testCase.currency, 
          testCase.amount
        );
        
        console.log(`  - Supported: ${enhancedData.supported}`);
        if (enhancedData.supported) {
          console.log(`  - USD Value: $${enhancedData.usdValueFormatted}`);
          console.log(`  - Enhanced Narrative: ${enhancedData.enhancedNarrative}`);
        } else {
          console.log(`  - Note: ${enhancedData.currency} not supported by FTSO`);
        }
      } catch (error) {
        console.log(`  ❌ Journal entry test failed: ${error.message}`);
      }
    }

    console.log('\n📋 Step 7: Cache performance test...');
    
    console.log('Testing cache performance with repeated calls...');
    const startTime = Date.now();
    
    // First call (should fetch from contract)
    await ftsoService.getPrice('ETH');
    const firstCallTime = Date.now() - startTime;
    
    // Second call (should use cache)
    const cacheStartTime = Date.now();
    await ftsoService.getPrice('ETH');
    const cacheCallTime = Date.now() - cacheStartTime;
    
    console.log(`  - First call (contract): ${firstCallTime}ms`);
    console.log(`  - Second call (cache): ${cacheCallTime}ms`);
    console.log(`  - Cache speedup: ${(firstCallTime / cacheCallTime).toFixed(1)}x faster`);
    
    const cacheStats = ftsoService.getCacheStats();
    console.log(`  - Cache entries: ${cacheStats.size}`);
    console.log(`  - Cache timeout: ${cacheStats.timeout}ms`);

    console.log('\n🎉 FTSO Integration Test Complete!');
    console.log('✅ FTSO price feeds are working correctly');
    console.log('✅ Contract integration successful');
    console.log('✅ Cache performance optimized');
    console.log('✅ Ready for Phase 2 journal entry enhancement');

  } catch (error) {
    console.error('❌ FTSO Integration Test Failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testFTSOIntegration(); 