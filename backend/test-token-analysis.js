require('dotenv').config();
const BlockscoutClient = require('./src/services/blockscoutClient');

async function analyzeTransactionType(txHash) {
  console.log(`🔍 Analyzing transaction: ${txHash}\n`);
  
  try {
    // Get basic transaction info
    const txInfo = await BlockscoutClient.getTransactionInfo(txHash);
    console.log('📊 Basic Transaction Data:');
    console.log(JSON.stringify(txInfo, null, 2));
    
    // Check if this is a token transfer
    const isTokenTransfer = txInfo.value === '0' && txInfo.input && txInfo.input.length > 10;
    console.log(`\n🔍 Is Token Transfer: ${isTokenTransfer}`);
    
    if (isTokenTransfer) {
      console.log('\n🪙 Analyzing Token Transfer...');
      
      // Parse the input data for ERC-20 transfer
      const input = txInfo.input;
      console.log('Input data:', input);
      
      // ERC-20 transfer function signature: 0xa9059cbb
      if (input.startsWith('0xa9059cbb')) {
        console.log('✅ This is an ERC-20 transfer function call');
        
        // Parse the parameters
        const params = input.slice(10); // Remove function signature
        const toAddress = '0x' + params.slice(24, 64); // Extract 'to' address
        const amount = '0x' + params.slice(64, 128); // Extract amount
        
        console.log('Transfer details:');
        console.log('- To Address:', toAddress);
        console.log('- Amount (hex):', amount);
        console.log('- Amount (decimal):', parseInt(amount, 16));
        
        // Check if the 'to' address is a known token contract
        const knownTokens = {
          '0xdac17f958d2ee523a2206206994597c13d831ec7': 'USDT',
          '0xa0b86a33e6e6c44b9e6819787d7c0f1c1e1c1e1c': 'USDC',
          // Add more known token contracts
        };
        
        const tokenSymbol = knownTokens[txInfo.to.toLowerCase()] || 'Unknown Token';
        console.log('- Token Contract:', txInfo.to);
        console.log('- Token Symbol:', tokenSymbol);
        
        // For USDT, it has 6 decimals
        if (tokenSymbol === 'USDT') {
          const actualAmount = parseInt(amount, 16) / Math.pow(10, 6);
          console.log('- Actual USDT Amount:', actualAmount);
        }
      }
    } else if (parseFloat(txInfo.value) > 0) {
      console.log('\n💰 This is an ETH transfer');
      const ethAmount = parseFloat(txInfo.value) / Math.pow(10, 18);
      console.log('ETH Amount:', ethAmount);
    } else {
      console.log('\n❓ This appears to be a contract interaction with no value transfer');
    }
    
    // Check transaction status
    console.log(`\n📋 Transaction Status: ${txInfo.status}`);
    if (txInfo.status === 'failed') {
      console.log('⚠️  WARNING: This transaction failed - no actual transfer occurred');
      console.log('   Journal entries should reflect the failed state or gas costs only');
    }
    
  } catch (error) {
    console.error('❌ Error analyzing transaction:', error.message);
  }
}

async function testMultipleTransactions() {
  console.log('🧪 Testing Multiple Transaction Types\n');
  
  // Test the current transaction (USDT transfer)
  await analyzeTransactionType('0x5956713fe3dd60ee36de2e71dddf031ecd1e5538742f80dea2c6bd2da2c4d8bb');
  
  console.log('\n' + '='.repeat(80) + '\n');
  
  // You can add more test transactions here
  // await analyzeTransactionType('another_tx_hash');
}

testMultipleTransactions().catch(console.error); 