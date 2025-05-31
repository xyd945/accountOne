require('dotenv').config();

const ftsoService = require('./src/services/ftsoService');

async function debugFTSOStatus() {
  console.log('🔍 FTSO Service Configuration Debug');
  console.log('='.repeat(50));
  
  // Check environment variables
  console.log('\n📋 Environment Variables:');
  console.log(`FTSO_PRICE_CONSUMER_ENABLED: ${process.env.FTSO_PRICE_CONSUMER_ENABLED}`);
  console.log(`FTSO_PRICE_CONSUMER_ADDRESS: ${process.env.FTSO_PRICE_CONSUMER_ADDRESS}`);
  console.log(`FLARE_RPC_URL: ${process.env.FLARE_RPC_URL}`);
  console.log(`FLARE_CHAIN_ID: ${process.env.FLARE_CHAIN_ID}`);
  console.log(`PRICE_FEED_CACHE_TTL: ${process.env.PRICE_FEED_CACHE_TTL}`);
  
  // Check service status
  console.log('\n🔧 Service Status:');
  console.log(`Service Available: ${ftsoService.isAvailable()}`);
  console.log(`Service Enabled: ${ftsoService.enabled}`);
  console.log(`Contract Address: ${ftsoService.contractAddress}`);
  console.log(`Has Provider: ${ftsoService.provider !== null}`);
  console.log(`Has Contract: ${ftsoService.contract !== null}`);
  
  // Test if the issue is environment vs contract connectivity
  console.log('\n🧪 Connectivity Test:');
  try {
    if (ftsoService.isAvailable()) {
      // Try to get supported symbols to test contract connectivity
      const symbols = await ftsoService.getSupportedSymbols();
      console.log(`✅ Contract connectivity: OK`);
      console.log(`✅ Supported symbols: ${symbols.join(', ')}`);
      
      // Test price fetching for BTC (should work with real FTSO)
      console.log('\n💰 Price Test:');
      const btcPrice = await ftsoService.getPrice('BTC');
      console.log(`BTC Price Source: ${btcPrice.source}`);
      console.log(`BTC USD Price: $${btcPrice.usdPrice}`);
      
      if (btcPrice.source === 'mock-fallback') {
        console.log('❌ WARNING: Using mock prices instead of real FTSO!');
        console.log('This suggests a contract connectivity issue.');
      } else {
        console.log('✅ Using real FTSO price data!');
      }
    } else {
      console.log('❌ Service not available - checking reasons:');
      
      if (!ftsoService.enabled) {
        console.log('   - FTSO_PRICE_CONSUMER_ENABLED is not "true"');
      }
      
      if (!ftsoService.contract) {
        console.log('   - Contract not initialized (check RPC URL and contract address)');
      }
    }
  } catch (error) {
    console.log(`❌ Connectivity test failed: ${error.message}`);
  }
  
  console.log('\n🔧 Troubleshooting Guide:');
  console.log('1. Ensure FTSO_PRICE_CONSUMER_ENABLED="true" in .env');
  console.log('2. Check FLARE_RPC_URL is accessible');
  console.log('3. Verify FTSO_PRICE_CONSUMER_ADDRESS is correct');
  console.log('4. Ensure network connectivity to Coston2/Flare RPC');
  console.log('5. Check if the contract is deployed and accessible');
}

debugFTSOStatus().catch(console.error); 