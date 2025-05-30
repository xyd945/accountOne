#!/usr/bin/env node

/**
 * Migration script to set up the Chart of Accounts system
 * This script will:
 * 1. Create the new account tables
 * 2. Seed the chart of accounts with standard accounts
 * 3. Migrate existing journal entries to use proper account references (optional)
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function runMigration() {
  console.log('🚀 Starting Chart of Accounts migration...\n');

  try {
    // Step 1: Create the schema
    console.log('📊 Creating account tables...');
    const schemaSQL = fs.readFileSync(
      path.join(__dirname, '../backend/src/models/chart_of_accounts_schema.sql'), 
      'utf8'
    );
    
    // Execute schema creation
    const { error: schemaError } = await supabase.rpc('exec_sql', { sql: schemaSQL });
    if (schemaError) {
      throw new Error(`Schema creation failed: ${schemaError.message}`);
    }
    console.log('✅ Account tables created successfully\n');

    // Step 2: Seed the data
    console.log('🌱 Seeding chart of accounts data...');
    const seedSQL = fs.readFileSync(
      path.join(__dirname, '../backend/src/models/chart_of_accounts_seed.sql'), 
      'utf8'
    );
    
    // Execute seed data
    const { error: seedError } = await supabase.rpc('exec_sql', { sql: seedSQL });
    if (seedError) {
      throw new Error(`Seed data failed: ${seedError.message}`);
    }
    console.log('✅ Chart of accounts data seeded successfully\n');

    // Step 3: Verify the setup
    console.log('🔍 Verifying migration...');
    
    // Check account categories
    const { data: categories, error: catError } = await supabase
      .from('account_categories')
      .select('*');
    
    if (catError) throw catError;
    console.log(`✅ Created ${categories.length} account categories`);

    // Check accounts
    const { data: accounts, error: accError } = await supabase
      .from('accounts')
      .select('*');
    
    if (accError) throw accError;
    console.log(`✅ Created ${accounts.length} accounts`);

    // Check crypto assets
    const { data: cryptos, error: cryptoError } = await supabase
      .from('crypto_assets')
      .select('*');
    
    if (cryptoError) throw cryptoError;
    console.log(`✅ Created ${cryptos.length} cryptocurrency assets`);

    // Check AI mappings
    const { data: mappings, error: mappingError } = await supabase
      .from('account_ai_mappings')
      .select('*');
    
    if (mappingError) throw mappingError;
    console.log(`✅ Created ${mappings.length} AI account mappings\n`);

    // Step 4: Display sample chart of accounts
    console.log('📋 Sample Chart of Accounts:');
    console.log('=' .repeat(60));
    
    const { data: sampleAccounts, error: sampleError } = await supabase
      .from('accounts')
      .select(`
        code,
        name,
        account_type,
        account_categories(name)
      `)
      .order('sort_order')
      .limit(10);

    if (!sampleError) {
      sampleAccounts.forEach(account => {
        console.log(`${account.code} - ${account.name} (${account.account_type})`);
      });
    }

    console.log('\n🎉 Migration completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Restart your backend server to load the new account service');
    console.log('2. Test the new /api/accounts endpoints');
    console.log('3. Verify AI transaction analysis uses the chart of accounts');
    console.log('4. Consider running the account validation script on existing journal entries');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('\nPlease check:');
    console.error('1. Database connection is working');
    console.error('2. SUPABASE_SERVICE_ROLE_KEY has admin permissions');
    console.error('3. The SQL files exist and are readable');
    process.exit(1);
  }
}

// Create exec_sql function if it doesn't exist
async function createExecSQLFunction() {
  try {
    const functionSQL = `
      CREATE OR REPLACE FUNCTION exec_sql(sql text)
      RETURNS void
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
      BEGIN
        EXECUTE sql;
      END;
      $$;
    `;

    const { error } = await supabase.rpc('exec', { sql: functionSQL });
    if (error && !error.message.includes('already exists')) {
      console.log('Created exec_sql function');
    }
  } catch (error) {
    // Ignore - function might already exist
  }
}

// Run the migration
if (require.main === module) {
  createExecSQLFunction().then(() => {
    runMigration();
  });
}

module.exports = { runMigration }; 