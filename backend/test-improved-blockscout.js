require('dotenv').config();
const BlockscoutClient = require('./src/services/blockscoutClient');

async function testImprovedBlockscout() {
  console.log('🔍 Testing Improved Blockscout Client\n');
  
  const txHash = '0x5956713fe3dd60ee36de2e71dddf031ecd1e5538742f80dea2c6bd2da2c4d8bb';
  
  try {
    console.log(`🧪 Testing transaction: ${txHash}`);
    const txInfo = await BlockscoutClient.getTransactionInfo(txHash);
    
    console.log('✅ Enhanced Transaction Data:');
    console.log(JSON.stringify(txInfo, null, 2));
    
    console.log('\n📊 Analysis:');
    console.log('- Transaction Type:', txInfo.type);
    console.log('- Status:', txInfo.status);
    console.log('- ETH Value:', txInfo.value);
    
    if (txInfo.tokenTransfer) {
      console.log('\n🪙 Token Transfer Details:');
      console.log('- Token:', txInfo.tokenTransfer.tokenSymbol);
      console.log('- Token Name:', txInfo.tokenTransfer.tokenName);
      console.log('- From:', txInfo.tokenTransfer.from);
      console.log('- To:', txInfo.tokenTransfer.to);
      console.log('- Raw Amount:', txInfo.tokenTransfer.value);
      console.log('- Actual Amount:', txInfo.tokenTransfer.actualAmount);
      console.log('- Decimals:', txInfo.tokenTransfer.tokenDecimal);
      console.log('- Contract:', txInfo.tokenTransfer.contractAddress);
      
      console.log('\n💰 For Journal Entry:');
      console.log(`- Amount: ${txInfo.tokenTransfer.actualAmount} ${txInfo.tokenTransfer.tokenSymbol}`);
      console.log(`- From: ${txInfo.tokenTransfer.from}`);
      console.log(`- To: ${txInfo.tokenTransfer.to}`);
      console.log(`- Status: ${txInfo.status}`);
    }
    
    console.log('\n🎯 Comparison with Website:');
    console.log('Website shows:');
    console.log('- Status: Success ✅');
    console.log('- Token: 1,000 USDT ✅');
    console.log('- From: 0xD4...7b87 ✅');
    console.log('- To: 0xc5...f5E0 ✅');
    
    console.log('\nOur API now shows:');
    console.log(`- Status: ${txInfo.status} ${txInfo.status === 'success' ? '✅' : '❌'}`);
    if (txInfo.tokenTransfer) {
      console.log(`- Token: ${txInfo.tokenTransfer.actualAmount} ${txInfo.tokenTransfer.tokenSymbol} ${txInfo.tokenTransfer.actualAmount === 1000 && txInfo.tokenTransfer.tokenSymbol === 'USDT' ? '✅' : '❌'}`);
      console.log(`- From: ${txInfo.tokenTransfer.from.slice(0, 6)}...${txInfo.tokenTransfer.from.slice(-4)} ${txInfo.tokenTransfer.from.toLowerCase() === '0xd423b4b575d2808459035294bf971a5834eb7b87' ? '✅' : '❌'}`);
      console.log(`- To: ${txInfo.tokenTransfer.to.slice(0, 6)}...${txInfo.tokenTransfer.to.slice(-4)} ${txInfo.tokenTransfer.to.toLowerCase() === '0xc58138528a2c88d58cf343dd2e1c2c25dbd1f5e0' ? '✅' : '❌'}`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testImprovedBlockscout().catch(console.error); 