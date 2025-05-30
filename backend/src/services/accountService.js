const { createClient } = require('@supabase/supabase-js');
const logger = require('../utils/logger');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

class AccountService {
  /**
   * Get all active accounts with their categories
   */
  async getChartOfAccounts() {
    try {
      const { data, error } = await supabase
        .from('accounts')
        .select(`
          *,
          account_categories(code, name, type)
        `)
        .eq('is_active', true)
        .order('sort_order');

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Failed to fetch chart of accounts', { error: error.message });
      throw error;
    }
  }

  /**
   * Find account by cryptocurrency symbol
   */
  async getAccountForCrypto(symbol) {
    try {
      const { data, error } = await supabase
        .from('crypto_assets')
        .select(`
          *,
          accounts(*)
        `)
        .eq('symbol', symbol.toUpperCase())
        .eq('is_active', true)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows returned
      return data?.accounts || null;
    } catch (error) {
      logger.error('Failed to get account for crypto', { symbol, error: error.message });
      throw error;
    }
  }

  /**
   * Find best matching account using AI mappings
   */
  async findAccountByAI(keywords, transactionType, description) {
    try {
      // Convert inputs to lowercase for matching
      const keywordArray = keywords.map(k => k.toLowerCase());
      const descriptionLower = description?.toLowerCase() || '';
      const transactionTypeLower = transactionType?.toLowerCase();

      const { data, error } = await supabase
        .from('account_ai_mappings')
        .select(`
          *,
          accounts(*)
        `)
        .eq('accounts.is_active', true);

      if (error) throw error;

      let bestMatch = null;
      let highestScore = 0;

      for (const mapping of data) {
        let score = 0;

        // Check keywords match
        const keywordMatches = mapping.keywords?.filter(keyword =>
          keywordArray.some(k => k.includes(keyword.toLowerCase()) || keyword.toLowerCase().includes(k))
        ).length || 0;
        score += keywordMatches * 3; // High weight for keyword matches

        // Check transaction type match
        if (transactionTypeLower && mapping.transaction_types?.includes(transactionTypeLower)) {
          score += 2;
        }

        // Check context patterns
        const contextMatches = mapping.context_patterns?.filter(pattern =>
          descriptionLower.includes(pattern.toLowerCase())
        ).length || 0;
        score += contextMatches * 1.5;

        // Apply confidence weight
        score *= (mapping.confidence_weight || 1.0);

        if (score > highestScore) {
          highestScore = score;
          bestMatch = {
            account: mapping.accounts,
            score,
            confidence: Math.min(score / 10, 1), // Normalize to 0-1
          };
        }
      }

      return bestMatch;
    } catch (error) {
      logger.error('Failed to find account by AI', { keywords, transactionType, error: error.message });
      throw error;
    }
  }

  /**
   * Get account by code
   */
  async getAccountByCode(code) {
    try {
      const { data, error } = await supabase
        .from('accounts')
        .select(`
          *,
          account_categories(code, name, type)
        `)
        .eq('code', code)
        .eq('is_active', true)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    } catch (error) {
      logger.error('Failed to get account by code', { code, error: error.message });
      throw error;
    }
  }

  /**
   * Get account by name (fuzzy match)
   */
  async getAccountByName(name) {
    try {
      const { data, error } = await supabase
        .from('accounts')
        .select(`
          *,
          account_categories(code, name, type)
        `)
        .ilike('name', `%${name}%`)
        .eq('is_active', true)
        .order('sort_order')
        .limit(5);

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Failed to get account by name', { name, error: error.message });
      throw error;
    }
  }

  /**
   * Validate journal entry accounts
   */
  async validateJournalEntry(debitAccountName, creditAccountName) {
    try {
      const debitAccounts = await this.getAccountByName(debitAccountName);
      const creditAccounts = await this.getAccountByName(creditAccountName);

      const validation = {
        isValid: true,
        errors: [],
        suggestions: [],
        debitAccount: debitAccounts[0] || null,
        creditAccount: creditAccounts[0] || null,
      };

      // Check if accounts exist
      if (!validation.debitAccount) {
        validation.isValid = false;
        validation.errors.push(`Debit account "${debitAccountName}" not found in chart of accounts`);
        
        // Suggest similar accounts
        const similar = await this.findSimilarAccounts(debitAccountName);
        if (similar.length > 0) {
          validation.suggestions.push(`Did you mean: ${similar.map(a => a.name).join(', ')}?`);
        }
      }

      if (!validation.creditAccount) {
        validation.isValid = false;
        validation.errors.push(`Credit account "${creditAccountName}" not found in chart of accounts`);
        
        // Suggest similar accounts
        const similar = await this.findSimilarAccounts(creditAccountName);
        if (similar.length > 0) {
          validation.suggestions.push(`Did you mean: ${similar.map(a => a.name).join(', ')}?`);
        }
      }

      // Check account types for basic double-entry validation
      if (validation.debitAccount && validation.creditAccount) {
        const debitType = validation.debitAccount.account_type;
        const creditType = validation.creditAccount.account_type;

        // Basic validation - ensure we're not doing something obviously wrong
        if (debitType === creditType && debitType === 'ASSET') {
          validation.suggestions.push('Both accounts are assets - ensure this is correct for an asset transfer');
        }
      }

      return validation;
    } catch (error) {
      logger.error('Failed to validate journal entry', { 
        debitAccountName, 
        creditAccountName, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Find similar account names using fuzzy matching
   */
  async findSimilarAccounts(searchTerm, limit = 3) {
    try {
      const { data, error } = await supabase
        .from('accounts')
        .select('code, name, account_type')
        .eq('is_active', true)
        .order('sort_order');

      if (error) throw error;

      // Simple similarity scoring based on common words
      const searchWords = searchTerm.toLowerCase().split(' ');
      const scored = data
        .map(account => {
          const accountWords = account.name.toLowerCase().split(' ');
          let score = 0;
          
          searchWords.forEach(searchWord => {
            accountWords.forEach(accountWord => {
              if (accountWord.includes(searchWord) || searchWord.includes(accountWord)) {
                score += 1;
              }
            });
          });

          return { ...account, score };
        })
        .filter(account => account.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      return scored;
    } catch (error) {
      logger.error('Failed to find similar accounts', { searchTerm, error: error.message });
      return [];
    }
  }

  /**
   * Create new crypto asset account if it doesn't exist
   */
  async createCryptoAssetAccount(symbol, name, blockchain = 'ethereum', decimals = 18) {
    try {
      // Check if crypto asset already exists
      const existing = await this.getAccountForCrypto(symbol);
      if (existing) {
        return existing;
      }

      // Get the "Digital Assets - Other" account as parent
      const parentAccount = await this.getAccountByCode('1808');
      if (!parentAccount) {
        throw new Error('Parent account "Digital Assets - Other" not found');
      }

      // Create new account
      const accountCode = `18${symbol.slice(0, 2).toUpperCase()}`;
      const accountName = `Digital Assets - ${name}`;

      const { data: newAccount, error: accountError } = await supabase
        .from('accounts')
        .insert([{
          code: accountCode,
          name: accountName,
          category_id: parentAccount.category_id,
          parent_account_id: parentAccount.id,
          account_type: 'ASSET',
          sub_type: 'DIGITAL_ASSET',
          description: `${name} cryptocurrency holdings`,
          ifrs_reference: 'IAS 38',
          is_system_account: true,
        }])
        .select()
        .single();

      if (accountError) throw accountError;

      // Create crypto asset record
      const { data: cryptoAsset, error: cryptoError } = await supabase
        .from('crypto_assets')
        .insert([{
          symbol: symbol.toUpperCase(),
          name,
          account_id: newAccount.id,
          blockchain,
          decimals,
          is_stable_coin: symbol.toUpperCase().includes('USD'),
        }])
        .select()
        .single();

      if (cryptoError) throw cryptoError;

      logger.info('Created new crypto asset account', { symbol, accountCode, accountName });

      return newAccount;
    } catch (error) {
      logger.error('Failed to create crypto asset account', { symbol, name, error: error.message });
      throw error;
    }
  }

  /**
   * Get accounts by type for reporting
   */
  async getAccountsByType(accountType) {
    try {
      const { data, error } = await supabase
        .from('accounts')
        .select(`
          *,
          account_categories(code, name, type)
        `)
        .eq('account_type', accountType)
        .eq('is_active', true)
        .order('sort_order');

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Failed to get accounts by type', { accountType, error: error.message });
      throw error;
    }
  }

  /**
   * Create a new general account with proper IFRS categorization
   * @param {Object} accountData - Account details
   * @param {string} accountData.name - Account name
   * @param {string} accountData.accountType - ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE
   * @param {string} accountData.categoryCode - Category code (e.g., '5000' for Operating Expenses)
   * @param {string} accountData.description - Account description
   * @param {string} accountData.ifrsReference - IFRS/IAS reference
   * @returns {Object} Created account
   */
  async createAccount({ name, accountType, categoryCode, description, ifrsReference = 'IAS 1' }) {
    try {
      // Get the category
      const { data: category, error: categoryError } = await supabase
        .from('account_categories')
        .select('*')
        .eq('code', categoryCode)
        .eq('type', accountType)
        .single();

      if (categoryError || !category) {
        throw new Error(`Category ${categoryCode} with type ${accountType} not found`);
      }

      // Generate account code - use category base + increment
      const existingAccountsInCategory = await supabase
        .from('accounts')
        .select('code')
        .eq('category_id', category.id)
        .order('code');

      let newCode;
      if (existingAccountsInCategory.data && existingAccountsInCategory.data.length > 0) {
        // Find the highest code in this category and increment
        const highestCode = existingAccountsInCategory.data
          .map(acc => parseInt(acc.code))
          .filter(code => !isNaN(code))
          .sort((a, b) => b - a)[0];
        
        newCode = (highestCode + 1).toString();
      } else {
        // Start with category base + 01
        newCode = categoryCode + '1';
      }

      // Determine sub_type based on account type and category
      let subType = accountType;
      switch (accountType) {
        case 'ASSET':
          if (categoryCode === '1000') subType = 'CURRENT_ASSET';
          else if (categoryCode === '1500') subType = 'NON_CURRENT_ASSET';
          else if (categoryCode === '1800') subType = 'DIGITAL_ASSET';
          break;
        case 'LIABILITY':
          if (categoryCode === '2000') subType = 'CURRENT_LIABILITY';
          else if (categoryCode === '2500') subType = 'NON_CURRENT_LIABILITY';
          break;
        case 'EXPENSE':
          if (categoryCode === '5000') subType = 'OPERATING_EXPENSE';
          else if (categoryCode === '6000') subType = 'FINANCIAL_EXPENSE';
          break;
        default:
          subType = accountType;
      }

      // Create the account
      const { data: newAccount, error: accountError } = await supabase
        .from('accounts')
        .insert([{
          code: newCode,
          name: name,
          category_id: category.id,
          account_type: accountType,
          sub_type: subType,
          description: description || `${name} account`,
          ifrs_reference: ifrsReference,
          is_system_account: false, // User-created account
          sort_order: parseInt(newCode),
        }])
        .select(`
          *,
          account_categories(code, name, type)
        `)
        .single();

      if (accountError) throw accountError;

      logger.info('Created new account', { 
        code: newCode, 
        name: name, 
        accountType: accountType,
        categoryCode: categoryCode
      });

      return newAccount;
    } catch (error) {
      logger.error('Failed to create account', { name, accountType, categoryCode, error: error.message });
      throw error;
    }
  }

  /**
   * Suggest account creation based on AI's needs
   * @param {string} accountName - The account name AI suggested
   * @param {string} transactionType - The type of transaction (expense, revenue, etc.)
   * @returns {Object} Account creation suggestion
   */
  async suggestAccountCreation(accountName, transactionType = 'unknown') {
    try {
      // Analyze the account name to determine type and category
      const nameLower = accountName.toLowerCase();
      let suggestion = {
        name: accountName,
        accountType: null,
        categoryCode: null,
        description: `${accountName} account`,
        ifrsReference: 'IAS 1',
        confidence: 0.7
      };

      // Determine account type based on name patterns
      if (nameLower.includes('expense') || nameLower.includes('cost') || 
          nameLower.includes('fee') || transactionType === 'expense') {
        suggestion.accountType = 'EXPENSE';
        
        // Determine if operating or financial expense
        if (nameLower.includes('gas') || nameLower.includes('transaction') || 
            nameLower.includes('exchange') || nameLower.includes('interest')) {
          suggestion.categoryCode = '6000'; // Financial Expenses
          suggestion.ifrsReference = 'IFRS 9';
        } else {
          suggestion.categoryCode = '5000'; // Operating Expenses
          suggestion.ifrsReference = 'IAS 1';
        }
      } else if (nameLower.includes('revenue') || nameLower.includes('income') || 
                 nameLower.includes('earning') || transactionType === 'revenue') {
        suggestion.accountType = 'REVENUE';
        suggestion.categoryCode = '4000';
        suggestion.ifrsReference = 'IFRS 15';
      } else if (nameLower.includes('payable') || nameLower.includes('owed') || 
                 nameLower.includes('liability') || nameLower.includes('loan')) {
        suggestion.accountType = 'LIABILITY';
        suggestion.categoryCode = '2000'; // Current Liabilities
        suggestion.ifrsReference = 'IAS 1';
      } else if (nameLower.includes('receivable') || nameLower.includes('asset') || 
                 nameLower.includes('cash') || nameLower.includes('bank')) {
        suggestion.accountType = 'ASSET';
        suggestion.categoryCode = '1000'; // Current Assets
        suggestion.ifrsReference = 'IFRS 9';
      } else if (nameLower.includes('equity') || nameLower.includes('capital') || 
                 nameLower.includes('retained')) {
        suggestion.accountType = 'EQUITY';
        suggestion.categoryCode = '3000';
        suggestion.ifrsReference = 'IAS 1';
      } else {
        // Default based on transaction type
        if (transactionType === 'expense') {
          suggestion.accountType = 'EXPENSE';
          suggestion.categoryCode = '5000';
        } else if (transactionType === 'revenue') {
          suggestion.accountType = 'REVENUE';
          suggestion.categoryCode = '4000';
        } else {
          // Default to asset
          suggestion.accountType = 'ASSET';
          suggestion.categoryCode = '1000';
        }
      }

      return suggestion;
    } catch (error) {
      logger.error('Failed to suggest account creation', { accountName, transactionType, error: error.message });
      throw error;
    }
  }
}

module.exports = new AccountService(); 