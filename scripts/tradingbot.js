// ==UserScript==
// @name         Trading Bot - AmarClub
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Automated trading with server prediction for AmarClub
// @match        https://amarclub.net/*
// @match        https://*.amarclub.net/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      localhost
// @connect      100.116.92.28
// @connect      *
// ==/UserScript==

(function() {
    'use strict';

    const API_BASE = 'http://100.116.92.28:3001';

    // State
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
        lastAddedResult: null  // Track last result added to prevent duplicates
    };

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
    `);

    // Create UI
    function createUI() {
        const div = document.createElement('div');
        div.id = 'trading-bot';
        div.innerHTML = `
            <h3>
                🤖 AmarClub Bot
                <span class="status stopped" id="bot-status">STOPPED</span>
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
            </div>

            <div class="last-bets">
                <div class="last-bets-title">LAST 10 RESULTS (newest → oldest)</div>
                <div class="bets-row" id="bot-lastbets">
                    <span style="color:#64748b">Loading...</span>
                </div>
            </div>

            <div class="manual-input">
                <div class="last-bets-title">MANUAL ADD</div>
                <div class="row">
                    <input type="text" id="manual-nums" placeholder="e.g. 3,7,2,5" style="flex:2">
                    <button id="manual-add" style="background:#8b5cf6;flex:1">Add</button>
                    <button id="manual-sync" style="background:#0ea5e9;flex:1">Sync</button>
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

        // Start fetching page data immediately for display
        setInterval(updatePageData, 1000);
    }

    // Logging
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
        state.balance = parseFloat(document.getElementById('bot-balance').value) || 300;
        state.baseBet = parseFloat(document.getElementById('bot-basebet').value) || 8;
        state.currentBet = state.baseBet;
        state.balanceHistory = [state.balance];
        state.wins = 0;
        state.losses = 0;
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
