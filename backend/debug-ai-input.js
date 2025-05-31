require('dotenv').config();
const blockscoutClient = require('./src/services/blockscoutClient');
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function debugAIInput() {
  console.log('🔍 Debugging AI Input for XYD Token Transfer...\n');

  try {
    const txHash = '0xedc0e7fff545af2931d80852d3d10331bb91f9c96b3e70047274fbaf51b06f91';
    const description = 'I receive some XYD token from our designer as a refund.';

    // Step 1: Get the raw transaction data
    console.log('📋 Step 1: Getting raw transaction data...');
    const txData = await blockscoutClient.getTransactionInfo(txHash);
    
    console.log('Raw transaction data:');
    console.log(JSON.stringify(txData, null, 2));

    // Step 2: Test the formatTokenTransfers method
    console.log('\n📋 Step 2: Testing formatTokenTransfers...');
    const GeminiClient = require('./src/services/aiClients/geminiClient');
    const geminiClient = new GeminiClient();
    
    const formattedTokenTransfers = geminiClient.formatTokenTransfers(txData.tokenTransfers || []);
    console.log('Formatted token transfers:');
    console.log(formattedTokenTransfers);

    // Step 3: Build the complete prompt that will be sent to AI
    console.log('\n📋 Step 3: Building complete AI prompt...');
    
    const ifrsTemplates = require('./src/services/aiClients/enhancedIfrsTemplates.json');
    const chartOfAccounts = await geminiClient.getFormattedChartOfAccounts();
    
    // Convert gas values to ETH for proper accounting
    const gasUsed = txData.gas_used || txData.gasUsed || 0;
    const gasPrice = txData.gas_price || txData.gasPrice || 0;
    const gasFeeWei = parseFloat(gasUsed) * parseFloat(gasPrice);
    const gasFeeETH = gasFeeWei / Math.pow(10, 18);
    const ethValue = parseFloat(txData.value || 0) / Math.pow(10, 18);

    const prompt = ifrsTemplates.transactionAnalysisPrompt
      .replace('{hash}', txData.hash)
      .replace('{from}', txData.from)
      .replace('{to}', txData.to)
      .replace('{value}', ethValue.toFixed(8))
      .replace('{gasUsed}', gasUsed.toString())
      .replace('{gasPrice}', (parseFloat(gasPrice) / Math.pow(10, 9)).toFixed(4) + ' Gwei')
      .replace('{timestamp}', txData.timestamp)
      .replace('{status}', txData.status)
      .replace('{description}', description)
      .replace('{tokenTransfers}', formattedTokenTransfers)
      .replace('{chartOfAccounts}', chartOfAccounts);

    console.log('Complete prompt being sent to AI:');
    console.log('='.repeat(80));
    console.log(prompt);
    console.log('='.repeat(80));

    // Step 4: Send to AI and get raw response
    console.log('\n📋 Step 4: Testing AI response...');
    
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    const result = await model.generateContent([
      { text: ifrsTemplates.systemPrompt },
      { text: prompt },
    ]);

    const response = await result.response;
    const responseText = response.text();

    console.log('Raw AI response:');
    console.log('='.repeat(80));
    console.log(responseText);
    console.log('='.repeat(80));

    // Step 5: Test manual parsing of the response
    console.log('\n📋 Step 5: Testing manual parsing...');
    
    // Check if we can find the token amount in the response
    const patterns = [
      /Amount:\s*(\d+(?:\.\d+)?)\s*\(USE THIS EXACT NUMBER\)/i,
      /TOKEN TRANSFER:\s*(\d+(?:\.\d+)?)\s*(XYD|USDC|ETH|BTC|USD|USDT|DAI|C2FLR|FLARE)/i,
      /(\d+(?:,\d{3})*(?:\.\d+)?)\s*(XYD|USDC|ETH|BTC|USD|USDT|DAI|C2FLR|FLARE)/i,
      /\"amount\":\s*(\d+(?:\.\d+)?)/i,
    ];

    console.log('Testing extraction patterns...');
    patterns.forEach((pattern, index) => {
      const match = responseText.match(pattern);
      console.log(`Pattern ${index + 1} (${pattern.source}):`, match ? `Found: ${match[1]} ${match[2] || ''}` : 'No match');
    });

    // Check what's causing NaN
    console.log('\nLooking for NaN in response...');
    if (responseText.includes('NaN')) {
      console.log('❌ Response contains NaN - this is the problem!');
      const nanContext = responseText.split('NaN');
      nanContext.forEach((part, index) => {
        if (index > 0) {
          console.log(`Context around NaN ${index}: ...${nanContext[index-1].slice(-50)}NaN${part.slice(0, 50)}...`);
        }
      });
    } else {
      console.log('✅ Response does not contain NaN');
    }

  } catch (error) {
    console.error('❌ Debug failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the debug
debugAIInput(); 