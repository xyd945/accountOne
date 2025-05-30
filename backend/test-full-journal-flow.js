require('dotenv').config();
const BlockscoutClient = require('./src/services/blockscoutClient');
const AIClientFactory = require('./src/services/aiClients');

async function testFullJournalFlow() {
  console.log('🔍 Testing Full Journal Entry Creation Flow\n');
  
  const txHash = '0x5956713fe3dd60ee36de2e71dddf031ecd1e5538742f80dea2c6bd2da2c4d8bb';
  const userDescription = "Payment that we paid to a company call Things Protocol BV for product development";
  
  try {
    // Step 1: Get transaction data from Blockscout
    console.log('📊 Step 1: Fetching transaction data from Blockscout...');
    const txInfo = await BlockscoutClient.getTransactionInfo(txHash);
    
    console.log('✅ Transaction Data Retrieved:');
    console.log(JSON.stringify(txInfo, null, 2));
    
    // Step 2: Analyze what should be recorded
    console.log('\n🔍 Step 2: Analyzing what should be recorded...');
    
    if (txInfo.type === 'token_transfer' && txInfo.tokenTransfer) {
      console.log('🪙 This is a TOKEN TRANSFER - Should record:');
      console.log(`   - Main Entry: ${txInfo.tokenTransfer.actualAmount} ${txInfo.tokenTransfer.tokenSymbol} payment`);
      console.log(`   - From: ${txInfo.tokenTransfer.from}`);
      console.log(`   - To: ${txInfo.tokenTransfer.to}`);
      console.log(`   - Purpose: ${userDescription}`);
      
      // Calculate gas cost
      const gasCostWei = BigInt(txInfo.gasUsed) * BigInt(txInfo.gasPrice);
      const gasCostEth = Number(gasCostWei) / Math.pow(10, 18);
      console.log(`   - Gas Cost: ${gasCostEth.toFixed(8)} ETH (secondary entry)`);
      
      console.log('\n💡 Expected Journal Entries:');
      console.log('   Entry 1 (Main): Product Development Expense / Cash (USDT)');
      console.log(`   - Debit: Product Development Expense - ${txInfo.tokenTransfer.actualAmount} USDT`);
      console.log(`   - Credit: Cash/Digital Assets (USDT) - ${txInfo.tokenTransfer.actualAmount} USDT`);
      console.log('   Entry 2 (Gas): Transaction Fee Expense / Cash (ETH)');
      console.log(`   - Debit: Transaction Fee Expense - ${gasCostEth.toFixed(8)} ETH`);
      console.log(`   - Credit: Cash/Digital Assets (ETH) - ${gasCostEth.toFixed(8)} ETH`);
    }
    
    // Step 3: Test current AI prompt
    console.log('\n🤖 Step 3: Testing current AI analysis...');
    
    try {
      const journalEntries = await AIClientFactory.analyzeTransaction(txInfo, userDescription);
      
      console.log('✅ AI Generated Journal Entries:');
      console.log(JSON.stringify(journalEntries, null, 2));
      
      // Step 4: Analyze what AI actually created
      console.log('\n📋 Step 4: Analyzing AI output...');
      
      let hasTokenEntry = false;
      let hasGasEntry = false;
      let tokenAmount = 0;
      let gasAmount = 0;
      
      journalEntries.forEach((entry, index) => {
        console.log(`\nEntry ${index + 1}:`);
        console.log(`- Debit: ${entry.accountDebit}`);
        console.log(`- Credit: ${entry.accountCredit}`);
        console.log(`- Amount: ${entry.amount} ${entry.currency}`);
        console.log(`- Narrative: ${entry.narrative}`);
        
        // Check if this entry is for token transfer or gas
        if (entry.currency === 'USDT' || entry.amount == 1000) {
          hasTokenEntry = true;
          tokenAmount = parseFloat(entry.amount);
        }
        
        if (entry.currency === 'ETH' && parseFloat(entry.amount) < 0.01) {
          hasGasEntry = true;
          gasAmount = parseFloat(entry.amount);
        }
      });
      
      console.log('\n🎯 Analysis Results:');
      console.log(`- Has Token Transfer Entry (1000 USDT): ${hasTokenEntry ? '✅' : '❌'}`);
      console.log(`- Has Gas Fee Entry (ETH): ${hasGasEntry ? '✅' : '❌'}`);
      console.log(`- Token Amount Recorded: ${tokenAmount} (Expected: 1000)`);
      console.log(`- Gas Amount Recorded: ${gasAmount} ETH`);
      
      if (!hasTokenEntry) {
        console.log('\n🚨 PROBLEM: AI is NOT recording the main token transfer!');
        console.log('   This means the actual business transaction (1000 USDT payment) is missing');
        console.log('   Only recording gas fees is insufficient for proper accounting');
      }
      
      if (hasTokenEntry && hasGasEntry) {
        console.log('\n✅ SUCCESS: AI recorded both token transfer and gas fees');
      }
      
    } catch (aiError) {
      console.error('❌ AI Analysis failed:', aiError.message);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

async function testAIPromptImprovement() {
  console.log('\n' + '='.repeat(80));
  console.log('🛠️  Testing Improved AI Prompt\n');
  
  const txHash = '0x5956713fe3dd60ee36de2e71dddf031ecd1e5538742f80dea2c6bd2da2c4d8bb';
  const userDescription = "Payment that we paid to a company call Things Protocol BV for product development";
  
  try {
    // Get transaction data
    const txInfo = await BlockscoutClient.getTransactionInfo(txHash);
    
    // Create improved prompt manually to test
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    
    const improvedPrompt = `You are an expert IFRS-compliant accountant. Analyze this cryptocurrency transaction and create appropriate journal entries.

TRANSACTION ANALYSIS:
- Transaction Hash: ${txInfo.hash}
- Status: ${txInfo.status}
- Type: ${txInfo.type}
- User Description: ${userDescription}

BLOCKCHAIN DATA:
- From Address: ${txInfo.from}
- To Address: ${txInfo.to}
- ETH Value: ${txInfo.value} (${parseFloat(txInfo.value) / Math.pow(10, 18)} ETH)
- Gas Used: ${txInfo.gasUsed}
- Gas Price: ${txInfo.gasPrice}

${txInfo.tokenTransfer ? `
TOKEN TRANSFER DETECTED:
- Token: ${txInfo.tokenTransfer.tokenSymbol} (${txInfo.tokenTransfer.tokenName})
- Amount: ${txInfo.tokenTransfer.actualAmount} ${txInfo.tokenTransfer.tokenSymbol}
- From: ${txInfo.tokenTransfer.from}
- To: ${txInfo.tokenTransfer.to}
- Contract: ${txInfo.tokenTransfer.contractAddress}

⚠️ IMPORTANT: This is primarily a TOKEN TRANSFER, not an ETH transfer!
The main business transaction is the ${txInfo.tokenTransfer.actualAmount} ${txInfo.tokenTransfer.tokenSymbol} payment.
` : ''}

INSTRUCTIONS:
1. If this is a token transfer, create journal entries for the TOKEN AMOUNT, not just gas fees
2. For outgoing payments (like this one), typically:
   - Debit: Expense account (based on description)
   - Credit: Digital Asset account for the token
3. Also create a separate entry for gas fees if significant
4. Use appropriate IFRS account names
5. Ensure amounts match the actual transaction values

Please provide a JSON array with journal entries:
[
  {
    "accountDebit": "Account Name",
    "accountCredit": "Account Name",
    "amount": "numeric_value",
    "currency": "TOKEN_SYMBOL_OR_ETH",
    "narrative": "Description",
    "confidence": 0.95
  }
]`;

    console.log('🧪 Testing improved prompt...');
    console.log('Prompt length:', improvedPrompt.length);
    
    const result = await model.generateContent(improvedPrompt);
    const response = await result.response;
    const text = response.text();
    
    console.log('✅ Improved AI Response:');
    console.log(text);
    
    // Try to parse JSON
    try {
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const journalEntries = JSON.parse(jsonMatch[0]);
        console.log('\n📊 Parsed Journal Entries:');
        console.log(JSON.stringify(journalEntries, null, 2));
        
        // Analyze improved results
        let hasTokenEntry = false;
        let hasGasEntry = false;
        
        journalEntries.forEach(entry => {
          if (entry.currency === 'USDT' || entry.amount == 1000) {
            hasTokenEntry = true;
          }
          if (entry.currency === 'ETH') {
            hasGasEntry = true;
          }
        });
        
        console.log('\n🎯 Improved Results:');
        console.log(`- Records Token Transfer: ${hasTokenEntry ? '✅' : '❌'}`);
        console.log(`- Records Gas Fees: ${hasGasEntry ? '✅' : '❌'}`);
        
      }
    } catch (parseError) {
      console.log('❌ Failed to parse improved response');
    }
    
  } catch (error) {
    console.error('❌ Improved prompt test failed:', error.message);
  }
}

async function main() {
  await testFullJournalFlow();
  await testAIPromptImprovement();
}

main().catch(console.error); 