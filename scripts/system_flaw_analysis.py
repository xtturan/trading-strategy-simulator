#!/usr/bin/env python3
"""
Comprehensive Flaw Analysis of Trading System
"""

import json
from collections import Counter, defaultdict

def analyze_system_flaws():
    print("🔍 COMPREHENSIVE SYSTEM FLAW ANALYSIS")
    print("="*60)
    
    # Load trading logs
    with open('../data/volatility_trading_logs_1000_10.json', 'r') as f:
        data = json.load(f)
    
    trades = data['trades']
    print(f"Analyzing {len(trades)} trades...")
    
    # 1. Consecutive Loss Analysis
    print(f"\n1. 🔴 CONSECUTIVE LOSS PATTERNS:")
    print("-"*40)
    
    consecutive_losses = 0
    max_consecutive_losses = 0
    loss_streaks = []
    
    for trade in trades:
        if not trade['won']:
            consecutive_losses += 1
            max_consecutive_losses = max(max_consecutive_losses, consecutive_losses)
        else:
            if consecutive_losses > 0:
                loss_streaks.append(consecutive_losses)
            consecutive_losses = 0
    
    if consecutive_losses > 0:
        loss_streaks.append(consecutive_losses)
    
    print(f"Maximum consecutive losses: {max_consecutive_losses}")
    print(f"Average loss streak length: {sum(loss_streaks)/len(loss_streaks):.2f}" if loss_streaks else "Average loss streak length: 0")
    print(f"Loss streaks of 3+: {len([s for s in loss_streaks if s >= 3])}")
    print(f"Loss streaks of 5+: {len([s for s in loss_streaks if s >= 5])}")
    
    # 2. Drawdown Analysis
    print(f"\n2. 📉 DRAWDOWN ANALYSIS:")
    print("-"*40)
    
    peak_bankroll = 1000
    max_drawdown = 0
    current_drawdown = 0
    drawdown_periods = []
    
    for trade in trades:
        if trade['bankroll_after'] > peak_bankroll:
            peak_bankroll = trade['bankroll_after']
        else:
            current_drawdown = (peak_bankroll - trade['bankroll_after']) / peak_bankroll * 100
            max_drawdown = max(max_drawdown, current_drawdown)
    
    print(f"Maximum drawdown: {max_drawdown:.1f}%")
    print(f"Final drawdown: {((6186 - data['max_bankroll']) / data['max_bankroll'] * 100):.1f}%")
    
    # 3. Volatility Effectiveness
    print(f"\n3. 📊 VOLATILITY-BASED DECISION EFFECTIVENESS:")
    print("-"*40)
    
    high_vol_trades = [t for t in trades if 'High volatility' in t['market_condition']]
    low_vol_trades = [t for t in trades if 'Low volatility' in t['market_condition']]
    
    high_vol_wins = len([t for t in high_vol_trades if t['won']])
    low_vol_wins = len([t for t in low_vol_trades if t['won']])
    
    print(f"High volatility period trades: {len(high_vol_trades)}")
    print(f"  Wins: {high_vol_wins} ({high_vol_wins/len(high_vol_trades)*100:.1f}% win rate)" if high_vol_trades else "  Wins: 0 (0% win rate)")
    print(f"  Profits: {sum(t['profit'] for t in high_vol_trades):+.2f} Taka")
    
    print(f"Low volatility period trades: {len(low_vol_trades)}")
    print(f"  Wins: {low_vol_wins} ({low_vol_wins/len(low_vol_trades)*100:.1f}% win rate)" if low_vol_trades else "  Wins: 0 (0% win rate)")
    print(f"  Profits: {sum(t['profit'] for t in low_vol_trades):+.2f} Taka")
    
    # 4. Bet Sizing Analysis
    print(f"\n4. 💰 BET SIZING FLAWS:")
    print("-"*40)
    
    # Check if bet sizing changes based on bankroll
    fixed_bets = all(trade['bet_amount'] == 10.0 for trade in trades)
    print(f"Fixed bet sizing: {'Yes' if fixed_bets else 'No'}")
    
    if not fixed_bets:
        increasing_bets = 0
        decreasing_bets = 0
        for i in range(1, len(trades)):
            if trades[i]['bet_amount'] > trades[i-1]['bet_amount']:
                increasing_bets += 1
            elif trades[i]['bet_amount'] < trades[i-1]['bet_amount']:
                decreasing_bets += 1
        print(f"Increasing bets: {increasing_bets}")
        print(f"Decreasing bets: {decreasing_bets}")
    
    # 5. Risk Management Gaps
    print(f"\n5. ⚠️  RISK MANAGEMENT FLAWS:")
    print("-"*40)
    
    # Check for over-betting relative to bankroll
    over_bets = [t for t in trades if t['bet_amount'] > t['bankroll_before'] * 0.1]  # >10% of bankroll
    print(f"Aggressive bets (>10% bankroll): {len(over_bets)}")
    
    # Check for betting when near bankruptcy
    desperate_bets = [t for t in trades if t['bankroll_before'] < 100 and t['bet_amount'] > 5]
    print(f"Desperate bets (bankroll < 100): {len(desperate_bets)}")
    
    # 6. Pattern Recognition Issues
    print(f"\n6. 🎯 PATTERN EXPLOITATION FLAWS:")
    print("-"*40)
    
    # Check if system exploits obvious patterns
    recent_history = []
    pattern_exploitation_attempts = 0
    
    for i, trade in enumerate(trades):
        if len(recent_history) >= 5:
            # Look for frequency-based betting
            counter = Counter(recent_history[-5:])
            most_frequent = counter.most_common(1)[0][0]
            
            # Check if betting on the most frequent recent number
            if f"number_{most_frequent}" in trade['bet_type']:
                pattern_exploitation_attempts += 1
                
        recent_history.append(trade['result'])
    
    print(f"Pattern exploitation attempts: {pattern_exploitation_attempts}")
    print(f"Pattern exploitation rate: {pattern_exploitation_attempts/len(trades)*100:.2f}%")
    
    # 7. Mathematical Edge Analysis
    print(f"\n7. 📈 MATHEMATICAL EDGE ANALYSIS:")
    print("-"*40)
    
    total_wins = len([t for t in trades if t['won']])
    total_losses = len([t for t in trades if not t['won']])
    
    print(f"Overall win rate: {total_wins/len(trades)*100:.2f}%")
    print(f"Expected value per trade: {sum(t['profit'] for t in trades)/len(trades):+.4f} Taka")
    
    # Check if wins are concentrated in specific periods
    early_wins = len([t for t in trades[:500] if t['won']])
    late_wins = len([t for t in trades[1500:] if t['won']])
    
    print(f"Wins in first 500 trades: {early_wins}/500 ({early_wins/500*100:.1f}%)")
    print(f"Wins in last 500 trades: {late_wins}/500 ({late_wins/500*100:.1f}%)")
    
    # 8. Critical System Flaws Summary
    print(f"\n8. 🚨 CRITICAL FLAWS IDENTIFIED:")
    print("-"*40)
    
    flaws = []
    
    if max_consecutive_losses >= 5:
        flaws.append(f"💀 DANGEROUS: {max_consecutive_losses} consecutive losses possible")
    
    if max_drawdown > 50:
        flaws.append(f"💀 HIGH RISK: {max_drawdown:.1f}% maximum drawdown")
    
    if len(over_bets) > len(trades) * 0.1:
        flaws.append(f"⚠️  RISKY: {len(over_bets)} overly aggressive bets")
    
    if early_wins > late_wins * 1.5:
        flaws.append(f"⚠️  SUSPICIOUS: Performance degrades over time")
    
    if not flaws:
        flaws.append("✅ No critical flaws detected in current configuration")
    
    for flaw in flaws:
        print(f"  {flaw}")
    
    print(f"\n🎯 RECOMMENDATIONS:")
    print("-"*20)
    print("1. Implement stop-loss mechanisms for consecutive losses")
    print("2. Add dynamic bet sizing based on recent performance")
    print("3. Include cooldown periods after significant drawdowns")
    print("4. Test with out-of-sample data to verify robustness")
    print("5. Consider position sizing proportional to edge confidence")

def main():
    analyze_system_flaws()

if __name__ == "__main__":
    main()