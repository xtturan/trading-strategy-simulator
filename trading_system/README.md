# Trading System Architecture

A clean, professional trading system with separate server and client components.

## 📁 Structure

```
trading_system/
├── server/                 # Python FastAPI backend
│   ├── main.py            # Main API server
│   ├── requirements.txt   # Python dependencies
│   └── strategies/        # Trading strategies (future)
├── client/                # Tampermonkey userscript
│   └── trading_client.js  # Clean frontend client
├── data/                  # JSON data storage
│   └── trades.json        # Historical trade data
└── README.md             # This file
```

## 🚀 Setup Instructions

### 1. Install Server Dependencies
```bash
cd server
pip install -r requirements.txt
```

### 2. Start the Server
```bash
cd server
python main.py
```
Server will run on `http://localhost:3001`

### 3. Install Client
- Open Tampermonkey extension
- Create new script
- Copy contents of `client/trading_client.js`
- Save and enable the script

### 4. Usage
1. Navigate to amarclub.net
2. The client UI will appear in top-right corner
3. Click "START" to begin automated trading
4. Use "SYNC DATA" to manually sync results
5. Use "MANUAL BET" for single trades

## 🔧 API Endpoints

### GET `/api/data`
Get all trade data

### POST `/api/data?number={n}`
Add single trade result

### POST `/api/data/bulk`
Add multiple trade results
Body: `[1, 5, 3, 7, ...]`

### GET `/api/strategy/volatility-breakout`
Get volatility breakout trading signal

### POST `/api/bet`
Place a bet (integration point)

## 🎯 Features

- **Clean separation** of concerns (server/client)
- **Reliable data persistence** via JSON files
- **Professional UI** with clear status indicators
- **Robust error handling** and logging
- **Modular architecture** for easy extension
- **RESTful API** design for future integrations

## 🛠️ Configuration

Edit these values in `client/trading_client.js`:
- `BANKROLL` - Starting bankroll (default: 300)
- `BASE_BET` - Base bet amount (default: 2)
- `SERVER_URL` - API server URL (default: localhost:3001)

## 📊 Data Flow

1. Client extracts data from webpage
2. Sends to server via REST API
3. Server stores in JSON file
4. Server analyzes data and generates signals
5. Client receives signals and places bets
6. Results are automatically synced back to server

## 🔒 Security Note

This is designed for local development. For production use:
- Add authentication to API
- Use HTTPS
- Implement proper rate limiting
- Add input validation