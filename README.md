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
GOOGLE_AI_API_KEY=your-google-ai-key

# Blockchain APIs
BLOCKSCOUT_API_URL=https://eth.blockscout.com/api
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
```
POST /api/auth/send-otp          # Send OTP code
POST /api/auth/verify-otp        # Verify OTP and login
GET  /api/transactions           # List transactions
POST /api/transactions/import    # Import blockchain transactions
GET  /api/reports/balance-sheet  # Generate balance sheet
```

## 🧪 Testing

### Backend Tests
```bash
cd backend
npm test                    # Run all tests
npm run test:watch         # Watch mode
npm run test:coverage      # Coverage report
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

- [ ] **Multi-currency Support** - Support for various cryptocurrencies
- [ ] **Advanced AI Models** - Enhanced transaction classification
- [ ] **Mobile App** - React Native mobile application
- [ ] **API Integrations** - Connect with accounting software
- [ ] **Real-time Notifications** - Transaction alerts and updates
- [ ] **Advanced Reporting** - Custom report builder
- [ ] **Multi-tenant Support** - Enterprise features

## 🙏 Acknowledgments

- **Supabase** - Backend-as-a-Service platform
- **Google AI** - AI-powered transaction analysis
- **Blockscout** - Blockchain data provider
- **Next.js** - React framework
- **Tailwind CSS** - Utility-first CSS framework

---

Built with ❤️ for the crypto community 