# 🚀 AccountingOne - AI-Powered Blockchain Bookkeeping

![Build Status](https://img.shields.io/badge/build-passing-brightgreen) ![Node.js](https://img.shields.io/badge/node.js-18%2B-blue) ![License](https://img.shields.io/badge/license-MIT-green)

> **Intelligent cryptocurrency bookkeeping with real-time price feeds, AI-powered journal entries, and IFRS compliance**

AccountingOne automates blockchain transaction analysis and generates professional accounting records using advanced AI models and real-time smart contract price feeds.

---

## ✨ Key Features

### 🤖 **AI-Powered Analysis**
- **Automatic Transaction Categorization** - Staking, DeFi, trading, NFTs
- **IFRS-Compliant Journal Entries** - Professional accounting standards
- **Bulk Wallet Analysis** - Process entire wallet history at once
- **Smart Pattern Recognition** - Learns transaction patterns

### 💰 **Real-Time Price Feeds**
- **Smart Contract Integration** - Direct FTSO v2 price feeds
- **Live USD Valuations** - Real-time cryptocurrency pricing
- **Multi-Asset Support** - 10+ major cryptocurrencies
- **On-Chain Price Verification** - Cryptographically verified prices

### 🔗 **Blockchain Integration** 
- **Multi-Network Support** - Ethereum, Flare, Coston2 testnet
- **Real-Time Transaction Import** - Direct blockchain API integration
- **Address Monitoring** - Track multiple wallet addresses
- **Gas Fee Calculation** - Accurate fee accounting

### 📊 **Professional Reporting**
- **IFRS Financial Statements** - Balance sheet, P&L, cash flow
- **Real-Time Dashboards** - Live portfolio tracking
- **Audit Trail** - Complete transaction history
- **Export Capabilities** - CSV, PDF reports

---

## 🏗️ System Architecture

```
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│    Frontend      │    │     Backend      │    │   Smart Contract │
│   (Next.js)      │◄──►│   (Express.js)   │◄──►│  FTSO Consumer   │
│                  │    │                  │    │   (Solidity)     │
│ • React 18       │    │ • Node.js        │    │                  │
│ • TypeScript     │    │ • JWT Auth       │    │ • FTSO v2 Feeds  │
│ • Tailwind CSS   │    │ • AI Integration │    │ • Real-time USD  │
│ • Real-time UI   │    │ • Blockchain API │    │ • Multi-currency │
└──────────────────┘    └──────────────────┘    └──────────────────┘
         │                        │                        │
         └────────────────────────┼────────────────────────┘
                                  │
                    ┌──────────────────┐
                    │   External APIs  │
                    │                  │
                    │ • Blockscout API │
                    │ • Google AI      │
                    │ • Supabase DB    │
                    │ • Flare Network  │
                    └──────────────────┘
```

### Smart Contract Architecture

Our **FtsoPriceConsumer** contract provides real-time price feeds:

```solidity
// Deployed on Flare Coston2: 0xed1692dd816996B8D7EB39e21344B3ed9Fda2d11
contract FtsoPriceConsumer {
    // Real-time price feeds for 10+ cryptocurrencies
    function getPrice(string symbol) returns (uint256 value, int8 decimals, uint64 timestamp)
    function getAllPrices() returns (uint256[] values, int8[] decimals, uint64 timestamp)
    function calculateUSDValue(string symbol, uint256 amount, uint8 decimals) returns (uint256 usdValue)
}
```

**Supported Assets**: BTC, ETH, FLR, USDC, USDT, AVAX, POL/MATIC, ADA, DOT, LTC + custom tokens

### Testing Token Contract

For comprehensive testing and transaction simulation, we've deployed our own **XYD Token** (ERC-20) on Coston2:

```solidity
// XYD Token Contract: 0xA05FecE52B5ba199c03FD265B567c0F1C7a84891
// Explorer: https://coston2-explorer.flare.network/address/0xA05FecE52B5ba199c03FD265B567c0F1C7a84891
contract XYDToken {
    // Standard ERC-20 implementation
    // Used for simulating real-world token transactions
    // Enables comprehensive testing of token transfers, approvals, and DeFi interactions
}
```

This token allows us to:
- **Simulate Real Transactions** - Generate diverse transaction types for testing
- **Test AI Categorization** - Verify token transfer detection and classification  
- **Validate Price Feeds** - Test USD valuation with custom token rates
- **Demo Complete Flows** - Showcase end-to-end transaction processing

---

## 🚀 Quick Start

### Prerequisites
```bash
Node.js 18+
PostgreSQL (via Supabase)
Google AI API key
Flare network access
```

### 1. Clone and Setup
```bash
git clone https://github.com/yourusername/accountOne.git
cd accountOne

# Backend setup
cd backend
npm install
cp .env.example .env
# Configure environment variables (see below)
npm start

# Frontend setup  
cd ../frontend
npm install
cp .env.local.example .env.local
# Configure environment variables
npm run dev
```

### 2. Environment Configuration

**Backend (.env)**
```bash
# Server
PORT=3001
NODE_ENV=development
JWT_SECRET=your-secure-jwt-secret

# Database (Supabase)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# AI Provider
GOOGLE_GEMINI_API_KEY=your-gemini-api-key

# Smart Contract Price Feeds
FTSO_PRICE_CONSUMER_ADDRESS=0xed1692dd816996B8D7EB39e21344B3ed9Fda2d11
FTSO_PRICE_CONSUMER_ENABLED=true
FLARE_RPC_URL=https://coston2-api.flare.network/ext/C/rpc
FLARE_CHAIN_ID=114

# Blockchain APIs
BLOCKSCOUT_BASE_URL=https://coston2-blockscout.flare.network
BLOCKSCOUT_API_KEY=your-api-key
```

**Frontend (.env.local)**
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 3. Database Setup
```sql
-- Run in your Supabase SQL editor
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  txid TEXT UNIQUE NOT NULL,
  description TEXT,
  blockchain_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE journal_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id UUID REFERENCES transactions(id),
  account_debit TEXT NOT NULL,
  account_credit TEXT NOT NULL,
  amount NUMERIC(20, 8) NOT NULL,
  currency TEXT NOT NULL,
  entry_date DATE NOT NULL,
  transaction_date DATE,
  narrative TEXT,
  ai_confidence NUMERIC(3, 2),
  is_reviewed BOOLEAN DEFAULT FALSE,
  usd_value NUMERIC(20, 2),
  usd_rate NUMERIC(20, 8),
  usd_source TEXT,
  usd_timestamp TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 💡 Usage Examples

### Analyze Single Transaction
```bash
curl -X POST http://localhost:3001/api/transactions/import \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "txid": "0x4fe7096f9232c2f1b69736dc6a5de6d247ca23514f9337e9abd45c3ab5f9e126",
    "description": "XYD token transfer with C2FLR gas"
  }'
```

### Bulk Wallet Analysis
```bash
curl -X POST http://localhost:3001/api/transactions/wallet/analyze \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "address": "0x862847B44845eD331dc8FA211Df3C01eCBB1b38C",
    "options": {
      "limit": 100,
      "startDate": "2024-01-01",
      "categories": ["staking", "dex_trade", "token_transfer"],
      "saveEntries": true
    }
  }'
```

### Get Real-Time Prices
```bash
curl http://localhost:3001/api/ftso/price/ETH
# Returns: {"symbol":"ETH","usdPrice":3402.25,"source":"ftso-contract","timestamp":"2024-12-19T..."}
```

---

## 🧠 AI-Powered Features

### Smart Transaction Categorization

Our AI automatically identifies and categorizes transactions:

| **Category** | **Description** | **Example Journal Entry** |
|--------------|-----------------|---------------------------|
| **Staking** | Proof-of-stake rewards | `Staked Assets` ↔ `Digital Assets - ETH` |
| **DeFi Trading** | DEX swaps and trades | `Digital Assets - USDC` ↔ `Digital Assets - ETH` |
| **Lending** | DeFi protocol interactions | `DeFi Protocol Assets` ↔ `Digital Assets - USDT` |
| **NFT** | Non-fungible token trades | `NFT Assets` ↔ `Digital Assets - ETH` |
| **Token Transfer** | ERC-20 transfers | `Digital Assets - XYD` ↔ `Accounts Payable` |
| **Gas Fees** | Transaction costs | `Transaction Fees` ↔ `Digital Assets - ETH` |

### Example AI Analysis Output
```json
{
  "transaction": {
    "hash": "0x4fe7096f...",
    "category": "token_transfer",
    "confidence": 0.95
  },
  "journalEntries": [
    {
      "debit": "Digital Assets - XYD",
      "credit": "Accounts Payable", 
      "amount": 100.00,
      "currency": "XYD",
      "usdValue": 5.00,
      "narrative": "Received XYD tokens for services rendered"
    },
    {
      "debit": "Transaction Fees",
      "credit": "Digital Assets - C2FLR",
      "amount": 0.0013047,
      "currency": "C2FLR", 
      "usdValue": 0.023,
      "narrative": "Gas fee for XYD token transfer"
    }
  ]
}
```

---

## 📊 Real-Time Price Integration

### FTSO Smart Contract

Our deployed contract at `0xed1692dd816996B8D7EB39e21344B3ed9Fda2d11` provides:

- **Real-time prices** from Flare FTSO v2 network
- **Cryptographic verification** of all price data
- **Multi-asset support** for major cryptocurrencies
- **Automatic USD conversion** for journal entries

### Price Feed Architecture
```
Flare FTSO v2 Network
       ↓
FtsoPriceConsumer Contract (0xed1692dd...)
       ↓
Backend FTSO Service
       ↓  
Journal Entry USD Values
       ↓
Frontend Real-time Display
```

### Example Price Feed Response
```json
{
  "ETH": {
    "price": 340225000000,
    "decimals": 8,
    "usdPrice": 3402.25,
    "timestamp": "2024-12-19T10:30:00Z",
    "source": "ftso-contract",
    "contractAddress": "0xed1692dd816996B8D7EB39e21344B3ed9Fda2d11"
  }
}
```

---

## 📈 API Reference

### Authentication
```bash
# Send OTP
POST /api/auth/send-otp
Body: {"email": "user@example.com"}

# Verify OTP & Login  
POST /api/auth/verify-otp
Body: {"email": "user@example.com", "otp": "123456"}
```

### Transactions
```bash
# Import single transaction
POST /api/transactions/import
Body: {"txid": "0x...", "description": "Trading activity"}

# Bulk wallet analysis
POST /api/transactions/wallet/analyze  
Body: {"address": "0x...", "options": {...}}

# Get journal entries
GET /api/journal-entries?limit=20&offset=0
```

### Price Feeds
```bash
# Get real-time price
GET /api/ftso/price/{symbol}

# Get all supported prices
GET /api/ftso/prices

# Check price feed health
GET /api/ftso/health
```

### Reports
```bash
# Balance sheet
GET /api/reports/balance-sheet?date=2024-12-31

# Cash flow statement  
GET /api/reports/cash-flow?startDate=2024-01-01&endDate=2024-12-31

# Journal entry export
GET /api/reports/journal-entries/export?format=csv
```

---

## 🔧 Development

### Project Structure
```
accountOne/
├── frontend/          # Next.js React application
│   ├── app/           # App router pages
│   ├── components/    # Reusable UI components
│   └── lib/           # Utilities and API client
├── backend/           # Express.js API server
│   ├── src/
│   │   ├── routes/    # API route handlers
│   │   ├── services/  # Business logic
│   │   └── utils/     # Helper functions
│   └── tests/         # Test files
├── contracts/         # Smart contracts (Solidity)
│   ├── src/           # Contract source code
│   └── script/        # Deployment scripts
└── database/          # SQL schema and migrations
```

### Key Services

**Backend Services:**
- `ftsoService.js` - Smart contract price feed integration
- `geminiClient.js` - AI-powered transaction analysis
- `blockscoutClient.js` - Blockchain data fetching
- `journalEntryService.js` - Accounting logic
- `accountService.js` - Chart of accounts management

**Smart Contracts:**
- `FtsoPriceConsumer.sol` - Real-time price feed consumer
- `XYDToken.sol` - ERC-20 test token for transaction simulation
- Deployed on Flare Coston2 testnet for development

### Testing
```