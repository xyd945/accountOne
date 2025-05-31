require('dotenv').config();

// Set environment variables for FTSO testing
process.env.FTSO_PRICE_CONSUMER_ENABLED = 'true';
process.env.FTSO_PRICE_CONSUMER_ADDRESS = '0xed1692dd816996B8D7EB39e21344B3ed9Fda2d11';
process.env.FLARE_RPC_URL = 'https://coston2-api.flare.network/ext/C/rpc';
process.env.FLARE_CHAIN_ID = '114';
process.env.PRICE_FEED_CACHE_TTL = '60000';

const GeminiClient = require('./src/services/aiClients/geminiClient');
const BlockscoutClient = require('./src/services/blockscoutClient');

const TEST_USER_ID = '53f5afe6-cb6a-4436-8a3a-45e57a6db798';
const TEST_TRANSACTION_HASH = '0x7c987ea9dfb3149cef6ab84427bfce4bf85a1376dcd9353b3f90d213c2cedd85'; // XYD token transfer

async function testGasFeeIssue() {
  console.log('⛽ TEST: Gas Fee Currency Issue (C2FLR vs ETH)');
  console.log('==============================================\n');
  
  console.log(`🧪 Testing with Coston2 transaction: ${TEST_TRANSACTION_HASH}`);
  console.log('Expected: Gas fees should be in C2FLR, NOT ETH');
  console.log('Expected: 1000 XYD should map to "Digital Assets - XYD" or similar');
  console.log('─'.repeat(80));

  try {
    // Step 1: Fetch real blockchain transaction data
    console.log('📡 Step 1: Fetching real transaction data from Coston2...');
    
    const transactionData = await BlockscoutClient.getTransactionInfo(TEST_TRANSACTION_HASH);
    
    console.log('✅ Transaction data retrieved:');
    console.log(`  Hash: ${transactionData.hash}`);
    console.log(`  From: ${transactionData.from}`);
    console.log(`  To: ${transactionData.to}`);
    console.log(`  Value: ${transactionData.value} (Wei)`);
    console.log(`  Status: ${transactionData.status}`);
    console.log(`  Gas Used: ${transactionData.gas_used || transactionData.gasUsed}`);
    console.log(`  Gas Price: ${transactionData.gas_price || transactionData.gasPrice}`);
    console.log(`  Block Number: ${transactionData.block_number || transactionData.blockNumber}`);
    console.log(`  Timestamp: ${transactionData.timestamp}`);
    
    // Check token transfers
    if (transactionData.tokenTransfers && transactionData.tokenTransfers.length > 0) {
      console.log('\n🪙 Token Transfers:');
      transactionData.tokenTransfers.forEach((transfer, index) => {
        console.log(`  Transfer ${index + 1}:`);
        console.log(`    Token: ${transfer.token?.symbol || 'Unknown'} (${transfer.token?.name || 'Unknown'})`);
        console.log(`    From: ${transfer.from?.hash || transfer.from}`);
        console.log(`    To: ${transfer.to?.hash || transfer.to}`);
        console.log(`    Amount: ${transfer.total?.value || transfer.value} (raw)`);
        console.log(`    Decimals: ${transfer.token?.decimals || 18}`);
        
        if (transfer.total?.value && transfer.token?.decimals) {
          const amount = parseFloat(transfer.total.value) / Math.pow(10, parseInt(transfer.token.decimals));
          console.log(`    Converted Amount: ${amount} ${transfer.token.symbol}`);
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
    
    if (response.journalEntries && response.journalEntries.length > 0) {
      console.log('\n📊 Journal Entries Analysis:');
      
      let gasFeeIssues = [];
      let tokenMappingIssues = [];
      let successfulMappings = [];
      
      response.journalEntries.forEach((entry, index) => {
        console.log(`\nEntry ${index + 1}:`);
        console.log(`  Debit:     ${entry.accountDebit}`);
        console.log(`  Credit:    ${entry.accountCredit}`);
        console.log(`  Amount:    ${entry.amount}`);
        console.log(`  Currency:  ${entry.currency}`);
        console.log(`  Narrative: ${entry.narrative}`);
        
        // Check for gas fee issues
        const isGasFee = entry.narrative?.toLowerCase().includes('gas') || 
                        entry.narrative?.toLowerCase().includes('fee') ||
                        entry.accountDebit?.toLowerCase().includes('fee');
        
        if (isGasFee) {
          if (entry.currency === 'ETH') {
            gasFeeIssues.push(`❌ Gas fee in ETH instead of C2FLR: ${entry.amount} ${entry.currency}`);
          } else if (entry.currency === 'C2FLR' || entry.currency === 'FLR') {
            successfulMappings.push(`✅ Gas fee correctly in C2FLR: ${entry.amount} ${entry.currency}`);
          }
        }
        
        // Check for XYD token mapping
        if (entry.currency === 'XYD') {
          if (entry.accountDebit.includes('Other')) {
            tokenMappingIssues.push(`❌ XYD mapped to "Other": ${entry.accountDebit}`);
          } else if (entry.accountDebit.includes('XYD')) {
            successfulMappings.push(`✅ XYD correctly mapped: ${entry.accountDebit}`);
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
      
    } else {
      console.log('❌ No journal entries were created!');
      console.log('Response preview:', response.response?.substring(0, 300));
    }

    console.log('\n📝 Full AI Response:');
    console.log('─'.repeat(80));
    console.log(response.response);
    console.log('─'.repeat(80));

    return {
      transactionData,
      hasJournalEntries: response.journalEntries && response.journalEntries.length > 0,
      journalEntries: response.journalEntries || [],
      gasFeeIssues: gasFeeIssues || [],
      tokenMappingIssues: tokenMappingIssues || [],
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
  testGasFeeIssue()
    .then(results => {
      console.log('\n🏁 Gas Fee Issue Test Completed');
      if (results.gasFeeIssues && results.gasFeeIssues.length > 0) {
        console.log('❌ Gas fee issues detected - needs fixing');
      } else if (results.hasJournalEntries) {
        console.log('✅ No gas fee issues detected!');
      }
    })
    .catch(error => {
      console.error('💥 Test failed:', error.message);
    });
}

module.exports = testGasFeeIssue; 