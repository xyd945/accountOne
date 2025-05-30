#!/bin/bash

# AI Bookkeeping Development Environment Setup Script

set -e

echo "🚀 Setting up AI Bookkeeping development environment..."

# Check if required tools are installed
check_requirements() {
    echo "📋 Checking requirements..."
    
    if ! command -v node &> /dev/null; then
        echo "❌ Node.js is not installed. Please install Node.js 18+ first."
        exit 1
    fi
    
    if ! command -v docker &> /dev/null; then
        echo "❌ Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        echo "❌ Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    echo "✅ All requirements satisfied"
}

# Setup environment variables
setup_env() {
    echo "🔧 Setting up environment variables..."
    
    if [ ! -f .env ]; then
        cp env.example .env
        echo "📝 Created .env file from template"
        echo "⚠️  Please edit .env file with your actual API keys and configuration"
    else
        echo "✅ .env file already exists"
    fi
}

# Install dependencies
install_dependencies() {
    echo "📦 Installing dependencies..."
    
    # Backend dependencies
    echo "Installing backend dependencies..."
    cd backend
    npm install
    cd ..
    
    # Frontend dependencies
    echo "Installing frontend dependencies..."
    cd frontend
    npm install
    cd ..
    
    echo "✅ Dependencies installed"
}

# Setup database
setup_database() {
    echo "🗄️  Setting up database..."
    
    # Start PostgreSQL with Docker Compose
    docker-compose up -d postgres
    
    # Wait for PostgreSQL to be ready
    echo "⏳ Waiting for PostgreSQL to be ready..."
    sleep 10
    
    echo "✅ Database setup complete"
}

# Run initial tests
run_tests() {
    echo "🧪 Running initial tests..."
    
    # Backend tests
    cd backend
    npm test
    cd ..
    
    # Frontend type check
    cd frontend
    npm run type-check
    cd ..
    
    echo "✅ Tests passed"
}

# Main setup function
main() {
    echo "🎯 AI Bookkeeping Setup"
    echo "======================="
    
    check_requirements
    setup_env
    install_dependencies
    setup_database
    
    echo ""
    echo "🎉 Setup complete!"
    echo ""
    echo "Next steps:"
    echo "1. Edit .env file with your API keys"
    echo "2. Start the development servers:"
    echo "   - Backend: cd backend && npm run dev"
    echo "   - Frontend: cd frontend && npm run dev"
    echo "3. Visit http://localhost:3000 to see the application"
    echo "4. API documentation: http://localhost:3001/api-docs"
    echo ""
    echo "For more information, see README.md"
}

# Run main function
main "$@" 