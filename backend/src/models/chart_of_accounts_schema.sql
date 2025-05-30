-- Chart of Accounts Schema for AI Cryptocurrency Bookkeeping
-- IFRS-Compliant Account Structure

-- Account Categories (Main Groups)
CREATE TABLE IF NOT EXISTS account_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(10) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE')),
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chart of Accounts
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(200) NOT NULL,
  category_id UUID REFERENCES account_categories(id),
  parent_account_id UUID REFERENCES accounts(id), -- For sub-accounts
  account_type VARCHAR(20) NOT NULL CHECK (account_type IN ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE')),
  sub_type VARCHAR(50), -- e.g., 'CURRENT_ASSET', 'FIXED_ASSET', 'DIGITAL_ASSET'
  currency VARCHAR(10), -- NULL for multi-currency accounts, specific currency for currency-specific accounts
  is_active BOOLEAN DEFAULT TRUE,
  is_system_account BOOLEAN DEFAULT FALSE, -- For system-generated accounts
  description TEXT,
  ifrs_reference VARCHAR(50), -- e.g., 'IAS 38', 'IFRS 9'
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cryptocurrency Asset Definitions
CREATE TABLE IF NOT EXISTS crypto_assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  symbol VARCHAR(20) UNIQUE NOT NULL, -- BTC, ETH, USDT, etc.
  name VARCHAR(100) NOT NULL, -- Bitcoin, Ethereum, Tether USD
  account_id UUID REFERENCES accounts(id), -- Link to the account for this asset
  contract_address VARCHAR(100), -- For tokens (ERC-20, etc.)
  blockchain VARCHAR(50), -- ethereum, bitcoin, polygon, etc.
  decimals INTEGER DEFAULT 18,
  is_stable_coin BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Account Mappings for AI (to help AI choose correct accounts)
CREATE TABLE IF NOT EXISTS account_ai_mappings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID REFERENCES accounts(id),
  keywords TEXT[], -- Array of keywords that should map to this account
  transaction_types TEXT[], -- Array of transaction types: purchase, sale, transfer, staking, etc.
  context_patterns TEXT[], -- Common phrases that indicate this account
  confidence_weight NUMERIC(3,2) DEFAULT 1.0, -- Weighting for AI selection
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_accounts_code ON accounts(code);
CREATE INDEX IF NOT EXISTS idx_accounts_category_id ON accounts(category_id);
CREATE INDEX IF NOT EXISTS idx_accounts_parent_account_id ON accounts(parent_account_id);
CREATE INDEX IF NOT EXISTS idx_accounts_account_type ON accounts(account_type);
CREATE INDEX IF NOT EXISTS idx_accounts_currency ON accounts(currency);
CREATE INDEX IF NOT EXISTS idx_crypto_assets_symbol ON crypto_assets(symbol);
CREATE INDEX IF NOT EXISTS idx_crypto_assets_account_id ON crypto_assets(account_id);
CREATE INDEX IF NOT EXISTS idx_account_ai_mappings_account_id ON account_ai_mappings(account_id);

-- Updated at triggers
CREATE TRIGGER update_account_categories_updated_at BEFORE UPDATE ON account_categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_crypto_assets_updated_at BEFORE UPDATE ON crypto_assets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_account_ai_mappings_updated_at BEFORE UPDATE ON account_ai_mappings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); 