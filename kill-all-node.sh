#!/bin/bash

echo "🔪 Killing All Node.js Processes"
echo "================================"

echo ""
echo "1. Killing all node processes..."
pkill -f "node.*server" || echo "No node server processes found"
pkill -f "npm.*start" || echo "No npm start processes found"
pkill -f nodemon || echo "No nodemon processes found"

echo ""
echo "2. Killing all node processes by name..."
pkill -f node || echo "No node processes found"

echo ""
echo "3. Checking for processes on port 3000..."
lsof -i :3000 || echo "Port 3000 is free"

echo ""
echo "4. Checking for any remaining node processes..."
ps aux | grep -E "(node|npm)" | grep -v grep | grep -v "Code Helper" | grep -v "Cursor" | grep -v "JumpCloud" || echo "No Node.js processes found"

echo ""
echo "5. Checking all terminals..."
who

echo ""
echo "✅ All Node.js processes should be killed!"
echo "If you're still seeing SSL errors, they might be coming from:"
echo "   - A different terminal window/tab"
echo "   - VS Code's integrated terminal"
echo "   - A different application"
echo "   - Cached error messages" 