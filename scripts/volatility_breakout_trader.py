#!/usr/bin/env python3
"""
Volatility Breakout Trading Strategy Script
Hard-coded bankroll and bet amount - EDIT THESE VALUES:

BANKROLL = 1000  # Change this to test different bankroll sizes
STARTING_BET = 10  # Change this to test different bet amounts
"""

import json
import math
import statistics
from typing import List, Dict
from dataclasses import dataclass

# HARD-CODED PARAMETERS - EDIT THESE:
BANKROLL = 150  # <<<<<<<<< EDIT THIS VALUE
STARTING_BET = 150  # <<<<<<<<< EDIT THIS VALUE

@dataclass
class Trade:
    trade_number: int
    bet_type: str
    bet_amount: float
    result: int
    won: bool
    payout: float
    profit: float
    bankroll_before: float
    bankroll_after: float
    market_condition: str
    volatility: float
    recent_average: float

class VolatilityTrader:
    def __init__(self, initial_bankroll: float, starting_bet: float):
        self.initial_bankroll = initial_bankroll
        self.starting_bet = starting_bet
        self.current_bankroll = initial_bankroll
        self.session_bankroll = initial_bankroll
        
        # Load historical data
        with open('../data/data_flipped.json', 'r') as f:
            data = json.load(f)
        self.historical_results = data['results']
        
        self.trades = []
        self.doubles_count = 0
        self.bankruptcies = 0
        self.max_bankroll = initial_bankroll
        self.min_bankroll = initial_bankroll
        
    def check_bankroll_management(self):
        """Handle doubling and bankruptcy conditions"""
        if self.session_bankroll >= self.initial_bankroll * 2:
            self.doubles_count += 1
            self.session_bankroll = self.initial_bankroll
        elif self.session_bankroll < 1:
            self.bankruptcies += 1
            self.session_bankroll = self.initial_bankroll
            
    def get_bet_decision(self, history: List[int]) -> tuple:
        """Make trading decision based on volatility"""
        if len(history) < 10:
            return 'small', self.starting_bet, "Warming up - insufficient data"
            
        # Calculate volatility
        recent_changes = [abs(history[j] - history[j-1]) for j in range(len(history)-10, len(history))]
        current_volatility = statistics.stdev(recent_changes) if len(recent_changes) > 1 else 0
        
        # Make decision
        if current_volatility > 2.5:
            recent_avg = sum(history[-3:]) / 3
            if history[-1] > recent_avg:
                bet_type = 'big'
                condition = f"High volatility ({current_volatility:.2f}) - uptrend"
            else:
                bet_type = 'small'
                condition = f"High volatility ({current_volatility:.2f}) - downtrend"
        else:
            bet_type = 'small'
            condition = f"Low volatility ({current_volatility:.2f}) - consolidation"
            
        bet_amount = min(self.starting_bet, self.session_bankroll)
        bet_amount = math.floor(bet_amount)
        if bet_amount < 1:
            bet_amount = 1
            
        return bet_type, bet_amount, condition
        
    def execute_trade(self, bet_type: str, bet_amount: float, result: int) -> tuple:
        """Execute single trade and return results"""
        if self.session_bankroll < bet_amount:
            return 0, 0, False
            
        self.session_bankroll -= bet_amount
        contract_amount = bet_amount * 0.98
        
        if bet_type == 'big' and result in [5,6,7,8,9]:
            payout = contract_amount * 2
            won = True
        elif bet_type == 'small' and result in [0,1,2,3,4]:
            payout = contract_amount * 2
            won = True
        else:
            payout = 0
            won = False
            
        self.session_bankroll += payout
        self.current_bankroll += (payout - bet_amount)
        
        return payout, (payout - bet_amount), won
        
    def run_strategy(self, max_trades: int = 2000):
        """Run the complete trading strategy"""
        print(f"🎲 RUNNING VOLATILITY BREAKOUT STRATEGY")
        print(f"Bankroll: {self.initial_bankroll} Taka")
        print(f"Starting Bet: {self.starting_bet} Taka")
        print(f"Processing {min(len(self.historical_results), max_trades)} trades...")
        print("-" * 50)
        
        history = []
        
        for i in range(min(len(self.historical_results), max_trades)):
            result = self.historical_results[i]
            history.append(result)
            
            # Check bankroll management
            self.check_bankroll_management()
            
            # Get trading decision
            bet_type, bet_amount, market_condition = self.get_bet_decision(history)
            
            # Record state before trade
            bankroll_before = self.current_bankroll
            
            # Execute trade
            payout, profit, won = self.execute_trade(bet_type, bet_amount, result)
            
            # Update tracking
            self.max_bankroll = max(self.max_bankroll, self.current_bankroll)
            self.min_bankroll = min(self.min_bankroll, self.current_bankroll)
            
            # Record trade
            trade = Trade(
                trade_number=i+1,
                bet_type=bet_type,
                bet_amount=bet_amount,
                result=result,
                won=won,
                payout=payout,
                profit=profit,
                bankroll_before=bankroll_before,
                bankroll_after=self.current_bankroll,
                market_condition=market_condition,
                volatility=float(statistics.stdev([abs(history[j] - history[j-1]) for j in range(len(history)-10, len(history))]) if len(history) >= 10 else 0),
                recent_average=float(sum(history[-3:])/3 if len(history) >= 3 else 0)
            )
            self.trades.append(trade)
            
            # Progress indicator
            if (i+1) % 500 == 0:
                print(f"Progress: {i+1}/{min(len(self.historical_results), max_trades)} trades")
        
        # Save results
        self.save_trading_logs()
        self.print_summary()
        
    def save_trading_logs(self):
        """Save pure JSON trading logs"""
        trade_records = []
        for trade in self.trades:
            trade_records.append({
                "trade_number": trade.trade_number,
                "bet_type": trade.bet_type,
                "bet_amount": float(trade.bet_amount),
                "result": trade.result,
                "won": trade.won,
                "payout": float(trade.payout),
                "profit": float(trade.profit),
                "bankroll_before": float(trade.bankroll_before),
                "bankroll_after": float(trade.bankroll_after),
                "market_condition": trade.market_condition,
                "volatility": float(trade.volatility),
                "recent_average": float(trade.recent_average)
            })
        
        output_data = {
            "strategy": "Volatility_Breakout",
            "initial_bankroll": self.initial_bankroll,
            "starting_bet": self.starting_bet,
            "total_trades": len(self.trades),
            "final_bankroll": float(self.current_bankroll),
            "total_profit": float(self.current_bankroll - self.initial_bankroll),
            "roi_percentage": float(((self.current_bankroll - self.initial_bankroll) / self.initial_bankroll) * 100),
            "doubles_count": self.doubles_count,
            "bankruptcies": self.bankruptcies,
            "max_bankroll": float(self.max_bankroll),
            "min_bankroll": float(self.min_bankroll),
            "trades": trade_records
        }
        
        with open(f'../data/volatility_trading_logs_{int(self.initial_bankroll)}_{int(self.starting_bet)}.json', 'w') as f:
            json.dump(output_data, f, indent=2)
            
        print(f"💾 Trading logs saved to: ../data/volatility_trading_logs_{int(self.initial_bankroll)}_{int(self.starting_bet)}.json")
        
    def print_summary(self):
        """Print strategy performance summary"""
        print("\n" + "="*60)
        print("STRATEGY PERFORMANCE SUMMARY")
        print("="*60)
        print(f"Initial Bankroll: {self.initial_bankroll} Taka")
        print(f"Final Bankroll: {self.current_bankroll:.2f} Taka")
        print(f"Total Profit: {self.current_bankroll - self.initial_bankroll:+.2f} Taka")
        print(f"ROI: {((self.current_bankroll - self.initial_bankroll) / self.initial_bankroll) * 100:+.1f}%")
        print(f"Doubles Achieved: {self.doubles_count}")
        print(f"Bankruptcies: {self.bankruptcies}")
        print(f"Maximum Bankroll: {self.max_bankroll:.2f} Taka")
        print(f"Minimum Bankroll: {self.min_bankroll:.2f} Taka")
        print(f"Total Trades: {len(self.trades)}")

def main():
    # Initialize trader with hard-coded values
    trader = VolatilityTrader(BANKROLL, STARTING_BET)
    trader.run_strategy()

if __name__ == "__main__":
    main()