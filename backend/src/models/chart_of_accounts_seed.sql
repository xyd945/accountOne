-- Seed Data for Chart of Accounts
-- IFRS-Compliant Cryptocurrency Bookkeeping Structure

-- Account Categories
INSERT INTO account_categories (code, name, type, description, sort_order) VALUES
('1000', 'Current Assets', 'ASSET', 'Assets expected to be converted to cash within one year', 100),
('1500', 'Non-Current Assets', 'ASSET', 'Long-term assets held for more than one year', 200),
('1800', 'Digital Assets', 'ASSET', 'Cryptocurrency and digital token holdings', 300),
('2000', 'Current Liabilities', 'LIABILITY', 'Obligations due within one year', 400),
('2500', 'Non-Current Liabilities', 'LIABILITY', 'Long-term obligations due after one year', 500),
('3000', 'Equity', 'EQUITY', 'Owner equity and retained earnings', 600),
('4000', 'Revenue', 'REVENUE', 'Income from business operations', 700),
('5000', 'Operating Expenses', 'EXPENSE', 'Costs of normal business operations', 800),
('6000', 'Financial Expenses', 'EXPENSE', 'Finance-related costs and fees', 900)
ON CONFLICT (code) DO NOTHING;

-- Core Accounts
INSERT INTO accounts (code, name, category_id, account_type, sub_type, description, ifrs_reference, sort_order) VALUES
-- Current Assets
('1001', 'Cash and Cash Equivalents', (SELECT id FROM account_categories WHERE code = '1000'), 'ASSET', 'CURRENT_ASSET', 'Cash, bank deposits, and short-term investments', 'IAS 7', 1010),
('1002', 'Bank Account - Operating', (SELECT id FROM account_categories WHERE code = '1000'), 'ASSET', 'CURRENT_ASSET', 'Primary business bank account', 'IAS 7', 1020),
('1003', 'Bank Account - Crypto Exchange', (SELECT id FROM account_categories WHERE code = '1000'), 'ASSET', 'CURRENT_ASSET', 'Fiat currency held on crypto exchanges', 'IAS 7', 1030),

-- Digital Assets (Cryptocurrencies) - Major Assets
('1801', 'Digital Assets - Bitcoin', (SELECT id FROM account_categories WHERE code = '1800'), 'ASSET', 'DIGITAL_ASSET', 'Bitcoin holdings', 'IAS 38', 1801),
('1802', 'Digital Assets - Ethereum', (SELECT id FROM account_categories WHERE code = '1800'), 'ASSET', 'DIGITAL_ASSET', 'Ethereum holdings', 'IAS 38', 1802),
('1803', 'Digital Assets - USDT', (SELECT id FROM account_categories WHERE code = '1800'), 'ASSET', 'DIGITAL_ASSET', 'Tether USD stablecoin holdings', 'IAS 38', 1803),
('1804', 'Digital Assets - USDC', (SELECT id FROM account_categories WHERE code = '1800'), 'ASSET', 'DIGITAL_ASSET', 'USD Coin stablecoin holdings', 'IAS 38', 1804),
('1805', 'Digital Assets - DAI', (SELECT id FROM account_categories WHERE code = '1800'), 'ASSET', 'DIGITAL_ASSET', 'DAI stablecoin holdings', 'IAS 38', 1805),
('1806', 'Digital Assets - BNB', (SELECT id FROM account_categories WHERE code = '1800'), 'ASSET', 'DIGITAL_ASSET', 'Binance Coin holdings', 'IAS 38', 1806),
('1807', 'Digital Assets - MATIC', (SELECT id FROM account_categories WHERE code = '1800'), 'ASSET', 'DIGITAL_ASSET', 'Polygon MATIC token holdings', 'IAS 38', 1807),
('1808', 'Digital Assets - Other', (SELECT id FROM account_categories WHERE code = '1800'), 'ASSET', 'DIGITAL_ASSET', 'Other cryptocurrency holdings', 'IAS 38', 1808),

-- DeFi and Protocol Assets
('1820', 'DeFi Protocol Assets', (SELECT id FROM account_categories WHERE code = '1800'), 'ASSET', 'DIGITAL_ASSET', 'Assets locked in DeFi protocols', 'IAS 38', 1820),
('1821', 'Liquidity Pool Tokens', (SELECT id FROM account_categories WHERE code = '1800'), 'ASSET', 'DIGITAL_ASSET', 'LP tokens from providing liquidity', 'IAS 38', 1821),
('1822', 'Staked Assets', (SELECT id FROM account_categories WHERE code = '1800'), 'ASSET', 'DIGITAL_ASSET', 'Assets staked for rewards', 'IAS 38', 1822),
('1823', 'NFT Assets', (SELECT id FROM account_categories WHERE code = '1800'), 'ASSET', 'DIGITAL_ASSET', 'Non-fungible token holdings', 'IAS 38', 1823),

-- Current Liabilities
('2001', 'Accounts Payable', (SELECT id FROM account_categories WHERE code = '2000'), 'LIABILITY', 'CURRENT_LIABILITY', 'Amounts owed to suppliers', 'IAS 1', 2001),
('2002', 'Crypto Exchange Payables', (SELECT id FROM account_categories WHERE code = '2000'), 'LIABILITY', 'CURRENT_LIABILITY', 'Amounts owed to crypto exchanges', 'IAS 1', 2002),
('2003', 'Tax Payable', (SELECT id FROM account_categories WHERE code = '2000'), 'LIABILITY', 'CURRENT_LIABILITY', 'Tax obligations', 'IAS 12', 2003),

-- Equity
('3001', 'Share Capital', (SELECT id FROM account_categories WHERE code = '3000'), 'EQUITY', 'EQUITY', 'Issued share capital', 'IAS 1', 3001),
('3002', 'Retained Earnings', (SELECT id FROM account_categories WHERE code = '3000'), 'EQUITY', 'EQUITY', 'Accumulated profits/losses', 'IAS 1', 3002),
('3003', 'Crypto Revaluation Reserve', (SELECT id FROM account_categories WHERE code = '3000'), 'EQUITY', 'EQUITY', 'Unrealized gains/losses on crypto assets', 'IAS 38', 3003),

-- Revenue
('4001', 'Trading Revenue', (SELECT id FROM account_categories WHERE code = '4000'), 'REVENUE', 'REVENUE', 'Revenue from cryptocurrency trading', 'IFRS 15', 4001),
('4002', 'Staking Revenue', (SELECT id FROM account_categories WHERE code = '4000'), 'REVENUE', 'REVENUE', 'Revenue from staking rewards', 'IFRS 15', 4002),
('4003', 'Mining Revenue', (SELECT id FROM account_categories WHERE code = '4000'), 'REVENUE', 'REVENUE', 'Revenue from cryptocurrency mining', 'IFRS 15', 4003),
('4004', 'DeFi Yield Revenue', (SELECT id FROM account_categories WHERE code = '4000'), 'REVENUE', 'REVENUE', 'Revenue from DeFi protocols', 'IFRS 15', 4004),
('4005', 'Airdrops Revenue', (SELECT id FROM account_categories WHERE code = '4000'), 'REVENUE', 'REVENUE', 'Revenue from token airdrops', 'IFRS 15', 4005),

-- Operating Expenses
('5001', 'Salaries and Wages', (SELECT id FROM account_categories WHERE code = '5000'), 'EXPENSE', 'OPERATING_EXPENSE', 'Employee compensation', 'IAS 19', 5001),
('5002', 'Office Expenses', (SELECT id FROM account_categories WHERE code = '5000'), 'EXPENSE', 'OPERATING_EXPENSE', 'General office and administrative costs', 'IAS 1', 5002),
('5003', 'Software and Technology', (SELECT id FROM account_categories WHERE code = '5000'), 'EXPENSE', 'OPERATING_EXPENSE', 'Technology and software expenses', 'IAS 38', 5003),
('5004', 'Professional Services', (SELECT id FROM account_categories WHERE code = '5000'), 'EXPENSE', 'OPERATING_EXPENSE', 'Legal, accounting, consulting fees', 'IAS 1', 5004),
('5005', 'Marketing and Advertising', (SELECT id FROM account_categories WHERE code = '5000'), 'EXPENSE', 'OPERATING_EXPENSE', 'Marketing and promotional costs', 'IAS 1', 5005),

-- Financial Expenses
('6001', 'Transaction Fees', (SELECT id FROM account_categories WHERE code = '6000'), 'EXPENSE', 'FINANCIAL_EXPENSE', 'Blockchain transaction fees (gas fees)', 'IAS 1', 6001),
('6002', 'Exchange Fees', (SELECT id FROM account_categories WHERE code = '6000'), 'EXPENSE', 'FINANCIAL_EXPENSE', 'Cryptocurrency exchange trading fees', 'IAS 1', 6002),
('6003', 'Conversion Fees', (SELECT id FROM account_categories WHERE code = '6000'), 'EXPENSE', 'FINANCIAL_EXPENSE', 'Currency conversion fees', 'IAS 1', 6003),
('6004', 'Interest Expense', (SELECT id FROM account_categories WHERE code = '6000'), 'EXPENSE', 'FINANCIAL_EXPENSE', 'Interest on loans and credit', 'IAS 23', 6004),
('6005', 'Bank Fees', (SELECT id FROM account_categories WHERE code = '6000'), 'EXPENSE', 'FINANCIAL_EXPENSE', 'Banking and wire transfer fees', 'IAS 1', 6005),
('6006', 'Realized Loss on Crypto', (SELECT id FROM account_categories WHERE code = '6000'), 'EXPENSE', 'FINANCIAL_EXPENSE', 'Realized losses from crypto sales', 'IAS 38', 6006)
ON CONFLICT (code) DO NOTHING;

-- Cryptocurrency Asset Definitions
INSERT INTO crypto_assets (symbol, name, account_id, blockchain, decimals, is_stable_coin) VALUES
('BTC', 'Bitcoin', (SELECT id FROM accounts WHERE code = '1801'), 'bitcoin', 8, false),
('ETH', 'Ethereum', (SELECT id FROM accounts WHERE code = '1802'), 'ethereum', 18, false),
('USDT', 'Tether USD', (SELECT id FROM accounts WHERE code = '1803'), 'ethereum', 6, true),
('USDC', 'USD Coin', (SELECT id FROM accounts WHERE code = '1804'), 'ethereum', 6, true),
('DAI', 'Dai Stablecoin', (SELECT id FROM accounts WHERE code = '1805'), 'ethereum', 18, true),
('BNB', 'Binance Coin', (SELECT id FROM accounts WHERE code = '1806'), 'binance-smart-chain', 18, false),
('MATIC', 'Polygon', (SELECT id FROM accounts WHERE code = '1807'), 'polygon', 18, false)
ON CONFLICT (symbol) DO NOTHING;

-- AI Mapping Keywords for Account Selection
INSERT INTO account_ai_mappings (account_id, keywords, transaction_types, context_patterns) VALUES
-- Digital Assets
((SELECT id FROM accounts WHERE code = '1801'), ARRAY['bitcoin', 'btc'], ARRAY['purchase', 'sale', 'transfer', 'receive'], ARRAY['bought bitcoin', 'received btc', 'bitcoin payment']),
((SELECT id FROM accounts WHERE code = '1802'), ARRAY['ethereum', 'eth'], ARRAY['purchase', 'sale', 'transfer', 'receive'], ARRAY['bought ethereum', 'received eth', 'ethereum payment']),
((SELECT id FROM accounts WHERE code = '1803'), ARRAY['usdt', 'tether'], ARRAY['purchase', 'sale', 'transfer', 'receive'], ARRAY['bought usdt', 'received tether', 'usdt payment']),
((SELECT id FROM accounts WHERE code = '1804'), ARRAY['usdc', 'usd coin'], ARRAY['purchase', 'sale', 'transfer', 'receive'], ARRAY['bought usdc', 'received usdc', 'usdc payment']),

-- Expenses
((SELECT id FROM accounts WHERE code = '6001'), ARRAY['gas', 'transaction fee', 'network fee'], ARRAY['transfer', 'contract_interaction'], ARRAY['gas fee', 'transaction cost', 'network fee']),
((SELECT id FROM accounts WHERE code = '6002'), ARRAY['trading fee', 'exchange fee'], ARRAY['purchase', 'sale'], ARRAY['exchange fee', 'trading cost']),
((SELECT id FROM accounts WHERE code = '5001'), ARRAY['salary', 'wages', 'payroll'], ARRAY['payment'], ARRAY['employee payment', 'salary payment', 'payroll']),
((SELECT id FROM accounts WHERE code = '5003'), ARRAY['software', 'saas', 'subscription'], ARRAY['payment'], ARRAY['software subscription', 'saas payment', 'license fee']),

-- Revenue
((SELECT id FROM accounts WHERE code = '4001'), ARRAY['trading profit', 'realized gain'], ARRAY['sale'], ARRAY['crypto sale profit', 'trading gain']),
((SELECT id FROM accounts WHERE code = '4002'), ARRAY['staking reward', 'staking income'], ARRAY['staking'], ARRAY['staking reward', 'validator reward']),
((SELECT id FROM accounts WHERE code = '4004'), ARRAY['defi yield', 'liquidity mining', 'yield farming'], ARRAY['defi'], ARRAY['defi reward', 'yield farming', 'liquidity reward'])
ON CONFLICT DO NOTHING; 