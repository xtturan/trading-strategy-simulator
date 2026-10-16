#!/usr/bin/env python3
"""
AmarClub Trading Strategy Simulator
Tests multiple strategies against historical data to find the most profitable approach.

Game Rules:
- Bet: 100 → Contract: 98 (2% fee)
- Green (1,3,7,9): Win 196 (2x)
- Red (2,4,6,8): Win 196 (2x)  
- Violet (0,5): Win 441 (4.5x)
- Exact number: Win 882 (9x)
- Big (5-9): Win 196 (2x)
- Small (0-4): Win 196 (2x)
"""

import json
import math
from typing import List, Dict, Tuple, Callable
from dataclasses import dataclass
from collections import defaultdict
import statistics

@dataclass
class TradeResult:
    strategy: str
    bet_amount: float
    bet_type: str
    result: int
    won: bool
    payout: float
    profit: float
    bankroll_after: float

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
        self.session_bankroll = initial_bankroll  # For tracking doubles/bankruptcies
        
    def reset_session(self):
        """Reset to initial bankroll for new session"""
        self.session_bankroll = self.initial_bankroll
        
    def can_afford(self, amount: float) -> bool:
        return self.current_bankroll >= amount and amount >= 1.0
        
    def place_bet(self, amount: float) -> bool:
        # Ensure whole number bet
        whole_amount = math.floor(amount)
        if whole_amount < 1:
            whole_amount = 1
        if self.can_afford(whole_amount):
            self.current_bankroll -= whole_amount
            return True
        return False
        
    def add_winnings(self, amount: float):
        # Ensure whole number winnings
        whole_amount = math.floor(amount)
        self.current_bankroll += whole_amount
        
    def check_double_or_bankrupt(self) -> Tuple[bool, bool]:
        """
        Returns (doubled, bankrupted)
        Doubled: session_bankroll reached 2x initial
        Bankrupted: session_bankroll < minimum bet (1)
        """
        doubled = self.session_bankroll >= (self.initial_bankroll * 2)
        bankrupted = self.session_bankroll < 1
        return doubled, bankrupted

class BettingStrategy:
    def __init__(self, name: str):
        self.name = name
        
    def get_bet(self, history: List[int], bankroll_manager: BankrollManager) -> Tuple[str, float]:
        """
        Returns (bet_type, bet_amount)
        Must implement in subclasses
        """
        raise NotImplementedError
        
    def calculate_payout(self, result: int, bet_type: str, bet_amount: float) -> float:
        """Calculate payout based on game rules"""
        contract_amount = bet_amount * 0.98  # 2% fee
        
        # Game rules payouts
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
                
        return 0  # Loss

class FixedBetStrategy(BettingStrategy):
    """Always bet the same amount on the same choice"""
    
    def __init__(self, bet_type: str, bet_amount: float = 1.0):
        super().__init__(f"Fixed_{bet_type}_{int(bet_amount)}")
        self.bet_type = bet_type
        self.bet_amount = max(1.0, math.floor(bet_amount))  # Ensure at least 1 and whole number
        
    def get_bet(self, history: List[int], bankroll_manager: BankrollManager) -> Tuple[str, float]:
        if bankroll_manager.can_afford(self.bet_amount):
            return self.bet_type, float(self.bet_amount)
        return None, 0

class MartingaleStrategy(BettingStrategy):
    """Double bet after loss, reset after win"""
    
    def __init__(self, bet_type: str, base_bet: float = 1.0):
        super().__init__(f"Martingale_{bet_type}_{int(base_bet)}")
        self.bet_type = bet_type
        self.base_bet = max(1.0, math.floor(base_bet))  # Ensure at least 1 and whole number
        self.current_bet = self.base_bet
        self.last_result = None
        
    def get_bet(self, history: List[int], bankroll_manager: BankrollManager) -> Tuple[str, float]:
        # Reset to base bet after win
        if self.last_result is not None and self.last_result:
            self.current_bet = self.base_bet
            
        if bankroll_manager.can_afford(self.current_bet):
            return self.bet_type, float(self.current_bet)
        return None, 0
        
    def update_result(self, won: bool):
        self.last_result = won
        if not won:
            self.current_bet = math.floor(self.current_bet * 2)  # Double after loss, ensure whole number

class AntiMartingaleStrategy(BettingStrategy):
    """Double bet after win, reset after loss"""
    
    def __init__(self, bet_type: str, base_bet: float = 1.0):
        super().__init__(f"AntiMartingale_{bet_type}_{int(base_bet)}")
        self.bet_type = bet_type
        self.base_bet = max(1.0, math.floor(base_bet))  # Ensure at least 1 and whole number
        self.current_bet = self.base_bet
        self.last_result = None
        
    def get_bet(self, history: List[int], bankroll_manager: BankrollManager) -> Tuple[str, float]:
        # Reset to base bet after loss
        if self.last_result is not None and not self.last_result:
            self.current_bet = self.base_bet
            
        if bankroll_manager.can_afford(self.current_bet):
            return self.bet_type, float(self.current_bet)
        return None, 0
        
    def update_result(self, won: bool):
        self.last_result = won
        if won:
            self.current_bet = math.floor(self.current_bet * 2)  # Double after win, ensure whole number
        else:
            self.current_bet = self.base_bet

class PatternBasedStrategy(BettingStrategy):
    """Bet based on recent patterns in results"""
    
    def __init__(self):
        super().__init__("Pattern_Based")
        
    def get_bet(self, history: List[int], bankroll_manager: BankrollManager) -> Tuple[str, float]:
        if len(history) < 5:
            return 'small', 1.0
            
        # Look at last 5 results
        recent = history[-5:]
        
        # Count frequencies
        counts = defaultdict(int)
        for num in recent:
            counts[num] += 1
            
        # Find most frequent number
        most_frequent = max(counts.items(), key=lambda x: x[1])[0]
        
        # Bet on the most frequent number
        if bankroll_manager.can_afford(1):
            return f"number_{most_frequent}", 1.0
        return None, 0

class AlternatingStrategy(BettingStrategy):
    """Alternate between big and small bets"""
    
    def __init__(self):
        super().__init__("Alternating_Big_Small")
        self.counter = 0
        
    def get_bet(self, history: List[int], bankroll_manager: BankrollManager) -> Tuple[str, float]:
        bet_type = 'big' if self.counter % 2 == 0 else 'small'
        self.counter += 1
        
        if bankroll_manager.can_afford(1):
            return bet_type, 1.0
        return None, 0

class ParoliStrategy(BettingStrategy):
    """Win progression: increase bet after wins, reset after 3 wins or loss"""
    
    def __init__(self, bet_type: str, base_bet: float = 1.0):
        super().__init__(f"Paroli_{bet_type}_{int(base_bet)}")
        self.bet_type = bet_type
        self.base_bet = max(1.0, math.floor(base_bet))  # Ensure at least 1 and whole number
        self.current_bet = self.base_bet
        self.consecutive_wins = 0
        
    def get_bet(self, history: List[int], bankroll_manager: BankrollManager) -> Tuple[str, float]:
        # Reset after 3 consecutive wins or any loss
        if self.consecutive_wins >= 3:
            self.current_bet = self.base_bet
            self.consecutive_wins = 0
            
        if bankroll_manager.can_afford(self.current_bet):
            return self.bet_type, float(self.current_bet)
        return None, 0
        
    def update_result(self, won: bool):
        if won:
            self.consecutive_wins += 1
            self.current_bet = math.floor(self.current_bet * 2)  # Ensure whole number
        else:
            self.consecutive_wins = 0
            self.current_bet = self.base_bet

class Simulator:
    def __init__(self, data_file: str = 'data_flipped.json'):
        with open(data_file, 'r') as f:
            self.data = json.load(f)
        self.results = self.data['results']
        print(f"Loaded {len(self.results)} historical results")
        
    def run_strategy(self, strategy: BettingStrategy, initial_bankroll: float = 300.0, 
                    max_trades: int = 2000) -> SessionResult:
        bankroll_mgr = BankrollManager(initial_bankroll)
        history = []
        trades = []
        doubles_count = 0
        bankruptcies = 0
        
        max_bankroll = initial_bankroll
        min_bankroll = initial_bankroll
        
        trade_count = min(len(self.results), max_trades)
        
        for i in range(trade_count):
            result = self.results[i]
            history.append(result)
            
            # Get bet from strategy
            bet_type, bet_amount = strategy.get_bet(history, bankroll_mgr)
            
            if bet_type is None:
                break  # Can't afford bet
                
            # Place bet
            if not bankroll_mgr.place_bet(bet_amount):
                break
                
            # Calculate outcome
            payout = strategy.calculate_payout(result, bet_type, bet_amount)
            won = payout > 0
            profit = payout - bet_amount
            
            # Update bankroll
            bankroll_mgr.add_winnings(payout)
            
            # Track stats
            max_bankroll = max(max_bankroll, bankroll_mgr.current_bankroll)
            min_bankroll = min(min_bankroll, bankroll_mgr.current_bankroll)
            
            # Check for double or bankruptcy
            doubled, bankrupted = bankroll_mgr.check_double_or_bankrupt()
            
            if doubled:
                doubles_count += 1
                bankroll_mgr.reset_session()
                
            if bankrupted:
                bankruptcies += 1
                bankroll_mgr.reset_session()
                
            # Update strategy (for strategies that need result feedback)
            if hasattr(strategy, 'update_result'):
                strategy.update_result(won)
                
            trades.append(TradeResult(
                strategy=strategy.name,
                bet_amount=bet_amount,
                bet_type=bet_type,
                result=result,
                won=won,
                payout=payout,
                profit=profit,
                bankroll_after=bankroll_mgr.current_bankroll
            ))
            
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
            # Fixed bet strategies
            FixedBetStrategy('small', 1),
            FixedBetStrategy('big', 1),
            FixedBetStrategy('red', 1),
            FixedBetStrategy('green', 1),
            FixedBetStrategy('violet', 1),
            
            # Martingale strategies
            MartingaleStrategy('small', 1),
            MartingaleStrategy('big', 1),
            MartingaleStrategy('red', 1),
            
            # Anti-Martingale strategies
            AntiMartingaleStrategy('small', 1),
            AntiMartingaleStrategy('big', 1),
            
            # Other strategies
            PatternBasedStrategy(),
            AlternatingStrategy(),
            ParoliStrategy('small', 1),
            ParoliStrategy('big', 1),
        ]
        
        results = []
        print("Running benchmark simulation...")
        print("=" * 60)
        
        for i, strategy in enumerate(strategies, 1):
            print(f"[{i}/{len(strategies)}] Testing {strategy.name}...")
            result = self.run_strategy(strategy, initial_bankroll, max_trades)
            results.append(result)
            
        return results
        
    def print_results(self, results: List[SessionResult]):
        print("\n" + "=" * 80)
        print("TRADING STRATEGY BENCHMARK RESULTS")
        print("=" * 80)
        
        # Sort by total profit (descending)
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
            roi = (result.total_profit / 1000) * 100
            print(f"{i+1}. {result.strategy}")
            print(f"   Profit: {result.total_profit:+.2f} ({roi:+.1f}%)")
            print(f"   Doubles: {result.doubles_count}, Bankruptcies: {result.bankruptcies}")
            print(f"   Max Bankroll: {result.max_bankroll:.2f}")

def main():
    print("🎲 AMARCLUB TRADING STRATEGY SIMULATOR (300 Taka Bankroll)")
    print("=" * 55)
    
    simulator = Simulator('data_flipped.json')
    
    # Run benchmark
    results = simulator.benchmark_strategies(initial_bankroll=300.0, max_trades=2000)
    
    # Print results
    simulator.print_results(results)
    
    # Save detailed results to file
    with open('strategy_benchmark_results_300taka.json', 'w') as f:
        json.dump([{
            'strategy': r.strategy,
            'final_bankroll': r.final_bankroll,
            'total_profit': r.total_profit,
            'doubles_count': r.doubles_count,
            'bankruptcies': r.bankruptcies,
            'max_bankroll': r.max_bankroll,
            'min_bankroll': r.min_bankroll,
            'trade_count': r.trade_count
        } for r in results], f, indent=2)
    
    print(f"\n💾 Detailed results saved to strategy_benchmark_results_300taka.json")

if __name__ == "__main__":
    main()
