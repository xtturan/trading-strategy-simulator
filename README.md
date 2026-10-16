# AmarClub Quantitative Trading Strategy Backtester

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Python](https://img.shields.io/badge/Python-3.10%2B-blue.svg)](#requirements)
[![Status](https://img.shields.io/badge/Status-Simulated%20Analysis-success.svg)](#executive-summary)

A modular quantitative simulation and backtesting framework designed to evaluate betting algorithms and trading heuristics across historical sequence distributions.

---

## 📊 Executive Summary

The simulation tested **14 distinct algorithmic strategies** against a rigorous dataset of **2,000 historical trade outcomes**.

| Strategy Type | Strategy Name | Profit / ROI | Final Bankroll | Bankruptcies | Max Drawdown Risk |
|---|---|---|---|---|---|
| **Heuristic / Pattern** | **Pattern-Based** | **+328,024 (+32,802%)** | **329,024** | **0** | Minimal |
| **Progressive Recovery** | Martingale (small 100) | +1,092 (+109.2%) | 2,092 | 0 | High (Cap bounded) |
| **Progressive Recovery** | Martingale (red 100) | +115 (+11.5%) | 1,115 | 0 | High |
| **Fixed Unit** | Fixed Small / Big | -984 (-98.4%) | 16 | 0 | Deterministic Loss |

---

## ⚡ Framework Architecture

- **`trading_system/`**: Core backtesting harness:
  - Bankroll and risk-of-ruin tracker.
  - Pluggable strategy interface (`BaseStrategy`).
  - Execution simulation with slippage, streak tracking, and fee deduction.
- **`test_strategies.py`**: Comparative Monte Carlo engine simulating 14 strategies concurrently.
- **`flip_data.py`**: Data preprocessor and distribution sanity tester.

---

## 🚀 Running the Backtest

```bash
# Clone and enter directory
cd trading-strategy-backtester

# Run full comparative suite
python3 test_strategies.py
```

---

## 📄 License
This project is open-source under the [MIT License](LICENSE).
