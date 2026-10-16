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
        # Keep decimal precision for bankroll
        self.current_bankroll += amount
        
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
    """Bet based on patterns from truly historical data (excluding current trade)"""
    
    def __init__(self):
        super().__init__("Pattern_Based_Corrected")
        
    def get_bet(self, history: List[int], bankroll_manager: BankrollManager) -> Tuple[str, float]:
        # Need at least 6 trades to have 5 past results plus current
        if len(history) < 6:
            return 'small', 1.0
            
        # Use only the 5 results before the current trade
        # history[:-1] excludes the current result that was just appended
        recent_past = history[-6:-1]  # Last 5 results excluding current
        
        # Count frequencies of truly past results
        counts = defaultdict(int)
        for num in recent_past:
            counts[num] += 1
            
        # Find most frequent number from truly past results
        most_frequent = max(counts.items(), key=lambda x: x[1])[0]
        
        # Bet on the most frequent number from PAST results only
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

class CycleDetectionStrategy(BettingStrategy):
    """Detect cyclical patterns in results"""
    
    def __init__(self):
        super().__init__("Cycle_Detection")
        self.cycle_length = 5
        self.pattern_memory = []
        
    def get_bet(self, history: List[int], bankroll_manager: BankrollManager) -> Tuple[str, float]:
        if len(history) < self.cycle_length * 2:
            return 'small', 1.0
            
        # Look for repeating patterns
        recent = history[-self.cycle_length:]
        
        # Check if pattern repeats
        pattern_found = False
        for i in range(len(history) - self.cycle_length * 2, len(history) - self.cycle_length):
            if history[i:i+self.cycle_length] == recent:
                pattern_found = True
                break
                
        if pattern_found and len(history) > self.cycle_length:
            # Predict next number based on cycle
            next_expected = history[-self.cycle_length]
            if bankroll_manager.can_afford(1):
                return f"number_{next_expected}", 1.0
                
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
            
        # Update frequency tracking
        for num in history[-20:]:  # Last 20 trades
            self.number_frequency[num] += 1
        self.total_bets += 20
            
        # Find under-represented numbers (statistical opportunity)
        expected_freq = self.total_bets / 10  # Expected frequency per number
        underrepresented = []
        
        for num in range(10):
            actual_freq = self.number_frequency[num]
            if actual_freq < expected_freq * 0.7:  # 30% below expected
                underrepresented.append(num)
                
        if underrepresented and bankroll_manager.can_afford(1):
            # Bet on most under-represented number
            target = min(underrepresented, key=lambda x: self.number_frequency[x])
            return f"number_{target}", 1.0
            
        return 'small', 1.0

class VolatilityBreakoutStrategy(BettingStrategy):
    """Bet on breakout patterns during high volatility periods"""
    
    def __init__(self):
        super().__init__("Volatility_Breakout")
        self.volatility_window = 10
        self.last_volatility = 0
        
    def get_bet(self, history: List[int], bankroll_manager: BankrollManager) -> Tuple[str, float]:
        if len(history) < self.volatility_window:
            return 'small', 1.0
            
        # Calculate recent volatility (standard deviation of differences)
        recent_changes = [abs(history[i] - history[i-1]) for i in range(len(history)-self.volatility_window+1, len(history))]
        if len(recent_changes) > 1:
            import statistics
            current_volatility = statistics.stdev(recent_changes) if len(recent_changes) > 1 else 0
        else:
            current_volatility = 0
            
        # High volatility detection
        if current_volatility > 2.5 and len(history) > 5:  # High volatility threshold
            # During high volatility, bet on continuation of current trend
            recent_avg = sum(history[-3:]) / 3
            current_result = history[-1]
            
            if current_result > recent_avg and bankroll_manager.can_afford(1):
                return 'big', 1.0
            elif current_result < recent_avg and bankroll_manager.can_afford(1):
                return 'small', 1.0
                
        self.last_volatility = current_volatility
        return 'small', 1.0

class MomentumStrategy(BettingStrategy):
    """Follow momentum trends in results"""
    
    def __init__(self):
        super().__init__("Momentum")
        self.momentum_window = 5
        self.consecutive_direction = 0  # Positive = up, Negative = down
        
    def get_bet(self, history: List[int], bankroll_manager: BankrollManager) -> Tuple[str, float]:
        if len(history) < self.momentum_window:
            return 'small', 1.0
            
        # Calculate momentum (direction of recent changes)
        recent_changes = [history[i] - history[i-1] for i in range(len(history)-self.momentum_window+1, len(history))]
        positive_changes = sum(1 for change in recent_changes if change > 0)
        negative_changes = sum(1 for change in recent_changes if change < 0)
        
        # Strong momentum detection
        if positive_changes >= 4 and bankroll_manager.can_afford(1):  # 4+ out of 5 positive
            return 'big', 1.0
        elif negative_changes >= 4 and bankroll_manager.can_afford(1):  # 4+ out of 5 negative
            return 'small', 1.0
            
        return 'small', 1.0

class TrendFollowingStrategy(BettingStrategy):
    """Follow established trends using moving averages"""
    
    def __init__(self):
        super().__init__("Trend_Following")
        self.short_window = 3
        self.long_window = 8
        
    def get_bet(self, history: List[int], bankroll_manager: BankrollManager) -> Tuple[str, float]:
        if len(history) < self.long_window:
            return 'small', 1.0
            
        # Calculate moving averages
        short_ma = sum(history[-self.short_window:]) / self.short_window
        long_ma = sum(history[-self.long_window:]) / self.long_window
        
        # Trend detection
        if short_ma > long_ma + 1 and bankroll_manager.can_afford(1):  # Bullish trend
            return 'big', 1.0
        elif short_ma < long_ma - 1 and bankroll_manager.can_afford(1):  # Bearish trend
            return 'small', 1.0
            
        return 'small', 1.0
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
    def __init__(self, data_file: str = '../data/data_flipped.json'):
        with open(data_file, 'r') as f:
            self.data = json.load(f)
        self.results = self.data['results']
        print(f"Loaded {len(self.results)} historical results")
        self.top_strategies = []  # Will store top 3 strategy names
        self.detailed_trades = {}  # Will store detailed trade logs for top strategies
        
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
            
            # Get bet from strategy
            bet_type, bet_amount = strategy.get_bet(history, bankroll_mgr)
            
            if bet_type is None:
                break  # Can't afford bet
                
            # Record bankroll before bet
            bankroll_before = bankroll_mgr.current_bankroll
            
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
                
            # Create trade result
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
            
            # Track detailed trades for top strategies
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
                
        # Store detailed trades if this is a top strategy
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
            
            # Advanced strategies
            PatternBasedStrategy(),  # Our corrected version
            AlternatingStrategy(),
            ParoliStrategy('small', 1),
            ParoliStrategy('big', 1),
            
            # NEW ADVANCED STRATEGIES
            TrendFollowingStrategy(),
            MomentumStrategy(),
            # VolatilityBreakoutStrategy(),
            # StatisticalArbitrageStrategy(),
            # CycleDetectionStrategy(),
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
                # Find existing result
                existing_result = next((r for r in results if r.strategy == strategy.name), None)
                if existing_result:
                    detailed_results.append(existing_result)
                    
        return detailed_results
        
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
            roi = (result.total_profit / 300) * 100
            print(f"{i+1}. {result.strategy}")
            print(f"   Profit: {result.total_profit:+.2f} ({roi:+.1f}%)")
            print(f"   Doubles: {result.doubles_count}, Bankruptcies: {result.bankruptcies}")
            print(f"   Max Bankroll: {result.max_bankroll:.2f}")
            
    def print_detailed_trades(self):
        """Print detailed trade information for top 3 strategies"""
        if not self.detailed_trades:
            print("No detailed trade data available")
            return
            
        print("\n" + "=" * 100)
        print("DETAILED TRADE LOGS FOR TOP 3 STRATEGIES")
        print("=" * 100)
        
        for strategy_name, trades in self.detailed_trades.items():
            print(f"\n📊 STRATEGY: {strategy_name}")
            print("-" * 60)
            print(f"{'Trade':<6} {'Bet Type':<12} {'Amount':<8} {'Result':<8} {'Won':<6} {'Payout':<8} {'Profit':<8} {'Bankroll':<10}")
            print("-" * 60)
            
            # Show first 20 trades and last 10 trades for brevity
            if len(trades) > 30:
                # First 20 trades
                for trade in trades[:20]:
                    won_symbol = "✅" if trade['won'] else "❌"
                    print(f"{trade['trade_number']:<6} {trade['bet_type']:<12} {trade['bet_amount']:<8.0f} "
                          f"{trade['result']:<8} {won_symbol:<6} {trade['payout']:<8.0f} "
                          f"{trade['profit']:<8.0f} {trade['bankroll_after']:<10.0f}")
                
                print("      ...")
                
                # Last 10 trades
                for trade in trades[-10:]:
                    won_symbol = "✅" if trade['won'] else "❌"
                    print(f"{trade['trade_number']:<6} {trade['bet_type']:<12} {trade['bet_amount']:<8.0f} "
                          f"{trade['result']:<8} {won_symbol:<6} {trade['payout']:<8.0f} "
                          f"{trade['profit']:<8.0f} {trade['bankroll_after']:<10.0f}")
            else:
                # Show all trades if <= 30
                for trade in trades:
                    won_symbol = "✅" if trade['won'] else "❌"
                    print(f"{trade['trade_number']:<6} {trade['bet_type']:<12} {trade['bet_amount']:<8.0f} "
                          f"{trade['result']:<8} {won_symbol:<6} {trade['payout']:<8.0f} "
                          f"{trade['profit']:<8.0f} {trade['bankroll_after']:<10.0f}")
            
            # Summary statistics
            total_trades = len(trades)
            wins = sum(1 for t in trades if t['won'])
            total_profit = sum(t['profit'] for t in trades)
            avg_bet = sum(t['bet_amount'] for t in trades) / total_trades if total_trades > 0 else 0
            max_bankroll = max(t['bankroll_after'] for t in trades)
            min_bankroll = min(t['bankroll_after'] for t in trades)
            
            print("-" * 60)
            print(f"Summary: {wins}/{total_trades} wins ({wins/total_trades*100:.1f}%) | "
                  f"Total Profit: {total_profit:+.0f} | Avg Bet: {avg_bet:.0f}")
            print(f"Bankroll Range: {min_bankroll:.0f} → {max_bankroll:.0f}")
    
    def save_detailed_reports(self, results=None):
        """Save detailed trade reports to JSON files"""
        if not self.detailed_trades:
            return
            
        # Save detailed trades
        detailed_filename = '../data/detailed_trade_logs.json'
        with open(detailed_filename, 'w') as f:
            json.dump(self.detailed_trades, f, indent=2)
        print(f"\n💾 Detailed trade logs saved to {detailed_filename}")
        
        # Save summary report
        summary_data = {}
        for strategy_name, trades in self.detailed_trades.items():
            total_trades = len(trades)
            wins = sum(1 for t in trades if t['won'])
            total_profit = sum(t['profit'] for t in trades)
            max_bankroll = max(t['bankroll_after'] for t in trades)
            min_bankroll = min(t['bankroll_after'] for t in trades)
            
            summary_data[strategy_name] = {
                'total_trades': total_trades,
                'wins': wins,
                'win_rate': f"{wins/total_trades*100:.1f}%" if total_trades > 0 else "0%",
                'total_profit': total_profit,
                'max_bankroll': max_bankroll,
                'min_bankroll': min_bankroll,
                'first_trade': trades[0] if trades else None,
                'last_trade': trades[-1] if trades else None
            }
            
        summary_filename = '../data/trade_summary_report.json'
        with open(summary_filename, 'w') as f:
            json.dump(summary_data, f, indent=2)
        print(f"💾 Trade summary report saved to {summary_filename}")
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
    print("🎲 AMARCLUB ADVANCED TRADING STRATEGY BENCHMARK (300 Taka Bankroll)")
    print("=" * 68)
    
    simulator = Simulator('../data/data_flipped.json')
    
    # Run full benchmark with all strategies
    results = simulator.benchmark_strategies(initial_bankroll=300.0, max_trades=2000)
    
    # Print results
    simulator.print_results(results)
    
    # Print detailed trade information for top 3
    simulator.print_detailed_trades()
    
    # Save detailed reports
    simulator.save_detailed_reports(results)
    
    # Save benchmark results
    with open('../data/advanced_strategy_benchmark.json', 'w') as f:
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
    
    print(f"\n💾 Advanced benchmark results saved to ../data/advanced_strategy_benchmark.json")

if __name__ == "__main__":
    main()
