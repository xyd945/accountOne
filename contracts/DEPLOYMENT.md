# FTSO Price Consumer Contract Deployment

This document provides instructions for deploying the FTSO Price Consumer contract to Flare Network for the AccountOne system.

## Overview

The `FtsoPriceConsumer` contract provides USD price feeds for cryptocurrency assets using Flare Network's Time Series Oracle (FTSO) v2. This contract is designed to be simple, efficient, and cost-effective for the AccountOne accounting system.

## Supported Cryptocurrencies

The contract supports the following cryptocurrencies with USD price feeds:
- FLR (Flare)
- BTC (Bitcoin)
- ETH (Ethereum)
- USDC (USD Coin)
- USDT (Tether)
- AVAX (Avalanche)
- MATIC (Polygon)
- ADA (Cardano)
- DOT (Polkadot)
- LTC (Litecoin)

## Prerequisites

1. **Foundry**: Make sure you have Foundry installed
2. **Private Key**: A wallet private key with enough FLR for gas fees
3. **Environment Setup**: Copy `env.example` to `.env` and configure

## Deployment Steps

### 1. Environment Setup

```bash
# Copy environment template
cp env.example .env

# Edit .env with your private key and settings
# IMPORTANT: Never commit .env to git!
```

### 2. Test the Contract

```bash
# Run all tests
forge test

# Run tests with verbose output
forge test -vvv
```

### 3. Deploy to Flare Testnet (Coston2)

```bash
# Deploy to Coston2 testnet with Blockscout verification
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url https://coston2-api.flare.network/ext/C/rpc \
  --broadcast \
  --verify \
  --verifier blockscout \
  --verifier-url https://coston2-explorer.flare.network/api

# Alternative using foundry.toml aliases
forge script script/Deploy.s.sol:DeployScript --rpc-url coston2 --broadcast --verify
```

### 4. Deploy to Flare Mainnet

```bash
# Deploy to Flare mainnet with Blockscout verification
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url https://flare-api.flare.network/ext/C/rpc \
  --broadcast \
  --verify \
  --verifier blockscout \
  --verifier-url https://flare-explorer.flare.network/api

# Alternative using foundry.toml aliases  
forge script script/Deploy.s.sol:DeployScript --rpc-url flare --broadcast --verify
```

## Contract Verification

The contract can be verified on Blockscout automatically during deployment with the `--verify` flag. If automatic verification fails, you can verify manually:

### Coston2 Testnet
- Explorer: https://coston2-explorer.flare.network/
- Verify manually by uploading the contract source code

### Flare Mainnet  
- Explorer: https://flare-explorer.flare.network/
- Verify manually by uploading the contract source code

## Usage Examples

After deployment, you can interact with the contract using these function calls:

### Get Single Price
```solidity
// Get ETH price in USD
(uint256 price, int8 decimals, uint64 timestamp) = ftsoPriceConsumer.getPrice("ETH");
// Price is returned as: price / (10^decimals)
```

### Get Multiple Prices
```solidity
// Get prices for multiple tokens
string[] memory symbols = ["BTC", "ETH", "USDC"];
(uint256[] memory prices, int8[] memory decimals, uint64 timestamp) = 
    ftsoPriceConsumer.getPricesBySymbols(symbols);
```

### Calculate USD Value
```solidity
// Calculate USD value for 1.5 ETH (assuming 18 decimals)
uint256 amount = 1.5 * 10**18; // 1.5 ETH in wei
(uint256 usdValue, uint256 priceUsed, uint64 timestamp) = 
    ftsoPriceConsumer.calculateUSDValue("ETH", amount, 18);
```

## Gas Costs

The contract is optimized for low gas usage:
- Single price query: ~30,000 gas
- Batch price query (10 tokens): ~80,000 gas
- USD value calculation: ~35,000 gas

## Network Information

### Flare Mainnet
- **Chain ID**: 14
- **RPC URL**: https://flare-api.flare.network/ext/C/rpc
- **Explorer**: https://flare-explorer.flare.network/
- **Contract Registry**: 0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019

### Coston2 Testnet
- **Chain ID**: 114  
- **RPC URL**: https://coston2-api.flare.network/ext/C/rpc
- **Explorer**: https://coston2-explorer.flare.network/
- **Faucet**: https://faucet.flare.network/coston2

## Security Considerations

1. **View Functions Only**: The contract only uses view functions for price queries
2. **No State Changes**: No user funds or state modifications
3. **Read-Only**: Cannot be exploited for financial gain
4. **Decentralized**: Relies on Flare's decentralized oracle network

## Integration with AccountOne Backend

After deployment, update the backend configuration with:

1. **Contract Address**: The deployed contract address
2. **ABI**: The contract ABI for interaction
3. **Network**: The Flare network configuration

The backend can then call the contract methods to get USD prices for journal entries and transaction analysis.

## Troubleshooting

### Common Issues

1. **Insufficient Gas**: Increase gas limit in deployment
2. **Network Issues**: Check RPC URL and network connectivity  
3. **Private Key**: Ensure private key has sufficient FLR balance
4. **Verification Failed**: Try manual verification on block explorer

### Support

For issues related to:
- **Contract**: Check the test suite and contract logic
- **Deployment**: Verify environment variables and network settings
- **Flare Network**: Refer to [Flare Documentation](https://dev.flare.network/)

## Next Steps

After successful deployment:

1. **Test Contract**: Verify price feeds are working correctly
2. **Update Backend**: Integrate contract address and ABI
3. **Monitor**: Set up monitoring for contract functionality
4. **Documentation**: Update system documentation with contract details 