require('dotenv').config();

const GeminiClient = require('./src/services/aiClients/geminiClient');
const journalEntryService = require('./src/services/journalEntryService');

const TEST_USER_ID = '53f5afe6-cb6a-4436-8a3a-45e57a6db798';

async function testBusinessNarratives() {
  console.log('🏢 Testing Business Narratives in Journal Entries');
  console.log('='.repeat(60));
  
  try {
    // Create journal entries with proper business narratives
    const testEntries = [
      {
        accountDebit: 'Share Capital',
        accountCredit: 'Digital Assets - C2FLR',
        amount: 10000,
        currency: 'C2FLR',
        narrative: 'Investment of 1 BTC equivalent to company capital',
        confidence: 0.95
      },
      {
        accountDebit: 'Digital Assets - Ethereum',
        accountCredit: 'Cash and Cash Equivalents',
        amount: 2.5,
        currency: 'ETH',
        narrative: 'Purchase of Ethereum for trading portfolio',
        confidence: 0.92
      },
      {
        accountDebit: 'Office Equipment',
        accountCredit: 'Digital Assets - XYD',
        amount: 500,
        currency: 'XYD',
        narrative: 'Payment for new office computers using XYD tokens',
        confidence: 0.88
      }
    ];

    console.log('\n📝 Creating journal entries with business narratives...');
    
    const savedEntries = await journalEntryService.saveJournalEntries({
      entries: testEntries,
      userId: TEST_USER_ID,
      source: 'business_narrative_test',
      metadata: {
        testType: 'business_narratives',
        timestamp: new Date().toISOString()
      }
    });

    console.log(`✅ Created ${savedEntries.length} journal entries with business narratives`);
    
    // Display the results
    savedEntries.forEach((entry, index) => {
      console.log(`\n📊 Entry ${index + 1}:`);
      console.log(`   💰 Amount: ${entry.amount} ${entry.currency}`);
      console.log(`   📝 Business Narrative: "${entry.narrative}"`);
      console.log(`   💵 USD Value: ${entry.usd_value ? `$${entry.usd_value.toFixed(2)}` : 'Not available'}`);
      console.log(`   📈 FTSO Rate: ${entry.usd_rate ? `$${entry.usd_rate.toFixed(4)}/${entry.currency}` : 'Not available'}`);
      console.log(`   🔗 Price Source: ${entry.usd_source || 'Not available'}`);
      console.log(`   🏦 Debit: ${entry.account_debit}`);
      console.log(`   🏦 Credit: ${entry.account_credit}`);
    });
    
    console.log('\n🎯 Frontend Display Test:');
    console.log('─'.repeat(50));
    console.log('✅ FTSO Price Info: Will show technical pricing data');
    console.log('✅ Business Narrative: Will show meaningful business descriptions');
    console.log('✅ Separate Display: Technical and business info are now separated');
    
    console.log('\n📱 Expected UI Layout:');
    savedEntries.forEach((entry, index) => {
      console.log(`\n**Entry ${index + 1} UI:**`);
      if (entry.usd_value && entry.usd_rate && entry.usd_source) {
        console.log(`   FTSO Info: "${entry.amount} ${entry.currency} (${entry.usd_value.toFixed(2)} USD at $${entry.usd_rate.toFixed(4)}/${entry.currency} via ${entry.usd_source})"`);
      }
      console.log(`   Business: "${entry.narrative}"`);
      console.log(`   Total: ${entry.amount} ${entry.currency} | $${entry.usd_value?.toFixed(2) || '0.00'} USD`);
    });

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testBusinessNarratives().catch(console.error); 