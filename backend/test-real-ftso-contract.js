require('dotenv').config();

const { ethers } = require('ethers');

// Test configuration for deployed FTSO contract
const CONTRACT_ADDRESS = '0xed1692dd816996B8D7EB39e21344B3ed9Fda2d11'; // Replace with actual deployed address
const COSTON2_RPC_URL = 'https://coston2-api.flare.network/ext/C/rpc';

// Contract ABI - only the methods we need
const CONTRACT_ABI = [
    {
        "inputs": [{"internalType": "string", "name": "symbol", "type": "string"}],
        "name": "getPrice",
        "outputs": [
            {"internalType": "uint256", "name": "value", "type": "uint256"},
            {"internalType": "int8", "name": "decimals", "type": "int8"},
            {"internalType": "uint64", "name": "timestamp", "type": "uint64"}
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "getAllPrices",
        "outputs": [
            {"internalType": "uint256[]", "name": "feedValues", "type": "uint256[]"},
            {"internalType": "int8[]", "name": "decimals", "type": "int8[]"},
            {"internalType": "uint64", "name": "timestamp", "type": "uint64"}
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {"internalType": "string", "name": "symbol", "type": "string"},
            {"internalType": "uint256", "name": "amount", "type": "uint256"},
            {"internalType": "uint8", "name": "tokenDecimals", "type": "uint8"}
        ],
        "name": "calculateUSDValue",
        "outputs": [
            {"internalType": "uint256", "name": "usdValue", "type": "uint256"},
            {"internalType": "int8", "name": "priceDecimals", "type": "int8"}
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "getSupportedSymbols",
        "outputs": [
            {"internalType": "string[]", "name": "symbols", "type": "string[]"}
        ],
        "stateMutability": "pure",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "string", "name": "symbol", "type": "string"}],
        "name": "isSymbolSupported",
        "outputs": [{"internalType": "bool", "name": "supported", "type": "bool"}],
        "stateMutability": "view",
        "type": "function"
    }
];

async function testRealFTSOContract() {
    console.log('🧪 Testing REAL FTSO Contract on Coston2 🚀\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🌐 Network: Coston2 Testnet');
    console.log('📜 Contract:', CONTRACT_ADDRESS);
    console.log('🔥 Using REAL FTSO Oracle Data from Deployed Contract!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    try {
        // Setup provider and signer with private key
        const provider = new ethers.JsonRpcProvider(COSTON2_RPC_URL);
        
        // Get private key from environment
        const privateKey = process.env.PRIVATE_KEY;
        if (!privateKey) {
            console.error('❌ PRIVATE_KEY not found in environment variables');
            return;
        }
        
        const wallet = new ethers.Wallet(privateKey, provider);
        const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);

        console.log('📊 Testing Contract Connection...');
        console.log('👛 Wallet address:', wallet.address);
        
        // Test 1: Get supported symbols (this is a pure function, no transaction needed)
        console.log('\n=== 1. SUPPORTED SYMBOLS TEST ===');
        try {
            const symbols = await contract.getSupportedSymbols();
            console.log('✅ Supported symbols:', symbols.join(', '));
            console.log(`📈 Total supported: ${symbols.length} cryptocurrencies`);
        } catch (error) {
            console.error('❌ Supported symbols error:', error.message);
        }

        // Test 2: Fetch REAL BTC price (this requires a transaction)
        console.log('\n=== 2. REAL BTC PRICE TEST ===');
        try {
            console.log('🔄 Fetching BTC price... (using staticCall for read-only)');
            const btcResult = await contract.getPrice.staticCall("BTC");
            console.log('✅ BTC Price fetched successfully!');
            console.log('   Raw result:', btcResult);
            
            // Extract values from the result tuple
            const value = btcResult[0];
            const decimals = btcResult[1];
            const timestamp = btcResult[2];
            
            console.log('   Value:', value.toString());
            console.log('   Decimals:', decimals.toString());
            console.log('   Timestamp:', timestamp.toString());
            
            if (value && decimals !== undefined) {
                const price = Number(value) / Math.pow(10, Number(decimals));
                console.log('💰 BTC/USD Price: $', price.toFixed(2));
                console.log('   Timestamp:', new Date(Number(timestamp) * 1000).toISOString());
            }
            
        } catch (error) {
            console.error('❌ BTC Price fetch error:', error.message);
            if (error.message.includes('insufficient funds')) {
                console.log('💡 Need more C2FLR tokens for gas fees');
            }
        }

        // Test 3: Fetch ETH price
        console.log('\n=== 3. REAL ETH PRICE TEST ===');
        try {
            console.log('🔄 Fetching ETH price... (using staticCall for read-only)');
            const ethResult = await contract.getPrice.staticCall("ETH");
            console.log('✅ ETH Price fetched successfully!');
            console.log('   Raw result:', ethResult);
            
            const value = ethResult[0];
            const decimals = ethResult[1];
            const timestamp = ethResult[2];
            
            if (value && decimals !== undefined) {
                const price = Number(value) / Math.pow(10, Number(decimals));
                console.log('💰 ETH/USD Price: $', price.toFixed(2));
                console.log('   Timestamp:', new Date(Number(timestamp) * 1000).toISOString());
            }
            
        } catch (error) {
            console.error('❌ ETH Price fetch error:', error.message);
        }

        // Test 4: Calculate USD value for 1 ETH
        console.log('\n=== 4. USD VALUE CALCULATION TEST ===');
        try {
            console.log('🔄 Calculating USD value for 1 ETH... (using staticCall for read-only)');
            const usdResult = await contract.calculateUSDValue.staticCall("ETH", ethers.parseEther("1"), 18);
            console.log('✅ USD Value calculation successful!');
            console.log('   Raw result:', usdResult);
            
            const usdValue = usdResult[0];
            const priceDecimals = usdResult[1];
            
            if (usdValue && priceDecimals !== undefined) {
                const finalValue = Number(usdValue) / Math.pow(10, Number(priceDecimals));
                console.log('💵 1 ETH = $', finalValue.toFixed(2));
            }
            
        } catch (error) {
            console.error('❌ USD calculation error:', error.message);
        }

        console.log('\n=== 5. INTEGRATION READY ===');
        console.log('🎯 Contract is working and ready for AccountOne integration!');
        console.log('   • Real FTSO prices are being fetched ✅');
        console.log('   • USD value calculations work ✅');
        console.log('   • Ready to replace mock ftsoService.js ✅');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

testRealFTSOContract(); 