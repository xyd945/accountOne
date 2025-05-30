const express = require('express');
const { body, validationResult } = require('express-validator');
const { createClient } = require('@supabase/supabase-js');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const blockscoutClient = require('../services/blockscoutClient');
const aiClient = require('../services/aiClients');

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

/**
 * @swagger
 * components:
 *   schemas:
 *     Transaction:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         user_id:
 *           type: string
 *           format: uuid
 *         txid:
 *           type: string
 *         description:
 *           type: string
 *         blockchain_data:
 *           type: object
 *         status:
 *           type: string
 *           enum: [pending, processed, failed]
 *         created_at:
 *           type: string
 *           format: date-time
 *     JournalEntry:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         transaction_id:
 *           type: string
 *           format: uuid
 *         account_debit:
 *           type: string
 *         account_credit:
 *           type: string
 *         amount:
 *           type: number
 *         currency:
 *           type: string
 *         entry_date:
 *           type: string
 *           format: date
 *         narrative:
 *           type: string
 *         ai_confidence:
 *           type: number
 *           minimum: 0
 *           maximum: 1
 *         is_reviewed:
 *           type: boolean
 */

/**
 * @swagger
 * /api/transactions:
 *   post:
 *     summary: Process a new cryptocurrency transaction
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - txid
 *             properties:
 *               txid:
 *                 type: string
 *                 description: Transaction hash/ID
 *               description:
 *                 type: string
 *                 description: User description of the transaction
 *     responses:
 *       201:
 *         description: Transaction processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 transaction:
 *                   $ref: '#/components/schemas/Transaction'
 *                 journalEntries:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/JournalEntry'
 *       400:
 *         description: Validation error
 *       404:
 *         description: Transaction not found on blockchain
 *       409:
 *         description: Transaction already processed
 */
router.post('/', [
  body('txid').notEmpty().withMessage('Transaction ID is required'),
  body('description').optional().isString(),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new AppError('Validation failed', 400));
    }

    const { txid, description } = req.body;
    const userId = req.user.id;

    logger.info('Processing new transaction', { txid, userId, description });

    // Check if transaction already exists
    const { data: existingTx } = await supabase
      .from('transactions')
      .select('*')
      .eq('txid', txid)
      .eq('user_id', userId)
      .single();

    if (existingTx) {
      return next(new AppError('Transaction already processed', 409));
    }

    // Fetch blockchain data
    const blockchainData = await blockscoutClient.getTransactionInfo(txid);

    // Get token transfers if applicable
    const tokenTransfers = await blockscoutClient.getTokenTransfers(blockchainData.from);
    blockchainData.tokenTransfers = tokenTransfers.filter(transfer => transfer.hash === txid);

    // Create transaction record
    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .insert([{
        user_id: userId,
        txid,
        description,
        blockchain_data: blockchainData,
        status: 'pending',
      }])
      .select()
      .single();

    if (txError) {
      logger.error('Failed to create transaction record', { error: txError });
      return next(new AppError('Failed to save transaction', 500));
    }

    try {
      // Analyze with AI
      const aiJournalEntries = await aiClient.analyzeTransaction(blockchainData, description);

      // Save journal entries
      const journalEntries = [];
      for (const entry of aiJournalEntries) {
        const { data: journalEntry, error: entryError } = await supabase
          .from('journal_entries')
          .insert([{
            transaction_id: transaction.id,
            account_debit: entry.accountDebit,
            account_credit: entry.accountCredit,
            amount: parseFloat(entry.amount),
            currency: entry.currency,
            entry_date: blockchainData.timestamp.toISOString().split('T')[0],
            narrative: entry.narrative,
            ai_confidence: entry.confidence || 0.8,
          }])
          .select()
          .single();

        if (entryError) {
          logger.error('Failed to save journal entry', { error: entryError });
          throw new Error('Failed to save journal entry');
        }

        journalEntries.push(journalEntry);
      }

      // Update transaction status
      await supabase
        .from('transactions')
        .update({ status: 'processed' })
        .eq('id', transaction.id);

      logger.info('Transaction processed successfully', {
        txid,
        userId,
        entriesCount: journalEntries.length,
      });

      res.status(201).json({
        transaction: { ...transaction, status: 'processed' },
        journalEntries,
      });
    } catch (aiError) {
      logger.error('AI analysis failed', { txid, error: aiError.message });

      // Update transaction status to failed
      await supabase
        .from('transactions')
        .update({ status: 'failed' })
        .eq('id', transaction.id);

      return next(new AppError('Failed to analyze transaction', 500));
    }
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/transactions:
 *   get:
 *     summary: Get user's transactions
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, processed, failed]
 *     responses:
 *       200:
 *         description: List of transactions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 transactions:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Transaction'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 */
router.get('/', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const status = req.query.status;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('transactions')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: transactions, error, count } = await query;

    if (error) {
      logger.error('Failed to fetch transactions', { error, userId });
      return next(new AppError('Failed to fetch transactions', 500));
    }

    const totalPages = Math.ceil(count / limit);

    res.json({
      transactions,
      pagination: {
        page,
        limit,
        total: count,
        totalPages,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/transactions/{id}:
 *   get:
 *     summary: Get transaction details with journal entries
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Transaction details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 transaction:
 *                   $ref: '#/components/schemas/Transaction'
 *                 journalEntries:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/JournalEntry'
 *       404:
 *         description: Transaction not found
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Get transaction
    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (txError || !transaction) {
      return next(new AppError('Transaction not found', 404));
    }

    // Get journal entries
    const { data: journalEntries, error: entriesError } = await supabase
      .from('journal_entries')
      .select('*')
      .eq('transaction_id', id)
      .order('created_at', { ascending: true });

    if (entriesError) {
      logger.error('Failed to fetch journal entries', { error: entriesError, transactionId: id });
      return next(new AppError('Failed to fetch journal entries', 500));
    }

    res.json({
      transaction,
      journalEntries: journalEntries || [],
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/transactions/{id}/journal-entries/{entryId}:
 *   put:
 *     summary: Update a journal entry
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: entryId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               account_debit:
 *                 type: string
 *               account_credit:
 *                 type: string
 *               amount:
 *                 type: number
 *               narrative:
 *                 type: string
 *               is_reviewed:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Journal entry updated successfully
 *       404:
 *         description: Journal entry not found
 */
router.put('/:id/journal-entries/:entryId', [
  body('account_debit').optional().isString(),
  body('account_credit').optional().isString(),
  body('amount').optional().isNumeric(),
  body('narrative').optional().isString(),
  body('is_reviewed').optional().isBoolean(),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new AppError('Validation failed', 400));
    }

    const { id, entryId } = req.params;
    const userId = req.user.id;
    const updates = req.body;

    // Verify transaction ownership
    const { data: transaction } = await supabase
      .from('transactions')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (!transaction) {
      return next(new AppError('Transaction not found', 404));
    }

    // Update journal entry
    const { data: updatedEntry, error } = await supabase
      .from('journal_entries')
      .update(updates)
      .eq('id', entryId)
      .eq('transaction_id', id)
      .select()
      .single();

    if (error || !updatedEntry) {
      return next(new AppError('Journal entry not found', 404));
    }

    logger.info('Journal entry updated', { entryId, userId, updates });

    res.json({
      message: 'Journal entry updated successfully',
      journalEntry: updatedEntry,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
