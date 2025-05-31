require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function updateCoston2CryptoAssets() {
  console.log('🔄 Updating Crypto Assets for Coston2 Testnet...\n');

  try {
    // Step 1: Update existing ETH account to handle C2FLR
    console.log('📋 Step 1: Updating accounts for Coston2...');
    
    // Get the Ethereum account to update it
    const { data: ethAccount } = await supabase
      .from('accounts')
      .select('*')
      .eq('code', '1802')
      .single();

    if (ethAccount) {
      // Update description to reflect Coston2 usage
      await supabase
        .from('accounts')
        .update({
          name: 'Digital Assets - C2FLR',
          description: 'Coston2 Flare testnet token holdings (C2FLR)',
        })
        .eq('code', '1802');
      
      console.log('✅ Updated 1802 account for C2FLR');
    }

    // Step 2: Add/Update crypto assets for Coston2
    console.log('\n📋 Step 2: Adding Coston2 crypto assets...');

    // Get account IDs
    const { data: accounts } = await supabase
      .from('accounts')
      .select('id, code, name')
      .in('code', ['1802', '1808']);

    const accountMap = {};
    accounts.forEach(acc => {
      accountMap[acc.code] = acc.id;
    });

    // Update or insert crypto assets for Coston2
    const cryptoAssets = [
      {
        symbol: 'C2FLR',
        name: 'Coston2 Flare',
        account_id: accountMap['1802'], // Use the updated account
        blockchain: 'flare-coston2',
        decimals: 18,
        is_stable_coin: false,
        contract_address: null, // Native token
      },
      {
        symbol: 'XYD',
        name: 'XYD Token',
        account_id: accountMap['1808'], // Digital Assets - Other
        blockchain: 'flare-coston2',
        decimals: 18,
        is_stable_coin: false,
        contract_address: '0xEc8F86Ffa44FD994A0Fa1971D606e1F37f2d43D2', // Your deployed XYD token
      }
    ];

    for (const asset of cryptoAssets) {
      // Check if exists
      const { data: existing } = await supabase
        .from('crypto_assets')
        .select('*')
        .eq('symbol', asset.symbol)
        .single();

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from('crypto_assets')
          .update(asset)
          .eq('symbol', asset.symbol);
        
        if (error) {
          console.log(`❌ Failed to update ${asset.symbol}:`, error.message);
        } else {
          console.log(`✅ Updated ${asset.symbol} crypto asset`);
        }
      } else {
        // Insert new
        const { error } = await supabase
          .from('crypto_assets')
          .insert([asset]);
        
        if (error) {
          console.log(`❌ Failed to insert ${asset.symbol}:`, error.message);
        } else {
          console.log(`✅ Added ${asset.symbol} crypto asset`);
        }
      }
    }

    // Step 3: Add AI mappings for new tokens
    console.log('\n📋 Step 3: Adding AI mappings...');

    const aiMappings = [
      {
        account_id: accountMap['1802'],
        keywords: ['c2flr', 'coston2', 'flare', 'gas'],
        transaction_types: ['transfer', 'gas_fee', 'receive'],
        context_patterns: ['gas fee', 'coston2 flare', 'c2flr payment'],
        confidence_weight: 0.95
      },
      {
        account_id: accountMap['1808'],
        keywords: ['xyd', 'xyd token', 'test token'],
        transaction_types: ['transfer', 'receive', 'purchase'],
        context_patterns: ['xyd token', 'test payment', 'refund'],
        confidence_weight: 0.90
      }
    ];

    for (const mapping of aiMappings) {
      const { error } = await supabase
        .from('account_ai_mappings')
        .upsert([mapping], { onConflict: 'account_id' });
      
      if (error) {
        console.log('❌ Failed to add AI mapping:', error.message);
      } else {
        console.log('✅ Added AI mapping for account');
      }
    }

    // Step 4: Verify the updates
    console.log('\n📋 Step 4: Verifying updates...');

    const { data: updatedAssets } = await supabase
      .from('crypto_assets')
      .select(`
        symbol,
        name,
        blockchain,
        contract_address,
        accounts(code, name)
      `)
      .in('symbol', ['C2FLR', 'XYD']);

    console.log('\n✅ Updated Crypto Assets:');
    updatedAssets.forEach(asset => {
      console.log(`- ${asset.symbol} (${asset.name})`);
      console.log(`  Account: ${asset.accounts?.code} - ${asset.accounts?.name}`);
      console.log(`  Blockchain: ${asset.blockchain}`);
      console.log(`  Contract: ${asset.contract_address || 'Native token'}\n`);
    });

    console.log('🎉 Coston2 crypto assets update completed successfully!');
    
    console.log('\n📋 Next Steps:');
    console.log('1. Restart the backend server to load new assets');
    console.log('2. Test token transfer journal entry creation');
    console.log('3. Verify gas fees are recorded in C2FLR');
    console.log('4. Check that XYD token transfers work correctly');

  } catch (error) {
    console.error('❌ Update failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

// Run the update
updateCoston2CryptoAssets(); 