# AI Bookkeeping Architecture

## Overview

This document provides a comprehensive overview of the AI-powered cryptocurrency bookkeeping application architecture, including system design, data flow, and key components.

## System Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend      │    │   External      │
│   (Next.js)     │    │   (Express.js)  │    │   Services      │
│                 │    │                 │    │                 │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │ React Pages │ │    │ │ REST API    │ │    │ │ Blockscout  │ │
│ │ Components  │ │◄──►│ │ Routes      │ │◄──►│ │ API         │ │
│ │ Hooks       │ │    │ │ Middleware  │ │    │ │             │ │
│ └─────────────┘ │    │ └─────────────┘ │    │ └─────────────┘ │
│                 │    │                 │    │                 │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │ API Client  │ │    │ │ AI Services │ │    │ │ Google      │ │
│ │ Auth Helper │ │    │ │ Blockscout  │ │◄──►│ │ Gemini      │ │
│ │ State Mgmt  │ │    │ │ Client      │ │    │ │ API         │ │
│ └─────────────┘ │    │ └─────────────┘ │    │ └─────────────┘ │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                                
                                ▼                                
                       ┌─────────────────┐                      
                       │   Database      │                      
                       │   (PostgreSQL)  │                      
                       │                 │                      
                       │ ┌─────────────┐ │                      
                       │ │ Users       │ │                      
                       │ │ Transactions│ │                      
                       │ │ Journal     │ │                      
                       │ │ Entries     │ │                      
                       │ └─────────────┘ │                      
                       └─────────────────┘                      
```

## Data Flow

### Transaction Processing Flow

1. **User Input**: User submits transaction ID and description via frontend
2. **API Request**: Frontend sends POST request to `/api/transactions`
3. **Authentication**: JWT token validated via Supabase
4. **Blockchain Data**: Backend fetches transaction data from Blockscout API
5. **AI Analysis**: Transaction data sent to Google Gemini for IFRS analysis
6. **Journal Generation**: AI returns structured journal entries
7. **Database Storage**: Entries saved to PostgreSQL via Supabase
8. **Response**: Frontend receives processed transaction with journal entries

### Reporting Flow

1. **Report Request**: User requests balance sheet or cash flow report
2. **Data Aggregation**: Backend queries journal entries from database
3. **Calculation**: Account balances and cash flows calculated
4. **Classification**: Accounts classified as assets, liabilities, equity
5. **Response**: Structured report data returned to frontend
6. **Visualization**: Frontend renders charts and tables using Recharts

## Backend Architecture

### Core Components

#### 1. Express.js Application (`src/app.js`)
- Main application setup
- Middleware configuration
- Route registration
- Error handling
- Swagger documentation

#### 2. Authentication Middleware (`src/middleware/auth.js`)
- JWT token validation
- Supabase integration
- User session management
- Route protection

#### 3. Services Layer

**Blockscout Client (`src/services/blockscoutClient.js`)**
- Blockchain data fetching
- API retry logic
- Data normalization
- Error handling

**AI Client Factory (`src/services/aiClients/index.js`)**
- Provider abstraction
- Google Gemini integration
- Extensible for additional AI providers
- Prompt template management

#### 4. Routes

**Authentication Routes (`src/routes/auth.js`)**
- User registration
- Login/logout
- Token refresh
- Session management

**Transaction Routes (`src/routes/transactions.js`)**
- Transaction processing
- Journal entry management
- Transaction history
- Entry updates

**Report Routes (`src/routes/reports.js`)**
- Balance sheet generation
- Cash flow reports
- Journal entry queries
- Financial analytics

### Database Schema

#### Users Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Transactions Table
```sql
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  txid TEXT UNIQUE NOT NULL,
  description TEXT,
  blockchain_data JSONB,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Journal Entries Table
```sql
CREATE TABLE journal_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id UUID REFERENCES transactions(id),
  account_debit TEXT NOT NULL,
  account_credit TEXT NOT NULL,
  amount NUMERIC(20, 8) NOT NULL,
  currency TEXT NOT NULL,
  entry_date DATE NOT NULL,
  narrative TEXT,
  ai_confidence NUMERIC(3, 2),
  is_reviewed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Frontend Architecture

### Technology Stack
- **Framework**: Next.js 14 with App Router
- **Styling**: Tailwind CSS
- **State Management**: React hooks + Context API
- **Forms**: React Hook Form with Zod validation
- **Charts**: Recharts
- **HTTP Client**: Axios
- **Authentication**: Supabase Auth Helpers

### Key Components

#### 1. Pages Structure
```
pages/
├── auth/
│   ├── login.tsx
│   └── register.tsx
├── transactions/
│   ├── index.tsx
│   ├── new.tsx
│   └── [id].tsx
├── reports/
│   ├── index.tsx
│   ├── balance-sheet.tsx
│   └── cash-flow.tsx
└── settings.tsx
```

#### 2. Component Architecture
```
components/
├── ui/
│   ├── Button.tsx
│   ├── Input.tsx
│   ├── Modal.tsx
│   └── Table.tsx
├── forms/
│   ├── TransactionForm.tsx
│   └── LoginForm.tsx
├── charts/
│   ├── BalanceSheetChart.tsx
│   └── CashFlowChart.tsx
└── layout/
    ├── Header.tsx
    ├── Sidebar.tsx
    └── Layout.tsx
```

#### 3. API Integration
- Centralized API client with interceptors
- Automatic token refresh
- Error handling and retry logic
- Type-safe interfaces

## AI Integration

### Google Gemini Integration

#### Prompt Engineering
- System prompt defines AI role as IFRS expert
- Transaction data formatted with placeholders
- Structured JSON response format
- Confidence scoring for entries

#### Response Processing
- JSON parsing and validation
- Double-entry bookkeeping verification
- Account classification
- Error handling for malformed responses

### Extensibility
- Factory pattern for multiple AI providers
- Configurable provider selection
- Standardized interface for all providers
- Easy addition of new AI services

## Security Considerations

### Authentication & Authorization
- JWT tokens via Supabase Auth
- Row-level security in database
- API route protection
- Session management

### Data Protection
- Environment variable management
- API key security
- Input validation and sanitization
- SQL injection prevention

### Infrastructure Security
- HTTPS enforcement
- CORS configuration
- Security headers
- Vulnerability scanning

## Deployment Architecture

### Development Environment
- Docker Compose for local services
- Hot reloading for development
- Environment variable templates
- Automated setup scripts

### Production Deployment

#### Backend (Google Cloud Run)
- Containerized deployment
- Auto-scaling
- Environment variable injection
- Health checks

#### Frontend (Vercel)
- Static site generation
- Edge deployment
- Automatic deployments
- Environment configuration

#### Database (Supabase)
- Managed PostgreSQL
- Real-time subscriptions
- Row-level security
- Automatic backups

### CI/CD Pipeline
- GitHub Actions workflows
- Automated testing
- Security scanning
- Multi-environment deployment

## Monitoring & Observability

### Logging
- Winston logger with structured logging
- Log levels and rotation
- Error tracking
- Performance monitoring

### Error Handling
- Centralized error middleware
- Custom error classes
- User-friendly error messages
- Stack trace management

### Metrics
- API response times
- Database query performance
- AI service latency
- User activity tracking

## Scalability Considerations

### Backend Scaling
- Stateless application design
- Database connection pooling
- Caching strategies
- Load balancing

### Database Optimization
- Proper indexing
- Query optimization
- Connection management
- Read replicas for reporting

### AI Service Management
- Rate limiting
- Request queuing
- Provider failover
- Cost optimization

## Future Enhancements

### Planned Features
1. **Multi-blockchain Support**
   - Bitcoin, Polygon, BSC integration
   - Cross-chain transaction tracking
   - Unified reporting

2. **Advanced AI Features**
   - Transaction categorization
   - Anomaly detection
   - Predictive analytics

3. **Enhanced Reporting**
   - Custom report builder
   - Export functionality
   - Audit trails

4. **Integration Ecosystem**
   - Accounting software APIs
   - Tax preparation tools
   - Portfolio management

### Technical Improvements
- GraphQL API implementation
- Real-time updates via WebSockets
- Advanced caching strategies
- Microservices architecture

## Development Guidelines

### Code Standards
- ESLint configuration
- Prettier formatting
- TypeScript strict mode
- Jest testing framework

### Git Workflow
- Feature branch strategy
- Pull request reviews
- Automated testing
- Semantic versioning

### Documentation
- API documentation with Swagger
- Component documentation
- Architecture decision records
- Deployment guides 