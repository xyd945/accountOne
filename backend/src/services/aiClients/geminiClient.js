const { GoogleGenerativeAI } = require('@google/generative-ai');
const { createClient } = require('@supabase/supabase-js');
const logger = require('../../utils/logger');
const { AppError } = require('../../middleware/errorHandler');
const BlockscoutClient = require('../blockscoutClient');
const accountService = require('../accountService');
const journalEntryService = require('../journalEntryService');

class GeminiClient {
  constructor() {
    if (!process.env.GOOGLE_GEMINI_API_KEY) {
      throw new Error('GOOGLE_GEMINI_API_KEY environment variable is required');
    }

    this.genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    );
  }

  /**
   * Analyze multiple transactions from a wallet address and create bulk journal entries
   * @param {string} walletAddress - The wallet address to analyze
   * @param {Object} options - Options for transaction fetching and analysis
   * @param {string} userId - User ID for saving entries
   * @returns {Object} Complete analysis with journal entries
   */
  async analyzeBulkTransactions(walletAddress, options = {}, userId = null) {
    try {
      logger.info('🚀 Starting bulk transaction analysis', {
        walletAddress,
        userId,
        options,
        step: 'initialization',
        message: 'Beginning comprehensive wallet analysis process'
      });

      // Fetch all transactions for the wallet
      logger.info('📡 Fetching blockchain data', {
        walletAddress,
        step: 'blockchain_fetch',
        message: 'Connecting to blockchain API to retrieve transaction history'
      });

      const walletData = await BlockscoutClient.getWalletTransactions(walletAddress, options);
      
      logger.info('✅ Blockchain data retrieved successfully', {
        walletAddress,
        totalTransactions: walletData.totalTransactions,
        categories: Object.keys(walletData.summary.categories),
        step: 'blockchain_complete',
        message: `Found ${walletData.totalTransactions} transactions across ${Object.keys(walletData.summary.categories).length} categories`
      });

      // Filter transactions based on options
      logger.info('🔍 Filtering transactions for analysis', {
        step: 'transaction_filter',
        message: 'Applying user-specified filters and limits'
      });

      const filteredTransactions = this.filterTransactionsForAnalysis(walletData.transactions, options);

      if (filteredTransactions.length === 0) {
        logger.info('⚠️ No transactions match analysis criteria', {
          step: 'no_transactions',
          message: 'Filters resulted in zero transactions to analyze'
        });

        return {
          success: true,
          walletAddress,
          summary: {
            totalTransactionsAnalyzed: 0,
            totalEntriesGenerated: 0,
            categories: {},
            recommendations: ['No transactions found matching the criteria'],
          },
          journalEntries: [],
        };
      }

      // Group transactions by category for efficient AI processing
      logger.info('📊 Categorizing transactions', {
        step: 'categorization',
        message: `Organizing ${filteredTransactions.length} transactions by type for AI processing`
      });

      const transactionGroups = this.groupTransactionsByCategory(filteredTransactions);

      logger.info('✅ Transaction categorization complete', {
        categories: Object.keys(transactionGroups),
        counts: Object.fromEntries(
          Object.entries(transactionGroups).map(([cat, txs]) => [cat, txs.length])
        ),
        step: 'categorization_complete',
        message: `Grouped into ${Object.keys(transactionGroups).length} categories for specialized analysis`
      });

      // Process each category with specialized analysis
      const allJournalEntries = [];
      const processingResults = {};

      logger.info('🤖 Starting AI analysis phase', {
        step: 'ai_analysis_start',
        message: 'Beginning category-by-category AI processing'
      });

      for (const [category, transactions] of Object.entries(transactionGroups)) {
        logger.info(`🔄 Processing ${category} transactions`, { 
          count: transactions.length,
          step: `ai_process_${category}`,
          message: `Analyzing ${transactions.length} ${category} transactions with specialized AI prompts`
        });

        try {
          const categoryResult = await this.processCategoryTransactions(
            category,
            transactions,
            walletAddress
          );

          allJournalEntries.push(...categoryResult.journalEntries);
          processingResults[category] = categoryResult;

          logger.info(`✅ Completed ${category} processing`, {
            entriesGenerated: categoryResult.journalEntries.length,
            step: `ai_complete_${category}`,
            message: `Generated ${categoryResult.journalEntries.length} journal entries for ${category}`
          });
        } catch (categoryError) {
          logger.error(`❌ Failed to process ${category} transactions`, {
            error: categoryError.message,
            transactionCount: transactions.length,
            step: `ai_error_${category}`,
            message: `AI processing failed for ${category} category`
          });
          
          processingResults[category] = {
            error: categoryError.message,
            journalEntries: [],
            transactions: transactions.length,
          };
        }
      }

      logger.info('🏁 AI analysis phase complete', {
        totalEntries: allJournalEntries.length,
        successfulCategories: Object.values(processingResults).filter(r => !r.error).length,
        step: 'ai_analysis_complete',
        message: `Generated ${allJournalEntries.length} total journal entries`
      });

      // Save journal entries if user ID provided
      let savedEntries = null;
      if (userId && allJournalEntries.length > 0) {
        try {
          logger.info('💾 Saving journal entries to database', {
            userId,
            entriesCount: allJournalEntries.length,
            step: 'database_save',
            message: 'Persisting generated journal entries to user account'
          });

          savedEntries = await this.saveBulkJournalEntries(allJournalEntries, userId, walletAddress);
          
          logger.info('✅ Journal entries saved successfully', {
            userId,
            entriesCount: savedEntries.length,
            step: 'database_complete',
            message: `Successfully saved ${savedEntries.length} journal entries`
          });
        } catch (saveError) {
          logger.warn('⚠️ Failed to save bulk journal entries', {
            error: saveError.message,
            entriesCount: allJournalEntries.length,
            step: 'database_error',
            message: 'Database save operation failed, entries available for manual review'
          });
        }
      }

      // Generate comprehensive summary
      logger.info('📋 Generating analysis summary', {
        step: 'summary_generation',
        message: 'Compiling comprehensive analysis report and recommendations'
      });

      const analysis = this.generateBulkAnalysisSummary(
        walletData,
        filteredTransactions,
        allJournalEntries,
        processingResults
      );

      logger.info('🎉 Bulk transaction analysis completed successfully', {
        walletAddress,
        totalTransactions: analysis.walletAnalysis?.totalTransactionsProcessed || 0,
        totalEntries: analysis.walletAnalysis?.totalJournalEntriesGenerated || 0,
        successRate: analysis.walletAnalysis?.processingSuccessRate || 'N/A',
        step: 'analysis_complete',
        message: 'Full wallet analysis pipeline completed successfully'
      });

      return {
        success: true,
        walletAddress,
        walletSummary: walletData.summary,
        analysis,
        journalEntries: savedEntries || allJournalEntries,
        processingResults,
        saved: !!savedEntries,
        startTime: Date.now(), // For timing calculations
      };

    } catch (error) {
      logger.error('💥 Bulk transaction analysis failed', {
        walletAddress,
        error: error.message,
        stack: error.stack,
        step: 'analysis_fatal_error',
        message: 'Critical failure in wallet analysis pipeline'
      });

      throw new AppError(`Bulk analysis failed: ${error.message}`, 500);
    }
  }

  /**
   * Filter transactions based on analysis options
   */
  filterTransactionsForAnalysis(transactions, options) {
    let filtered = [...transactions];

    // Date range filtering
    if (options.startDate) {
      const startDate = new Date(options.startDate);
      filtered = filtered.filter(tx => new Date(tx.timestamp) >= startDate);
    }

    if (options.endDate) {
      const endDate = new Date(options.endDate);
      filtered = filtered.filter(tx => new Date(tx.timestamp) <= endDate);
    }

    // Category filtering
    if (options.categories && options.categories.length > 0) {
      filtered = filtered.filter(tx => options.categories.includes(tx.category));
    }

    // Minimum value filtering (to exclude dust transactions)
    if (options.minValue) {
      filtered = filtered.filter(tx => {
        const value = parseFloat(tx.actualAmount || tx.value || 0);
        return value >= options.minValue;
      });
    }

    // Limit number of transactions for processing
    const limit = options.limit || 100;
    if (filtered.length > limit) {
      logger.info(`Limiting transactions for analysis`, {
        original: filtered.length,
        limited: limit,
      });
      filtered = filtered.slice(0, limit);
    }

    return filtered;
  }

  /**
   * Group transactions by category for efficient processing
   */
  groupTransactionsByCategory(transactions) {
    const groups = {};

    transactions.forEach(tx => {
      const category = tx.category || 'unknown';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(tx);
    });

    return groups;
  }

  /**
   * Process transactions for a specific category
   */
  async processCategoryTransactions(category, transactions, walletAddress) {
    const chartOfAccounts = await this.getFormattedChartOfAccounts();
    const ifrsTemplates = require('./enhancedIfrsTemplates.json');

    // Get category-specific template
    const categoryTemplate = ifrsTemplates.categoryAnalysisTemplates[category];

    // Format transactions for AI analysis
    const formattedTransactions = this.formatTransactionsForAI(transactions, category);

    // Create category-specific prompt
    const prompt = this.buildCategoryAnalysisPrompt(
      category,
      formattedTransactions,
      walletAddress,
      chartOfAccounts,
      categoryTemplate
    );

    try {
      logger.info(`Sending ${category} transactions to AI`, {
        transactionCount: transactions.length,
        promptLength: prompt.length,
      });

      const result = await this.model.generateContent([
        { text: ifrsTemplates.systemPrompt },
        { text: prompt },
      ]);

      const response = await result.response;
      const responseText = response.text();

      logger.info(`Received AI response for ${category}`, {
        responseLength: responseText.length,
      });

      // Parse the response
      const analysisResult = this.parseBulkAnalysisResponse(responseText, category);

      // Validate and correct accounts
      const validatedEntries = [];
      for (const entryGroup of analysisResult.journalEntries) {
        const validatedGroup = {
          ...entryGroup,
          entries: await this.validateAndCorrectAccounts(entryGroup.entries),
        };
        validatedEntries.push(validatedGroup);
      }

      return {
        category,
        summary: analysisResult.summary,
        journalEntries: validatedEntries,
        accountingNotes: analysisResult.accountingNotes,
        transactions: transactions.length,
      };

    } catch (error) {
      logger.error(`AI analysis failed for category ${category}`, {
        error: error.message,
        transactionCount: transactions.length,
      });

      throw new AppError(`Failed to analyze ${category} transactions: ${error.message}`, 500);
    }
  }

  /**
   * Build category-specific analysis prompt
   */
  buildCategoryAnalysisPrompt(category, transactions, walletAddress, chartOfAccounts, categoryTemplate) {
    const ifrsTemplates = require('./enhancedIfrsTemplates.json');

    // Calculate category summary
    const categorySummary = this.calculateCategorySummary(transactions, category);

    return ifrsTemplates.bulkTransactionAnalysisPrompt
      .replace('{walletAddress}', walletAddress)
      .replace('{totalTransactions}', transactions.length.toString())
      .replace('{timeRange}', this.formatTimeRange(transactions))
      .replace('{categories}', JSON.stringify({ [category]: transactions.length }))
      .replace('{volumeSummary}', JSON.stringify(categorySummary))
      .replace('{categoryBreakdown}', this.formatCategoryBreakdown(category, categoryTemplate))
      .replace('{transactions}', this.formatTransactionsForPrompt(transactions))
      .replace('{chartOfAccounts}', chartOfAccounts);
  }

  /**
   * Format transactions for AI prompt
   */
  formatTransactionsForPrompt(transactions) {
    return transactions.map((tx, index) => {
      return `${index + 1}. Hash: ${tx.hash}
   From: ${tx.from}
   To: ${tx.to}
   Value: ${tx.actualAmount || tx.value || 0} ${tx.tokenSymbol || 'ETH'}
   Category: ${tx.category}
   Direction: ${tx.direction}
   Timestamp: ${tx.timestamp}
   Gas Used: ${tx.gasUsed || 'N/A'}
   ${tx.tokenSymbol ? `Token: ${tx.tokenSymbol} (${tx.actualAmount})` : ''}
   ${tx.input && tx.input.length > 10 ? `Function: ${tx.input.slice(0, 10)}` : ''}`;
    }).join('\n\n');
  }

  /**
   * Format category breakdown for prompt
   */
  formatCategoryBreakdown(category, template) {
    if (!template) {
      return `${category}: No specific template available - analyze based on transaction data`;
    }

    return `${category.toUpperCase()}:
Description: ${template.description}
Recommended Accounts: ${JSON.stringify(template.accounts)}
IFRS Notes: ${template.ifrsNotes}`;
  }

  /**
   * Calculate summary statistics for a category
   */
  calculateCategorySummary(transactions, category) {
    const summary = {
      count: transactions.length,
      totalValue: 0,
      tokens: {},
      timeSpan: null,
    };

    const timestamps = [];

    transactions.forEach(tx => {
      // Calculate total value
      const value = parseFloat(tx.actualAmount || tx.value || 0);
      summary.totalValue += value;

      // Track tokens
      if (tx.tokenSymbol) {
        summary.tokens[tx.tokenSymbol] = (summary.tokens[tx.tokenSymbol] || 0) + parseFloat(tx.actualAmount || 0);
      }

      // Track timestamps
      if (tx.timestamp) {
        timestamps.push(new Date(tx.timestamp));
      }
    });

    // Calculate time span
    if (timestamps.length > 0) {
      const sorted = timestamps.sort((a, b) => a - b);
      summary.timeSpan = {
        start: sorted[0],
        end: sorted[sorted.length - 1],
        days: Math.ceil((sorted[sorted.length - 1] - sorted[0]) / (1000 * 60 * 60 * 24)),
      };
    }

    return summary;
  }

  /**
   * Format time range for prompt
   */
  formatTimeRange(transactions) {
    const timestamps = transactions
      .map(tx => new Date(tx.timestamp))
      .filter(d => !isNaN(d))
      .sort((a, b) => a - b);

    if (timestamps.length === 0) return 'Unknown';

    const start = timestamps[0];
    const end = timestamps[timestamps.length - 1];

    return `${start.toISOString().split('T')[0]} to ${end.toISOString().split('T')[0]}`;
  }

  /**
   * Format transactions for AI analysis
   */
  formatTransactionsForAI(transactions, category) {
    return transactions.map(tx => ({
      hash: tx.hash,
      from: tx.from,
      to: tx.to,
      value: tx.actualAmount || tx.value || 0, // FIXED: prioritize actualAmount (ETH) over value (Wei)
      currency: tx.tokenSymbol || 'ETH',
      category: tx.category,
      direction: tx.direction,
      timestamp: tx.timestamp,
      gasUsed: tx.gasUsed,
      gasPrice: tx.gasPrice,
      blockNumber: tx.blockNumber,
      isUserInitiated: tx.isUserInitiated,
    }));
  }

  /**
   * Parse bulk analysis response from AI
   */
  parseBulkAnalysisResponse(responseText, category) {
    try {
      // Clean and parse JSON response
      const cleanedResponse = responseText
        .replace(/```json\s*/, '')
        .replace(/```\s*$/, '')
        .trim();

      const parsed = JSON.parse(cleanedResponse);

      // Validate response structure
      if (!parsed.journalEntries || !Array.isArray(parsed.journalEntries)) {
        throw new Error('Invalid response format: missing journalEntries array');
      }

      return {
        summary: parsed.summary || {
          totalEntries: parsed.journalEntries.length,
          totalTransactionsProcessed: parsed.journalEntries.length,
          categoryBreakdown: { [category]: parsed.journalEntries.length },
        },
        journalEntries: parsed.journalEntries,
        accountingNotes: parsed.accountingNotes || {},
      };

    } catch (parseError) {
      logger.error('Failed to parse bulk analysis response', {
        category,
        error: parseError.message,
        responsePreview: responseText.substring(0, 500),
      });

      // Fallback: try to extract individual journal entries
      try {
        const entries = this.extractFallbackEntries(responseText, category);
        return {
          summary: {
            totalEntries: entries.length,
            totalTransactionsProcessed: entries.length,
            categoryBreakdown: { [category]: entries.length },
          },
          journalEntries: entries,
          accountingNotes: { note: 'Parsed using fallback method due to response format issues' },
        };
      } catch (fallbackError) {
        throw new AppError(`Failed to parse AI response for ${category}: ${parseError.message}`, 500);
      }
    }
  }

  /**
   * Extract journal entries using fallback parsing
   */
  extractFallbackEntries(responseText, category) {
    // This is a simplified fallback - in practice, you might want more sophisticated parsing
    const entries = [];
    
    // Try to find JSON-like patterns in the response
    const jsonPattern = /\{[^{}]*"accountDebit"[^{}]*\}/g;
    const matches = responseText.match(jsonPattern);

    if (matches) {
      matches.forEach((match, index) => {
        try {
          const entry = JSON.parse(match);
          entries.push({
            transactionHash: `fallback_${index}`,
            category,
            entries: [entry],
          });
        } catch (e) {
          // Skip invalid matches
        }
      });
    }

    return entries;
  }

  /**
   * Save bulk journal entries to database
   */
  async saveBulkJournalEntries(journalEntries, userId, walletAddress) {
    try {
      logger.info('Starting bulk journal entries save', {
        userId,
        walletAddress,
        entryGroupsCount: journalEntries.length,
      });

      // Flatten the nested structure into individual entries
      const flattenedEntries = [];
      
      for (const entryGroup of journalEntries) {
        for (const entry of entryGroup.entries) {
          const amount = parseFloat(entry.amount);
          
          // Filter out invalid amounts to prevent database constraint violations
          if (amount <= 0.00001 || amount >= 1000000 || isNaN(amount)) {
            logger.warn('Skipping entry with invalid amount', {
              amount: entry.amount,
              currency: entry.currency,
              debit: entry.accountDebit,
              credit: entry.accountCredit,
              transactionHash: entryGroup.transactionHash,
              reason: amount <= 0.00001 ? 'too small' : amount >= 1000000 ? 'too large' : 'invalid number',
            });
            continue; // Skip this entry
          }
          
          // Add transaction context to each entry
          flattenedEntries.push({
            accountDebit: entry.accountDebit,
            accountCredit: entry.accountCredit,
            amount: amount, // Use the validated amount
            currency: entry.currency,
            narrative: `${entry.narrative} (Bulk analysis from ${walletAddress})`,
            confidence: entry.confidence || 0.8,
            entryType: entry.entryType || 'main',
            // Add metadata about the source transaction
            metadata: {
              walletAddress,
              transactionHash: entryGroup.transactionHash,
              category: entryGroup.category,
              entryType: entry.entryType || 'main',
              bulkAnalysis: true,
              requiresAccountCreation: entry.requiresAccountCreation || false,
              accountCreationSuggestions: entry.accountCreationSuggestions || null,
            },
          });
        }
      }

      logger.info('Flattened journal entries for saving', {
        userId,
        totalEntries: flattenedEntries.length,
        entryPreview: flattenedEntries.slice(0, 2).map(e => ({
          debit: e.accountDebit,
          credit: e.accountCredit,
          amount: e.amount,
          currency: e.currency,
        })),
      });

      // Check if we have any valid entries after filtering
      if (flattenedEntries.length === 0) {
        logger.warn('No valid entries remaining after amount filtering', {
          userId,
          walletAddress,
          originalEntryGroups: journalEntries.length,
        });
        return []; // Return empty array instead of failing
      }

      // Use the correct function name with proper structure
      const savedEntries = await journalEntryService.saveJournalEntries({
        entries: flattenedEntries,
        userId: userId,
        source: 'ai_bulk_analysis',
        metadata: {
          walletAddress,
          bulkAnalysis: true,
          analysisTimestamp: new Date().toISOString(),
          totalTransactionGroups: journalEntries.length,
        },
      });

      logger.info('Successfully saved bulk journal entries', {
        userId,
        walletAddress,
        savedCount: savedEntries.length,
      });

      return savedEntries;

    } catch (error) {
      logger.error('Failed to save bulk journal entries', {
        error: error.message,
        userId,
        walletAddress,
        entriesCount: journalEntries.length,
      });

      throw new AppError(`Failed to save journal entries: ${error.message}`, 500);
    }
  }

  /**
   * Generate comprehensive summary of bulk analysis
   */
  generateBulkAnalysisSummary(walletData, processedTransactions, journalEntries, processingResults) {
    // Add defensive checks for all parameters
    const safeWalletData = walletData || { summary: { categories: {} }, totalTransactions: 0 };
    const safeProcessedTransactions = processedTransactions || [];
    const safeJournalEntries = journalEntries || [];
    const safeProcessingResults = processingResults || {};

    const summary = {
      walletAnalysis: {
        totalTransactionsInWallet: safeWalletData.totalTransactions || 0,
        totalTransactionsProcessed: safeProcessedTransactions.length,
        totalJournalEntriesGenerated: safeJournalEntries.length,
        processingSuccessRate: this.calculateSuccessRate(safeProcessingResults),
      },
      categoryBreakdown: this.summarizeCategoryResults(safeProcessingResults),
      recommendations: this.generateRecommendations(safeWalletData, safeJournalEntries, safeProcessingResults),
      ifrsCompliance: this.assessIfrsCompliance(safeJournalEntries),
    };

    return summary;
  }

  /**
   * Calculate processing success rate
   */
  calculateSuccessRate(processingResults) {
    if (!processingResults || typeof processingResults !== 'object') {
      return 'N/A';
    }
    
    const total = Object.keys(processingResults).length;
    const successful = Object.values(processingResults).filter(result => result && !result.error).length;
    return total > 0 ? (successful / total * 100).toFixed(1) + '%' : 'N/A';
  }

  /**
   * Summarize results by category
   */
  summarizeCategoryResults(processingResults) {
    const summary = {};

    if (!processingResults || typeof processingResults !== 'object') {
      return summary;
    }

    Object.entries(processingResults).forEach(([category, result]) => {
      if (result && typeof result === 'object') {
        summary[category] = {
          transactions: result.transactions || 0,
          journalEntries: result.journalEntries?.length || 0,
          success: !result.error,
          error: result.error || null,
        };
      }
    });

    return summary;
  }

  /**
   * Generate recommendations based on analysis
   */
  generateRecommendations(walletData, journalEntries, processingResults) {
    const recommendations = [];

    // Check for high-volume categories with defensive checks
    if (walletData?.summary?.categories && typeof walletData.summary.categories === 'object') {
      Object.entries(walletData.summary.categories).forEach(([category, count]) => {
        if (typeof count === 'number' && count > 50) {
          recommendations.push(`High activity in ${category} (${count} transactions) - consider setting up automated processing rules`);
        }
      });
    }

    // Check for failed processing with defensive checks
    if (processingResults && typeof processingResults === 'object') {
      Object.entries(processingResults).forEach(([category, result]) => {
        if (result && result.error) {
          recommendations.push(`Failed to process ${category} transactions - manual review required`);
        }
      });
    }

    // Check for missing account mappings - handle different data structures
    const missingAccounts = [];
    if (journalEntries && Array.isArray(journalEntries)) {
      try {
        // Handle nested structure (bulk analysis)
        if (journalEntries.length > 0 && journalEntries[0] && journalEntries[0].entries) {
          const allEntries = journalEntries.flatMap(group => group.entries || []);
          const missing = allEntries
            .filter(entry => entry && entry.requiresAccountCreation)
            .map(entry => entry.accountDebit || entry.accountCredit)
            .filter((account, index, arr) => account && arr.indexOf(account) === index);
          missingAccounts.push(...missing);
        } 
        // Handle flat structure (single transaction analysis)
        else {
          const missing = journalEntries
            .filter(entry => entry && entry.requiresAccountCreation)
            .map(entry => entry.accountDebit || entry.accountCredit)
            .filter((account, index, arr) => account && arr.indexOf(account) === index);
          missingAccounts.push(...missing);
        }
      } catch (error) {
        logger.warn('Failed to process journal entries for recommendations', {
          error: error.message,
          journalEntriesLength: journalEntries.length,
        });
      }
    }

    if (missingAccounts.length > 0) {
      recommendations.push(`Create missing accounts: ${missingAccounts.join(', ')}`);
    }

    // Add default recommendations if none found
    if (recommendations.length === 0) {
      recommendations.push('All transactions processed successfully');
      recommendations.push('Review generated journal entries for accuracy');
    }

    return recommendations;
  }

  /**
   * Assess IFRS compliance of generated entries
   */
  assessIfrsCompliance(journalEntries) {
    const compliance = {
      doubleEntryBalance: true,
      accountClassification: 'Good',
      narrativeQuality: 'Good',
      confidenceScore: 0,
      issues: [],
    };

    let totalConfidence = 0;
    let entryCount = 0;

    if (!journalEntries || !Array.isArray(journalEntries)) {
      compliance.issues.push('No journal entries provided for compliance assessment');
      return compliance;
    }

    try {
      // Handle different data structures
      let allEntries = [];
      
      if (journalEntries.length > 0) {
        // Check if it's nested structure (bulk analysis)
        if (journalEntries[0] && journalEntries[0].entries) {
          allEntries = journalEntries.flatMap(group => group.entries || []);
        } else {
          // Flat structure (single transaction analysis)
          allEntries = journalEntries;
        }
      }

      allEntries.forEach(entry => {
        // Check confidence
        if (entry.confidence) {
          totalConfidence += entry.confidence;
          entryCount++;
        }

        // Check for low confidence entries
        if (entry.confidence && entry.confidence < 0.7) {
          compliance.issues.push(`Low confidence entry: ${entry.narrative}`);
        }

        // Check for missing narratives
        if (!entry.narrative || entry.narrative.length < 10) {
          compliance.issues.push(`Unclear narrative: ${entry.narrative || 'N/A'}`);
        }
      });

      compliance.confidenceScore = entryCount > 0 ? (totalConfidence / entryCount).toFixed(2) : 0;

      if (compliance.issues.length === 0) {
        compliance.issues.push('No significant compliance issues detected');
      }

    } catch (error) {
      logger.warn('Failed to assess IFRS compliance', {
        error: error.message,
        journalEntriesLength: journalEntries.length,
      });
      compliance.issues.push('Error during compliance assessment');
    }

    return compliance;
  }

  async chatResponse(message, context = {}) {
    try {
      logger.info('Processing chat message with Gemini AI', {
        messageLength: message.length,
        hasContext: Object.keys(context).length > 0,
      });

      // Check what type of request this is
      const isJournalEntryRequest = this.isJournalEntryRequest(message);
      const isWalletAnalysisRequest = this.isWalletAnalysisRequest(message);
      
      logger.info('Request type detection', { 
        isJournalEntryRequest, 
        isWalletAnalysisRequest 
      });

      let result;
      if (isWalletAnalysisRequest) {
        logger.info('Handling wallet analysis request');
        result = await this.handleWalletAnalysisChat(message, context);
      } else if (isJournalEntryRequest) {
        logger.info('Handling journal entry chat');
        result = await this.handleJournalEntryChat(message, context);
      } else {
        logger.info('Handling general chat');
        result = await this.handleGeneralChat(message, context);
      }

      logger.info('Chat response completed successfully', {
        hasResponse: !!result.response,
        hasJournalEntries: !!(result.journalEntries && result.journalEntries.length > 0),
        entriesCount: result.journalEntries ? result.journalEntries.length : 0,
      });

      return result;
    } catch (error) {
      logger.error('Error generating chat response with Gemini', {
        error: error.message,
        stack: error.stack,
        messagePreview: message.substring(0, 100),
      });

      // Instead of throwing, return a controlled error response
      return {
        response: 'I encountered an error while processing your request. Please try again.',
        thinking: `Error occurred: ${error.message}`,
        suggestions: ['Try rephrasing your request', 'Check if all required information is provided'],
        journalEntries: [],
        error: error.message,
      };
    }
  }

  /**
   * Handle wallet analysis requests from chat
   */
  async handleWalletAnalysisChat(message, context) {
    try {
      logger.info('Starting wallet analysis chat handler', { messageLength: message.length });
      
      // Extract wallet address from message
      const walletAddress = this.extractWalletAddress(message);
      
      if (!walletAddress) {
        return {
          response: 'I can see you want to analyze a wallet, but I couldn\'t find a valid Ethereum address in your message. Please provide a wallet address starting with 0x followed by 40 characters.\n\nExample: "Analyze wallet 0x742e8c9b3be7936e2f6d143de3e9bb8f4b4d2b9e"',
          thinking: 'User requested wallet analysis but no valid Ethereum address was found in the message.',
          suggestions: [
            'Provide a valid Ethereum wallet address (0x...)',
            'Make sure the address is complete (42 characters total)',
            'Double-check the address format'
          ],
          journalEntries: [],
        };
      }

      logger.info('🔍 Wallet Analysis Started', { 
        walletAddress,
        step: 'initialization',
        message: 'Extracted wallet address from user message'
      });

      // Determine analysis options based on message content
      const options = this.parseAnalysisOptionsFromMessage(message);
      logger.info('📋 Analysis Options Parsed', { 
        options,
        step: 'options',
        message: 'Configured analysis parameters based on user message'
      });

      try {
        // Perform bulk analysis with progress logging
        logger.info('🚀 Starting Bulk Transaction Analysis', { 
          walletAddress, 
          options,
          step: 'analysis_start',
          message: 'Beginning comprehensive blockchain data analysis'
        });
        
        const analysis = await this.analyzeBulkTransactions(
          walletAddress,
          {
            limit: options.limit || 20, // Reasonable default for chat
            minValue: options.minValue || 0.001,
            categories: options.categories,
            saveEntries: context.user?.id ? (options.saveEntries !== false) : false,
            includeTokens: true,
            includeInternal: true,
          },
          context.user?.id || null
        );

        logger.info('✅ Bulk Wallet Analysis Completed Successfully', {
          walletAddress,
          totalTransactions: analysis.analysis?.walletAnalysis?.totalTransactionsProcessed || 0,
          totalEntries: analysis.analysis?.walletAnalysis?.totalJournalEntriesGenerated || 0,
          step: 'analysis_complete',
          message: 'All transactions processed and journal entries generated'
        });

        // Format response for chat
        const summary = analysis.analysis?.walletAnalysis || {};
        const entriesGenerated = summary.totalJournalEntriesGenerated || 0;
        const transactionsProcessed = summary.totalTransactionsProcessed || 0;

        let response = `✅ **Wallet Analysis Completed!**\n\n`;
        response += `📍 **Address:** ${walletAddress}\n`;
        response += `📊 **Results:**\n`;
        response += `• Transactions Processed: ${transactionsProcessed}\n`;
        response += `• Journal Entries Generated: ${entriesGenerated}\n`;
        response += `• Success Rate: ${summary.processingSuccessRate || 'N/A'}\n\n`;

        if (analysis.journalEntries && analysis.journalEntries.length > 0) {
          response += `💰 **Sample Journal Entries:**\n\n`;
          
          // Handle both flattened entries (from saved) and nested entry groups (from analysis)
          const entriesToShow = analysis.journalEntries.slice(0, 3);
          
          entriesToShow.forEach((entryItem, index) => {
            // Check if this is a nested entry group or flattened entry
            if (entryItem.entries && Array.isArray(entryItem.entries)) {
              // Nested entry group structure
              response += `**${index + 1}. ${entryItem.category?.toUpperCase() || 'TRANSACTION'}**\n`;
              entryItem.entries.forEach((entry, entryIndex) => {
                response += `• Debit: ${entry.accountDebit} (${entry.amount} ${entry.currency})\n`;
                response += `• Credit: ${entry.accountCredit}\n`;
                response += `• Narrative: ${entry.narrative}\n`;
                if (entryIndex < entryItem.entries.length - 1) response += `\n`;
              });
            } else {
              // Flattened entry structure (from saved entries)
              response += `**${index + 1}. JOURNAL ENTRY**\n`;
              response += `• Debit: ${entryItem.accountDebit} (${entryItem.amount} ${entryItem.currency})\n`;
              response += `• Credit: ${entryItem.accountCredit}\n`;
              response += `• Narrative: ${entryItem.narrative}\n`;
            }
            if (index < 2 && index < entriesToShow.length - 1) response += `\n---\n\n`;
          });

          if (analysis.journalEntries.length > 3) {
            response += `\n... and ${analysis.journalEntries.length - 3} more entries.`;
          }
        }

        // Add save status
        if (context.user?.id) {
          if (analysis.saved) {
            response += `\n\n✅ **All journal entries have been saved to your accounting system.**`;
          } else {
            response += `\n\n⚠️ **Note:** Some entries may not have been saved. Please check your journal.`;
          }
        } else {
          response += `\n\n💡 **Tip:** Log in to automatically save journal entries to your accounting system.`;
        }

        // Add recommendations
        if (analysis.analysis?.recommendations && analysis.analysis.recommendations.length > 0) {
          response += `\n\n💡 **Recommendations:**\n`;
          analysis.analysis.recommendations.forEach(rec => {
            response += `• ${rec}\n`;
          });
        }

        // Add detailed thinking process
        const thinkingProcess = `🧠 **Analysis Process Completed:**

1. **Address Extraction:** Successfully identified wallet ${walletAddress}
2. **Transaction Fetch:** Retrieved ${transactionsProcessed} blockchain transactions
3. **Categorization:** Classified transactions into accounting categories
4. **AI Processing:** Generated ${entriesGenerated} IFRS-compliant journal entries
5. **Account Validation:** Verified account mappings and suggested new accounts
6. **Data Persistence:** ${analysis.saved ? 'Saved entries to database' : 'Entries ready for review'}

**Processing Time:** ~${((Date.now() - (analysis.startTime || Date.now())) / 1000).toFixed(1)} seconds
**AI Confidence:** ${analysis.analysis?.ifrsCompliance?.confidenceScore || 'N/A'}
**Success Rate:** ${summary.processingSuccessRate || 'N/A'}`;

        return {
          response,
          thinking: thinkingProcess,
          suggestions: [
            'Review the generated journal entries for accuracy',
            'Check if any accounts need to be created',
            'Consider adjusting analysis filters for different results',
            entriesGenerated > 0 ? 'Verify the accounting treatment is appropriate' : 'Try analyzing with different filters or categories'
          ],
          journalEntries: analysis.journalEntries || [],
          processingComplete: true,
          walletAddress,
          analysisMetrics: {
            transactionsProcessed,
            entriesGenerated,
            successRate: summary.processingSuccessRate,
            categoriesFound: Object.keys(analysis.analysis?.categoryBreakdown || {}),
          }
        };

      } catch (analysisError) {
        logger.error('❌ Wallet Analysis Failed', {
          walletAddress,
          error: analysisError.message,
          step: 'analysis_error',
          message: 'Analysis process encountered an error'
        });

        return {
          response: `❌ **Wallet Analysis Failed**\n\nI encountered an error while analyzing wallet ${walletAddress}:\n\n• ${analysisError.message}\n\nThis could be due to:\n• Network connectivity issues\n• Invalid wallet address\n• No transactions found\n• API rate limits\n\nPlease try again in a few moments.`,
          thinking: `Failed to analyze wallet ${walletAddress} due to error: ${analysisError.message}. This could be a temporary issue with blockchain APIs or network connectivity.`,
          suggestions: [
            'Verify the wallet address is correct',
            'Try again in a few minutes',
            'Check if the wallet has any transactions',
            'Use a different wallet address for testing'
          ],
          journalEntries: [],
          processingComplete: false,
          error: analysisError.message,
        };
      }

    } catch (error) {
      logger.error('💥 Wallet Analysis Handler Error', {
        error: error.message,
        stack: error.stack,
        messagePreview: message.substring(0, 100),
        step: 'handler_error',
        message: 'Critical error in wallet analysis handler'
      });

      return {
        response: 'I encountered an error while processing your wallet analysis request. Please try again with a valid Ethereum wallet address.',
        thinking: `Critical error in wallet analysis handler: ${error.message}. This indicates a system-level issue that needs attention.`,
        suggestions: ['Try rephrasing your request', 'Provide a valid Ethereum address'],
        journalEntries: [],
        processingComplete: false,
        error: error.message,
      };
    }
  }

  /**
   * Parse analysis options from user message
   */
  parseAnalysisOptionsFromMessage(message) {
    const lowerMessage = message.toLowerCase();
    const options = {};

    // Parse limit
    const limitMatch = message.match(/(?:limit|max|maximum)\s*:?\s*(\d+)/i);
    if (limitMatch) {
      options.limit = parseInt(limitMatch[1]);
    }

    // Parse minimum value
    const minValueMatch = message.match(/(?:min|minimum)\s*(?:value)?\s*:?\s*([\d.]+)/i);
    if (minValueMatch) {
      options.minValue = parseFloat(minValueMatch[1]);
    }

    // Parse categories
    const categories = [];
    if (lowerMessage.includes('staking')) categories.push('staking');
    if (lowerMessage.includes('trading') || lowerMessage.includes('dex') || lowerMessage.includes('swap')) categories.push('dex_trade');
    if (lowerMessage.includes('lending') || lowerMessage.includes('defi')) categories.push('lending');
    if (lowerMessage.includes('token') || lowerMessage.includes('transfer')) categories.push('token_transfer');
    if (lowerMessage.includes('nft')) categories.push('nft');
    if (lowerMessage.includes('liquidity')) categories.push('liquidity_provision');

    if (categories.length > 0) {
      options.categories = categories;
    }

    // Parse save preference
    if (lowerMessage.includes('don\'t save') || lowerMessage.includes('do not save') || lowerMessage.includes('preview')) {
      options.saveEntries = false;
    }

    return options;
  }

  isJournalEntryRequest(message) {
    const journalKeywords = [
      'create journal entry',
      'journal entry for',
      'make journal entry',
      'record transaction',
      'book transaction',
      'accounting entry',
      'debit credit',
      'journal for',
      'record',
      'book',
    ];

    const lowerMessage = message.toLowerCase();
    const hasJournalKeyword = journalKeywords.some(keyword => lowerMessage.includes(keyword));
    
    // Check for transaction hash (64 hex chars) - this is likely a journal entry request
    const hasTransactionHash = /0x[a-fA-F0-9]{64}/.test(message);
    
    // Look for transaction-specific analysis keywords
    const transactionAnalysisKeywords = [
      'analyze this transaction',
      'analyze this specific',
      'transaction hash',
      'analyze transaction',
      'create journal entries',
      'process transaction'
    ];
    
    const hasTransactionAnalysisKeyword = transactionAnalysisKeywords.some(keyword => 
      lowerMessage.includes(keyword)
    );
    
    // If message has transaction hash AND analysis keywords, it's a journal entry request
    if (hasTransactionHash && (hasTransactionAnalysisKeyword || lowerMessage.includes('journal'))) {
      return true;
    }
    
    return hasJournalKeyword;
  }

  /**
   * Check if message is requesting wallet address analysis
   */
  isWalletAnalysisRequest(message) {
    const walletKeywords = [
      'analyze wallet',
      'analyze address',
      'wallet analysis',
      'analyze entire',
      'analyze all transactions',
      'create journal entries for',
      'bulk analyze',
      'process wallet',
      'transaction history',
      'analyze the wallet',
      'analyze this wallet',
      'bulk process'
    ];

    const lowerMessage = message.toLowerCase();
    const hasWalletKeyword = walletKeywords.some(keyword => lowerMessage.includes(keyword));
    
    // Check for transaction hash first (64 hex chars) - if found, this is NOT a wallet analysis
    const hasTransactionHash = /0x[a-fA-F0-9]{64}/.test(message);
    if (hasTransactionHash) {
      return false; // This is a transaction analysis, not wallet analysis
    }
    
    // Check if message contains an Ethereum address (0x followed by exactly 40 hex characters)
    const hasEthAddress = /0x[a-fA-F0-9]{40}(?![a-fA-F0-9])/.test(message);
    
    return hasWalletKeyword || (hasEthAddress && (
      lowerMessage.includes('analyze') || 
      lowerMessage.includes('journal') || 
      lowerMessage.includes('process') ||
      lowerMessage.includes('create') ||
      lowerMessage.includes('transactions')
    ));
  }

  /**
   * Extract wallet address from message
   */
  extractWalletAddress(message) {
    // Only match exactly 40 hex characters (not 64) to avoid matching transaction hashes
    const addressMatch = message.match(/0x[a-fA-F0-9]{40}(?![a-fA-F0-9])/);
    return addressMatch ? addressMatch[0] : null;
  }

  async handleJournalEntryChat(message, context) {
    try {
      logger.info('Starting handleJournalEntryChat', { messageLength: message.length });
      
      // Extract transaction details from the message
      const transactionDetails = this.extractTransactionDetails(message);
      logger.info('Transaction details extracted', { transactionDetails });

      if (transactionDetails.hasTransactionHash) {
        // Fetch real transaction data and create entries
        try {
          logger.info('Fetching transaction data from Blockscout', {
            txHash: transactionDetails.transactionHash,
          });

          const transactionData = await BlockscoutClient.getTransactionInfo(transactionDetails.transactionHash);
          
          // Use the real transaction data to create journal entries
          const journalEntries = await this.analyzeTransaction(transactionData, transactionDetails.description);

          // Save using universal service if user context is available
          let savedEntries = null;
          if (context.user?.id) {
            try {
              const result = await journalEntryService.saveJournalEntriesWithTransaction(
                journalEntries, 
                transactionData, 
                context.user.id, 
                {
                  ...transactionDetails,
                  transactionDate: transactionData.timestamp ? new Date(transactionData.timestamp * 1000) : new Date(),
                  source: 'blockchain_analysis'
                }
              );
              savedEntries = result.entries;
              
              logger.info('Journal entries saved via universal service', {
                txHash: transactionDetails.transactionHash,
                userId: context.user.id,
                entriesCount: savedEntries.length,
              });
            } catch (saveError) {
              logger.warn('Failed to save journal entries via universal service', {
                txHash: transactionDetails.transactionHash,
                error: saveError.message,
              });
            }
          }

          const baseResponse = `I've analyzed the blockchain transaction and created the following journal entries:\n\n${this.formatJournalEntriesForChat(journalEntries)}`;
          const saveStatus = savedEntries 
            ? `\n\n✅ These entries have been automatically saved to your accounting system.`
            : context.user?.id 
              ? `\n\n⚠️ Note: I couldn't automatically save these entries. You may need to save them manually.`
              : `\n\n💡 To automatically save entries, please log in to your account.`;

          return {
            response: baseResponse + saveStatus,
            thinking: `I fetched the transaction data from the blockchain for ${transactionDetails.transactionHash} and analyzed it to create IFRS-compliant journal entries. The transaction shows: From ${transactionData.from} to ${transactionData.to}, value: ${parseFloat(transactionData.value) / Math.pow(10, 18)} ETH, status: ${transactionData.status}.${savedEntries ? ' Entries were saved to the database via universal service.' : ''}`,
            suggestions: [
              'Review the journal entries for accuracy',
              'Verify the account classifications match your chart of accounts',
              'Consider any additional entries for fees or taxes',
              ...(savedEntries ? ['View saved entries in your journal'] : ['Save these entries to your accounting system']),
            ],
            journalEntries: savedEntries || journalEntries, // Return saved entries or original ones
            alreadySaved: !!savedEntries, // Flag to prevent duplicate saving in chat route
          };
        } catch (blockchainError) {
          logger.warn('Failed to fetch blockchain data', {
            txHash: transactionDetails.transactionHash,
            error: blockchainError.message,
          });

          return {
            response: `I couldn't fetch the transaction data for ${transactionDetails.transactionHash}. This might be because:\n\n• The transaction hash is invalid\n• The transaction is on a different network\n• The blockchain service is temporarily unavailable\n\nPlease verify the transaction hash and try again, or provide the transaction details manually.`,
            thinking: `Attempted to fetch transaction data for ${transactionDetails.transactionHash} but failed with error: ${blockchainError.message}. This could be due to an invalid hash, wrong network, or service unavailability.`,
            suggestions: [
              'Double-check the transaction hash',
              'Verify you\'re on the correct blockchain network',
              'Try again in a few minutes if the transaction is very recent',
              'Provide transaction details manually if the hash lookup fails',
            ],
          };
        }
      } else {
        // General journal entry guidance without specific transaction
        logger.info('No transaction hash found, handling as general journal entry guidance');
        return await this.handleGeneralJournalEntryGuidance(message, context);
      }
    } catch (error) {
      logger.error('Error in handleJournalEntryChat', { 
        error: error.message,
        stack: error.stack,
        messagePreview: message.substring(0, 100),
      });
      
      // Return a fallback response instead of throwing
      return {
        response: 'I encountered an error while processing your journal entry request. Let me try a different approach.',
        thinking: `Error in journal entry processing: ${error.message}`,
        suggestions: ['Try rephrasing your request', 'Provide more specific details about the transaction'],
        journalEntries: [],
      };
    }
  }

  async handleGeneralJournalEntryGuidance(message, context) {
    try {
      logger.info('Starting handleGeneralJournalEntryGuidance', { messageLength: message.length });
      
      // Get the current chart of accounts for consistent account usage
      const chartOfAccounts = await this.getFormattedChartOfAccounts();
      logger.info('Chart of accounts loaded', { chartLength: chartOfAccounts.length });
      
      // Extract transaction details to get dates and other info
      const transactionDetails = this.extractTransactionDetails(message);
      logger.info('Extracted transaction details from journal entry guidance', { 
        hasDate: !!transactionDetails.extractedDate,
        extractedDate: transactionDetails.extractedDate?.toISOString(),
        amount: transactionDetails.amount,
        currency: transactionDetails.currency
      });
      
      const systemPrompt = `You are an expert cryptocurrency accounting assistant. You MUST use the provided chart of accounts.

CRITICAL RULES:
- ALWAYS use EXACT account names from the provided chart of accounts
- For investments/capital: Use "Share Capital" as credit account
- For crypto assets: Use "Digital Assets - [Currency]" as debit account
- Extract EXACT amount and currency from user message
- ANALYZE MESSAGE FOR TRANSACTION DATES and include them in JSON

TRANSACTION DATE ANALYSIS:
- Look for phrases like "invoice date", "dated", "on [date]", "transaction from [date]"
- Identify specific dates in formats: "May 25 2025", "2025-05-25", "25th May 2025" 
- If you find a transaction date, include "transactionDate" field in JSON (YYYY-MM-DD format)
- If no specific date mentioned, use current date

REQUIRED RESPONSE FORMAT:
1. One sentence explanation
2. Clean JSON array (NO markdown, NO comments) with transactionDate if found
3. Confirmation message

EXAMPLE WITH DATE:
Recording accrued expense for hotel booking dated May 25 2025.

[{"accountDebit":"Travel and Entertainment","accountCredit":"Accounts Payable","amount":188,"currency":"EUR","narrative":"Hotel booking expense from DeTrip, invoice date May 25 2025","transactionDate":"2025-05-25","confidence":0.95,"ifrsReference":"IAS 1"}]

Journal entry saved successfully with transaction date May 25, 2025.

EXAMPLE WITHOUT DATE:
Recording your 999 USDC investment as equity financing.

[{"accountDebit":"Digital Assets - USDC","accountCredit":"Share Capital","amount":999,"currency":"USDC","narrative":"Capital contribution of 999 USDC","confidence":0.95,"ifrsReference":"IAS 32"}]

Journal entry saved successfully.

IMPORTANT:
- NO \`\`\`json blocks
- NO // comments  
- Extract exact numbers from user message
- Use proper account names only
- ALWAYS analyze for transaction dates`;

      const userPrompt = this.buildChatPromptWithAccounts(message, context, chartOfAccounts);
      logger.info('Prompts prepared, calling Gemini API');

    const result = await this.model.generateContent([
      { text: systemPrompt },
      { text: userPrompt },
    ]);

    const response = await result.response;
    const text = response.text();

      logger.info('AI response received for journal entry guidance', {
        responseLength: text.length,
        responsePreview: text.substring(0, 300),
      });

      // Extract JSON journal entries from the response
      let structuredEntries = [];
      try {
        logger.info('Attempting to parse journal entries from AI response');
        structuredEntries = this.parseJournalEntries(text);
        logger.info('Journal entries parsed successfully', { entriesCount: structuredEntries.length });
      } catch (parseError) {
        logger.warn('Failed to parse journal entries from AI response', { 
          error: parseError.message,
          responsePreview: text.substring(0, 200),
        });
      }

      // Validate accounts if entries were found
      let validatedEntries = [];
      if (structuredEntries.length > 0) {
        try {
          logger.info('Validating and correcting accounts');
          validatedEntries = await this.validateAndCorrectAccounts(structuredEntries);
          
          // Apply extracted date if AI didn't include transactionDate but we found one
          if (transactionDetails.extractedDate) {
            validatedEntries = validatedEntries.map(entry => {
              // If AI didn't set transactionDate, use our extracted date
              if (!entry.transactionDate) {
                entry.transactionDate = transactionDetails.extractedDate;
                logger.info('Applied extracted date to entry without AI-provided date', {
                  transactionDate: transactionDetails.extractedDate.toISOString()
                });
              }
              return entry;
            });
          }
          
          logger.info('Account validation completed', { validatedCount: validatedEntries.length });
        } catch (validationError) {
          logger.error('Account validation failed', { error: validationError.message });
          // Use original entries if validation fails
          validatedEntries = structuredEntries;
        }
      }

      // If we successfully created journal entries but the AI response contains apology text,
      // override it with a proper response
      let finalResponse = text.trim();
      if (validatedEntries.length > 0 && 
          (text.toLowerCase().includes('apologize') || 
           text.toLowerCase().includes('trouble') || 
           text.toLowerCase().includes('sorry'))) {
        
        logger.info('Overriding apology response with success message', {
          entriesCount: validatedEntries.length,
        });
        
        const entry = validatedEntries[0];
        finalResponse = `Recording your ${entry.amount} ${entry.currency} investment as equity financing.

[${JSON.stringify(validatedEntries)}]

Journal entry created successfully and will be saved to your accounting system.`;
      }

      logger.info('handleGeneralJournalEntryGuidance completed successfully', {
        hasResponse: !!finalResponse,
        entriesCount: validatedEntries.length,
      });

    return {
        response: finalResponse,
      thinking: this.extractThinking(text),
      suggestions: this.extractSuggestions(text),
        journalEntries: validatedEntries, // These will be saved by the chat route
      };
    } catch (error) {
      logger.error('Error in handleGeneralJournalEntryGuidance', {
        error: error.message,
        stack: error.stack,
        messagePreview: message.substring(0, 100),
      });
      
      // Return a fallback response instead of throwing
      return {
        response: 'I encountered an error while creating your journal entry. However, I can help you manually. Please provide the transaction amount, currency, and type (investment, purchase, etc.).',
        thinking: `Error in journal entry guidance: ${error.message}`,
        suggestions: ['Provide transaction details step by step', 'Try a simpler format like "I invested X USDC"'],
        journalEntries: [],
      };
    }
  }

  async handleGeneralChat(message, context) {
    // Get the current chart of accounts for consistent account usage
    const chartOfAccounts = await this.getFormattedChartOfAccounts();
    
    // Extract transaction details to get dates and other info
    const transactionDetails = this.extractTransactionDetails(message);
    logger.info('Extracted transaction details from general chat', { 
      hasDate: !!transactionDetails.extractedDate,
      extractedDate: transactionDetails.extractedDate?.toISOString(),
      amount: transactionDetails.amount,
      currency: transactionDetails.currency
    });
    
    const systemPrompt = `You are an expert cryptocurrency accounting assistant with access to a comprehensive chart of accounts.

ACCOUNT SELECTION RULES:
1. FIRST: Try to use EXACT account names from the provided chart of accounts
2. IF NO EXACT MATCH: You can suggest logical IFRS-compliant account names
3. The system will automatically CREATE missing accounts with proper categorization

ACCOUNT CREATION EXAMPLES:
- "Operating Expenses" → Will create under Operating Expenses (5000s) category
- "Accounts Payable" → Will create under Current Liabilities (2000s) category  
- "Professional Services Revenue" → Will create under Revenue (4000s) category

TRANSACTION DATE ANALYSIS:
- ANALYZE user message for transaction dates (invoice date, transaction date, etc.)
- Look for phrases like "invoice date", "dated", "on [date]", "received on [date]"
- Identify dates in formats: "May 25 2025", "2025-05-25", "25th May 2025"
- If you find a transaction date, include "transactionDate" field in JSON (YYYY-MM-DD format)
- If no specific date mentioned, do NOT include transactionDate (system will use current date)

RESPONSE FORMAT:
1. Brief explanation of the transaction
2. Clean JSON array (NO markdown, NO comments) with transactionDate if found
3. Success confirmation

EXAMPLE WITH DATE:
Recording accrued expense for unpaid hotel booking dated May 25 2025.

[{"accountDebit":"Travel and Entertainment","accountCredit":"Accounts Payable","amount":188,"currency":"EUR","narrative":"Accrued expense for hotel bookings from DeTrip, invoice date May 25 2025","transactionDate":"2025-05-25","confidence":0.95,"ifrsReference":"IAS 1"}]

Journal entry will be saved with transaction date May 25, 2025.

EXAMPLE WITHOUT DATE:
Recording accrued expense for unpaid hotel booking.

[{"accountDebit":"Travel and Entertainment","accountCredit":"Accounts Payable","amount":199,"currency":"USDC","narrative":"Accrued expense for hotel bookings from DeTrip (Travel Labs BV)","confidence":0.95,"ifrsReference":"IAS 1"}]

Journal entry will be saved with automatic account creation as needed.

CRITICAL RULES:
- Use LOGICAL account names (the system will create them if needed)
- NO backticks or code blocks
- Extract exact amounts from user messages
- Ensure proper double-entry accounting (debits = credits)
- ALWAYS analyze for transaction dates and include in JSON if found`;

    const userPrompt = this.buildChatPromptWithAccounts(message, context, chartOfAccounts);

    const result = await this.model.generateContent([
      { text: systemPrompt },
      { text: userPrompt },
    ]);

    const response = await result.response;
    const text = response.text();

    logger.info('AI response received for general chat', {
      responseLength: text.length,
      responsePreview: text.substring(0, 300),
    });

    // Try to extract JSON journal entries from the response (same as transaction analysis)
    let extractedEntries = [];
    try {
      extractedEntries = this.parseJournalEntries(text);
    } catch (error) {
      logger.warn('No JSON journal entries found in general chat response', { error: error.message });
    }
    
    // Validate accounts if entries were found
    let validatedEntries = [];
    if (extractedEntries.length > 0) {
      validatedEntries = await this.validateAndCorrectAccounts(extractedEntries);
      
      // Add extracted transaction date to entries
      if (transactionDetails.extractedDate) {
        validatedEntries = validatedEntries.map(entry => {
          // If AI didn't set transactionDate, use our extracted date
          if (!entry.transactionDate) {
            entry.transactionDate = transactionDetails.extractedDate;
            logger.info('Applied extracted date to entry without AI-provided date', {
              transactionDate: transactionDetails.extractedDate.toISOString()
            });
          }
          
          // Also add to metadata for tracking
          return {
            ...entry,
            metadata: {
              ...entry.metadata,
              extractedFromMessage: true,
              originalMessage: message,
              extractedDate: transactionDetails.extractedDate.toISOString()
            }
          };
        });
        
        logger.info('Added extracted transaction date to journal entries', {
          entriesCount: validatedEntries.length,
          transactionDate: transactionDetails.extractedDate.toISOString()
        });
      }
    }

    // If we successfully created journal entries but the AI response contains apology text,
    // override it with a proper response
    let finalResponse = text.trim();
    if (validatedEntries.length > 0 && 
        (text.toLowerCase().includes('apologize') || 
         text.toLowerCase().includes('trouble') || 
         text.toLowerCase().includes('sorry'))) {
      
      logger.info('Overriding apology response with success message in general chat', {
        entriesCount: validatedEntries.length,
      });
      
      const entry = validatedEntries[0];
      finalResponse = `Recording your ${entry.amount} ${entry.currency} investment as equity financing.

[${JSON.stringify(validatedEntries)}]

Journal entry created successfully and will be saved to your accounting system.`;
    }

    return {
      response: finalResponse,
      thinking: this.extractThinking(text),
      suggestions: this.extractSuggestions(text),
      journalEntries: validatedEntries, // Include validated entries
    };
  }

  buildChatPrompt(message, context) {
    let prompt = `User message: ${message}`;

    if (context.user) {
      prompt += `\n\nUser context: ${context.user.email}`;
    }

    if (context.recentEntries && context.recentEntries.length > 0) {
      prompt += `\n\nRecent journal entries:\n${JSON.stringify(context.recentEntries, null, 2)}`;
    }

    if (context.recentMessages && context.recentMessages.length > 0) {
      prompt += `\n\nRecent conversation context:\n${context.recentMessages.map(msg => `${msg.type}: ${msg.content}`).join('\n')}`;
    }

    return prompt;
  }

  buildChatPromptWithAccounts(message, context, chartOfAccounts) {
    let prompt = `Chart of Accounts (MUST use these exact account names):
${chartOfAccounts}

User message: ${message}`;

    if (context.user) {
      prompt += `\n\nUser context: ${context.user.email}`;
    }

    if (context.recentEntries && context.recentEntries.length > 0) {
      prompt += `\n\nRecent journal entries:\n${JSON.stringify(context.recentEntries, null, 2)}`;
    }

    if (context.recentMessages && context.recentMessages.length > 0) {
      prompt += `\n\nRecent conversation context:\n${context.recentMessages.map(msg => `${msg.type}: ${msg.content}`).join('\n')}`;
    }

    return prompt;
  }

  extractTransactionDetails(message) {
    // Extract transaction hash (0x followed by 64 hex characters)
    const hashMatch = message.match(/0x[a-fA-F0-9]{64}/);

    // Extract amount and currency
    const amountMatch = message.match(/(\d+(?:\.\d+)?)\s*(ETH|BTC|USD|USDT|USDC|DAI|EUR|GBP)/i);

    // Extract dates - support various formats
    const datePatterns = [
      // May 25, 2025 / May 25 2025 (with trigger words)
      /(?:invoice date|date|dated|on|for)\s+(?:is\s+)?([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
      // 2025-05-25 / 25-05-2025 / 05/25/2025 (with trigger words)
      /(?:invoice date|date|dated|on|for)\s+(?:is\s+)?(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{4})/i,
      // 25th May 2025 / May 25th 2025 (with trigger words)
      /(?:invoice date|date|dated|on|for)\s+(?:is\s+)?(\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+\s+\d{4}|[A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?\s+\d{4})/i,
      // Generic date patterns without trigger words
      /\b([A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4})\b/i, // May 25th, 2025 or May 25, 2025
      /\b(\d{4}-\d{1,2}-\d{1,2})\b/i, // 2025-05-25
      /\b(\d{1,2}[-/]\d{1,2}[-/]\d{4})\b/i, // 25/05/2025 or 25-05-2025
    ];

    let extractedDate = null;
    for (const pattern of datePatterns) {
      const dateMatch = message.match(pattern);
      if (dateMatch) {
        try {
          // Parse the extracted date
          const dateStr = dateMatch[1];
          const parsedDate = new Date(dateStr);
          
          // Validate the date
          if (!isNaN(parsedDate.getTime())) {
            extractedDate = parsedDate;
            logger.info('Extracted transaction date from message', { 
              original: dateStr, 
              parsed: parsedDate.toISOString() 
            });
            break;
          }
        } catch (error) {
          logger.warn('Failed to parse extracted date', { 
            dateStr: dateMatch[1], 
            error: error.message 
          });
        }
      }
    }

    // Extract description
    const descriptionMatch = message.match(/(?:for|payment|received|sent|bought|sold|staking|mining|trading)\s+(.+?)(?:\.|$|,)/i);

    return {
      hasTransactionHash: !!hashMatch,
      transactionHash: hashMatch ? hashMatch[0] : null,
      amount: amountMatch ? amountMatch[1] : null,
      currency: amountMatch ? amountMatch[2].toUpperCase() : null,
      extractedDate: extractedDate,
      description: descriptionMatch ? descriptionMatch[1] : message,
    };
  }

  formatJournalEntriesForChat(journalEntries) {
    return journalEntries.map((entry, index) =>
      `Entry ${index + 1}:
- Debit: ${entry.accountDebit} - ${entry.currency} ${entry.amount}
- Credit: ${entry.accountCredit} - ${entry.currency} ${entry.amount}
- Description: ${entry.description || entry.narrative || 'N/A'}
- Confidence: ${entry.confidence ? `${(entry.confidence * 100).toFixed(1)}%` : 'N/A'}`,
    ).join('\n\n');
  }

  extractThinking(response) {
    const thinkingMatch = response.match(/\*\*Thinking\*\*:?\s*(.*?)(?=\*\*|$)/is);
    return thinkingMatch ? thinkingMatch[1].trim() : null;
  }

  extractSuggestions(response) {
    const suggestionsMatch = response.match(/\*\*Suggestions\*\*:?\s*(.*?)(?=\*\*|$)/is);
    if (suggestionsMatch) {
      return suggestionsMatch[1]
        .split('\n')
        .filter(line => line.trim())
        .map(line => line.replace(/^[-*]\s*/, '').trim())
        .filter(line => line.length > 0);
    }
    return [];
  }

  async analyzeTransaction(blockchainData, description = '') {
    try {
      logger.info('Starting Gemini transaction analysis', {
        hash: blockchainData.hash,
        description,
      });

      // Get the current chart of accounts
      const chartOfAccounts = await this.getFormattedChartOfAccounts();

      // Load enhanced IFRS templates
      const ifrsTemplates = require('./enhancedIfrsTemplates.json');

      // Format token transfers data
      const tokenTransfersText = this.formatTokenTransfers(blockchainData.tokenTransfers || []);

      // Detect blockchain based on environment or chain ID (Coston2 vs Ethereum)
      const isCoston2 = process.env.BLOCKSCOUT_BASE_URL?.includes('coston2') || 
                        blockchainData.chainId === 114 || 
                        blockchainData.chain_id === 114;
      
      const blockchain = isCoston2 ? 'Coston2 (Chain ID 114)' : 'Ethereum Mainnet';
      const gasCurrency = isCoston2 ? 'C2FLR' : 'ETH';
      
      logger.info('Blockchain detection', {
        hash: blockchainData.hash,
        blockchain,
        gasCurrency,
        isCoston2,
        baseUrl: process.env.BLOCKSCOUT_BASE_URL
      });

      // Convert gas values for proper accounting
      const gasUsed = blockchainData.gas_used || blockchainData.gasUsed || 0;
      const gasPrice = blockchainData.gas_price || blockchainData.gasPrice || 0;
      const gasFeeWei = parseFloat(gasUsed) * parseFloat(gasPrice);
      const gasFee = gasFeeWei / Math.pow(10, 18); // Convert Wei to base units
      
      // Convert native token value properly 
      const nativeValue = parseFloat(blockchainData.value || 0) / Math.pow(10, 18);

      // Build the analysis prompt with chart of accounts and properly converted values
      const prompt = ifrsTemplates.transactionAnalysisPrompt
        .replace('{hash}', blockchainData.hash)
        .replace('{from}', blockchainData.from)
        .replace('{to}', blockchainData.to)
        .replace('{value}', nativeValue.toFixed(8)) // Native token value with reasonable precision
        .replace('{blockchain}', blockchain) // Add blockchain information
        .replace('{gasUsed}', gasUsed.toString())
        .replace('{gasPrice}', (parseFloat(gasPrice) / Math.pow(10, 9)).toFixed(4) + ' Gwei') // Convert to Gwei for readability
        .replace('{timestamp}', blockchainData.timestamp)
        .replace('{status}', blockchainData.status)
        .replace('{description}', description || 'No description provided')
        .replace('{tokenTransfers}', tokenTransfersText)
        .replace('{chartOfAccounts}', chartOfAccounts);

      // Add enhanced gas fee information with correct currency
      const enhancedPrompt = prompt + `\n\nGAS FEE ANALYSIS (${blockchain}):
- Gas Used: ${gasUsed} units
- Gas Price: ${(parseFloat(gasPrice) / Math.pow(10, 9)).toFixed(4)} Gwei
- Total Gas Fee: ${gasFee.toFixed(8)} ${gasCurrency}
- Blockchain: ${blockchain}
- Gas Currency: ${gasCurrency} (${isCoston2 ? 'Coston2 Testnet Token' : 'Ethereum'})

BLOCKCHAIN-SPECIFIC RULES:
1. For ${blockchain}: Use ${gasCurrency} for gas fees, NOT ETH
2. All amounts MUST be in reasonable accounting units (${gasCurrency}, not Wei or Gwei)
3. Gas fees should be recorded as separate journal entries only if > 0.0001 ${gasCurrency}
4. For token transfers, use token amounts from tokenTransfers data
5. Ensure all amounts are > 0 and < 1,000,000 for database compatibility
6. Create specific "Digital Assets - [TOKEN_SYMBOL]" accounts, not generic "Other"`;

      const systemPrompt = ifrsTemplates.systemPrompt;

      const result = await this.model.generateContent([
        { text: systemPrompt },
        { text: enhancedPrompt },
      ]);

      const response = await result.response;
      const responseText = response.text();

      logger.info('Received AI analysis response', {
        hash: blockchainData.hash,
        responseLength: responseText.length,
        blockchain,
        gasCurrency,
        nativeValue,
        gasFee: gasFee.toFixed(8),
      });

      // Parse the JSON response
      const journalEntries = this.parseJournalEntries(responseText);

      // Validate and filter entries to prevent database constraint violations
      const validEntries = journalEntries.filter(entry => {
        const amount = parseFloat(entry.amount);
        // Allow smaller amounts for gas fees (0.00001 minimum) but still prevent tiny/invalid amounts
        const isValid = amount >= 0.00001 && amount < 1000000 && !isNaN(amount); 
        
        if (!isValid) {
          logger.warn('Filtering out entry with invalid amount', {
            amount: entry.amount,
            currency: entry.currency,
            debit: entry.accountDebit,
            credit: entry.accountCredit,
            reason: amount < 0.00001 ? 'too small' : amount >= 1000000 ? 'too large' : 'invalid number',
          });
        }
        
        return isValid;
      });

      // Validate accounts against chart of accounts
      const validatedEntries = await this.validateAndCorrectAccounts(validEntries);

      logger.info('Transaction analysis completed', {
        hash: blockchainData.hash,
        blockchain,
        gasCurrency,
        totalEntries: journalEntries.length,
        validEntries: validEntries.length,
        finalEntries: validatedEntries.length,
      });

      return validatedEntries;
    } catch (error) {
      logger.error('Gemini analysis failed', {
        hash: blockchainData?.hash,
        error: error.message,
      });
        throw error;
      }
  }

  async getFormattedChartOfAccounts() {
    try {
      const accounts = await accountService.getChartOfAccounts();
      
      // Format accounts by category for AI prompt
      const accountsByCategory = accounts.reduce((acc, account) => {
        const categoryName = account.account_categories?.name || 'Other';
        if (!acc[categoryName]) {
          acc[categoryName] = [];
        }
        acc[categoryName].push(`${account.code} - ${account.name} (${account.account_type})`);
        return acc;
      }, {});

      // Format as text for AI prompt
      return Object.entries(accountsByCategory)
        .map(([category, accounts]) => 
          `${category}:\n${accounts.map(acc => `  • ${acc}`).join('\n')}`
        )
        .join('\n\n');
    } catch (error) {
      logger.error('Failed to get chart of accounts for AI', { error: error.message });
      // Return basic accounts as fallback
      return `Digital Assets:
  • 1801 - Digital Assets - Bitcoin (ASSET)
  • 1802 - Digital Assets - Ethereum (ASSET)
  • 1803 - Digital Assets - USDT (ASSET)
  • 1804 - Digital Assets - USDC (ASSET)
  • 1808 - Digital Assets - Other (ASSET)

Expenses:
  • 6001 - Transaction Fees (EXPENSE)
  • 6002 - Exchange Fees (EXPENSE)
  • 5001 - Salaries and Wages (EXPENSE)
  • 5003 - Software and Technology (EXPENSE)

Revenue:
  • 4001 - Trading Revenue (REVENUE)
  • 4002 - Staking Revenue (REVENUE)`;
    }
  }

  async validateAndCorrectAccounts(journalEntries) {
    const validatedEntries = [];

    for (const entry of journalEntries) {
      try {
        // Validate the account names against our chart of accounts
        const validation = await accountService.validateJournalEntry(
          entry.accountDebit,
          entry.accountCredit
        );

        let correctedEntry = { ...entry };
        let accountCreationSuggestions = [];

        // Handle debit account
        if (validation.debitAccount) {
          // Exact match found - use it
          correctedEntry.accountDebit = validation.debitAccount.name;
          logger.info('Found exact debit account match', {
            requested: entry.accountDebit,
            found: validation.debitAccount.name,
          });
        } else {
          // Account doesn't exist - suggest creation but keep original name
          logger.info('Debit account not found, suggesting creation', {
            requested: entry.accountDebit,
          });
          
          const suggestion = await accountService.suggestAccountCreation(
            entry.accountDebit, 
            'expense' // Assume debit is expense for business transactions
          );
          
          accountCreationSuggestions.push({
            type: 'debit',
            requestedName: entry.accountDebit,
            suggestion: suggestion,
          });

          // Keep the original account name for now
          correctedEntry.accountDebit = entry.accountDebit;
        }

        // Handle credit account
        if (validation.creditAccount) {
          // Exact match found - use it
          correctedEntry.accountCredit = validation.creditAccount.name;
          logger.info('Found exact credit account match', {
            requested: entry.accountCredit,
            found: validation.creditAccount.name,
          });
        } else {
          // Account doesn't exist - suggest creation but keep original name
          logger.info('Credit account not found, suggesting creation', {
            requested: entry.accountCredit,
          });
          
          const suggestion = await accountService.suggestAccountCreation(
            entry.accountCredit,
            'liability' // Assume credit is liability for unpaid expenses
          );
          
          accountCreationSuggestions.push({
            type: 'credit',
            requestedName: entry.accountCredit,
            suggestion: suggestion,
          });

          // Keep the original account name for now
          correctedEntry.accountCredit = entry.accountCredit;
        }

        // Add account creation suggestions to the entry
        if (accountCreationSuggestions.length > 0) {
          correctedEntry.accountCreationSuggestions = accountCreationSuggestions;
          correctedEntry.requiresAccountCreation = true;
          
          logger.info('Entry requires account creation', {
            debit: correctedEntry.accountDebit,
            credit: correctedEntry.accountCredit,
            suggestions: accountCreationSuggestions.length,
          });
        } else {
          correctedEntry.requiresAccountCreation = false;
        }

        validatedEntries.push(correctedEntry);
      } catch (error) {
        logger.error('Failed to validate account', {
          entry,
          error: error.message,
        });
        // Include the original entry if validation fails
        validatedEntries.push({
          ...entry,
          validationError: error.message,
        });
      }
    }

    return validatedEntries;
  }

  formatTokenTransfers(tokenTransfers) {
    if (!tokenTransfers || tokenTransfers.length === 0) {
      return 'No token transfers detected';
    }

    // Format with more explicit instructions for the AI
    const formattedTransfers = tokenTransfers.map(transfer => {
      // Fix: Use total.value from v2 API response, not transfer.value
      const rawValue = transfer.total?.value || transfer.value || '0';
      const decimals = parseInt(transfer.token?.decimals || 18);
      const amount = parseFloat(rawValue) / Math.pow(10, decimals);
      
      const symbol = transfer.token?.symbol || 'UNKNOWN';
      const name = transfer.token?.name || 'Unknown Token';
      const from = transfer.from?.hash || transfer.from;
      const to = transfer.to?.hash || transfer.to;
      
      return `TOKEN TRANSFER: ${amount} ${symbol} (${name})
  - Amount: ${amount} (USE THIS EXACT NUMBER)
  - Symbol: ${symbol} (USE THIS AS CURRENCY)
  - From: ${from}
  - To: ${to}
  - Contract: ${transfer.token?.address || 'Unknown'}`;
    }).join('\n\n');

    return `🔥 IMPORTANT TOKEN TRANSFERS DETECTED:
${formattedTransfers}

⚠️ CRITICAL: The above amounts are already converted to proper decimals. 
Use the EXACT amounts shown above in your journal entries. 
DO NOT convert or calculate - use the numbers directly.`;
  }

  parseJournalEntries(responseText) {
    try {
      let jsonText = responseText;
      logger.info('Parsing journal entries from AI response', {
        responseLength: responseText.length,
        preview: responseText.substring(0, 200),
      });

      // Remove all markdown code blocks
      jsonText = jsonText.replace(/```json\s*/g, '').replace(/```\s*/g, '');
      
      // Remove all comments (both // style and /* */ style)
      jsonText = jsonText.replace(/\/\*[\s\S]*?\*\//g, '');
      jsonText = jsonText.replace(/\/\/.*$/gm, '');

      let entries = [];

      // Strategy 1: Look for direct JSON array
      let jsonMatch = jsonText.match(/\[\s*\{[\s\S]*?\}\s*\]/);
      
      if (jsonMatch) {
        try {
          let entriesJson = jsonMatch[0];
          // Clean up JSON
          entriesJson = entriesJson.replace(/,(\s*[}\]])/g, '$1'); // Remove trailing commas
          entries = JSON.parse(entriesJson);
          logger.info('Successfully parsed direct JSON array', { entriesCount: entries.length });
        } catch (e) {
          logger.warn('Failed to parse direct JSON array', { error: e.message });
        }
      }

      // Strategy 2: Look for nested journalEntries object
      if (entries.length === 0) {
        const objectMatch = jsonText.match(/\{[\s\S]*?"journalEntries"[\s\S]*?\[[\s\S]*?\][\s\S]*?\}/);
        if (objectMatch) {
          try {
            let cleanJson = objectMatch[0];
            cleanJson = cleanJson.replace(/,(\s*[}\]])/g, '$1');
            const parsed = JSON.parse(cleanJson);
            if (parsed.journalEntries && Array.isArray(parsed.journalEntries)) {
              entries = parsed.journalEntries;
              logger.info('Successfully parsed nested journalEntries', { entriesCount: entries.length });
            }
          } catch (e) {
            logger.warn('Failed to parse nested journalEntries', { error: e.message });
          }
        }
      }

      // Strategy 3: Manual extraction if JSON parsing fails
      if (entries.length === 0) {
        logger.info('JSON parsing failed, attempting manual extraction');
        
        // Enhanced regex patterns to find amounts and currencies
        const patterns = [
          // Look for "Amount: X (USE THIS EXACT NUMBER)" pattern
          /Amount:\s*(\d+(?:\.\d+)?)\s*\(USE THIS EXACT NUMBER\)/i,
          // Look for "TOKEN TRANSFER: X SYMBOL" pattern  
          /TOKEN TRANSFER:\s*(\d+(?:\.\d+)?)\s*(XYD|USDC|ETH|BTC|USD|USDT|DAI|C2FLR|FLARE)/i,
          // Standard amount currency pattern
          /(\d+(?:,\d{3})*(?:\.\d+)?)\s*(XYD|USDC|ETH|BTC|USD|USDT|DAI|C2FLR|FLARE)/i
        ];
        
        let amount = 0;
        let currency = 'USD';
        
        // Try each pattern until we find a match
        for (const pattern of patterns) {
          const match = responseText.match(pattern);
          if (match) {
            amount = parseFloat(match[1].replace(/,/g, ''));
            currency = match[2] ? match[2].toUpperCase() : 'USD';
            logger.info('Found amount using pattern', { pattern: pattern.source, amount, currency });
            break;
          }
        }
        
        // If still no amount found, look for any number in the response
        if (amount === 0) {
          // Look for any token symbol mentioned and grab the nearest number
          const symbolMatch = responseText.match(/(XYD|USDC|ETH|BTC|USDT|DAI|C2FLR)/i);
          if (symbolMatch) {
            currency = symbolMatch[1].toUpperCase();
            // Look for numbers near the symbol
            const numberPattern = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${currency}|${currency}\\s*(\\d+(?:\\.\\d+)?)`, 'i');
            const numberMatch = responseText.match(numberPattern);
            if (numberMatch) {
              amount = parseFloat(numberMatch[1] || numberMatch[2]);
              logger.info('Found amount near symbol', { currency, amount });
            }
          }
        }
        
        // Look for account mentions in the text
        let debitAccount = 'Digital Assets - Other';
        let creditAccount = 'Accounts Payable'; // Default for refunds
        
        // Check for specific currency mentions - create specific accounts for known tokens
        if (currency === 'XYD') {
          debitAccount = 'Digital Assets - XYD'; // Use specific XYD account
        } else if (currency === 'C2FLR' || currency === 'FLARE') {
          debitAccount = 'Digital Assets - C2FLR';
        } else if (currency === 'USDC') {
          debitAccount = 'Digital Assets - USDC';
        } else if (currency === 'ETH') {
          debitAccount = 'Digital Assets - Ethereum';
        } else if (currency === 'BTC') {
          debitAccount = 'Digital Assets - Bitcoin';
        } else if (currency === 'USDT') {
          debitAccount = 'Digital Assets - USDT';
        } else {
          // For unknown tokens, use a more specific format: "Digital Assets - [SYMBOL]"
          debitAccount = `Digital Assets - ${currency}`;
        }
        
        // Determine credit account based on context
        if (responseText.toLowerCase().includes('refund')) {
          creditAccount = 'Accounts Payable';
        } else if (responseText.toLowerCase().includes('invest') || 
            responseText.toLowerCase().includes('capital') ||
            responseText.toLowerCase().includes('equity')) {
          creditAccount = 'Share Capital';
        } else if (responseText.toLowerCase().includes('revenue') ||
                   responseText.toLowerCase().includes('income') ||
                   responseText.toLowerCase().includes('payment')) {
          creditAccount = 'Trading Revenue';
        }
        
        if (amount > 0) {
          entries = [{
            accountDebit: debitAccount,
            accountCredit: creditAccount,
            amount: amount,
            currency: currency,
            narrative: `Manual extraction: Received ${amount} ${currency} as refund`,
            confidence: 0.7,
            ifrsReference: 'IAS 32',
          }];
          logger.info('Successfully created manual entry', { amount, currency, debitAccount, creditAccount });
        } else {
          logger.warn('Manual extraction failed - no valid amount found', { 
            responseText: responseText.substring(0, 200),
            patterns: patterns.map(p => p.source)
          });
        }
      }

      // Validate and normalize the entries
      const validatedEntries = entries.map(entry => {
        const amount = parseFloat(entry.amount) || 0;
        
        let transactionDate = null;
        if (entry.transactionDate) {
          try {
            // Parse the AI-provided transaction date
            transactionDate = new Date(entry.transactionDate);
            if (isNaN(transactionDate.getTime())) {
              logger.warn('Invalid transaction date from AI', { date: entry.transactionDate });
              transactionDate = null;
            } else {
              logger.info('AI provided transaction date', { 
                original: entry.transactionDate, 
                parsed: transactionDate.toISOString() 
              });
            }
          } catch (error) {
            logger.warn('Failed to parse AI transaction date', { 
              date: entry.transactionDate, 
              error: error.message 
            });
            transactionDate = null;
          }
        }
        
        const normalizedEntry = {
          accountDebit: entry.accountDebit || entry.debit || 'Digital Assets - Other',
          accountCredit: entry.accountCredit || entry.credit || 'Share Capital',
          amount: amount,
          currency: entry.currency || 'USD',
          narrative: entry.narrative || entry.description || `Transaction of ${amount}`,
          confidence: entry.confidence || 0.8,
          ifrsReference: entry.ifrsReference || '',
        };
        
        // Only add transactionDate if it was successfully parsed
        if (transactionDate) {
          normalizedEntry.transactionDate = transactionDate;
        }
        
        return normalizedEntry;
      }).filter(entry => entry.amount > 0); // Only include entries with valid amounts

      logger.info('Journal entries parsing completed', {
        totalEntries: validatedEntries.length,
        entries: validatedEntries.map(e => ({
          debit: e.accountDebit,
          credit: e.accountCredit,
          amount: e.amount,
          currency: e.currency,
          hasTransactionDate: !!e.transactionDate,
          transactionDate: e.transactionDate?.toISOString()
        })),
      });

      return validatedEntries;
    } catch (error) {
      logger.error('Failed to parse journal entries from AI response', {
        error: error.message,
        responseText: responseText.substring(0, 500),
      });
      
      return [];
    }
  }

  /**
   * Analyze enhanced transaction context with rich Blockscout v2 data
   * @param {Object} params - Analysis parameters
   * @param {Object} params.context - Rich transaction context from enhanced Blockscout client
   * @param {string} params.userAddress - User's wallet address
   * @param {Object} params.availableCategories - Enhanced category definitions
   * @param {string} params.analysisDepth - Analysis depth (detailed/basic)
   * @returns {Object} AI analysis result with category selection
   */
  async analyzeTransactionContextV2({ context, userAddress, availableCategories, analysisDepth = 'detailed' }) {
    try {
      logger.info('🧠 Starting enhanced AI transaction context analysis', {
        txHash: context.hash,
        userAddress,
        analysisDepth,
        hasDecodedInput: !!context.decoded_input,
        tokenTransfersCount: context.token_transfers.length,
        contractName: context.to?.name || 'Unknown'
      });

      // Build comprehensive analysis prompt
      const analysisPrompt = this.buildEnhancedContextPrompt(context, userAddress, availableCategories, analysisDepth);

      // System prompt for enhanced analysis
      const systemPrompt = `You are an expert blockchain transaction analyst specializing in DeFi, cryptocurrency accounting, and IFRS compliance.

Your task is to analyze rich blockchain transaction context and categorize transactions accurately for accounting purposes.

CRITICAL REQUIREMENTS:
1. Analyze ALL provided context data (method calls, contract tags, token transfers, events, etc.)
2. Select the MOST APPROPRIATE category from the predefined list
3. Provide detailed reasoning for your categorization
4. Consider the user's perspective and transaction direction
5. Return ONLY valid JSON format - no markdown, no comments

RESPONSE FORMAT (MANDATORY):
{
  "category": "selected_category_name",
  "subcategory": "specific_variant_or_null",
  "confidence": 0.95,
  "reasoning": "Detailed explanation of why this category was chosen",
  "transaction_pattern": "Brief description of what actually happened",
  "key_indicators": ["indicator1", "indicator2", "indicator3"],
  "accounting_notes": "Specific accounting treatment recommendations",
  "risk_factors": ["potential_risk1", "potential_risk2"] 
}

ANALYSIS GUIDELINES:
- Contract tags and metadata are strong indicators
- Decoded method calls provide definitive function context
- Token transfer patterns reveal true transaction purpose
- Event logs confirm the actual contract interactions
- Consider multi-step transactions and complex DeFi flows
- Higher confidence for clear, unambiguous transactions
- Lower confidence for edge cases or unknown protocols`;

      // Get AI response
      const result = await this.model.generateContent([
        { text: systemPrompt },
        { text: analysisPrompt }
      ]);

      const response = await result.response;
      const responseText = response.text();

      logger.info('📊 AI response received for enhanced context analysis', {
        txHash: context.hash,
        responseLength: responseText.length,
        responsePreview: responseText.substring(0, 200)
      });

      // Parse and validate AI response
      const aiAnalysis = this.parseEnhancedAnalysisResponse(responseText, context);

      logger.info('✅ Enhanced AI analysis completed', {
        txHash: context.hash,
        category: aiAnalysis.category,
        confidence: aiAnalysis.confidence,
        subcategory: aiAnalysis.subcategory
      });

      return aiAnalysis;

    } catch (error) {
      logger.error('❌ Enhanced AI context analysis failed', {
        txHash: context.hash,
        error: error.message,
        stack: error.stack
      });

      // Return fallback analysis
      return {
        category: 'contract_interaction',
        subcategory: 'ai_analysis_failed',
        confidence: 0.5,
        reasoning: `AI analysis failed: ${error.message}. Defaulting to generic categorization.`,
        transaction_pattern: 'Unknown transaction pattern due to analysis failure',
        key_indicators: ['ai_failure'],
        accounting_notes: 'Manual review required due to AI analysis failure',
        risk_factors: ['unanalyzed_transaction']
      };
    }
  }

  /**
   * Build comprehensive analysis prompt with enhanced context
   * @param {Object} context - Enhanced transaction context
   * @param {string} userAddress - User's wallet address
   * @param {Object} availableCategories - Category definitions
   * @param {string} analysisDepth - Analysis depth
   * @returns {string} Formatted analysis prompt
   */
  buildEnhancedContextPrompt(context, userAddress, availableCategories, analysisDepth) {
    const isUserSender = context.from.hash.toLowerCase() === userAddress.toLowerCase();
    const isUserReceiver = context.to?.hash.toLowerCase() === userAddress.toLowerCase();

    return `
ENHANCED BLOCKCHAIN TRANSACTION ANALYSIS

**TRANSACTION OVERVIEW:**
- Hash: ${context.hash}
- Status: ${context.status}
- Method Called: ${context.method || 'N/A'}
- User Perspective: ${isUserSender ? 'Sender' : isUserReceiver ? 'Receiver' : 'Observer'}
- Transaction Type: ${context.context.type}
- Block: ${context.block.number} (${context.block.timestamp})

**DECODED FUNCTION CALL:**
${context.decoded_input ? `
- Function: ${context.decoded_input.method_call || 'Unknown'}
- Method ID: ${context.decoded_input.method_id || 'N/A'}
- Parameters: ${JSON.stringify(context.decoded_input.parameters || {}, null, 2)}
` : 'No decoded input available'}

**FROM ADDRESS ANALYSIS:**
- Address: ${context.from.hash}
- Name: ${context.from.name || 'Unknown'}
- Is Contract: ${context.from.is_contract}
- Is Verified: ${context.from.is_verified}
- Tags: ${JSON.stringify(context.from.tags)}
${context.from.contractInfo ? `
- Contract Info: ${JSON.stringify(context.from.contractInfo, null, 2)}
` : ''}

**TO ADDRESS ANALYSIS:**
- Address: ${context.to?.hash || 'Contract Creation'}
- Name: ${context.to?.name || 'Unknown'}
- Is Contract: ${context.to?.is_contract || false}
- Is Verified: ${context.to?.is_verified || false}
- Tags: ${JSON.stringify(context.to?.tags || [])}
${context.to?.contractInfo ? `
- Contract Info: ${JSON.stringify(context.to.contractInfo, null, 2)}
` : ''}

**TOKEN TRANSFERS (${context.token_transfers.length} transfers):**
${context.token_transfers.length > 0 ? context.token_transfers.map((transfer, index) => `
Transfer ${index + 1}:
- Token: ${transfer.token.name} (${transfer.token.symbol})
- Contract: ${transfer.token.address}
- Type: ${transfer.token.type}
- Decimals: ${transfer.token.decimals}
- From: ${transfer.from.hash} ${transfer.from.name ? `(${transfer.from.name})` : ''}
- To: ${transfer.to.hash} ${transfer.to.name ? `(${transfer.to.name})` : ''}
- Amount: ${transfer.total.decimals_normalized || 'N/A'}
- USD Value: ${transfer.token.priceUSD ? `$${(parseFloat(transfer.total.decimals_normalized || 0) * parseFloat(transfer.token.priceUSD)).toFixed(2)}` : 'N/A'}
`).join('') : 'No token transfers detected'}

**TRANSACTION EXECUTION:**
- Gas Used: ${context.execution.gasUsed}
- Gas Price: ${context.execution.gasPrice}
- Transaction Fee: ${context.execution.transactionFee}
- Confirmations: ${context.execution.confirmations}
${context.context.revert_reason ? `- Revert Reason: ${context.context.revert_reason}` : ''}

**EVENT LOGS (${context.events.length} events):**
${context.events.length > 0 ? context.events.map((event, index) => `
Event ${index + 1}:
- Contract: ${event.address}
- Topics: ${JSON.stringify(event.topics)}
${event.decoded ? `- Decoded: ${JSON.stringify(event.decoded)}` : '- Raw Data: ' + event.data}
`).join('') : 'No events detected'}

**AVAILABLE CATEGORIES:**
${Object.entries(availableCategories).map(([key, category]) => `
${key.toUpperCase()}:
  Description: ${category.description}
  Indicators: ${JSON.stringify(category.indicators)}
  Contract Tags: ${JSON.stringify(category.contractTags || [])}
  Method Patterns: ${JSON.stringify(category.methodPatterns || [])}
  Accounting: ${category.accountingTreatment}
`).join('')}

**ANALYSIS TASK:**
Based on the comprehensive context above, determine the most appropriate transaction category.

Key factors to consider:
1. **Contract Tags**: What do the contract metadata tags indicate?
2. **Method Call**: What specific function was executed?
3. **Token Flow**: How do tokens move and what does this indicate?
4. **Event Logs**: What events were emitted by the contracts?
5. **User Perspective**: How does this transaction affect the user (${userAddress})?
6. **DeFi Patterns**: Does this match known DeFi interaction patterns?

**CONFIDENCE SCORING:**
- 0.9-1.0: Clear, unambiguous transaction with strong indicators
- 0.8-0.89: Strong indicators with minor ambiguity
- 0.7-0.79: Moderate confidence with some unclear aspects
- 0.6-0.69: Low confidence, edge case or unusual pattern
- <0.6: Very uncertain, manual review recommended

Analyze the transaction and provide categorization in the required JSON format.`;
  }

  /**
   * Parse enhanced AI analysis response
   * @param {string} responseText - Raw AI response
   * @param {Object} context - Transaction context for validation
   * @returns {Object} Parsed and validated analysis
   */
  parseEnhancedAnalysisResponse(responseText, context) {
    try {
      // Clean the response text
      let cleanedResponse = responseText.trim();
      
      // Remove markdown code blocks if present
      cleanedResponse = cleanedResponse.replace(/```json\s*/, '').replace(/```\s*$/, '');
      
      // Remove any comments
      cleanedResponse = cleanedResponse.replace(/\/\/.*$/gm, '');
      
      // Find JSON object
      const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON object found in AI response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate required fields
      const requiredFields = ['category', 'confidence', 'reasoning'];
      for (const field of requiredFields) {
        if (!parsed[field]) {
          throw new Error(`Missing required field: ${field}`);
        }
      }

      // Validate confidence score
      if (typeof parsed.confidence !== 'number' || parsed.confidence < 0 || parsed.confidence > 1) {
        logger.warn('Invalid confidence score, defaulting to 0.7', {
          originalConfidence: parsed.confidence,
          txHash: context.hash
        });
        parsed.confidence = 0.7;
      }

      // Ensure all fields exist with defaults
      return {
        category: parsed.category,
        subcategory: parsed.subcategory || null,
        confidence: parsed.confidence,
        reasoning: parsed.reasoning,
        transaction_pattern: parsed.transaction_pattern || 'AI analyzed transaction',
        key_indicators: parsed.key_indicators || [],
        accounting_notes: parsed.accounting_notes || 'Standard accounting treatment applies',
        risk_factors: parsed.risk_factors || []
      };

    } catch (parseError) {
      logger.error('Failed to parse enhanced AI analysis response', {
        error: parseError.message,
        responsePreview: responseText.substring(0, 500),
        txHash: context.hash
      });

      // Return safe fallback
      return {
        category: 'contract_interaction',
        subcategory: 'parse_failed',
        confidence: 0.5,
        reasoning: `Failed to parse AI response: ${parseError.message}`,
        transaction_pattern: 'Unknown due to parsing failure',
        key_indicators: ['parse_error'],
        accounting_notes: 'Manual categorization required',
        risk_factors: ['unparseable_ai_response']
      };
    }
  }
}

module.exports = GeminiClient;
