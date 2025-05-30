const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const accountService = require('../services/accountService');

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Account:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         code:
 *           type: string
 *         name:
 *           type: string
 *         account_type:
 *           type: string
 *           enum: [ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE]
 *         sub_type:
 *           type: string
 *         currency:
 *           type: string
 *         description:
 *           type: string
 *         ifrs_reference:
 *           type: string
 *         is_active:
 *           type: boolean
 *     CryptoAsset:
 *       type: object
 *       properties:
 *         symbol:
 *           type: string
 *         name:
 *           type: string
 *         account:
 *           $ref: '#/components/schemas/Account'
 *         blockchain:
 *           type: string
 *         decimals:
 *           type: integer
 *         is_stable_coin:
 *           type: boolean
 */

/**
 * @swagger
 * /api/accounts/chart:
 *   get:
 *     summary: Get the complete chart of accounts
 *     tags: [Accounts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Chart of accounts
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Account'
 */
router.get('/chart', async (req, res, next) => {
  try {
    const accounts = await accountService.getChartOfAccounts();
    
    // Group accounts by category for better organization
    const grouped = accounts.reduce((acc, account) => {
      const categoryName = account.account_categories?.name || 'Uncategorized';
      if (!acc[categoryName]) {
        acc[categoryName] = {
          category: account.account_categories,
          accounts: [],
        };
      }
      acc[categoryName].accounts.push(account);
      return acc;
    }, {});

    res.json({
      chartOfAccounts: grouped,
      totalAccounts: accounts.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/accounts/search:
 *   get:
 *     summary: Search accounts by name or code
 *     tags: [Accounts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Search term
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE]
 *         description: Filter by account type
 *     responses:
 *       200:
 *         description: Search results
 */
router.get('/search', [
  query('q').notEmpty().withMessage('Search query is required'),
  query('type').optional().isIn(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new AppError('Validation failed', 400));
    }

    const { q, type } = req.query;
    
    // Search by name
    let accounts = await accountService.getAccountByName(q);
    
    // Filter by type if specified
    if (type) {
      accounts = accounts.filter(account => account.account_type === type);
    }

    // Also search by code
    const accountByCode = await accountService.getAccountByCode(q);
    if (accountByCode && !accounts.find(a => a.id === accountByCode.id)) {
      accounts.unshift(accountByCode);
    }

    res.json({
      query: q,
      type: type || 'all',
      results: accounts,
      count: accounts.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/accounts/crypto/{symbol}:
 *   get:
 *     summary: Get account for specific cryptocurrency
 *     tags: [Accounts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: symbol
 *         required: true
 *         schema:
 *           type: string
 *         description: Cryptocurrency symbol (e.g., BTC, ETH, USDT)
 *     responses:
 *       200:
 *         description: Crypto asset account
 *       404:
 *         description: Cryptocurrency not found
 */
router.get('/crypto/:symbol', async (req, res, next) => {
  try {
    const { symbol } = req.params;
    const account = await accountService.getAccountForCrypto(symbol);
    
    if (!account) {
      return res.status(404).json({
        error: 'Cryptocurrency not found',
        message: `No account found for ${symbol.toUpperCase()}`,
        suggestion: `Use POST /api/accounts/crypto to create an account for ${symbol.toUpperCase()}`,
      });
    }

    res.json({
      symbol: symbol.toUpperCase(),
      account,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/accounts/crypto:
 *   post:
 *     summary: Create account for new cryptocurrency
 *     tags: [Accounts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - symbol
 *               - name
 *             properties:
 *               symbol:
 *                 type: string
 *               name:
 *                 type: string
 *               blockchain:
 *                 type: string
 *                 default: ethereum
 *               decimals:
 *                 type: integer
 *                 default: 18
 *     responses:
 *       201:
 *         description: Crypto asset account created
 *       409:
 *         description: Account already exists
 */
router.post('/crypto', [
  body('symbol').notEmpty().withMessage('Symbol is required'),
  body('name').notEmpty().withMessage('Name is required'),
  body('blockchain').optional().isString(),
  body('decimals').optional().isInt({ min: 0, max: 30 }),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new AppError('Validation failed', 400));
    }

    const { symbol, name, blockchain = 'ethereum', decimals = 18 } = req.body;

    // Check if already exists
    const existing = await accountService.getAccountForCrypto(symbol);
    if (existing) {
      return res.status(409).json({
        error: 'Account already exists',
        message: `Account for ${symbol.toUpperCase()} already exists`,
        account: existing,
      });
    }

    const account = await accountService.createCryptoAssetAccount(symbol, name, blockchain, decimals);

    logger.info('Created new crypto asset account', { 
      symbol, 
      name, 
      accountId: account.id,
      userId: req.user.id 
    });

    res.status(201).json({
      message: 'Crypto asset account created successfully',
      symbol: symbol.toUpperCase(),
      account,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/accounts/create:
 *   post:
 *     summary: Create a new general account with IFRS categorization
 *     tags: [Accounts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - accountType
 *               - categoryCode
 *             properties:
 *               name:
 *                 type: string
 *                 description: Account name
 *               accountType:
 *                 type: string
 *                 enum: [ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE]
 *                 description: Account type
 *               categoryCode:
 *                 type: string
 *                 description: Category code (e.g., 5000 for Operating Expenses)
 *               description:
 *                 type: string
 *                 description: Account description
 *               ifrsReference:
 *                 type: string
 *                 description: IFRS/IAS reference
 *                 default: IAS 1
 *     responses:
 *       201:
 *         description: Account created successfully
 *       400:
 *         description: Validation failed
 *       409:
 *         description: Account already exists
 */
router.post('/create', [
  body('name').notEmpty().withMessage('Account name is required'),
  body('accountType').isIn(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']).withMessage('Valid account type is required'),
  body('categoryCode').notEmpty().withMessage('Category code is required'),
  body('description').optional().isString(),
  body('ifrsReference').optional().isString(),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new AppError('Validation failed', 400));
    }

    const { name, accountType, categoryCode, description, ifrsReference = 'IAS 1' } = req.body;

    // Check if account already exists by name
    const existing = await accountService.getAccountByName(name);
    if (existing && existing.length > 0) {
      return res.status(409).json({
        error: 'Account already exists',
        message: `Account with name "${name}" already exists`,
        account: existing[0],
      });
    }

    const account = await accountService.createAccount({
      name,
      accountType,
      categoryCode,
      description,
      ifrsReference,
    });

    logger.info('Created new general account', { 
      name, 
      accountType, 
      categoryCode,
      accountId: account.id,
      userId: req.user.id 
    });

    res.status(201).json({
      message: 'Account created successfully',
      account,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/accounts/validate:
 *   post:
 *     summary: Validate journal entry accounts
 *     tags: [Accounts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - debitAccount
 *               - creditAccount
 *             properties:
 *               debitAccount:
 *                 type: string
 *               creditAccount:
 *                 type: string
 *     responses:
 *       200:
 *         description: Validation results
 */
router.post('/validate', [
  body('debitAccount').notEmpty().withMessage('Debit account is required'),
  body('creditAccount').notEmpty().withMessage('Credit account is required'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new AppError('Validation failed', 400));
    }

    const { debitAccount, creditAccount } = req.body;
    const validation = await accountService.validateJournalEntry(debitAccount, creditAccount);

    res.json(validation);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/accounts/types/{type}:
 *   get:
 *     summary: Get accounts by type (for reporting)
 *     tags: [Accounts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE]
 *     responses:
 *       200:
 *         description: Accounts of specified type
 */
router.get('/types/:type', async (req, res, next) => {
  try {
    const { type } = req.params;
    
    if (!['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'].includes(type)) {
      return next(new AppError('Invalid account type', 400));
    }

    const accounts = await accountService.getAccountsByType(type);

    res.json({
      accountType: type,
      accounts,
      count: accounts.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/accounts/ai-suggest:
 *   post:
 *     summary: Get AI account suggestions
 *     tags: [Accounts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               keywords:
 *                 type: array
 *                 items:
 *                   type: string
 *               transactionType:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: AI account suggestions
 */
router.post('/ai-suggest', [
  body('keywords').optional().isArray(),
  body('transactionType').optional().isString(),
  body('description').optional().isString(),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new AppError('Validation failed', 400));
    }

    const { keywords = [], transactionType, description } = req.body;
    
    const suggestion = await accountService.findAccountByAI(keywords, transactionType, description);

    if (!suggestion) {
      return res.json({
        found: false,
        message: 'No matching accounts found',
        suggestion: 'Consider using a general account or creating a new specific account',
      });
    }

    res.json({
      found: true,
      account: suggestion.account,
      confidence: suggestion.confidence,
      score: suggestion.score,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router; 