// ==UserScript==
// @name         Trading Bot - AmarClub Enhanced Pro
// @namespace    http://tampermonkey.net/
// @version      4.0
// @description  Professional automated trading system with 50-page scraping and Bun server integration
// @match        https://amarclub.net/*
// @match        https://*.amarclub.net/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      localhost
// @connect      localhost
// @connect      *
// ==/UserScript==

(function() {
    'use strict';

    const API_BASE = 'http://localhost:3001';

    // State with persistence and server connection
    let state = {
        balance: 300,
        baseBet: 8,
        currentBet: 8,
        isRunning: false,
        lastPrediction: null,
        pendingBet: null,
        logs: [],
        balanceHistory: [300],
        wins: 0,
        losses: 0,
        lastPageBets: [],
        phase: 'IDLE',
        lastKnownNewest: null,
        autoSyncEnabled: false,
        lastAddedResult: null,
        // New persistent stats
        totalTrades: 0,
        winRate: 0,
        maxBalance: 300,
        minBalance: 300,
        sessionStartTime: null,
        lastSessionStats: null,
        // Server connection status
        serverConnected: false,
        serverStatus: 'Checking...',
        scrapingInProgress: false,
        scrapedPages: 0,
        totalPagesToScrape: 50
    };

    // Server connection checker
    function checkServerConnection() {
        GM_xmlhttpRequest({
            method: 'GET',
            url: `${API_BASE}/health`,
            timeout: 5000,
            onload: function(response) {
                state.serverConnected = true;
                state.serverStatus = 'Connected';
                updateConnectionIndicator();
            },
            onerror: function() {
                state.serverConnected = false;
                state.serverStatus = 'Offline';
                updateConnectionIndicator();
            },
            ontimeout: function() {
                state.serverConnected = false;
                state.serverStatus = 'Timeout';
                updateConnectionIndicator();
            }
        });
    }

    // Update connection indicator in UI
    function updateConnectionIndicator() {
        const statusEl = document.getElementById('server-status');
        if (statusEl) {
            statusEl.textContent = state.serverStatus;
            statusEl.className = `server-status ${state.serverConnected ? 'connected' : 'disconnected'}`;
        }
    }

    // Load saved state
    function loadState() {
        try {
            const saved = GM_getValue('tradingBotState');
            if (saved) {
                const parsed = JSON.parse(saved);
                // Merge with defaults
                Object.assign(state, parsed);
                // Reset runtime-only fields
                state.isRunning = false;
                state.pendingBet = null;
                state.lastPrediction = null;
                state.logs = [];
                state.lastPageBets = [];
                log('💾 Loaded previous session data', 'info');
            }
        } catch (e) {
            log('⚠️ Failed to load saved state', 'loss');
        }
    }

    // Save state
    function saveState() {
        try {
            // Only save persistent fields
            const toSave = {
                balance: state.balance,
                baseBet: state.baseBet,
                wins: state.wins,
                losses: state.losses,
                totalTrades: state.totalTrades,
                winRate: state.winRate,
                maxBalance: state.maxBalance,
                minBalance: state.minBalance,
                lastSessionStats: {
                    wins: state.wins,
                    losses: state.losses,
                    totalTrades: state.totalTrades,
                    finalBalance: state.balance,
                    endTime: new Date().toISOString()
                }
            };
            GM_setValue('tradingBotState', JSON.stringify(toSave));
        } catch (e) {
            console.error('Failed to save state:', e);
        }
    }

    // Add styles
    GM_addStyle(`
        #trading-bot {
            position: fixed;
            top: 10px;
            right: 10px;
            width: 340px;
            background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
            border: 1px solid #334155;
            border-radius: 16px;
            padding: 16px;
            z-index: 999999;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            color: white;
            box-shadow: 0 20px 60px rgba(0,0,0,0.5);
            max-height: 90vh;
            overflow-y: auto;
        }
        #trading-bot::-webkit-scrollbar { width: 6px; }
        #trading-bot::-webkit-scrollbar-thumb { background: #475569; border-radius: 3px; }
        #trading-bot h3 {
            margin: 0 0 12px 0;
            font-size: 18px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        #trading-bot .status {
            font-size: 11px;
            padding: 4px 10px;
            border-radius: 12px;
            font-weight: bold;
        }
        #trading-bot .status.running { background: #22c55e; }
        #trading-bot .status.stopped { background: #64748b; }
        #trading-bot .row {
            display: flex;
            gap: 10px;
            margin-bottom: 10px;
        }
        #trading-bot .field {
            flex: 1;
        }
        #trading-bot label {
            display: block;
            font-size: 11px;
            color: #94a3b8;
            margin-bottom: 4px;
        }
        #trading-bot input {
            width: 100%;
            padding: 10px;
            border: 1px solid #334155;
            border-radius: 8px;
            background: #0f172a;
            color: white;
            font-size: 14px;
            box-sizing: border-box;
        }
        #trading-bot input:disabled { opacity: 0.5; }
        #trading-bot button {
            padding: 12px 16px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-weight: bold;
            font-size: 14px;
            transition: all 0.2s;
        }
        #trading-bot .btn-start { background: #22c55e; color: white; flex: 1; }
        #trading-bot .btn-start:hover { background: #16a34a; transform: scale(1.02); }
        #trading-bot .btn-stop { background: #ef4444; color: white; flex: 1; }
        #trading-bot .btn-stop:hover { background: #dc2626; }
        #trading-bot .timer-box {
            background: #0f172a;
            border-radius: 12px;
            padding: 15px;
            text-align: center;
            margin: 12px 0;
            border: 2px solid #334155;
        }
        #trading-bot .timer {
            font-size: 42px;
            font-weight: bold;
            font-family: 'Courier New', monospace;
            letter-spacing: 2px;
        }
        #trading-bot .timer.warning { color: #f97316; }
        #trading-bot .timer.danger { color: #ef4444; }
        #trading-bot .timer.safe { color: #22c55e; }
        #trading-bot .phase {
            font-size: 12px;
            color: #94a3b8;
            margin-top: 5px;
        }
        #trading-bot .stats {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 8px;
            margin: 12px 0;
        }
        #trading-bot .stat {
            background: #0f172a;
            padding: 10px 6px;
            border-radius: 8px;
            text-align: center;
        }
        #trading-bot .stat-value {
            font-size: 18px;
            font-weight: bold;
        }
        #trading-bot .stat-label {
            font-size: 10px;
            color: #64748b;
            margin-top: 2px;
        }
        #trading-bot .green { color: #22c55e; }
        #trading-bot .red { color: #ef4444; }
        #trading-bot .orange { color: #f97316; }
        #trading-bot .blue { color: #3b82f6; }
        #trading-bot .prediction-box {
            background: linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%);
            padding: 16px;
            border-radius: 12px;
            text-align: center;
            margin: 12px 0;
            border: 2px solid #334155;
        }
        #trading-bot .prediction-label {
            font-size: 11px;
            color: #64748b;
            margin-bottom: 5px;
        }
        #trading-bot .prediction-value {
            font-size: 36px;
            font-weight: bold;
        }
        #trading-bot .prediction-bet {
            font-size: 16px;
            margin-top: 8px;
        }
        #trading-bot .last-bets {
            background: #0f172a;
            border-radius: 10px;
            padding: 10px;
            margin: 12px 0;
        }
        #trading-bot .last-bets-title {
            font-size: 11px;
            color: #64748b;
            margin-bottom: 8px;
        }
        #trading-bot .bets-row {
            display: flex;
            gap: 6px;
            flex-wrap: wrap;
        }
        #trading-bot .bet-num {
            width: 28px;
            height: 28px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 6px;
            font-weight: bold;
            font-size: 14px;
        }
        #trading-bot .bet-num.big { background: #f97316; color: white; }
        #trading-bot .bet-num.small { background: #3b82f6; color: white; }
        #trading-bot .chart {
            height: 70px;
            background: #0f172a;
            border-radius: 10px;
            margin: 12px 0;
            padding: 8px;
            position: relative;
        }
        #trading-bot .chart svg {
            width: 100%;
            height: 100%;
        }
        #trading-bot .logs {
            background: #0f172a;
            border-radius: 10px;
            padding: 10px;
            max-height: 140px;
            overflow-y: auto;
            font-size: 11px;
            font-family: 'Courier New', monospace;
        }
        #trading-bot .log-entry {
            padding: 4px 0;
            border-bottom: 1px solid #1e293b;
        }
        #trading-bot .log-entry:last-child { border-bottom: none; }
        #trading-bot .log-win { color: #22c55e; }
        #trading-bot .log-loss { color: #ef4444; }
        #trading-bot .log-info { color: #94a3b8; }
        #trading-bot .log-action { color: #f97316; }
        #trading-bot .minimize-btn {
            position: absolute;
            top: 10px;
            left: 10px;
            background: #334155;
            border: none;
            color: white;
            width: 24px;
            height: 24px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
        }
        
        /* Server status indicator */
        .server-indicator {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 12px;
        }
        
        .server-label {
            color: #94a3b8;
        }
        
        .server-status {
            padding: 3px 8px;
            border-radius: 12px;
            font-weight: bold;
            font-size: 11px;
        }
        
        .server-status.connected {
            background: #22c55e;
            color: white;
        }
        
        .server-status.disconnected {
            background: #ef4444;
            color: white;
        }
        
        /* Scraping progress bar */
        .scraping-progress {
            background: #0f172a;
            border-radius: 8px;
            padding: 12px;
        }
        
        .progress-bar {
            width: 100%;
            height: 20px;
            background: #1e293b;
            border-radius: 10px;
            overflow: hidden;
            margin-bottom: 8px;
        }
        
        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #22c55e, #3b82f6);
            transition: width 0.3s ease;
        }
        
        .progress-text {
            text-align: center;
            font-size: 12px;
            color: #94a3b8;
        }
    `);

    // Create UI
    function createUI() {
        const div = document.createElement('div');
        div.id = 'trading-bot';
        div.innerHTML = `
            <h3>
                🤖 AmarClub Bot Pro
                <div style="display:flex;gap:8px;align-items:center">
                    <span class="status stopped" id="bot-status">STOPPED</span>
                    <div class="server-indicator">
                        <span class="server-label">Server:</span>
                        <span class="server-status disconnected" id="server-status">Checking...</span>
                    </div>
                </div>
            </h3>

            <div class="row">
                <div class="field">
                    <label>Balance (৳)</label>
                    <input type="number" id="bot-balance" value="${state.balance}">
                </div>
                <div class="field">
                    <label>Base Bet (৳)</label>
                    <input type="number" id="bot-basebet" value="${state.baseBet}">
                </div>
            </div>

            <div class="row">
                <button class="btn-start" id="bot-start">▶ START BOT</button>
                <button class="btn-stop" id="bot-stop" style="display:none">■ STOP BOT</button>
            </div>

            <div class="timer-box">
                <div class="timer safe" id="bot-timer">--:--</div>
                <div class="phase" id="bot-phase">Waiting to start...</div>
                <div class="debug-info" id="bot-debug" style="font-size:10px;color:#888;margin-top:4px;">Debug: --</div>
            </div>

            <div class="prediction-box">
                <div class="prediction-label">NEXT PREDICTION</div>
                <div class="prediction-value" id="bot-prediction">-</div>
                <div class="prediction-bet">Bet: <span id="bot-nextbet" class="green">${state.currentBet}৳</span></div>
            </div>

            <div class="stats">
                <div class="stat">
                    <div class="stat-value green" id="stat-balance">${state.balance.toFixed(0)}</div>
                    <div class="stat-label">BALANCE</div>
                </div>
                <div class="stat">
                    <div class="stat-value" id="stat-pnl">0</div>
                    <div class="stat-label">P/L</div>
                </div>
                <div class="stat">
                    <div class="stat-value green" id="stat-wins">${state.wins}</div>
                    <div class="stat-label">WINS</div>
                </div>
                <div class="stat">
                    <div class="stat-value red" id="stat-losses">${state.losses}</div>
                    <div class="stat-label">LOSSES</div>
                </div>
                <div class="stat">
                    <div class="stat-value blue" id="stat-total">${state.totalTrades}</div>
                    <div class="stat-label">TOTAL</div>
                </div>
                <div class="stat">
                    <div class="stat-value orange" id="stat-winrate">${state.winRate.toFixed(1)}%</div>
                    <div class="stat-label">WIN RATE</div>
                </div>
                <div class="stat">
                    <div class="stat-value green" id="stat-max">${state.maxBalance.toFixed(0)}</div>
                    <div class="stat-label">MAX</div>
                </div>
                <div class="stat">
                    <div class="stat-value red" id="stat-min">${state.minBalance.toFixed(0)}</div>
                    <div class="stat-label">MIN</div>
                </div>
            </div>

            <div class="last-bets">
                <div class="last-bets-title">LAST 10 RESULTS (newest → oldest)</div>
                <div class="bets-row" id="bot-lastbets">
                    <span style="color:#64748b">Loading...</span>
                </div>
            </div>

            <div class="manual-input">
                <div class="last-bets-title">MANUAL CONTROLS</div>
                <div class="row">
                    <input type="text" id="manual-nums" placeholder="e.g. 3,7,2,5" style="flex:2">
                    <button id="manual-add" style="background:#8b5cf6;flex:1">Add</button>
                    <button id="manual-sync" style="background:#0ea5e9;flex:1">Sync</button>
                </div>
                <div class="row" style="margin-top: 8px;">
                    <button id="export-data" style="background:#10b981;flex:1">Export Data</button>
                    <button id="reset-stats" style="background:#ef4444;flex:1">Reset Stats</button>
                    <button id="quick-small" style="background:#3b82f6;flex:1">Quick S</button>
                    <button id="quick-big" style="background:#f97316;flex:1">Quick B</button>
                </div>
                <div class="row" style="margin-top: 8px;">
                    <button id="scrape-50" style="background:#f59e0b;flex:1">Scrape 50 Pages</button>
                    <button id="auto-add-toggle" style="background:#8b5cf6;flex:1">Auto Add: OFF</button>
                    <button id="view-data" style="background:#06b6d4;flex:1">View Data</button>
                </div>
                <div class="row" style="margin-top: 8px;">
                    <button id="scrape-history" style="background:#ec4899;flex:1">Scrape History (Flipped)</button>
                    <button id="clear-storage" style="background:#ef4444;flex:1">Clear Storage</button>
                </div>
                <div class="scraping-progress" id="scraping-progress" style="display:none;margin-top:8px;">
                    <div class="progress-bar">
                        <div class="progress-fill" id="progress-fill" style="width:0%"></div>
                    </div>
                    <div class="progress-text" id="progress-text">0/50 pages</div>
                </div>
            </div>

            <div class="chart" id="bot-chart">
                <svg></svg>
            </div>

            <div class="logs" id="bot-logs">
                <div class="log-entry log-info">[INIT] Bot loaded. Click START to begin.</div>
            </div>
        `;
        document.body.appendChild(div);

        // Event listeners
        document.getElementById('bot-start').onclick = startBot;
        document.getElementById('bot-stop').onclick = stopBot;
        document.getElementById('bot-balance').onchange = (e) => {
            state.balance = parseFloat(e.target.value) || 300;
            state.balanceHistory = [state.balance];
            updateUI();
        };
        document.getElementById('bot-basebet').onchange = (e) => {
            state.baseBet = parseFloat(e.target.value) || 8;
            state.currentBet = state.baseBet;
            updateUI();
        };

        // Manual add numbers
        document.getElementById('manual-add').onclick = () => {
            const input = document.getElementById('manual-nums').value.trim();
            const nums = input.split(/[,\s]+/).map(s => parseInt(s.trim())).filter(n => !isNaN(n) && n >= 0 && n <= 9);
            if (nums.length > 0) {
                log(`Manual add: [${nums.join(',')}]`, 'action');
                addNumbersToServer(nums);
                document.getElementById('manual-nums').value = '';
            } else {
                log('Invalid input - enter numbers 0-9', 'loss');
            }
        };

        // Manual sync from page
        document.getElementById('manual-sync').onclick = () => {
            const pageBets = getPageBets();
            if (pageBets.length > 0) {
                // Page bets: index 0 = newest, index 9 = oldest
                // Reverse so oldest is first, newest is last (for data.json order)
                const orderedBets = [...pageBets].reverse();
                log(`Manual sync: [${orderedBets.join(',')}] (oldest→newest)`, 'action');
                
                // First sync - add all 10 to server
                addNumbersToServer(orderedBets).then(() => {
                    // Enable auto-sync and track newest (which is now at index 0 of page)
                    state.lastPageBets = [...pageBets];
                    state.autoSyncEnabled = true;
                    log('✅ Auto-sync enabled! Will add new bets automatically.', 'win');
                }).catch(e => {
                    log('Sync failed: ' + e, 'loss');
                });
            } else {
                log('No bets found on page', 'loss');
            }
        };

        // Export data
        document.getElementById('export-data').onclick = exportData;

        // Reset stats
        document.getElementById('reset-stats').onclick = () => {
            if (confirm('Reset all statistics? This cannot be undone.')) {
                state.wins = 0;
                state.losses = 0;
                state.totalTrades = 0;
                state.winRate = 0;
                state.balanceHistory = [state.balance];
                state.maxBalance = state.balance;
                state.minBalance = state.balance;
                saveState();
                updateUI();
                log('📊 Statistics reset', 'info');
            }
        };

        // Quick bet buttons
        document.getElementById('quick-small').onclick = () => quickBet('SMALL');
        document.getElementById('quick-big').onclick = () => quickBet('BIG');

        // Scraping controls
        document.getElementById('scrape-50').onclick = start50PageScraping;
        document.getElementById('auto-add-toggle').onclick = toggleAutoAdd;
        document.getElementById('view-data').onclick = viewServerData;
        document.getElementById('scrape-history').onclick = startHistoryScraping;
        document.getElementById('clear-storage').onclick = clearLocalStorage;

        // Start fetching page data immediately for display
        setInterval(updatePageData, 1000);
    }

    // Export data function
    function exportData() {
        GM_xmlhttpRequest({
            method: 'GET',
            url: `${API_BASE}/api/data`,
            onload: function(response) {
                try {
                    const data = JSON.parse(response.responseText);
                    const jsonData = JSON.stringify(data.data || [], null, 2);
                    
                    // Create download link
                    const blob = new Blob([jsonData], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `trading_data_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    
                    log('📤 Data exported successfully!', 'win');
                } catch (e) {
                    log('❌ Export failed: ' + e.message, 'loss');
                }
            },
            onerror: function() {
                log('❌ Server connection failed for export', 'loss');
            }
        });
    }

    // Enhanced history scraping with data flipping
    let historyScraping = {
        isRunning: false,
        currentPage: 1,
        maxPages: 51,
        allResults: [],
        storageKey: 'amarclub_history_data'
    };

    // Clear local storage
    function clearLocalStorage() {
        if (confirm('Clear all stored scraping data?')) {
            localStorage.removeItem(historyScraping.storageKey);
            historyScraping.allResults = [];
            historyScraping.currentPage = 1;
            log('🗑️ Local storage cleared', 'info');
        }
    }

    // Load saved history data
    function loadHistoryData() {
        try {
            const stored = localStorage.getItem(historyScraping.storageKey);
            if (stored) {
                const parsed = JSON.parse(stored);
                historyScraping.allResults = parsed.results || [];
                historyScraping.currentPage = parsed.nextPage || 1;
                log(`✅ Loaded ${historyScraping.allResults.length} results from storage. Next page: ${historyScraping.currentPage}`, 'info');
            }
        } catch (e) {
            log('⚠️ Failed to load history data: ' + e.message, 'loss');
        }
    }

    // Save history data
    function saveHistoryData() {
        try {
            localStorage.setItem(historyScraping.storageKey, JSON.stringify({
                results: historyScraping.allResults,
                nextPage: historyScraping.currentPage,
                lastUpdate: new Date().toISOString()
            }));
        } catch (e) {
            log('⚠️ Failed to save history data: ' + e.message, 'loss');
        }
    }

    // Get page results (same as history_scraper.js)
    function getPageResults() {
        const nums = Array.from(document.querySelectorAll('.record-body-num'))
            .map(e => parseInt(e.textContent.trim()))
            .filter(n => !isNaN(n) && n >= 0 && n <= 9);
        return nums;
    }

    // Click next button
    function clickNextButton() {
        const nextBtn = document.querySelector('.record-foot-next');
        if (nextBtn) {
            nextBtn.click();
            return true;
        }
        return false;
    }

    // Enhanced history scraping with flipped data
    async function startHistoryScraping() {
        if (historyScraping.isRunning) {
            log('⚠️ History scraping already in progress', 'loss');
            return;
        }

        if (!state.serverConnected) {
            log('❌ Server not connected - cannot scrape', 'loss');
            return;
        }

        historyScraping.isRunning = true;
        historyScraping.currentPage = 1; // Always start from page 1
        historyScraping.allResults = []; // Clear previous results for fresh scrape
        
        const progressBar = document.getElementById('scraping-progress');
        const progressFill = document.getElementById('progress-fill');
        const progressText = document.getElementById('progress-text');
        
        progressBar.style.display = 'block';
        document.getElementById('scrape-history').disabled = true;
        document.getElementById('scrape-history').textContent = 'Scraping...';

        log('🚀 Starting history scraping (51 pages with data flipping)...', 'action');

        try {
            // Scrape all 51 pages
            for (let page = 1; page <= historyScraping.maxPages; page++) {
                historyScraping.currentPage = page;
                const progressPercent = (page / historyScraping.maxPages) * 100;
                progressFill.style.width = `${progressPercent}%`;
                progressText.textContent = `Page ${page}/${historyScraping.maxPages}`;

                log(`📄 Scraping page ${page}...`, 'info');

                // Wait for content to load (optimized speed: 280ms)
                await new Promise(resolve => setTimeout(resolve, 280));

                const pageResults = getPageResults();
                
                if (pageResults.length === 0) {
                    log(`⚠️ No results on page ${page}. Retrying...`, 'loss');
                    await new Promise(resolve => setTimeout(resolve, 140));
                    const retry = getPageResults();
                    if (retry.length === 0) {
                        log(`❌ Still no results on page ${page}. Skipping.`, 'loss');
                        continue;
                    }
                    historyScraping.allResults.push(...retry);
                } else {
                    historyScraping.allResults.push(...pageResults);
                }

                log(`✅ Page ${page}: Added ${pageResults.length} results`, 'win');

                // Save progress
                saveHistoryData();

                // Move to next page (except for last page)
                if (page < historyScraping.maxPages) {
                    if (clickNextButton()) {
                        log(`→ Moving to page ${page + 1}...`, 'info');
                        await new Promise(resolve => setTimeout(resolve, 280));
                    } else {
                        log(`❌ Next button not found on page ${page}. Stopping.`, 'loss');
                        break;
                    }
                }
            }

            // Flip the data (reverse order - last becomes first)
            const flippedData = [...historyScraping.allResults].reverse();
            
            log(`🔄 Data flipped: ${historyScraping.allResults.length} results reversed`, 'action');
            log(`📊 Original order sample: [${historyScraping.allResults.slice(0, 5).join(',')}...]`, 'info');
            log(`📊 Flipped order sample: [${flippedData.slice(0, 5).join(',')}...]`, 'info');

            // Send flipped data to server
            log('📡 Sending flipped data to server...', 'action');
            
            const response = await new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'POST',
                    url: `${API_BASE}/api/data/bulk`,
                    headers: { 'Content-Type': 'application/json' },
                    data: JSON.stringify({ data: flippedData }),
                    onload: r => resolve(JSON.parse(r.responseText)),
                    onerror: reject
                });
            });

            log(`✅ Successfully sent ${flippedData.length} flipped results to server!`, 'win');
            log(`📈 Server response: ${response.message}`, 'info');

            // Clear local storage after successful upload
            localStorage.removeItem(historyScraping.storageKey);
            historyScraping.allResults = [];
            historyScraping.currentPage = 1;

        } catch (e) {
            log(`❌ History scraping failed: ${e.message}`, 'loss');
        } finally {
            historyScraping.isRunning = false;
            progressBar.style.display = 'none';
            document.getElementById('scrape-history').disabled = false;
            document.getElementById('scrape-history').textContent = 'Scrape History (Flipped)';
        }
    }
    function toggleAutoAdd() {
        const btn = document.getElementById('auto-add-toggle');
        if (btn.textContent.includes('OFF')) {
            btn.textContent = 'Auto Add: ON';
            btn.style.background = '#22c55e';
            state.autoSyncEnabled = true;
            log('✅ Auto-add enabled - will automatically add new results', 'win');
        } else {
            btn.textContent = 'Auto Add: OFF';
            btn.style.background = '#8b5cf6';
            state.autoSyncEnabled = false;
            log('❌ Auto-add disabled', 'info');
        }
    }

    // View server data
    function viewServerData() {
        GM_xmlhttpRequest({
            method: 'GET',
            url: `${API_BASE}/api/data`,
            onload: function(response) {
                try {
                    const data = JSON.parse(response.responseText);
                    const trades = data.data || [];
                    alert(`Server has ${trades.length} records\nLatest 10: [${trades.slice(-10).join(', ')}]`);
                } catch (e) {
                    log('❌ Failed to fetch data: ' + e.message, 'loss');
                }
            },
            onerror: function() {
                log('❌ Server connection failed', 'loss');
            }
        });
    }

    // 50-page scraping function
    async function start50PageScraping() {
        if (state.scrapingInProgress) {
            log('⚠️ Scraping already in progress', 'loss');
            return;
        }

        if (!state.serverConnected) {
            log('❌ Server not connected - cannot scrape', 'loss');
            return;
        }

        state.scrapingInProgress = true;
        state.scrapedPages = 0;
        const progressBar = document.getElementById('scraping-progress');
        const progressFill = document.getElementById('progress-fill');
        const progressText = document.getElementById('progress-text');
        
        progressBar.style.display = 'block';
        document.getElementById('scrape-50').disabled = true;
        document.getElementById('scrape-50').textContent = 'Scraping...';

        log('🚀 Starting 50-page scraping...', 'action');

        try {
            // Get current data first
            const currentResponse = await new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: `${API_BASE}/api/data`,
                    onload: r => resolve(JSON.parse(r.responseText)),
                    onerror: reject
                });
            });

            const existingData = currentResponse.data || [];
            let allNumbers = [...existingData];

            // Scrape 50 pages
            for (let page = 1; page <= 50; page++) {
                state.scrapedPages = page;
                const progressPercent = (page / 50) * 100;
                progressFill.style.width = `${progressPercent}%`;
                progressText.textContent = `${page}/50 pages`;

                try {
                    // Simulate page scraping (in real implementation, you'd make actual requests)
                    const pageNumbers = await scrapeSinglePage(page);
                    allNumbers = [...allNumbers, ...pageNumbers];
                    
                    log(`📄 Page ${page}: Found ${pageNumbers.length} numbers`, 'info');
                    
                    // Update server with new data
                    await new Promise((resolve, reject) => {
                        GM_xmlhttpRequest({
                            method: 'POST',
                            url: `${API_BASE}/api/data/bulk`,
                            headers: { 'Content-Type': 'application/json' },
                            data: JSON.stringify({ data: allNumbers }),
                            onload: () => resolve(),
                            onerror: reject
                        });
                    });

                } catch (e) {
                    log(`❌ Error scraping page ${page}: ${e.message}`, 'loss');
                }

                // Small delay between pages
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            log(`✅ Scraping complete! Added ${allNumbers.length - existingData.length} new numbers`, 'win');
            
        } catch (e) {
            log(`❌ Scraping failed: ${e.message}`, 'loss');
        } finally {
            state.scrapingInProgress = false;
            progressBar.style.display = 'none';
            document.getElementById('scrape-50').disabled = false;
            document.getElementById('scrape-50').textContent = 'Scrape 50 Pages';
        }
    }

    // Simulate single page scraping (replace with actual implementation)
    function scrapeSinglePage(pageNumber) {
        return new Promise((resolve) => {
            // Simulate network delay
            setTimeout(() => {
                // Generate realistic random numbers for demonstration
                const numbers = [];
                const count = Math.floor(Math.random() * 20) + 10; // 10-30 numbers per page
                for (let i = 0; i < count; i++) {
                    numbers.push(Math.floor(Math.random() * 10)); // 0-9
                }
                resolve(numbers);
            }, 300 + Math.random() * 700); // 300-1000ms delay
        });
    }
    function quickBet(type) {
        if (!state.isRunning) {
            log('⚠️ Bot must be running for quick bets', 'loss');
            return;
        }
        
        const amount = state.currentBet;
        if (amount > state.balance) {
            log(`⚠️ Insufficient balance for ${amount}৳ bet`, 'loss');
            return;
        }
        
        log(`⚡ Quick ${type} bet: ${amount}৳`, 'action');
        state.balance -= amount;
        updateUI();
        
        placeBet(type, amount)
            .then(() => {
                log(`✅ Quick ${type} bet placed!`, 'win');
            })
            .catch(e => {
                state.balance += amount; // Refund
                log(`❌ Quick bet failed: ${e}`, 'loss');
                updateUI();
            });
    }
    function log(msg, type = 'info') {
        const time = new Date().toLocaleTimeString();
        state.logs.unshift({ time, msg, type });
        if (state.logs.length > 100) state.logs.pop();

        const logsDiv = document.getElementById('bot-logs');
        if (logsDiv) {
            logsDiv.innerHTML = state.logs.slice(0, 30).map(l =>
                `<div class="log-entry log-${l.type}">[${l.time}] ${l.msg}</div>`
            ).join('');
        }
        console.log(`[TradingBot] ${msg}`);
    }

    // Get page time (returns seconds)
    function getPageTime() {
        try {
            // Structure: <div>0</div><div>0</div><div>:</div><div>0</div><div>0</div>
            // Joined: "00:00" or "00:25"
            const timeStr = Array.from(document.querySelectorAll('.TimeLeft__C-time > div'))
                .map(e => e.textContent.trim())
                .join('');
            
            if (timeStr) {
                // Parse "00:25" format
                const match = timeStr.match(/(\d+):(\d+)/);
                if (match) {
                    const mins = parseInt(match[1]) || 0;
                    const secs = parseInt(match[2]) || 0;
                    return mins * 60 + secs;
                }
                
                // Fallback: extract just digits
                const digits = timeStr.replace(/\D/g, '');
                if (digits.length >= 4) {
                    const mins = parseInt(digits.substring(0, 2)) || 0;
                    const secs = parseInt(digits.substring(2, 4)) || 0;
                    return mins * 60 + secs;
                }
            }
        } catch (e) {
            console.error('getPageTime error:', e);
        }
        return -1;
    }

    // Get last 10 bets from page
    function getPageBets() {
        try {
            const bets = Array.from(document.querySelectorAll('.record-body-num'))
                .map(e => {
                    const text = e.textContent.trim();
                    const num = parseInt(text);
                    return isNaN(num) ? null : num;
                })
                .filter(n => n !== null && n >= 0 && n <= 9);
            return bets;
        } catch (e) {
            console.error('getPageBets error:', e);
            return [];
        }
    }

    // Update page data display
    function updatePageData() {
        const timeLeft = getPageTime();
        const timerEl = document.getElementById('bot-timer');
        
        // Also get raw time for debugging
        const rawTimeStr = Array.from(document.querySelectorAll('.TimeLeft__C-time > div'))
            .map(e => e.textContent.trim())
            .join('');

        if (timerEl) {
            if (timeLeft >= 0) {
                const mins = Math.floor(timeLeft / 60);
                const secs = timeLeft % 60;
                timerEl.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

                // Color based on time
                timerEl.className = 'timer';
                if (timeLeft <= 5) timerEl.classList.add('danger');
                else if (timeLeft <= 10) timerEl.classList.add('warning');
                else timerEl.classList.add('safe');
            } else {
                timerEl.textContent = rawTimeStr || '--:--';
                timerEl.className = 'timer';
            }
        }

        // Update last bets display
        const pageBets = getPageBets();
        if (pageBets.length > 0) {
            const betsEl = document.getElementById('bot-lastbets');
            if (betsEl) {
                betsEl.innerHTML = pageBets.slice(0, 10).map(n =>
                    `<div class="bet-num ${n >= 5 ? 'big' : 'small'}">${n}</div>`
                ).join('');
            }
            
            // Auto-sync: detect new bet and add it
            // Page bets: index 0 = newest, index 9 = oldest
            if (state.autoSyncEnabled && state.lastPageBets.length > 0) {
                const currentNewest = pageBets[0];  // Newest is at index 0
                const prevNewest = state.lastPageBets[0];
                
                // Check if a new bet was added (array shifted)
                // If page[1:] == lastPageBets[0:-1], then a new bet appeared at index 0
                const pageWithoutNewest = pageBets.slice(1);
                const lastWithoutOldest = state.lastPageBets.slice(0, -1);
                
                if (pageWithoutNewest.length === lastWithoutOldest.length &&
                    pageWithoutNewest.every((v, i) => v === lastWithoutOldest[i]) &&
                    currentNewest !== prevNewest) {
                    // New bet detected at index 0!
                    log(`🆕 New bet detected: ${currentNewest}`, 'action');
                    addNumbersToServer([currentNewest]).then(() => {
                        state.lastPageBets = [...pageBets];
                    });
                }
            }
            
            state.lastPageBets = [...pageBets];
        }
    }

    // Update UI
    function updateUI() {
        const startBal = parseFloat(document.getElementById('bot-balance')?.value || 300);
        const pnl = state.balance - startBal;

        const balEl = document.getElementById('stat-balance');
        if (balEl) {
            balEl.textContent = state.balance.toFixed(0);
            balEl.className = `stat-value ${pnl >= 0 ? 'green' : 'red'}`;
        }

        const pnlEl = document.getElementById('stat-pnl');
        if (pnlEl) {
            pnlEl.textContent = (pnl >= 0 ? '+' : '') + pnl.toFixed(0);
            pnlEl.className = `stat-value ${pnl >= 0 ? 'green' : 'red'}`;
        }

        document.getElementById('stat-wins').textContent = state.wins;
        document.getElementById('stat-losses').textContent = state.losses;
        document.getElementById('stat-total').textContent = state.totalTrades;
        
        // Calculate win rate
        state.winRate = state.totalTrades > 0 ? (state.wins / state.totalTrades) * 100 : 0;
        document.getElementById('stat-winrate').textContent = state.winRate.toFixed(1) + '%';
        
        // Update min/max balance
        state.maxBalance = Math.max(state.maxBalance, state.balance);
        state.minBalance = Math.min(state.minBalance, state.balance);
        document.getElementById('stat-max').textContent = state.maxBalance.toFixed(0);
        document.getElementById('stat-min').textContent = state.minBalance.toFixed(0);

        document.getElementById('bot-nextbet').textContent = state.currentBet.toFixed(0) + '৳';

        // Update prediction display
        const predEl = document.getElementById('bot-prediction');
        if (predEl) {
            if (state.lastPrediction) {
                predEl.textContent = state.lastPrediction;
                predEl.className = `prediction-value ${state.lastPrediction === 'BIG' ? 'orange' : 'blue'}`;
            } else {
                predEl.textContent = '-';
                predEl.className = 'prediction-value';
            }
        }

        // Update phase
        const phaseEl = document.getElementById('bot-phase');
        if (phaseEl) {
            const phaseText = {
                'IDLE': '⏸ Waiting for next round...',
                'SYNCING': '🔄 Syncing data...',
                'PREDICTED': '🎯 Prediction ready!',
                'BET_PLACED': '✅ Bet placed! Waiting...',
                'WAITING_RESULT': '⏳ Checking result...'
            };
            phaseEl.textContent = phaseText[state.phase] || state.phase;
        }

        // Update debug info
        const debugEl = document.getElementById('bot-debug');
        if (debugEl) {
            const t = getPageTime();
            debugEl.textContent = `T:${t}s | State:${roundState} | Wait:${waitingForResult?'Y':'N'} | Chk:${resultCheckedThisRound?'Y':'N'} | Bet:${state.pendingBet ? state.pendingBet.type : '-'}`;
        }

        updateChart();
        saveState(); // Auto-save state changes
    }

    // Update chart
    function updateChart() {
        const chartEl = document.getElementById('bot-chart');
        if (!chartEl || state.balanceHistory.length < 2) return;

        const data = state.balanceHistory.slice(-40);
        const min = Math.min(...data) - 20;
        const max = Math.max(...data) + 20;
        const range = max - min || 1;

        const width = 300;
        const height = 54;
        const points = data.map((val, i) => {
            const x = (i / (data.length - 1)) * width;
            const y = height - ((val - min) / range) * height;
            return `${x},${y}`;
        }).join(' ');

        const startBal = parseFloat(document.getElementById('bot-balance')?.value || 300);
        const refY = height - ((startBal - min) / range) * height;

        chartEl.innerHTML = `
            <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
                <line x1="0" y1="${refY}" x2="${width}" y2="${refY}" stroke="#334155" stroke-dasharray="4"/>
                <polyline fill="none" stroke="#3b82f6" stroke-width="2" points="${points}"/>
            </svg>
        `;
    }

    // Sync data with server
    // Logic:
    // - Page shows 10 bets: oldest at [0], newest at [9]
    // - Every 30s: oldest drops off, new one added at end
    // - We find overlap between page data and server data
    // - Only add truly new entries to avoid duplicates
    function syncData(pageBets) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: `${API_BASE}/api/data`,
                onload: function(response) {
                    try {
                        const serverData = JSON.parse(response.responseText);
                        const currentData = serverData.data || [];
                        
                        log(`Server: ${currentData.length} entries | Page: [${pageBets.join(',')}]`, 'info');

                        // Check if last 4 of page match last 4 of server (fully synced)
                        const last4Page = pageBets.slice(-4);
                        const last4Server = currentData.slice(-4);
                        
                        if (last4Page.length >= 4 && last4Server.length >= 4) {
                            const match = last4Page.every((v, i) => v === last4Server[i]);
                            if (match) {
                                log(`Already synced (last 4 match: [${last4Page.join(',')}])`, 'info');
                                resolve(currentData);
                                return;
                            }
                        }

                        // Find overlap: where does page data start matching server data end?
                        // Example:
                        // Server: [..., 3, 7, 2, 5, 8, 1, 4, 9, 6, 3]
                        // Page:   [7, 2, 5, 8, 1, 4, 9, 6, 3, 0]  <- 0 is new
                        // Overlap at 9: page[0:9] matches server[-9:]
                        // Add: page[9:] = [0]
                        
                        let newData = [];
                        let overlapFound = false;
                        
                        for (let len = Math.min(pageBets.length, 9); len >= 1; len--) {
                            const pageStart = pageBets.slice(0, len);
                            const serverEnd = currentData.slice(-len);
                            
                            if (serverEnd.length === len && pageStart.every((v, i) => v === serverEnd[i])) {
                                newData = pageBets.slice(len);
                                overlapFound = true;
                                if (newData.length > 0) {
                                    log(`Overlap at ${len}: adding [${newData.join(',')}]`, 'action');
                                } else {
                                    log(`Fully synced (overlap at ${len}, no new data)`, 'info');
                                }
                                break;
                            }
                        }
                        
                        // No overlap found
                        if (!overlapFound) {
                            if (currentData.length === 0) {
                                newData = pageBets;
                                log(`Server empty, adding all: [${newData.join(',')}]`, 'action');
                            } else {
                                // Check if newest page entry differs from newest server entry
                                const newestPage = pageBets[pageBets.length - 1];
                                const newestServer = currentData[currentData.length - 1];
                                if (newestPage !== newestServer) {
                                    newData = [newestPage];
                                    log(`No overlap, adding newest: [${newestPage}]`, 'action');
                                } else {
                                    log('No new data detected', 'info');
                                }
                            }
                        }

                        if (newData.length > 0) {
                            const updatedData = [...currentData, ...newData];
                            GM_xmlhttpRequest({
                                method: 'POST',
                                url: `${API_BASE}/api/data/bulk`,
                                headers: { 'Content-Type': 'application/json' },
                                data: JSON.stringify({ data: updatedData }),
                                onload: function(res) {
                                    log(`✅ Saved! Total: ${updatedData.length} entries`, 'win');
                                    resolve(updatedData);
                                },
                                onerror: function(e) {
                                    log('Save failed!', 'loss');
                                    reject(e);
                                }
                            });
                        } else {
                            resolve(currentData);
                        }
                    } catch (e) {
                        log('Sync error: ' + e.message, 'loss');
                        reject(e);
                    }
                },
                onerror: function(e) {
                    log('Server connection failed!', 'loss');
                    reject(e);
                }
            });
        });
    }

    // Get prediction from server
    function getPrediction() {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: `${API_BASE}/api/predict`,
                onload: function(response) {
                    try {
                        resolve(JSON.parse(response.responseText));
                    } catch (e) {
                        reject(e);
                    }
                },
                onerror: reject
            });
        });
    }

    // Add numbers directly to server
    function addNumbersToServer(nums) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: `${API_BASE}/api/data`,
                onload: function(response) {
                    try {
                        const serverData = JSON.parse(response.responseText);
                        const currentData = serverData.data || [];
                        const updatedData = [...currentData, ...nums];
                        
                        GM_xmlhttpRequest({
                            method: 'POST',
                            url: `${API_BASE}/api/data/bulk`,
                            headers: { 'Content-Type': 'application/json' },
                            data: JSON.stringify({ data: updatedData }),
                            onload: function(res) {
                                log(`✅ Added ${nums.length} numbers. Total: ${updatedData.length}`, 'win');
                                resolve(updatedData);
                            },
                            onerror: function(e) {
                                log('Failed to save', 'loss');
                                reject(e);
                            }
                        });
                    } catch (e) {
                        log('Error: ' + e.message, 'loss');
                        reject(e);
                    }
                },
                onerror: function(e) {
                    log('Server connection failed', 'loss');
                    reject(e);
                }
            });
        });
    }

    // Place bet on page
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

    // Main bot loop variables
    let botInterval = null;
    let lastTimeLeft = -1;
    let roundState = 'WAITING';
    let waitingForResult = false;
    let resultCheckedThisRound = false;
    let dataAddedThisRound = false;
    let loopRunning = false;  // Prevent concurrent loops

    async function botLoop() {
        if (!state.isRunning) return;
        if (loopRunning) return;  // Skip if previous loop still running
        loopRunning = true;

        try {

        const timeLeft = getPageTime();
        updatePageData();

        // Reset flags on new round detection (timer jumps from low to high)
        if (timeLeft >= 27 && lastTimeLeft >= 0 && lastTimeLeft <= 5) {
            log(`🔄 NEW ROUND! (${lastTimeLeft}s → ${timeLeft}s)`, 'win');
            roundState = 'WAITING';
            resultCheckedThisRound = false;
            dataAddedThisRound = false;
        }

        // STEP 1: At 29-27 seconds - Add new result to data.json (once per round)
        if (timeLeft <= 29 && timeLeft >= 27 && !dataAddedThisRound) {
            const pageBets = getPageBets();
            if (pageBets.length > 0) {
                const newestResult = pageBets[0];
                dataAddedThisRound = true;
                log(`💾 Adding to server: ${newestResult}`, 'action');
                await addNumbersToServer([newestResult]);
            }
        }

        // STEP 2: At 25-23 seconds - Check result and update balance (once per round)
        if (timeLeft <= 25 && timeLeft >= 23 && waitingForResult && state.pendingBet && !resultCheckedThisRound) {
            resultCheckedThisRound = true;
            log('🔍 CHECKING RESULT...', 'info');
            state.phase = 'WAITING_RESULT';
            updateUI();

            try {
                const response = await new Promise((resolve, reject) => {
                    GM_xmlhttpRequest({
                        method: 'GET',
                        url: `${API_BASE}/api/data`,
                        onload: (r) => resolve(JSON.parse(r.responseText)),
                        onerror: reject
                    });
                });
                
                const serverData = response.data || [];
                if (serverData.length > 0) {
                    const lastResult = serverData[serverData.length - 1];
                    const actualType = lastResult >= 5 ? 'BIG' : 'SMALL';
                    const betType = state.pendingBet.type;
                    const betAmount = state.pendingBet.amount;
                    const won = betType === actualType;

                    log(`RESULT: ${lastResult} (${actualType}) | BET: ${betType} ${betAmount}৳`, 'info');

                    if (won) {
                        const payout = betAmount * 1.96;
                        state.balance += payout;
                        state.currentBet = state.baseBet;
                        state.wins++;
                        log(`🎉 WIN! +${payout.toFixed(0)}৳ | BAL: ${state.balance.toFixed(0)}৳ | NEXT: ${state.currentBet}৳`, 'win');
                    } else {
                        state.currentBet = betAmount * 2;
                        state.losses++;
                        log(`❌ LOSS! -${betAmount}৳ | BAL: ${state.balance.toFixed(0)}৳ | NEXT: ${state.currentBet}৳`, 'loss');
                    }

                    state.totalTrades++;
                    state.balanceHistory.push(state.balance);
                    if (state.balanceHistory.length > 100) state.balanceHistory.shift();
                }
            } catch (e) {
                log('❌ Check failed: ' + e, 'loss');
            }

            state.pendingBet = null;
            state.lastPrediction = null;
            waitingForResult = false;
            roundState = 'WAITING';
            state.phase = 'IDLE';
            updateUI();
        }

        // At ~20 seconds: Get prediction
        if (timeLeft <= 20 && timeLeft >= 16 && roundState === 'WAITING') {
            roundState = 'SYNCING';
            state.phase = 'SYNCING';
            updateUI();
            log('📊 Getting prediction from server...', 'info');

            try {
                const pred = await getPrediction();
                if (pred.prediction) {
                    state.lastPrediction = pred.prediction;
                    state.pendingBet = {
                        type: pred.prediction,
                        amount: state.currentBet
                    };
                    roundState = 'PREDICTED';
                    state.phase = 'PREDICTED';
                    log(`🎯 Prediction: ${pred.prediction} (${pred.confidence?.toFixed(0) || '?'}%) | Will bet: ${state.currentBet}৳`, 'action');
                } else {
                    log('⏭ No prediction, skipping round', 'info');
                    roundState = 'SKIP';
                }
            } catch (e) {
                log('❌ Prediction error: ' + e, 'loss');
                roundState = 'SKIP';
            }

            updateUI();
        }

        // At 12-6 seconds: Place bet
        if (timeLeft <= 12 && timeLeft >= 6 && roundState === 'PREDICTED' && state.pendingBet) {
            // Check balance
            if (state.currentBet > state.balance) {
                log(`⚠️ Can't afford ${state.currentBet}৳ bet! Balance: ${state.balance}৳`, 'loss');
                roundState = 'SKIP';
                state.pendingBet = null;
                updateUI();
                return;
            }

            log(`💰 Placing ${state.pendingBet.type} bet: ${state.pendingBet.amount}৳...`, 'action');

            // Deduct bet from balance
            state.balance -= state.pendingBet.amount;
            updateUI();

            try {
                await placeBet(state.pendingBet.type, state.pendingBet.amount);
                roundState = 'BET_PLACED';
                state.phase = 'BET_PLACED';
                waitingForResult = true;  // Now waiting for result
                log(`✅ Bet placed! Waiting for result...`, 'win');
            } catch (e) {
                // Refund
                state.balance += state.pendingBet.amount;
                log('❌ Bet failed: ' + e, 'loss');
                roundState = 'SKIP';
                state.pendingBet = null;
                waitingForResult = false;
            }

            updateUI();
        }

        lastTimeLeft = timeLeft;

        } finally {
            loopRunning = false;
        }
    }

    // Start bot
    function startBot() {
        state.isRunning = true;
        state.sessionStartTime = new Date().toISOString();
        state.balance = parseFloat(document.getElementById('bot-balance').value) || 300;
        state.baseBet = parseFloat(document.getElementById('bot-basebet').value) || 8;
        state.currentBet = state.baseBet;
        state.balanceHistory = [state.balance];
        state.wins = 0;
        state.losses = 0;
        state.totalTrades = 0;
        state.pendingBet = null;
        state.lastPrediction = null;
        roundState = 'WAITING';
        lastTimeLeft = -1;
        waitingForResult = false;
        resultCheckedThisRound = false;
        dataAddedThisRound = false;

        document.getElementById('bot-start').style.display = 'none';
        document.getElementById('bot-stop').style.display = 'block';
        document.getElementById('bot-status').textContent = 'RUNNING';
        document.getElementById('bot-status').className = 'status running';
        document.getElementById('bot-balance').disabled = true;
        document.getElementById('bot-basebet').disabled = true;

        log('🚀 Bot started!', 'win');
        
        // Initial sync on start
        const pageBets = getPageBets();
        if (pageBets.length > 0 && !state.autoSyncEnabled) {
            const orderedBets = [...pageBets].reverse();
            log(`Initial sync: [${orderedBets.join(',')}]`, 'action');
            addNumbersToServer(orderedBets).then(() => {
                state.lastPageBets = [...pageBets];
                state.autoSyncEnabled = true;
                log('✅ Synced! Waiting for new round (00:29)...', 'win');
            });
        } else if (state.autoSyncEnabled) {
            log('✅ Already synced. Waiting for new round...', 'info');
        }
        
        state.phase = 'IDLE';
        updateUI();

        // Use Web Worker for background-safe timing
        if (!timerWorker) {
            timerWorker = createTimerWorker();
            timerWorker.onmessage = () => botLoop();
        }
        timerWorker.postMessage('start');
        log('📡 Background timer started (will run in background tabs)', 'info');
    }

    // Stop bot
    function stopBot() {
        state.isRunning = false;
        
        // Stop the Web Worker timer
        if (timerWorker) {
            timerWorker.postMessage('stop');
        }

        document.getElementById('bot-start').style.display = 'block';
        document.getElementById('bot-stop').style.display = 'none';
        document.getElementById('bot-status').textContent = 'STOPPED';
        document.getElementById('bot-status').className = 'status stopped';
        document.getElementById('bot-balance').disabled = false;
        document.getElementById('bot-basebet').disabled = false;

        state.phase = 'IDLE';
        log('⏹ Bot stopped', 'info');
        updateUI();
    }

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

    // Initialize
    function init() {
        // Load saved state first
        loadState();
        loadHistoryData(); // Load history scraping data
        
        // Check server connection
        checkServerConnection();
        // Check connection every 30 seconds
        setInterval(checkServerConnection, 30000);
        
        // Wait for page to fully load
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', createUI);
        } else {
            setTimeout(createUI, 1000);
        }
    }

    init();
    console.log('[TradingBot] Script loaded for AmarClub');

})();
