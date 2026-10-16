// ==UserScript==
// @name         AmarClub History Display
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Displays historical results from AmarClub in a floating overlay
// @author       Qoder
// @match        https://amarclub.net/*
// @match        https://*.amarclub.net/*
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    // Styles for the overlay
    GM_addStyle(`
        #history-overlay {
            position: fixed;
            top: 20px;
            left: 20px;
            background: rgba(15, 23, 42, 0.9);
            border: 1px solid #334155;
            border-radius: 12px;
            padding: 12px;
            z-index: 1000000;
            font-family: sans-serif;
            color: white;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            min-width: 150px;
            pointer-events: none;
        }
        .history-title {
            font-size: 12px;
            color: #94a3b8;
            margin-bottom: 8px;
            text-align: center;
            font-weight: bold;
        }
        .history-list {
            display: flex;
            flex-direction: column;
            gap: 4px;
        }
        .history-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 4px 8px;
            border-radius: 4px;
            background: #1e293b;
        }
        .history-num {
            font-weight: bold;
            font-size: 14px;
        }
        .history-label {
            font-size: 10px;
            padding: 2px 6px;
            border-radius: 4px;
            text-transform: uppercase;
        }
        .type-big { background: #f97316; color: white; }
        .type-small { background: #3b82f6; color: white; }
    `);

    function createOverlay() {
        const div = document.createElement('div');
        div.id = 'history-overlay';
        div.innerHTML = `
            <div class="history-title">LATEST RESULTS</div>
            <div id="history-content" class="history-list">
                <div style="color: #64748b; font-size: 11px;">Scanning...</div>
            </div>
        `;
        document.body.appendChild(div);
    }

    function updateHistory() {
        const nums = Array.from(document.querySelectorAll('.record-body-num'))
            .map(e => parseInt(e.textContent.trim()))
            .filter(n => !isNaN(n));

        const container = document.getElementById('history-content');
        if (!container) return;

        if (nums.length === 0) {
            container.innerHTML = '<div style="color: #64748b; font-size: 11px;">No data found</div>';
            return;
        }

        // Show latest 10
        container.innerHTML = nums.slice(0, 10).map((n, i) => {
            const isBig = n >= 5;
            return `
                <div class="history-item" style="opacity: ${1 - (i * 0.08)}">
                    <span class="history-num">${n}</span>
                    <span class="history-label ${isBig ? 'type-big' : 'type-small'}">
                        ${isBig ? 'Big' : 'Small'}
                    </span>
                </div>
            `;
        }).join('');
    }

    // Initialize
    setTimeout(() => {
        createOverlay();
        setInterval(updateHistory, 1000);
    }, 2000);

})();
