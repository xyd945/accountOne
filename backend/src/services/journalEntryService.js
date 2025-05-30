const { createClient } = require('@supabase/supabase-js');
const logger = require('../utils/logger');

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
      logger.info('Saving journal entries', {
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

      // Prepare journal entry records - just save what AI gives us
      const journalEntryRecords = entries.map(entry => ({
        user_id: userId,
        transaction_id: finalTransactionId,
        account_debit: entry.accountDebit || entry.account_debit,
        account_credit: entry.accountCredit || entry.account_credit,
        amount: Math.abs(parseFloat(entry.amount)), // Ensure positive amount
        currency: entry.currency || 'USD',
        narrative: entry.narrative || entry.description || 'AI-generated entry',
        entry_date: entry.entryDate || entry.entry_date || new Date().toISOString().split('T')[0],
        ai_confidence: entry.confidence || entry.ai_confidence || (source === 'ai' ? 0.8 : null),
        is_reviewed: false,
        source: source === 'ai' ? 'ai_chat' : source,
        metadata: metadata ? JSON.stringify(metadata) : null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        transaction_date: transactionDate,
      }));

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

      logger.info('Successfully saved journal entries', {
        userId,
        savedCount: savedEntries.length,
        source,
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