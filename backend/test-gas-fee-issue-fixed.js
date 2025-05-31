require('dotenv').config();

// Set environment variables for FTSO testing
process.env.FTSO_PRICE_CONSUMER_ENABLED = 'true';
process.env.FTSO_PRICE_CONSUMER_ADDRESS = '0xed1692dd816996B8D7EB39e21344B3ed9Fda2d11';
process.env.FLARE_RPC_URL = 'https://coston2-api.flare.network/ext/C/rpc';
process.env.FLARE_CHAIN_ID = '114';
process.env.PRICE_FEED_CACHE_TTL = '60000';

const { createClient } = require('@supabase/supabase-js');
const GeminiClient = require('./src/services/aiClients/geminiClient');
const BlockscoutClient = require('./src/services/blockscoutClient');

const TEST_USER_ID = '53f5afe6-cb6a-4436-8a3a-45e57a6db798';
const TEST_TRANSACTION_HASH = '0x7c987ea9dfb3149cef6ab84427bfce4bf85a1376dcd9353b3f90d213c2cedd85'; // XYD token transfer

async function createXYDAccount() {
  // First, create the missing XYD account
  console.log('🔧 Creating Digital Assets - XYD account...');
  
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    // Check if XYD account exists
    const { data: existingAccounts } = await supabase
      .from('accounts')
      .select('*')
      .or('name.ilike.%XYD%,name.ilike.%xyd%');
    
    if (existingAccounts && existingAccounts.length > 0) {
      console.log('✅ XYD account already exists:');
      existingAccounts.forEach(acc => {
        console.log(`  ${acc.code} - ${acc.name}`);
      });
      return existingAccounts[0];
    }
    
    // Get the Digital Assets category
    const { data: digitalAssetAccount } = await supabase
      .from('accounts')
      .select('*')
      .eq('name', 'Digital Assets - Bitcoin')
      .single();
    
    if (!digitalAssetAccount) {
      throw new Error('No Digital Assets template found');
    }
    
    // Create XYD account
    const xydAccount = {
      name: 'Digital Assets - XYD',
      code: '1806',
      account_type: digitalAssetAccount.account_type,
      category_id: digitalAssetAccount.category_id,
      is_active: true,
      description: 'XYD Token cryptocurrency holdings'
    };
    
    const { data: createdAccount, error } = await supabase
      .from('accounts')
      .insert([xydAccount])
      .select()
      .single();
    
    if (error) throw error;
    
    console.log(`✅ Created XYD account: ${createdAccount.code} - ${createdAccount.name}`);
    return createdAccount;
    
  } catch (error) {
    console.log(`⚠️  XYD account creation failed: ${error.message}`);
    return null;
  }
}

async function testGasFeeIssueFixed() {
  console.log('⛽ TEST: Gas Fee Currency Issue (FIXED VERSION)');
  console.log('==============================================\n');
  
  console.log(`🧪 Testing with Coston2 transaction: ${TEST_TRANSACTION_HASH}`);
  console.log('Expected: Gas fees should be in C2FLR, NOT ETH');
  console.log('Expected: 1000 XYD should map to "Digital Assets - XYD"');
  console.log('─'.repeat(80));

  try {
    // Step 0: Create missing XYD account
    await createXYDAccount();
    
    // Step 1: Fetch real blockchain transaction data
    console.log('\n📡 Step 1: Fetching real transaction data from Coston2...');
    
    const transactionData = await BlockscoutClient.getTransactionInfo(TEST_TRANSACTION_HASH);
    
    console.log('✅ Transaction data retrieved:');
    console.log(`  Hash: ${transactionData.hash}`);
    console.log(`  From: ${transactionData.from}`);
    console.log(`  To: ${transactionData.to}`);
    console.log(`  Gas Used: ${transactionData.gas_used || transactionData.gasUsed}`);
    console.log(`  Gas Price: ${transactionData.gas_price || transactionData.gasPrice}`);
    
    // Calculate gas fee in C2FLR
    const gasUsed = transactionData.gas_used || transactionData.gasUsed || 0;
    const gasPrice = transactionData.gas_price || transactionData.gasPrice || 0;
    const gasFeeWei = parseFloat(gasUsed) * parseFloat(gasPrice);
    const gasFeeC2FLR = gasFeeWei / Math.pow(10, 18);
    
    console.log(`  Calculated Gas Fee: ${gasFeeC2FLR.toFixed(6)} C2FLR`);
    
    // Check token transfers
    if (transactionData.tokenTransfers && transactionData.tokenTransfers.length > 0) {
      console.log('\n🪙 Token Transfers:');
      transactionData.tokenTransfers.forEach((transfer, index) => {
        console.log(`  Transfer ${index + 1}:`);
        console.log(`    Token: ${transfer.token?.symbol || 'Unknown'}`);
        
        if (transfer.total?.value && transfer.token?.decimals) {
          const amount = parseFloat(transfer.total.value) / Math.pow(10, parseInt(transfer.token.decimals));
          console.log(`    Amount: ${amount} ${transfer.token.symbol}`);
        }
      });
    }
    
    // Step 2: Analyze with AI
    console.log('\n🤖 Step 2: Analyzing transaction with AI...');
    
    const transactionMessage = `Please analyze this specific Coston2 transaction hash ${TEST_TRANSACTION_HASH} and create journal entries. This transaction represents receiving 1000 XYD tokens from the project team on March 25, 2025.`;
    
    const gemini = new GeminiClient();
    const response = await gemini.chatResponse(
      transactionMessage,
      { user: { id: TEST_USER_ID, email: 'test@example.com' } }
    );

    console.log('\n📋 AI Analysis Results:');
    console.log(`Journal Entries Created: ${response.journalEntries?.length || 0}`);
    console.log(`Entries Already Saved: ${response.alreadySaved ? 'YES' : 'NO'}`);
    
    if (response.journalEntries && response.journalEntries.length > 0) {
      console.log('\n📊 Journal Entries Analysis:');
      
      let gasFeeIssues = [];
      let tokenMappingIssues = [];
      let successfulMappings = [];
      
      response.journalEntries.forEach((entry, index) => {
        console.log(`\nEntry ${index + 1}:`);
        console.log(`  Debit:     ${entry.accountDebit || entry.account_debit || 'N/A'}`);
        console.log(`  Credit:    ${entry.accountCredit || entry.account_credit || 'N/A'}`);
        console.log(`  Amount:    ${entry.amount}`);
        console.log(`  Currency:  ${entry.currency}`);
        console.log(`  Narrative: ${entry.narrative || entry.description || 'N/A'}`);
        
        // Use flexible field access
        const debitAccount = entry.accountDebit || entry.account_debit || '';
        const creditAccount = entry.accountCredit || entry.account_credit || '';
        const narrative = entry.narrative || entry.description || '';
        
        // Check for gas fee issues
        const isGasFee = narrative.toLowerCase().includes('gas') || 
                        narrative.toLowerCase().includes('fee') ||
                        debitAccount.toLowerCase().includes('fee');
        
        if (isGasFee) {
          if (entry.currency === 'ETH') {
            gasFeeIssues.push(`❌ Gas fee in ETH instead of C2FLR: ${entry.amount} ${entry.currency}`);
          } else if (entry.currency === 'C2FLR' || entry.currency === 'FLR') {
            successfulMappings.push(`✅ Gas fee correctly in C2FLR: ${entry.amount} ${entry.currency}`);
          }
        }
        
        // Check for XYD token mapping
        if (entry.currency === 'XYD') {
          if (debitAccount.includes('Other')) {
            tokenMappingIssues.push(`❌ XYD mapped to "Other": ${debitAccount}`);
          } else if (debitAccount.includes('XYD')) {
            successfulMappings.push(`✅ XYD correctly mapped: ${debitAccount}`);
          } else {
            tokenMappingIssues.push(`⚠️  XYD mapped to unexpected account: ${debitAccount}`);
          }
        }
      });
      
      // Summary of issues
      console.log('\n🔍 ISSUE ANALYSIS:');
      console.log('─'.repeat(50));
      
      if (gasFeeIssues.length > 0) {
        console.log('⛽ GAS FEE ISSUES:');
        gasFeeIssues.forEach(issue => console.log(`  ${issue}`));
      }
      
      if (tokenMappingIssues.length > 0) {
        console.log('🪙 TOKEN MAPPING ISSUES:');
        tokenMappingIssues.forEach(issue => console.log(`  ${issue}`));
      }
      
      if (successfulMappings.length > 0) {
        console.log('✅ SUCCESSFUL MAPPINGS:');
        successfulMappings.forEach(success => console.log(`  ${success}`));
      }
      
      if (gasFeeIssues.length === 0 && tokenMappingIssues.length === 0) {
        console.log('🎉 NO ISSUES DETECTED! All mappings look correct.');
      }
      
      // Overall assessment
      console.log('\n📊 OVERALL ASSESSMENT:');
      console.log('─'.repeat(50));
      const gasFeeFixed = gasFeeIssues.length === 0 && successfulMappings.some(m => m.includes('C2FLR'));
      const tokenMappingFixed = tokenMappingIssues.length === 0 && successfulMappings.some(m => m.includes('XYD'));
      
      console.log(`⛽ Gas Fee Currency:     ${gasFeeFixed ? '✅ FIXED (C2FLR)' : '❌ STILL BROKEN (ETH)'}`);
      console.log(`🪙 XYD Token Mapping:   ${tokenMappingFixed ? '✅ FIXED (Digital Assets - XYD)' : '❌ STILL BROKEN'}`);
      console.log(`💾 Database Saved:      ${response.alreadySaved ? '✅ YES' : '⚠️  NO'}`);
      
    } else {
      console.log('❌ No journal entries were created!');
      console.log('Response preview:', response.response?.substring(0, 300));
    }

    return {
      transactionData,
      hasJournalEntries: response.journalEntries && response.journalEntries.length > 0,
      journalEntries: response.journalEntries || [],
      alreadySaved: response.alreadySaved,
      response: response.response
    };

  } catch (error) {
    console.log(`❌ Test failed: ${error.message}`);
    console.log('Stack:', error.stack);
    return { error: error.message };
  }
}

// Run the test
if (require.main === module) {
  testGasFeeIssueFixed()
    .then(results => {
      console.log('\n🏁 Gas Fee Issue Test (Fixed) Completed');
      if (results.hasJournalEntries) {
        console.log('✅ Journal entries created and analysis completed!');
        if (results.alreadySaved) {
          console.log('💾 Entries were automatically saved to the database');
        }
      }
    })
    .catch(error => {
      console.error('💥 Test failed:', error.message);
    });
}

module.exports = testGasFeeIssueFixed; 