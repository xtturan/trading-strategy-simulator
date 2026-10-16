#!/usr/bin/env python3
"""
Clean Summary of Parameter Optimization Results
"""

import json

def display_optimization_summary():
    print("🎯 PARAMETER OPTIMIZATION SUMMARY")
    print("="*60)
    
    # Load results
    with open('../data/parameter_optimization_results.json', 'r') as f:
        data = json.load(f)
    
    best_configs = data['best_configurations']
    
    print("🏆 OPTIMAL CONFIGURATIONS FOUND:")
    print("-"*60)
    
    print(f"👑 ABSOLUTE BEST PERFORMANCE:")
    print(f"   Strategy: {best_configs['overall_best']['strategy']}")
    print(f"   Bankroll: {best_configs['overall_best']['bankroll_size']} Taka")
    print(f"   Starting Bet: {best_configs['overall_best']['starting_bet']} Taka")
    print(f"   Profit: {best_configs['overall_best']['total_profit']:+.2f} Taka")
    print(f"   ROI: {best_configs['overall_best']['roi']:+.1f}%")
    
    print(f"\n💎 STRATEGY-SPECIFIC OPTIMALS:")
    print(f"   Volatility Breakout:")
    print(f"     Bankroll: {best_configs['volatility_best']['bankroll_size']} Taka")
    print(f"     Bet: {best_configs['volatility_best']['starting_bet']} Taka")
    print(f"     Profit: {best_configs['volatility_best']['total_profit']:+.2f} Taka ({best_configs['volatility_best']['roi']:+.1f}%)")
    
    print(f"   Trend Following:")
    print(f"     Bankroll: {best_configs['trend_best']['bankroll_size']} Taka")
    print(f"     Bet: {best_configs['trend_best']['starting_bet']} Taka")
    print(f"     Profit: {best_configs['trend_best']['total_profit']:+.2f} Taka ({best_configs['trend_best']['roi']:+.1f}%)")
    
    # Show top 10 configurations
    print(f"\n📋 TOP 10 PROFITABLE CONFIGURATIONS:")
    print("-"*60)
    
    all_results = []
    for result in data['volatility_breakout_results']:
        all_results.append(('Volatility Breakout', result))
    for result in data['trend_following_results']:
        all_results.append(('Trend Following', result))
    
    # Sort by profit
    sorted_results = sorted(all_results, key=lambda x: x[1]['total_profit'], reverse=True)[:10]
    
    print(f"{'Rank':<4} {'Strategy':<20} {'Bankroll':<10} {'Bet':<6} {'Profit':<12} {'ROI':<8}")
    print("-"*60)
    
    for i, (strategy, result) in enumerate(sorted_results, 1):
        print(f"{i:<4} {strategy:<20} {result['bankroll_size']:<10} {result['starting_bet']:<6} "
              f"{result['total_profit']:<12.2f} {result['roi']:<8.1f}%")
    
    # Risk assessment
    print(f"\n⚠️  RISK ASSESSMENT:")
    print("-"*40)
    
    low_risk_configs = [r for r in all_results if r[1]['bankruptcies'] == 0 and r[1]['doubles_count'] <= 3]
    high_profit_low_risk = [r for r in low_risk_configs if r[1]['total_profit'] > 1000]
    
    print(f"Total configurations tested: 200")
    print(f"Zero bankruptcy configs: {len([r for r in all_results if r[1]['bankruptcies'] == 0])}")
    print(f"Low-risk high-profit configs: {len(high_profit_low_risk)}")
    
    if high_profit_low_risk:
        print(f"\n💰 RECOMMENDED SAFE CONFIGURATIONS:")
        print("-"*40)
        safe_sorted = sorted(high_profit_low_risk, key=lambda x: x[1]['roi'], reverse=True)[:5]
        for strategy, result in safe_sorted:
            print(f"   {strategy} - {result['bankroll_size']}T/{result['starting_bet']}T: {result['total_profit']:+.0f}T ({result['roi']:+.0f}%)")

def main():
    display_optimization_summary()

if __name__ == "__main__":
    main()