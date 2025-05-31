require('dotenv').config();

const GeminiClient = require('./src/services/aiClients/geminiClient');

async function testFixGasAccountMapping() {
  console.log('🔧 TESTING AND FIXING GAS ACCOUNT MAPPING ISSUES');
  console.log('===============================================\n');

  const TEST_USER_ID = '53f5afe6-cb6a-4436-8a3a-45e57a6db798';
  
  // Test cases that are currently broken based on the screenshot
  const testCases = [
    {
      name: "ETH with transaction ID",
      message: "Analyze transaction 0x4fe7096f9232c2f1b69736dc6a5de6d247ca23514f9337e9abd45c3ab5f9e126 - received 100 XYD tokens",
      shouldHaveGasFees: true,
      expectedGasCurrency: "C2FLR",
      expectedGasAccount: "Digital Assets - C2FLR"
    },
    {
      name: "ETH without transaction ID",
      message: "The company received 2.5 ETH as payment for consulting services on Feb 15, 2025",
      shouldHaveGasFees: false, // No transaction ID = no gas fees
      expectedGasCurrency: null,
      expectedGasAccount: null
    },
    {
      name: "XYD token manual entry",
      message: "I received 1000 XYD tokens from the project team on March 10, 2025",
      shouldHaveGasFees: false, // No transaction ID = no gas fees  
      expectedGasCurrency: null,
      expectedGasAccount: null
    }
  ];

  const gemini = new GeminiClient();
  
  for (const [index, testCase] of testCases.entries()) {
    console.log(`📊 TEST ${index + 1}: ${testCase.name}`);
    console.log('─'.repeat(50));
    console.log(`Input: "${testCase.message}"`);
    console.log(`Expected gas fees: ${testCase.shouldHaveGasFees ? 'YES' : 'NO'}`);
    
    if (testCase.shouldHaveGasFees) {
      console.log(`Expected gas currency: ${testCase.expectedGasCurrency}`);
      console.log(`Expected gas account: ${testCase.expectedGasAccount}`);
    }
    
    try {
      const response = await gemini.chatResponse(
        testCase.message,
        { user: { id: TEST_USER_ID, email: 'test@example.com' } }
      );

      console.log(`\n✅ Response generated: ${response.response ? 'YES' : 'NO'}`);
      console.log(`✅ Journal entries created: ${response.journalEntries?.length || 0}`);
      
      if (response.journalEntries && response.journalEntries.length > 0) {
        console.log('\n📋 Journal Entries Analysis:');
        
        let gasEntries = [];
        let tokenEntries = [];
        let ethEntries = [];
        let issues = [];
        
        response.journalEntries.forEach((entry, i) => {
          console.log(`\nEntry ${i + 1}:`);
          console.log(`  Debit:     ${entry.accountDebit}`);
          console.log(`  Credit:    ${entry.accountCredit}`);
          console.log(`  Amount:    ${entry.amount}`);
          console.log(`  Currency:  ${entry.currency}`);
          console.log(`  Narrative: ${entry.narrative}`);
          
          // Categorize entries
          const isGasEntry = (
            entry.narrative?.toLowerCase().includes('gas') ||
            entry.narrative?.toLowerCase().includes('fee') ||
            entry.accountDebit?.toLowerCase().includes('fee') ||
            entry.currency === 'GAS'  // This is the problem!
          );
          
          if (isGasEntry) {
            gasEntries.push(entry);
            
            // Check for issues
            if (entry.currency === 'GAS') {
              issues.push(`❌ Invalid "GAS" currency in entry ${i + 1}`);
            }
            if (entry.accountCredit?.includes('Bank Account')) {
              issues.push(`❌ Gas fee using Bank Account instead of Digital Assets`);
            }
            if (!testCase.shouldHaveGasFees) {
              issues.push(`❌ Gas fee entry created when none should exist (no transaction ID)`);
            }
          } else if (entry.currency === 'ETH') {
            ethEntries.push(entry);
          } else if (entry.currency === 'XYD') {
            tokenEntries.push(entry);
          }
        });
        
        console.log('\n🔍 ANALYSIS RESULTS:');
        console.log(`Gas entries found: ${gasEntries.length}`);
        console.log(`ETH entries found: ${ethEntries.length}`);
        console.log(`Token entries found: ${tokenEntries.length}`);
        
        if (issues.length > 0) {
          console.log('\n❌ ISSUES FOUND:');
          issues.forEach(issue => console.log(`  ${issue}`));
        }
        
        // Check compliance with expectations
        const hasGasEntries = gasEntries.length > 0;
        const gasComplianceCorrect = hasGasEntries === testCase.shouldHaveGasFees;
        
        console.log(`\n🎯 COMPLIANCE CHECK:`);
        console.log(`Should have gas fees: ${testCase.shouldHaveGasFees}`);
        console.log(`Actually has gas fees: ${hasGasEntries}`);
        console.log(`Compliance correct: ${gasComplianceCorrect ? '✅' : '❌'}`);
        
        if (gasEntries.length > 0) {
          const gasEntry = gasEntries[0];
          console.log(`Gas currency used: ${gasEntry.currency}`);
          console.log(`Gas credit account: ${gasEntry.accountCredit}`);
        }
        
      } else {
        console.log('❌ No journal entries created');
      }
      
    } catch (error) {
      console.log(`❌ Test failed: ${error.message}`);
    }
    
    console.log('\n' + '='.repeat(80) + '\n');
  }
  
  console.log('📋 SUMMARY OF ISSUES TO FIX:');
  console.log('1. Remove "GAS" currency - use proper currencies (C2FLR, ETH)');
  console.log('2. Gas fees should credit "Digital Assets - C2FLR", not "Bank Account"');
  console.log('3. No gas fees for transactions without transaction IDs');
  console.log('4. Only create gas fee entries when we have actual blockchain data');
}

// Run the test
if (require.main === module) {
  testFixGasAccountMapping()
    .then(() => {
      console.log('\n🏁 Gas Account Mapping Test Completed');
    })
    .catch(error => {
      console.error('💥 Test failed:', error.message);
    });
}

module.exports = testFixGasAccountMapping; 