// ==UserScript==
// @name         AmarClub History Scraper (Multi-Page)
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Scrapes all 51 pages of historical results with reload-resilient localStorage persistence
// @author       Qoder
// @match        https://amarclub.net/*
// @match        https://*.amarclub.net/*
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    const STORAGE_KEY = 'amarclub_history_data';
    const MAX_PAGES = 50;
    let isRunning = false;
    let currentPage = 1;
    let allResults = [];

    // Styles for the control panel
    GM_addStyle(`
        @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap');
        
        #scraper-panel {
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: linear-gradient(145deg, #0c0c14, #12121e);
            border: 1px solid #00ff9d;
            border-radius: 10px;
            padding: 18px;
            z-index: 1000000;
            font-family: 'Share Tech Mono', monospace;
            color: #00ff9d;
            box-shadow: 
                0 0 25px rgba(0, 255, 157, 0.2),
                inset 0 0 15px rgba(0, 255, 157, 0.05);
            width: 320px;
            backdrop-filter: blur(5px);
            transition: all 0.3s ease;
        }
        
        #scraper-panel:hover {
            box-shadow: 
                0 0 35px rgba(0, 255, 157, 0.3),
                inset 0 0 20px rgba(0, 255, 157, 0.1);
            transform: translateY(-2px);
        }
        
        #scraper-panel h3 {
            margin: 0 0 16px 0;
            font-size: 16px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            text-shadow: 0 0 8px rgba(0, 255, 157, 0.5);
            letter-spacing: 1px;
            border-bottom: 1px solid rgba(0, 255, 157, 0.2);
            padding-bottom: 10px;
        }
        
        .scraper-status {
            font-size: 11px;
            padding: 5px 10px;
            border-radius: 15px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 1px;
            box-shadow: 0 0 8px rgba(0, 255, 157, 0.3);
        }
        
        .scraper-status.active { 
            background: rgba(0, 255, 157, 0.15);
            color: #00ff9d;
            border: 1px solid #00ff9d;
        }
        
        .scraper-status.idle { 
            background: rgba(100, 116, 139, 0.2);
            color: #94a3b8;
            border: 1px solid #64748b;
        }
        
        .scraper-info {
            background: rgba(12, 12, 20, 0.7);
            border: 1px solid rgba(0, 255, 157, 0.15);
            border-radius: 8px;
            padding: 14px;
            margin-bottom: 16px;
            box-shadow: inset 0 0 10px rgba(0, 255, 157, 0.05);
        }
        
        .scraper-info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
            font-size: 13px;
        }
        
        .scraper-info-row:last-child { margin-bottom: 0; }
        
        .scraper-info-label {
            color: #00cc7a;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .scraper-info-value {
            font-weight: bold;
            color: #00ff9d;
            text-shadow: 0 0 6px rgba(0, 255, 157, 0.4);
        }
        
        .scraper-btn {
            width: 100%;
            padding: 11px;
            border: 1px solid;
            border-radius: 6px;
            font-weight: bold;
            font-size: 13px;
            font-family: 'Share Tech Mono', monospace;
            cursor: pointer;
            margin-bottom: 10px;
            transition: all 0.2s ease;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            position: relative;
            overflow: hidden;
        }
        
        .scraper-btn:last-child { margin-bottom: 0; }
        
        .scraper-btn.start { 
            background: rgba(0, 255, 157, 0.1);
            color: #00ff9d;
            border-color: #00ff9d;
            box-shadow: 0 0 10px rgba(0, 255, 157, 0.2);
        }
        
        .scraper-btn.start:hover { 
            background: rgba(0, 255, 157, 0.2);
            box-shadow: 0 0 15px rgba(0, 255, 157, 0.4);
            transform: translateY(-1px);
        }
        
        .scraper-btn.stop { 
            background: rgba(255, 50, 50, 0.1);
            color: #ff3232;
            border-color: #ff3232;
            box-shadow: 0 0 10px rgba(255, 50, 50, 0.2);
        }
        
        .scraper-btn.stop:hover { 
            background: rgba(255, 50, 50, 0.2);
            box-shadow: 0 0 15px rgba(255, 50, 50, 0.4);
            transform: translateY(-1px);
        }
        
        .scraper-btn.download { 
            background: rgba(50, 150, 255, 0.1);
            color: #3296ff;
            border-color: #3296ff;
            box-shadow: 0 0 10px rgba(50, 150, 255, 0.2);
        }
        
        .scraper-btn.download:hover { 
            background: rgba(50, 150, 255, 0.2);
            box-shadow: 0 0 15px rgba(50, 150, 255, 0.4);
            transform: translateY(-1px);
        }
        
        .scraper-btn.clear { 
            background: rgba(255, 170, 0, 0.1);
            color: #ffa500;
            border-color: #ffa500;
            box-shadow: 0 0 10px rgba(255, 170, 0, 0.2);
        }
        
        .scraper-btn.clear:hover { 
            background: rgba(255, 170, 0, 0.2);
            box-shadow: 0 0 15px rgba(255, 170, 0, 0.4);
            transform: translateY(-1px);
        }
        
        .scraper-btn:disabled {
            opacity: 0.4;
            cursor: not-allowed;
            transform: none !important;
        }
        
        .scraper-progress {
            background: rgba(0, 0, 0, 0.3);
            border: 1px solid #00ff9d;
            border-radius: 6px;
            height: 10px;
            margin: 16px 0;
            overflow: hidden;
            box-shadow: inset 0 0 8px rgba(0, 255, 157, 0.1);
        }
        
        .scraper-progress-bar {
            height: 100%;
            background: linear-gradient(90deg, #00ff9d, #00cc7a);
            transition: width 0.4s ease;
            box-shadow: 0 0 8px rgba(0, 255, 157, 0.3);
        }
        
        .scraper-extracted {
            background: rgba(12, 12, 20, 0.7);
            border: 1px solid rgba(0, 255, 157, 0.15);
            border-radius: 8px;
            padding: 12px;
            margin-bottom: 16px;
            max-height: 120px;
            overflow-y: auto;
            box-shadow: inset 0 0 10px rgba(0, 255, 157, 0.05);
        }
        
        .scraper-extracted::-webkit-scrollbar {
            width: 6px;
        }
        
        .scraper-extracted::-webkit-scrollbar-thumb {
            background: #00ff9d;
            border-radius: 3px;
        }
        
        .scraper-extracted-title {
            font-size: 11px;
            color: #00cc7a;
            margin-bottom: 8px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            text-shadow: 0 0 4px rgba(0, 204, 122, 0.3);
        }
        
        .scraper-nums {
            display: flex;
            gap: 6px;
            flex-wrap: wrap;
        }
        
        .scraper-num-badge {
            width: 26px;
            height: 26px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 4px;
            font-weight: bold;
            font-size: 13px;
            font-family: 'Share Tech Mono', monospace;
            box-shadow: 0 0 6px currentColor;
            transition: all 0.2s ease;
        }
        
        .scraper-num-badge:hover {
            transform: scale(1.1);
        }
        
        .scraper-num-badge.big { 
            background: rgba(255, 50, 50, 0.15);
            color: #ff3232;
            border: 1px solid #ff3232;
        }
        
        .scraper-num-badge.small { 
            background: rgba(50, 150, 255, 0.15);
            color: #3296ff;
            border: 1px solid #3296ff;
        }
    `);

    function createPanel() {
        const div = document.createElement('div');
        div.id = 'scraper-panel';
        div.innerHTML = `
            <h3>
                📊 History Scraper
                <span class="scraper-status idle" id="scraper-status">IDLE</span>
            </h3>
            <div class="scraper-info">
                <div class="scraper-info-row">
                    <span class="scraper-info-label">Current Page:</span>
                    <span class="scraper-info-value" id="scraper-page">-</span>
                </div>
                <div class="scraper-info-row">
                    <span class="scraper-info-label">Total Results:</span>
                    <span class="scraper-info-value" id="scraper-count">0</span>
                </div>
                <div class="scraper-info-row">
                    <span class="scraper-info-label">Progress:</span>
                    <span class="scraper-info-value" id="scraper-progress-text">0%</span>
                </div>
            </div>
            <div class="scraper-progress">
                <div class="scraper-progress-bar" id="scraper-progress-bar" style="width: 0%"></div>
            </div>
            <div class="scraper-extracted">
                <div class="scraper-extracted-title">EXTRACTED FROM CURRENT PAGE:</div>
                <div class="scraper-nums" id="scraper-extracted-nums">
                    <span style="color:#64748b;font-size:11px;">No data yet</span>
                </div>
            </div>
            <button class="scraper-btn start" id="scraper-start">▶ START SCRAPING</button>
            <button class="scraper-btn stop" id="scraper-stop" style="display:none">■ STOP</button>
            <button class="scraper-btn download" id="scraper-download">💾 DOWNLOAD JSON</button>
            <button class="scraper-btn clear" id="scraper-clear">🗑️ CLEAR DATA</button>
        `;
        document.body.appendChild(div);

        // Event listeners
        document.getElementById('scraper-start').onclick = startScraping;
        document.getElementById('scraper-stop').onclick = stopScraping;
        document.getElementById('scraper-download').onclick = downloadData;
        document.getElementById('scraper-clear').onclick = clearData;

        // Load existing data
        loadData();
        updateUI();
    }

    function loadData() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                allResults = parsed.results || [];
                currentPage = parsed.nextPage || 1;
                log(`✅ Loaded ${allResults.length} results from storage. Next page: ${currentPage}`);
            }
        } catch (e) {
            log('⚠️ Failed to load data: ' + e.message);
        }
    }

    function saveData() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                results: allResults,
                nextPage: currentPage,
                lastUpdate: new Date().toISOString()
            }));
        } catch (e) {
            log('⚠️ Failed to save data: ' + e.message);
        }
    }

    function updateUI() {
        document.getElementById('scraper-page').textContent = `${currentPage}/${MAX_PAGES}`;
        document.getElementById('scraper-count').textContent = allResults.length;
        
        const progress = ((currentPage - 1) / MAX_PAGES) * 100;
        document.getElementById('scraper-progress-text').textContent = `${Math.round(progress)}%`;
        document.getElementById('scraper-progress-bar').style.width = `${progress}%`;
    }

    function displayExtractedNumbers(nums) {
        const container = document.getElementById('scraper-extracted-nums');
        if (!container) return;

        if (nums.length === 0) {
            container.innerHTML = '<span style="color:#64748b;font-size:11px;">No results</span>';
            return;
        }

        container.innerHTML = nums.map(n => {
            const isBig = n >= 5;
            return `<div class="scraper-num-badge ${isBig ? 'big' : 'small'}">${n}</div>`;
        }).join('');
    }

    function log(msg) {
        console.log(`[Scraper] ${msg}`);
    }

    function getPageResults() {
        const nums = Array.from(document.querySelectorAll('.record-body-num'))
            .map(e => parseInt(e.textContent.trim()))
            .filter(n => !isNaN(n) && n >= 0 && n <= 9);
        return nums;
    }

    function clickNextButton() {
        const nextBtn = document.querySelector('.record-foot-next');
        if (nextBtn) {
            nextBtn.click();
            return true;
        }
        return false;
    }

    async function scrapePage() {
        if (!isRunning) return;

        log(`Scraping page ${currentPage}...`);

        // Wait for content to load (maximum speed: 280ms)
        await new Promise(resolve => setTimeout(resolve, 280));

        const pageResults = getPageResults();
        
        // Display extracted numbers in UI
        displayExtractedNumbers(pageResults);
        
        if (pageResults.length === 0) {
            log('⚠️ No results found on page. Retrying...');
            await new Promise(resolve => setTimeout(resolve, 140));
            const retry = getPageResults();
            if (retry.length === 0) {
                log('❌ Still no results. Stopping.');
                stopScraping();
                return;
            }
            pageResults.push(...retry);
        }

        // Append to results (newest data at the end)
        allResults.push(...pageResults);
        log(`✅ Page ${currentPage}: Added ${pageResults.length} results. Total: ${allResults.length}`);

        // Save progress
        currentPage++;
        saveData();
        updateUI();

        // Check if done
        if (currentPage > MAX_PAGES) {
            log('🎉 All 51 pages scraped!');
            stopScraping();
            return;
        }

        // Click next and continue (maximum speed: 280ms)
        if (clickNextButton()) {
            log(`→ Moving to page ${currentPage}...`);
            // Wait for page transition (280ms)
            await new Promise(resolve => setTimeout(resolve, 280));
            scrapePage(); // Continue
        } else {
            log('❌ Next button not found. Stopping.');
            stopScraping();
        }
    }

    function startScraping() {
        if (isRunning) return;
        
        isRunning = true;
        // Reset to page 1 for each run
        currentPage = 1;
        document.getElementById('scraper-status').textContent = 'ACTIVE';
        document.getElementById('scraper-status').className = 'scraper-status active';
        document.getElementById('scraper-start').style.display = 'none';
        document.getElementById('scraper-stop').style.display = 'block';

        log('🚀 Starting scraper from page 1...');
        scrapePage();
    }

    function stopScraping() {
        isRunning = false;
        document.getElementById('scraper-status').textContent = 'IDLE';
        document.getElementById('scraper-status').className = 'scraper-status idle';
        document.getElementById('scraper-start').style.display = 'block';
        document.getElementById('scraper-stop').style.display = 'none';
        
        log('⏹️ Scraper stopped');
        updateUI();
    }

    function downloadData() {
        if (allResults.length === 0) {
            alert('No data to download!');
            return;
        }

        const dataStr = JSON.stringify({
            totalResults: allResults.length,
            pagesScraped: currentPage - 1,
            exportDate: new Date().toISOString(),
            results: allResults
        }, null, 2);

        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `amarclub_history_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);

        log(`💾 Downloaded ${allResults.length} results`);
    }

    function clearData() {
        if (!confirm(`Clear all ${allResults.length} results from storage?`)) {
            return;
        }

        localStorage.removeItem(STORAGE_KEY);
        allResults = [];
        currentPage = 1;
        updateUI();
        log('🗑️ Data cleared');
    }

    // Initialize
    setTimeout(() => {
        createPanel();
        log('📡 Scraper ready');
    }, 2000);

})();
