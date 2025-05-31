require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

async function createEthereumAccountFixed() {
  console.log('🔧 FIXING ETH ACCOUNT MAPPING ISSUE (FIXED VERSION)');
  console.log('==================================================\n');

  try {
    // Initialize Supabase client
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Step 1: Check existing accounts
    console.log('🔍 Step 1: Checking for existing Ethereum accounts...');
    const { data: existingAccounts, error: fetchError } = await supabase
      .from('accounts')
      .select('*');
    
    if (fetchError) throw fetchError;
    
    const ethAccounts = existingAccounts.filter(acc => 
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
    
    // Step 2: Find the Digital Assets category
    console.log('\n🔍 Step 2: Finding Digital Assets category...');
    const { data: categories, error: catError } = await supabase
      .from('account_categories')
      .select('*');
    
    if (catError) throw catError;
    
    console.log('Available categories:');
    categories.forEach(cat => {
      console.log(`  ${cat.id} - ${cat.name} (${cat.code})`);
    });
    
    // Find Digital Assets category
    const digitalAssetsCategory = categories.find(cat => 
      cat.name.toLowerCase().includes('digital') && 
      cat.name.toLowerCase().includes('assets')
    );
    
    if (!digitalAssetsCategory) {
      console.log('❌ No Digital Assets category found. Available categories:');
      categories.forEach(cat => console.log(`  ${cat.name}`));
      throw new Error('Digital Assets category not found');
    }
    
    console.log(`✅ Found Digital Assets category: ${digitalAssetsCategory.id} - ${digitalAssetsCategory.name}`);
    
    // Step 3: Create the Ethereum account
    console.log('\n🛠️  Step 3: Creating Ethereum account...');
    
    const ethereumAccount = {
      name: 'Digital Assets - Ethereum',
      code: '1805',
      account_type: 'ASSET',
      account_category_id: digitalAssetsCategory.id,
      description: 'Ethereum (ETH) cryptocurrency holdings',
      is_active: true
    };
    
    console.log('Creating account:', JSON.stringify(ethereumAccount, null, 2));
    
    const { data: createdAccount, error: createError } = await supabase
      .from('accounts')
      .insert([ethereumAccount])
      .select()
      .single();
    
    if (createError) throw createError;
    
    console.log('✅ Successfully created Ethereum account!');
    console.log(`   ID: ${createdAccount.id}`);
    console.log(`   Code: ${createdAccount.code}`);
    console.log(`   Name: ${createdAccount.name}`);
    console.log(`   Type: ${createdAccount.account_type}`);
    console.log(`   Category: ${digitalAssetsCategory.name}`);
    
    return { 
      created: true, 
      account: createdAccount,
      category: digitalAssetsCategory
    };
    
  } catch (error) {
    console.log(`❌ Failed to create Ethereum account: ${error.message}`);
    console.log('Stack:', error.stack);
    return { error: error.message };
  }
}

// Run the test
if (require.main === module) {
  createEthereumAccountFixed()
    .then(results => {
      console.log('\n🏁 Ethereum Account Creation (Fixed) Completed');
      console.log('Results:', JSON.stringify(results, null, 2));
    })
    .catch(error => {
      console.error('💥 Test failed:', error.message);
    });
}

module.exports = createEthereumAccountFixed; 