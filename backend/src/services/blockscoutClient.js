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

      // Use v2 API format for Coston2 Blockscout
      const response = await this.client.get(`/api/v2/transactions/${txid}`);

      const txData = response.data;
      const normalizedTx = this.normalizeTransactionData(txData);

      // Determine transaction type based on the normalized data
      if (normalizedTx.isTokenTransfer) {
        normalizedTx.type = 'token_transfer';
        logger.info(`Detected token transfer: ${normalizedTx.tokenTransfer?.tokenAmount} ${normalizedTx.tokenTransfer?.tokenSymbol}`);
      } else if (parseFloat(normalizedTx.value) > 0) {
        normalizedTx.type = 'native_transfer';
      } else {
        normalizedTx.type = 'contract_interaction';
      }

      return normalizedTx;
    } catch (error) {
      if (error.response?.status === 404) {
        throw new AppError(`Transaction not found: ${txid}`, 404);
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
      // Use v2 API format: /api/v2/addresses/{address}/transactions
      const response = await this.client.get(`/api/v2/addresses/${address}/transactions`, {
        params: {
          filter: 'to|from', // Get both incoming and outgoing transactions
          type: 'transaction', // Regular transactions only
          page,
          limit: offset,
        },
      });

      let transactions = response.data.items || [];
      
      // Filter out failed transactions if not requested
      if (!includeFailed) {
        transactions = transactions.filter(tx => tx.status === 'ok');
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
      // Use v2 API format: /api/v2/addresses/{address}/token-transfers
      const response = await this.client.get(`/api/v2/addresses/${address}/token-transfers`, {
        params: {
          type: 'ERC-20,ERC-721,ERC-1155', // All token types
          page,
          limit: offset,
        },
      });

      const transfers = response.data.items || [];
      return transfers.map(tx => this.normalizeTokenTransfer(tx));
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
      // Use v2 API format: /api/v2/addresses/{address}/internal-transactions
      const response = await this.client.get(`/api/v2/addresses/${address}/internal-transactions`, {
        params: {
          page,
          limit: offset,
        },
      });

      const internalTxs = response.data.items || [];
      return internalTxs.map(tx => this.normalizeInternalTransaction(tx));
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
      const direction = this.getTransactionDirection(tx, userAddress);
      
      // For token transfers, override actualAmount and currency with token data
      let finalAmount = tx.actualAmount;
      let currency = tx.networkCurrency || 'ETH';
      let tokenSymbol = null;
      
      if (tx.isTokenTransfer && tx.tokenTransfer) {
        finalAmount = tx.tokenTransfer.tokenAmount;
        currency = tx.tokenTransfer.tokenSymbol;
        tokenSymbol = tx.tokenTransfer.tokenSymbol;
      } else if (tx.tokenSymbol) {
        // Legacy token detection
        finalAmount = tx.actualAmount;
        currency = tx.tokenSymbol;
        tokenSymbol = tx.tokenSymbol;
      }
      
      return {
        ...tx,
        category,
        direction,
        isUserInitiated: tx.from && tx.from.toLowerCase() === userAddress.toLowerCase(),
        // Override amount and currency for display
        actualAmount: finalAmount,
        currency: currency,
        tokenSymbol: tokenSymbol,
        // Keep original values for reference
        nativeAmount: tx.actualAmount,
        nativeCurrency: tx.networkCurrency || 'ETH',
        gasFee: tx.gasFee,
        gasCurrency: tx.networkCurrency || 'ETH'
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
    const value = parseFloat(tx.actualAmount || tx.value || 0);

    // PRIORITY 1: Check if this transaction has token transfer data
    if (tx.isTokenTransfer && tx.tokenTransfer) {
      const tokenFromAddress = tx.tokenTransfer.from?.toLowerCase();
      const tokenToAddress = tx.tokenTransfer.to?.toLowerCase();
      
      if (tokenFromAddress === lowerAddress) {
        return 'token_transfer'; // User sent tokens
      } else if (tokenToAddress === lowerAddress) {
        return 'token_received'; // User received tokens
      } else {
        return 'token_transfer'; // Token transfer involving user
      }
    }

    // PRIORITY 2: Legacy token detection for compatibility
    if (tx.tokenSymbol && tx.actualAmount !== undefined) {
      if (fromAddress === lowerAddress) {
        return 'token_transfer'; // User sent tokens
      } else if (toAddress === lowerAddress) {
        return 'token_received'; // User received tokens
      } else {
        return 'token_transfer'; // Token transfer involving user
      }
    }

    // PRIORITY 3: Check for token transfer patterns in transaction data
    if (input.length > 10) {
      const functionSig = input.slice(0, 10);
      
      switch (functionSig) {
        case '0xa9059cbb': // ERC-20 transfer
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
          // Continue to other checks
          break;
      }
    }

    // PRIORITY 4: Known contract patterns and addresses for categorization
    const contractPatterns = {
      // Staking patterns
      staking: [
        '0x00000000219ab540356cbb839cbe05303d7705fa', // ETH 2.0 Deposit Contract
        '0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0', // wstETH
        '0xae7ab96520de3a18e5e111b5eaab095312d7fe84', // stETH
      ],
      // DEX patterns (Uniswap, SushiSwap, etc.)
      dex_trade: [
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

    // PRIORITY 5: Value-based categorization for native currency transfers
    // Only categorize as native transfer if there's meaningful value (> gas fees)
    // Use the network currency for proper thresholds
    const isCoston2 = tx.networkCurrency === 'C2FLR';
    const minTransferThreshold = isCoston2 ? 0.1 : 0.01; // Higher threshold for C2FLR since it's testnet
    
    if (value > minTransferThreshold) {
      if (fromAddress === lowerAddress) {
        return 'outgoing_transfer';
      } else if (toAddress === lowerAddress) {
        return 'incoming_transfer';
      }
    }

    // PRIORITY 6: Contract interaction with small native value
    if (input && input.length > 10 && value <= minTransferThreshold) {
      return 'contract_interaction';
    }

    // PRIORITY 7: Small native value transactions (likely gas fees or minimal transfers)
    if (value > 0 && value <= minTransferThreshold) {
      if (fromAddress === lowerAddress) {
        return 'outgoing_transfer';
      } else if (toAddress === lowerAddress) {
        return 'incoming_transfer';
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
   * Remove duplicate transactions and merge token transfer data with regular transaction data
   */
  deduplicateTransactions(transactions) {
    const mergedTransactions = new Map();
    
    transactions.forEach(tx => {
      const hash = tx.hash || tx.transactionHash;
      
      if (mergedTransactions.has(hash)) {
        // Merge token data with existing transaction
        const existing = mergedTransactions.get(hash);
        
        // If this is a token transaction and the existing one isn't, merge token data
        if (tx.tokenSymbol && !existing.tokenSymbol) {
          mergedTransactions.set(hash, {
            ...existing,
            // Add token information
            tokenName: tx.tokenName,
            tokenSymbol: tx.tokenSymbol,
            tokenDecimal: tx.tokenDecimal,
            contractAddress: tx.contractAddress,
            // Override actualAmount with token amount for token transfers
            actualAmount: tx.actualAmount,
            // Keep both values for reference
            tokenValue: tx.value,
            ethValue: existing.value,
            // Mark as token transfer
            isTokenTransfer: true,
            source: `${existing.source || 'regular'},token`
          });
        }
        // If existing is token and this is regular, merge the other way
        else if (!tx.tokenSymbol && existing.tokenSymbol) {
          mergedTransactions.set(hash, {
            ...existing,
            // Add regular transaction data that might be missing
            input: tx.input || existing.input,
            gasUsed: tx.gasUsed || existing.gasUsed,
            gasPrice: tx.gasPrice || existing.gasPrice,
            nonce: tx.nonce || existing.nonce,
            // Keep the token data as primary
            ethValue: tx.value,
            tokenValue: existing.value,
            isTokenTransfer: true,
            source: `${tx.source || 'regular'},token`
          });
        }
        // If both have token data, prefer the one with more complete information
        else if (tx.tokenSymbol && existing.tokenSymbol) {
          // Keep the one with more token information or higher actualAmount
          if ((tx.actualAmount || 0) > (existing.actualAmount || 0)) {
            mergedTransactions.set(hash, {
              ...existing,
              ...tx,
              source: `${existing.source || 'token'},${tx.source || 'token'}`
            });
          }
        }
        // For non-token duplicates, keep the one with more complete data
        else {
          const merged = {
            ...existing,
            ...tx,
            // Preserve important fields from both
            input: tx.input || existing.input,
            gasUsed: tx.gasUsed || existing.gasUsed,
            gasPrice: tx.gasPrice || existing.gasPrice,
            source: `${existing.source || 'regular'},${tx.source || 'regular'}`
          };
          mergedTransactions.set(hash, merged);
        }
      } else {
        // First occurrence of this transaction
        const normalizedTx = {
          ...tx,
          isTokenTransfer: !!tx.tokenSymbol,
          ethValue: tx.tokenSymbol ? '0' : tx.value, // If token transfer, ETH value is likely just gas
          tokenValue: tx.tokenSymbol ? tx.value : null
        };
        mergedTransactions.set(hash, normalizedTx);
      }
    });
    
    return Array.from(mergedTransactions.values());
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
      // Use v2 API format: get transaction details directly
      const response = await this.client.get(`/api/v2/transactions/${txHash}/token-transfers`);

      const tokenTransfers = response.data.items || [];
      
      // Find the transfer that matches our criteria
      const tokenTransfer = tokenTransfers.find(
        transfer => (transfer.from?.hash || transfer.from)?.toLowerCase() === fromAddress.toLowerCase()
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

      // Use v2 API format: /api/v2/addresses/{address}/token-transfers
      const response = await this.client.get(`/api/v2/addresses/${address}/token-transfers`, {
        params: {
          type: 'ERC-20,ERC-721,ERC-1155',
        },
      });

      const transfers = response.data.items || [];
      return transfers.map(transfer => this.normalizeTokenTransfer(transfer));
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
    // Convert Wei to native currency (C2FLR for Coston2, ETH for Ethereum)
    const rawValue = txData.value?.value || txData.value || '0';
    const actualValue = parseFloat(rawValue) / Math.pow(10, 18); // Convert Wei to native currency
    
    // Calculate gas fee properly
    const gasUsed = parseInt(txData.gas_used || txData.gasUsed || 0);
    const gasPrice = parseInt(txData.gas_price || txData.gasPrice || 0);
    const gasFeeWei = gasUsed * gasPrice;
    const gasFeeNative = gasFeeWei / Math.pow(10, 18); // Convert to native currency
    
    // Determine network currency based on base URL
    const isCoston2 = this.baseURL.includes('coston2');
    const networkCurrency = isCoston2 ? 'C2FLR' : 'ETH';
    
    // Process token transfers if present
    let tokenTransferData = null;
    if (txData.token_transfers && txData.token_transfers.length > 0) {
      const transfer = txData.token_transfers[0]; // Get first token transfer
      const decimals = parseInt(transfer.token?.decimals || 18);
      const tokenAmount = parseFloat(transfer.total?.value || 0) / Math.pow(10, decimals);
      
      tokenTransferData = {
        tokenSymbol: transfer.token?.symbol,
        tokenName: transfer.token?.name,
        tokenAmount: tokenAmount,
        tokenContract: transfer.token?.address,
        from: transfer.from?.hash,
        to: transfer.to?.hash
      };
    }

    return {
      hash: txData.hash,
      from: txData.from?.hash || txData.from,
      to: txData.to?.hash || txData.to,
      value: rawValue, // Keep raw Wei value for reference
      actualAmount: actualValue, // Converted native currency value
      gasUsed: gasUsed,
      gasPrice: gasPrice,
      gasFee: gasFeeNative, // Calculated gas fee in native currency
      gasFeeWei: gasFeeWei, // Raw gas fee in Wei
      networkCurrency: networkCurrency, // C2FLR or ETH
      blockNumber: txData.block_number || txData.blockNumber,
      timestamp: new Date(txData.timestamp || parseInt(txData.timeStamp) * 1000),
      status: txData.status === 'ok' || txData.success ? 'success' : 'failed',
      input: txData.raw_input || txData.input,
      method: txData.method,
      nonce: txData.nonce,
      transactionIndex: txData.position || txData.transactionIndex,
      confirmations: txData.confirmations,
      
      // Token transfer data
      tokenTransfer: tokenTransferData,
      isTokenTransfer: !!tokenTransferData,
      
      // Legacy fields for compatibility
      logs: txData.logs,
      tokenTransfers: txData.token_transfers || [],
    };
  }

  normalizeTokenTransfer(transfer) {
    // Handle v2 API format
    const token = transfer.token || {};
    const decimals = parseInt(token.decimals || transfer.tokenDecimal) || 18;
    const rawAmount = transfer.total?.value || transfer.value || '0';
    const actualAmount = parseFloat(rawAmount) / Math.pow(10, decimals);

    return {
      hash: transfer.transaction_hash || transfer.hash,
      from: transfer.from?.hash || transfer.from,
      to: transfer.to?.hash || transfer.to,
      value: rawAmount,
      actualAmount: actualAmount,
      tokenName: token.name || transfer.tokenName,
      tokenSymbol: token.symbol || transfer.tokenSymbol,
      tokenDecimal: decimals,
      contractAddress: token.address || transfer.contractAddress,
      blockNumber: transfer.block_number || transfer.blockNumber,
      timestamp: new Date(transfer.timestamp || parseInt(transfer.timeStamp) * 1000),
      gasUsed: transfer.gas_used || transfer.gasUsed,
      gasPrice: transfer.gas_price || transfer.gasPrice,
      type: transfer.type || 'ERC-20',
    };
  }

  /**
   * Normalize internal transactions
   */
  normalizeInternalTransaction(tx) {
    // Convert Wei to ETH for internal transactions
    const rawValue = tx.value?.value || tx.value || '0';
    const actualValue = parseFloat(rawValue) / Math.pow(10, 18); // Convert Wei to ETH

    return {
      hash: tx.transaction_hash || tx.hash,
      from: tx.from?.hash || tx.from,
      to: tx.to?.hash || tx.to,
      value: rawValue, // Keep raw Wei value for reference
      actualAmount: actualValue, // Converted ETH value for calculations
      blockNumber: tx.block_number || tx.blockNumber,
      timestamp: new Date(tx.timestamp || parseInt(tx.timeStamp) * 1000),
      type: tx.type || 'call',
      traceId: tx.transaction_index || tx.traceId,
      isError: tx.success === false || tx.isError === '1',
      // Additional v2 API fields
      gas: tx.gas,
      gasUsed: tx.gas_used,
      error: tx.error,
    };
  }

  async getAccountBalance(address) {
    this.initialize();

    try {
      logger.info(`Fetching account balance for address: ${address}`);

      // Use v2 API format: /api/v2/addresses/{address}
      const response = await this.client.get(`/api/v2/addresses/${address}`);

      const addressData = response.data;
      const balance = addressData.coin_balance || '0';

      return {
        address,
        balance: balance,
        balanceEth: (parseInt(balance) / Math.pow(10, 18)).toString(),
        // Additional v2 API data
        transactionsCount: addressData.transactions_count || 0,
        tokenBalances: addressData.token_balances || [],
      };
    } catch (error) {
      if (error.response?.status === 404) {
        throw new AppError(`Address not found: ${address}`, 404);
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
