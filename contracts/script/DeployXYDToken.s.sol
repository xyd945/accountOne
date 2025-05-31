// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/XYDToken.sol";

/**
 * @title Deploy XYD Token Script
 * @dev Deployment script for XYD token on Coston2 testnet
 */
contract DeployXYDToken is Script {
    function run() external {
        // Load private key from environment
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);

        // Deploy XYD Token
        XYDToken xydToken = new XYDToken();

        console.log("=== XYD Token Deployment ===");
        console.log("Contract Address:", address(xydToken));
        console.log("Token Name:", xydToken.name());
        console.log("Token Symbol:", xydToken.symbol());
        console.log("Token Decimals:", xydToken.decimals());
        console.log("Total Supply:", xydToken.totalSupply());
        console.log("Owner:", xydToken.owner());
        
        // Get token info
        (string memory name, string memory symbol, uint8 decimals, uint256 totalSupply) = xydToken.getTokenInfo();
        console.log("\n=== Token Information ===");
        console.log("Name:", name);
        console.log("Symbol:", symbol);
        console.log("Decimals:", decimals);
        console.log("Total Supply (raw):", totalSupply);
        console.log("Total Supply (formatted):", totalSupply / 10**decimals, "XYD");

        vm.stopBroadcast();

        console.log("\n=== Next Steps ===");
        console.log("1. Contract deployed and verified automatically");
        console.log("2. Add to environment: XYD_TOKEN_ADDRESS=");
        console.log("   Address:", address(xydToken));
        console.log("3. Test token transfers with AccountOne journal entries");
        console.log("4. Use this address for testing ERC20 functionality");
    }
} 