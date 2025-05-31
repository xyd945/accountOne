require('dotenv').config();

const ftsoService = require('./src/services/ftsoService');

async function quickFTSOTest() {
  console.log('🚀 Quick FTSO Test - Real vs Mock Prices');
  console.log('='.repeat(50));
  
  try {
    // Test a few prices
    const testTokens = ['BTC', 'ETH', 'XYD'];
    
    for (const token of testTokens) {
      try {
        const price = await ftsoService.getPrice(token);
        console.log(`💰 ${token}: $${price.usdPrice.toFixed(4)} (${price.source})`);
        
        if (price.source === 'ftso-contract') {
          console.log('   ✅ Real FTSO price!');
        } else if (price.source === 'mock-fallback') {
          console.log('   📊 Mock price (expected for custom tokens like XYD)');
        }
      } catch (error) {
        console.log(`❌ ${token}: ${error.message}`);
      }
    }
    
    console.log('\n🎯 Summary:');
    console.log('- BTC/ETH should show "ftso-contract" source');
    console.log('- XYD should show "mock-fallback" source (this is correct)');
    console.log('- When frontend calls backend, it should get these same sources');
    
  } catch (error) {
    console.log(`❌ Test failed: ${error.message}`);
  }
}

quickFTSOTest(); 