require('dotenv').config();
const BlockscoutClient = require('./src/services/blockscoutClient');

async function testBlockscoutDetailed() {
  console.log('🔍 Testing Blockscout API - Detailed Analysis...\n');
  
  // Test with a known valid Ethereum transaction
  const validTxHash = '0x5956713fe3dd60ee36de2e71dddf031ecd1e5538742f80dea2c6bd2da2c4d8bb';
  
  try {
    console.log(`🧪 Testing valid transaction: ${validTxHash}`);
    const txInfo = await BlockscoutClient.getTransactionInfo(validTxHash);
    
    console.log('✅ Transaction found! Full data structure:');
    console.log(JSON.stringify(txInfo, null, 2));
    
    console.log('\n📊 Key fields for journal entry creation:');
    console.log('- Hash:', txInfo.hash);
    console.log('- From:', txInfo.from);
    console.log('- To:', txInfo.to);
    console.log('- Value (Wei):', txInfo.value);
    console.log('- Value (ETH):', parseFloat(txInfo.value) / Math.pow(10, 18));
    console.log('- Status:', txInfo.status);
    console.log('- Timestamp:', txInfo.timestamp);
    console.log('- Gas Used:', txInfo.gasUsed);
    console.log('- Gas Price:', txInfo.gasPrice);
    
    return txInfo;
    
  } catch (error) {
    console.log('❌ Transaction lookup failed:');
    console.log('Error:', error.message);
    
    if (error.response) {
      console.log('Response status:', error.response.status);
      console.log('Response data:', JSON.stringify(error.response.data, null, 2));
    }
    return null;
  }
}

async function testGeminiWithTransactionData() {
  console.log('\n🤖 Testing Gemini with Transaction Data...\n');
  
  if (!process.env.GOOGLE_GEMINI_API_KEY) {
    console.log('❌ GOOGLE_GEMINI_API_KEY not set');
    return;
  }
  
  try {
    // First get transaction data
    const validTxHash = '0x5956713fe3dd60ee36de2e71dddf031ecd1e5538742f80dea2c6bd2da2c4d8bb';
    const txInfo = await BlockscoutClient.getTransactionInfo(validTxHash);
    
    if (!txInfo) {
      console.log('❌ Cannot test Gemini without transaction data');
      return;
    }
    
    // Test Gemini with this data
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    
    const prompt = `Create an IFRS-compliant journal entry for this cryptocurrency transaction:

Transaction Hash: ${txInfo.hash}
From: ${txInfo.from}
To: ${txInfo.to}
Value: ${txInfo.value} Wei (${parseFloat(txInfo.value) / Math.pow(10, 18)} ETH)
Status: ${txInfo.status}
Timestamp: ${txInfo.timestamp}
Description: Payment received for services

Please provide a JSON array with journal entries:
[
  {
    "accountDebit": "Account Name",
    "accountCredit": "Account Name", 
    "amount": "numeric_value",
    "currency": "ETH",
    "narrative": "Description",
    "confidence": 0.95
  }
]`;
    
    console.log('🧪 Testing Gemini with transaction data...');
    console.log('Prompt being sent:');
    console.log('---');
    console.log(prompt);
    console.log('---\n');
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    console.log('✅ Gemini response:');
    console.log(text);
    
    // Try to parse the JSON response
    console.log('\n🔍 Attempting to parse JSON from response...');
    try {
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const journalEntries = JSON.parse(jsonMatch[0]);
        console.log('✅ Successfully parsed journal entries:');
        console.log(JSON.stringify(journalEntries, null, 2));
      } else {
        console.log('❌ No JSON array found in response');
      }
    } catch (parseError) {
      console.log('❌ Failed to parse JSON:', parseError.message);
    }
    
  } catch (error) {
    console.log('❌ Gemini with transaction data failed:');
    console.log('Error:', error.message);
  }
}

async function main() {
  await testBlockscoutDetailed();
  await testGeminiWithTransactionData();
  
  console.log('\n📋 Next Steps:');
  console.log('1. Check if transaction data structure matches expectations');
  console.log('2. Verify Gemini can parse transaction data and create journal entries');
  console.log('3. Test the full flow from chat message to database save');
}

main().catch(console.error); 