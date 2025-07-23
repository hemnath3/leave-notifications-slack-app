#!/bin/bash

# Production Setup Script for Leave Notifications Slack App
# This script helps you set up the production environment

echo "🚀 Leave Notifications Slack App - Production Setup"
echo "=================================================="

# Check if required tools are installed
echo "📋 Checking prerequisites..."

if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ Node.js $(node --version) and npm $(npm --version) are installed"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  No .env file found. Creating from template..."
    cp env.production.example .env
    echo "📝 Please edit .env file with your production values"
    echo "   Required variables:"
    echo "   - SLACK_BOT_TOKEN"
    echo "   - SLACK_SIGNING_SECRET"
    echo "   - MONGODB_URI"
    echo "   - NODE_ENV=production"
    echo "   - USE_SOCKET_MODE=false"
else
    echo "✅ .env file found"
fi

# Check environment variables
echo "🔍 Checking environment variables..."

required_vars=("SLACK_BOT_TOKEN" "SLACK_SIGNING_SECRET" "MONGODB_URI")

for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo "⚠️  $var is not set in environment"
    else
        echo "✅ $var is set"
    fi
done

# Test MongoDB connection
echo "🗄️  Testing MongoDB connection..."
if [ -n "$MONGODB_URI" ]; then
    node -e "
    const mongoose = require('mongoose');
    mongoose.connect(process.env.MONGODB_URI)
        .then(() => {
            console.log('✅ MongoDB connection successful');
            process.exit(0);
        })
        .catch(err => {
            console.log('❌ MongoDB connection failed:', err.message);
            process.exit(1);
        });
    " 2>/dev/null
    if [ $? -eq 0 ]; then
        echo "✅ MongoDB connection test passed"
    else
        echo "❌ MongoDB connection test failed"
    fi
else
    echo "⚠️  MONGODB_URI not set, skipping connection test"
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Edit .env file with your production values"
echo "2. Deploy to your hosting platform (Railway, Heroku, etc.)"
echo "3. Configure your Slack app with webhook URLs"
echo "4. Test the health endpoint: curl https://your-domain.com/health"
echo ""
echo "📚 For detailed instructions, see DEPLOYMENT.md" 