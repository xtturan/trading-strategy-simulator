#!/usr/bin/env python3
"""
Complete Trade Log Generator for Top 2 Strategies
Generates ALL trades taken by Volatility Breakout and Trend Following strategies
"""

import json
import math
from typing import List, Dict, Tuple
from dataclasses import dataclass
from collections import defaultdict
import statistics

@dataclass
class TradeRecord:
    trade_number: int
    bet_type: str
    bet_amount: float
    result: int
    won: bool
    payout: float
    profit: float
    bankroll_before: float
    bankroll_after: float
    strategy_state: dict
    market_condition: str

class CompleteTradeLogger:
    def __init__(self, data_file: str = '../data/data_flipped.json'):
        with open(data_file, 'r') as f:
            self.data = json.load(f)
        self.results = self.data['results']
        print(f"Loaded {len(self.results)} historical results")
        
    def run_volatility_breakout_full(self):
        """Run Volatility Breakout strategy on all 2000 trades"""
        print("🏃 Running Volatility Breakout strategy on all trades...")
        
        bankroll = 300.0
        history = []
        trades = []
        volatility_window = 10
        
        for i in range(len(self.results)):
            result = self.results[i]
            history.append(result)
            current_volatility = 0  # Initialize here
            
            if len(history) < volatility_window:
                bet_type = 'small'
                bet_amount = 1.0
                market_condition = "Warming up - insufficient data"
                recent_avg = 0
            else:
                recent_changes = [abs(history[j] - history[j-1]) for j in range(len(history)-volatility_window+1, len(history))]
                current_volatility = statistics.stdev(recent_changes) if len(recent_changes) > 1 else 0
                
                if current_volatility > 2.5:
                    recent_avg = sum(history[-3:]) / 3
                    current_result = history[-1]
                    
                    if current_result > recent_avg:
                        bet_type = 'big'
                        market_condition = f"High volatility ({current_volatility:.2f}) - uptrend"
                    else:
                        bet_type = 'small'
                        market_condition = f"High volatility ({current_volatility:.2f}) - downtrend"
                else:
                    bet_type = 'small'
                    market_condition = f"Low volatility ({current_volatility:.2f}) - consolidation"
                    recent_avg = sum(history[-3:]) / 3 if len(history) >= 3 else 0
                
                bet_amount = 1.0
            
            # Calculate outcome
            contract_amount = bet_amount * 0.98
            if bet_type == 'big':
                payout = contract_amount * 2 if result in [5,6,7,8,9] else 0
            elif bet_type == 'small':
                payout = contract_amount * 2 if result in [0,1,2,3,4] else 0
            else:
                payout = 0
                
            won = payout > 0
            profit = payout - bet_amount
            bankroll_before = bankroll
            bankroll += profit
            
            trade = TradeRecord(
                trade_number=i+1,
                bet_type=bet_type,
                bet_amount=bet_amount,
                result=result,
                won=won,
                payout=payout,
                profit=profit,
                bankroll_before=bankroll_before,
                bankroll_after=bankroll,
                strategy_state={
                    'volatility': current_volatility,
                    'recent_avg': recent_avg,
                    'current_result': result
                },
                market_condition=market_condition
            )
            trades.append(trade)
            
            # Progress indicator
            if (i+1) % 500 == 0:
                print(f"Progress: {i+1}/2000 trades completed")
                
        print(f"✅ Volatility Breakout completed - Final bankroll: {bankroll:.2f} Taka")
        return trades

    def run_trend_following_full(self):
        """Run Trend Following strategy on all 2000 trades"""
        print("🏃 Running Trend Following strategy on all trades...")
        
        bankroll = 300.0
        history = []
        trades = []
        short_window = 3
        long_window = 8
        
        for i in range(len(self.results)):
            result = self.results[i]
            history.append(result)
            
            if len(history) < long_window:
                bet_type = 'small'
                bet_amount = 1.0
                market_condition = "Building trend data"
                short_ma = 0
                long_ma = 0
                ma_diff = 0
            else:
                short_ma = sum(history[-short_window:]) / short_window
                long_ma = sum(history[-long_window:]) / long_window
                ma_diff = short_ma - long_ma
                
                if short_ma > long_ma + 1:
                    bet_type = 'big'
                    market_condition = f"Bullish trend (MA diff: {ma_diff:+.2f})"
                elif short_ma < long_ma - 1:
                    bet_type = 'small'
                    market_condition = f"Bearish trend (MA diff: {ma_diff:+.2f})"
                else:
                    bet_type = 'small'
                    market_condition = f"Consolidation (MA diff: {ma_diff:+.2f})"
                
                bet_amount = 1.0
            
            # Calculate outcome
            contract_amount = bet_amount * 0.98
            if bet_type == 'big':
                payout = contract_amount * 2 if result in [5,6,7,8,9] else 0
            elif bet_type == 'small':
                payout = contract_amount * 2 if result in [0,1,2,3,4] else 0
            else:
                payout = 0
                
            won = payout > 0
            profit = payout - bet_amount
            bankroll_before = bankroll
            bankroll += profit
            
            trade = TradeRecord(
                trade_number=i+1,
                bet_type=bet_type,
                bet_amount=bet_amount,
                result=result,
                won=won,
                payout=payout,
                profit=profit,
                bankroll_before=bankroll_before,
                bankroll_after=bankroll,
                strategy_state={
                    'short_ma': short_ma,
                    'long_ma': long_ma,
                    'ma_difference': ma_diff
                },
                market_condition=market_condition
            )
            trades.append(trade)
            
            # Progress indicator
            if (i+1) % 500 == 0:
                print(f"Progress: {i+1}/2000 trades completed")
                
        print(f"✅ Trend Following completed - Final bankroll: {bankroll:.2f} Taka")
        return trades

    def save_complete_logs(self, volatility_trades: List[TradeRecord], trend_trades: List[TradeRecord]):
        """Save complete trade logs to JSON file"""
        print("💾 Saving complete trade logs...")
        
        # Convert to JSON-serializable format
        volatility_data = []
        for trade in volatility_trades:
            volatility_data.append({
                'trade_number': trade.trade_number,
                'bet_type': trade.bet_type,
                'bet_amount': float(trade.bet_amount),
                'result': trade.result,
                'won': trade.won,
                'payout': float(trade.payout),
                'profit': float(trade.profit),
                'bankroll_before': float(trade.bankroll_before),
                'bankroll_after': float(trade.bankroll_after),
                'market_condition': trade.market_condition,
                'volatility': float(trade.strategy_state['volatility']),
                'recent_average': float(trade.strategy_state['recent_avg']) if trade.strategy_state['recent_avg'] != 0 else 0
            })
            
        trend_data = []
        for trade in trend_trades:
            trend_data.append({
                'trade_number': trade.trade_number,
                'bet_type': trade.bet_type,
                'bet_amount': float(trade.bet_amount),
                'result': trade.result,
                'won': trade.won,
                'payout': float(trade.payout),
                'profit': float(trade.profit),
                'bankroll_before': float(trade.bankroll_before),
                'bankroll_after': float(trade.bankroll_after),
                'market_condition': trade.market_condition,
                'short_ma': float(trade.strategy_state['short_ma']),
                'long_ma': float(trade.strategy_state['long_ma']),
                'ma_difference': float(trade.strategy_state['ma_difference'])
            })
        
        complete_logs = {
            'Volatility_Breakout_All_Trades': volatility_data,
            'Trend_Following_All_Trades': trend_data,
            'summary': {
                'total_trades': len(self.results),
                'volatility_breakout_final_bankroll': volatility_data[-1]['bankroll_after'] if volatility_data else 0,
                'trend_following_final_bankroll': trend_data[-1]['bankroll_after'] if trend_data else 0,
                'volatility_breakout_total_profit': volatility_data[-1]['bankroll_after'] - 300 if volatility_data else 0,
                'trend_following_total_profit': trend_data[-1]['bankroll_after'] - 300 if trend_data else 0
            }
        }
        
        with open('../data/complete_trade_logs_all_strategies.json', 'w') as f:
            json.dump(complete_logs, f, indent=2)
            
        print("✅ Complete trade logs saved to ../data/complete_trade_logs_all_strategies.json")
        return complete_logs

    def display_sample_trades(self, logs: dict):
        """Display sample trades from both strategies"""
        print("\n" + "="*100)
        print("SAMPLE TRADES FROM BOTH STRATEGIES")
        print("="*100)
        
        # Display first 20 trades from each strategy
        print("\n📊 VOLATILITY BREAKOUT SAMPLE TRADES (First 20):")
        print("-"*100)
        print(f"{'Trade':<6} {'Condition':<25} {'Bet':<6} {'Result':<8} {'Won':<6} {'Profit':<10} {'Bankroll':<10}")
        print("-"*100)
        
        vol_trades = logs['Volatility_Breakout_All_Trades'][:20]
        wins = 0
        for trade in vol_trades:
            won_symbol = "✅" if trade['won'] else "❌"
            if trade['won']:
                wins += 1
            print(f"{trade['trade_number']:<6} {trade['market_condition'][:22]:<25} {trade['bet_type']:<6} "
                  f"{trade['result']:<8} {won_symbol:<6} {trade['profit']:<10.2f} {trade['bankroll_after']:<10.2f}")
        print(f"Win rate: {wins}/20 = {wins/20*100:.1f}%")
        
        print("\n📊 TREND FOLLOWING SAMPLE TRADES (First 20):")
        print("-"*100)
        print(f"{'Trade':<6} {'Condition':<25} {'Bet':<6} {'Result':<8} {'Won':<6} {'Profit':<10} {'Bankroll':<10}")
        print("-"*100)
        
        trend_trades = logs['Trend_Following_All_Trades'][:20]
        wins = 0
        for trade in trend_trades:
            won_symbol = "✅" if trade['won'] else "❌"
            if trade['won']:
                wins += 1
            print(f"{trade['trade_number']:<6} {trade['market_condition'][:22]:<25} {trade['bet_type']:<6} "
                  f"{trade['result']:<8} {won_symbol:<6} {trade['profit']:<10.2f} {trade['bankroll_after']:<10.2f}")
        print(f"Win rate: {wins}/20 = {wins/20*100:.1f}%")

def main():
    print("🎲 COMPLETE TRADE LOG GENERATOR")
    print("="*40)
    
    logger = CompleteTradeLogger('../data/data_flipped.json')
    
    # Run both strategies on all trades
    volatility_trades = logger.run_volatility_breakout_full()
    trend_trades = logger.run_trend_following_full()
    
    # Save complete logs
    complete_logs = logger.save_complete_logs(volatility_trades, trend_trades)
    
    # Display samples
    logger.display_sample_trades(complete_logs)
    
    print(f"\n🎯 COMPLETE TRADE LOGS GENERATED SUCCESSFULLY!")
    print(f"File: ../data/complete_trade_logs_all_strategies.json")
    print(f"Contains ALL {len(logger.results)} trades from both strategies")

if __name__ == "__main__":
    main()