#!/usr/bin/env python3
"""
Display Complete Trade Logs - Clean View
Shows all individual trades from both top strategies
"""

import json

def display_complete_trades():
    print("🎯 COMPLETE TRADE LOGS FOR TOP 2 STRATEGIES")
    print("="*80)
    
    # Load the complete trade logs
    with open('../data/complete_trade_logs_all_strategies.json', 'r') as f:
        data = json.load(f)
    
    vol_trades = data['Volatility_Breakout_All_Trades']
    trend_trades = data['Trend_Following_All_Trades']
    
    print(f"📊 TOTAL TRADES PROCESSED: {len(vol_trades)}")
    print(f"💰 FINAL RESULTS:")
    print(f"   Volatility Breakout: {vol_trades[-1]['bankroll_after']:.2f} Taka ({vol_trades[-1]['bankroll_after']-300:+.2f})")
    print(f"   Trend Following: {trend_trades[-1]['bankroll_after']:.2f} Taka ({trend_trades[-1]['bankroll_after']-300:+.2f})")
    
    print(f"\n📈 KEY VOLATILITY BREAKOUT TRADES:")
    print("-"*80)
    print(f"{'Trade':<6} {'Condition':<25} {'Bet':<6} {'Result':<8} {'Won':<6} {'Profit':<10} {'Bankroll':<10}")
    print("-"*80)
    
    # Show key trades where strategy made active decisions
    key_vol_trades = []
    for trade in vol_trades:
        if "High volatility" in trade['market_condition'] or trade['trade_number'] <= 20:
            key_vol_trades.append(trade)
        if len(key_vol_trades) >= 30:
            break
    
    wins = 0
    for trade in key_vol_trades:
        won_symbol = "✅" if trade['won'] else "❌"
        if trade['won']:
            wins += 1
        print(f"{trade['trade_number']:<6} {trade['market_condition'][:22]:<25} {trade['bet_type']:<6} "
              f"{trade['result']:<8} {won_symbol:<6} {trade['profit']:<10.2f} {trade['bankroll_after']:<10.2f}")
    
    print(f"Win rate: {wins}/{len(key_vol_trades)} = {wins/len(key_vol_trades)*100:.1f}%")
    
    print(f"\n📈 KEY TREND FOLLOWING TRADES:")
    print("-"*80)
    print(f"{'Trade':<6} {'Condition':<25} {'Bet':<6} {'Result':<8} {'Won':<6} {'Profit':<10} {'Bankroll':<10}")
    print("-"*80)
    
    # Show key trades where strategy made active decisions
    key_trend_trades = []
    for trade in trend_trades:
        if "Bullish trend" in trade['market_condition'] or "Bearish trend" in trade['market_condition'] or trade['trade_number'] <= 20:
            key_trend_trades.append(trade)
        if len(key_trend_trades) >= 30:
            break
    
    wins = 0
    for trade in key_trend_trades:
        won_symbol = "✅" if trade['won'] else "❌"
        if trade['won']:
            wins += 1
        print(f"{trade['trade_number']:<6} {trade['market_condition'][:22]:<25} {trade['bet_type']:<6} "
              f"{trade['result']:<8} {won_symbol:<6} {trade['profit']:<10.2f} {trade['bankroll_after']:<10.2f}")
    
    print(f"Win rate: {wins}/{len(key_trend_trades)} = {wins/len(key_trend_trades)*100:.1f}%")
    
    # Show some specific profitable trades
    print(f"\n💎 SPECIFIC PROFITABLE TRADES:")
    print("-"*80)
    
    print("VOLATILITY BREAKOUT - HIGH VOLATILITY TRADES:")
    profitable_vol = [t for t in vol_trades if t['won'] and "High volatility" in t['market_condition']]
    for trade in profitable_vol[:10]:
        print(f"Trade {trade['trade_number']:>3}: {trade['market_condition']} → {trade['bet_type'].upper()} → Result {trade['result']} ✅ +{trade['profit']:.2f}")
    
    print("\nTREND FOLLOWING - TREND SIGNAL TRADES:")
    profitable_trend = [t for t in trend_trades if t['won'] and ("Bullish trend" in t['market_condition'] or "Bearish trend" in t['market_condition'])]
    for trade in profitable_trend[:10]:
        print(f"Trade {trade['trade_number']:>3}: {trade['market_condition']} → {trade['bet_type'].upper()} → Result {trade['result']} ✅ +{trade['profit']:.2f}")

def main():
    display_complete_trades()

if __name__ == "__main__":
    main()