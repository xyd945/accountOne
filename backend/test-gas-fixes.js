require('dotenv').config();

const GeminiClient = require('./src/services/aiClients/geminiClient');

async function testGasFixes() {
  console.log('🔧 TESTING GAS FEE FIXES FOR BULK ANALYSIS');
  console.log('==========================================\n');

  const TEST_USER_ID = '53f5afe6-cb6a-4436-8a3a-45e57a6db798';
  const TEST_WALLET = '0x862847B44845eD331dc8FA211Df3C01eCBB1b38C';
  
  console.log('Environment Check:');
  console.log(`BLOCKSCOUT_BASE_URL: ${process.env.BLOCKSCOUT_BASE_URL}`);
  console.log(`FLARE_CHAIN_ID: ${process.env.FLARE_CHAIN_ID}`);
  
  const isCoston2 = process.env.BLOCKSCOUT_BASE_URL?.includes('coston2') || 
                    process.env.FLARE_CHAIN_ID === '114';
  console.log(`Network detected: ${isCoston2 ? 'Coston2' : 'Ethereum'}`);
  console.log(`Expected gas currency: ${isCoston2 ? 'C2FLR' : 'ETH'}`);
  console.log(`Expected gas account: ${isCoston2 ? 'Digital Assets - C2FLR' : 'Digital Assets - Ethereum'}\n`);

  try {
    console.log('🔍 Starting bulk wallet analysis...');
    
    const gemini = new GeminiClient();
    const response = await gemini.chatResponse(
      `Analyze wallet ${TEST_WALLET} transactions and create journal entries`,
      { user: { id: TEST_USER_ID, email: 'test@example.com' } }
    );

    console.log('✅ Bulk analysis completed');
    console.log(`✅ Journal entries created: ${response.journalEntries?.length || 0}`);
    
    if (response.journalEntries && response.journalEntries.length > 0) {
      console.log('\n📊 ANALYZING GENERATED ENTRIES FOR ISSUES:');
      console.log('─'.repeat(60));
      
      let gasCurrencyIssues = [];
      let gasAccountIssues = [];
      let weiAmountIssues = [];
      let correctEntries = [];
      
      response.journalEntries.forEach((entry, index) => {
        console.log(`\nEntry ${index + 1}:`);
        console.log(`  Debit:     ${entry.accountDebit}`);
        console.log(`  Credit:    ${entry.accountCredit}`);
        console.log(`  Amount:    ${entry.amount}`);
        console.log(`  Currency:  ${entry.currency}`);
        console.log(`  Narrative: ${entry.narrative?.substring(0, 50)}...`);
        
        // Check for gas-related entries
        const isGasEntry = (
          entry.narrative?.toLowerCase().includes('gas') ||
          entry.narrative?.toLowerCase().includes('fee') ||
          entry.accountDebit?.toLowerCase().includes('fee')
        );
        
        if (isGasEntry) {
          console.log(`  → GAS ENTRY DETECTED`);
          
          // Check currency issues
          if (entry.currency === 'GAS') {
            gasCurrencyIssues.push(`Entry ${index + 1}: Uses "GAS" currency`);
          } else if (isCoston2 && entry.currency === 'ETH') {
            gasCurrencyIssues.push(`Entry ${index + 1}: Uses ETH on Coston2 (should be C2FLR)`);
          } else if (!isCoston2 && entry.currency === 'C2FLR') {
            gasCurrencyIssues.push(`Entry ${index + 1}: Uses C2FLR on Ethereum (should be ETH)`);
          } else {
            correctEntries.push(`Entry ${index + 1}: Correct gas currency (${entry.currency})`);
          }
          
          // Check account issues
          if (entry.accountCredit?.includes('Bank Account')) {
            gasAccountIssues.push(`Entry ${index + 1}: Uses Bank Account for gas (should be Digital Assets)`);
          } else if (entry.accountCredit?.includes('Digital Assets')) {
            correctEntries.push(`Entry ${index + 1}: Correct gas account (${entry.accountCredit})`);
          }
        }
        
        // Check for Wei amounts (large numbers)
        if (entry.amount > 100000) {
          weiAmountIssues.push(`Entry ${index + 1}: Large amount ${entry.amount} (possible Wei error)`);
        }
      });
      
      console.log('\n🎯 ISSUE ANALYSIS:');
      console.log('─'.repeat(40));
      
      if (gasCurrencyIssues.length === 0) {
        console.log('✅ Gas currency issues: FIXED');
      } else {
        console.log('❌ Gas currency issues found:');
        gasCurrencyIssues.forEach(issue => console.log(`  ${issue}`));
      }
      
      if (gasAccountIssues.length === 0) {
        console.log('✅ Gas account mapping: FIXED');
      } else {
        console.log('❌ Gas account mapping issues found:');
        gasAccountIssues.forEach(issue => console.log(`  ${issue}`));
      }
      
      if (weiAmountIssues.length === 0) {
        console.log('✅ Wei conversion errors: FIXED');
      } else {
        console.log('❌ Wei conversion issues found:');
        weiAmountIssues.forEach(issue => console.log(`  ${issue}`));
      }
      
      if (correctEntries.length > 0) {
        console.log('\n✅ CORRECTLY PROCESSED:');
        correctEntries.forEach(item => console.log(`  ${item}`));
      }
      
      const totalIssues = gasCurrencyIssues.length + gasAccountIssues.length + weiAmountIssues.length;
      const allFixed = totalIssues === 0;
      
      console.log(`\n🏁 FINAL RESULT: ${allFixed ? '✅ ALL ISSUES FIXED' : '❌ ISSUES REMAIN'}`);
      console.log(`Total issues: ${totalIssues}`);
      console.log(`Correct entries: ${correctEntries.length}`);
      
      return {
        success: allFixed,
        totalEntries: response.journalEntries.length,
        issues: {
          gasCurrency: gasCurrencyIssues.length,
          gasAccount: gasAccountIssues.length, 
          weiAmounts: weiAmountIssues.length
        },
        correctEntries: correctEntries.length
      };
      
    } else {
      console.log('❌ No journal entries were created');
      return { success: false, error: 'No entries created' };
    }

  } catch (error) {
    console.log(`❌ Test failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Run the test
if (require.main === module) {
  testGasFixes()
    .then(results => {
      console.log('\n📋 Test Results:', JSON.stringify(results, null, 2));
      
      if (results.success) {
        console.log('\n🎉 SUCCESS! All gas fee issues have been resolved!');
        console.log('✅ Currency correctly set to C2FLR/ETH based on network');
        console.log('✅ Gas fees correctly mapped to Digital Assets accounts');
        console.log('✅ Wei conversion errors fixed');
      } else {
        console.log('\n⚠️ Some issues still need to be addressed');
      }
    })
    .catch(error => {
      console.error('💥 Test failed:', error.message);
    });
}

module.exports = testGasFixes; 