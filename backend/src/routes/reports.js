const express = require('express');
const { query, validationResult } = require('express-validator');
const { createClient } = require('@supabase/supabase-js');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

/**
 * @swagger
 * components:
 *   schemas:
 *     BalanceSheetItem:
 *       type: object
 *       properties:
 *         account:
 *           type: string
 *         balance:
 *           type: number
 *         currency:
 *           type: string
 *     CashFlowItem:
 *       type: object
 *       properties:
 *         date:
 *           type: string
 *           format: date
 *         account:
 *           type: string
 *         amount:
 *           type: number
 *         currency:
 *           type: string
 *         narrative:
 *           type: string
 */

/**
 * @swagger
 * /api/reports/balance-sheet:
 *   get:
 *     summary: Generate balance sheet report
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Balance sheet as of this date
 *       - in: query
 *         name: currency
 *         schema:
 *           type: string
 *         description: Filter by currency (optional)
 *     responses:
 *       200:
 *         description: Balance sheet data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 asOfDate:
 *                   type: string
 *                   format: date
 *                 assets:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/BalanceSheetItem'
 *                 liabilities:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/BalanceSheetItem'
 *                 equity:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/BalanceSheetItem'
 *                 totals:
 *                   type: object
 *                   properties:
 *                     totalAssets:
 *                       type: number
 *                     totalLiabilities:
 *                       type: number
 *                     totalEquity:
 *                       type: number
 *       400:
 *         description: Validation error
 */
router.get('/balance-sheet', [
  query('date').isISO8601().withMessage('Date must be in YYYY-MM-DD format'),
  query('currency').optional().isString(),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new AppError('Validation failed', 400));
    }

    const { date, currency } = req.query;
    const userId = req.user.id;

    logger.info('Generating balance sheet', { userId, date, currency });

    // Get all journal entries up to the specified date
    let query = supabase
      .from('journal_entries')
      .select(`
        *,
        transaction_date,
        transactions(user_id)
      `)
      .eq('user_id', userId)
      .lte('entry_date', date);

    if (currency) {
      query = query.eq('currency', currency);
    }

    const { data: entries, error } = await query;

    if (error) {
      logger.error('Failed to fetch journal entries for balance sheet', { error, userId });
      return next(new AppError('Failed to generate balance sheet', 500));
    }

    // Calculate balances by account
    const accountBalances = {};

    // First pass: collect all unique accounts
    const uniqueAccounts = new Set();
    entries.forEach(entry => {
      uniqueAccounts.add(entry.account_debit);
      uniqueAccounts.add(entry.account_credit);
    });

    // Classify all accounts upfront
    const accountTypes = {};
    for (const accountName of uniqueAccounts) {
      accountTypes[accountName] = await classifyAccount(accountName);
    }

    // Second pass: calculate balances using pre-classified accounts
    entries.forEach(entry => {
      const key = `${entry.account_debit}-${entry.currency}`;
      if (!accountBalances[key]) {
        accountBalances[key] = {
          account: entry.account_debit,
          balance: 0,
          currency: entry.currency,
          type: accountTypes[entry.account_debit],
        };
      }
      accountBalances[key].balance += parseFloat(entry.amount);

      const creditKey = `${entry.account_credit}-${entry.currency}`;
      if (!accountBalances[creditKey]) {
        accountBalances[creditKey] = {
          account: entry.account_credit,
          balance: 0,
          currency: entry.currency,
          type: accountTypes[entry.account_credit],
        };
      }
      accountBalances[creditKey].balance -= parseFloat(entry.amount);
    });

    // Group by account type
    const assets = [];
    const liabilities = [];
    const equity = [];
    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;

    Object.values(accountBalances).forEach(account => {
      if (account.balance === 0) return; // Skip zero balances

      const item = {
        account: account.account,
        balance: Math.abs(account.balance),
        currency: account.currency,
      };

      switch (account.type) {
      case 'asset':
        if (account.balance > 0) {
          assets.push(item);
          totalAssets += item.balance;
        }
        break;
      case 'liability':
        if (account.balance < 0) {
          liabilities.push(item);
          totalLiabilities += item.balance;
        }
        break;
      case 'equity':
        if (account.balance < 0) {
          equity.push(item);
          totalEquity += item.balance;
        }
        break;
      }
    });

    // Sort by balance descending
    assets.sort((a, b) => b.balance - a.balance);
    liabilities.sort((a, b) => b.balance - a.balance);
    equity.sort((a, b) => b.balance - a.balance);

    res.json({
      asOfDate: date,
      assets,
      liabilities,
      equity,
      totals: {
        totalAssets: Math.abs(totalAssets),
        totalLiabilities: Math.abs(totalLiabilities),
        totalEquity: Math.abs(totalEquity),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/reports/cash-flow:
 *   get:
 *     summary: Generate cash flow report
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: start
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for the period
 *       - in: query
 *         name: end
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for the period
 *       - in: query
 *         name: currency
 *         schema:
 *           type: string
 *         description: Filter by currency (optional)
 *     responses:
 *       200:
 *         description: Cash flow data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 period:
 *                   type: object
 *                   properties:
 *                     start:
 *                       type: string
 *                       format: date
 *                     end:
 *                       type: string
 *                       format: date
 *                 operating:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/CashFlowItem'
 *                 investing:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/CashFlowItem'
 *                 financing:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/CashFlowItem'
 *                 summary:
 *                   type: object
 *                   properties:
 *                     netOperating:
 *                       type: number
 *                     netInvesting:
 *                       type: number
 *                     netFinancing:
 *                       type: number
 *                     netCashFlow:
 *                       type: number
 */
router.get('/cash-flow', [
  query('start').isISO8601().withMessage('Start date must be in YYYY-MM-DD format'),
  query('end').isISO8601().withMessage('End date must be in YYYY-MM-DD format'),
  query('currency').optional().isString(),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new AppError('Validation failed', 400));
    }

    const { start, end, currency } = req.query;
    const userId = req.user.id;

    // Validate date range
    if (new Date(start) > new Date(end)) {
      return next(new AppError('Start date must be before end date', 400));
    }

    logger.info('Generating cash flow report', { userId, start, end, currency });

    // Get journal entries for the period
    let query = supabase
      .from('journal_entries')
      .select(`
        *,
        transaction_date,
        transactions(user_id)
      `)
      .eq('user_id', userId)
      .gte('entry_date', start)
      .lte('entry_date', end);

    if (currency) {
      query = query.eq('currency', currency);
    }

    const { data: entries, error } = await query;

    if (error) {
      logger.error('Failed to fetch journal entries for cash flow', { error, userId });
      return next(new AppError('Failed to generate cash flow report', 500));
    }

    // Categorize cash flows
    const operating = [];
    const investing = [];
    const financing = [];

    let netOperating = 0;
    let netInvesting = 0;
    let netFinancing = 0;

    entries.forEach(entry => {
      const cashFlowItem = {
        date: entry.transaction_date || entry.entry_date,
        account: entry.account_debit,
        amount: parseFloat(entry.amount),
        currency: entry.currency,
        narrative: entry.narrative,
        entryDate: entry.entry_date,
      };

      const category = categorizeCashFlow(entry.account_debit, entry.account_credit);

      switch (category) {
      case 'operating':
        operating.push(cashFlowItem);
        netOperating += cashFlowItem.amount;
        break;
      case 'investing':
        investing.push(cashFlowItem);
        netInvesting += cashFlowItem.amount;
        break;
      case 'financing':
        financing.push(cashFlowItem);
        netFinancing += cashFlowItem.amount;
        break;
      }

      // Also consider credit side
      const creditCashFlowItem = {
        date: entry.transaction_date || entry.entry_date,
        account: entry.account_credit,
        amount: -parseFloat(entry.amount),
        currency: entry.currency,
        narrative: entry.narrative,
        entryDate: entry.entry_date,
      };

      const creditCategory = categorizeCashFlow(entry.account_credit, entry.account_debit);

      switch (creditCategory) {
      case 'operating':
        operating.push(creditCashFlowItem);
        netOperating += creditCashFlowItem.amount;
        break;
      case 'investing':
        investing.push(creditCashFlowItem);
        netInvesting += creditCashFlowItem.amount;
        break;
      case 'financing':
        financing.push(creditCashFlowItem);
        netFinancing += creditCashFlowItem.amount;
        break;
      }
    });

    // Sort by date
    const sortByDate = (a, b) => new Date(a.date) - new Date(b.date);
    operating.sort(sortByDate);
    investing.sort(sortByDate);
    financing.sort(sortByDate);

    const netCashFlow = netOperating + netInvesting + netFinancing;

    res.json({
      period: { start, end },
      operating,
      investing,
      financing,
      summary: {
        netOperating,
        netInvesting,
        netFinancing,
        netCashFlow,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/reports/journal-entries:
 *   get:
 *     summary: Get journal entries with filtering and pagination
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: start
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: end
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: account
 *         schema:
 *           type: string
 *       - in: query
 *         name: currency
 *         schema:
 *           type: string
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
 *           default: 50
 *     responses:
 *       200:
 *         description: Journal entries
 */
router.get('/journal-entries', [
  query('start').optional().isISO8601(),
  query('end').optional().isISO8601(),
  query('account').optional().isString(),
  query('currency').optional().isString(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new AppError('Validation failed', 400));
    }

    const { start, end, account, currency, page = 1, limit = 50 } = req.query;
    const userId = req.user.id;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('journal_entries')
      .select(`
        *,
        transaction_date,
        transactions(user_id, txid, description)
      `, { count: 'exact' })
      .eq('user_id', userId)
      .order('entry_date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (start) {
      query = query.gte('entry_date', start);
    }
    if (end) {
      query = query.lte('entry_date', end);
    }
    if (account) {
      query = query.or(`account_debit.ilike.%${account}%,account_credit.ilike.%${account}%`);
    }
    if (currency) {
      query = query.eq('currency', currency);
    }

    const { data: entries, error, count } = await query;

    if (error) {
      logger.error('Failed to fetch journal entries', { error, userId });
      return next(new AppError('Failed to fetch journal entries', 500));
    }

    const totalPages = Math.ceil(count / limit);

    res.json({
      entries,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Helper functions
async function classifyAccount(accountName) {
  const accountService = require('../services/accountService');
  
  try {
    // Try to find the account in our chart of accounts
    const accounts = await accountService.getAccountByName(accountName);
    
    if (accounts && accounts.length > 0) {
      // Return the account type from the database
      const accountType = accounts[0].account_type;
      return accountType.toLowerCase();
    }
    
    // Fallback to string matching if account not found in chart
    const account = accountName.toLowerCase();
    
    if (account.includes('asset') || account.includes('cash') || account.includes('digital')) {
      return 'asset';
    }
    if (account.includes('liability') || account.includes('payable') || account.includes('loan')) {
      return 'liability';
    }
    if (account.includes('equity') || account.includes('capital') || account.includes('retained')) {
      return 'equity';
    }
    if (account.includes('expense') || account.includes('fee')) {
      return 'asset'; // Expenses reduce assets
    }
    if (account.includes('revenue') || account.includes('income')) {
      return 'equity'; // Revenue increases equity
    }
    
    return 'asset'; // Default to asset
  } catch (error) {
    // If there's an error, fall back to string matching
    const account = accountName.toLowerCase();
    
    if (account.includes('asset') || account.includes('cash') || account.includes('digital')) {
      return 'asset';
    }
    if (account.includes('liability') || account.includes('payable') || account.includes('loan')) {
      return 'liability';
    }
    if (account.includes('equity') || account.includes('capital') || account.includes('retained')) {
      return 'equity';
    }
    if (account.includes('expense') || account.includes('fee')) {
      return 'asset'; // Expenses reduce assets
    }
    if (account.includes('revenue') || account.includes('income')) {
      return 'equity'; // Revenue increases equity
    }
    
    return 'asset'; // Default to asset
  }
}

function categorizeCashFlow(debitAccount, creditAccount) {
  const debit = debitAccount.toLowerCase();
  const credit = creditAccount.toLowerCase();

  // Operating activities
  if (debit.includes('revenue') || debit.includes('expense') || debit.includes('fee') ||
      credit.includes('revenue') || credit.includes('expense') || credit.includes('fee')) {
    return 'operating';
  }

  // Investing activities
  if (debit.includes('digital asset') || debit.includes('investment') ||
      credit.includes('digital asset') || credit.includes('investment')) {
    return 'investing';
  }

  // Financing activities
  if (debit.includes('loan') || debit.includes('equity') || debit.includes('capital') ||
      credit.includes('loan') || credit.includes('equity') || credit.includes('capital')) {
    return 'financing';
  }

  return 'operating'; // Default to operating
}

module.exports = router;
