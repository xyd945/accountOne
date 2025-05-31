// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {FtsoPriceConsumer} from "../src/FtsoPriceConsumer.sol";

contract DeployScript is Script {
    FtsoPriceConsumer public ftsoPriceConsumer;

    function setUp() public {}

    function run() public {
        vm.startBroadcast();

        // Deploy the FTSO Price Consumer contract
        ftsoPriceConsumer = new FtsoPriceConsumer();

        console.log("FtsoPriceConsumer deployed to:", address(ftsoPriceConsumer));
        
        // Test the deployment by checking supported symbols
        string[] memory supportedSymbols = ftsoPriceConsumer.getSupportedSymbols();
        console.log("Number of supported symbols:", supportedSymbols.length);
        
        for (uint256 i = 0; i < supportedSymbols.length; i++) {
            console.log("Supported symbol:", supportedSymbols[i]);
        }

        vm.stopBroadcast();
    }
} 