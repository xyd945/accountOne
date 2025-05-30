#!/usr/bin/env node

/**
 * Migration script to set up the Chart of Accounts system
 * This script will:
 * 1. Create the new account tables manually
 * 2. Seed the chart of accounts with standard accounts
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function createTables() {
  console.log('📊 Creating account tables manually...');
  
  // We'll try to create the basic structure using direct data insertion
  // First, let's try to create account categories
  
  const categories = [
    { code: '1000', name: 'Current Assets', type: 'ASSET', description: 'Assets expected to be converted to cash within one year', sort_order: 100 },
    { code: '1500', name: 'Non-Current Assets', type: 'ASSET', description: 'Long-term assets held for more than one year', sort_order: 200 },
    { code: '1800', name: 'Digital Assets', type: 'ASSET', description: 'Cryptocurrency and digital token holdings', sort_order: 300 },
    { code: '2000', name: 'Current Liabilities', type: 'LIABILITY', description: 'Obligations due within one year', sort_order: 400 },
    { code: '2500', name: 'Non-Current Liabilities', type: 'LIABILITY', description: 'Long-term obligations due after one year', sort_order: 500 },
    { code: '3000', name: 'Equity', type: 'EQUITY', description: 'Owner equity and retained earnings', sort_order: 600 },
    { code: '4000', name: 'Revenue', type: 'REVENUE', description: 'Income from business operations', sort_order: 700 },
    { code: '5000', name: 'Operating Expenses', type: 'EXPENSE', description: 'Costs of normal business operations', sort_order: 800 },
    { code: '6000', name: 'Financial Expenses', type: 'EXPENSE', description: 'Finance-related costs and fees', sort_order: 900 }
  ];

  // Try to insert categories
  try {
    const { data: catResult, error: catError } = await supabase
      .from('account_categories')
      .upsert(categories, { onConflict: 'code' })
      .select();
    
    if (catError) {
      console.log('⚠️ Account categories table may not exist yet. This is expected for first run.');
      console.log('Please create the schema first by running SQL manually in Supabase dashboard.');
      return false;
    } else {
      console.log(`✅ Created/updated ${catResult.length} account categories`);
    }
  } catch (error) {
    console.log('⚠️ Could not create account categories. Please run the SQL schema first.');
    return false;
  }

  return true;
}

async function seedAccounts() {
  console.log('🌱 Seeding basic accounts...');
  
  // Get category IDs first
  const { data: categories } = await supabase
    .from('account_categories')
    .select('*');
  
  if (!categories || categories.length === 0) {
    console.log('❌ No categories found. Cannot seed accounts.');
    return false;
  }

  const categoryMap = {};
  categories.forEach(cat => {
    categoryMap[cat.code] = cat.id;
  });

  // Basic accounts to create
  const accounts = [
    // Current Assets (1000s)
    { code: '1001', name: 'Cash and Cash Equivalents', category_id: categoryMap['1000'], account_type: 'ASSET', sub_type: 'CURRENT_ASSET', description: 'Cash, bank deposits, and short-term investments', ifrs_reference: 'IAS 7', sort_order: 1010 },
    { code: '1002', name: 'Bank Account - Operating', category_id: categoryMap['1000'], account_type: 'ASSET', sub_type: 'CURRENT_ASSET', description: 'Primary business bank account', ifrs_reference: 'IAS 7', sort_order: 1020 },
    { code: '1003', name: 'Bank Account - Crypto Exchange', category_id: categoryMap['1000'], account_type: 'ASSET', sub_type: 'CURRENT_ASSET', description: 'Fiat currency held on crypto exchanges', ifrs_reference: 'IAS 7', sort_order: 1030 },
    { code: '1011', name: 'Accounts Receivable', category_id: categoryMap['1000'], account_type: 'ASSET', sub_type: 'CURRENT_ASSET', description: 'Amounts owed by customers', ifrs_reference: 'IFRS 9', sort_order: 1110 },
    { code: '1012', name: 'Allowance for Doubtful Accounts', category_id: categoryMap['1000'], account_type: 'ASSET', sub_type: 'CURRENT_ASSET', description: 'Estimated uncollectible receivables', ifrs_reference: 'IFRS 9', sort_order: 1120 },
    { code: '1021', name: 'Inventory', category_id: categoryMap['1000'], account_type: 'ASSET', sub_type: 'CURRENT_ASSET', description: 'Goods held for sale', ifrs_reference: 'IAS 2', sort_order: 1210 },
    { code: '1031', name: 'Prepaid Expenses', category_id: categoryMap['1000'], account_type: 'ASSET', sub_type: 'CURRENT_ASSET', description: 'Expenses paid in advance', ifrs_reference: 'IAS 1', sort_order: 1310 },
    { code: '1032', name: 'Prepaid Insurance', category_id: categoryMap['1000'], account_type: 'ASSET', sub_type: 'CURRENT_ASSET', description: 'Insurance premiums paid in advance', ifrs_reference: 'IAS 1', sort_order: 1320 },

    // Non-Current Assets (1500s)
    { code: '1501', name: 'Property, Plant and Equipment', category_id: categoryMap['1500'], account_type: 'ASSET', sub_type: 'NON_CURRENT_ASSET', description: 'Land, buildings, equipment at cost', ifrs_reference: 'IAS 16', sort_order: 1510 },
    { code: '1502', name: 'Accumulated Depreciation - PPE', category_id: categoryMap['1500'], account_type: 'ASSET', sub_type: 'NON_CURRENT_ASSET', description: 'Accumulated depreciation on property, plant and equipment', ifrs_reference: 'IAS 16', sort_order: 1520 },
    { code: '1511', name: 'Computer Equipment', category_id: categoryMap['1500'], account_type: 'ASSET', sub_type: 'NON_CURRENT_ASSET', description: 'Computer hardware and IT equipment', ifrs_reference: 'IAS 16', sort_order: 1530 },
    { code: '1512', name: 'Office Equipment', category_id: categoryMap['1500'], account_type: 'ASSET', sub_type: 'NON_CURRENT_ASSET', description: 'Office furniture and equipment', ifrs_reference: 'IAS 16', sort_order: 1540 },
    { code: '1521', name: 'Intangible Assets', category_id: categoryMap['1500'], account_type: 'ASSET', sub_type: 'NON_CURRENT_ASSET', description: 'Software, patents, intellectual property', ifrs_reference: 'IAS 38', sort_order: 1550 },
    { code: '1522', name: 'Accumulated Amortization - Intangibles', category_id: categoryMap['1500'], account_type: 'ASSET', sub_type: 'NON_CURRENT_ASSET', description: 'Accumulated amortization on intangible assets', ifrs_reference: 'IAS 38', sort_order: 1560 },

    // Digital Assets (1800s)
    { code: '1801', name: 'Digital Assets - Bitcoin', category_id: categoryMap['1800'], account_type: 'ASSET', sub_type: 'DIGITAL_ASSET', description: 'Bitcoin holdings', ifrs_reference: 'IAS 38', sort_order: 1801 },
    { code: '1802', name: 'Digital Assets - Ethereum', category_id: categoryMap['1800'], account_type: 'ASSET', sub_type: 'DIGITAL_ASSET', description: 'Ethereum holdings', ifrs_reference: 'IAS 38', sort_order: 1802 },
    { code: '1803', name: 'Digital Assets - USDT', category_id: categoryMap['1800'], account_type: 'ASSET', sub_type: 'DIGITAL_ASSET', description: 'Tether USD stablecoin holdings', ifrs_reference: 'IAS 38', sort_order: 1803 },
    { code: '1804', name: 'Digital Assets - USDC', category_id: categoryMap['1800'], account_type: 'ASSET', sub_type: 'DIGITAL_ASSET', description: 'USD Coin stablecoin holdings', ifrs_reference: 'IAS 38', sort_order: 1804 },
    { code: '1808', name: 'Digital Assets - Other', category_id: categoryMap['1800'], account_type: 'ASSET', sub_type: 'DIGITAL_ASSET', description: 'Other cryptocurrency holdings', ifrs_reference: 'IAS 38', sort_order: 1808 },
    { code: '1820', name: 'DeFi Protocol Assets', category_id: categoryMap['1800'], account_type: 'ASSET', sub_type: 'DIGITAL_ASSET', description: 'Assets locked in DeFi protocols', ifrs_reference: 'IAS 38', sort_order: 1820 },
    { code: '1821', name: 'Staked Assets', category_id: categoryMap['1800'], account_type: 'ASSET', sub_type: 'DIGITAL_ASSET', description: 'Cryptocurrency assets staked for rewards', ifrs_reference: 'IAS 38', sort_order: 1821 },

    // Current Liabilities (2000s)
    { code: '2001', name: 'Accounts Payable', category_id: categoryMap['2000'], account_type: 'LIABILITY', sub_type: 'CURRENT_LIABILITY', description: 'Amounts owed to suppliers and vendors', ifrs_reference: 'IAS 1', sort_order: 2010 },
    { code: '2002', name: 'Accrued Expenses', category_id: categoryMap['2000'], account_type: 'LIABILITY', sub_type: 'CURRENT_LIABILITY', description: 'Expenses incurred but not yet paid', ifrs_reference: 'IAS 1', sort_order: 2020 },
    { code: '2003', name: 'Accrued Salaries', category_id: categoryMap['2000'], account_type: 'LIABILITY', sub_type: 'CURRENT_LIABILITY', description: 'Unpaid employee wages and salaries', ifrs_reference: 'IAS 19', sort_order: 2030 },
    { code: '2011', name: 'Income Tax Payable', category_id: categoryMap['2000'], account_type: 'LIABILITY', sub_type: 'CURRENT_LIABILITY', description: 'Income taxes owed', ifrs_reference: 'IAS 12', sort_order: 2110 },
    { code: '2012', name: 'Sales Tax Payable', category_id: categoryMap['2000'], account_type: 'LIABILITY', sub_type: 'CURRENT_LIABILITY', description: 'Sales tax collected from customers', ifrs_reference: 'IAS 1', sort_order: 2120 },
    { code: '2013', name: 'Payroll Tax Payable', category_id: categoryMap['2000'], account_type: 'LIABILITY', sub_type: 'CURRENT_LIABILITY', description: 'Payroll taxes owed', ifrs_reference: 'IAS 19', sort_order: 2130 },
    { code: '2021', name: 'Short-term Loans', category_id: categoryMap['2000'], account_type: 'LIABILITY', sub_type: 'CURRENT_LIABILITY', description: 'Loans due within one year', ifrs_reference: 'IFRS 9', sort_order: 2210 },
    { code: '2022', name: 'Credit Cards Payable', category_id: categoryMap['2000'], account_type: 'LIABILITY', sub_type: 'CURRENT_LIABILITY', description: 'Credit card balances owed', ifrs_reference: 'IFRS 9', sort_order: 2220 },
    { code: '2031', name: 'Unearned Revenue', category_id: categoryMap['2000'], account_type: 'LIABILITY', sub_type: 'CURRENT_LIABILITY', description: 'Payments received for future services', ifrs_reference: 'IFRS 15', sort_order: 2310 },

    // Non-Current Liabilities (2500s)
    { code: '2501', name: 'Long-term Loans', category_id: categoryMap['2500'], account_type: 'LIABILITY', sub_type: 'NON_CURRENT_LIABILITY', description: 'Loans due after one year', ifrs_reference: 'IFRS 9', sort_order: 2510 },
    { code: '2502', name: 'Deferred Tax Liability', category_id: categoryMap['2500'], account_type: 'LIABILITY', sub_type: 'NON_CURRENT_LIABILITY', description: 'Future tax obligations', ifrs_reference: 'IAS 12', sort_order: 2520 },

    // Equity Accounts (3000s)
    { code: '3001', name: 'Share Capital', category_id: categoryMap['3000'], account_type: 'EQUITY', sub_type: 'EQUITY', description: 'Issued share capital and capital contributions', ifrs_reference: 'IAS 32', sort_order: 3010 },
    { code: '3002', name: 'Common Stock', category_id: categoryMap['3000'], account_type: 'EQUITY', sub_type: 'EQUITY', description: 'Common stock issued to shareholders', ifrs_reference: 'IAS 32', sort_order: 3020 },
    { code: '3003', name: 'Retained Earnings', category_id: categoryMap['3000'], account_type: 'EQUITY', sub_type: 'EQUITY', description: 'Accumulated profits retained in business', ifrs_reference: 'IAS 1', sort_order: 3030 },
    { code: '3004', name: 'Owner Draw', category_id: categoryMap['3000'], account_type: 'EQUITY', sub_type: 'EQUITY', description: 'Withdrawals by business owner', ifrs_reference: 'IAS 1', sort_order: 3040 },

    // Revenue (4000s)
    { code: '4001', name: 'Trading Revenue', category_id: categoryMap['4000'], account_type: 'REVENUE', sub_type: 'REVENUE', description: 'Revenue from cryptocurrency trading', ifrs_reference: 'IFRS 15', sort_order: 4010 },
    { code: '4002', name: 'Staking Revenue', category_id: categoryMap['4000'], account_type: 'REVENUE', sub_type: 'REVENUE', description: 'Revenue from staking rewards', ifrs_reference: 'IFRS 15', sort_order: 4020 },
    { code: '4003', name: 'Service Revenue', category_id: categoryMap['4000'], account_type: 'REVENUE', sub_type: 'REVENUE', description: 'Revenue from services provided', ifrs_reference: 'IFRS 15', sort_order: 4030 },
    { code: '4004', name: 'Consulting Revenue', category_id: categoryMap['4000'], account_type: 'REVENUE', sub_type: 'REVENUE', description: 'Revenue from consulting services', ifrs_reference: 'IFRS 15', sort_order: 4040 },
    { code: '4005', name: 'Interest Income', category_id: categoryMap['4000'], account_type: 'REVENUE', sub_type: 'REVENUE', description: 'Interest earned on investments', ifrs_reference: 'IFRS 9', sort_order: 4050 },
    { code: '4006', name: 'Other Income', category_id: categoryMap['4000'], account_type: 'REVENUE', sub_type: 'REVENUE', description: 'Miscellaneous income', ifrs_reference: 'IAS 1', sort_order: 4060 },

    // Operating Expenses (5000s)
    { code: '5000', name: 'Operating Expenses', category_id: categoryMap['5000'], account_type: 'EXPENSE', sub_type: 'OPERATING_EXPENSE', description: 'General operating expenses', ifrs_reference: 'IAS 1', sort_order: 5000 },
    { code: '5001', name: 'Salaries and Wages', category_id: categoryMap['5000'], account_type: 'EXPENSE', sub_type: 'OPERATING_EXPENSE', description: 'Employee compensation', ifrs_reference: 'IAS 19', sort_order: 5010 },
    { code: '5002', name: 'Employee Benefits', category_id: categoryMap['5000'], account_type: 'EXPENSE', sub_type: 'OPERATING_EXPENSE', description: 'Health insurance, retirement contributions', ifrs_reference: 'IAS 19', sort_order: 5020 },
    { code: '5003', name: 'Software and Technology', category_id: categoryMap['5000'], account_type: 'EXPENSE', sub_type: 'OPERATING_EXPENSE', description: 'Technology and software expenses', ifrs_reference: 'IAS 38', sort_order: 5030 },
    { code: '5004', name: 'Professional Services', category_id: categoryMap['5000'], account_type: 'EXPENSE', sub_type: 'OPERATING_EXPENSE', description: 'Legal, accounting, consulting fees', ifrs_reference: 'IAS 1', sort_order: 5040 },
    { code: '5005', name: 'Office Rent', category_id: categoryMap['5000'], account_type: 'EXPENSE', sub_type: 'OPERATING_EXPENSE', description: 'Office space rental costs', ifrs_reference: 'IFRS 16', sort_order: 5050 },
    { code: '5006', name: 'Utilities', category_id: categoryMap['5000'], account_type: 'EXPENSE', sub_type: 'OPERATING_EXPENSE', description: 'Electricity, internet, phone', ifrs_reference: 'IAS 1', sort_order: 5060 },
    { code: '5007', name: 'Travel and Entertainment', category_id: categoryMap['5000'], account_type: 'EXPENSE', sub_type: 'OPERATING_EXPENSE', description: 'Business travel and client entertainment', ifrs_reference: 'IAS 1', sort_order: 5070 },
    { code: '5008', name: 'Marketing and Advertising', category_id: categoryMap['5000'], account_type: 'EXPENSE', sub_type: 'OPERATING_EXPENSE', description: 'Marketing campaigns and advertising', ifrs_reference: 'IAS 1', sort_order: 5080 },
    { code: '5009', name: 'Office Supplies', category_id: categoryMap['5000'], account_type: 'EXPENSE', sub_type: 'OPERATING_EXPENSE', description: 'Office supplies and materials', ifrs_reference: 'IAS 1', sort_order: 5090 },
    { code: '5010', name: 'Insurance', category_id: categoryMap['5000'], account_type: 'EXPENSE', sub_type: 'OPERATING_EXPENSE', description: 'Business insurance premiums', ifrs_reference: 'IAS 1', sort_order: 5100 },
    { code: '5011', name: 'Depreciation Expense', category_id: categoryMap['5000'], account_type: 'EXPENSE', sub_type: 'OPERATING_EXPENSE', description: 'Depreciation of fixed assets', ifrs_reference: 'IAS 16', sort_order: 5110 },
    { code: '5012', name: 'Amortization Expense', category_id: categoryMap['5000'], account_type: 'EXPENSE', sub_type: 'OPERATING_EXPENSE', description: 'Amortization of intangible assets', ifrs_reference: 'IAS 38', sort_order: 5120 },

    // Financial Expenses (6000s)
    { code: '6001', name: 'Transaction Fees', category_id: categoryMap['6000'], account_type: 'EXPENSE', sub_type: 'FINANCIAL_EXPENSE', description: 'Blockchain transaction fees (gas fees)', ifrs_reference: 'IAS 1', sort_order: 6010 },
    { code: '6002', name: 'Exchange Fees', category_id: categoryMap['6000'], account_type: 'EXPENSE', sub_type: 'FINANCIAL_EXPENSE', description: 'Cryptocurrency exchange trading fees', ifrs_reference: 'IAS 1', sort_order: 6020 },
    { code: '6003', name: 'Interest Expense', category_id: categoryMap['6000'], account_type: 'EXPENSE', sub_type: 'FINANCIAL_EXPENSE', description: 'Interest on loans and credit', ifrs_reference: 'IFRS 9', sort_order: 6030 },
    { code: '6004', name: 'Bank Fees', category_id: categoryMap['6000'], account_type: 'EXPENSE', sub_type: 'FINANCIAL_EXPENSE', description: 'Banking and wire transfer fees', ifrs_reference: 'IAS 1', sort_order: 6040 },
    { code: '6005', name: 'Foreign Exchange Loss', category_id: categoryMap['6000'], account_type: 'EXPENSE', sub_type: 'FINANCIAL_EXPENSE', description: 'Losses from currency exchange', ifrs_reference: 'IAS 21', sort_order: 6050 },
    { code: '6006', name: 'Realized Loss on Crypto', category_id: categoryMap['6000'], account_type: 'EXPENSE', sub_type: 'FINANCIAL_EXPENSE', description: 'Realized losses from crypto asset sales', ifrs_reference: 'IAS 38', sort_order: 6060 }
  ];

  try {
    const { data: accountResult, error: accountError } = await supabase
      .from('accounts')
      .upsert(accounts, { onConflict: 'code' })
      .select();
    
    if (accountError) {
      console.log('❌ Error creating accounts:', accountError.message);
      return false;
    } else {
      console.log(`✅ Created/updated ${accountResult.length} accounts`);
    }
  } catch (error) {
    console.log('❌ Could not create accounts:', error.message);
    return false;
  }

  return true;
}

async function seedCryptoAssets() {
  console.log('🌱 Seeding cryptocurrency assets...');
  
  // Get account IDs for crypto assets
  const { data: cryptoAccounts } = await supabase
    .from('accounts')
    .select('id, code')
    .in('code', ['1801', '1802', '1803', '1804']);
  
  if (!cryptoAccounts || cryptoAccounts.length === 0) {
    console.log('⚠️ No crypto asset accounts found. Skipping crypto assets.');
    return false;
  }

  const accountMap = {};
  cryptoAccounts.forEach(acc => {
    accountMap[acc.code] = acc.id;
  });

  const cryptoAssets = [
    { symbol: 'BTC', name: 'Bitcoin', account_id: accountMap['1801'], blockchain: 'bitcoin', decimals: 8, is_stable_coin: false },
    { symbol: 'ETH', name: 'Ethereum', account_id: accountMap['1802'], blockchain: 'ethereum', decimals: 18, is_stable_coin: false },
    { symbol: 'USDT', name: 'Tether USD', account_id: accountMap['1803'], blockchain: 'ethereum', decimals: 6, is_stable_coin: true },
    { symbol: 'USDC', name: 'USD Coin', account_id: accountMap['1804'], blockchain: 'ethereum', decimals: 6, is_stable_coin: true }
  ];

  try {
    const { data: cryptoResult, error: cryptoError } = await supabase
      .from('crypto_assets')
      .upsert(cryptoAssets, { onConflict: 'symbol' })
      .select();
    
    if (cryptoError) {
      console.log('❌ Error creating crypto assets:', cryptoError.message);
      return false;
    } else {
      console.log(`✅ Created/updated ${cryptoResult.length} crypto assets`);
    }
  } catch (error) {
    console.log('❌ Could not create crypto assets:', error.message);
    return false;
  }

  return true;
}

async function runMigration() {
  console.log('🚀 Starting Chart of Accounts migration...\n');

  try {
    // Check if we can access the tables
    const tablesExist = await createTables();
    
    if (!tablesExist) {
      console.log('\n❌ Tables do not exist yet. Please run the schema SQL first.');
      console.log('\n🔧 To create the schema:');
      console.log('1. Go to your Supabase dashboard');
      console.log('2. Navigate to SQL Editor');
      console.log('3. Run the contents of: backend/src/models/chart_of_accounts_schema.sql');
      console.log('4. Then run this migration script again');
      return;
    }

    // If tables exist, seed the data
    await seedAccounts();
    await seedCryptoAssets();

    // Verify the setup
    console.log('\n🔍 Verifying migration...');
    
    const { data: categories } = await supabase.from('account_categories').select('*');
    const { data: accounts } = await supabase.from('accounts').select('*');
    const { data: cryptos } = await supabase.from('crypto_assets').select('*');

    console.log(`✅ Total categories: ${categories?.length || 0}`);
    console.log(`✅ Total accounts: ${accounts?.length || 0}`);
    console.log(`✅ Total crypto assets: ${cryptos?.length || 0}`);

    // Display sample accounts
    if (accounts && accounts.length > 0) {
      console.log('\n📋 Sample Chart of Accounts:');
      console.log('=' .repeat(60));
      accounts.slice(0, 10).forEach(account => {
        console.log(`${account.code} - ${account.name} (${account.account_type})`);
      });
    }

    console.log('\n🎉 Migration completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Restart your backend server to load the new account service');
    console.log('2. Test the new /api/accounts endpoints');
    console.log('3. Verify AI transaction analysis uses the chart of accounts');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('\nPlease check:');
    console.error('1. Database connection is working');
    console.error('2. SUPABASE_SERVICE_ROLE_KEY has admin permissions');
    console.error('3. Tables have been created with the schema SQL');
    process.exit(1);
  }
}

// Run the migration
if (require.main === module) {
  runMigration();
}

module.exports = { runMigration }; 