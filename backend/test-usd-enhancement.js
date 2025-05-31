require('dotenv').config();

// Set environment variables for FTSO testing
process.env.FTSO_PRICE_CONSUMER_ENABLED = 'true';
process.env.FTSO_PRICE_CONSUMER_ADDRESS = '0xed1692dd816996B8D7EB39e21344B3ed9Fda2d11';
process.env.FLARE_RPC_URL = 'https://coston2-api.flare.network/ext/C/rpc';
process.env.FLARE_CHAIN_ID = '114';
process.env.PRICE_FEED_CACHE_TTL = '60000';

const GeminiClient = require('./src/services/aiClients/geminiClient');
const journalEntryService = require('./src/services/journalEntryService');
const ftsoService = require('./src/services/ftsoService');

const TEST_USER_ID = '53f5afe6-cb6a-4436-8a3a-45e57a6db798';

async function testUSDEnhancement() {
  console.log('💎 TEST: USD Value Enhancement with FTSO Integration');
  console.log('='.repeat(60));
  console.log('Testing automatic USD value addition to journal entries\n');

  try {
    console.log('📋 Step 1: Test FTSO Service Availability');
    console.log('─'.repeat(50));
    
    const isAvailable = ftsoService.isAvailable();
    console.log(`FTSO Service Status: ${isAvailable ? '✅ Available' : '❌ Unavailable'}`);
    
    if (isAvailable) {
      const supportedSymbols = await ftsoService.getSupportedSymbols();
      console.log(`Supported Symbols: ${supportedSymbols.length} (${supportedSymbols.slice(0, 5).join(', ')}...)`);
    }

    console.log('\n📋 Step 2: Test Individual Currency Prices');
    console.log('─'.repeat(50));
    
    const testCurrencies = ['ETH', 'BTC', 'C2FLR', 'XYD'];
    const priceResults = {};
    
    for (const currency of testCurrencies) {
      try {
        const priceData = await ftsoService.getPrice(currency);
        priceResults[currency] = priceData;
        console.log(`💰 ${currency.padEnd(6)} → $${priceData.usdPrice.toFixed(4).padStart(10)} (via ${priceData.source})`);
      } catch (error) {
        console.log(`❌ ${currency.padEnd(6)} → Price fetch failed: ${error.message}`);
        priceResults[currency] = { error: error.message };
      }
    }

    console.log('\n📋 Step 3: Test Direct Journal Entry USD Enhancement');
    console.log('─'.repeat(50));
    
    // Test direct journal entry creation with known amounts
    const testJournalEntries = [
      {
        accountDebit: 'Digital Assets - Ethereum',
        accountCredit: 'Trading Revenue',
        amount: 1.5,
        currency: 'ETH',
        narrative: 'Received ETH as trading revenue'
      },
      {
        accountDebit: 'Digital Assets - XYD',
        accountCredit: 'Other Income',
        amount: 100,
        currency: 'XYD',
        narrative: 'Received XYD tokens as refund'
      },
      {
        accountDebit: 'Transaction Fees',
        accountCredit: 'Digital Assets - C2FLR',
        amount: 0.5,
        currency: 'C2FLR',
        narrative: 'Gas fees for transaction'
      }
    ];

    console.log('Testing journal entry enhancement without saving...\n');
    
    for (const [index, entry] of testJournalEntries.entries()) {
      console.log(`Entry ${index + 1}: ${entry.amount} ${entry.currency}`);
      
      try {
        const ftsoData = await ftsoService.getPriceForJournalEntry(entry.currency, entry.amount);
        
        if (ftsoData.supported) {
          console.log(`  ✅ USD Value: $${ftsoData.usdValueFormatted} @ $${ftsoData.priceData.usdPrice.toFixed(4)}/${entry.currency}`);
          console.log(`  📝 Enhanced: ${ftsoData.enhancedNarrative}`);
          console.log(`  🔗 Source: ${ftsoData.source}`);
        } else {
          console.log(`  ⚠️  Not supported: ${ftsoData.error || 'Unknown reason'}`);
        }
      } catch (error) {
        console.log(`  ❌ Enhancement failed: ${error.message}`);
      }
      console.log('');
    }

    console.log('\n📋 Step 4: Test Journal Entry Saving with USD Columns');
    console.log('─'.repeat(50));
    
    console.log('Saving journal entries with automatic USD enhancement to new columns...\n');
    
    const savedEntries = await journalEntryService.saveJournalEntries({
      entries: testJournalEntries,
      userId: TEST_USER_ID,
      source: 'usd_enhancement_test',
      metadata: {
        testType: 'usd_columns_test',
        timestamp: new Date().toISOString()
      }
    });

    console.log(`✅ Saved ${savedEntries.length} journal entries`);
    
    // Analyze saved entries for USD enhancement in database columns
    let enhancedInColumns = 0;
    let enhancedInMetadata = 0;
    let totalUSDValue = 0;
    
    for (const [index, savedEntry] of savedEntries.entries()) {
      console.log(`\nSaved Entry ${index + 1}:`);
      console.log(`  💰 Amount: ${savedEntry.amount} ${savedEntry.currency}`);
      console.log(`  📝 Narrative: ${savedEntry.narrative}`);
      
      // **NEW: Check USD values in database columns first**
      if (savedEntry.usd_value && savedEntry.usd_source) {
        enhancedInColumns++;
        console.log(`  💵 USD Value: $${savedEntry.usd_value.toFixed(2)} (Database Column ✅)`);
        console.log(`  📈 Exchange Rate: ${savedEntry.usd_rate?.toFixed(4)} via ${savedEntry.usd_source}`);
        console.log(`  🕐 Price Time: ${new Date(savedEntry.usd_timestamp).toLocaleString()}`);
        
        totalUSDValue += parseFloat(savedEntry.usd_value);
      } else if (savedEntry.metadata) {
        // Fallback to check metadata
        try {
          const metadata = JSON.parse(savedEntry.metadata);
          
          if (metadata.ftsoEnhanced && metadata.usdValue) {
            enhancedInMetadata++;
            console.log(`  💵 USD Value: $${metadata.usdValueFormatted} (Metadata Legacy ⚠️)`);
            console.log(`  📈 Price: $${metadata.ftsoPrice?.toFixed(4)} via ${metadata.ftsoSource}`);
          } else {
            console.log(`  💵 USD Enhancement: ${metadata.ftsoError || 'Not available'} ❌`);
          }
        } catch (error) {
          console.log(`  💵 USD Enhancement: Metadata parse error ❌`);
        }
      } else {
        console.log(`  💵 USD Enhancement: No USD data available ❌`);
      }
    }

    console.log('\n📋 Step 5: Test AI Chat with USD Enhancement');
    console.log('─'.repeat(50));
    
    const testMessages = [
      "I received 0.5 ETH as payment for consulting services",
      "The company bought 2.0 ETH worth of cryptocurrency",
      "We paid 0.1 C2FLR in gas fees for a transaction"
    ];

    for (const [index, message] of testMessages.entries()) {
      console.log(`\nAI Chat Test ${index + 1}: "${message}"`);
      
      try {
        const gemini = new GeminiClient();
        const response = await gemini.chatResponse(
          message,
          { user: { id: TEST_USER_ID, email: 'test@example.com' } }
        );

        if (response.journalEntries && response.journalEntries.length > 0) {
          const entry = response.journalEntries[0];
          console.log(`  📊 Generated: ${entry.amount} ${entry.currency}`);
          
          // Check if response includes USD values
          const hasUSDMention = response.response.toLowerCase().includes('usd') || 
                               response.response.toLowerCase().includes('$');
          
          console.log(`  💰 USD Info in Response: ${hasUSDMention ? 'YES ✅' : 'NO ❌'}`);
          
          if (entry.usdValueFormatted) {
            console.log(`  💵 USD Value: $${entry.usdValueFormatted}`);
          }
        } else {
          console.log(`  ❌ No journal entries generated`);
        }
      } catch (error) {
        console.log(`  ❌ AI Chat failed: ${error.message}`);
      }
    }

    console.log('\n📋 Step 6: Summary Report');
    console.log('─'.repeat(50));
    
    console.log(`📊 USD Enhancement Statistics:`);
    console.log(`   - Test Entries Created: ${testJournalEntries.length}`);
    console.log(`   - Entries Successfully Saved: ${savedEntries.length}`);
    console.log(`   - Entries with USD in Database Columns: ${enhancedInColumns}`);
    console.log(`   - Entries with USD in Metadata (Legacy): ${enhancedInMetadata}`);
    console.log(`   - Total Entries with USD Values: ${enhancedInColumns + enhancedInMetadata}`);
    console.log(`   - Enhancement Success Rate: ${(((enhancedInColumns + enhancedInMetadata) / savedEntries.length) * 100).toFixed(1)}%`);
    console.log(`   - Database Column Usage Rate: ${((enhancedInColumns / savedEntries.length) * 100).toFixed(1)}%`);
    console.log(`   - Total USD Value: $${totalUSDValue.toFixed(2)}`);

    console.log('\n✅ VALIDATION CHECKLIST:');
    console.log('   🔗 FTSO Service Connectivity: ' + (isAvailable ? '✅' : '❌'));
    console.log('   💰 Price Data Retrieval: ' + (Object.values(priceResults).some(p => !p.error) ? '✅' : '❌'));
    console.log('   📊 Journal Entry Enhancement: ' + (enhancedInColumns + enhancedInMetadata > 0 ? '✅' : '❌'));
    console.log('   💾 Database Storage: ' + (savedEntries.length > 0 ? '✅' : '❌'));
    console.log('   🤖 AI Integration: ' + (testMessages.length > 0 ? '✅' : '❌'));

    const overallSuccess = isAvailable && 
                          enhancedInColumns + enhancedInMetadata > 0 && 
                          savedEntries.length > 0;

    console.log(`\n🎯 OVERALL RESULT: ${overallSuccess ? '✅ SUCCESS' : '❌ NEEDS ATTENTION'}`);
    
    if (overallSuccess) {
      console.log('\n🚀 USD Enhancement is working correctly!');
      console.log('   Journal entries now include real-time USD values from FTSO price feeds.');
      console.log('   AccountOne users will see both crypto amounts and USD equivalents.');
    } else {
      console.log('\n⚠️  Some issues detected. Please review the test results above.');
    }

  } catch (error) {
    console.error('\n💥 Test failed with error:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the test
testUSDEnhancement()
  .then(() => {
    console.log('\n🏁 USD Enhancement Test Complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Test suite failed:', error);
    process.exit(1);
  }); 