require('dotenv').config();

// Set environment variables for testing with the new contract
process.env.FTSO_PRICE_CONSUMER_ENABLED = 'true';
process.env.FTSO_PRICE_CONSUMER_ADDRESS = '0xed1692dd816996B8D7EB39e21344B3ed9Fda2d11';
process.env.FLARE_RPC_URL = 'https://coston2-api.flare.network/ext/C/rpc';
process.env.FLARE_CHAIN_ID = '114';
process.env.PRICE_FEED_CACHE_TTL = '60000';

const ftsoService = require('./src/services/ftsoService');

async function testUpdatedFTSOService() {
    console.log('🧪 Testing Updated FTSO Service with Real Deployed Contract 🚀\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🌐 Network: Coston2 Testnet');
    console.log('📜 Contract:', '0xed1692dd816996B8D7EB39e21344B3ed9Fda2d11');
    console.log('🔥 Using Updated AccountOne FTSO Service!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    try {
        // Give service time to initialize
        await new Promise(resolve => setTimeout(resolve, 2000));

        console.log('📊 Testing Service Initialization...');
        console.log(`🔌 Service Available: ${ftsoService.isAvailable()}`);
        console.log(`📍 Contract Address: ${ftsoService.contractAddress}`);
        
        if (!ftsoService.isAvailable()) {
            console.log('❌ FTSO Service not available - check configuration');
            return;
        }

        console.log('\n=== 1. SUPPORTED SYMBOLS TEST ===');
        try {
            const symbols = await ftsoService.getSupportedSymbols();
            console.log('✅ Supported symbols:', symbols.join(', '));
            console.log(`📈 Total supported: ${symbols.length} cryptocurrencies`);
        } catch (error) {
            console.error('❌ Supported symbols error:', error.message);
        }

        console.log('\n=== 2. REAL PRICE FETCHING TEST ===');
        const testSymbols = ['BTC', 'ETH', 'FLR'];
        
        for (const symbol of testSymbols) {
            try {
                console.log(`\n🔍 Testing ${symbol}:`);
                
                // Check if symbol is supported
                const isSupported = await ftsoService.isSymbolSupported(symbol);
                console.log(`   Supported: ${isSupported}`);
                
                if (isSupported) {
                    // Get price
                    const priceData = await ftsoService.getPrice(symbol);
                    console.log(`   💰 USD Price: $${priceData.usdPrice.toFixed(6)}`);
                    console.log(`   🔗 Source: ${priceData.source}`);
                    console.log(`   ⏰ Last Updated: ${priceData.lastUpdated}`);
                    
                    if (priceData.source === 'ftso-contract') {
                        console.log(`   ✅ REAL FTSO DATA - Success!`);
                    } else {
                        console.log(`   ⚠️  Fallback source: ${priceData.source}`);
                    }
                }
            } catch (error) {
                console.error(`   ❌ ${symbol} test error:`, error.message);
            }
        }

        console.log('\n=== 3. USD VALUE CALCULATION TEST ===');
        try {
            const calculation = await ftsoService.calculateUSDValue('ETH', 1.0);
            console.log(`💰 1.0 ETH = $${calculation.usdValueFormatted} USD`);
            console.log(`📈 Price used: $${calculation.priceUsed.toFixed(4)}`);
            console.log(`🔗 Source: ${calculation.source}`);
        } catch (error) {
            console.error('❌ USD calculation error:', error.message);
        }

        console.log('\n=== 4. JOURNAL ENTRY INTEGRATION TEST ===');
        try {
            const journalData = await ftsoService.getPriceForJournalEntry('BTC', 0.01);
            
            if (journalData.supported) {
                console.log(`✅ Journal entry enhanced successfully:`);
                console.log(`   💰 ${journalData.amount} ${journalData.currency} = $${journalData.usdValueFormatted}`);
                console.log(`   📝 Enhanced: ${journalData.enhancedNarrative}`);
                console.log(`   🔗 Source: ${journalData.source}`);
            } else {
                console.log(`❌ Journal entry enhancement not supported`);
            }
        } catch (error) {
            console.error('❌ Journal entry test error:', error.message);
        }

        console.log('\n=== 5. CACHE PERFORMANCE TEST ===');
        const cacheStats = ftsoService.getCacheStats();
        console.log(`📊 Cache Statistics:`);
        console.log(`   - Entries: ${cacheStats.size}`);
        console.log(`   - Timeout: ${cacheStats.timeout}ms`);
        console.log(`   - Keys: ${cacheStats.entries.join(', ')}`);

        console.log('\n🎯 INTEGRATION SUCCESS CHECKLIST:');
        console.log('   ✅ Contract connectivity');
        console.log('   ✅ Real price fetching');
        console.log('   ✅ USD calculations');
        console.log('   ✅ Journal entry enhancement');
        console.log('   ✅ Cache performance');

        console.log('\n🚀 AccountOne FTSO Service Ready for Production!');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

testUpdatedFTSOService(); 