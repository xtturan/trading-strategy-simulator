#!/usr/bin/env python3
"""
Parameter Optimization for Trading Strategies
Tests different bankroll sizes and bet amounts to find optimal combinations
"""

import json
import math
from typing import List, Dict, Tuple
from dataclasses import dataclass
from collections import defaultdict
import statistics

@dataclass
class OptimizationResult:
    bankroll_size: float
    starting_bet: float
    final_bankroll: float
    total_profit: float
    roi: float
    doubles_count: int
    bankruptcies: int
    max_bankroll: float
    min_bankroll: float
    trade_count: int

class ParameterOptimizer:
    def __init__(self, data_file: str = '../data/data_flipped.json'):
        with open(data_file, 'r') as f:
            self.data = json.load(f)
        self.results = self.data['results']
        print(f"Loaded {len(self.results)} historical results")
        
    def run_volatility_breakout_optimized(self, initial_bankroll: float, starting_bet: float, max_trades: int = 2000):
        """Run Volatility Breakout with specific parameters"""
        bankroll = initial_bankroll
        session_bankroll = initial_bankroll
        history = []
        doubles_count = 0
        bankruptcies = 0
        max_bankroll = initial_bankroll
        min_bankroll = initial_bankroll
        
        for i in range(min(len(self.results), max_trades)):
            result = self.results[i]
            history.append(result)
            
            # Bankroll management - reset on double or bankruptcy
            if session_bankroll >= initial_bankroll * 2:
                doubles_count += 1
                session_bankroll = initial_bankroll
            elif session_bankroll < 1:
                bankruptcies += 1
                session_bankroll = initial_bankroll
            
            # Strategy logic
            if len(history) < 10:
                bet_type = 'small'
                bet_amount = min(starting_bet, session_bankroll)
            else:
                recent_changes = [abs(history[j] - history[j-1]) for j in range(len(history)-10, len(history))]
                current_volatility = statistics.stdev(recent_changes) if len(recent_changes) > 1 else 0
                
                if current_volatility > 2.5:
                    recent_avg = sum(history[-3:]) / 3
                    if history[-1] > recent_avg:
                        bet_type = 'big'
                    else:
                        bet_type = 'small'
                    bet_amount = min(starting_bet, session_bankroll)
                else:
                    bet_type = 'small'
                    bet_amount = min(starting_bet, session_bankroll)
            
            # Ensure whole number bets
            bet_amount = math.floor(bet_amount)
            if bet_amount < 1:
                bet_amount = 1
            
            # Execute trade
            if session_bankroll >= bet_amount:
                session_bankroll -= bet_amount
                
                contract_amount = bet_amount * 0.98
                if bet_type == 'big' and result in [5,6,7,8,9]:
                    payout = contract_amount * 2
                elif bet_type == 'small' and result in [0,1,2,3,4]:
                    payout = contract_amount * 2
                else:
                    payout = 0
                    
                session_bankroll += payout
                bankroll += (payout - bet_amount)
                
                max_bankroll = max(max_bankroll, bankroll)
                min_bankroll = min(min_bankroll, bankroll)
        
        return OptimizationResult(
            bankroll_size=initial_bankroll,
            starting_bet=starting_bet,
            final_bankroll=bankroll,
            total_profit=bankroll-initial_bankroll,
            roi=((bankroll-initial_bankroll)/initial_bankroll)*100,
            doubles_count=doubles_count,
            bankruptcies=bankruptcies,
            max_bankroll=max_bankroll,
            min_bankroll=min_bankroll,
            trade_count=min(len(self.results), max_trades)
        )
        
    def run_trend_following_optimized(self, initial_bankroll: float, starting_bet: float, max_trades: int = 2000):
        """Run Trend Following with specific parameters"""
        bankroll = initial_bankroll
        session_bankroll = initial_bankroll
        history = []
        doubles_count = 0
        bankruptcies = 0
        max_bankroll = initial_bankroll
        min_bankroll = initial_bankroll
        
        for i in range(min(len(self.results), max_trades)):
            result = self.results[i]
            history.append(result)
            
            # Bankroll management
            if session_bankroll >= initial_bankroll * 2:
                doubles_count += 1
                session_bankroll = initial_bankroll
            elif session_bankroll < 1:
                bankruptcies += 1
                session_bankroll = initial_bankroll
            
            # Strategy logic
            if len(history) < 8:
                bet_type = 'small'
                bet_amount = min(starting_bet, session_bankroll)
            else:
                short_ma = sum(history[-3:]) / 3
                long_ma = sum(history[-8:]) / 8
                
                if short_ma > long_ma + 1:
                    bet_type = 'big'
                elif short_ma < long_ma - 1:
                    bet_type = 'small'
                else:
                    bet_type = 'small'
                    
                bet_amount = min(starting_bet, session_bankroll)
            
            # Ensure whole number bets
            bet_amount = math.floor(bet_amount)
            if bet_amount < 1:
                bet_amount = 1
            
            # Execute trade
            if session_bankroll >= bet_amount:
                session_bankroll -= bet_amount
                
                contract_amount = bet_amount * 0.98
                if bet_type == 'big' and result in [5,6,7,8,9]:
                    payout = contract_amount * 2
                elif bet_type == 'small' and result in [0,1,2,3,4]:
                    payout = contract_amount * 2
                else:
                    payout = 0
                    
                session_bankroll += payout
                bankroll += (payout - bet_amount)
                
                max_bankroll = max(max_bankroll, bankroll)
                min_bankroll = min(min_bankroll, bankroll)
        
        return OptimizationResult(
            bankroll_size=initial_bankroll,
            starting_bet=starting_bet,
            final_bankroll=bankroll,
            total_profit=bankroll-initial_bankroll,
            roi=((bankroll-initial_bankroll)/initial_bankroll)*100,
            doubles_count=doubles_count,
            bankruptcies=bankruptcies,
            max_bankroll=max_bankroll,
            min_bankroll=min_bankroll,
            trade_count=min(len(self.results), max_trades)
        )
        
    def optimize_parameters(self):
        """Run comprehensive parameter optimization"""
        print("🔬 PARAMETER OPTIMIZATION STARTED")
        print("="*60)
        
        # Test parameters
        bankroll_sizes = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]
        bet_amounts = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
        
        volatility_results = []
        trend_results = []
        
        total_tests = len(bankroll_sizes) * len(bet_amounts) * 2
        current_test = 0
        
        print(f"Testing {total_tests} parameter combinations...")
        print("(This may take a few minutes)")
        
        # Test Volatility Breakout strategy
        print("\n🧪 Testing Volatility Breakout Strategy:")
        for bankroll in bankroll_sizes:
            for bet in bet_amounts:
                current_test += 1
                if current_test % 20 == 0:
                    print(f"Progress: {current_test}/{total_tests} tests completed")
                    
                result = self.run_volatility_breakout_optimized(bankroll, bet)
                volatility_results.append(result)
        
        # Test Trend Following strategy
        print("\n🧪 Testing Trend Following Strategy:")
        for bankroll in bankroll_sizes:
            for bet in bet_amounts:
                current_test += 1
                if current_test % 20 == 0:
                    print(f"Progress: {current_test}/{total_tests} tests completed")
                    
                result = self.run_trend_following_optimized(bankroll, bet)
                trend_results.append(result)
        
        return volatility_results, trend_results
        
    def analyze_results(self, volatility_results: List[OptimizationResult], trend_results: List[OptimizationResult]):
        """Analyze and display optimization results"""
        print("\n" + "="*80)
        print("PARAMETER OPTIMIZATION RESULTS")
        print("="*80)
        
        # Find best performers
        best_volatility = max(volatility_results, key=lambda x: x.total_profit)
        best_trend = max(trend_results, key=lambda x: x.total_profit)
        best_overall = max(volatility_results + trend_results, key=lambda x: x.total_profit)
        
        print(f"\n🏆 BEST OVERALL PERFORMANCE:")
        print(f"Strategy: {'Volatility Breakout' if best_overall in volatility_results else 'Trend Following'}")
        print(f"Bankroll: {best_overall.bankroll_size} Taka")
        print(f"Starting Bet: {best_overall.starting_bet} Taka")
        print(f"Final Bankroll: {best_overall.final_bankroll:.2f} Taka")
        print(f"Total Profit: {best_overall.total_profit:+.2f} Taka ({best_overall.roi:+.1f}%)")
        print(f"Doubles: {best_overall.doubles_count}, Bankruptcies: {best_overall.bankruptcies}")
        
        print(f"\n💎 BEST VOLATILITY BREAKOUT:")
        print(f"Bankroll: {best_volatility.bankroll_size} Taka")
        print(f"Starting Bet: {best_volatility.starting_bet} Taka")
        print(f"Profit: {best_volatility.total_profit:+.2f} Taka ({best_volatility.roi:+.1f}%)")
        
        print(f"\n💎 BEST TREND FOLLOWING:")
        print(f"Bankroll: {best_trend.bankroll_size} Taka")
        print(f"Starting Bet: {best_trend.starting_bet} Taka")
        print(f"Profit: {best_trend.total_profit:+.2f} Taka ({best_trend.roi:+.1f}%)")
        
        # ROI analysis by bankroll size
        print(f"\n📊 ROI BY BANKROLL SIZE (Best bet for each):")
        print("-"*60)
        print(f"{'Bankroll':<10} {'Volatility ROI':<18} {'Trend ROI':<15} {'Best Strategy'}")
        print("-"*60)
        
        for bankroll in [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]:
            vol_roi_results = [r for r in volatility_results if r.bankroll_size == bankroll]
            trend_roi_results = [r for r in trend_results if r.bankroll_size == bankroll]
            
            if vol_roi_results and trend_roi_results:
                best_vol = max(vol_roi_results, key=lambda x: x.roi)
                best_trend = max(trend_roi_results, key=lambda x: x.roi)
                
                if best_vol.roi > best_trend.roi:
                    best_strategy = "Volatility"
                    best_roi = best_vol.roi
                else:
                    best_strategy = "Trend"
                    best_roi = best_trend.roi
                    
                print(f"{bankroll:<10} {best_vol.roi:<18.1f}% {best_trend.roi:<15.1f}% {best_strategy} ({best_roi:.1f}%)")
        
        # Risk analysis
        print(f"\n⚠️  RISK ANALYSIS:")
        print("-"*60)
        high_risk_vol = [r for r in volatility_results if r.bankruptcies > 0 or r.doubles_count > 5]
        high_risk_trend = [r for r in trend_results if r.bankruptcies > 0 or r.doubles_count > 5]
        
        print(f"Volatility Breakout - High Risk Configurations: {len(high_risk_vol)}")
        print(f"Trend Following - High Risk Configurations: {len(high_risk_trend)}")
        
        if high_risk_vol:
            avg_bankruptcies_vol = sum(r.bankruptcies for r in high_risk_vol) / len(high_risk_vol)
            print(f"Average bankruptcies (high risk Volatility): {avg_bankruptcies_vol:.1f}")
            
        if high_risk_trend:
            avg_bankruptcies_trend = sum(r.bankruptcies for r in high_risk_trend) / len(high_risk_trend)
            print(f"Average bankruptcies (high risk Trend): {avg_bankruptcies_trend:.1f}")
        
        # Save detailed results
        detailed_results = {
            'volatility_breakout_results': [
                {
                    'bankroll_size': r.bankroll_size,
                    'starting_bet': r.starting_bet,
                    'final_bankroll': r.final_bankroll,
                    'total_profit': r.total_profit,
                    'roi': r.roi,
                    'doubles_count': r.doubles_count,
                    'bankruptcies': r.bankruptcies,
                    'max_bankroll': r.max_bankroll,
                    'min_bankroll': r.min_bankroll
                } for r in volatility_results
            ],
            'trend_following_results': [
                {
                    'bankroll_size': r.bankroll_size,
                    'starting_bet': r.starting_bet,
                    'final_bankroll': r.final_bankroll,
                    'total_profit': r.total_profit,
                    'roi': r.roi,
                    'doubles_count': r.doubles_count,
                    'bankruptcies': r.bankruptcies,
                    'max_bankroll': r.max_bankroll,
                    'min_bankroll': r.min_bankroll
                } for r in trend_results
            ],
            'best_configurations': {
                'overall_best': {
                    'strategy': 'Volatility Breakout' if best_overall in volatility_results else 'Trend Following',
                    'bankroll_size': best_overall.bankroll_size,
                    'starting_bet': best_overall.starting_bet,
                    'total_profit': best_overall.total_profit,
                    'roi': best_overall.roi
                },
                'volatility_best': {
                    'bankroll_size': best_volatility.bankroll_size,
                    'starting_bet': best_volatility.starting_bet,
                    'total_profit': best_volatility.total_profit,
                    'roi': best_volatility.roi
                },
                'trend_best': {
                    'bankroll_size': best_trend.bankroll_size,
                    'starting_bet': best_trend.starting_bet,
                    'total_profit': best_trend.total_profit,
                    'roi': best_trend.roi
                }
            }
        }
        
        with open('../data/parameter_optimization_results.json', 'w') as f:
            json.dump(detailed_results, f, indent=2)
            
        print(f"\n💾 Detailed results saved to ../data/parameter_optimization_results.json")
        
        return detailed_results

def main():
    print("🎲 TRADING STRATEGY PARAMETER OPTIMIZATION")
    print("="*50)
    
    optimizer = ParameterOptimizer('../data/data_flipped.json')
    
    # Run optimization
    volatility_results, trend_results = optimizer.optimize_parameters()
    
    # Analyze results
    detailed_results = optimizer.analyze_results(volatility_results, trend_results)
    
    print(f"\n🎯 PARAMETER OPTIMIZATION COMPLETE!")

if __name__ == "__main__":
    main()