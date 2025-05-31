require('dotenv').config();
const blockscoutClient = require('./src/services/blockscoutClient');
const AIClientFactory = require('./src/services/aiClients/index');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testDuplicationFix() {
  console.log('🧪 Testing Duplication Fix...\n');

  try {
    const txHash = '0xedc0e7fff545af2931d80852d3d10331bb91f9c96b3e70047274fbaf51b06f91';
    const message = `Analyze this transaction hash ${txHash} - I received some XYD tokens as a refund from our designer`;

    console.log('📋 Step 1: Cleaning up any existing test entries...');
    await supabase
      .from('journal_entries')
      .delete()
      .or('account_debit.like.%XYD%,account_credit.like.%XYD%,currency.eq.XYD');
    console.log('✅ Cleaned up existing entries');

    console.log('\n📋 Step 2: Simulating chat response (this was causing duplicates)...');
    
    // Simulate the context that would be available in the chat route
    const mockContext = {
      user: {
        id: '550e8400-e29b-41d4-a716-446655440000' // Valid UUID format
      }
    };

    // This simulates what the chat route does
    const response = await AIClientFactory.chatResponse(message, mockContext);

    console.log('✅ Chat response completed:', {
      hasResponse: !!response.response,
      hasJournalEntries: !!(response.journalEntries && response.journalEntries.length > 0),
      entriesCount: response.journalEntries?.length || 0,
      alreadySaved: response.alreadySaved // This is the new flag we added
    });

    console.log('\n📋 Step 3: Checking database for duplicates...');
    
    // Wait a moment for any async operations to complete
    await new Promise(resolve => setTimeout(resolve, 1000));

    const { data: entries, error } = await supabase
      .from('journal_entries')
      .select('id, transaction_id, account_debit, account_credit, amount, currency, created_at')
      .or('account_debit.like.%XYD%,account_credit.like.%XYD%,currency.eq.XYD')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Database query failed:', error);
      return;
    }

    console.log(`Found ${entries.length} XYD-related entries in database:`);
    
    entries.forEach((entry, index) => {
      console.log(`${index + 1}. ${entry.account_debit} -> ${entry.account_credit}`);
      console.log(`   Amount: ${entry.amount} ${entry.currency}`);
      console.log(`   Transaction ID: ${entry.transaction_id || 'NULL'}`);
      console.log(`   Created: ${entry.created_at}`);
      console.log('');
    });

    console.log('\n🎯 Duplication Analysis:');
    
    // Check for duplicates by grouping similar entries
    const duplicateGroups = {};
    entries.forEach(entry => {
      const key = `${entry.account_debit}->${entry.account_credit}-${entry.amount}-${entry.currency}`;
      if (!duplicateGroups[key]) {
        duplicateGroups[key] = [];
      }
      duplicateGroups[key].push(entry);
    });

    let hasDuplicates = false;
    Object.entries(duplicateGroups).forEach(([key, group]) => {
      if (group.length > 1) {
        hasDuplicates = true;
        console.log(`❌ DUPLICATE FOUND: ${key}`);
        console.log(`   Count: ${group.length}`);
        console.log(`   Transaction IDs: ${group.map(e => e.transaction_id || 'NULL').join(', ')}`);
      } else {
        console.log(`✅ UNIQUE: ${key}`);
      }
    });

    console.log('\n📊 Final Results:');
    console.log(`- Total entries created: ${entries.length}`);
    console.log(`- Expected entries: 2 (1 XYD + 1 gas fee)`);
    console.log(`- Has duplicates: ${hasDuplicates ? '❌ YES' : '✅ NO'}`);
    console.log(`- AlreadySaved flag worked: ${response.alreadySaved ? '✅ YES' : '❌ NO'}`);

    if (!hasDuplicates && entries.length === 2) {
      console.log('\n🎉 SUCCESS: Duplication fix is working!');
      console.log('✅ Only the expected 2 entries were created');
      console.log('✅ No duplicate entries found');
    } else {
      console.log('\n❌ ISSUE: Duplication still occurring');
      console.log('- Review the chat route logic');
      console.log('- Check if alreadySaved flag is being set correctly');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testDuplicationFix(); 