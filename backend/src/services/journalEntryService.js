const { createClient } = require('@supabase/supabase-js');
const logger = require('../utils/logger');
const ftsoService = require('./ftsoService'); // Add FTSO service import

class JournalEntryService {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY,
    );
  }

  /**
   * Universal journal entry saver - saves whatever entries AI generates
   * @param {Object} params
   * @param {Array} params.entries - Array of journal entries from AI
   * @param {string} params.userId - User ID
   * @param {string} params.source - Entry source ('ai', 'manual', 'api')
   * @param {string} params.transactionId - Optional: link to crypto transaction
   * @param {Object} params.metadata - Optional: additional data
   * @returns {Array} Saved journal entries
   */
  async saveJournalEntries({ 
    entries, 
    userId, 
    source = 'ai', 
    transactionId = null, 
    metadata = null 
  }) {
    try {
      logger.info('Saving journal entries with USD enhancement', {
        userId,
        entriesCount: entries.length,
        source,
        hasTransactionId: !!transactionId,
      });

      // Extract transaction date from various sources
      let transactionDate = new Date(); // Default to now

      if (transactionId) {
        // Try to get date from blockchain transaction
        const { data: transaction } = await this.supabase
          .from('transactions')
          .select('timestamp')
          .eq('id', transactionId)
          .single();
        
        if (transaction && transaction.timestamp) {
          transactionDate = new Date(transaction.timestamp * 1000); // Convert Unix timestamp
        } else if (transaction && transaction.timeStamp) {
          transactionDate = new Date(transaction.timeStamp * 1000); // Alternative timestamp field
        } else if (transaction && transaction.created_at) {
          transactionDate = new Date(transaction.created_at);
        }
      } else if (metadata && metadata.transactionDate) {
        // Use provided transaction date from metadata
        transactionDate = new Date(metadata.transactionDate);
      }

      // Validate the transaction date
      if (isNaN(transactionDate.getTime())) {
        logger.warn('Invalid transaction date, using current time', { 
          originalDate: transactionId || metadata?.transactionDate 
        });
        transactionDate = new Date();
      }

      // If we have a transactionId, ensure the transaction exists
      let finalTransactionId = transactionId;
      if (transactionId) {
        const { data: transaction } = await this.supabase
          .from('transactions')
          .select('id')
          .eq('id', transactionId)
          .single();
        
        if (!transaction) {
          logger.warn('Transaction not found, creating entry without transaction link', {
            transactionId,
          });
          finalTransactionId = null;
        }
      }

      // **NEW: Enhance entries with USD values using FTSO service**
      const enhancedEntries = await this.enhanceEntriesWithUSDValues(entries);

      // Prepare journal entry records - now with USD values in dedicated columns
      const journalEntryRecords = enhancedEntries.map(entry => {
        // Preserve original business narrative (don't overwrite with FTSO data)
        const originalNarrative = entry.narrative || entry.description;
        
        return {
          user_id: userId,
          transaction_id: finalTransactionId,
          account_debit: entry.accountDebit || entry.account_debit,
          account_credit: entry.accountCredit || entry.account_credit,
          amount: Math.abs(parseFloat(entry.amount)), // Ensure positive amount
          currency: entry.currency || 'USD',
          // **UPDATED: Keep original business narrative in narrative field**
          narrative: originalNarrative, // Keep business description here
          entry_date: entry.entryDate || entry.entry_date || new Date().toISOString().split('T')[0],
          transaction_date: entry.transactionDate || entry.transaction_date || null,
          ai_confidence: entry.confidence || entry.ai_confidence || null,
          is_reviewed: entry.isReviewed || entry.is_reviewed || false,
          // **NEW: Populate dedicated USD columns**
          usd_value: entry.usdValue || null,
          usd_rate: entry.ftsoPrice || entry.exchangeRate || null,
          usd_source: entry.ftsoSource || entry.priceSource || null,
          usd_timestamp: entry.ftsoTimestamp || (entry.usdValue ? new Date().toISOString() : null),
          // **UPDATED: Store FTSO technical data in metadata instead of narrative**
          metadata: {
            ...metadata,
            originalEntry: {
              accountDebit: entry.accountDebit || entry.account_debit,
              accountCredit: entry.accountCredit || entry.account_credit,
              amount: entry.amount,
              currency: entry.currency,
              narrative: originalNarrative
            },
            ftsoEnhancement: entry.usdValue ? {
              usdValue: entry.usdValue,
              exchangeRate: entry.ftsoPrice || entry.exchangeRate,
              source: entry.ftsoSource || entry.priceSource,
              timestamp: entry.ftsoTimestamp,
              priceInfo: entry.usdValue ? `${entry.amount} ${entry.currency} (${entry.usdValue.toFixed(2)} USD at $${(entry.ftsoPrice || entry.exchangeRate)?.toFixed(4)}/${entry.currency} via ${entry.ftsoSource || entry.priceSource})` : null
            } : null
          }
        };
      });

      // Save to database
      const { data: savedEntries, error } = await this.supabase
        .from('journal_entries')
        .insert(journalEntryRecords)
        .select(`
          id,
          transaction_id,
          account_debit,
          account_credit,
          amount,
          currency,
          entry_date,
          narrative,
          ai_confidence,
          is_reviewed,
          created_at,
          updated_at,
          transaction_date,
          metadata,
          usd_value,
          usd_rate,
          usd_source,
          usd_timestamp,
          transactions(txid, description)
        `);

      if (error) {
        logger.error('Failed to save journal entries', {
          userId,
          error: error.message,
          entries: journalEntryRecords,
        });
        throw new Error(`Failed to save journal entries: ${error.message}`);
      }

      logger.info('Successfully saved journal entries with USD enhancement', {
        userId,
        savedCount: savedEntries.length,
        source,
        usdEnhanced: savedEntries.filter(e => {
          try {
            const metadata = JSON.parse(e.metadata || '{}');
            return metadata.ftsoEnhanced;
          } catch { return false; }
        }).length
      });

      return savedEntries;
    } catch (error) {
      logger.error('Journal entry save operation failed', {
        userId,
        source,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Enhance journal entries with USD values using FTSO service
   * @param {Array} entries - Original journal entries
   * @returns {Array} Enhanced entries with USD values
   */
  async enhanceEntriesWithUSDValues(entries) {
    const enhancedEntries = [];

    for (const entry of entries) {
      let enhancedEntry = { ...entry };
      
      try {
        // Only enhance if we have a valid currency and amount
        if (entry.currency && entry.amount && parseFloat(entry.amount) > 0) {
          logger.info('Attempting FTSO enhancement for entry', {
            currency: entry.currency,
            amount: entry.amount
          });

          const ftsoData = await ftsoService.getPriceForJournalEntry(
            entry.currency, 
            parseFloat(entry.amount)
          );

          if (ftsoData.supported && ftsoData.usdValue) {
            // Add USD enhancement data to the entry
            enhancedEntry = {
              ...entry,
              // Add USD value fields
              usdValue: ftsoData.usdValue,
              usdValueFormatted: ftsoData.usdValueFormatted,
              ftsoPrice: ftsoData.priceData?.usdPrice,
              ftsoSource: ftsoData.source,
              ftsoSupported: true,
              ftsoEnhanced: true,
              // Enhanced narrative with USD value
              enhancedNarrative: ftsoData.enhancedNarrative,
              // Keep original narrative
              originalNarrative: entry.narrative || entry.description
            };

            logger.info('Successfully enhanced entry with USD value', {
              currency: entry.currency,
              amount: entry.amount,
              usdValue: ftsoData.usdValueFormatted,
              price: ftsoData.priceData?.usdPrice,
              source: ftsoData.source
            });
          } else {
            // Mark as unsupported but don't fail
            enhancedEntry = {
              ...entry,
              ftsoSupported: false,
              ftsoEnhanced: false,
              ftsoError: ftsoData.error || 'Currency not supported by FTSO'
            };

            logger.info('FTSO enhancement not available for currency', {
              currency: entry.currency,
              reason: ftsoData.error || 'not supported'
            });
          }
        } else {
          // Skip enhancement for entries without valid currency/amount
          enhancedEntry = {
            ...entry,
            ftsoEnhanced: false,
            ftsoSkipped: true
          };
        }
      } catch (error) {
        logger.warn('Failed to enhance entry with USD value', {
          currency: entry.currency,
          amount: entry.amount,
          error: error.message
        });
        
        // Keep original entry but mark enhancement failure
        enhancedEntry = {
          ...entry,
          ftsoEnhanced: false,
          ftsoError: error.message
        };
      }

      enhancedEntries.push(enhancedEntry);
    }

    const enhancedCount = enhancedEntries.filter(e => e.ftsoEnhanced).length;
    logger.info('USD enhancement completed', {
      totalEntries: entries.length,
      enhancedCount,
      enhancementRate: `${((enhancedCount / entries.length) * 100).toFixed(1)}%`
    });

    return enhancedEntries;
  }

  /**
   * Create a transaction record for crypto transactions (if needed)
   * @param {Object} transactionData - Blockchain transaction data
   * @param {string} userId - User ID
   * @param {string} description - Transaction description
   * @returns {Object} Created transaction record
   */
  async createTransactionRecord(transactionData, userId, description = null) {
    try {
      const { data: transactionRecord, error } = await this.supabase
        .from('transactions')
        .upsert({
          txid: transactionData.hash,
          user_id: userId,
          description: description || 'AI-generated transaction',
          blockchain_data: {
            from: transactionData.from,
            to: transactionData.to,
            value: transactionData.value,
            gasUsed: transactionData.gasUsed,
            gasPrice: transactionData.gasPrice,
            blockNumber: transactionData.blockNumber,
            timestamp: transactionData.timestamp,
            status: transactionData.status,
            input: transactionData.input,
            nonce: transactionData.nonce,
            transactionIndex: transactionData.transactionIndex,
            confirmations: transactionData.confirmations,
          },
          status: transactionData.status === 'success' ? 'processed' : 'failed',
          fetched_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        logger.error('Failed to create transaction record', {
          txHash: transactionData.hash,
          error: error.message,
        });
        throw new Error(`Failed to create transaction: ${error.message}`);
      }

      return transactionRecord;
    } catch (error) {
      logger.error('Transaction creation failed', {
        txHash: transactionData?.hash,
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Save journal entries with optional transaction creation
   * @param {Array} journalEntries - Journal entries from AI
   * @param {Object} transactionData - Optional: blockchain transaction data
   * @param {string} userId - User ID
   * @param {Object} transactionDetails - Optional: transaction metadata
   * @returns {Object} Result with saved entries and transaction
   */
  async saveJournalEntriesWithTransaction(journalEntries, transactionData, userId, transactionDetails = {}) {
    try {
      let transactionRecord = null;
      
      // Create transaction record if blockchain data provided
      if (transactionData?.hash) {
        transactionRecord = await this.createTransactionRecord(
          transactionData, 
          userId, 
          transactionDetails.description
        );
      }

      // Save journal entries
      const savedEntries = await this.saveJournalEntries({
        entries: journalEntries,
        userId,
        source: 'ai',
        transactionId: transactionRecord?.id,
        metadata: {
          ...transactionDetails,
          hasBlockchainData: !!transactionData?.hash,
        },
      });

      return {
        entries: savedEntries,
        transaction: transactionRecord,
      };
    } catch (error) {
      logger.error('Failed to save entries with transaction', {
        userId,
        txHash: transactionData?.hash,
        error: error.message,
      });
      throw error;
    }
  }
}

module.exports = new JournalEntryService(); 