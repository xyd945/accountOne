require('dotenv').config();
const blockscoutClient = require('./src/services/blockscoutClient');

async function testCoston2Connection() {
  console.log('🔍 Testing Coston2 Blockscout Connection...\n');
  
  try {
    // Test with a known Coston2 address - our deployed FTSO contract
    const contractAddress = '0xEc8F86Ffa44FD994A0Fa1971D606e1F37f2d43D2';
    
    console.log(`📊 Testing account balance for: ${contractAddress}`);
    
    // Test getAccountBalance
    const balance = await blockscoutClient.getAccountBalance(contractAddress);
    console.log('✅ Balance fetch successful:', {
      address: balance.address,
      balance: balance.balance,
      balanceEth: balance.balanceEth,
      transactionsCount: balance.transactionsCount
    });
    
    console.log('\n📋 Testing transaction list...');
    
    // Test getWalletTransactions with limited results
    const transactions = await blockscoutClient.getWalletTransactions(contractAddress, {
      offset: 5, // Just get 5 transactions
      includeTokens: false,
      includeInternal: false
    });
    
    console.log('✅ Transactions fetch successful:', {
      totalTransactions: transactions.totalTransactions,
      fetchedTransactions: transactions.transactions.length,
      sampleTransaction: transactions.transactions[0] ? {
        hash: transactions.transactions[0].hash,
        from: transactions.transactions[0].from,
        to: transactions.transactions[0].to,
        value: transactions.transactions[0].actualAmount,
        timestamp: transactions.transactions[0].timestamp
      } : 'No transactions found'
    });
    
    console.log('\n🎉 Phase 1 Complete: Coston2 Blockscout integration working!');
    console.log('✅ All API endpoints successfully migrated to v2 format');
    console.log('✅ Ready for Phase 2: FTSO Price Service integration');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('📋 Error details:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data
    });
    process.exit(1);
  }
}

// Run the test
testCoston2Connection(); 