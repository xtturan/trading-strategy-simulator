from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import json
import os
from datetime import datetime

app = FastAPI(title="Trading System API")

# Data file path
DATA_FILE = "../data/trades.json"

class Trade(BaseModel):
    id: int
    timestamp: str
    number: int
    bet_type: Optional[str] = None
    bet_amount: Optional[float] = None
    result: Optional[str] = None
    profit: Optional[float] = None

class BetRequest(BaseModel):
    bet_type: str  # "SMALL" or "BIG"
    amount: float

# Initialize data file
def init_data_file():
    if not os.path.exists(DATA_FILE):
        os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
        with open(DATA_FILE, 'w') as f:
            json.dump([], f)

# Load data
def load_data():
    try:
        with open(DATA_FILE, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        init_data_file()
        return []

# Save data
def save_data(data):
    with open(DATA_FILE, 'w') as f:
        json.dump(data, f, indent=2)

@app.get("/")
async def root():
    return {"message": "Trading System API Running"}

@app.get("/api/data")
async def get_data():
    """Get all trade data"""
    data = load_data()
    return {"data": data, "count": len(data)}

@app.post("/api/data")
async def add_trade(number: int):
    """Add new trade result"""
    data = load_data()
    
    new_trade = {
        "id": len(data) + 1,
        "timestamp": datetime.now().isoformat(),
        "number": number
    }
    
    data.append(new_trade)
    save_data(data)
    
    return {"message": "Trade added", "trade": new_trade}

@app.post("/api/data/bulk")
async def add_bulk_trades(numbers: List[int]):
    """Add multiple trade results"""
    data = load_data()
    
    for number in numbers:
        new_trade = {
            "id": len(data) + 1,
            "timestamp": datetime.now().isoformat(),
            "number": number
        }
        data.append(new_trade)
    
    save_data(data)
    return {"message": f"Added {len(numbers)} trades", "count": len(data)}

@app.delete("/api/data/{trade_id}")
async def delete_trade(trade_id: int):
    """Delete specific trade"""
    data = load_data()
    
    # Find and remove trade
    original_length = len(data)
    data = [trade for trade in data if trade["id"] != trade_id]
    
    if len(data) == original_length:
        raise HTTPException(status_code=404, detail="Trade not found")
    
    # Re-index IDs
    for i, trade in enumerate(data):
        trade["id"] = i + 1
    
    save_data(data)
    return {"message": "Trade deleted", "remaining_count": len(data)}

@app.post("/api/bet")
async def place_bet(bet_request: BetRequest):
    """Place a bet (returns success/failure)"""
    # This would integrate with the actual betting system
    return {
        "success": True,
        "bet_type": bet_request.bet_type,
        "amount": bet_request.amount,
        "timestamp": datetime.now().isoformat()
    }

@app.get("/api/strategy/volatility-breakout")
async def get_volatility_breakout_signal():
    """Get volatility breakout trading signal"""
    data = load_data()
    
    if len(data) < 10:
        return {
            "should_trade": False,
            "bet_type": None,
            "confidence": 0,
            "reason": "Insufficient data"
        }
    
    # Extract numbers for analysis
    numbers = [trade["number"] for trade in data[-20:]]  # Last 20 trades
    
    # Simple volatility breakout logic
    recent_mean = sum(numbers[-10:]) / 10
    volatility = sum(abs(numbers[i] - numbers[i-1]) for i in range(1, len(numbers))) / (len(numbers) - 1)
    
    last_number = numbers[-1]
    
    if volatility > 2.0:  # High volatility threshold
        if last_number >= 5:
            bet_type = "BIG"
            confidence = 0.7
            reason = f"High volatility ({volatility:.2f}) + last result {last_number} >= 5"
        else:
            bet_type = "SMALL"
            confidence = 0.7
            reason = f"High volatility ({volatility:.2f}) + last result {last_number} < 5"
    elif last_number >= 5:
        bet_type = "BIG"
        confidence = 0.6
        reason = f"Last result {last_number} >= 5"
    else:
        bet_type = "SMALL"
        confidence = 0.6
        reason = f"Last result {last_number} < 5"
    
    return {
        "should_trade": True,
        "bet_type": bet_type,
        "confidence": confidence,
        "reason": reason,
        "volatility": volatility,
        "recent_mean": recent_mean
    }

if __name__ == "__main__":
    import uvicorn
    init_data_file()
    uvicorn.run(app, host="0.0.0.0", port=3001)