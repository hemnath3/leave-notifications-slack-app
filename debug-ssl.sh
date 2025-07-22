#!/bin/bash

echo "🔍 SSL Certificate Error Debug Script"
echo "====================================="

echo ""
echo "1. Checking for Node.js processes:"
ps aux | grep -E "(node|npm|nodemon)" | grep -v grep | grep -v "Code Helper" | grep -v "Cursor" | grep -v "JumpCloud" || echo "No Node.js processes found"

echo ""
echo "2. Checking port 3000:"
lsof -i :3000 || echo "Port 3000 is free"

echo ""
echo "3. Checking environment variables:"
env | grep -i tls || echo "No TLS environment variables found"

echo ""
echo "4. Checking npm config:"
npm config get NODE_TLS_REJECT_UNAUTHORIZED || echo "No npm TLS config found"

echo ""
echo "5. Checking shell profiles:"
grep -r "NODE_TLS_REJECT_UNAUTHORIZED" ~/.zshrc ~/.bash_profile ~/.bashrc ~/.profile 2>/dev/null || echo "No TLS settings in shell profiles"

echo ""
echo "6. Checking for PM2 processes:"
ps aux | grep pm2 | grep -v grep || echo "No PM2 processes found"

echo ""
echo "✅ Debug complete. If you're still seeing SSL errors, they might be coming from:"
echo "   - A different terminal window/tab"
echo "   - VS Code's integrated terminal"
echo "   - A cached error message"
echo "   - A different application" 