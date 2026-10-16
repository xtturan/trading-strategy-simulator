@echo off
echo 🚀 Starting Bun Trading Server...

REM Check if bun is installed
bun --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Bun is not installed!
    echo Please install Bun first from https://bun.sh
    pause
    exit /b 1
)

REM Navigate to server directory
cd server

REM Install dependencies
echo 📦 Installing dependencies...
bun install

REM Start server
echo 🚀 Starting server...
bun run server.ts

pause