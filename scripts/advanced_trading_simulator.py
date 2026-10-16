#!/usr/bin/env python3
"""
AmarClub Advanced Trading Strategy Simulator - CLEAN VERSION
Tests multiple advanced strategies against historical data.
"""

import json
import math
from typing import List, Dict, Tuple
from dataclasses import dataclass
from collections import defaultdict
import statistics

@dataclass
class TradeResult:
    strategy: str
    trade_number: int
    bet_amount: float
    bet_type: str
    result: int
    won: bool
    payout: float
    profit: float
    bankroll_before: float
    bankroll_after: float
    contract_amount: float
    payout_multiplier: float

@dataclass
class SessionResult:
    strategy: str
    final_bankroll: float
    total_profit: float
    doubles_count: int
    bankruptcies: int
    max_bankroll: float
    min_bankroll: float
    trade_count: int

class BankrollManager:
    def __init__(self, initial_bankroll: float = 300.0):
        self.initial_bankroll = initial_bankroll
        self.current_bankroll = initial_bankroll
        self.session_bankroll = initial_bankroll
        
    def reset_session(self):
        self.session_bankroll = self.initial_bankroll
        
    def can_afford(self, amount: float) -> bool:
        return self.current_bankroll >= amount and amount >= 1.0
        
    def place_bet(self, amount: float) -> bool:
        whole_amount = math.floor(amount)
        if whole_amount < 1:
            whole_amount = 1
        if self.can_afford(whole_amount):
            self.current_bankroll -= whole_amount
            return True
        return False
        
    def add_winnings(self, amount: float):
        self.current_bankroll += amount
        
    def check_double_or_bankrupt(self) -> Tuple[bool, bool]:
        doubled = self.session_bankroll >= (self.initial_bankroll * 2)
        bankrupted = self.session_bankroll < 1
        return doubled, bankrupted

class BettingStrategy:
    def __init__(self, name: str):
        self.name = name
        
    def get_bet(self, history: List[int], bankroll_manager: BankrollManager) -> Tuple[str, float]:
        raise NotImplementedError
        
    def calculate_payout(self, result: int, bet_type: str, bet_amount: float) -> float:
        contract_amount = bet_amount * 0.98
        
        if bet_type == 'green':
            if result in [1, 3, 7, 9]:
                return contract_amount * 2
            elif result == 5:
                return contract_amount * 1.5
        elif bet_type == 'red':
            if result in [2, 4, 6, 8]:
                return contract_amount * 2
            elif result == 0:
                return contract_amount * 1.5
        elif bet_type == 'violet':
            if result in [0, 5]:
                return contract_amount * 4.5
        elif bet_type == 'big':
            if result in [5, 6, 7, 8, 9]:
                return contract_amount * 2
        elif bet_type == 'small':
            if result in [0, 1, 2, 3, 4]:
                return contract_amount * 2
        elif bet_type.startswith('number_'):
            target = int(bet_type.split('_')[1])
            if result == target:
                return contract_amount * 9
                
        return 0

# === ADVANCED STRATEGIES ===

class TrendFollowingStrategy(BettingStrategy):
    """Follow established trends using moving averages"""
    
    def __init__(self):
        super().__init__("Trend_Following")
        self.short_window = 3
        self.long_window = 8
        
    def get_bet(self, history: List[int], bankroll_manager: BankrollManager) -> Tuple[str, float]:
        if len(history) < self.long_window:
            return 'small', 1.0
            
        short_ma = sum(history[-self.short_window:]) / self.short_window
        long_ma = sum(history[-self.long_window:]) / self.long_window
        
        if short_ma > long_ma + 1 and bankroll_manager.can_afford(1):
            return 'big', 1.0
        elif short_ma < long_ma - 1 and bankroll_manager.can_afford(1):
            return 'small', 1.0
            
        return 'small', 1.0

class MomentumStrategy(BettingStrategy):
    """Follow momentum trends in results"""
    
    def __init__(self):
        super().__init__("Momentum")
        self.momentum_window = 5
        
    def get_bet(self, history: List[int], bankroll_manager: BankrollManager) -> Tuple[str, float]:
        if len(history) < self.momentum_window:
            return 'small', 1.0
            
        recent_changes = [history[i] - history[i-1] for i in range(len(history)-self.momentum_window+1, len(history))]
        positive_changes = sum(1 for change in recent_changes if change > 0)
        negative_changes = sum(1 for change in recent_changes if change < 0)
        
        if positive_changes >= 4 and bankroll_manager.can_afford(1):
            return 'big', 1.0
        elif negative_changes >= 4 and bankroll_manager.can_afford(1):
            return 'small', 1.0
            
        return 'small', 1.0

class VolatilityBreakoutStrategy(BettingStrategy):
    """Bet on breakout patterns during high volatility periods"""
    
    def __init__(self):
        super().__init__("Volatility_Breakout")
        self.volatility_window = 10
        
    def get_bet(self, history: List[int], bankroll_manager: BankrollManager) -> Tuple[str, float]:
        if len(history) < self.volatility_window:
            return 'small', 1.0
            
        recent_changes = [abs(history[i] - history[i-1]) for i in range(len(history)-self.volatility_window+1, len(history))]
        if len(recent_changes) > 1:
            current_volatility = statistics.stdev(recent_changes) if len(recent_changes) > 1 else 0
        else:
            current_volatility = 0
            
        if current_volatility > 2.5 and len(history) > 5:
            recent_avg = sum(history[-3:]) / 3
            current_result = history[-1]
            
            if current_result > recent_avg and bankroll_manager.can_afford(1):
                return 'big', 1.0
            elif current_result < recent_avg and bankroll_manager.can_afford(1):
                return 'small', 1.0
                
        return 'small', 1.0

class StatisticalArbitrageStrategy(BettingStrategy):
    """Exploit statistical inefficiencies in number distribution"""
    
    def __init__(self):
        super().__init__("Statistical_Arbitrage")
        self.number_frequency = defaultdict(int)
        self.total_bets = 0
        
    def get_bet(self, history: List[int], bankroll_manager: BankrollManager) -> Tuple[str, float]:
        if len(history) < 20:
            return 'small', 1.0
            
        for num in history[-20:]:
            self.number_frequency[num] += 1
        self.total_bets += 20
            
        expected_freq = self.total_bets / 10
        underrepresented = []
        
        for num in range(10):
            actual_freq = self.number_frequency[num]
            if actual_freq < expected_freq * 0.7:
                underrepresented.append(num)
                
        if underrepresented and bankroll_manager.can_afford(1):
            target = min(underrepresented, key=lambda x: self.number_frequency[x])
            return f"number_{target}", 1.0
            
        return 'small', 1.0

class CycleDetectionStrategy(BettingStrategy):
    """Detect cyclical patterns in results"""
    
    def __init__(self):
        super().__init__("Cycle_Detection")
        self.cycle_length = 5
        
    def get_bet(self, history: List[int], bankroll_manager: BankrollManager) -> Tuple[str, float]:
        if len(history) < self.cycle_length * 2:
            return 'small', 1.0
            
        recent = history[-self.cycle_length:]
        
        pattern_found = False
        for i in range(len(history) - self.cycle_length * 2, len(history) - self.cycle_length):
            if history[i:i+self.cycle_length] == recent:
                pattern_found = True
                break
                
        if pattern_found and len(history) > self.cycle_length:
            next_expected = history[-self.cycle_length]
            if bankroll_manager.can_afford(1):
                return f"number_{next_expected}", 1.0
                
        return 'small', 1.0

class PatternBasedStrategy(BettingStrategy):
    """Corrected Pattern-Based strategy (using only historical data)"""
    
    def __init__(self):
        super().__init__("Pattern_Based_Corrected")
        
    def get_bet(self, history: List[int], bankroll_manager: BankrollManager) -> Tuple[str, float]:
        if len(history) < 6:
            return 'small', 1.0
            
        recent_past = history[-6:-1]  # Last 5 results excluding current
        counts = defaultdict(int)
        for num in recent_past:
            counts[num] += 1
            
        most_frequent = max(counts.items(), key=lambda x: x[1])[0]
        
        if bankroll_manager.can_afford(1):
            return f"number_{most_frequent}", 1.0
        return None, 0

class Simulator:
    def __init__(self, data_file: str = '../data/data_flipped.json'):
        with open(data_file, 'r') as f:
            self.data = json.load(f)
        self.results = self.data['results']
        print(f"Loaded {len(self.results)} historical results")
        self.top_strategies = []
        self.detailed_trades = {}
        
    def run_strategy(self, strategy: BettingStrategy, initial_bankroll: float = 300.0, 
                    max_trades: int = 2000, track_detailed: bool = False) -> SessionResult:
        bankroll_mgr = BankrollManager(initial_bankroll)
        history = []
        trades = []
        doubles_count = 0
        bankruptcies = 0
        detailed_trade_log = []
        
        max_bankroll = initial_bankroll
        min_bankroll = initial_bankroll
        
        trade_count = min(len(self.results), max_trades)
        
        for i in range(trade_count):
            result = self.results[i]
            history.append(result)
            
            bet_type, bet_amount = strategy.get_bet(history, bankroll_mgr)
            
            if bet_type is None:
                break
                
            bankroll_before = bankroll_mgr.current_bankroll
            
            if not bankroll_mgr.place_bet(bet_amount):
                break
                
            payout = strategy.calculate_payout(result, bet_type, bet_amount)
            won = payout > 0
            profit = payout - bet_amount
            
            bankroll_mgr.add_winnings(payout)
            
            max_bankroll = max(max_bankroll, bankroll_mgr.current_bankroll)
            min_bankroll = min(min_bankroll, bankroll_mgr.current_bankroll)
            
            doubled, bankrupted = bankroll_mgr.check_double_or_bankrupt()
            
            if doubled:
                doubles_count += 1
                bankroll_mgr.reset_session()
                
            if bankrupted:
                bankruptcies += 1
                bankroll_mgr.reset_session()
                
            if hasattr(strategy, 'update_result'):
                strategy.update_result(won)
                
            contract_amount = bet_amount * 0.98
            payout_multiplier = payout / contract_amount if contract_amount > 0 else 0
            
            trade_result = TradeResult(
                strategy=strategy.name,
                trade_number=i+1,
                bet_amount=bet_amount,
                bet_type=bet_type,
                result=result,
                won=won,
                payout=payout,
                profit=profit,
                bankroll_before=bankroll_before,
                bankroll_after=bankroll_mgr.current_bankroll,
                contract_amount=contract_amount,
                payout_multiplier=payout_multiplier
            )
            
            trades.append(trade_result)
            
            if track_detailed:
                detailed_trade_log.append({
                    'trade_number': i+1,
                    'bet_amount': float(bet_amount),
                    'bet_type': bet_type,
                    'result': result,
                    'won': won,
                    'payout': float(payout),
                    'profit': float(profit),
                    'bankroll_before': float(bankroll_before),
                    'bankroll_after': float(bankroll_mgr.current_bankroll),
                    'contract_amount': float(contract_amount),
                    'payout_multiplier': float(payout_multiplier)
                })
                
        if track_detailed:
            self.detailed_trades[strategy.name] = detailed_trade_log
            
        return SessionResult(
            strategy=strategy.name,
            final_bankroll=bankroll_mgr.current_bankroll,
            total_profit=bankroll_mgr.current_bankroll - initial_bankroll,
            doubles_count=doubles_count,
            bankruptcies=bankruptcies,
            max_bankroll=max_bankroll,
            min_bankroll=min_bankroll,
            trade_count=len(trades)
        )
        
    def benchmark_strategies(self, initial_bankroll: float = 300.0, max_trades: int = 2000):
        strategies = [
            # Advanced strategies
            TrendFollowingStrategy(),
            MomentumStrategy(),
            VolatilityBreakoutStrategy(),
            StatisticalArbitrageStrategy(),
            CycleDetectionStrategy(),
            PatternBasedStrategy(),  # Our corrected version
        ]
        
        results = []
        print("Running advanced strategy benchmark...")
        print("=" * 60)
        
        for i, strategy in enumerate(strategies, 1):
            print(f"[{i}/{len(strategies)}] Testing {strategy.name}...")
            result = self.run_strategy(strategy, initial_bankroll, max_trades, track_detailed=False)
            results.append(result)
            
        # Sort by total profit and get top 3
        sorted_results = sorted(results, key=lambda x: x.total_profit, reverse=True)
        self.top_strategies = [r.strategy for r in sorted_results[:3]]
        
        print(f"\nTop 3 strategies: {self.top_strategies}")
        
        # Run top 3 with detailed tracking
        print("\nGenerating detailed trade logs for top 3 strategies...")
        detailed_results = []
        
        for strategy in strategies:
            if strategy.name in self.top_strategies:
                print(f"Running {strategy.name} with detailed tracking...")
                result = self.run_strategy(strategy, initial_bankroll, max_trades, track_detailed=True)
                detailed_results.append(result)
            else:
                existing_result = next((r for r in results if r.strategy == strategy.name), None)
                if existing_result:
                    detailed_results.append(existing_result)
                    
        return detailed_results
        
    def print_results(self, results: List[SessionResult]):
        print("\n" + "=" * 80)
        print("ADVANCED TRADING STRATEGY BENCHMARK RESULTS")
        print("=" * 80)
        
        sorted_results = sorted(results, key=lambda x: x.total_profit, reverse=True)
        
        print(f"{'Rank':<4} {'Strategy':<25} {'Final BR':<12} {'Profit':<12} {'Doubles':<8} {'Bankrupt':<10} {'Max BR':<12}")
        print("-" * 80)
        
        for i, result in enumerate(sorted_results, 1):
            profit_sign = "+" if result.total_profit >= 0 else ""
            print(f"{i:<4} {result.strategy:<25} {result.final_bankroll:<12.2f} "
                  f"{profit_sign}{result.total_profit:<12.2f} {result.doubles_count:<8} "
                  f"{result.bankruptcies:<10} {result.max_bankroll:<12.2f}")
                  
        print("\n" + "=" * 80)
        print("TOP 3 WINNING STRATEGIES:")
        print("=" * 80)
        
        for i in range(min(3, len(sorted_results))):
            result = sorted_results[i]
            roi = (result.total_profit / 300) * 100
            print(f"{i+1}. {result.strategy}")
            print(f"   Profit: {result.total_profit:+.2f} ({roi:+.1f}%)")
            print(f"   Doubles: {result.doubles_count}, Bankruptcies: {result.bankruptcies}")
            print(f"   Max Bankroll: {result.max_bankroll:.2f}")

def main():
    print("🎲 AMARCLUB ADVANCED TRADING STRATEGY BENCHMARK (300 Taka Bankroll)")
    print("=" * 68)
    
    simulator = Simulator('../data/data_flipped.json')
    
    # Run full benchmark with all advanced strategies
    results = simulator.benchmark_strategies(initial_bankroll=300.0, max_trades=2000)
    
    # Print results
    simulator.print_results(results)
    
    print(f"\n💾 Benchmark completed!")

if __name__ == "__main__":
    main()