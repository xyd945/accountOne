require('dotenv').config();
const axios = require('axios');

async function debugCoston2API() {
  console.log('🔍 DEBUGGING COSTON2 BLOCKSCOUT API');
  console.log('===================================\n');

  const baseURL = 'https://coston2-explorer.flare.network';
  const wallet = '0x862847B44845eD331dc8FA211Df3C01eCBB1b38C';
  
  console.log(`Base URL: ${baseURL}`);
  console.log(`Wallet: ${wallet}\n`);

  // Test 1: Get recent transactions
  console.log('📡 Test 1: Get recent transactions...');
  try {
    const txResponse = await axios.get(`${baseURL}/api/v2/addresses/${wallet}/transactions`, {
      params: { limit: 5 }
    });
    
    console.log(`✅ Found ${txResponse.data.items?.length || 0} transactions`);
    if (txResponse.data.items) {
      txResponse.data.items.forEach((tx, i) => {
        console.log(`  ${i+1}. Hash: ${tx.hash}`);
        console.log(`     Value: ${tx.value} Wei`);
        console.log(`     Gas: ${tx.gas_used} * ${tx.gas_price} = ${parseFloat(tx.gas_used) * parseFloat(tx.gas_price)} Wei`);
        console.log(`     Status: ${tx.status}`);
        console.log(`     Method: ${tx.method || 'transfer'}`);
      });
    }
  } catch (error) {
    console.log(`❌ Transaction fetch failed: ${error.message}`);
    if (error.response) {
      console.log(`Response status: ${error.response.status}`);
      console.log(`Response data:`, error.response.data);
    }
  }

  // Test 2: Get token transfers
  console.log('\n🪙 Test 2: Get token transfers...');
  try {
    const tokenResponse = await axios.get(`${baseURL}/api/v2/addresses/${wallet}/token-transfers`, {
      params: { limit: 5 }
    });
    
    console.log(`✅ Found ${tokenResponse.data.items?.length || 0} token transfers`);
    if (tokenResponse.data.items) {
      tokenResponse.data.items.forEach((transfer, i) => {
        console.log(`  ${i+1}. Hash: ${transfer.tx_hash}`);
        console.log(`     Token: ${transfer.token?.symbol} (${transfer.token?.name})`);
        console.log(`     Amount: ${transfer.total?.value} (${transfer.total?.decimals} decimals)`);
        console.log(`     From: ${transfer.from?.hash}`);
        console.log(`     To: ${transfer.to?.hash}`);
      });
    }
  } catch (error) {
    console.log(`❌ Token transfer fetch failed: ${error.message}`);
    if (error.response) {
      console.log(`Response status: ${error.response.status}`);
      console.log(`Response data:`, error.response.data);
    }
  }

  // Test 3: Try to get specific transaction with hash from screenshot
  console.log('\n🎯 Test 3: Get specific transaction...');
  const testHash = '0x4fe7096f9232c2f1b69736dc6a5de6d247ca23514f9337e9abd45c3ab5f9e126';
  try {
    const specificTxResponse = await axios.get(`${baseURL}/api/v2/transactions/${testHash}`);
    
    console.log('✅ Transaction found!');
    console.log('Raw transaction data:');
    console.log(JSON.stringify(specificTxResponse.data, null, 2));
    
  } catch (error) {
    console.log(`❌ Specific transaction fetch failed: ${error.message}`);
    if (error.response?.status === 404) {
      console.log('Transaction not found - it might be on a different network or the hash might be incorrect');
    }
  }
}

debugCoston2API().catch(console.error); 