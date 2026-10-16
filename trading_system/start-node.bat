@echo off
echo 🚀 Starting Node.js Trading Server...

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed!
    echo Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)

REM Check if npm is installed
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ npm is not installed!
    pause
    exit /b 1
)

REM Navigate to server directory
cd server

REM Install dependencies
echo 📦 Installing dependencies...
npm install

REM Start server
echo 🚀 Starting server...
node server.js

pause