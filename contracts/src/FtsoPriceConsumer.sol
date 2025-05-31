// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Strings} from "@openzeppelin-contracts/utils/Strings.sol";
import {ContractRegistry} from "flare-periphery/coston2/ContractRegistry.sol";
import {FtsoV2Interface} from "flare-periphery/coston2/FtsoV2Interface.sol";

/**
 * @title FtsoPriceConsumer
 * @dev Enhanced FTSO v2 price consumer for AccountOne crypto accounting system
 * Supports multiple cryptocurrencies with real-time price feeds from Flare FTSO
 */
contract FtsoPriceConsumer {
    FtsoV2Interface public ftso;
    
    // Feed IDs for supported cryptocurrencies (based on Flare FTSO v2 documentation)
    bytes21 public constant FLR_USD_ID = 0x01464c522f55534400000000000000000000000000;  // FLR/USD
    bytes21 public constant BTC_USD_ID = 0x014254432f55534400000000000000000000000000;  // BTC/USD  
    bytes21 public constant ETH_USD_ID = 0x014554482f55534400000000000000000000000000;  // ETH/USD
    bytes21 public constant USDC_USD_ID = 0x01555344432f555344000000000000000000000000; // USDC/USD
    bytes21 public constant USDT_USD_ID = 0x01555344542f555344000000000000000000000000; // USDT/USD
    bytes21 public constant AVAX_USD_ID = 0x01415641582f555344000000000000000000000000; // AVAX/USD
    bytes21 public constant POL_USD_ID = 0x01504f4c2f55534400000000000000000000000000;  // POL/USD (MATIC)
    bytes21 public constant ADA_USD_ID = 0x014144412f55534400000000000000000000000000;  // ADA/USD
    bytes21 public constant DOT_USD_ID = 0x01444f542f55534400000000000000000000000000;  // DOT/USD
    bytes21 public constant LTC_USD_ID = 0x014c54432f55534400000000000000000000000000;  // LTC/USD
    
    // Array of all supported feed IDs for batch operations
    bytes21[] public supportedFeeds;
    
    // Symbol to feed ID mapping
    mapping(string => bytes21) public symbolToFeedId;
    
    constructor() {
        ftso = ContractRegistry.getFtsoV2();
        
        // Initialize supported feeds array
        supportedFeeds = [
            FLR_USD_ID,
            BTC_USD_ID, 
            ETH_USD_ID,
            USDC_USD_ID,
            USDT_USD_ID,
            AVAX_USD_ID,
            POL_USD_ID,
            ADA_USD_ID,
            DOT_USD_ID,
            LTC_USD_ID
        ];
        
        // Initialize symbol mappings
        symbolToFeedId["FLR"] = FLR_USD_ID;
        symbolToFeedId["BTC"] = BTC_USD_ID;
        symbolToFeedId["ETH"] = ETH_USD_ID;
        symbolToFeedId["USDC"] = USDC_USD_ID;
        symbolToFeedId["USDT"] = USDT_USD_ID;
        symbolToFeedId["AVAX"] = AVAX_USD_ID;
        symbolToFeedId["POL"] = POL_USD_ID;
        symbolToFeedId["MATIC"] = POL_USD_ID; // POL was formerly MATIC
        symbolToFeedId["ADA"] = ADA_USD_ID;
        symbolToFeedId["DOT"] = DOT_USD_ID;
        symbolToFeedId["LTC"] = LTC_USD_ID;
    }
    
    /**
     * @dev Get USD price for a single cryptocurrency by symbol
     * @param symbol The cryptocurrency symbol (e.g., "BTC", "ETH", "FLR")
     * @return value The price value 
     * @return decimals The decimal precision
     * @return timestamp The timestamp of the price
     */
    function getPrice(string memory symbol) external returns (uint256 value, int8 decimals, uint64 timestamp) {
        bytes21 feedId = symbolToFeedId[symbol];
        require(feedId != bytes21(0), "Unsupported symbol");
        
        (value, decimals, timestamp) = ftso.getFeedById(feedId);
        return (value, decimals, timestamp);
    }
    
    /**
     * @dev Get USD prices for multiple cryptocurrencies
     * @return feedValues Array of price values
     * @return decimals Array of decimal precisions  
     * @return timestamp Timestamp of the prices
     */
    function getAllPrices() external returns (
        uint256[] memory feedValues,
        int8[] memory decimals,
        uint64 timestamp
    ) {
        return ftso.getFeedsById(supportedFeeds);
    }
    
    /**
     * @dev Calculate USD value for a given amount of cryptocurrency
     * @param symbol The cryptocurrency symbol
     * @param amount The amount of cryptocurrency (in wei/smallest unit)
     * @param tokenDecimals The decimal places of the token (e.g., 18 for ETH)
     * @return usdValue The USD value
     * @return priceDecimals The decimal places of the price
     */
    function calculateUSDValue(
        string memory symbol, 
        uint256 amount, 
        uint8 tokenDecimals
    ) external returns (uint256 usdValue, int8 priceDecimals) {
        bytes21 feedId = symbolToFeedId[symbol];
        require(feedId != bytes21(0), "Unsupported symbol");
        
        (uint256 price, int8 decimals, ) = ftso.getFeedById(feedId);
        
        // Calculate: (amount / 10^tokenDecimals) * (price / 10^decimals)
        // Rearranged to avoid precision loss: (amount * price) / (10^tokenDecimals * 10^decimals)
        usdValue = (amount * price) / (10 ** tokenDecimals * 10 ** uint8(decimals));
        priceDecimals = decimals;
        
        return (usdValue, priceDecimals);
    }
    
    /**
     * @dev Check if a cryptocurrency symbol is supported
     * @param symbol The cryptocurrency symbol to check
     * @return supported True if the symbol is supported
     */
    function isSymbolSupported(string memory symbol) external view returns (bool supported) {
        return symbolToFeedId[symbol] != bytes21(0);
    }
    
    /**
     * @dev Get all supported cryptocurrency symbols
     * @return symbols Array of supported symbols
     */
    function getSupportedSymbols() external pure returns (string[] memory symbols) {
        symbols = new string[](10);
        symbols[0] = "FLR";
        symbols[1] = "BTC"; 
        symbols[2] = "ETH";
        symbols[3] = "USDC";
        symbols[4] = "USDT";
        symbols[5] = "AVAX";
        symbols[6] = "POL";
        symbols[7] = "ADA";
        symbols[8] = "DOT";
        symbols[9] = "LTC";
        return symbols;
    }
    
    /**
     * @dev Get feed ID for a given symbol
     * @param symbol The cryptocurrency symbol
     * @return feedId The corresponding feed ID
     */
    function getFeedId(string memory symbol) external view returns (bytes21 feedId) {
        return symbolToFeedId[symbol];
    }
    
    /**
     * @dev Get the total number of supported feeds
     * @return count The number of supported feeds
     */
    function getSupportedFeedsCount() external view returns (uint256 count) {
        return supportedFeeds.length;
    }
} 