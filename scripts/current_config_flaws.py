#!/usr/bin/env python3
"""
Flaw Analysis for Current Configuration
"""

import json

def analyze_current_flaws():
    print("🔍 FLAW ANALYSIS - CURRENT CONFIGURATION")
    print("="*50)
    
    # Try to load the most recent log file
    try:
        with open('../data/volatility_trading_logs_150_10.json', 'r') as f:
            data = json.load(f)
    except FileNotFoundError:
        print("No recent log file found. Using default analysis.")
        return
    
    trades = data['trades']
    print(f"Configuration: {data['initial_bankroll']} Taka bankroll, {data['starting_bet']} Taka bet")
    print(f"Doubles achieved: {data['doubles_count']}")
    print(f"Bankruptcies: {data['bankruptcies']}")
    
    # Analyze the critical issue - bet sizing vs bankroll
    print(f"\n⚠️  CRITICAL BET SIZING ISSUE:")
    print("-"*30)
    
    bet_ratio = data['starting_bet'] / data['initial_bankroll'] * 100
    print(f"Starting bet is {bet_ratio:.1f}% of initial bankroll")
    
    if bet_ratio > 5:
        print(f"💀 DANGEROUS: Bet size ({data['starting_bet']} Taka) is {bet_ratio:.1f}% of bankroll")
        print(f"   This is extremely aggressive and unsustainable")
        print(f"   Recommendation: Reduce to 1-2% of bankroll (1.5-3 Taka)")
    
    # Check consecutive losses impact
    consecutive_losses = 0
    max_consecutive_losses = 0
    
    for trade in trades:
        if not trade['won']:
            consecutive_losses += 1
            max_consecutive_losses = max(max_consecutive_losses, consecutive_losses)
        else:
            consecutive_losses = 0
    
    print(f"\n🔴 CONSECUTIVE LOSS IMPACT:")
    print("-"*30)
    print(f"Maximum consecutive losses: {max_consecutive_losses}")
    
    # Calculate risk of ruin with current bet sizing
    risk_per_loss = data['starting_bet'] / data['initial_bankroll'] * 100
    consecutive_loss_risk = (risk_per_loss/100) ** max_consecutive_losses * 100
    
    print(f"Risk of significant drawdown: {consecutive_loss_risk:.2f}%")
    
    if consecutive_loss_risk > 10:
        print(f"💀 HIGH RISK: {max_consecutive_losses} consecutive losses could devastate small bankroll")
    
    print(f"\n📈 PERFORMANCE vs RISK:")
    print("-"*30)
    print(f"ROI: {data['roi_percentage']:+.1f}%")
    print(f"But achieved through {data['doubles_count']} resets")
    print(f"This indicates high volatility in performance")
    
    print(f"\n🎯 RECOMMENDATIONS FOR THIS CONFIG:")
    print("-"*40)
    print(f"1. Reduce starting bet to 2-3 Taka (1.3-2% of bankroll)")
    print(f"2. Implement 3-consecutive-loss stop")
    print(f"3. Add 2% bankroll protection rule")
    print(f"4. Consider Kelly Criterion bet sizing")

if __name__ == "__main__":
    analyze_current_flaws()