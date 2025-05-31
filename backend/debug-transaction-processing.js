require('dotenv').config();
const axios = require('axios');

async function debugTransactionProcessing() {
  console.log('🔧 DEBUGGING TRANSACTION PROCESSING');
  console.log('===================================\n');

  const baseURL = 'https://coston2-explorer.flare.network';
  const testHash = '0x4fe7096f9232c2f1b69736dc6a5de6d247ca23514f9337e9abd45c3ab5f9e126';
  
  console.log(`Testing transaction: ${testHash}\n`);

  try {
    // Get the raw transaction data
    const response = await axios.get(`${baseURL}/api/v2/transactions/${testHash}`);
    const txData = response.data;
    
    console.log('📊 RAW TRANSACTION ANALYSIS:');
    console.log('─'.repeat(50));
    console.log(`Hash: ${txData.hash}`);
    console.log(`Value: ${txData.value} Wei (native token)`);
    console.log(`Gas Used: ${txData.gas_used}`);
    console.log(`Gas Price: ${txData.gas_price} Wei`);
    console.log(`Transaction Fee: ${txData.fee?.value} Wei`);
    console.log(`Method: ${txData.method}`);
    console.log(`Status: ${txData.status}`);
    
    // Calculate gas fee correctly
    const gasUsed = parseInt(txData.gas_used);
    const gasPrice = parseInt(txData.gas_price);
    const gasFeeWei = gasUsed * gasPrice;
    const gasFeeC2FLR = gasFeeWei / Math.pow(10, 18);
    
    console.log('\n⛽ GAS FEE CALCULATION:');
    console.log('─'.repeat(30));
    console.log(`Gas Used: ${gasUsed.toLocaleString()}`);
    console.log(`Gas Price: ${gasPrice.toLocaleString()} Wei (${gasPrice / 1e9} Gwei)`);
    console.log(`Total Gas Fee: ${gasFeeWei.toLocaleString()} Wei`);
    console.log(`Gas Fee in C2FLR: ${gasFeeC2FLR.toFixed(6)} C2FLR`);
    console.log(`API Fee Value: ${parseInt(txData.fee?.value).toLocaleString()} Wei`);
    console.log(`Matches calculation: ${gasFeeWei === parseInt(txData.fee?.value)}`);
    
    // Analyze token transfers
    console.log('\n🪙 TOKEN TRANSFER ANALYSIS:');
    console.log('─'.repeat(30));
    
    if (txData.token_transfers && txData.token_transfers.length > 0) {
      txData.token_transfers.forEach((transfer, i) => {
        console.log(`Transfer ${i + 1}:`);
        console.log(`  From: ${transfer.from?.hash}`);
        console.log(`  To: ${transfer.to?.hash}`);
        console.log(`  Token: ${transfer.token?.symbol} (${transfer.token?.name})`);
        console.log(`  Decimals: ${transfer.token?.decimals}`);
        console.log(`  Raw Amount: ${transfer.total?.value} Wei`);
        
        // Calculate actual amount
        const decimals = parseInt(transfer.token?.decimals || 18);
        const rawAmount = transfer.total?.value || '0';
        const actualAmount = parseFloat(rawAmount) / Math.pow(10, decimals);
        console.log(`  Actual Amount: ${actualAmount} ${transfer.token?.symbol}`);
        console.log(`  Contract: ${transfer.token?.address}`);
      });
    } else {
      console.log('No token transfers found');
    }
    
    // Show how this should be processed for AI
    console.log('\n🤖 CORRECT AI INPUT FORMAT:');
    console.log('─'.repeat(30));
    
    const correctProcessing = {
      transactionType: 'token_transfer',
      nativeValue: '0 C2FLR', // No native token transfer
      gasFee: `${gasFeeC2FLR.toFixed(6)} C2FLR`,
      tokenTransfers: txData.token_transfers.map(transfer => {
        const decimals = parseInt(transfer.token?.decimals || 18);
        const actualAmount = parseFloat(transfer.total?.value) / Math.pow(10, decimals);
        return {
          from: transfer.from?.hash,
          to: transfer.to?.hash,
          amount: actualAmount,
          symbol: transfer.token?.symbol,
          name: transfer.token?.name
        };
      }),
      networkCurrency: 'C2FLR',
      network: 'Coston2'
    };
    
    console.log('Correct processing result:');
    console.log(JSON.stringify(correctProcessing, null, 2));
    
    // Show what the current system might be doing wrong
    console.log('\n❌ CURRENT SYSTEM ISSUES:');
    console.log('─'.repeat(30));
    console.log('1. Gas fee calculation: If showing 522 ETH, it\'s using wrong formula');
    console.log('2. Token recognition: If not detecting XYD, token processing is broken');
    console.log('3. Currency: If showing ETH instead of C2FLR, network detection failed');
    
    return correctProcessing;
    
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    return null;
  }
}

debugTransactionProcessing().catch(console.error); 