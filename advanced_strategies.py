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

class MomentumStrategy(BettingStrategy):
    """Follow momentum trends in results"""
    
    def __init__(self):
        super().__init__("Momentum")
        self.momentum_window = 5
        
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

class VolatilityBreakoutStrategy(BettingStrategy):
    """Bet on breakout patterns during high volatility periods"""
    
    def __init__(self):
        super().__init__("Volatility_Breakout")
        self.volatility_window = 10
        
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

class CycleDetectionStrategy(BettingStrategy):
    """Detect cyclical patterns in results"""
    
    def __init__(self):
        super().__init__("Cycle_Detection")
        self.cycle_length = 5
        
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