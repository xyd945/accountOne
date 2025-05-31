// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {FtsoPriceConsumer} from "src/FtsoPriceConsumer.sol";

/**
 * @title Test FtsoPriceConsumer
 * @dev Test script to interact with deployed FTSO price consumer and fetch real prices
 * 
 * Usage:
 * forge script script/TestFtsoPriceConsumer.s.sol:TestContract --rpc-url https://coston2-api.flare.network/ext/C/rpc --private-key $PRIVATE_KEY --broadcast -vvv
 */
contract TestContract is Script {
    // Replace with your deployed contract address
    address constant DEPLOYED_CONTRACT = 0xed1692dd816996B8D7EB39e21344B3ed9Fda2d11;
    
    function run() external {
        uint256 deployerPrivateKey;
        
        // Try to get private key from environment
        try vm.envUint("PRIVATE_KEY") returns (uint256 pk) {
            deployerPrivateKey = pk;
        } catch {
            deployerPrivateKey = 0x1234567890123456789012345678901234567890123456789012345678901234;
            console2.log("Warning: Using dummy private key for simulation only!");
        }
        
        vm.startBroadcast(deployerPrivateKey);
        
        FtsoPriceConsumer priceConsumer = FtsoPriceConsumer(DEPLOYED_CONTRACT);
        
        console2.log("=== FTSO Price Consumer Test ===");
        console2.log("Contract Address:", DEPLOYED_CONTRACT);
        console2.log("Supported Feeds Count:", priceConsumer.getSupportedFeedsCount());
        
        // Test supported symbols
        console2.log("\n=== Supported Symbols Check ===");
        string[] memory symbols = priceConsumer.getSupportedSymbols();
        for (uint i = 0; i < symbols.length; i++) {
            console2.log("Symbol:", symbols[i], "Supported:", priceConsumer.isSymbolSupported(symbols[i]));
        }
        
        // Test individual price fetching
        console2.log("\n=== Individual Price Tests ===");
        
        try priceConsumer.getPrice("FLR") returns (uint256 value, int8 decimals, uint64 timestamp) {
            console2.log("FLR/USD Price:", value);
            console2.log("FLR/USD Decimals:", vm.toString(uint256(uint8(decimals))));
            console2.log("FLR/USD Timestamp:", timestamp);
        } catch Error(string memory reason) {
            console2.log("FLR Price Error:", reason);
        }
        
        try priceConsumer.getPrice("BTC") returns (uint256 value, int8 decimals, uint64 timestamp) {
            console2.log("BTC/USD Price:", value);
            console2.log("BTC/USD Decimals:", vm.toString(uint256(uint8(decimals))));
            console2.log("BTC/USD Timestamp:", timestamp);
        } catch Error(string memory reason) {
            console2.log("BTC Price Error:", reason);
        }
        
        try priceConsumer.getPrice("ETH") returns (uint256 value, int8 decimals, uint64 timestamp) {
            console2.log("ETH/USD Price:", value);
            console2.log("ETH/USD Decimals:", vm.toString(uint256(uint8(decimals))));
            console2.log("ETH/USD Timestamp:", timestamp);
        } catch Error(string memory reason) {
            console2.log("ETH Price Error:", reason);
        }
        
        // Test batch price fetching
        console2.log("\n=== Batch Price Test ===");
        try priceConsumer.getAllPrices() returns (
            uint256[] memory feedValues,
            int8[] memory decimals,
            uint64 timestamp
        ) {
            console2.log("Batch fetch successful! Timestamp:", timestamp);
            console2.log("Number of prices returned:", feedValues.length);
            
            for (uint i = 0; i < feedValues.length && i < 5; i++) { // Show first 5
                console2.log("Price", i, "Value:", feedValues[i]);
                console2.log("Price", i, "Decimals:", vm.toString(uint256(uint8(decimals[i]))));
            }
        } catch Error(string memory reason) {
            console2.log("Batch Price Error:", reason);
        }
        
        // Test USD value calculation
        console2.log("\n=== USD Value Calculation Test ===");
        try priceConsumer.calculateUSDValue("ETH", 1 ether, 18) returns (uint256 usdValue, int8 priceDecimals) {
            console2.log("1 ETH USD Value:", usdValue);
            console2.log("Price Decimals:", vm.toString(uint256(uint8(priceDecimals))));
        } catch Error(string memory reason) {
            console2.log("USD Calculation Error:", reason);
        }
        
        console2.log("\n=== Test Complete ===");
        
        vm.stopBroadcast();
    }
} 