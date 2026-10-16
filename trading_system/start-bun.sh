#!/bin/bash
# Bun Trading Server Startup Script

echo "🚀 Starting Bun Trading Server..."

# Check if bun is installed
if ! command -v bun &> /dev/null; then
    echo "❌ Bun is not installed!"
    echo "Please install Bun first: curl -fsSL https://bun.sh/install | bash"
    exit 1
fi

# Navigate to server directory
cd "$(dirname "$0")/server"

# Install dependencies
echo "📦 Installing dependencies..."
bun install

# Start server
echo "🚀 Starting server..."
bun run server.ts