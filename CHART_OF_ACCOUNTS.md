# 📊 Chart of Accounts System

This document explains the comprehensive Chart of Accounts system implemented for cryptocurrency bookkeeping with IFRS compliance.

## 🎯 Overview

The Chart of Accounts system provides:
- **Standardized Account Structure** - IFRS-compliant account hierarchy
- **Cryptocurrency Asset Management** - Specific accounts for BTC, ETH, USDT, etc.
- **AI-Guided Account Selection** - Intelligent account mapping for transactions
- **Automated Account Creation** - Dynamic creation of crypto asset accounts
- **Validation & Compliance** - Built-in IFRS validation rules

## 🏗️ Database Structure

### Account Categories
```sql
account_categories
├── 1000 - Current Assets
├── 1500 - Non-Current Assets  
├── 1800 - Digital Assets (Cryptocurrencies)
├── 2000 - Current Liabilities
├── 2500 - Non-Current Liabilities
├── 3000 - Equity
├── 4000 - Revenue
├── 5000 - Operating Expenses
└── 6000 - Financial Expenses
```

### Core Accounts

#### 📱 Digital Assets (1800s)
| Code | Account Name | Description |
|------|--------------|-------------|
| 1801 | Digital Assets - Bitcoin | Bitcoin holdings |
| 1802 | Digital Assets - Ethereum | Ethereum holdings |
| 1803 | Digital Assets - USDT | Tether USD stablecoin |
| 1804 | Digital Assets - USDC | USD Coin stablecoin |
| 1805 | Digital Assets - DAI | DAI stablecoin |
| 1806 | Digital Assets - BNB | Binance Coin |
| 1807 | Digital Assets - MATIC | Polygon MATIC token |
| 1808 | Digital Assets - Other | Other cryptocurrencies |
| 1820 | DeFi Protocol Assets | Assets in DeFi protocols |
| 1821 | Liquidity Pool Tokens | LP tokens |
| 1822 | Staked Assets | Staked crypto assets |
| 1823 | NFT Assets | Non-fungible tokens |

#### 💰 Current Assets (1000s)
| Code | Account Name | Description |
|------|--------------|-------------|
| 1001 | Cash and Cash Equivalents | Cash and short-term investments |
| 1002 | Bank Account - Operating | Primary business bank account |
| 1003 | Bank Account - Crypto Exchange | Fiat on exchanges |

#### 💸 Revenue (4000s)
| Code | Account Name | Description |
|------|--------------|-------------|
| 4001 | Trading Revenue | Crypto trading profits |
| 4002 | Staking Revenue | Staking rewards |
| 4003 | Mining Revenue | Mining rewards |
| 4004 | DeFi Yield Revenue | DeFi protocol yields |
| 4005 | Airdrops Revenue | Token airdrops |

#### 💳 Expenses (5000s & 6000s)
| Code | Account Name | Description |
|------|--------------|-------------|
| 5001 | Salaries and Wages | Employee compensation |
| 5003 | Software and Technology | Tech expenses |
| 5004 | Professional Services | Legal, accounting fees |
| 6001 | Transaction Fees | Gas fees, network fees |
| 6002 | Exchange Fees | Trading fees |
| 6006 | Realized Loss on Crypto | Crypto sale losses |

## 🤖 AI Account Selection

The AI system uses multiple strategies to select appropriate accounts:

### 1. Cryptocurrency Recognition
```javascript
// Automatic mapping for crypto symbols
BTC → Digital Assets - Bitcoin
ETH → Digital Assets - Ethereum  
USDT → Digital Assets - USDT
USDC → Digital Assets - USDC
```

### 2. Keyword Matching
```javascript
// AI mappings for common patterns
keywords: ['gas', 'transaction fee'] → Transaction Fees
keywords: ['salary', 'payroll'] → Salaries and Wages
keywords: ['staking reward'] → Staking Revenue
```

### 3. Context Analysis
```javascript
// Description analysis
"Payment for software license" → Software and Technology
"Received USDT for consulting" → Professional Services (revenue)
"Gas fee for token transfer" → Transaction Fees
```

## 📋 API Endpoints

### Get Chart of Accounts
```http
GET /api/accounts/chart
Authorization: Bearer <token>
```

**Response:**
```json
{
  "chartOfAccounts": {
    "Digital Assets": {
      "category": { "code": "1800", "name": "Digital Assets", "type": "ASSET" },
      "accounts": [
        {
          "code": "1801",
          "name": "Digital Assets - Bitcoin",
          "account_type": "ASSET",
          "description": "Bitcoin holdings"
        }
      ]
    }
  },
  "totalAccounts": 25
}
```

### Search Accounts
```http
GET /api/accounts/search?q=bitcoin&type=ASSET
Authorization: Bearer <token>
```

### Get Crypto Account
```http
GET /api/accounts/crypto/BTC
Authorization: Bearer <token>
```

### Create New Crypto Account
```http
POST /api/accounts/crypto
Authorization: Bearer <token>
Content-Type: application/json

{
  "symbol": "LINK",
  "name": "Chainlink",
  "blockchain": "ethereum",
  "decimals": 18
}
```

### Validate Journal Entry
```http
POST /api/accounts/validate
Authorization: Bearer <token>
Content-Type: application/json

{
  "debitAccount": "Digital Assets - Bitcoin",
  "creditAccount": "Cash and Cash Equivalents"
}
```

## 🔧 Usage Examples

### Example 1: Token Payment Transaction
**Transaction:** Pay 1000 USDT for software development

**AI Analysis:**
```json
[
  {
    "accountDebit": "Software and Technology",
    "accountCredit": "Digital Assets - USDT", 
    "amount": 1000,
    "currency": "USDT",
    "narrative": "Software development payment",
    "confidence": 0.95
  },
  {
    "accountDebit": "Transaction Fees",
    "accountCredit": "Digital Assets - Ethereum",
    "amount": 0.002,
    "currency": "ETH", 
    "narrative": "Gas fee for USDT transfer",
    "confidence": 0.90
  }
]
```

### Example 2: Staking Rewards
**Transaction:** Receive 0.1 ETH staking reward

**AI Analysis:**
```json
[
  {
    "accountDebit": "Digital Assets - Ethereum",
    "accountCredit": "Staking Revenue",
    "amount": 0.1,
    "currency": "ETH",
    "narrative": "Ethereum staking reward",
    "confidence": 0.98
  }
]
```

### Example 3: New Token Purchase  
**Transaction:** Buy 500 LINK tokens

**AI Analysis:**
1. AI detects unknown token "LINK"
2. System creates new account: "1808 - Digital Assets - Chainlink"
3. Generates journal entry:

```json
[
  {
    "accountDebit": "Digital Assets - Chainlink", 
    "accountCredit": "Digital Assets - USDC",
    "amount": 500,
    "currency": "LINK",
    "narrative": "Purchase of Chainlink tokens",
    "confidence": 0.85
  }
]
```

## 🛠️ Setup Instructions

### 1. Run Migration
```bash
cd scripts
node migrate-chart-of-accounts.js
```

### 2. Verify Setup
```bash
# Check if accounts were created
curl -H "Authorization: Bearer <token>" \
  http://localhost:3001/api/accounts/chart
```

### 3. Test AI Integration
```bash
# Process a transaction to see AI account selection
curl -X POST -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"txid": "0x123...", "description": "Pay 100 USDT for consulting"}' \
  http://localhost:3001/api/transactions
```

## 🔍 Account Validation

The system provides comprehensive validation:

### Validation Rules
✅ **Account Existence** - Accounts must exist in chart  
✅ **Double-Entry Balance** - Debits must equal credits  
✅ **IFRS Compliance** - Follows international standards  
✅ **Currency Consistency** - Amounts match transaction currency  
✅ **Positive Amounts** - All amounts must be positive  

### Error Handling
```javascript
// Example validation response
{
  "isValid": false,
  "errors": [
    "Debit account 'Bitcoin Asset' not found in chart of accounts"
  ],
  "suggestions": [
    "Did you mean: Digital Assets - Bitcoin, Digital Assets - Other?"
  ],
  "debitAccount": null,
  "creditAccount": { /* account object */ }
}
```

## 📈 Reporting Benefits

With the chart of accounts system:

### Balance Sheet
```
ASSETS
Current Assets:
  Cash and Cash Equivalents        $10,000
  Bank Account - Operating         $25,000
Digital Assets:
  Digital Assets - Bitcoin         1.5 BTC
  Digital Assets - Ethereum        10 ETH
  Digital Assets - USDT           5,000 USDT
```

### Cash Flow Statement  
```
OPERATING ACTIVITIES
  Staking Revenue                  +$1,200
  Software and Technology          -$2,500
  Transaction Fees                   -$150
Net Operating Cash Flow             -$1,450
```

## 🚀 Future Enhancements

Planned improvements:
- [ ] **Custom Account Creation** - User-defined accounts
- [ ] **Account Hierarchies** - Sub-account relationships  
- [ ] **Multi-Currency Accounts** - Single account, multiple currencies
- [ ] **Account Templates** - Industry-specific chart templates
- [ ] **Account Analytics** - Usage statistics and optimization
- [ ] **Automated Account Creation** - Smart detection of new tokens

## 🤝 Contributing

To add new account types or improve AI mappings:

1. Update `chart_of_accounts_seed.sql` with new accounts
2. Add AI mappings in `account_ai_mappings` table
3. Update validation rules if needed
4. Test with real transaction data
5. Submit PR with documentation updates

---

For questions or support, please open an issue in the GitHub repository. 