require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

async function createEthereumAccountFinal() {
  console.log('🔧 FIXING ETH ACCOUNT MAPPING ISSUE (FINAL VERSION)');
  console.log('=================================================\n');

  try {
    // Initialize Supabase client
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Step 1: Check existing accounts and their structure
    console.log('🔍 Step 1: Checking existing accounts schema...');
    const { data: existingAccounts, error: fetchError } = await supabase
      .from('accounts')
      .select('*')
      .limit(1);
    
    if (fetchError) throw fetchError;
    
    if (existingAccounts.length > 0) {
      console.log('📋 Account table structure:');
      console.log('Columns:', Object.keys(existingAccounts[0]));
    }
    
    // Check for existing Ethereum accounts
    const { data: allAccounts, error: allError } = await supabase
      .from('accounts')
      .select('*');
    
    if (allError) throw allError;
    
    const ethAccounts = allAccounts.filter(acc => 
      acc.name.toLowerCase().includes('ethereum') || 
      acc.name.toLowerCase().includes('eth')
    );
    
    if (ethAccounts.length > 0) {
      console.log('✅ Found existing Ethereum accounts:');
      ethAccounts.forEach(acc => {
        console.log(`  ${acc.code} - ${acc.name} (${acc.account_type})`);
      });
      return { existing: true, accounts: ethAccounts };
    }
    
    console.log('❌ No Ethereum account found.');
    
    // Step 2: Look at existing Digital Assets accounts to understand the pattern
    console.log('\n🔍 Step 2: Analyzing existing Digital Assets accounts...');
    const digitalAssetAccounts = allAccounts.filter(acc => 
      acc.name.toLowerCase().includes('digital') && 
      acc.name.toLowerCase().includes('asset')
    );
    
    console.log('Existing Digital Asset accounts:');
    digitalAssetAccounts.forEach(acc => {
      console.log(`  ${acc.code} - ${acc.name}`);
      console.log(`    Type: ${acc.account_type}`);
      console.log(`    Category: ${acc.category_id || 'N/A'}`);
      console.log(`    Active: ${acc.is_active}`);
      console.log('');
    });
    
    if (digitalAssetAccounts.length === 0) {
      throw new Error('No Digital Asset accounts found to use as template');
    }
    
    // Use the first digital asset account as template
    const template = digitalAssetAccounts[0];
    
    // Step 3: Create the Ethereum account using the template structure
    console.log('\n🛠️  Step 3: Creating Ethereum account...');
    
    const ethereumAccount = {
      name: 'Digital Assets - Ethereum',
      code: '1805',
      account_type: template.account_type,
      is_active: true,
      description: 'Ethereum (ETH) cryptocurrency holdings'
    };
    
    // Add category_id if it exists in template
    if (template.category_id) {
      ethereumAccount.category_id = template.category_id;
    }
    
    console.log('Creating account with structure:');
    console.log(JSON.stringify(ethereumAccount, null, 2));
    
    const { data: createdAccount, error: createError } = await supabase
      .from('accounts')
      .insert([ethereumAccount])
      .select()
      .single();
    
    if (createError) {
      console.log('❌ Insert failed:', createError);
      throw createError;
    }
    
    console.log('✅ Successfully created Ethereum account!');
    console.log(`   ID: ${createdAccount.id}`);
    console.log(`   Code: ${createdAccount.code}`);
    console.log(`   Name: ${createdAccount.name}`);
    console.log(`   Type: ${createdAccount.account_type}`);
    
    return { 
      created: true, 
      account: createdAccount
    };
    
  } catch (error) {
    console.log(`❌ Failed to create Ethereum account: ${error.message}`);
    if (error.details) console.log('Details:', error.details);
    if (error.hint) console.log('Hint:', error.hint);
    return { error: error.message };
  }
}

// Run the test
if (require.main === module) {
  createEthereumAccountFinal()
    .then(results => {
      console.log('\n🏁 Ethereum Account Creation (Final) Completed');
      if (results.created) {
        console.log('🎉 SUCCESS! ETH transactions should now map to "Digital Assets - Ethereum"');
      }
    })
    .catch(error => {
      console.error('💥 Test failed:', error.message);
    });
}

module.exports = createEthereumAccountFinal; 