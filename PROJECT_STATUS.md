# AmarClub Trading Bot Documentation

## Context
The project consists of a Tampermonkey userscript (`tradingbot.js`) designed to automate trading on the AmarClub website. It interacts with a prediction server to place bets based on algorithmic forecasts.

## Project Details
- **Main Website**: [AmarClub](https://amarclub.net/)
- **Target Subdomains**: `*.amarclub.net`
- **Game Logic**: 30-second rounds of "Big/Small" predictions.
- **API Server**: `http://100.116.92.28:3001`

## Key Findings from Comments & Code

### DOM Structure & Selectors
| Component | Selector | Notes |
|-----------|----------|-------|
| Countdown Timer | `.TimeLeft__C-time > div` | Individual digits and separator |
| Historical Results | `.record-body-num` | Numbers 0-9 |
| Big Bet Button | `.Betting__C-foot-b` | Triggers bet modal |
| Small Bet Button | `.Betting__C-foot-s` | Triggers bet modal |
| Amount Input | `input[type="number"]` | Visible in modal |
| Confirm Big | `.bet-amount.n_big` | Finalizes bet |
| Confirm Small | `.bet-amount.n_small` | Finalizes bet |

### Logic & Features
- **Timing Windows**:
    - **29s - 27s**: Data synchronization with server.
    - **25s - 23s**: Result verification of last round.
    - **20s - 16s**: Fetching prediction from API.
    - **12s - 6s**: Placing the bet on the page.
- **Strategy**: Martingale (doubles bet on loss, resets on win).
- **Background Execution**: Uses a Web Worker to bypass browser tab throttling.

## Reusable Components for Future Scripts
The following patterns can be extracted for other automation tasks on similar sites:

1. **Background-Safe Timer**:
   ```javascript
   function createTimerWorker() {
       const workerCode = `...setInterval(...)`;
       const blob = new Blob([workerCode], { type: 'application/javascript' });
       return new Worker(URL.createObjectURL(blob));
   }
   ```
2. **Framework-Aware Input Injection**:
   Using `dispatchEvent` for `input`, `change`, and `compositionend` ensures that Vue/React states are updated when script-injecting values.
3. **History Overlap Sync**:
   Logic to compare local arrays with server arrays to find the "join point" and only upload new entries.
4. **Multi-Step UI Automation**:
   Promise-based sequence using `setTimeout` to handle asynchronous DOM appearances (modals, animations).

## Actions Taken
- Read and analyzed `tradingbot.js` implementation.
- Identified API endpoints and communication patterns.
- Extracted DOM selectors for UI interaction.
- Documented reusable architectural patterns (Web Workers, Framework interaction).
- Developed `history_display.js` to extract and visualize historical results in real-time.
- Created `history_scraper.js` with localStorage-based 50-page scraping (always starts from page 1) and resume capability.
- Enhanced scraper with maximum 280ms interval speed and real-time extracted numbers display.
- Redesigned UI with mature cyberpunk aesthetic (dark theme, teal accents, professional terminal font).
- Created `flip_data.py` utility to reverse data.json order (oldest first, newest last).
- Developed `trading_strategy_simulator.py` to benchmark trading strategies against historical data.
- Enhanced simulator to track detailed bet-by-bet information for Pattern_Based strategy.
- Added comprehensive trade logging including bet amounts, results, payouts, and bankroll changes.
- Fixed decimal handling: betting amounts are whole numbers, bankroll maintains decimal precision.
- Removed all other benchmark files, keeping only Pattern_Based strategy results.
- Organized project files into structured folders:
  - `scripts/`: All JavaScript and Python scripts
  - `data/`: JSON data files and benchmark results
  - `docs/`: Documentation and analysis reports
  - `results/`: Reserved for future output files

## Current Status
- **Analysis**: Complete
- **Documentation**: Updated with all script implementations and utilities
- **Organized Structure**:
  - `scripts/`: Contains all executable scripts
    - `tradingbot.js`: Main automation engine with prediction API integration
    - `history_display.js`: Real-time visual overlay for tracking current results
    - `history_scraper.js`: Multi-page scraper (50 pages) with reload-resilient localStorage persistence
    - `flip_data.py`: Utility to reverse data order in data.json
    - `trading_strategy_simulator.py`: Enhanced strategy benchmarking tool with detailed trade tracking
  - `data/`: Contains JSON data files and benchmark results
    - `data_flipped.json`: Historical trading data (oldest first)
    - `detailed_trade_logs.json`: Comprehensive trade-by-trade logs for top 3 strategies
    - `trade_summary_report.json`: Statistical summaries of trading performance
    - `strategy_benchmark_results_detailed.json`: Complete benchmark results
  - `docs/`: Contains documentation and analysis reports
    - `strategy_analysis_report_300taka.md`: Main strategy analysis
    - `detailed_trade_analysis.md`: In-depth trade-by-trade breakdown
  - `results/`: Reserved for future output files
- **Next Steps**: Ready to assist with further enhancements or new script requirements.
