// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "./IFtsoV2.sol";

/**
 * @title FTSO Price Consumer for AccountOne
 * @notice A simple contract to fetch USD prices for crypto assets using Flare FTSO v2
 * @dev This contract provides price feeds for the AccountOne accounting system
 */
contract FtsoPriceConsumer {
    
    // Flare Network Contract Registry address (mainnet)
    address private constant CONTRACT_REGISTRY = 0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019;
    
    // Feed IDs for major cryptocurrencies (21 bytes each)
    bytes21 public constant FLR_USD_ID = 0x01464c522f55534400000000000000000000000000; // "FLR/USD"
    bytes21 public constant BTC_USD_ID = 0x014254432f55534400000000000000000000000000; // "BTC/USD"
    bytes21 public constant ETH_USD_ID = 0x014554482f55534400000000000000000000000000; // "ETH/USD"
    bytes21 public constant USDC_USD_ID = 0x01555344432f555344000000000000000000000000; // "USDC/USD"
    bytes21 public constant USDT_USD_ID = 0x01555344542f555344000000000000000000000000; // "USDT/USD"
    bytes21 public constant AVAX_USD_ID = 0x01415641582f555344000000000000000000000000; // "AVAX/USD"
    bytes21 public constant MATIC_USD_ID = 0x014d415449432f5553440000000000000000000000; // "MATIC/USD"
    bytes21 public constant ADA_USD_ID = 0x014144412f55534400000000000000000000000000; // "ADA/USD"
    bytes21 public constant DOT_USD_ID = 0x01444f542f55534400000000000000000000000000; // "DOT/USD"
    bytes21 public constant LTC_USD_ID = 0x014c54432f55534400000000000000000000000000; // "LTC/USD"

    // All supported feed IDs for batch operations
    bytes21[] public feedIds = [
        FLR_USD_ID,
        BTC_USD_ID,
        ETH_USD_ID,
        USDC_USD_ID,
        USDT_USD_ID,
        AVAX_USD_ID,
        MATIC_USD_ID,
        ADA_USD_ID,
        DOT_USD_ID,
        LTC_USD_ID
    ];

    // Symbol mapping for easy reference
    mapping(string => bytes21) public symbolToFeedId;
    mapping(bytes21 => string) public feedIdToSymbol;

    // Events
    event PriceRequested(bytes21 indexed feedId, string symbol, address indexed requester);
    event BatchPriceRequested(uint256 feedCount, address indexed requester);

    constructor() {
        // Initialize symbol mappings
        symbolToFeedId["FLR"] = FLR_USD_ID;
        symbolToFeedId["BTC"] = BTC_USD_ID;
        symbolToFeedId["ETH"] = ETH_USD_ID;
        symbolToFeedId["USDC"] = USDC_USD_ID;
        symbolToFeedId["USDT"] = USDT_USD_ID;
        symbolToFeedId["AVAX"] = AVAX_USD_ID;
        symbolToFeedId["MATIC"] = MATIC_USD_ID;
        symbolToFeedId["ADA"] = ADA_USD_ID;
        symbolToFeedId["DOT"] = DOT_USD_ID;
        symbolToFeedId["LTC"] = LTC_USD_ID;

        // Reverse mapping
        feedIdToSymbol[FLR_USD_ID] = "FLR";
        feedIdToSymbol[BTC_USD_ID] = "BTC";
        feedIdToSymbol[ETH_USD_ID] = "ETH";
        feedIdToSymbol[USDC_USD_ID] = "USDC";
        feedIdToSymbol[USDT_USD_ID] = "USDT";
        feedIdToSymbol[AVAX_USD_ID] = "AVAX";
        feedIdToSymbol[MATIC_USD_ID] = "MATIC";
        feedIdToSymbol[ADA_USD_ID] = "ADA";
        feedIdToSymbol[DOT_USD_ID] = "DOT";
        feedIdToSymbol[LTC_USD_ID] = "LTC";
    }

    /**
     * @notice Get USD price for a specific cryptocurrency by symbol
     * @param symbol The symbol of the cryptocurrency (e.g., "BTC", "ETH")
     * @return price The USD price (adjusted for decimals)
     * @return decimals The number of decimal places
     * @return timestamp The timestamp of the price data
     */
    function getPrice(string memory symbol) 
        external 
        view 
        returns (uint256 price, int8 decimals, uint64 timestamp) 
    {
        bytes21 feedId = symbolToFeedId[symbol];
        require(feedId != bytes21(0), "Unsupported symbol");
        
        IFtsoV2 ftsoV2 = IContractRegistry(CONTRACT_REGISTRY).getFtsoV2();
        (price, decimals, timestamp) = ftsoV2.getFeedById(feedId);
        
        return (price, decimals, timestamp);
    }

    /**
     * @notice Get USD price for a specific cryptocurrency by feed ID
     * @param feedId The feed ID of the cryptocurrency
     * @return price The USD price (adjusted for decimals)
     * @return decimals The number of decimal places
     * @return timestamp The timestamp of the price data
     */
    function getPriceById(bytes21 feedId) 
        external 
        view 
        returns (uint256 price, int8 decimals, uint64 timestamp) 
    {
        IFtsoV2 ftsoV2 = IContractRegistry(CONTRACT_REGISTRY).getFtsoV2();
        (price, decimals, timestamp) = ftsoV2.getFeedById(feedId);
        
        return (price, decimals, timestamp);
    }

    /**
     * @notice Get USD prices for all supported cryptocurrencies in batch
     * @return symbols Array of cryptocurrency symbols
     * @return prices Array of USD prices
     * @return decimals Array of decimal places
     * @return timestamp The timestamp of the price data
     */
    function getAllPrices() 
        external 
        view 
        returns (
            string[] memory symbols,
            uint256[] memory prices,
            int8[] memory decimals,
            uint64 timestamp
        ) 
    {
        IFtsoV2 ftsoV2 = IContractRegistry(CONTRACT_REGISTRY).getFtsoV2();
        (prices, decimals, timestamp) = ftsoV2.getFeedsById(feedIds);
        
        // Create symbols array
        symbols = new string[](feedIds.length);
        for (uint256 i = 0; i < feedIds.length; i++) {
            symbols[i] = feedIdToSymbol[feedIds[i]];
        }
        
        return (symbols, prices, decimals, timestamp);
    }

    /**
     * @notice Get prices for specific cryptocurrencies by symbols
     * @param symbols Array of cryptocurrency symbols
     * @return prices Array of USD prices
     * @return decimalsArray Array of decimal places
     * @return timestamp The timestamp of the price data
     */
    function getPricesBySymbols(string[] memory symbols) 
        external 
        view 
        returns (
            uint256[] memory prices,
            int8[] memory decimalsArray,
            uint64 timestamp
        ) 
    {
        bytes21[] memory requestedFeedIds = new bytes21[](symbols.length);
        
        // Convert symbols to feed IDs
        for (uint256 i = 0; i < symbols.length; i++) {
            bytes21 feedId = symbolToFeedId[symbols[i]];
            require(feedId != bytes21(0), string(abi.encodePacked("Unsupported symbol: ", symbols[i])));
            requestedFeedIds[i] = feedId;
        }
        
        // Get prices from FTSO
        IFtsoV2 ftsoV2 = IContractRegistry(CONTRACT_REGISTRY).getFtsoV2();
        (prices, decimalsArray, timestamp) = ftsoV2.getFeedsById(requestedFeedIds);
        
        return (prices, decimalsArray, timestamp);
    }

    /**
     * @notice Calculate USD value for a given amount of cryptocurrency
     * @param symbol The cryptocurrency symbol
     * @param amount The amount of cryptocurrency (in its smallest unit)
     * @param tokenDecimals The number of decimals for the token
     * @return usdValue The calculated USD value
     * @return priceUsed The price used for calculation
     * @return timestamp The timestamp of the price data
     */
    function calculateUSDValue(
        string memory symbol, 
        uint256 amount, 
        uint8 tokenDecimals
    ) 
        external 
        view 
        returns (uint256 usdValue, uint256 priceUsed, uint64 timestamp) 
    {
        (uint256 price, int8 priceDecimals, uint64 priceTimestamp) = this.getPrice(symbol);
        
        // Calculate USD value: (amount / 10^tokenDecimals) * (price / 10^priceDecimals)
        // Rearranged to: (amount * price) / (10^tokenDecimals * 10^priceDecimals)
        usdValue = (amount * price) / (10 ** tokenDecimals * 10 ** uint8(int8(priceDecimals)));
        
        return (usdValue, price, priceTimestamp);
    }

    /**
     * @notice Check if a symbol is supported
     * @param symbol The cryptocurrency symbol to check
     * @return supported True if the symbol is supported
     */
    function isSymbolSupported(string memory symbol) external view returns (bool supported) {
        return symbolToFeedId[symbol] != bytes21(0);
    }

    /**
     * @notice Get all supported symbols
     * @return symbols Array of all supported cryptocurrency symbols
     */
    function getSupportedSymbols() external view returns (string[] memory symbols) {
        symbols = new string[](feedIds.length);
        for (uint256 i = 0; i < feedIds.length; i++) {
            symbols[i] = feedIdToSymbol[feedIds[i]];
        }
        return symbols;
    }

    /**
     * @notice Get the feed ID for a symbol
     * @param symbol The cryptocurrency symbol
     * @return feedId The corresponding feed ID
     */
    function getFeedId(string memory symbol) external view returns (bytes21 feedId) {
        return symbolToFeedId[symbol];
    }
} 