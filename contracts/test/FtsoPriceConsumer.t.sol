// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Test} from "forge-std/Test.sol";
import {console2} from "forge-std/console2.sol";
import {FtsoPriceConsumer} from "src/FtsoPriceConsumer.sol";

/**
 * @title FtsoPriceConsumer Tests
 * @dev Test suite for the enhanced FTSO price consumer contract
 */
contract FtsoPriceConsumerTest is Test {
    FtsoPriceConsumer public priceConsumer;
    
    function setUp() public {
        priceConsumer = new FtsoPriceConsumer();
    }
    
    function test_Constructor() public {
        // Test that the contract was deployed with correct supported feeds count
        assertEq(priceConsumer.getSupportedFeedsCount(), 10);
    }
    
    function test_SupportedSymbols() public {
        // Test that all expected symbols are supported
        assertTrue(priceConsumer.isSymbolSupported("FLR"));
        assertTrue(priceConsumer.isSymbolSupported("BTC"));
        assertTrue(priceConsumer.isSymbolSupported("ETH"));
        assertTrue(priceConsumer.isSymbolSupported("USDC"));
        assertTrue(priceConsumer.isSymbolSupported("USDT"));
        assertTrue(priceConsumer.isSymbolSupported("AVAX"));
        assertTrue(priceConsumer.isSymbolSupported("POL"));
        assertTrue(priceConsumer.isSymbolSupported("MATIC")); // Should map to POL
        assertTrue(priceConsumer.isSymbolSupported("ADA"));
        assertTrue(priceConsumer.isSymbolSupported("DOT"));
        assertTrue(priceConsumer.isSymbolSupported("LTC"));
        
        // Test that unsupported symbols return false
        assertFalse(priceConsumer.isSymbolSupported("UNSUPPORTED"));
        assertFalse(priceConsumer.isSymbolSupported("XYZ"));
    }
    
    function test_GetSupportedSymbols() public {
        string[] memory symbols = priceConsumer.getSupportedSymbols();
        assertEq(symbols.length, 10);
        
        // Check that expected symbols are in the array
        assertEq(symbols[0], "FLR");
        assertEq(symbols[1], "BTC");
        assertEq(symbols[2], "ETH");
    }
    
    function test_FeedIdMapping() public {
        // Test that feed IDs are correctly mapped
        bytes21 flrFeedId = priceConsumer.getFeedId("FLR");
        bytes21 expectedFlrId = 0x01464c522f55534400000000000000000000000000;
        assertEq(flrFeedId, expectedFlrId);
        
        bytes21 btcFeedId = priceConsumer.getFeedId("BTC");
        bytes21 expectedBtcId = 0x014254432f55534400000000000000000000000000;
        assertEq(btcFeedId, expectedBtcId);
        
        bytes21 ethFeedId = priceConsumer.getFeedId("ETH");
        bytes21 expectedEthId = 0x014554482f55534400000000000000000000000000;
        assertEq(ethFeedId, expectedEthId);
    }
    
    function test_UnsupportedSymbol() public {
        // Test that unsupported symbols revert with correct message
        vm.expectRevert("Unsupported symbol");
        priceConsumer.getPrice("UNSUPPORTED");
        
        vm.expectRevert("Unsupported symbol");
        priceConsumer.calculateUSDValue("UNSUPPORTED", 1000, 18);
    }
    
    function test_MaticPolMapping() public {
        // Test that MATIC maps to the same feed ID as POL
        bytes21 maticFeedId = priceConsumer.getFeedId("MATIC");
        bytes21 polFeedId = priceConsumer.getFeedId("POL");
        assertEq(maticFeedId, polFeedId);
        
        // Both should map to POL feed ID
        bytes21 expectedPolId = 0x01504f4c2f55534400000000000000000000000000;
        assertEq(maticFeedId, expectedPolId);
        assertEq(polFeedId, expectedPolId);
    }
} 