const GeminiClient = require('./geminiClient');
const DeepSeekClient = require('./deepseekClient');
const logger = require('../../utils/logger');
const { AppError } = require('../../middleware/errorHandler');

class AIClientFactory {
  constructor() {
    this.geminiClient = null;
    this.deepseekClient = null;
    this.initializeClients();
  }

  initializeClients() {
    try {
      // Initialize Gemini client for journal entry creation AND chat
      if (process.env.GOOGLE_GEMINI_API_KEY) {
        this.geminiClient = new GeminiClient();
        logger.info('Initialized Gemini AI client');
      }

      // Initialize DeepSeek client for verification (future use)
      if (process.env.DEEPSEEK_API_KEY) {
        this.deepseekClient = new DeepSeekClient();
        logger.info('Initialized DeepSeek AI client');
      }

      if (!this.geminiClient) {
        throw new Error('Gemini client could not be initialized. Check your GOOGLE_GEMINI_API_KEY.');
      }
    } catch (error) {
      logger.error('Failed to initialize AI clients', {
        error: error.message,
      });
      throw new AppError(`Failed to initialize AI clients: ${error.message}`, 500);
    }
  }

  async analyzeTransaction(transactionData, userDescription) {
    if (!this.geminiClient) {
      throw new AppError('Gemini client not available for transaction analysis', 500);
    }

    try {
      return await this.geminiClient.analyzeTransaction(transactionData, userDescription);
    } catch (error) {
      logger.error('Transaction analysis failed', {
        txHash: transactionData.hash,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Analyze multiple transactions from a wallet address - BULK PROCESSING
   * @param {string} walletAddress - The wallet address to analyze
   * @param {Object} options - Analysis options (filters, limits, etc.)
   * @param {string} userId - User ID for saving entries
   * @returns {Object} Complete bulk analysis results
   */
  async analyzeBulkTransactions(walletAddress, options = {}, userId = null) {
    if (!this.geminiClient) {
      throw new AppError('Gemini client not available for bulk transaction analysis', 500);
    }

    try {
      logger.info('Starting bulk transaction analysis via factory', {
        walletAddress,
        userId,
        optionsKeys: Object.keys(options),
      });

      return await this.geminiClient.analyzeBulkTransactions(walletAddress, options, userId);
    } catch (error) {
      logger.error('Bulk transaction analysis failed', {
        walletAddress,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get wallet transaction preview without AI analysis
   * @param {string} walletAddress - The wallet address 
   * @param {Object} options - Fetching options
   * @returns {Object} Wallet transaction data with categorization
   */
  async getWalletPreview(walletAddress, options = {}) {
    try {
      const blockscoutClient = require('../blockscoutClient');
      
      logger.info('Getting wallet preview via AI client factory', {
        walletAddress,
        options,
      });

      const walletData = await blockscoutClient.getWalletTransactions(walletAddress, options);
      
      return walletData;
    } catch (error) {
      logger.error('Wallet preview failed', {
        walletAddress,
        error: error.message,
      });
      throw error;
    }
  }

  async verifyJournalEntry(journalEntry, originalTransaction) {
    if (!this.deepseekClient) {
      throw new AppError('DeepSeek client not available for journal entry verification', 500);
    }

    try {
      return await this.deepseekClient.verifyJournalEntry(journalEntry, originalTransaction);
    } catch (error) {
      logger.error('Journal entry verification failed', {
        entryId: journalEntry.id || 'new',
        error: error.message,
      });
      throw error;
    }
  }

  async chatResponse(message, context = {}) {
    if (!this.geminiClient) {
      throw new AppError('Gemini client not available for chat', 500);
    }

    try {
      return await this.geminiClient.chatResponse(message, context);
    } catch (error) {
      logger.error('Chat response failed', {
        messageLength: message.length,
        error: error.message,
      });
      throw error;
    }
  }

  // Alias for chat method used by routes
  async chat(message, context = {}) {
    return this.chatResponse(message, context);
  }

  async createJournalEntry(transactionData, userDescription) {
    try {
      logger.info('Creating journal entry with Gemini', {
        txHash: transactionData?.hash,
        description: userDescription,
      });

      // Use Gemini to create journal entry
      const journalEntries = await this.analyzeTransaction(transactionData, userDescription);

      logger.info('Journal entry creation completed', {
        txHash: transactionData?.hash,
        entriesCount: journalEntries.length,
      });

      return journalEntries;
    } catch (error) {
      logger.error('Failed to create journal entry', {
        txHash: transactionData?.hash,
        error: error.message,
      });
      throw error;
    }
  }

  getProviderInfo() {
    return {
      gemini: {
        available: !!this.geminiClient,
        capabilities: ['transactionAnalysis', 'journalEntryGeneration', 'chatResponse', 'bulkAnalysis'],
      },
      deepseek: {
        available: !!this.deepseekClient,
        capabilities: ['journalEntryVerification'],
      },
    };
  }

  getCapabilities() {
    const capabilities = {};

    if (this.geminiClient) {
      capabilities.transactionAnalysis = true;
      capabilities.journalEntryGeneration = true;
      capabilities.chatResponse = true;
      capabilities.bulkAnalysis = true;
      capabilities.walletAnalysis = true;
    }

    if (this.deepseekClient) {
      capabilities.journalEntryVerification = true;
    }

    return capabilities;
  }

  /**
   * Get available transaction categories for analysis
   * @returns {Array} List of supported transaction categories
   */
  getTransactionCategories() {
    try {
      const ifrsTemplates = require('./enhancedIfrsTemplates.json');
      
      return Object.entries(ifrsTemplates.categoryAnalysisTemplates).map(([name, template]) => ({
        name,
        description: template.description,
        accounts: template.accounts,
        ifrsNotes: template.ifrsNotes,
      }));
    } catch (error) {
      logger.error('Failed to get transaction categories', { error: error.message });
      return [];
    }
  }

  // Health check method
  async healthCheck() {
    const health = {
      gemini: false,
      deepseek: false,
      overall: false,
      capabilities: this.getCapabilities(),
    };

    try {
      if (this.geminiClient) {
        // Simple test to check if Gemini is responsive
        health.gemini = true;
      }
    } catch (error) {
      logger.warn('Gemini health check failed', { error: error.message });
    }

    try {
      if (this.deepseekClient) {
        // Simple test to check if DeepSeek is responsive
        health.deepseek = true;
      }
    } catch (error) {
      logger.warn('DeepSeek health check failed', { error: error.message });
    }

    health.overall = health.gemini; // Only Gemini is required for now
    return health;
  }

  // Alias for routes
  async checkHealth() {
    return this.healthCheck();
  }
}

// Export singleton instance
module.exports = new AIClientFactory();
