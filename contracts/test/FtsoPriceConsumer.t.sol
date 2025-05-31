// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Test, console} from "forge-std/Test.sol";
import {FtsoPriceConsumer} from "../src/FtsoPriceConsumer.sol";

contract FtsoPriceConsumerTest is Test {
    FtsoPriceConsumer public ftsoPriceConsumer;

    function setUp() public {
        ftsoPriceConsumer = new FtsoPriceConsumer();
    }

    function test_ContractDeployment() public {
        // Test that the contract deploys successfully
        assertTrue(address(ftsoPriceConsumer) != address(0));
    }

    function test_SupportedSymbols() public {
        string[] memory symbols = ftsoPriceConsumer.getSupportedSymbols();
        
        // Check that we have the expected number of symbols
        assertEq(symbols.length, 10);
        
        // Check that specific symbols are supported
        assertTrue(ftsoPriceConsumer.isSymbolSupported("BTC"));
        assertTrue(ftsoPriceConsumer.isSymbolSupported("ETH"));
        assertTrue(ftsoPriceConsumer.isSymbolSupported("USDC"));
        assertTrue(ftsoPriceConsumer.isSymbolSupported("FLR"));
        
        // Check that unsupported symbols return false
        assertFalse(ftsoPriceConsumer.isSymbolSupported("INVALID"));
    }

    function test_FeedIdMapping() public {
        // Test that symbol to feed ID mapping works
        bytes21 btcFeedId = ftsoPriceConsumer.getFeedId("BTC");
        bytes21 expectedBtcFeedId = 0x014254432f55534400000000000000000000000000;
        assertEq(bytes32(btcFeedId), bytes32(expectedBtcFeedId));
        
        bytes21 ethFeedId = ftsoPriceConsumer.getFeedId("ETH");
        bytes21 expectedEthFeedId = 0x014554482f55534400000000000000000000000000;
        assertEq(bytes32(ethFeedId), bytes32(expectedEthFeedId));
    }

    function test_UnsupportedSymbol() public {
        // Test that unsupported symbols are handled correctly
        vm.expectRevert("Unsupported symbol");
        ftsoPriceConsumer.getPrice("INVALID");
    }

    function test_Constants() public {
        // Test that constants are set correctly
        assertEq(bytes32(ftsoPriceConsumer.BTC_USD_ID()), bytes32(bytes21(0x014254432f55534400000000000000000000000000)));
        assertEq(bytes32(ftsoPriceConsumer.ETH_USD_ID()), bytes32(bytes21(0x014554482f55534400000000000000000000000000)));
        assertEq(bytes32(ftsoPriceConsumer.FLR_USD_ID()), bytes32(bytes21(0x01464c522f55534400000000000000000000000000)));
    }
} 