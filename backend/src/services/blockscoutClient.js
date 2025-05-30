const axios = require('axios');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');

class BlockscoutClient {
  constructor() {
    this.baseURL = process.env.BLOCKSCOUT_BASE_URL || 'https://eth.blockscout.com';
    this.apiKey = process.env.BLOCKSCOUT_API_KEY;
    this.client = null;
    this.initialized = false;
  }

  initialize() {
    if (this.initialized) return;

    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey && { Authorization: `Bearer ${this.apiKey}` }),
      },
    });

    this.initialized = true;
  }

  async getTransactionInfo(txid) {
    this.initialize();

    try {
      logger.info(`Fetching transaction info for txid: ${txid}`);

      const response = await this.client.get('/api', {
        params: {
          module: 'transaction',
          action: 'gettxinfo',
          txhash: txid,
        },
      });

      if (response.data.status !== '1') {
        throw new AppError(`Transaction not found: ${txid}`, 404);
      }

      const txData = response.data.result;
      const normalizedTx = this.normalizeTransactionData(txData);

      // Check if this is a token transfer and enhance with token data
      if (this.isTokenTransfer(normalizedTx)) {
        logger.info(`Detected token transfer, fetching token details for ${txid}`);
        const tokenData = await this.getTokenTransferDetails(txid, normalizedTx.from);
        if (tokenData) {
          normalizedTx.tokenTransfer = tokenData;
          normalizedTx.type = 'token_transfer';
        }
      } else if (parseFloat(normalizedTx.value) > 0) {
        normalizedTx.type = 'eth_transfer';
      } else {
        normalizedTx.type = 'contract_interaction';
      }

      return normalizedTx;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      logger.error('Error fetching transaction info', {
        txid,
        error: error.message,
        response: error.response?.data,
      });

      throw new AppError('Failed to fetch transaction data', 500);
    }
  }

  /**
   * Get all transactions for a wallet address (comprehensive bulk fetching)
   * @param {string} address - Wallet address
   * @param {Object} options - Pagination and filtering options
   * @returns {Object} Complete transaction history with categorization
   */
  async getWalletTransactions(address, options = {}) {
    this.initialize();

    try {
      logger.info(`Fetching all transactions for wallet: ${address}`, { options });

      const {
        startBlock = 0,
        endBlock = 'latest',
        page = 1,
        offset = 100, // Max transactions per request
        sort = 'desc',
        includeTokens = true,
        includeInternal = true,
        includeFailed = false
      } = options;

      // Fetch all transaction types in parallel
      const [
        regularTxs,
        tokenTxs,
        internalTxs
      ] = await Promise.all([
        this.getRegularTransactions(address, { startBlock, endBlock, page, offset, sort, includeFailed }),
        includeTokens ? this.getTokenTransactions(address, { startBlock, endBlock, page, offset, sort }) : [],
        includeInternal ? this.getInternalTransactions(address, { startBlock, endBlock, page, offset, sort }) : []
      ]);

      // Combine and categorize all transactions
      const allTransactions = [
        ...regularTxs.map(tx => ({ ...tx, source: 'regular' })),
        ...tokenTxs.map(tx => ({ ...tx, source: 'token' })),
        ...internalTxs.map(tx => ({ ...tx, source: 'internal' }))
      ];

      // Sort by timestamp and remove duplicates
      const uniqueTransactions = this.deduplicateTransactions(allTransactions);
      const sortedTransactions = uniqueTransactions.sort((a, b) => 
        new Date(b.timestamp) - new Date(a.timestamp)
      );

      // Categorize transaction types for AI analysis
      const categorizedTransactions = await this.categorizeTransactions(sortedTransactions, address);

      logger.info(`Fetched ${categorizedTransactions.length} transactions for ${address}`, {
        regular: regularTxs.length,
        token: tokenTxs.length,
        internal: internalTxs.length,
        total: categorizedTransactions.length
      });

      return {
        address,
        totalTransactions: categorizedTransactions.length,
        transactions: categorizedTransactions,
        summary: this.generateTransactionSummary(categorizedTransactions, address)
      };

    } catch (error) {
      logger.error('Error fetching wallet transactions', {
        address,
        error: error.message,
        response: error.response?.data,
      });

      throw new AppError('Failed to fetch wallet transactions', 500);
    }
  }

  /**
   * Fetch regular ETH transactions for an address
   */
  async getRegularTransactions(address, options = {}) {
    const { startBlock, endBlock, page, offset, sort, includeFailed } = options;

    try {
      const response = await this.client.get('/api', {
        params: {
          module: 'account',
          action: 'txlist',
          address,
          startblock: startBlock,
          endblock: endBlock,
          page,
          offset,
          sort,
        },
      });

      if (response.data.status !== '1') {
        return [];
      }

      let transactions = response.data.result || [];
      
      // Filter out failed transactions if not requested
      if (!includeFailed) {
        transactions = transactions.filter(tx => tx.isError === '0');
      }

      return transactions.map(tx => this.normalizeTransactionData(tx));
    } catch (error) {
      logger.warn('Failed to fetch regular transactions', { address, error: error.message });
      return [];
    }
  }

  /**
   * Fetch token transactions for an address
   */
  async getTokenTransactions(address, options = {}) {
    const { startBlock, endBlock, page, offset, sort } = options;

    try {
      const response = await this.client.get('/api', {
        params: {
          module: 'account',
          action: 'tokentx',
          address,
          startblock: startBlock,
          endblock: endBlock,
          page,
          offset,
          sort,
        },
      });

      if (response.data.status !== '1') {
        return [];
      }

      return response.data.result.map(tx => this.normalizeTokenTransfer(tx));
    } catch (error) {
      logger.warn('Failed to fetch token transactions', { address, error: error.message });
      return [];
    }
  }

  /**
   * Fetch internal transactions for an address
   */
  async getInternalTransactions(address, options = {}) {
    const { startBlock, endBlock, page, offset, sort } = options;

    try {
      const response = await this.client.get('/api', {
        params: {
          module: 'account',
          action: 'txlistinternal',
          address,
          startblock: startBlock,
          endblock: endBlock,
          page,
          offset,
          sort,
        },
      });

      if (response.data.status !== '1') {
        return [];
      }

      return response.data.result.map(tx => this.normalizeInternalTransaction(tx));
    } catch (error) {
      logger.warn('Failed to fetch internal transactions', { address, error: error.message });
      return [];
    }
  }

  /**
   * Categorize transactions by type for better AI analysis
   */
  async categorizeTransactions(transactions, userAddress) {
    return transactions.map(tx => {
      const category = this.detectTransactionCategory(tx, userAddress);
      return {
        ...tx,
        category,
        direction: this.getTransactionDirection(tx, userAddress),
        isUserInitiated: tx.from && tx.from.toLowerCase() === userAddress.toLowerCase()
      };
    });
  }

  /**
   * Detect transaction category based on patterns and contract interactions
   */
  detectTransactionCategory(tx, userAddress) {
    const lowerAddress = userAddress.toLowerCase();
    const fromAddress = tx.from?.toLowerCase();
    const toAddress = tx.to?.toLowerCase();
    const input = tx.input || '';
    const value = parseFloat(tx.value || tx.actualAmount || 0);

    // Known contract patterns and addresses for categorization
    const contractPatterns = {
      // Staking patterns
      staking: [
        '0x00000000219ab540356cbb839cbe05303d7705fa', // ETH 2.0 Deposit Contract
        '0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0', // wstETH
        '0xae7ab96520de3a18e5e111b5eaab095312d7fe84', // stETH
      ],
      // DEX patterns (Uniswap, SushiSwap, etc.)
      dex: [
        '0x7a250d5630b4cf539739df2c5dacb4c659f2488d', // Uniswap V2 Router
        '0xe592427a0aece92de3edee1f18e0157c05861564', // Uniswap V3 Router
        '0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f', // SushiSwap Router
      ],
      // Lending protocols
      lending: [
        '0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9', // Aave Lending Pool
        '0x3d9819210a31b4961b30ef54be2aed79b9c9cd3b', // Compound cDAI
        '0x5d3a536e4d6dbd6114cc1ead35777bab948e3643', // Compound cDAI
      ],
      // NFT marketplaces
      nft: [
        '0x7be8076f4ea4a4ad08075c2508e481d6c946d12b', // OpenSea Registry
        '0x7f268357a8c2552623316e2562d90e642bb538e5', // OpenSea Exchange
      ],
    };

    // Check contract patterns
    for (const [type, addresses] of Object.entries(contractPatterns)) {
      if (addresses.some(addr => addr === toAddress)) {
        return type;
      }
    }

    // Function signature analysis
    if (input.length > 10) {
      const functionSig = input.slice(0, 10);
      
      switch (functionSig) {
        case '0xa9059cbb': // ERC-20 transfer
          return 'token_transfer';
        case '0x23b872dd': // ERC-20 transferFrom
          return 'token_transfer';
        case '0x095ea7b3': // ERC-20 approve
          return 'token_approval';
        case '0x7ff36ab5': // Uniswap swapExactETHForTokens
        case '0x18cbafe5': // Uniswap swapExactTokensForETH
        case '0x8803dbee': // Uniswap swapTokensForExactTokens
          return 'dex_trade';
        case '0xf305d719': // Uniswap addLiquidityETH
        case '0xe8e33700': // Uniswap addLiquidity
          return 'liquidity_provision';
        case '0x02751cec': // Uniswap removeLiquidity
        case '0xaf2979eb': // Uniswap removeLiquidityETH
          return 'liquidity_removal';
        default:
          return 'contract_interaction';
      }
    }

    // Value-based categorization
    if (value > 0) {
      if (fromAddress === lowerAddress) {
        return 'outgoing_transfer';
      } else if (toAddress === lowerAddress) {
        return 'incoming_transfer';
      }
    }

    // Token-based categorization
    if (tx.tokenSymbol) {
      if (fromAddress === lowerAddress) {
        return 'token_sent';
      } else if (toAddress === lowerAddress) {
        return 'token_received';
      }
    }

    return 'unknown';
  }

  /**
   * Determine transaction direction (incoming/outgoing)
   */
  getTransactionDirection(tx, userAddress) {
    const lowerAddress = userAddress.toLowerCase();
    const fromAddress = tx.from?.toLowerCase();
    const toAddress = tx.to?.toLowerCase();

    if (fromAddress === lowerAddress && toAddress === lowerAddress) {
      return 'self';
    } else if (fromAddress === lowerAddress) {
      return 'outgoing';
    } else if (toAddress === lowerAddress) {
      return 'incoming';
    } else {
      return 'internal'; // Internal transaction where user address is involved
    }
  }

  /**
   * Remove duplicate transactions (same hash from different sources)
   */
  deduplicateTransactions(transactions) {
    const seen = new Set();
    return transactions.filter(tx => {
      const key = tx.hash || tx.transactionHash;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * Generate summary statistics for transactions
   */
  generateTransactionSummary(transactions, userAddress) {
    const summary = {
      totalTransactions: transactions.length,
      categories: {},
      directions: {},
      tokens: {},
      timeRange: {},
      volume: {
        eth: { incoming: 0, outgoing: 0 },
        tokens: {}
      }
    };

    // Count categories
    transactions.forEach(tx => {
      summary.categories[tx.category] = (summary.categories[tx.category] || 0) + 1;
      summary.directions[tx.direction] = (summary.directions[tx.direction] || 0) + 1;

      // Token statistics
      if (tx.tokenSymbol) {
        summary.tokens[tx.tokenSymbol] = (summary.tokens[tx.tokenSymbol] || 0) + 1;
      }

      // Volume calculations
      if (tx.direction === 'incoming' && tx.value) {
        summary.volume.eth.incoming += parseFloat(tx.value) / Math.pow(10, 18);
      } else if (tx.direction === 'outgoing' && tx.value) {
        summary.volume.eth.outgoing += parseFloat(tx.value) / Math.pow(10, 18);
      }

      if (tx.tokenSymbol && tx.actualAmount) {
        if (!summary.volume.tokens[tx.tokenSymbol]) {
          summary.volume.tokens[tx.tokenSymbol] = { incoming: 0, outgoing: 0 };
        }
        if (tx.direction === 'incoming') {
          summary.volume.tokens[tx.tokenSymbol].incoming += parseFloat(tx.actualAmount);
        } else if (tx.direction === 'outgoing') {
          summary.volume.tokens[tx.tokenSymbol].outgoing += parseFloat(tx.actualAmount);
        }
      }
    });

    // Time range
    if (transactions.length > 0) {
      const timestamps = transactions.map(tx => new Date(tx.timestamp)).filter(d => !isNaN(d));
      if (timestamps.length > 0) {
        summary.timeRange.earliest = new Date(Math.min(...timestamps));
        summary.timeRange.latest = new Date(Math.max(...timestamps));
      }
    }

    return summary;
  }

  isTokenTransfer(txData) {
    return (
      txData.value === '0' && 
      txData.input && 
      txData.input.length > 10 &&
      txData.input.startsWith('0xa9059cbb') // ERC-20 transfer function signature
    );
  }

  async getTokenTransferDetails(txHash, fromAddress) {
    try {
      // Get token transfers for the sender address around the transaction block
      const response = await this.client.get('/api', {
        params: {
          module: 'account',
          action: 'tokentx',
          address: fromAddress,
          sort: 'desc',
        },
      });

      if (response.data.status !== '1') {
        return null;
      }

      // Find the specific transaction
      const tokenTransfer = response.data.result.find(
        transfer => transfer.hash.toLowerCase() === txHash.toLowerCase()
      );

      if (tokenTransfer) {
        return this.normalizeTokenTransfer(tokenTransfer);
      }

      return null;
    } catch (error) {
      logger.warn('Failed to fetch token transfer details', {
        txHash,
        fromAddress,
        error: error.message,
      });
      return null;
    }
  }

  async getTokenTransfers(address, startBlock = 0, endBlock = 'latest') {
    this.initialize();

    try {
      logger.info(`Fetching token transfers for address: ${address}`);

      const response = await this.client.get('/api', {
        params: {
          module: 'account',
          action: 'tokentx',
          address,
          startblock: startBlock,
          endblock: endBlock,
          sort: 'desc',
        },
      });

      if (response.data.status !== '1') {
        return [];
      }

      return response.data.result.map(transfer => this.normalizeTokenTransfer(transfer));
    } catch (error) {
      logger.error('Error fetching token transfers', {
        address,
        error: error.message,
        response: error.response?.data,
      });

      throw new AppError('Failed to fetch token transfers', 500);
    }
  }

  normalizeTransactionData(txData) {
    return {
      hash: txData.hash,
      from: txData.from,
      to: txData.to,
      value: txData.value,
      gasUsed: txData.gasUsed,
      gasPrice: txData.gasPrice,
      blockNumber: txData.blockNumber,
      timestamp: new Date(parseInt(txData.timeStamp) * 1000),
      status: txData.success ? 'success' : 'failed',
      input: txData.input,
      nonce: txData.nonce,
      transactionIndex: txData.transactionIndex,
      confirmations: txData.confirmations,
      logs: txData.logs,
    };
  }

  normalizeTokenTransfer(transfer) {
    const decimals = parseInt(transfer.tokenDecimal) || 18;
    const rawAmount = transfer.value;
    const actualAmount = parseFloat(rawAmount) / Math.pow(10, decimals);

    return {
      hash: transfer.hash,
      from: transfer.from,
      to: transfer.to,
      value: rawAmount,
      actualAmount: actualAmount,
      tokenName: transfer.tokenName,
      tokenSymbol: transfer.tokenSymbol,
      tokenDecimal: decimals,
      contractAddress: transfer.contractAddress,
      blockNumber: transfer.blockNumber,
      timestamp: new Date(parseInt(transfer.timeStamp) * 1000),
      gasUsed: transfer.gasUsed,
      gasPrice: transfer.gasPrice,
    };
  }

  /**
   * Normalize internal transactions
   */
  normalizeInternalTransaction(tx) {
    return {
      hash: tx.hash,
      from: tx.from,
      to: tx.to,
      value: tx.value,
      blockNumber: tx.blockNumber,
      timestamp: new Date(parseInt(tx.timeStamp) * 1000),
      type: tx.type || 'call',
      traceId: tx.traceId,
      isError: tx.isError === '1',
    };
  }

  async getAccountBalance(address) {
    this.initialize();

    try {
      logger.info(`Fetching account balance for address: ${address}`);

      const response = await this.client.get('/api', {
        params: {
          module: 'account',
          action: 'balance',
          address,
        },
      });

      if (response.data.status !== '1') {
        throw new AppError(`Failed to get balance for address: ${address}`, 404);
      }

      return {
        address,
        balance: response.data.result,
        balanceEth: (parseInt(response.data.result) / Math.pow(10, 18)).toString(),
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      logger.error('Error fetching account balance', {
        address,
        error: error.message,
        response: error.response?.data,
      });

      throw new AppError('Failed to fetch account balance', 500);
    }
  }
}

module.exports = new BlockscoutClient();
