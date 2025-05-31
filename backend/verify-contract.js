require('dotenv').config();

const { ethers } = require('ethers');

async function verifyFTSOContract() {
  console.log('🔍 Verifying FTSO Contract Deployment');
  console.log('='.repeat(50));
  
  const contractAddress = '0xed1692dd816996B8D7EB39e21344B3ed9Fda2d11';
  const rpcUrl = 'https://coston2-api.flare.network/ext/C/rpc';
  
  console.log(`📍 Contract Address: ${contractAddress}`);
  console.log(`🌐 Network: Coston2 Testnet`);
  console.log(`🔗 RPC URL: ${rpcUrl}`);
  
  try {
    // Create provider
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    // Check if contract exists
    const code = await provider.getCode(contractAddress);
    
    if (code === '0x') {
      console.log('❌ No contract found at this address');
      return false;
    }
    
    console.log('✅ Contract found! Bytecode exists.');
    console.log(`📊 Bytecode length: ${code.length} characters`);
    
    // Try to call a simple view function
    const contractABI = [
      {
        "inputs": [],
        "name": "getSupportedSymbols",
        "outputs": [{"internalType": "string[]", "name": "symbols", "type": "string[]"}],
        "stateMutability": "pure",
        "type": "function"
      }
    ];
    
    const contract = new ethers.Contract(contractAddress, contractABI, provider);
    
    try {
      const symbols = await contract.getSupportedSymbols();
      console.log('✅ Contract is callable!');
      console.log(`📈 Supported symbols: ${symbols.join(', ')}`);
      console.log(`🎯 This is the correct contract address to use!`);
      return true;
    } catch (callError) {
      console.log('⚠️  Contract exists but function call failed:');
      console.log(`   Error: ${callError.message}`);
      console.log('   This might indicate the contract is deployed but has different ABI');
      return false;
    }
    
  } catch (error) {
    console.log('❌ Contract verification failed:');
    console.log(`   Error: ${error.message}`);
    return false;
  }
}

verifyFTSOContract().then(isValid => {
  if (isValid) {
    console.log('\n✅ CONCLUSION: Use this address in your .env file');
    console.log('FTSO_PRICE_CONSUMER_ADDRESS=0xed1692dd816996B8D7EB39e21344B3ed9Fda2d11');
  } else {
    console.log('\n❌ CONCLUSION: Contract address needs to be corrected');
  }
}).catch(console.error); 