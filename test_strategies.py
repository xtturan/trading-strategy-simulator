#!/usr/bin/env python3
import sys
sys.path.append('/home/zuka/Documents/alltools/amarclubxd/scripts')

# Test importing just the strategy classes
try:
    from trading_strategy_simulator import TrendFollowingStrategy, MomentumStrategy
    
    # Try to instantiate
    tf = TrendFollowingStrategy()
    print("TrendFollowingStrategy instantiated successfully")
    
    momentum = MomentumStrategy()
    print("MomentumStrategy instantiated successfully")
    
    print("All strategies instantiated correctly!")
    
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()