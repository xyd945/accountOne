require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkNarrative() {
  console.log('📋 Checking Narrative Field in Database');
  console.log('='.repeat(50));
  
  const { data: entries, error } = await supabase
    .from('journal_entries')
    .select('id, amount, currency, narrative, usd_value, usd_rate, usd_source, account_debit, account_credit')
    .eq('user_id', '53f5afe6-cb6a-4436-8a3a-45e57a6db798')
    .limit(3);
    
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  entries?.forEach((entry, i) => {
    console.log(`\nEntry ${i+1}:`);
    console.log(`  ID: ${entry.id}`);
    console.log(`  Amount: ${entry.amount} ${entry.currency}`);
    console.log(`  Debit: ${entry.account_debit}`);
    console.log(`  Credit: ${entry.account_credit}`);
    console.log(`  Narrative: "${entry.narrative}"`);
    console.log(`  USD Value: ${entry.usd_value}`);
    console.log(`  USD Rate: ${entry.usd_rate}`);
    console.log(`  USD Source: ${entry.usd_source}`);
    
    // Check if narrative is null, empty, or contains FTSO data
    if (!entry.narrative) {
      console.log(`  🔍 Narrative is ${entry.narrative === null ? 'NULL' : 'EMPTY'}`);
    } else if (entry.narrative.includes('USD at')) {
      console.log(`  🔍 Narrative contains FTSO data - this might be auto-generated`);
    } else {
      console.log(`  ✅ Narrative has business content`);
    }
  });
}

checkNarrative().catch(console.error); 