const axios = require('axios');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');

class EnhancedBlockscoutClient {
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

  /**
   * Get comprehensive transaction context for AI analysis using v2 API
   * @param {string} txHash - Transaction hash
   * @returns {Object} Rich transaction context for AI analysis
   */
  async getEnhancedTransactionContext(txHash) {
    this.initialize();

    try {
      logger.info('🔍 Fetching enhanced transaction context', { txHash });

      // Fetch rich transaction data from v2 API
      const [txData, receipt, logs] = await Promise.all([
        this.getTransactionV2(txHash),
        this.getTransactionReceipt(txHash).catch(() => null),
        this.getTransactionLogs(txHash).catch(() => [])
      ]);

      // Enhance with contract information for interacted addresses
      const contractInfo = {};
      if (txData.to?.hash && txData.to.is_contract) {
        contractInfo.to = await this.getContractInfo(txData.to.hash);
      }

      // Enhance token information with pricing data
      const enhancedTokenTransfers = await Promise.all(
        (txData.token_transfers || []).map(async (transfer) => {
          const priceData = await this.getTokenPrice(transfer.token.address).catch(() => null);
          return {
            ...transfer,
            token: {
              ...transfer.token,
              priceUSD: priceData?.price,
              marketCap: priceData?.market_cap,
              volume24h: priceData?.volume_24h
            }
          };
        })
      );

      const enhancedContext = {
        // Basic transaction data
        hash: txData.hash,
        status: txData.status,
        method: txData.method,
        decoded_input: txData.decoded_input,
        raw_input: txData.raw_input,
        
        // Address information with metadata
        from: {
          ...txData.from,
          contractInfo: txData.from.is_contract ? await this.getContractInfo(txData.from.hash) : null
        },
        to: {
          ...txData.to,
          contractInfo: contractInfo.to
        },

        // Enhanced token transfers
        token_transfers: enhancedTokenTransfers,

        // Transaction execution details
        execution: {
          gasUsed: txData.gas_used,
          gasPrice: txData.gas_price,
          maxFeePerGas: txData.max_fee_per_gas,
          priorityFee: txData.priority_fee,
          transactionFee: txData.fee?.value,
          status: txData.status,
          confirmations: txData.confirmations
        },

        // Event logs with decoded data
        events: logs.map(log => ({
          address: log.address,
          topics: log.topics,
          data: log.data,
          decoded: log.decoded || null,
          logIndex: log.logIndex
        })),

        // Block and timing information
        block: {
          number: txData.block,
          timestamp: txData.timestamp,
          position: txData.position
        },

        // Additional context
        context: {
          value: txData.value,
          type: txData.type,
          transaction_tag: txData.transaction_tag,
          revert_reason: txData.revert_reason,
          token_transfers_overflow: txData.token_transfers_overflow
        }
      };

      logger.info('✅ Enhanced transaction context assembled', {
        txHash,
        hasDecodedInput: !!enhancedContext.decoded_input,
        tokenTransfersCount: enhancedContext.token_transfers.length,
        eventsCount: enhancedContext.events.length,
        contractName: enhancedContext.to?.name || 'Unknown'
      });

      return enhancedContext;

    } catch (error) {
      logger.error('❌ Failed to get enhanced transaction context', {
        txHash,
        error: error.message
      });
      throw new AppError(`Failed to fetch enhanced transaction context: ${error.message}`, 500);
    }
  }

  /**
   * Get transaction data using Blockscout v2 API
   * @param {string} txHash - Transaction hash
   * @returns {Object} Normalized transaction data
   */
  async getTransactionV2(txHash) {
    try {
      const response = await this.client.get(`/api/v2/transactions/${txHash}`);
      return this.normalizeV2TransactionData(response.data);
    } catch (error) {
      logger.error('Failed to fetch v2 transaction data', { txHash, error: error.message });
      throw new AppError(`Transaction not found: ${txHash}`, 404);
    }
  }

  /**
   * Get transaction receipt with execution details
   * @param {string} txHash - Transaction hash
   * @returns {Object} Transaction receipt
   */
  async getTransactionReceipt(txHash) {
    try {
      const response = await this.client.get('/api', {
        params: {
          module: 'proxy',
          action: 'eth_getTransactionReceipt',
          txhash: txHash
        }
      });

      if (response.data.result) {
        return response.data.result;
      }
      return null;
    } catch (error) {
      logger.warn('Failed to fetch transaction receipt', { txHash, error: error.message });
      return null;
    }
  }

  /**
   * Get transaction logs with decoded events
   * @param {string} txHash - Transaction hash
   * @returns {Array} Array of log entries
   */
  async getTransactionLogs(txHash) {
    try {
      // First get transaction to find block number
      const txData = await this.getTransactionV2(txHash);
      const blockNumber = txData.block;

      const response = await this.client.get('/api', {
        params: {
          module: 'logs',
          action: 'getLogs',
          fromBlock: blockNumber,
          toBlock: blockNumber,
          topic0_1_opr: 'and'
        }
      });

      if (response.data.status === '1' && response.data.result) {
        // Filter logs for this specific transaction
        return response.data.result.filter(log => 
          log.transactionHash.toLowerCase() === txHash.toLowerCase()
        );
      }
      return [];
    } catch (error) {
      logger.warn('Failed to fetch transaction logs', { txHash, error: error.message });
      return [];
    }
  }

  /**
   * Get detailed contract information
   * @param {string} contractAddress - Contract address
   * @returns {Object} Contract information
   */
  async getContractInfo(contractAddress) {
    try {
      const response = await this.client.get(`/api/v2/addresses/${contractAddress}`);
      return {
        name: response.data.name,
        tags: response.data.metadata?.tags || [],
        isVerified: response.data.is_verified,
        proxyType: response.data.proxy_type,
        implementations: response.data.implementations || [],
        tokenInfo: response.data.token || null,
        creatorInfo: response.data.creator_address_hash ? {
          creator: response.data.creator_address_hash,
          creationTx: response.data.creation_tx_hash
        } : null
      };
    } catch (error) {
      logger.warn('Failed to fetch contract info', { contractAddress, error: error.message });
      return null;
    }
  }

  /**
   * Get token price and market data
   * @param {string} tokenAddress - Token contract address
   * @returns {Object} Token price data
   */
  async getTokenPrice(tokenAddress) {
    try {
      const response = await this.client.get(`/api/v2/tokens/${tokenAddress}`);
      return {
        price: response.data.exchange_rate,
        market_cap: response.data.circulating_market_cap,
        volume_24h: response.data.volume_24h,
        holders: response.data.holders
      };
    } catch (error) {
      logger.warn('Failed to fetch token price', { tokenAddress, error: error.message });
      return null;
    }
  }

  /**
   * Normalize v2 API transaction data
   * @param {Object} txData - Raw transaction data from v2 API
   * @returns {Object} Normalized transaction data
   */
  normalizeV2TransactionData(txData) {
    return {
      hash: txData.hash,
      status: txData.status === 'ok' ? 'success' : 'failed',
      method: txData.method,
      decoded_input: txData.decoded_input,
      raw_input: txData.raw_input,
      
      from: {
        hash: txData.from.hash,
        name: txData.from.name,
        is_contract: txData.from.is_contract,
        is_verified: txData.from.is_verified,
        metadata: txData.from.metadata,
        tags: txData.from.metadata?.tags || []
      },
      
      to: txData.to ? {
        hash: txData.to.hash,
        name: txData.to.name,
        is_contract: txData.to.is_contract,
        is_verified: txData.to.is_verified,
        metadata: txData.to.metadata,
        tags: txData.to.metadata?.tags || []
      } : null,

      value: txData.value,
      gas_used: txData.gas_used,
      gas_price: txData.gas_price,
      max_fee_per_gas: txData.max_fee_per_gas,
      max_priority_fee_per_gas: txData.max_priority_fee_per_gas,
      priority_fee: txData.priority_fee,
      
      fee: txData.fee,
      type: txData.type,
      block: txData.block,
      position: txData.position,
      timestamp: new Date(txData.timestamp),
      confirmations: txData.confirmations,
      
      token_transfers: txData.token_transfers || [],
      token_transfers_overflow: txData.token_transfers_overflow,
      transaction_tag: txData.transaction_tag,
      revert_reason: txData.revert_reason,
      
      created_contract: txData.created_contract
    };
  }

  /**
   * AI-powered transaction categorization using enhanced context
   * @param {string} txHash - Transaction hash
   * @param {string} userAddress - User's wallet address
   * @param {Object} geminiClient - AI client for analysis
   * @returns {Object} Categorization result
   */
  async categorizeTransactionWithAI(txHash, userAddress, geminiClient) {
    try {
      logger.info('🧠 Starting AI-powered transaction categorization', { txHash, userAddress });

      // Step 1: Get comprehensive context
      const enrichedContext = await this.getEnhancedTransactionContext(txHash);

      // Step 2: Prepare enhanced categories for AI
      const enhancedCategories = this.getEnhancedCategoryDefinitions();

      // Step 3: AI analysis with rich context
      const aiAnalysis = await geminiClient.analyzeTransactionContextV2({
        context: enrichedContext,
        userAddress: userAddress,
        availableCategories: enhancedCategories,
        analysisDepth: 'detailed'
      });

      // Step 4: Validate and enhance AI selection
      const validatedCategory = this.validateAICategory(aiAnalysis, enrichedContext);

      logger.info('✅ AI categorization completed', {
        txHash,
        category: validatedCategory.category,
        confidence: validatedCategory.confidence,
        reasoning: validatedCategory.reasoning?.substring(0, 100)
      });

      return {
        category: validatedCategory.category,
        subcategory: validatedCategory.subcategory,
        confidence: validatedCategory.confidence,
        reasoning: validatedCategory.reasoning,
        transactionPattern: validatedCategory.transaction_pattern,
        enrichedData: enrichedContext,
        aiAnalysis: aiAnalysis,
        direction: this.getTransactionDirection(enrichedContext, userAddress),
        isUserInitiated: enrichedContext.from.hash.toLowerCase() === userAddress.toLowerCase()
      };

    } catch (error) {
      logger.error('❌ AI categorization failed, using fallback', {
        txHash,
        error: error.message
      });
      
      // Fallback to enhanced hardcoded logic
      return this.fallbackCategorization(txHash, userAddress);
    }
  }

  /**
   * Enhanced category definitions for AI guidance
   * @returns {Object} Category definitions with indicators
   */
  getEnhancedCategoryDefinitions() {
    return {
      "staking": {
        description: "Cryptocurrency staking and delegation operations",
        indicators: [
          "ETH 2.0 deposit contract interactions",
          "Liquid staking protocols (Lido, Rocket Pool)",
          "Validator operations and staking rewards"
        ],
        contractTags: ["staking", "eth2", "validator", "liquid-staking"],
        methodPatterns: ["deposit", "stake", "delegate", "claim.*reward", "withdraw.*stake"],
        accountingTreatment: "Reclassify from liquid to staked assets, recognize staking rewards as revenue"
      },
      
      "dex_trade": {
        description: "Decentralized exchange trading activities", 
        indicators: [
          "Token swaps on DEX protocols",
          "Multi-hop trading routes",
          "Automated market maker interactions"
        ],
        contractTags: ["dex", "amm", "swap", "uniswap", "sushiswap"],
        methodPatterns: ["swap.*", "exactInput.*", "exactOutput.*", "multicall"],
        tokenTransferPatterns: ["bidirectional_different_tokens"],
        accountingTreatment: "Recognize trading gains/losses, record at fair value"
      },

      "defi_lending": {
        description: "DeFi lending and borrowing operations",
        indicators: [
          "Supply/withdraw from lending pools",
          "Borrow/repay operations",
          "Interest accrual and liquidations"
        ],
        contractTags: ["lending", "aave", "compound", "maker"],
        methodPatterns: ["supply", "withdraw", "borrow", "repay", "liquidate"],
        accountingTreatment: "Record as financial instruments, recognize interest income/expense"
      },

      "liquidity_provision": {
        description: "Adding/removing liquidity to/from AMM pools",
        indicators: [
          "LP token minting/burning",
          "Multiple token deposits/withdrawals",
          "Pool creation and management"
        ],
        contractTags: ["amm", "liquidity", "pool"],
        methodPatterns: ["addLiquidity.*", "removeLiquidity.*", "mint", "burn"],
        accountingTreatment: "Record LP tokens as investments, recognize impermanent loss"
      },

      "nft_activity": {
        description: "NFT minting, trading, and transfers",
        indicators: [
          "ERC-721/ERC-1155 transfers",
          "Marketplace interactions",
          "NFT minting and royalty payments"
        ],
        contractTags: ["nft", "marketplace", "collectible", "opensea"],
        tokenTypes: ["ERC-721", "ERC-1155"],
        accountingTreatment: "Record as intangible assets or inventory depending on use"
      },

      "bridge_transfer": {
        description: "Cross-chain bridge operations",
        indicators: [
          "Bridge contract interactions",
          "Lock/unlock token mechanisms",
          "Cross-chain message passing"
        ],
        contractTags: ["bridge", "cross-chain", "multichain"],
        methodPatterns: ["bridge.*", "lock", "unlock", "relay", "deposit.*bridge"],
        accountingTreatment: "Track assets across chains, maintain consolidated view"
      },

      "token_transfer": {
        description: "Simple token transfers between addresses",
        indicators: [
          "Direct ERC-20 token transfers",
          "Payment transactions",
          "Airdrops and distributions"
        ],
        methodPatterns: ["transfer", "transferFrom"],
        accountingTreatment: "Record as asset transfers, may trigger gain/loss recognition"
      },

      "governance": {
        description: "DAO governance and voting activities",
        indicators: [
          "Proposal creation and voting",
          "Governance token staking",
          "Delegate operations"
        ],
        contractTags: ["governance", "dao", "voting"],
        methodPatterns: ["vote", "propose", "delegate", "execute"],
        accountingTreatment: "Generally no direct accounting impact, track governance rights"
      }
    };
  }

  /**
   * Validate AI category selection
   * @param {Object} aiAnalysis - AI analysis result
   * @param {Object} context - Transaction context
   * @returns {Object} Validated category result
   */
  validateAICategory(aiAnalysis, context) {
    const { category, confidence } = aiAnalysis;

    // Confidence threshold check
    if (confidence < 0.7) {
      logger.warn('Low confidence AI categorization, applying safety fallback', {
        category,
        confidence,
        txHash: context.hash
      });
      return this.applySafetyFallback(context);
    }

    // Category existence check
    const validCategories = Object.keys(this.getEnhancedCategoryDefinitions());
    if (!validCategories.includes(category)) {
      logger.warn('Invalid category from AI, selecting closest match', {
        category,
        validCategories,
        txHash: context.hash
      });
      return this.selectClosestCategory(category, context);
    }

    return aiAnalysis;
  }

  /**
   * Apply safety fallback for low confidence categorizations
   * @param {Object} context - Transaction context
   * @returns {Object} Safe fallback categorization
   */
  applySafetyFallback(context) {
    // Simple rule-based fallback
    if (context.token_transfers.length > 0) {
      const transfer = context.token_transfers[0];
      if (transfer.token.type === 'ERC-721' || transfer.token.type === 'ERC-1155') {
        return {
          category: 'nft_activity',
          confidence: 0.8,
          reasoning: 'Fallback: Detected NFT transfer',
          subcategory: 'nft_transfer'
        };
      }
      return {
        category: 'token_transfer',
        confidence: 0.8,
        reasoning: 'Fallback: Detected token transfer',
        subcategory: 'erc20_transfer'
      };
    }

    if (parseFloat(context.value) > 0) {
      return {
        category: 'token_transfer',
        confidence: 0.8,
        reasoning: 'Fallback: ETH transfer detected',
        subcategory: 'eth_transfer'
      };
    }

    return {
      category: 'contract_interaction',
      confidence: 0.6,
      reasoning: 'Fallback: Generic contract interaction',
      subcategory: 'unknown'
    };
  }

  /**
   * Select closest valid category
   * @param {string} invalidCategory - Invalid category from AI
   * @param {Object} context - Transaction context
   * @returns {Object} Closest valid category
   */
  selectClosestCategory(invalidCategory, context) {
    const validCategories = Object.keys(this.getEnhancedCategoryDefinitions());
    
    // Simple similarity matching (could be enhanced with better algorithms)
    const similarities = validCategories.map(valid => ({
      category: valid,
      similarity: this.calculateStringSimilarity(invalidCategory, valid)
    }));

    const closest = similarities.reduce((max, current) => 
      current.similarity > max.similarity ? current : max
    );

    return {
      category: closest.category,
      confidence: 0.7,
      reasoning: `Closest match to AI suggestion "${invalidCategory}"`,
      subcategory: 'ai_corrected'
    };
  }

  /**
   * Calculate string similarity (simple implementation)
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} Similarity score (0-1)
   */
  calculateStringSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} Edit distance
   */
  levenshteinDistance(str1, str2) {
    const matrix = [];
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    return matrix[str2.length][str1.length];
  }

  /**
   * Determine transaction direction relative to user
   * @param {Object} context - Transaction context
   * @param {string} userAddress - User's wallet address
   * @returns {string} Direction (incoming/outgoing/self)
   */
  getTransactionDirection(context, userAddress) {
    const lowerAddress = userAddress.toLowerCase();
    const fromAddress = context.from.hash.toLowerCase();
    const toAddress = context.to?.hash.toLowerCase();

    if (fromAddress === lowerAddress && toAddress === lowerAddress) {
      return 'self';
    } else if (fromAddress === lowerAddress) {
      return 'outgoing';
    } else if (toAddress === lowerAddress) {
      return 'incoming';
    } else {
      return 'internal';
    }
  }

  /**
   * Fallback categorization using enhanced hardcoded logic
   * @param {string} txHash - Transaction hash
   * @param {string} userAddress - User's wallet address
   * @returns {Object} Fallback categorization result
   */
  async fallbackCategorization(txHash, userAddress) {
    try {
      const context = await this.getEnhancedTransactionContext(txHash);
      
      // Enhanced hardcoded logic would go here
      // This is a simplified version - you could enhance with the original logic
      
      return {
        category: 'contract_interaction',
        subcategory: 'fallback',
        confidence: 0.6,
        reasoning: 'Used fallback categorization due to AI failure',
        transactionPattern: 'Generic blockchain transaction',
        enrichedData: context,
        direction: this.getTransactionDirection(context, userAddress),
        isUserInitiated: context.from.hash.toLowerCase() === userAddress.toLowerCase()
      };
    } catch (error) {
      logger.error('Fallback categorization also failed', { txHash, error: error.message });
      throw error;
    }
  }
}

module.exports = EnhancedBlockscoutClient; 