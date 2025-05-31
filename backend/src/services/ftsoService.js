const { ethers } = require('ethers');
const logger = require('../utils/logger');

/**
 * Real FTSO Service using our deployed FtsoPriceConsumer contract
 * Contract address: 0xEc8F86Ffa44FD994A0Fa1971D606e1F37f2d43D2
 */
class FTSOService {
  constructor() {
    this.provider = null;
    this.contract = null;
    this.contractAddress = process.env.FTSO_PRICE_CONSUMER_ADDRESS || '0xEc8F86Ffa44FD994A0Fa1971D606e1F37f2d43D2';
    this.enabled = process.env.FTSO_PRICE_CONSUMER_ENABLED === 'true';
    this.priceCache = new Map();
    this.cacheTimeout = parseInt(process.env.PRICE_FEED_CACHE_TTL) || 60000; // 1 minute default
    
    // Contract ABI - only the methods we need from FtsoPriceConsumer.sol
    this.contractABI = [
      {
        "inputs": [{"internalType": "string", "name": "symbol", "type": "string"}],
        "name": "getPrice",
        "outputs": [
          {"internalType": "uint256", "name": "price", "type": "uint256"},
          {"internalType": "int8", "name": "decimals", "type": "int8"},
          {"internalType": "uint64", "name": "timestamp", "type": "uint64"}
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [],
        "name": "getAllPrices",
        "outputs": [
          {"internalType": "string[]", "name": "symbols", "type": "string[]"},
          {"internalType": "uint256[]", "name": "prices", "type": "uint256[]"},
          {"internalType": "int8[]", "name": "decimals", "type": "int8[]"},
          {"internalType": "uint64", "name": "timestamp", "type": "uint64"}
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [{"internalType": "string", "name": "symbol", "type": "string"}],
        "name": "isSymbolSupported",
        "outputs": [{"internalType": "bool", "name": "supported", "type": "bool"}],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [],
        "name": "getSupportedSymbols",
        "outputs": [{"internalType": "string[]", "name": "symbols", "type": "string[]"}],
        "stateMutability": "view",
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
          {"internalType": "uint256", "name": "priceUsed", "type": "uint256"},
          {"internalType": "uint64", "name": "timestamp", "type": "uint64"}
        ],
        "stateMutability": "view",
        "type": "function"
      }
    ];

    // Mock prices only for custom tokens not supported by FTSO
    // Temporarily use mock for all tokens until contract issues are resolved
    this.mockPrices = {
      'FLR': 0.032,
      'BTC': 95423.50,
      'ETH': 3402.25,
      'USDC': 1.0,
      'USDT': 1.0,
      'AVAX': 42.85,
      'MATIC': 0.58,
      'ADA': 0.89,
      'DOT': 7.43,
      'LTC': 98.67,
      'XYD': 0.05,
      'C2FLR': 0.015,
    };

    this.initializeProvider();
  }

  /**
   * Initialize the provider and contract
   */
  async initializeProvider() {
    try {
      if (!this.enabled) {
        logger.info('FTSO Service is disabled', {
          enabled: this.enabled,
        });
        return;
      }

      const rpcUrl = process.env.FLARE_RPC_URL || 'https://flare-api.flare.network/ext/C/rpc';
      this.provider = new ethers.JsonRpcProvider(rpcUrl);

      // Initialize contract
      this.contract = new ethers.Contract(
        this.contractAddress,
        this.contractABI,
        this.provider
      );

      // Test contract connectivity
      const supportedSymbols = await this.contract.getSupportedSymbols();
      
      logger.info('Real FTSO Service initialized successfully', {
        contractAddress: this.contractAddress,
        rpcUrl,
        supportedSymbols,
        chainId: process.env.FLARE_CHAIN_ID || '14',
        mode: 'real-ftso-contract',
      });
    } catch (error) {
      logger.error('Failed to initialize FTSO Service', {
        error: error.message,
        contractAddress: this.contractAddress,
      });
      this.enabled = false;
    }
  }

  /**
   * Check if the service is available and enabled
   */
  isAvailable() {
    return this.enabled && this.contract !== null;
  }

  /**
   * Get USD price for a single cryptocurrency from FTSO
   * @param {string} symbol - The cryptocurrency symbol (e.g., 'BTC', 'ETH', 'FLR')
   * @returns {Object} Price data with USD value, decimals, and timestamp
   */
  async getPrice(symbol) {
    try {
      if (!this.isAvailable()) {
        logger.warn('FTSO Service not available, using mock prices', { symbol });
        return this.getMockPrice(symbol);
      }

      // Normalize symbol
      const normalizedSymbol = symbol.toUpperCase();
      
      // Handle custom token mapping
      let querySymbol = normalizedSymbol;
      if (normalizedSymbol === 'C2FLR') {
        querySymbol = 'FLR'; // Map Coston2 FLR to mainnet FLR
      }

      // Check cache first
      const cacheKey = `ftso_price_${normalizedSymbol}`;
      const cached = this.priceCache.get(cacheKey);
      
      if (cached && (Date.now() - cached.fetchedAt) < this.cacheTimeout) {
        logger.debug('Price returned from cache', { symbol: normalizedSymbol, cacheAge: Date.now() - cached.fetchedAt });
        return cached.data;
      }

      logger.info('Attempting to fetch price from FTSO contract', { 
        symbol: normalizedSymbol,
        querySymbol,
        contractAddress: this.contractAddress,
      });

      try {
        // Try to get price from our deployed contract
        const [price, decimals, timestamp] = await this.contract.getPrice(querySymbol);
        
        // Convert price to USD (handle decimals)
        const usdPrice = Number(price) / Math.pow(10, Math.abs(Number(decimals)));
        
        const priceData = {
          symbol: normalizedSymbol,
          price: Number(price),
          decimals: Number(decimals),
          timestamp: Number(timestamp),
          usdPrice: usdPrice,
          lastUpdated: new Date(Number(timestamp) * 1000).toISOString(),
          source: 'ftso-contract',
          contractAddress: this.contractAddress,
        };

        // Cache the result
        this.priceCache.set(cacheKey, {
          data: priceData,
          fetchedAt: Date.now(),
        });

        logger.info('Price fetched successfully from FTSO contract', {
          symbol: normalizedSymbol,
          usdPrice: priceData.usdPrice,
          timestamp: priceData.lastUpdated,
          source: priceData.source,
        });

        return priceData;
      } catch (contractError) {
        logger.warn('FTSO contract call failed, falling back to mock prices', {
          symbol: normalizedSymbol,
          error: contractError.message,
          contractAddress: this.contractAddress,
        });
        
        // Fallback to mock prices if contract call fails
        return this.getMockPrice(normalizedSymbol);
      }
    } catch (error) {
      logger.error('Failed to get price', {
        symbol,
        error: error.message,
      });
      
      // Final fallback to mock prices
      return this.getMockPrice(symbol.toUpperCase());
    }
  }

  /**
   * Get mock price for any token (fallback when FTSO contract fails)
   */
  getMockPrice(symbol) {
    const normalizedSymbol = symbol.toUpperCase();
    const mockPrice = this.mockPrices[normalizedSymbol];
    
    if (!mockPrice) {
      throw new Error(`No mock price available for symbol: ${symbol}`);
    }
    
    return {
      symbol: normalizedSymbol,
      price: Math.round(mockPrice * 1e8), // Convert to 8 decimal format
      decimals: -8,
      timestamp: Math.floor(Date.now() / 1000),
      usdPrice: mockPrice,
      lastUpdated: new Date().toISOString(),
      source: 'mock-fallback',
    };
  }

  /**
   * Get USD prices for multiple cryptocurrencies
   * @param {string[]} symbols - Array of cryptocurrency symbols
   * @returns {Object[]} Array of price data objects
   */
  async getPrices(symbols) {
    try {
      if (!this.isAvailable()) {
        throw new Error('FTSO Service not available');
      }

      const prices = [];
      const errors = [];

      // For now, fetch prices sequentially to avoid overwhelming the contract
      // TODO: Use contract's getPricesBySymbols for batch operations
      for (const symbol of symbols) {
        try {
          const priceData = await this.getPrice(symbol);
          prices.push(priceData);
        } catch (error) {
          errors.push({ symbol, error: error.message });
          logger.warn('Failed to get price in batch from FTSO', { symbol, error: error.message });
        }
      }

      logger.info('Batch prices fetched from FTSO', {
        requested: symbols.length,
        successful: prices.length,
        failed: errors.length,
      });

      if (prices.length === 0) {
        throw new Error(`Failed to fetch prices for all symbols: ${errors.map(e => `${e.symbol}: ${e.error}`).join(', ')}`);
      }

      return prices;
    } catch (error) {
      logger.error('Failed to get batch prices from FTSO', {
        symbols,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Calculate USD value for a given amount of cryptocurrency
   * @param {string} symbol - The cryptocurrency symbol
   * @param {string|number} amount - The amount in token units
   * @returns {Object} USD value calculation result
   */
  async calculateUSDValue(symbol, amount) {
    try {
      if (!this.isAvailable()) {
        throw new Error('FTSO Service not available');
      }

      // Get current price
      const priceData = await this.getPrice(symbol);
      
      // Calculate USD value
      const tokenAmount = Number(amount);
      const usdValue = tokenAmount * priceData.usdPrice;

      const calculationResult = {
        symbol: symbol.toUpperCase(),
        tokenAmount: tokenAmount,
        usdValue: usdValue,
        usdValueFormatted: usdValue.toFixed(2),
        priceUsed: priceData.usdPrice,
        priceTimestamp: priceData.timestamp,
        lastUpdated: priceData.lastUpdated,
        source: priceData.source,
      };

      logger.info('USD value calculated successfully via FTSO', {
        symbol,
        tokenAmount: tokenAmount,
        usdValue: calculationResult.usdValueFormatted,
        priceUsed: priceData.usdPrice,
        source: priceData.source,
      });

      return calculationResult;
    } catch (error) {
      logger.error('Failed to calculate USD value via FTSO', {
        symbol,
        amount,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Check if a cryptocurrency symbol is supported
   * @param {string} symbol - The cryptocurrency symbol to check
   * @returns {boolean} True if supported
   */
  async isSymbolSupported(symbol) {
    try {
      const normalizedSymbol = symbol.toUpperCase();
      
      // Check mock prices first - these are always available
      if (this.mockPrices[normalizedSymbol]) {
        return true;
      }

      if (!this.isAvailable()) {
        return false;
      }

      // Map C2FLR to FLR for mainnet
      const querySymbol = normalizedSymbol === 'C2FLR' ? 'FLR' : normalizedSymbol;
      
      try {
        return await this.contract.isSymbolSupported(querySymbol);
      } catch (contractError) {
        logger.warn('Failed to check symbol support via contract, checking mock prices', { 
          symbol, 
          error: contractError.message 
        });
        return false;
      }
    } catch (error) {
      logger.warn('Failed to check symbol support', { symbol, error: error.message });
      return false;
    }
  }

  /**
   * Get all supported cryptocurrency symbols
   * @returns {string[]} Array of supported symbols
   */
  async getSupportedSymbols() {
    try {
      if (!this.isAvailable()) {
        return Object.keys(this.mockPrices);
      }

      const ftsoSymbols = await this.contract.getSupportedSymbols();
      const customSymbols = Object.keys(this.mockPrices);
      
      // Combine FTSO supported symbols with custom tokens
      const allSymbols = [...ftsoSymbols, ...customSymbols];
      
      // Remove duplicates and return
      return [...new Set(allSymbols)];
    } catch (error) {
      logger.error('Failed to get supported symbols from FTSO', { error: error.message });
      return Object.keys(this.mockPrices);
    }
  }

  /**
   * Get price for journal entry enhancement
   * @param {string} currency - The currency symbol
   * @param {number} amount - The amount in the currency
   * @returns {Object} Enhanced price data for journal entries
   */
  async getPriceForJournalEntry(currency, amount) {
    try {
      // Check if symbol is supported
      const isSupported = await this.isSymbolSupported(currency);
      if (!isSupported) {
        logger.warn('Currency not supported by FTSO Service', { currency });
        return {
          currency,
          amount,
          usdValue: null,
          priceData: null,
          supported: false,
          source: 'ftso-real',
        };
      }

      // Get current price
      const priceData = await this.getPrice(currency);
      
      // Calculate USD value
      const usdValue = Number(amount) * priceData.usdPrice;

      return {
        currency,
        amount,
        usdValue,
        usdValueFormatted: usdValue.toFixed(2),
        priceData,
        supported: true,
        source: 'ftso-real',
        enhancedNarrative: `${amount} ${currency} (${usdValue.toFixed(2)} USD at $${priceData.usdPrice.toFixed(4)}/${currency} via ${priceData.source})`,
      };
    } catch (error) {
      logger.error('Failed to get price for journal entry via FTSO', {
        currency,
        amount,
        error: error.message,
      });
      
      return {
        currency,
        amount,
        usdValue: null,
        priceData: null,
        supported: false,
        error: error.message,
        source: 'ftso-real',
      };
    }
  }

  /**
   * Clear the price cache
   */
  clearCache() {
    this.priceCache.clear();
    logger.info('FTSO price cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.priceCache.size,
      timeout: this.cacheTimeout,
      entries: Array.from(this.priceCache.keys()),
    };
  }
}

// Export singleton instance
module.exports = new FTSOService(); 