# 🤖 AI-Powered Cryptocurrency Bookkeeping

An intelligent bookkeeping application that automates cryptocurrency transaction analysis and generates IFRS-compliant journal entries using AI.

## ✨ Features

### 🔐 **Modern Authentication**
- **Passwordless OTP Login** - Sign in with 6-digit email codes
- **Traditional Password Auth** - Backward compatible login
- **Automatic Account Creation** - Seamless user onboarding
- **Session Management** - Secure JWT-based authentication

### 🤖 **AI-Powered Analysis**
- **Transaction Classification** - Automatic categorization using Google Gemini AI
- **IFRS Compliance** - Generate compliant journal entries
- **Smart Recognition** - Identify transaction types and patterns
- **Multi-blockchain Support** - Ethereum, Bitcoin, and more

### 🚀 **Advanced Bulk Processing** (NEW)
- **Wallet Address Analysis** - Analyze entire wallet transaction history
- **Bulk Transaction Processing** - Process hundreds of transactions at once
- **Smart Categorization** - Automatic detection of staking, DeFi, trading activities
- **Category-Specific Analysis** - Specialized AI prompts for different transaction types
- **Investment Account Mapping** - Proper classification of staking and DeFi activities

### 📊 **Financial Management**
- **Real-time Transaction Import** - Connect blockchain addresses
- **Journal Entry Generation** - Automated double-entry bookkeeping
- **Financial Reports** - Balance sheets, P&L, cash flow statements
- **Audit Trail** - Complete transaction history

### 🔗 **Blockchain Integration**
- **Blockscout API** - Real-time blockchain data
- **Multi-network Support** - Ethereum mainnet, testnets
- **Address Monitoring** - Track multiple wallet addresses
- **Transaction Verification** - Cryptographic validation

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend      │    │   External      │
│   (Next.js)     │◄──►│   (Express)     │◄──►│   Services      │
│                 │    │                 │    │                 │
│ • React 18      │    │ • Node.js       │    │ • Supabase      │
│ • TypeScript    │    │ • Express.js    │    │ • Google AI     │
│ • Tailwind CSS  │    │ • JWT Auth      │    │ • Blockscout    │
│ • Supabase Auth │    │ • Swagger API   │    │ • PostgreSQL    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- Supabase account
- Google AI API key
- Blockscout API access

### 1. Clone Repository
```bash
git clone https://github.com/xyd945/ai-bookkeeping.git
cd ai-bookkeeping
```

### 2. Backend Setup
```bash
cd backend
npm install
cp .env.example .env
# Configure environment variables (see below)
npm start
```

### 3. Frontend Setup
```bash
cd frontend
npm install
cp .env.local.example .env.local
# Configure environment variables (see below)
npm run dev
```

### 4. Database Setup
Create tables in your Supabase database:
```sql
-- See database/schema.sql for complete setup
```

## ⚙️ Environment Configuration

### Backend (.env)
```bash
# Server
PORT=3001
NODE_ENV=development
JWT_SECRET=your-jwt-secret

# Supabase
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# AI Provider
GOOGLE_GEMINI_API_KEY=your-gemini-api-key

# Blockchain APIs
BLOCKSCOUT_BASE_URL=https://eth.blockscout.com
BLOCKSCOUT_API_KEY=your-blockscout-key

# CORS
CORS_ORIGIN=http://localhost:3000
```

### Frontend (.env.local)
```bash
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## 📚 API Documentation

The backend provides a comprehensive REST API with Swagger documentation:

- **Local:** http://localhost:3001/api-docs
- **Authentication:** JWT Bearer tokens
- **Rate Limiting:** Configured per endpoint
- **Error Handling:** Standardized error responses

### Key Endpoints

#### Traditional Endpoints
```
POST /api/auth/send-otp          # Send OTP code
POST /api/auth/verify-otp        # Verify OTP and login
GET  /api/transactions           # List transactions
POST /api/transactions/import    # Import blockchain transactions
GET  /api/reports/balance-sheet  # Generate balance sheet
```

#### 🚀 NEW Bulk Analysis Endpoints
```
POST /api/transactions/wallet/analyze    # Analyze entire wallet address
POST /api/transactions/wallet/preview    # Preview wallet without AI analysis
POST /api/transactions/bulk/process      # Process multiple transactions
GET  /api/transactions/categories        # Get supported transaction categories
```

## 🔧 Advanced Bulk Processing Features

### Wallet Address Analysis

Analyze an entire wallet address and automatically generate journal entries for all transactions:

```bash
curl -X POST http://localhost:3001/api/transactions/wallet/analyze \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "address": "0x742e8c9b3be7936e2f6d143de3e9bb8f4b4d2b9e",
    "options": {
      "limit": 100,
      "startDate": "2024-01-01",
      "endDate": "2024-12-31",
      "categories": ["staking", "dex_trade", "lending"],
      "minValue": 0.001,
      "saveEntries": true
    }
  }'
```

**Response includes:**
- Complete transaction categorization
- Generated journal entries for all transactions
- IFRS compliance assessment
- Processing recommendations
- Category-specific analysis

### Supported Transaction Categories

The system automatically detects and categorizes transactions:

| Category | Description | Example Accounts |
|----------|-------------|------------------|
| **Staking** | Cryptocurrency staking activities | `Staked Assets` ↔ `Digital Assets - ETH` |
| **DEX Trading** | Decentralized exchange trades | `Digital Assets - USDC` ↔ `Digital Assets - ETH` |
| **Lending** | DeFi lending protocol interactions | `DeFi Protocol Assets` ↔ `Digital Assets - USDT` |
| **NFT** | Non-fungible token transactions | `NFT Assets` ↔ `Digital Assets - ETH` |
| **Liquidity Provision** | DEX liquidity pool participation | `Liquidity Pool Tokens` ↔ `Digital Assets` |
| **Token Transfers** | ERC-20 token movements | `Digital Assets - [Token]` ↔ Various accounts |

### AI-Powered Categorization Examples

#### Staking Transactions
```json
{
  "category": "staking",
  "entries": [
    {
      "accountDebit": "Staked Assets",
      "accountCredit": "Digital Assets - Ethereum",
      "amount": 32.0,
      "currency": "ETH",
      "narrative": "ETH 2.0 staking deposit - reclassified to staked assets",
      "confidence": 0.95
    }
  ]
}
```

#### DeFi Trading
```json
{
  "category": "dex_trade", 
  "entries": [
    {
      "accountDebit": "Digital Assets - USDC",
      "accountCredit": "Digital Assets - Ethereum",
      "amount": 1500.0,
      "currency": "USDC",
      "narrative": "Uniswap ETH to USDC trade",
      "confidence": 0.92
    },
    {
      "accountDebit": "Transaction Fees",
      "accountCredit": "Digital Assets - Ethereum",
      "amount": 0.005,
      "currency": "ETH",
      "narrative": "Gas fees for DEX trade",
      "confidence": 0.98
    }
  ]
}
```

### Testing the New Features

Run the comprehensive test suite:

```bash
# Test the bulk analysis functionality
cd backend
node test-bulk-analysis.js

# Test specific components
npm test
```

The test script will:
1. ✅ Check AI client health
2. 🔍 Test transaction categorization
3. 🎯 Test specific transaction types
4. 🚀 Perform full bulk analysis

## 🧪 Testing

### Backend Tests
```bash
cd backend
npm test                    # Run all tests
npm run test:watch         # Watch mode
npm run test:coverage      # Coverage report
node test-bulk-analysis.js # Test new bulk features
```

### Frontend Tests
```bash
cd frontend
npm test                   # Run component tests
npm run test:e2e          # End-to-end tests
```

## 🔧 Development

### Code Quality
- **ESLint** - Code linting and formatting
- **Prettier** - Code formatting
- **TypeScript** - Type safety
- **Husky** - Git hooks for quality checks

### Available Scripts
```bash
# Backend
npm run dev          # Development server
npm run build        # Production build
npm run lint         # Lint code
npm run test         # Run tests

# Frontend
npm run dev          # Development server
npm run build        # Production build
npm run start        # Production server
npm run lint         # Lint code
```

## 📦 Deployment

### Backend Deployment
1. Set production environment variables
2. Build the application: `npm run build`
3. Start production server: `npm start`

### Frontend Deployment
1. Configure production environment
2. Build static files: `npm run build`
3. Deploy to Vercel/Netlify or serve with `npm start`

### Database Migration
```bash
# Run database migrations
npm run migrate

# Seed initial data
npm run seed
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Development Guidelines
- Follow TypeScript best practices
- Write tests for new features
- Update documentation
- Follow conventional commit messages

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation:** Check the `/docs` folder
- **Issues:** Open a GitHub issue
- **Discussions:** Use GitHub Discussions
- **Email:** support@ai-bookkeeping.com

## 🗺️ Roadmap

### ✅ Recently Added
- **Bulk Transaction Analysis** - Process entire wallet addresses
- **Advanced AI Categorization** - Smart detection of staking, DeFi, trading
- **Investment Account Mapping** - Proper IFRS treatment for different activities
- **Category-Specific Templates** - Specialized analysis for each transaction type

### 🚧 In Progress
- [ ] **Multi-currency Support** - Support for various cryptocurrencies
- [ ] **Advanced AI Models** - Enhanced transaction classification
- [ ] **Mobile App** - React Native mobile application
- [ ] **API Integrations** - Connect with accounting software

### 🔮 Future Plans
- [ ] **Real-time Notifications** - Transaction alerts and updates
- [ ] **Advanced Reporting** - Custom report builder
- [ ] **Multi-tenant Support** - Enterprise features
- [ ] **Tax Optimization** - Automated tax strategy suggestions

## 🙏 Acknowledgments

- **Supabase** - Backend-as-a-Service platform
- **Google AI** - AI-powered transaction analysis
- **Blockscout** - Blockchain data provider
- **Next.js** - React framework
- **Tailwind CSS** - Utility-first CSS framework

---

Built with ❤️ for the crypto community 