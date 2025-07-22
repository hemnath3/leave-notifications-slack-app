#!/bin/bash

echo "🚀 Railway Deployment Script for Leave Notifications Slack App"
echo "================================================================"

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo "❌ Git repository not found. Please initialize git first:"
    echo "   git init"
    echo "   git add ."
    echo "   git commit -m 'Initial commit'"
    exit 1
fi

# Check if remote origin exists
if ! git remote get-url origin > /dev/null 2>&1; then
    echo "❌ No GitHub remote found. Please add your GitHub repository:"
    echo "   git remote add origin https://github.com/yourusername/your-repo-name.git"
    echo "   git push -u origin main"
    exit 1
fi

echo "✅ Git repository found"

# Check if all required files exist
required_files=("package.json" "src/server.js" "Procfile" "railway.json" ".gitignore")
missing_files=()

for file in "${required_files[@]}"; do
    if [ ! -f "$file" ]; then
        missing_files+=("$file")
    fi
done

if [ ${#missing_files[@]} -ne 0 ]; then
    echo "❌ Missing required files:"
    for file in "${missing_files[@]}"; do
        echo "   - $file"
    done
    exit 1
fi

echo "✅ All required files found"

# Check if .env file exists (for reference)
if [ -f ".env" ]; then
    echo "📝 Found .env file (will be ignored by git)"
    echo "   Make sure to add these variables to Railway:"
    echo "   - SLACK_BOT_TOKEN"
    echo "   - SLACK_SIGNING_SECRET" 
    echo "   - SLACK_APP_TOKEN"
    echo "   - MONGODB_URI"
    echo "   - SLACK_CHANNEL_ID (optional)"
else
    echo "⚠️  No .env file found"
    echo "   Create one for local development, but add variables to Railway for production"
fi

echo ""
echo "🎯 Ready to deploy! Follow these steps:"
echo ""
echo "1. Push your code to GitHub:"
echo "   git add ."
echo "   git commit -m 'Ready for deployment'"
echo "   git push"
echo ""
echo "2. Deploy to Railway:"
echo "   - Go to https://railway.app"
echo "   - Click 'Start a New Project'"
echo "   - Choose 'Deploy from GitHub repo'"
echo "   - Select your repository"
echo ""
echo "3. Add environment variables in Railway Dashboard:"
echo "   - Go to your project → Variables tab"
echo "   - Add all the variables from your .env file"
echo ""
echo "4. Test your deployment:"
echo "   - Check Railway logs for success messages"
echo "   - Test Slack commands in your workspace"
echo ""
echo "📖 For detailed instructions, see DEPLOYMENT.md"
echo ""
echo "Good luck! 🚀" 