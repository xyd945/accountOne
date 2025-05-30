const express = require('express');
const { body, validationResult } = require('express-validator');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const aiClient = require('../services/aiClients');
const journalEntryService = require('../services/journalEntryService');

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     ChatMessage:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           description: User's message to the AI
 *         context:
 *           type: object
 *           description: Additional context for the AI
 *     ChatResponse:
 *       type: object
 *       properties:
 *         response:
 *           type: string
 *           description: AI's response
 *         thinking:
 *           type: string
 *           description: AI's thinking process
 *         suggestions:
 *           type: array
 *           items:
 *             type: string
 *           description: AI's suggestions
 */

/**
 * @swagger
 * /api/ai/chat:
 *   post:
 *     summary: Send a message to the AI assistant
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *                 description: User message to the AI assistant
 *               context:
 *                 type: object
 *                 description: Additional context for the AI
 *     responses:
 *       200:
 *         description: AI response generated
 *       400:
 *         description: Invalid request
 *       500:
 *         description: AI service error
 */
router.post('/chat',
  [
    body('message').isString().notEmpty().withMessage('Message is required'),
    body('context').optional().isObject(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(new AppError('Validation failed', 400, errors.array()));
      }

      const { message, context = {} } = req.body;
      const userId = req.user.id;

      logger.info('Processing AI chat request', {
        userId,
        messageLength: message.length,
        hasContext: Object.keys(context).length > 0,
      });

      // Add user context
      context.user = req.user;

      // Get recent entries for context
      if (!context.recentEntries) {
        const { data: recentEntries } = await journalEntryService.supabase
          .from('journal_entries')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(5);
        
        context.recentEntries = recentEntries || [];
      }

      // Process the chat message
      let response;
      try {
        response = await aiClient.chat(message, context);
      } catch (aiError) {
        logger.error('AI chat processing failed', {
          userId,
          error: aiError.message,
          message: message.substring(0, 100),
        });
        
        return res.json({
          success: false,
          error: 'AI service temporarily unavailable. Please try again in a moment.',
          data: {
            response: 'I apologize, but I\'m having trouble processing your request right now. Please try again in a moment.',
            journalEntries: [],
          }
        });
      }

      // Check if the AI generated any journal entries and save them automatically
      if (response.journalEntries && response.journalEntries.length > 0) {
        try {
          logger.info('AI generated journal entries, saving automatically', {
            userId,
            entriesCount: response.journalEntries.length,
          });

          // Extract transaction date from the first entry if available
          const firstEntry = response.journalEntries[0];
          const extractedTransactionDate = firstEntry.transactionDate || null;
          
          if (extractedTransactionDate) {
            logger.info('Using extracted transaction date for journal entries', {
              userId,
              transactionDate: extractedTransactionDate.toISOString ? extractedTransactionDate.toISOString() : extractedTransactionDate
            });
          }

          const savedEntries = await journalEntryService.saveJournalEntries({
            entries: response.journalEntries,
            userId,
            source: 'ai_chat',
            metadata: {
              originalMessage: message,
              aiResponse: response.response.substring(0, 500), // First 500 chars
              timestamp: new Date().toISOString(),
              transactionDate: extractedTransactionDate, // Pass the extracted date
              extractedFromMessage: !!extractedTransactionDate
            },
          });

          // Add saved entries info to response
          response.savedEntries = savedEntries;
          response.message = 'Journal entries have been automatically saved to your books.';

          logger.info('Successfully saved AI-generated journal entries', {
            userId,
            savedCount: savedEntries.length,
          });
        } catch (saveError) {
          logger.error('Failed to save AI-generated journal entries', {
            userId,
            error: saveError.message,
            entries: response.journalEntries,
          });
          
          // Don't fail the whole request, just add a warning
          response.warning = 'Journal entries were generated but could not be saved automatically. Please review and save manually.';
        }
      }

      res.json({
        success: true,
        data: response,
      });
    } catch (error) {
      logger.error('AI chat request failed', {
        userId: req.user?.id,
        error: error.message,
      });
      next(error);
    }
  },
);

/**
 * @swagger
 * /api/ai/analyze-transaction:
 *   post:
 *     summary: Analyze a transaction and create journal entries
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - transactionData
 *             properties:
 *               transactionData:
 *                 type: object
 *                 description: Blockchain transaction data
 *               description:
 *                 type: string
 *                 description: User description of the transaction
 *     responses:
 *       200:
 *         description: Journal entries created
 *       400:
 *         description: Invalid transaction data
 *       500:
 *         description: AI service error
 */
router.post('/analyze-transaction', [
  body('transactionData').isObject().withMessage('Transaction data is required'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new AppError('Valid transaction data is required', 400));
    }

    const { transactionData, description } = req.body;
    const userId = req.user?.id;

    logger.info('Transaction analysis request', {
      userId,
      txHash: transactionData.hash,
      description,
    });

    // Create journal entries with Gemini only
    const journalEntries = await aiClient.createJournalEntry(
      transactionData,
      description,
    );

    logger.info('Transaction analysis completed', {
      userId,
      txHash: transactionData.hash,
      entriesCount: journalEntries.length,
    });

    res.json({
      journalEntries,
      summary: {
        totalEntries: journalEntries.length,
        validEntries: journalEntries.length, // All entries are valid from Gemini
        averageConfidence: journalEntries.reduce((sum, e) => sum + (e.confidence || 0.8), 0) / journalEntries.length,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Transaction analysis error', {
      userId: req.user?.id,
      txHash: req.body.transactionData?.hash,
      error: error.message,
    });
    next(error);
  }
});

/**
 * @swagger
 * /api/ai/verify-entry:
 *   post:
 *     summary: Verify a journal entry
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - journalEntry
 *             properties:
 *               journalEntry:
 *                 type: object
 *                 description: Journal entry to verify
 *               originalTransaction:
 *                 type: object
 *                 description: Original transaction data for context
 *     responses:
 *       200:
 *         description: Journal entry verification completed
 *       400:
 *         description: Invalid journal entry data
 *       500:
 *         description: AI service error
 */
router.post('/verify-entry', [
  body('journalEntry').isObject().withMessage('Journal entry is required'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new AppError('Valid journal entry is required', 400));
    }

    const { journalEntry, originalTransaction } = req.body;
    const userId = req.user?.id;

    logger.info('Journal entry verification request', {
      userId,
      entryId: journalEntry.id || 'new',
    });

    const verification = await aiClient.verifyJournalEntry(journalEntry, originalTransaction);

    logger.info('Journal entry verification completed', {
      userId,
      entryId: journalEntry.id || 'new',
      isValid: verification.isValid,
      confidence: verification.confidence,
    });

    res.json({
      verification,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Journal entry verification error', {
      userId: req.user?.id,
      entryId: req.body.journalEntry?.id,
      error: error.message,
    });
    next(error);
  }
});

/**
 * @swagger
 * /api/ai/health:
 *   get:
 *     summary: Check AI service health
 *     tags: [AI]
 *     responses:
 *       200:
 *         description: AI service health status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 gemini:
 *                   type: boolean
 *                 deepseek:
 *                   type: boolean
 *                 overall:
 *                   type: boolean
 */
router.get('/health', async (req, res, next) => {
  try {
    const health = await aiClient.checkHealth();
    res.json(health);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
