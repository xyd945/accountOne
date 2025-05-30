require('dotenv').config();
const axios = require('axios');

async function testBlockscoutEndpoints() {
  const txHash = '0x5956713fe3dd60ee36de2e71dddf031ecd1e5538742f80dea2c6bd2da2c4d8bb';
  const baseURL = 'https://eth.blockscout.com';
  
  console.log('🔍 Testing Different Blockscout API Endpoints\n');
  console.log(`Transaction: ${txHash}\n`);
  
  // Test 1: Current endpoint (gettxinfo)
  console.log('1️⃣ Testing current endpoint: module=transaction&action=gettxinfo');
  try {
    const response1 = await axios.get(`${baseURL}/api`, {
      params: {
        module: 'transaction',
        action: 'gettxinfo',
        txhash: txHash,
      },
    });
    console.log('✅ Response status:', response1.data.status);
    console.log('📊 Data:', JSON.stringify(response1.data.result, null, 2));
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
  
  console.log('\n' + '='.repeat(80) + '\n');
  
  // Test 2: Try gettxreceiptstatus
  console.log('2️⃣ Testing: module=transaction&action=gettxreceiptstatus');
  try {
    const response2 = await axios.get(`${baseURL}/api`, {
      params: {
        module: 'transaction',
        action: 'gettxreceiptstatus',
        txhash: txHash,
      },
    });
    console.log('✅ Response status:', response2.data.status);
    console.log('📊 Data:', JSON.stringify(response2.data.result, null, 2));
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
  
  console.log('\n' + '='.repeat(80) + '\n');
  
  // Test 3: Try proxy endpoint (eth_getTransactionByHash)
  console.log('3️⃣ Testing: module=proxy&action=eth_getTransactionByHash');
  try {
    const response3 = await axios.get(`${baseURL}/api`, {
      params: {
        module: 'proxy',
        action: 'eth_getTransactionByHash',
        txhash: txHash,
      },
    });
    console.log('✅ Response status:', response3.data.result ? 'found' : 'not found');
    console.log('📊 Data:', JSON.stringify(response3.data.result, null, 2));
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
  
  console.log('\n' + '='.repeat(80) + '\n');
  
  // Test 4: Try getting transaction receipt
  console.log('4️⃣ Testing: module=proxy&action=eth_getTransactionReceipt');
  try {
    const response4 = await axios.get(`${baseURL}/api`, {
      params: {
        module: 'proxy',
        action: 'eth_getTransactionReceipt',
        txhash: txHash,
      },
    });
    console.log('✅ Response status:', response4.data.result ? 'found' : 'not found');
    console.log('📊 Data:', JSON.stringify(response4.data.result, null, 2));
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
  
  console.log('\n' + '='.repeat(80) + '\n');
  
  // Test 5: Try to get token transfers for this specific transaction
  console.log('5️⃣ Testing token transfers for the sender address');
  try {
    const senderAddress = '0xd423b4b575d2808459035294bf971a5834eb7b87';
    const response5 = await axios.get(`${baseURL}/api`, {
      params: {
        module: 'account',
        action: 'tokentx',
        address: senderAddress,
        startblock: 22466772, // Block number from the transaction
        endblock: 22466772,
        sort: 'desc',
      },
    });
    console.log('✅ Response status:', response5.data.status);
    console.log('📊 Token transfers found:', response5.data.result?.length || 0);
    if (response5.data.result?.length > 0) {
      // Find our specific transaction
      const ourTx = response5.data.result.find(tx => tx.hash.toLowerCase() === txHash.toLowerCase());
      if (ourTx) {
        console.log('🎯 Found our transaction in token transfers:');
        console.log(JSON.stringify(ourTx, null, 2));
      }
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

testBlockscoutEndpoints().catch(console.error); 