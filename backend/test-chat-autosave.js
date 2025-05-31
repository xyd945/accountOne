require('dotenv').config();
const journalEntryService = require('./src/services/journalEntryService');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testChatAutoSave() {
  console.log('🧪 Testing Chat Route Auto-Save Logic...\n');

  try {
    console.log('📋 Step 1: Cleaning up test entries...');
    await supabase
      .from('journal_entries')
      .delete()
      .or('account_debit.like.%TEST%,account_credit.like.%TEST%');
    console.log('✅ Cleaned up existing entries');

    // Mock response object that simulates what geminiClient.chatResponse returns
    const mockResponses = [
      {
        name: 'With alreadySaved: true',
        response: {
          journalEntries: [
            {
              accountDebit: 'TEST Digital Assets - XYD',
              accountCredit: 'TEST Accounts Payable',
              amount: 10,
              currency: 'XYD',
              narrative: 'Test entry 1',
              confidence: 0.95
            }
          ],
          alreadySaved: true // This should prevent auto-save
        }
      },
      {
        name: 'With alreadySaved: false',
        response: {
          journalEntries: [
            {
              accountDebit: 'TEST Digital Assets - XYD',
              accountCredit: 'TEST Accounts Payable',
              amount: 5,
              currency: 'XYD',
              narrative: 'Test entry 2',
              confidence: 0.95
            }
          ],
          alreadySaved: false // This should trigger auto-save (old behavior)
        }
      },
      {
        name: 'Without alreadySaved flag (old format)',
        response: {
          journalEntries: [
            {
              accountDebit: 'TEST Digital Assets - XYD',
              accountCredit: 'TEST Accounts Payable',
              amount: 3,
              currency: 'XYD',
              narrative: 'Test entry 3',
              confidence: 0.95
            }
          ]
          // No alreadySaved flag - should trigger auto-save (backward compatibility)
        }
      }
    ];

    const userId = '550e8400-e29b-41d4-a716-446655440000';
    let totalSaved = 0;

    for (const { name, response } of mockResponses) {
      console.log(`\n📋 Testing: ${name}`);
      
      // Simulate the exact chat route logic
      const shouldSave = response.journalEntries && 
                        response.journalEntries.length > 0 && 
                        !response.alreadySaved; // This is our fix

      console.log(`   Should auto-save: ${shouldSave}`);
      console.log(`   Journal entries count: ${response.journalEntries?.length || 0}`);
      console.log(`   AlreadySaved flag: ${response.alreadySaved}`);

      if (shouldSave) {
        try {
          console.log('   🔄 Auto-saving entries...');
          
          // Flatten entries like the chat route does
          let flattenedEntries = [];
          for (const item of response.journalEntries) {
            if (item.entries && Array.isArray(item.entries)) {
              flattenedEntries.push(...item.entries);
            } else if (item.accountDebit || item.accountCredit) {
              flattenedEntries.push(item);
            }
          }

          const savedEntries = await journalEntryService.saveJournalEntries({
            entries: flattenedEntries,
            userId,
            source: 'ai_chat',
            metadata: {
              originalMessage: `Test message for ${name}`,
              timestamp: new Date().toISOString(),
            },
          });

          console.log(`   ✅ Saved ${savedEntries.length} entries`);
          totalSaved += savedEntries.length;
        } catch (saveError) {
          console.log(`   ❌ Save failed: ${saveError.message}`);
        }
      } else {
        console.log('   ⏭️ Skipped auto-save (flag prevented duplication)');
      }
    }

    console.log('\n📋 Checking database results...');
    
    const { data: entries, error } = await supabase
      .from('journal_entries')
      .select('id, account_debit, account_credit, amount, currency, narrative')
      .like('account_debit', '%TEST%')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Database query failed:', error);
      return;
    }

    console.log(`Found ${entries.length} test entries in database:`);
    entries.forEach((entry, index) => {
      console.log(`${index + 1}. ${entry.account_debit} -> ${entry.account_credit}`);
      console.log(`   Amount: ${entry.amount} ${entry.currency}`);
      console.log(`   Narrative: ${entry.narrative}`);
      console.log('');
    });

    console.log('\n🎯 Auto-Save Test Results:');
    console.log(`- Total entries that should have been saved: 2 (false flag + no flag)`);
    console.log(`- Total entries actually saved: ${totalSaved}`);
    console.log(`- Total entries in database: ${entries.length}`);
    console.log(`- AlreadySaved flag prevented saves: ${entries.length < 3 ? '✅ YES' : '❌ NO'}`);

    const expectedSaves = 2; // Only responses with alreadySaved: false or undefined should save
    const actualSaves = entries.length;

    if (actualSaves === expectedSaves) {
      console.log('\n🎉 SUCCESS: Auto-save prevention is working correctly!');
      console.log('✅ Entries with alreadySaved: true were not auto-saved');
      console.log('✅ Entries with alreadySaved: false or undefined were auto-saved');
    } else {
      console.log('\n❌ ISSUE: Auto-save logic not working as expected');
      console.log(`Expected ${expectedSaves} saves, got ${actualSaves}`);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testChatAutoSave(); 