#!/usr/bin/env python3
import json
from collections import Counter

# Load data
with open('data/data_flipped.json', 'r') as f:
    data = json.load(f)
results = data['results']

print('=== FLAW ANALYSIS ===')
print(f'Total trades: {len(results)}')
print()

# Test the flawed current logic (cheating)
print('CURRENT FLAWED LOGIC (cheating):')
flawed_wins = 0
for i in range(5, min(30, len(results))):
    # This is the CURRENT flawed logic - includes current result!
    recent_with_current = results[i-4:i+1]  # This is wrong! Includes result[i]
    most_frequent_cheat = Counter(recent_with_current).most_common(1)[0][0]
    current_result = results[i]
    
    if most_frequent_cheat == current_result:
        flawed_wins += 1
        print(f'Trade {i+1}: Recent={recent_with_current}, Bet={most_frequent_cheat}, Result={current_result} → WIN (cheating!)')

print(f'Flawed win rate: {flawed_wins}/{25} = {flawed_wins/25*100:.1f}%')
print()

# Test correct logic (no cheating)
print('CORRECT LOGIC (no cheating):')
correct_wins = 0
for i in range(5, min(30, len(results))):
    # This is the CORRECT logic - only uses past results
    recent_past_only = results[i-5:i]  # Only past 5 results
    most_frequent_correct = Counter(recent_past_only).most_common(1)[0][0]
    current_result = results[i]
    
    if most_frequent_correct == current_result:
        correct_wins += 1
        print(f'Trade {i+1}: Past={recent_past_only}, Bet={most_frequent_correct}, Result={current_result} → WIN')

print(f'Correct win rate: {correct_wins}/{25} = {correct_wins/25*100:.1f}%')
print()

print('=== EXPLANATION ===')
print('The current Pattern_Based strategy is cheating by including the current result')
print('in its frequency calculation, which gives it artificial "predictive power".')
print('With truly random data, the correct win rate should be around 10% (1 in 10 numbers).')