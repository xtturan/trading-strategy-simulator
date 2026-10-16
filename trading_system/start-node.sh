#!/bin/bash
# Node.js Trading Server Startup Script

echo "🚀 Starting Node.js Trading Server..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed!"
    echo "Please install Node.js from https://nodejs.org"
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed!"
    exit 1
fi

# Navigate to server directory
cd "$(dirname "$0")/server"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Start server
echo "🚀 Starting server..."
node server.js