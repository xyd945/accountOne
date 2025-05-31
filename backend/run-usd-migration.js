require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runUSDMigration() {
  console.log('🚀 Running USD Columns Migration...');
  console.log('Adding usd_value, usd_rate, usd_source, and usd_timestamp columns to journal_entries');
  
  try {
    // Step 1: Add USD columns
    console.log('\n📝 Step 1: Adding USD columns...');
    
    const { error: alterError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE journal_entries 
        ADD COLUMN IF NOT EXISTS usd_value NUMERIC(20, 2) NULL,
        ADD COLUMN IF NOT EXISTS usd_rate NUMERIC(20, 8) NULL,
        ADD COLUMN IF NOT EXISTS usd_source VARCHAR(50) NULL,
        ADD COLUMN IF NOT EXISTS usd_timestamp TIMESTAMPTZ NULL;
      `
    });

    if (alterError) {
      console.error('❌ Error adding USD columns:', alterError);
      return;
    }
    console.log('✅ USD columns added successfully');

    // Step 2: Add indexes
    console.log('\n📝 Step 2: Creating indexes...');
    
    const { error: indexError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE INDEX IF NOT EXISTS idx_journal_entries_usd_value ON journal_entries(usd_value);
        CREATE INDEX IF NOT EXISTS idx_journal_entries_usd_source ON journal_entries(usd_source);
        CREATE INDEX IF NOT EXISTS idx_journal_entries_usd_timestamp ON journal_entries(usd_timestamp);
      `
    });

    if (indexError) {
      console.error('❌ Error creating indexes:', indexError);
      return;
    }
    console.log('✅ Indexes created successfully');

    // Step 3: Add column comments
    console.log('\n📝 Step 3: Adding column documentation...');
    
    const { error: commentError } = await supabase.rpc('exec_sql', {
      sql: `
        COMMENT ON COLUMN journal_entries.usd_value IS 'USD equivalent of the amount at time of transaction';
        COMMENT ON COLUMN journal_entries.usd_rate IS 'Exchange rate used to calculate USD value (currency to USD)';
        COMMENT ON COLUMN journal_entries.usd_source IS 'Source of exchange rate (FTSO, CoinGecko, Manual, etc.)';
        COMMENT ON COLUMN journal_entries.usd_timestamp IS 'Timestamp when the USD rate was fetched';
      `
    });

    if (commentError) {
      console.error('❌ Error adding comments:', commentError);
      return;
    }
    console.log('✅ Column documentation added successfully');

    // Step 4: Create view
    console.log('\n📝 Step 4: Creating USD reporting view...');
    
    const { error: viewError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE OR REPLACE VIEW journal_entries_with_usd AS
        SELECT 
          j.*,
          CASE 
            WHEN j.usd_value IS NOT NULL THEN j.usd_value
            WHEN j.currency = 'USD' THEN j.amount
            ELSE NULL
          END AS effective_usd_value,
          CASE 
            WHEN j.usd_value IS NOT NULL THEN CONCAT('$', TO_CHAR(j.usd_value, 'FM999,999,999,990.00'))
            WHEN j.currency = 'USD' THEN CONCAT('$', TO_CHAR(j.amount, 'FM999,999,999,990.00'))
            ELSE NULL
          END AS formatted_usd_value
        FROM journal_entries j;
      `
    });

    if (viewError) {
      console.error('❌ Error creating view:', viewError);
      return;
    }
    console.log('✅ USD reporting view created successfully');

    // Step 5: Verify the migration
    console.log('\n📝 Step 5: Verifying migration...');
    
    const { data: columns, error: verifyError } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'journal_entries' 
        AND column_name IN ('usd_value', 'usd_rate', 'usd_source', 'usd_timestamp')
        ORDER BY column_name;
      `
    });

    if (verifyError) {
      console.error('❌ Error verifying migration:', verifyError);
      return;
    }

    console.log('✅ Migration verified! New columns:');
    if (columns && Array.isArray(columns)) {
      columns.forEach(col => {
        console.log(`   - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
      });
    }

    // Step 6: Test the view
    console.log('\n📝 Step 6: Testing USD view...');
    
    const { data: viewTest, error: viewTestError } = await supabase
      .from('journal_entries_with_usd')
      .select('id, amount, currency, usd_value, effective_usd_value, formatted_usd_value')
      .limit(3);

    if (viewTestError) {
      console.error('❌ Error testing view:', viewTestError);
      return;
    }

    console.log('✅ USD view working! Sample data:');
    if (viewTest && viewTest.length > 0) {
      viewTest.forEach((entry, index) => {
        console.log(`   ${index + 1}. ${entry.amount} ${entry.currency} → ${entry.formatted_usd_value || 'No USD value'}`);
      });
    } else {
      console.log('   (No journal entries found to test with)');
    }

    console.log('\n🎉 USD Migration completed successfully!');
    console.log('\n📊 New capabilities:');
    console.log('   ✅ Direct USD value storage and querying');
    console.log('   ✅ Exchange rate tracking with source');
    console.log('   ✅ Timestamp for rate freshness');
    console.log('   ✅ Optimized indexes for USD reporting');
    console.log('   ✅ USD reporting view for easy queries');

  } catch (error) {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
runUSDMigration()
  .then(() => {
    console.log('\n🏁 Migration script completed!');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Migration script failed:', error);
    process.exit(1);
  }); 