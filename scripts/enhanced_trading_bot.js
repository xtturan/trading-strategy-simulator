// ==UserScript==
// @name         Enhanced Trading Bot - Volatility Breakout
// @namespace    http://tampermonkey.net/
// @version      3.0
// @description  Self-sufficient trading bot with Volatility Breakout strategy and historical data scraping
// @match        https://amarclub.net/*
// @match        https://*.amarclub.net/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      *
// ==/UserScript==

(function() {
    'use strict';

    // Internal data storage (self-sufficient)
    let historicalData = [];
    let currentBalance = 300;
    let baseBet = 2; // Conservative bet sizing
    let currentBet = 2;
    let isRunning = false;
    let botLogs = [];
    let wins = 0;
    let losses = 0;
    let sessionBankroll = 300;
    let doublesCount = 0;
    let bankruptcies = 0;

    // State management
    // Create a Web Worker for background-safe timing
    // Web Workers are not throttled when tab is in background
    function createTimerWorker() {
        const workerCode = `
            let interval = null;
            self.onmessage = function(e) {
                if (e.data === 'start') {
                    if (interval) clearInterval(interval);
                    interval = setInterval(() => self.postMessage('tick'), 1000);
                } else if (e.data === 'stop') {
                    if (interval) clearInterval(interval);
                    interval = null;
                }
            };
        `;
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        const worker = new Worker(URL.createObjectURL(blob));
        return worker;
    }

    let timerWorker = null;
    let lastTimeLeft = -1;
    let roundState = 'WAITING';
    let waitingForResult = false;
    let resultCheckedThisRound = false;
    let dataAddedThisRound = false;
    let loopRunning = false;
    let scrapingInProgress = false;

    // Add cyberpunk-themed styles matching history_scraper.js
    GM_addStyle(`
        #enhanced-trading-bot {
            position: fixed;
            top: 10px;
            right: 10px;
            width: 340px;
            background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
            border: 1px solid #334155;
            border-radius: 16px;
            padding: 16px;
            z-index: 999999999 !important;  /* Increased z-index */
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            color: white;
            box-shadow: 0 20px 60px rgba(0,0,0,0.5);
            max-height: 90vh;
            overflow-y: auto;
            pointer-events: all !important;  /* Ensure all pointer events work */
        }
        
        #enhanced-trading-bot::-webkit-scrollbar { width: 6px; }
        #enhanced-trading-bot::-webkit-scrollbar-thumb { 
            background: #475569; 
            border-radius: 3px; 
        }
        
        #enhanced-trading-bot h3 {
            margin: 0 0 12px 0;
            font-size: 18px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        #enhanced-trading-bot .status {
            font-size: 11px;
            padding: 4px 10px;
            border-radius: 12px;
            font-weight: bold;
        }
        
        #enhanced-trading-bot .status.running { 
            background: #22c55e; 
            color: white;
        }
        
        #enhanced-trading-bot .status.stopped { 
            background: #64748b; 
            color: white;
        }
        
        @keyframes pulse {
            0% { box-shadow: 0 0 15px rgba(0, 255, 65, 0.5); }
            50% { box-shadow: 0 0 25px rgba(0, 255, 65, 0.8); }
            100% { box-shadow: 0 0 15px rgba(0, 255, 65, 0.5); }
        }
        
        #enhanced-trading-bot .row {
            display: flex;
            gap: 12px;
            margin-bottom: 12px;
        }
        
        #enhanced-trading-bot .field {
            flex: 1;
        }
        
        #enhanced-trading-bot label {
            display: block;
            font-size: 12px;
            color: #00cc33;
            margin-bottom: 6px;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        
        #enhanced-trading-bot input {
            width: 100%;
            padding: 10px;
            border: 1px solid #334155;
            border-radius: 8px;
            background: #0f172a;
            color: white;
            font-size: 14px;
            box-sizing: border-box;
        }
        
        #enhanced-trading-bot input:focus {
            outline: none;
            border-color: #3b82f6;
        }
        
        #enhanced-trading-bot button {
            padding: 12px 16px;
            border: none;
            border-radius: 8px;
            background: #22c55e;
            color: white;
            font-weight: bold;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.2s;
            pointer-events: all !important;  /* Force pointer events */
            position: relative;
            z-index: 10;
        }
        
        #enhanced-trading-bot button:hover {
            background: #16a34a;
            transform: scale(1.02);
        }
        
        #enhanced-trading-bot .btn-start { 
            background: #22c55e; 
            color: white; 
            flex: 1; 
        }
        
        #enhanced-trading-bot .btn-stop { 
            background: #ef4444; 
            color: white; 
            flex: 1; 
        }
        
        #enhanced-trading-bot .btn-stop:hover {
            background: #dc2626;
        }
        
        #enhanced-trading-bot .timer-box {
            background: rgba(0, 20, 10, 0.8);
            border-radius: 10px;
            padding: 20px;
            text-align: center;
            margin: 15px 0;
            border: 2px solid #00ff41;
        }
        
        #enhanced-trading-bot .timer {
            font-size: 48px;
            font-weight: bold;
            letter-spacing: 3px;
            text-shadow: 0 0 15px #00ff41;
        }
        
        #enhanced-trading-bot .phase {
            font-size: 14px;
            color: #00cc33;
            margin-top: 8px;
            text-transform: uppercase;
            font-weight: bold;
            letter-spacing: 1px;
            animation: phase-pulse 2s infinite;
        }
        
        @keyframes phase-pulse {
            0% { opacity: 1; text-shadow: 0 0 5px #00cc33; }
            50% { opacity: 0.8; text-shadow: 0 0 15px #00ff41; }
            100% { opacity: 1; text-shadow: 0 0 5px #00cc33; }
        }
        
        #enhanced-trading-bot .stats {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 10px;
            margin: 15px 0;
        }
        
        #enhanced-trading-bot .stat {
            background: rgba(0, 20, 10, 0.8);
            padding: 12px 8px;
            border-radius: 8px;
            text-align: center;
            border: 1px solid #00ff41;
        }
        
        #enhanced-trading-bot .stat-value {
            font-size: 20px;
            font-weight: bold;
            text-shadow: 0 0 10px #00ff41;
        }
        
        #enhanced-trading-bot .stat-label {
            font-size: 11px;
            color: #00cc33;
            margin-top: 4px;
            text-transform: uppercase;
        }
        
        #enhanced-trading-bot .green { color: #00ff41; }
        #enhanced-trading-bot .red { color: #ff0040; }
        #enhanced-trading-bot .yellow { color: #ffff00; }
        #enhanced-trading-bot .blue { color: #00aaff; }
        
        #enhanced-trading-bot .strategy-info {
            background: rgba(0, 20, 10, 0.8);
            border-radius: 10px;
            padding: 15px;
            margin: 15px 0;
            border: 1px solid #00ff41;
        }
        
        #enhanced-trading-bot .strategy-title {
            font-size: 14px;
            color: #00ff41;
            margin-bottom: 10px;
            text-transform: uppercase;
            text-align: center;
        }
        
        #enhanced-trading-bot .strategy-details {
            font-size: 12px;
            color: #00cc33;
            line-height: 1.4;
        }
        
        #enhanced-trading-bot .logs {
            background: rgba(0, 10, 5, 0.9);
            border-radius: 10px;
            padding: 12px;
            max-height: 160px;
            overflow-y: auto;
            font-size: 11px;
            font-family: 'Courier New', monospace;
            border: 1px solid #00ff41;
        }
        
        #enhanced-trading-bot .log-entry {
            padding: 5px 0;
            border-bottom: 1px solid rgba(0, 255, 65, 0.2);
        }
        
        #enhanced-trading-bot .log-entry:last-child { border-bottom: none; }
        #enhanced-trading-bot .log-win { color: #00ff41; }
        #enhanced-trading-bot .log-loss { color: #ff0040; }
        #enhanced-trading-bot .log-info { color: #00aaff; }
        #enhanced-trading-bot .log-action { color: #ffff00; }
        #enhanced-trading-bot .log-error { color: #ff4444; }
        
        /* Manual Controls Styling */
        #enhanced-trading-bot .manual-controls {
            background: rgba(0, 20, 10, 0.8);
            border-radius: 10px;
            padding: 15px;
            margin: 15px 0;
            border: 1px solid #00ff41;
        }
        
        #enhanced-trading-bot .manual-controls label {
            color: #00cc33;
            font-size: 11px;
        }
        
        #enhanced-trading-bot .manual-controls input {
            background: rgba(0, 15, 8, 0.9);
            border: 1px solid #00aa33;
        }
        
        #enhanced-trading-bot .manual-controls button {
            background: transparent;
            border: 1px solid #00ff41;
            color: #00ff41;
            padding: 10px;
            font-size: 12px;
        }
        
        /* Data Display Panel Styling */
        #enhanced-trading-bot .data-display-panel {
            background: rgba(0, 15, 8, 0.9);
            border-radius: 10px;
            margin: 15px 0;
            border: 1px solid #00ff41;
            overflow: hidden;
        }
        
        #enhanced-trading-bot .panel-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 15px;
            background: rgba(0, 30, 15, 0.5);
            border-bottom: 1px solid #00aa33;
        }
        
        #enhanced-trading-bot .panel-title {
            font-size: 14px;
            font-weight: bold;
            color: #00ff41;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        
        #enhanced-trading-bot .data-counter {
            font-size: 12px;
            color: #00cc33;
            background: rgba(0, 255, 65, 0.1);
            padding: 4px 10px;
            border-radius: 12px;
        }
        
        #enhanced-trading-bot .data-scroll-container {
            max-height: 200px;
            overflow-y: auto;
            padding: 10px;
        }
        
        #enhanced-trading-bot .data-scroll-container::-webkit-scrollbar {
            width: 6px;
        }
        
        #enhanced-trading-bot .data-scroll-container::-webkit-scrollbar-thumb {
            background: #00aa33;
            border-radius: 3px;
        }
        
        #enhanced-trading-bot .data-list {
            display: flex;
            flex-direction: column;
            gap: 6px;
        }
        
        #enhanced-trading-bot .data-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 12px;
            background: rgba(0, 20, 10, 0.7);
            border-radius: 6px;
            border: 1px solid rgba(0, 255, 65, 0.3);
            font-family: 'Courier New', monospace;
            font-size: 13px;
            transition: all 0.2s;
        }
        
        #enhanced-trading-bot .data-item:hover {
            background: rgba(0, 40, 20, 0.8);
            border-color: #00ff41;
        }
        
        #enhanced-trading-bot .data-index {
            color: #00aaff;
            font-weight: bold;
            min-width: 30px;
        }
        
        #enhanced-trading-bot .data-value {
            color: #00ff41;
            font-weight: bold;
            font-size: 16px;
            min-width: 25px;
            text-align: center;
        }
        
        #enhanced-trading-bot .data-timestamp {
            color: #666666;
            font-size: 11px;
        }
        
        #enhanced-trading-bot .empty-state {
            text-align: center;
            color: #666666;
            font-style: italic;
            padding: 30px 10px;
            font-size: 12px;
        }
        
        #enhanced-trading-bot .data-controls {
            display: flex;
            gap: 10px;
            padding: 12px 15px;
            background: rgba(0, 20, 10, 0.5);
            border-top: 1px solid #00aa33;
        }
        
        #enhanced-trading-bot .control-btn {
            flex: 1;
            padding: 8px 12px;
            background: transparent;
            border: 1px solid #ff4444;
            color: #ff4444;
            border-radius: 6px;
            font-family: 'Courier New', monospace;
            font-size: 11px;
            cursor: pointer;
            transition: all 0.2s;
        }
        
        #enhanced-trading-bot .control-btn:hover {
            background: rgba(255, 68, 68, 0.2);
            box-shadow: 0 0 15px rgba(255, 68, 68, 0.5);
        }
        
        #enhanced-trading-bot .control-btn#refresh-data {
            border-color: #00aaff;
            color: #00aaff;
        }
        
        #enhanced-trading-bot .control-btn#refresh-data:hover {
            background: rgba(0, 170, 255, 0.2);
            box-shadow: 0 0 15px rgba(0, 170, 255, 0.5);
        }
    `);

    // Create UI
    function createUI() {
        const div = document.createElement('div');
        div.id = 'enhanced-trading-bot';
        div.innerHTML = `
            <h3>🤖 VOLATILITY BOT</h3>
            
            <div class="status stopped" id="bot-status">SYSTEM OFFLINE</div>
            
            <div class="row">
                <div class="field">
                    <label>Bankroll (৳)</label>
                    <input type="number" id="bot-bankroll" value="${currentBalance}" min="100">
                </div>
                <div class="field">
                    <label>Bet Amount (৳)</label>
                    <input type="number" id="bot-bet" value="${baseBet}" min="1" max="10">
                </div>
            </div>
            
            <!-- Manual Data Controls -->
            <div class="manual-controls">
                <div class="row">
                    <div class="field">
                        <label>Manual Data Input</label>
                        <input type="text" id="manual-data" placeholder="e.g. 3,7,2,5,9">
                    </div>
                    <button id="add-manual-data" style="flex:0.5">ADD</button>
                </div>
                
                <div class="row">
                    <button id="scrape-data" style="flex:1;background:#0066cc">SCRAPE 50 PAGES</button>
                    <button id="export-data" style="flex:1;background:#ff6600">EXPORT DATA</button>
                </div>
            </div>
            
            <div class="row">
                <button class="btn-start" id="bot-start">▶ ACTIVATE</button>
                <button class="btn-stop" id="bot-stop" style="display:none">■ TERMINATE</button>
            </div>
            
            <!-- Manual Test Buttons -->
            <div class="row">
                <button onclick="manualSmallBet()" style="flex:1; border-color:#ffff00; color:#ffff00; margin-right:5px; background:transparent;">
                    TEST SMALL (1৳)
                </button>
                <button onclick="manualBigBet()" style="flex:1; border-color:#00aaff; color:#00aaff; margin-left:5px; background:transparent;">
                    TEST BIG (1৳)
                </button>
            </div>
            
            <!-- ULTRA-DIRECT TEST BUTTONS -->
            <div class="row">
                <button onclick="quickSmall()" style="flex:1; border-color:#ff0000; color:#ff0000; margin-right:5px; background:transparent; font-weight:bold;">
                    QUICK SMALL
                </button>
                <button onclick="quickBig()" style="flex:1; border-color:#00ff00; color:#00ff00; margin-left:5px; background:transparent; font-weight:bold;">
                    QUICK BIG
                </button>
            </div>
            
            <!-- DIAGNOSTIC BUTTON -->
            <div class="row">
                <button onclick="showTargets()" style="flex:1; border:1px solid #64748b; background:#64748b; color:white; margin-right:5px;">
                    SHOW TARGETS
                </button>
                <button onclick="testClick()" style="flex:1; border:1px solid #f59e0b; background:#f59e0b; color:white; margin-left:5px;">
                    TEST CLICK
                </button>
            </div>
            
            <!-- GLOBAL CLICK TEST -->
            <div class="row">
                <button onclick="globalClickTest()" style="flex:1; border:1px solid #8b5cf6; background:#8b5cf6; color:white;">
                    GLOBAL CLICK TEST
                </button>
            </div>
            
            <div class="timer-box">
                <div class="timer" id="bot-timer">--:--</div>
                <div class="phase" id="bot-phase">STANDBY MODE</div>
            </div>
            
            <div class="strategy-info">
                <div class="strategy-title">VOLATILITY BREAKOUT STRATEGY</div>
                <div class="strategy-details">
                    • Manual data control enabled<br>
                    • Auto trade registration on timer reset<br>
                    • Real-time data export capability<br>
                    • Self-sufficient operation mode
                </div>
            </div>
            
            <!-- Scrollable Data Display Panel -->
            <div class="data-display-panel">
                <div class="panel-header">
                    <span class="panel-title">📊 HISTORICAL DATA FEED</span>
                    <span class="data-counter" id="data-counter">0 items</span>
                </div>
                <div class="data-scroll-container" id="data-scroll-container">
                    <div class="data-list" id="data-list">
                        <div class="empty-state">No data available. Add manual data or scrape pages.</div>
                    </div>
                </div>
                <div class="data-controls">
                    <button id="clear-data" class="control-btn">CLEAR ALL</button>
                    <button id="refresh-data" class="control-btn">REFRESH</button>
                </div>
            </div>
            
            <div class="stats">
                <div class="stat">
                    <div class="stat-value green" id="stat-balance">${currentBalance}</div>
                    <div class="stat-label">BANKROLL</div>
                </div>
                <div class="stat">
                    <div class="stat-value blue" id="stat-datacount">${historicalData.length}</div>
                    <div class="stat-label">DATA PTS</div>
                </div>
                <div class="stat">
                    <div class="stat-value green" id="stat-wins">${wins}</div>
                    <div class="stat-label">WINS</div>
                </div>
                <div class="stat">
                    <div class="stat-value red" id="stat-losses">${losses}</div>
                    <div class="stat-label">LOSSES</div>
                </div>
            </div>
            
            <div class="logs" id="bot-logs">
                <div class="log-entry log-info">[SYSTEM] Enhanced bot initialized. Manual controls ready.</div>
            </div>
        `;
        document.body.appendChild(div);
        
        // Initialize data display
        updateDataDisplay();
        
        // Event listeners
        document.getElementById('bot-start').onclick = startBot;
        document.getElementById('bot-stop').onclick = stopBot;
        
        document.getElementById('bot-bankroll').onchange = (e) => {
            currentBalance = parseFloat(e.target.value) || 300;
            sessionBankroll = currentBalance;
            updateUI();
        };
        
        document.getElementById('bot-bet').onchange = (e) => {
            baseBet = parseFloat(e.target.value) || 2;
            currentBet = baseBet;
            updateUI();
        };
        
        // Manual data input
        document.getElementById('add-manual-data').onclick = () => {
            const input = document.getElementById('manual-data').value.trim();
            const numbers = input.split(/[,\s]+/).map(s => parseInt(s.trim())).filter(n => !isNaN(n) && n >= 0 && n <= 9);
            
            if (numbers.length > 0) {
                numbers.forEach(num => addDataPoint(num));
                document.getElementById('manual-data').value = '';
            } else {
                log('❌ INVALID INPUT - Enter numbers 0-9 separated by commas', 'error');
            }
        };
        
        // Scrape data button
        document.getElementById('scrape-data').onclick = async () => {
            if (scrapingInProgress) {
                log('⚠️ SCRAPING ALREADY IN PROGRESS', 'info');
                return;
            }
            await scrapeHistoricalData();
        };
        
        // Export data button
        document.getElementById('export-data').onclick = () => {
            exportHistoricalData();
        };
        
        // Data display controls
        document.getElementById('clear-data').onclick = clearAllData;
        document.getElementById('refresh-data').onclick = updateDataDisplay;
    }

    // Logging system
    function log(msg, type = 'info') {
        const time = new Date().toLocaleTimeString();
        botLogs.unshift({ time, msg, type });
        if (botLogs.length > 50) botLogs.pop();
        
        const logsDiv = document.getElementById('bot-logs');
        if (logsDiv) {
            logsDiv.innerHTML = botLogs.slice(0, 20).map(l =>
                `<div class="log-entry log-${l.type}">[${l.time}] ${l.msg}</div>`
            ).join('');
        }
    }

    // Page data extraction
    function getPageTime() {
        const timerEl = document.querySelector('.TimeLeft__C-time');
        if (!timerEl) return -1;
        const text = timerEl.textContent || '';
        const match = text.match(/(\d+):(\d+)/);
        if (match) {
            return parseInt(match[1]) * 60 + parseInt(match[2]);
        }
        return -1;
    }

    function getPageResults() {
        const resultElements = document.querySelectorAll('.record-body-num');
        const results = [];
        resultElements.forEach(el => {
            const text = el.textContent.trim();
            const num = parseInt(text);
            if (!isNaN(num) && num >= 0 && num <= 9) {
                results.push(num);
            }
        });
        return results;
    }

    // Volatility Breakout Strategy
    function calculateVolatility(data, window = 10) {
        if (data.length < window) return 0;
        
        const recentData = data.slice(-window);
        const changes = [];
        for (let i = 1; i < recentData.length; i++) {
            changes.push(Math.abs(recentData[i] - recentData[i-1]));
        }
        
        const mean = changes.reduce((a,b) => a+b, 0) / changes.length;
        const variance = changes.reduce((a,b) => a + Math.pow(b-mean, 2), 0) / changes.length;
        return Math.sqrt(variance);
    }

    // Enhanced Volatility Breakout Strategy - ALWAYS TRADES when data available
    function getVolatilityBreakoutDecision(data) {
        if (data.length < 10) {
            return {
                shouldTrade: true,
                betType: 'SMALL', // Default during warmup
                reason: `Warmup period - defaulting to SMALL`,
                signalStrength: 0.5,
                volatility: 0,
                trendDirection: 'NONE',
                confidence: 50
            };
        }
        
        // Calculate recent volatility (standard deviation of last 10 results)
        const recentData = data.slice(-10);
        const mean = recentData.reduce((sum, val) => sum + val, 0) / recentData.length;
        const variance = recentData.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / recentData.length;
        const volatility = Math.sqrt(variance);
        
        // Calculate moving average trend
        const shortMA = data.slice(-5).reduce((sum, val) => sum + val, 0) / 5;
        const longMA = data.slice(-10).reduce((sum, val) => sum + val, 0) / 10;
        const trendDirection = shortMA > longMA ? 'UP' : shortMA < longMA ? 'DOWN' : 'FLAT';
        
        // Get last result
        const lastResult = data[data.length - 1];
        
        // SIMPLE DECISION: Based on trend direction and last result
        let betType;
        let reason;
        let signalStrength;
        
        if (volatility > 2.5) {
            // High volatility - follow the trend
            if (lastResult >= 5) {
                betType = 'BIG';
                reason = `High volatility (${volatility.toFixed(2)}) + last result ${lastResult} >= 5 → BIG`;
            } else {
                betType = 'SMALL';
                reason = `High volatility (${volatility.toFixed(2)}) + last result ${lastResult} < 5 → SMALL`;
            }
            signalStrength = 0.7;
        } else if (trendDirection === 'UP') {
            betType = 'BIG';
            reason = `Uptrend detected (shortMA ${shortMA.toFixed(2)} > longMA ${longMA.toFixed(2)}) → BIG`;
            signalStrength = 0.6;
        } else if (trendDirection === 'DOWN') {
            betType = 'SMALL';
            reason = `Downtrend detected (shortMA ${shortMA.toFixed(2)} < longMA ${longMA.toFixed(2)}) → SMALL`;
            signalStrength = 0.6;
        } else {
            // Flat trend - use mean reversion
            if (lastResult >= 5) {
                betType = 'SMALL'; // Expect reversion
                reason = `Flat trend + last ${lastResult} >= 5 → expecting reversion → SMALL`;
            } else {
                betType = 'BIG';
                reason = `Flat trend + last ${lastResult} < 5 → expecting reversion → BIG`;
            }
            signalStrength = 0.5;
        }
        
        const confidence = signalStrength * 100;
        
        return {
            shouldTrade: true, // ALWAYS TRADE
            betType: betType,
            reason: reason,
            signalStrength: signalStrength,
            volatility: volatility,
            trendDirection: trendDirection,
            confidence: confidence
        };
    }

    // Data display functions
    function updateDataDisplay() {
        const dataList = document.getElementById('data-list');
        const dataCounter = document.getElementById('data-counter');
        
        if (!dataList || !dataCounter) return;
        
        dataCounter.textContent = `${historicalData.length} items`;
        
        if (historicalData.length === 0) {
            dataList.innerHTML = '<div class="empty-state">No data available. Add manual data or scrape pages.</div>';
            return;
        }
        
        // Show last 100 items for performance, but indicate total count
        const displayData = historicalData.slice(-100);
        const startIndex = Math.max(0, historicalData.length - 100);
        
        dataList.innerHTML = displayData.map((value, index) => {
            const globalIndex = startIndex + index;
            const timestamp = new Date().toLocaleTimeString();
            return `
                <div class="data-item">
                    <span class="data-index">#${globalIndex + 1}</span>
                    <span class="data-value">${value}</span>
                    <span class="data-timestamp">${timestamp}</span>
                </div>
            `;
        }).join('');
        
        // Auto-scroll to bottom to show newest data
        const container = document.getElementById('data-scroll-container');
        if (container) {
            container.scrollTop = container.scrollHeight;
        }
    }

    function clearAllData() {
        if (confirm('Clear all historical data? This cannot be undone.')) {
            historicalData = [];
            updateDataDisplay();
            saveToLocalStorage();
            log('🗑️ ALL DATA CLEARED', 'action');
        }
    }

    function clearAllData() {
        historicalData = [];
        updateDataDisplay();
        log('🗑️ ALL DATA CLEARED', 'action');
        document.getElementById('stat-datacount').textContent = '0';
    }

    // Enhanced data addition with real-time display
    function addDataPoint(value) {
        if (typeof value === 'number' && value >= 0 && value <= 9) {
            historicalData.push(value);
            
            // Keep only last 2000 results for performance
            if (historicalData.length > 2000) {
                historicalData = historicalData.slice(-2000);
            }
            
            updateDataDisplay();
            document.getElementById('stat-datacount').textContent = historicalData.length;
            
            log(`📥 DATA POINT ADDED: ${value} | Total: ${historicalData.length}`, 'win');
            
            // Save to localStorage immediately when data is added
            saveToLocalStorage();
            return true;
        }
        return false;
    }
    
    // Independent automatic data collector (runs regardless of bot state)
    let autoCollectorInterval = null;
    let hasCollectedThisRound = false;
    let previousTimeLeft = -1;
    
    function startAutoDataCollector() {
        if (autoCollectorInterval) return; // Already running
        
        autoCollectorInterval = setInterval(() => {
            const timeLeft = getPageTime();
            
            // Debug logging
            if (timeLeft !== previousTimeLeft) {
                console.log(`[DEBUG] Time changed: ${previousTimeLeft} → ${timeLeft} | Collected: ${hasCollectedThisRound}`);
                previousTimeLeft = timeLeft;
            }
            
            // ROBUST RESET LOGIC - Multiple conditions to ensure reset
            if (timeLeft > 29 || timeLeft === -1 || timeLeft >= 30) {
                if (hasCollectedThisRound) {
                    console.log('[DEBUG] Resetting collection flag - timer above 29s');
                }
                hasCollectedThisRound = false;
            }
            
            // Extra safety reset - if timer jumps unexpectedly
            if (timeLeft > 0 && timeLeft < 20 && hasCollectedThisRound) {
                console.log('[DEBUG] Safety reset - timer in middle range but flag was set');
                hasCollectedThisRound = false;
            }
            
            // Collect data at exactly 29 seconds
            if (timeLeft === 29 && !hasCollectedThisRound) {
                const currentResults = getPageResults();
                console.log(`[DEBUG] Attempting collection at 29s - Found ${currentResults.length} results`);
                
                if (currentResults.length > 0) {
                    const firstNumber = currentResults[0];
                    addDataPoint(firstNumber);
                    hasCollectedThisRound = true;
                    console.log(`✅ [COLLECTOR] SUCCESS: Added ${firstNumber} at 29s | Total: ${historicalData.length}`);
                } else {
                    console.log('[DEBUG] No results found at 29s - skipping collection');
                }
            }
            
        }, 500); // Check twice per second for better reliability
        
        console.log('🚀 [Auto Collector] Started with enhanced debugging');
    }
    
    function stopAutoDataCollector() {
        if (autoCollectorInterval) {
            clearInterval(autoCollectorInterval);
            autoCollectorInterval = null;
            console.log('[Auto Collector] Stopped');
        }
    }
    
    // Start auto collector on page load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startAutoDataCollector);
    } else {
        startAutoDataCollector();
    }

    // LocalStorage persistence functions
    const STORAGE_KEY = 'enhanced_trading_bot_data';
    
    function saveToLocalStorage() {
        try {
            const data = {
                historicalData: historicalData,
                currentBalance: currentBalance,
                baseBet: baseBet,
                currentBet: currentBet,
                sessionBankroll: sessionBankroll,
                wins: wins,
                losses: losses,
                doublesCount: doublesCount,
                bankruptcies: bankruptcies,
                lastSave: new Date().toISOString()
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (e) {
            log(`⚠️ Failed to save data: ${e.message}`, 'error');
        }
    }
    
    function loadFromLocalStorage() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const data = JSON.parse(stored);
                historicalData = data.historicalData || [];
                currentBalance = data.currentBalance || 300;
                baseBet = data.baseBet || 2;
                currentBet = data.currentBet || 2;
                sessionBankroll = data.sessionBankroll || 300;
                wins = data.wins || 0;
                losses = data.losses || 0;
                doublesCount = data.doublesCount || 0;
                bankruptcies = data.bankruptcies || 0;
                
                log(`✅ LOADED SAVED DATA: ${historicalData.length} points | Balance: ${currentBalance}৳`, 'win');
                updateDataDisplay(); // Update display with loaded data
                document.getElementById('stat-datacount').textContent = historicalData.length;
                return true;
            }
        } catch (e) {
            log(`⚠️ Failed to load data: ${e.message}`, 'error');
        }
        return false;
    }
    
    // Auto-save every 5 seconds when bot is running
    setInterval(() => {
        if (isRunning) {
            saveToLocalStorage();
        }
    }, 5000);
    function exportHistoricalData() {
        if (historicalData.length === 0) {
            log('❌ NO DATA TO EXPORT', 'error');
            return;
        }
        
        const dataObj = {
            timestamp: new Date().toISOString(),
            total_points: historicalData.length,
            data: [...historicalData], // Create copy to preserve order
            metadata: {
                bankroll: currentBalance,
                base_bet: baseBet,
                wins: wins,
                losses: losses,
                session_start: sessionBankroll
            }
        };
        
        const jsonData = JSON.stringify(dataObj, null, 2);
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `trading_data_${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        log(`📤 DATA EXPORTED: ${historicalData.length} points saved`, 'win');
    }

    // Enhanced historical data scraping with working implementation from history_scraper.js
    async function scrapeHistoricalData() {
        if (scrapingInProgress) return;
        scrapingInProgress = true;
        
        log('📡 INITIATING HISTORICAL DATA ACQUISITION...', 'action');
        
        try {
            const allPageResults = [];
            let currentPage = 1;
            const MAX_PAGES = 50;
            
            // Only navigate if not already on history page
            if (!window.location.href.includes('/history')) {
                log('➡️ Navigating to history page...', 'action');
                window.location.href = 'https://amarclub.net/history';
                await new Promise(resolve => setTimeout(resolve, 1500)); // Longer wait for navigation
            } else {
                log('📍 Already on history page. Starting scraping...', 'info');
            }
            
            // Reset to first page by clicking previous buttons if needed
            await resetToFirstPage();
            
            for (let page = 1; page <= MAX_PAGES; page++) {
                if (!scrapingInProgress) break;
                
                log(`📄 Scraping page ${page}/${MAX_PAGES}...`, 'info');
                
                // Wait for content to load
                await new Promise(resolve => setTimeout(resolve, 280));
                
                // Extract results from current page
                const pageResults = getPageResults();
                
                if (pageResults.length === 0) {
                    log(`⚠️ No results found on page ${page}. Retrying...`, 'info');
                    await new Promise(resolve => setTimeout(resolve, 140));
                    const retryResults = getPageResults();
                    if (retryResults.length === 0) {
                        log(`❌ Still no results on page ${page}. Skipping.`, 'error');
                        continue;
                    }
                    pageResults.push(...retryResults);
                }
                
                // Flip the data (oldest first) for this page
                const flippedResults = [...pageResults].reverse();
                
                // Add to beginning to maintain chronological order
                allPageResults.unshift(...flippedResults);
                
                log(`✅ Page ${page}: ${pageResults.length} results (flipped) | Total so far: ${allPageResults.length}`, 'win');
                
                // Move to next page if not last page
                if (page < MAX_PAGES) {
                    const nextBtn = document.querySelector('.record-foot-next');
                    if (nextBtn) {
                        nextBtn.click();
                        log(`→ Navigating to page ${page + 1}...`, 'action');
                        await new Promise(resolve => setTimeout(resolve, 280));
                    } else {
                        log(`❌ Next button not found on page ${page}. Stopping.`, 'error');
                        break;
                    }
                }
            }
            
            // Append to existing data (new data goes to end)
            historicalData.push(...allPageResults);
            
            // Keep only last 2000 results for performance
            if (historicalData.length > 2000) {
                historicalData = historicalData.slice(-2000);
            }
            
            log(`✅ HISTORICAL DATA COLLECTION COMPLETE: ${allPageResults.length} new points added | Total: ${historicalData.length}`, 'win');
            updateDataDisplay();
            document.getElementById('stat-datacount').textContent = historicalData.length;
            
        } catch (error) {
            log(`❌ SCRAPING FAILED: ${error.message}`, 'error');
        } finally {
            scrapingInProgress = false;
        }
    }
    
    // Helper function to reset to first page
    async function resetToFirstPage() {
        log('⏮️ Resetting to first page...', 'action');
        let prevClicks = 0;
        const maxPrevClicks = 10; // Prevent infinite loop
        
        while (prevClicks < maxPrevClicks) {
            const prevBtn = document.querySelector('.record-foot-prev');
            if (!prevBtn || prevBtn.disabled) {
                break;
            }
            prevBtn.click();
            prevClicks++;
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        if (prevClicks > 0) {
            log(`⏮️ Clicked previous button ${prevClicks} times to reach first page`, 'info');
        }
        await new Promise(resolve => setTimeout(resolve, 500)); // Wait for final page load
    }

    // Place bet function
    // EXACT COPY FROM WORKING tradingbot.js
    function placeBet(type, amount) {
        return new Promise((resolve, reject) => {
            try {
                log(`Clicking ${type} button...`, 'action');

                // Step 1: Click BIG or SMALL button
                const betBtn = type === 'SMALL'
                    ? document.querySelector('.Betting__C-foot-s')
                    : document.querySelector('.Betting__C-foot-b');

                if (!betBtn) {
                    log('Bet button not found!', 'loss');
                    reject('Button not found');
                    return;
                }

                betBtn.click();

                // Step 2: Wait for input, then set amount
                setTimeout(() => {
                    const input = document.querySelector('input[type="number"]');
                    if (input) {
                        // Focus the input first
                        input.focus();
                        
                        // Clear and set value
                        input.value = '';
                        input.value = String(amount);
                        
                        // Dispatch events for Vue reactivity
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                        input.dispatchEvent(new Event('change', { bubbles: true }));
                        
                        // Also try compositionend for some Vue setups
                        input.dispatchEvent(new Event('compositionend', { bubbles: true }));
                        
                        // Blur to finalize
                        input.blur();
                        
                        log(`Set amount: ${amount}৳`, 'action');

                        // Step 3: Click confirm button
                        setTimeout(() => {
                            const confirmBtn = type === 'SMALL'
                                ? document.querySelector('.bet-amount.n_small')
                                : document.querySelector('.bet-amount.n_big');

                            if (confirmBtn) {
                                confirmBtn.click();
                                log(`✅ Confirmed ${type} bet: ${amount}৳`, 'win');
                                resolve(true);
                            } else {
                                log('Confirm button not found!', 'loss');
                                reject('Confirm not found');
                            }
                        }, 400);
                    } else {
                        log('Amount input not found!', 'loss');
                        reject('Input not found');
                    }
                }, 600);

            } catch (e) {
                log('Place bet error: ' + e.message, 'loss');
                reject(e);
            }
        });
    }

    // Main bot loop
    async function botLoop() {
        if (!isRunning) return;
        if (loopRunning) return;
        loopRunning = true;
        
        try {
            const timeLeft = getPageTime();
            if (timeLeft === -1) {
                log('❌ TIMER NOT DETECTED', 'error');
                return;
            }
            
            // Reset round flags for new trading round
            if (timeLeft >= 27 && lastTimeLeft >= 0 && lastTimeLeft <= 5) {
                log(`🔄 NEW TRADING ROUND INITIATED`, 'win');
                roundState = 'WAITING';
                resultCheckedThisRound = false;
                dataAddedThisRound = false; // Reset flag for new round
            }
            
            // Auto-register new trade at exactly 29 seconds - simple first number capture
            // Only do this if auto collector is NOT running to prevent duplicates
            if (timeLeft === 29 && !dataAddedThisRound && !autoCollectorInterval) {
                const currentResults = getPageResults();
                if (currentResults.length > 0) {
                    const firstNumber = currentResults[0]; // Take first number from page data
                    addDataPoint(firstNumber);
                    dataAddedThisRound = true;
                    log(`📥 AUTO-REGISTERED NEW TRADE: ${firstNumber} | Total: ${historicalData.length}`, 'action');
                }
            }
            
            // Check result and update stats
            if (timeLeft <= 25 && timeLeft >= 23 && waitingForResult) {
                resultCheckedThisRound = true;
                log('🔍 ANALYZING TRADE OUTCOME...', 'info');
                
                const currentResults = getPageResults();
                if (currentResults.length > 0) {
                    const lastResult = currentResults[0];
                    const actualType = lastResult >= 5 ? 'BIG' : 'SMALL';
                    
                    // Calculate payout
                    const contractAmount = currentBet * 0.98;
                    const payout = actualType === pendingBetType ? contractAmount * 2 : 0;
                    const profit = payout - currentBet;
                    const won = payout > 0;
                    
                    // Update bankroll
                    currentBalance += profit;
                    sessionBankroll += profit;
                    
                    // Bankroll management
                    if (sessionBankroll >= currentBalance * 2) {
                        doublesCount++;
                        sessionBankroll = currentBalance;
                        log(`📈 BANKROLL DOUBLED! Count: ${doublesCount}`, 'win');
                    } else if (sessionBankroll < 1) {
                        bankruptcies++;
                        sessionBankroll = currentBalance;
                        log(`📉 BANKRUPTCY EVENT! Count: ${bankruptcies}`, 'error');
                    }
                    
                    // Update stats
                    if (won) {
                        wins++;
                        currentBet = baseBet; // Reset to base bet
                        log(`🎉 VICTORY! +${profit.toFixed(2)}৳ | BAL: ${currentBalance.toFixed(2)}৳`, 'win');
                    } else {
                        losses++;
                        currentBet = Math.min(currentBet * 2, currentBalance); // Progressive betting with cap
                        log(`💥 DEFEAT! ${profit.toFixed(2)}৳ | BAL: ${currentBalance.toFixed(2)}৳`, 'loss');
                    }
                    
                    waitingForResult = false;
                    roundState = 'WAITING';
                }
            }
            
            // Make trading decision
            if (timeLeft <= 20 && timeLeft >= 16 && roundState === 'WAITING') {
                if (historicalData.length === 0) {
                    log('⚠️ NO DATA - Adding default data point for testing...', 'info');
                    // Add some default data so we can trade
                    historicalData = [5, 3, 7, 2, 8, 4, 6, 1, 9, 5];
                    saveData();
                }
                
                log(`📊 ANALYZING DATA: ${historicalData.length} points | Last 5: [${historicalData.slice(-5).join(',')}]`, 'info');
                
                const decision = getVolatilityBreakoutDecision(historicalData);
                
                log(`🧠 DECISION: ${decision.betType} | Confidence: ${decision.confidence.toFixed(0)}%`, 'info');
                log(`📝 REASON: ${decision.reason}`, 'info');
                
                // ALWAYS SET DECIDED STATE
                pendingBetType = decision.betType;
                roundState = 'DECIDED';
                log(`✅ TRADE QUEUED: ${pendingBetType} bet will be placed at 12-6 seconds`, 'action');
            }
            
            // Place bet - THIS IS WHERE THE ACTUAL BET HAPPENS
            if (timeLeft <= 12 && timeLeft >= 6 && roundState === 'DECIDED') {
                log(`🎯 EXECUTING TRADE NOW: ${pendingBetType} ${currentBet}৳`, 'win');
                log(`📋 DEBUG INFO:`, 'debug');
                log(`   Time Left: ${timeLeft}`, 'debug');
                log(`   Round State: ${roundState}`, 'debug');
                log(`   Pending Bet Type: ${pendingBetType}`, 'debug');
                log(`   Current Bet Amount: ${currentBet}`, 'debug');
                log(`   Current Balance: ${currentBalance}`, 'debug');
                
                if (currentBet > currentBalance) {
                    log(`⚠️ INSUFFICIENT FUNDS! Need: ${currentBet}৳ | Have: ${currentBalance.toFixed(2)}৳`, 'error');
                    roundState = 'SKIP';
                    loopRunning = false;
                    return;
                }
                
                if (!pendingBetType) {
                    log(`❌ NO BET TYPE! Setting to BIG as fallback`, 'error');
                    pendingBetType = 'BIG';
                }
                
                try {
                    log(`💸 ABOUT TO DEDUCT BET AMOUNT`, 'action');
                    currentBalance -= currentBet;
                    log(`💸 DEDUCTED ${currentBet}৳ | New Balance: ${currentBalance.toFixed(2)}৳`, 'action');
                    
                    log(`🎮 CALLING placeBet(${pendingBetType}, ${currentBet})`, 'action');
                    await placeBet(pendingBetType, currentBet);
                    
                    log(`✅ placeBet FUNCTION COMPLETED SUCCESSFULLY`, 'win');
                    waitingForResult = true;
                    roundState = 'BET_PLACED';
                    log(`✅ BET PLACED SUCCESSFULLY: ${pendingBetType} ${currentBet}৳`, 'win');
                } catch (error) {
                    log(`❌ BET PLACEMENT FAILED: ${error}`, 'error');
                    log(`💰 REFUNDING BET AMOUNT`, 'info');
                    currentBalance += currentBet; // Refund
                    log(`💰 REFUNDED: ${currentBet}৳ | Balance: ${currentBalance.toFixed(2)}৳`, 'info');
                    roundState = 'SKIP';
                }
            }
            
            // Log skipped rounds
            if (timeLeft <= 12 && timeLeft >= 6 && roundState === 'SKIP') {
                log(`⏭ ROUND SKIPPED - No bet placed`, 'info');
            }
            
            lastTimeLeft = timeLeft;
            updateUI();
            
        } finally {
            loopRunning = false;
        }
    }

    // UI Updates
    function updateUI() {
        const statusEl = document.getElementById('bot-status');
        const timerEl = document.getElementById('bot-timer');
        const phaseEl = document.getElementById('bot-phase');
        
        if (statusEl) {
            statusEl.textContent = isRunning ? 'ACTIVE' : 'OFFLINE';
            statusEl.className = `status ${isRunning ? 'running' : 'stopped'}`;
        }
        
        const timeLeft = getPageTime();
        if (timerEl) {
            timerEl.textContent = timeLeft === -1 ? '--:--' : 
                `${Math.floor(timeLeft/60)}:${String(timeLeft%60).padStart(2,'0')}`;
        }
        
        // DETAILED PHASE DISPLAY - Show actual bot state
        if (phaseEl) {
            let displayPhase = 'STANDBY';
            
            if (isRunning) {
                switch(roundState) {
                    case 'WAITING':
                        if (timeLeft >= 27) {
                            displayPhase = 'NEW ROUND';
                        } else if (timeLeft >= 23) {
                            displayPhase = 'COLLECTING DATA';
                        } else if (timeLeft >= 16) {
                            displayPhase = 'ANALYZING';
                        } else if (timeLeft >= 6) {
                            displayPhase = 'PLACING BET';
                        } else {
                            displayPhase = 'WAITING RESULT';
                        }
                        break;
                    case 'DECIDED':
                        displayPhase = 'BET READY';
                        break;
                    case 'BET_PLACED':
                        displayPhase = 'BET EXECUTED';
                        break;
                    case 'SKIP':
                        displayPhase = 'ROUND SKIPPED';
                        break;
                    default:
                        displayPhase = roundState.replace('_', ' ');
                }
            }
            
            phaseEl.textContent = displayPhase;
            // Add color coding
            phaseEl.className = 'phase-display';
            if (displayPhase.includes('BET')) {
                phaseEl.style.color = '#00ff00';
                phaseEl.style.textShadow = '0 0 10px #00ff00';
            } else if (displayPhase.includes('SKIP') || displayPhase.includes('WAITING')) {
                phaseEl.style.color = '#ffff00';
            } else {
                phaseEl.style.color = '#00ff00';
            }
        }
        
        // Update stats
        document.getElementById('stat-balance').textContent = currentBalance.toFixed(0);
        document.getElementById('stat-pnl').textContent = (currentBalance - 300).toFixed(0);
        document.getElementById('stat-pnl').className = `stat-value ${currentBalance >= 300 ? 'green' : 'red'}`;
        document.getElementById('stat-wins').textContent = wins;
        document.getElementById('stat-losses').textContent = losses;
    }

    // Bot control functions
    async function startBot() {
        isRunning = true;
        currentBalance = parseFloat(document.getElementById('bot-bankroll').value) || 300;
        baseBet = parseFloat(document.getElementById('bot-bet').value) || 2;
        currentBet = baseBet;
        sessionBankroll = currentBalance;
        
        document.getElementById('bot-start').style.display = 'none';
        document.getElementById('bot-stop').style.display = 'block';
        document.getElementById('bot-bankroll').disabled = true;
        document.getElementById('bot-bet').disabled = true;
        
        log('🚀 TRADING SYSTEM ACTIVATED', 'win');
        log(`💰 INITIAL BANKROLL: ${currentBalance}৳`, 'info');
        log(`📊 BASE BET: ${baseBet}৳`, 'info');
        
        // Load saved data if available
        loadFromLocalStorage();
        
        // Scrape historical data if not already present
        if (historicalData.length === 0) {
            await scrapeHistoricalData();
        }
        
        // Start bot loop using Web Worker for background-safe timing
        if (!timerWorker) {
            timerWorker = createTimerWorker();
            timerWorker.onmessage = () => botLoop();
        }
        timerWorker.postMessage('start');
        log('📡 TRADING LOOP INITIALIZED WITH BACKGROUND TIMING', 'info');
        updateUI();
    }

    function stopBot() {
        isRunning = false;
        
        // Stop the Web Worker timer
        if (timerWorker) {
            timerWorker.postMessage('stop');
        }
        
        // Stop auto data collector when bot stops
        stopAutoDataCollector();
        
        document.getElementById('bot-start').style.display = 'block';
        document.getElementById('bot-stop').style.display = 'none';
        document.getElementById('bot-bankroll').disabled = false;
        document.getElementById('bot-bet').disabled = false;
        
        // Save data when stopping
        saveToLocalStorage();
        
        log('⏹ TRADING SYSTEM TERMINATED', 'info');
        log(`📈 SESSION SUMMARY: ${wins}W/${losses}L | P/L: ${(currentBalance - 300).toFixed(2)}৳`, 'info');
        updateUI();
    }

    // Expose functions globally for onclick handlers
    window.clearAllData = clearAllData;
    window.updateDataDisplay = updateDataDisplay;
    window.startBot = startBot;
    window.stopBot = stopBot;
    
    // Manual test functions
    window.testPlaceBet = async function(betType = 'BIG', amount = 2) {
        log(`🧪 MANUAL TEST: Placing ${betType} bet for ${amount}৳`, 'win');
        try {
            await placeBet(betType, amount);
            log(`✅ MANUAL TEST SUCCESSFUL!`, 'win');
        } catch (error) {
            log(`❌ MANUAL TEST FAILED: ${error}`, 'error');
        }
    };
    
    window.manualSmallBet = () => testPlaceBet('SMALL', 1);
    window.manualBigBet = () => testPlaceBet('BIG', 1);
    
    // ULTIMATE MOUSE EVENT SIMULATION - PC COMPATIBLE
    window.directPlaceBet = async function(betType = 'BIG', betAmount = 1) {
        log(`🖱️ MOUSE SIMULATION MODE: ${betType} ${betAmount}৳`, 'win');
        
        try {
            // STEP 1: Find and simulate REAL mouse click on bet button
            const betBtn = document.querySelector(betType === 'SMALL' ? '.Betting__C-foot-s' : '.Betting__C-foot-b') ||
                          Array.from(document.querySelectorAll('div')).find(d => d.textContent.trim().toLowerCase() === betType.toLowerCase());
            
            if (!betBtn) {
                log(`❌ BET BUTTON NOT FOUND!`, 'error');
                return false;
            }
            
            log(`✅ FOUND BET BUTTON: ${betBtn.textContent}`, 'action');
            
            // SIMULATE REAL MOUSE EVENTS SEQUENCE
            const rect = betBtn.getBoundingClientRect();
            const x = rect.left + rect.width / 2;
            const y = rect.top + rect.height / 2;
            
            // Mouse events sequence that mimics real user interaction
            const events = [
                new MouseEvent('mouseover', { bubbles: true, cancelable: true, clientX: x, clientY: y }),
                new MouseEvent('mouseenter', { bubbles: true, cancelable: true, clientX: x, clientY: y }),
                new MouseEvent('mousemove', { bubbles: true, cancelable: true, clientX: x, clientY: y }),
                new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: x, clientY: y }),
                new MouseEvent('mouseup', { bubbles: true, cancelable: true, clientX: x, clientY: y }),
                new MouseEvent('click', { bubbles: true, cancelable: true, clientX: x, clientY: y })
            ];
            
            events.forEach(event => betBtn.dispatchEvent(event));
            log(`🖱️ SIMULATED MOUSE CLICK ON BET BUTTON`, 'action');
            
            // Wait for UI to respond
            await new Promise(resolve => setTimeout(resolve, 1200));
            
            // STEP 2: Find and simulate input interaction
            const input = document.querySelector('input[type="number"]') || document.querySelector('input');
            if (!input) {
                log(`❌ INPUT NOT FOUND AFTER CLICKING!`, 'error');
                return false;
            }
            
            log(`✅ FOUND INPUT FIELD`, 'action');
            
            // Simulate real typing sequence
            input.focus();
            
            // Clear existing value
            input.select();
            document.execCommand('delete');
            
            // Type the amount character by character (more realistic)
            for (let char of betAmount.toString()) {
                input.value += char;
                input.dispatchEvent(new Event('input', { bubbles: true }));
                await new Promise(resolve => setTimeout(resolve, 50)); // Small delay between keystrokes
            }
            
            input.dispatchEvent(new Event('change', { bubbles: true }));
            input.blur();
            
            log(`✏️ SIMULATED TYPING: ${betAmount}`, 'action');
            
            // Wait for confirm button to appear
            await new Promise(resolve => setTimeout(resolve, 600));
            
            // STEP 3: Find and click confirm button
            const confirmBtn = document.querySelector(`.bet-amount.n_${betType.toLowerCase()}`) ||
                              document.querySelector('.bet-amount') ||
                              Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('amount') || b.textContent.includes('Total'));
            
            if (confirmBtn) {
                log(`✅ FOUND CONFIRM BUTTON: ${confirmBtn.textContent.substring(0, 30)}`, 'action');
                
                // Simulate mouse events on confirm button
                const confirmRect = confirmBtn.getBoundingClientRect();
                const cx = confirmRect.left + confirmRect.width / 2;
                const cy = confirmRect.top + confirmRect.height / 2;
                
                const confirmEvents = [
                    new MouseEvent('mouseover', { bubbles: true, cancelable: true, clientX: cx, clientY: cy }),
                    new MouseEvent('mouseenter', { bubbles: true, cancelable: true, clientX: cx, clientY: cy }),
                    new MouseEvent('mousemove', { bubbles: true, cancelable: true, clientX: cx, clientY: cy }),
                    new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: cx, clientY: cy }),
                    new MouseEvent('mouseup', { bubbles: true, cancelable: true, clientX: cx, clientY: cy }),
                    new MouseEvent('click', { bubbles: true, cancelable: true, clientX: cx, clientY: cy })
                ];
                
                confirmEvents.forEach(event => confirmBtn.dispatchEvent(event));
                log(`🖱️ SIMULATED MOUSE CLICK ON CONFIRM BUTTON`, 'win');
                log(`🎉 BET PLACED SUCCESSFULLY VIA MOUSE SIMULATION!`, 'win');
                return true;
            } else {
                log(`❌ CONFIRM BUTTON NOT FOUND!`, 'error');
                return false;
            }
            
        } catch (error) {
            log(`💥 MOUSE SIMULATION FAILED: ${error}`, 'error');
            return false;
        }
    };
    
    // Quick access functions
    window.quickSmall = () => directPlaceBet('SMALL', 1);
    window.quickBig = () => directPlaceBet('BIG', 1);
    
    // VISUAL ELEMENT HIGHLIGHTER - SEE WHAT THE BOT SEES
    window.highlightElements = function() {
        // Clear previous highlights
        document.querySelectorAll('.bot-highlight').forEach(el => el.remove());
        
        // Highlight bet buttons
        const smallBtn = document.querySelector('.Betting__C-foot-s');
        const bigBtn = document.querySelector('.Betting__C-foot-b');
        
        if (smallBtn) {
            smallBtn.style.outline = '3px solid #ffff00';
            smallBtn.style.position = 'relative';
            smallBtn.innerHTML += '<div class="bot-highlight" style="position:absolute;top:-20px;left:0;background:#ffff00;color:black;padding:2px;font-size:10px;z-index:999999">SMALL BTN</div>';
        }
        
        if (bigBtn) {
            bigBtn.style.outline = '3px solid #00ff00';
            bigBtn.style.position = 'relative';
            bigBtn.innerHTML += '<div class="bot-highlight" style="position:absolute;top:-20px;left:0;background:#00ff00;color:black;padding:2px;font-size:10px;z-index:999999">BIG BTN</div>';
        }
        
        // Highlight input fields
        const inputs = document.querySelectorAll('input');
        inputs.forEach((input, index) => {
            input.style.outline = '2px solid #00aaff';
            input.style.position = 'relative';
            input.insertAdjacentHTML('afterend', `<div class="bot-highlight" style="position:relative;background:#00aaff;color:white;padding:2px;font-size:10px;margin:2px 0;">INPUT ${index + 1}</div>`);
        });
        
        // Highlight confirm buttons
        const confirmBtns = document.querySelectorAll('.bet-amount, button');
        confirmBtns.forEach((btn, index) => {
            if (btn.textContent.includes('amount') || btn.textContent.includes('Total') || btn.classList.contains('bet-amount')) {
                btn.style.outline = '3px solid #ff00ff';
                btn.style.position = 'relative';
                btn.insertAdjacentHTML('afterend', `<div class="bot-highlight" style="position:relative;background:#ff00ff;color:white;padding:2px;font-size:10px;margin:2px 0;">CONFIRM ${index + 1}</div>`);
            }
        });
        
        log(`🎨 ELEMENTS HIGHLIGHTED - Check the page to see what the bot sees`, 'win');
    };
    
    // Quick access
    window.showTargets = highlightElements;
    
    // DIAGNOSTIC FUNCTIONS - Check if elements are actually clickable
    window.checkElements = function() {
        log('🔍 DIAGNOSTIC: Checking element status...', 'info');
        
        // Check bet buttons
        const smallBtn = document.querySelector('.Betting__C-foot-s');
        const bigBtn = document.querySelector('.Betting__C-foot-b');
        
        log(`Small Button: ${smallBtn ? 'FOUND' : 'MISSING'}`, 'info');
        if (smallBtn) {
            log(`  - Text: "${smallBtn.textContent}"`, 'info');
            log(`  - Visible: ${smallBtn.offsetParent !== null}`, 'info');
            log(`  - Disabled: ${smallBtn.disabled ? 'YES' : 'NO'}`, 'info');
            log(`  - Style: ${smallBtn.style.cssText}`, 'info');
        }
        
        log(`Big Button: ${bigBtn ? 'FOUND' : 'MISSING'}`, 'info');
        if (bigBtn) {
            log(`  - Text: "${bigBtn.textContent}"`, 'info');
            log(`  - Visible: ${bigBtn.offsetParent !== null}`, 'info');
            log(`  - Disabled: ${bigBtn.disabled ? 'YES' : 'NO'}`, 'info');
            log(`  - Style: ${bigBtn.style.cssText}`, 'info');
        }
        
        // Check if betting area exists
        const bettingArea = document.querySelector('[class*="Betting"]');
        log(`Betting Area: ${bettingArea ? 'FOUND' : 'MISSING'}`, 'info');
        
        // Try to click manually
        if (smallBtn) {
            log('Attempting manual click on SMALL button...', 'action');
            try {
                smallBtn.click();
                log('✅ SMALL button click executed', 'win');
                
                setTimeout(() => {
                    const input = document.querySelector('input[type="number"]');
                    log(`Input after click: ${input ? 'FOUND' : 'MISSING'}`, 'info');
                    if (input) {
                        log('🎉 SUCCESS: Input appeared after clicking!', 'win');
                    }
                }, 1000);
                
            } catch (e) {
                log(`❌ SMALL button click failed: ${e.message}`, 'error');
            }
        }
    };
    
    window.testClick = checkElements;
    
    // GLOBAL CLICK TESTER - See if clicks are being registered at all
    window.globalClickTest = function() {
        log('🌍 GLOBAL CLICK TEST ACTIVATED', 'win');
        log('Click anywhere on the page to test...', 'info');
        
        // Add temporary click listener to document
        const clickHandler = function(e) {
            log(`🖱️ PAGE CLICK DETECTED at (${e.clientX}, ${e.clientY})`, 'action');
            log(`Target element: ${e.target.tagName} - ${e.target.textContent.substring(0, 30)}`, 'info');
            
            // Check if click was on our bot UI
            if (e.target.closest('#enhanced-trading-bot')) {
                log('✅ CLICK WAS ON BOT UI!', 'win');
                const button = e.target.closest('button');
                if (button) {
                    log(`🎯 BUTTON CLICKED: ${button.textContent.trim()}`, 'win');
                }
            } else {
                log('ℹ️ CLICK WAS OUTSIDE BOT UI', 'info');
            }
            
            // Remove listener after first click
            document.removeEventListener('click', clickHandler);
            log('🌍 GLOBAL CLICK TEST ENDED', 'info');
        };
        
        document.addEventListener('click', clickHandler);
    };
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            createUI();
            loadFromLocalStorage();
            updateDataDisplay();
        });
    } else {
        createUI();
        loadFromLocalStorage();
        updateDataDisplay();
    }
    
    // Continuous timer updates - more frequent for better responsiveness
    setInterval(() => {
        updateUI();
        // Also trigger bot loop check more frequently
        if (isRunning && timerWorker) {
            botLoop();
        }
    }, 500); // Update twice per second
    
})();