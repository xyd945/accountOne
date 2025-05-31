// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {FtsoPriceConsumer} from "src/FtsoPriceConsumer.sol";

/**
 * @title Deploy FtsoPriceConsumer
 * @dev Deployment script for the enhanced FTSO price consumer contract
 * 
 * Run with:
 * forge script script/FtsoPriceConsumer.s.sol:Deploy --private-key $PRIVATE_KEY --rpc-url $COSTON2_RPC_URL --broadcast --verify --verifier-url https://api.routescan.io/v2/network/testnet/evm/114/etherscan/api --etherscan-api-key "X"
 * 
 * Or for dry run:
 * forge script script/FtsoPriceConsumer.s.sol:Deploy --rpc-url https://coston2-api.flare.network/ext/C/rpc
 */
contract Deploy is Script {
    FtsoPriceConsumer public priceConsumer;

    function run() external {
        // Get private key from environment
        string memory privateKeyStr = vm.envString("PRIVATE_KEY");
        uint256 deployerPrivateKey = vm.parseUint(privateKeyStr);
        
        vm.startBroadcast(deployerPrivateKey);

        // Deploy the FtsoPriceConsumer contract
        priceConsumer = new FtsoPriceConsumer();
        
        console2.log("FtsoPriceConsumer deployed at:", address(priceConsumer));
        console2.log("Deployer address:", vm.addr(deployerPrivateKey));
        console2.log("Supported symbols count:", priceConsumer.getSupportedFeedsCount());
        
        // Log some example feed IDs for verification
        console2.log("FLR feed ID:", vm.toString(priceConsumer.getFeedId("FLR")));
        console2.log("BTC feed ID:", vm.toString(priceConsumer.getFeedId("BTC")));
        console2.log("ETH feed ID:", vm.toString(priceConsumer.getFeedId("ETH")));

        vm.stopBroadcast();
    }
} 