#!/bin/bash
# Trading System Startup Script

echo "🚀 Starting Trading System..."

# Start server in background
cd server
echo "Starting API server..."
python main.py &

# Store the process ID
SERVER_PID=$!

echo "✅ Server started (PID: $SERVER_PID)"
echo "🌐 API available at: http://localhost:3001"
echo ""
echo "📋 Next steps:"
echo "1. Install client/trading_client.js in Tampermonkey"
echo "2. Navigate to amarclub.net"
echo "3. Use the client UI to control trading"
echo ""
echo "🛑 To stop server: kill $SERVER_PID"