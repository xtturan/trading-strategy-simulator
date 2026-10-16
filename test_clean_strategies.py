#!/usr/bin/env python3
import sys
sys.path.append('/home/zuka/Documents/alltools/amarclubxd/scripts')

# Test the clean strategy classes
try:
    # Import the base classes first
    from trading_strategy_simulator import BettingStrategy, BankrollManager
    from collections import defaultdict
    from typing import List, Tuple
    import math
    
    # Now import our clean strategy classes
    exec(open('/home/zuka/Documents/alltools/amarclubxd/advanced_strategies.py').read())
    
    # Try to instantiate
    tf = TrendFollowingStrategy()
    print("✅ TrendFollowingStrategy instantiated successfully")
    
    momentum = MomentumStrategy()
    print("✅ MomentumStrategy instantiated successfully")
    
    volatility = VolatilityBreakoutStrategy()
    print("✅ VolatilityBreakoutStrategy instantiated successfully")
    
    stat_arb = StatisticalArbitrageStrategy()
    print("✅ StatisticalArbitrageStrategy instantiated successfully")
    
    cycle = CycleDetectionStrategy()
    print("✅ CycleDetectionStrategy instantiated successfully")
    
    print("\n🎉 All advanced strategies instantiated correctly!")
    
    # Quick functionality test
    print("\n--- Functionality Test ---")
    history = [1, 2, 3, 4, 5, 6, 7, 8, 9, 1]
    bankroll_mgr = BankrollManager(300.0)
    
    bet_type, bet_amount = tf.get_bet(history, bankroll_mgr)
    print(f"Trend Following bet: {bet_type} {bet_amount}")
    
    bet_type, bet_amount = momentum.get_bet(history, bankroll_mgr)
    print(f"Momentum bet: {bet_type} {bet_amount}")
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()