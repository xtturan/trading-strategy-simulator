#!/usr/bin/env python3
"""
Complete Number List Generator
Creates a list containing all numbers from 1-25 plus specified additional numbers.
"""

def generate_complete_list():
    """Generate complete list with all numbers 1-25 plus additional numbers"""
    
    # Your specified numbers
    specified_numbers = [23, 14, 20, 12, 1]
    
    # Generate complete range 1-25
    complete_range = list(range(1, 26))  # 1 to 25 inclusive
    
    # Combine and remove duplicates while preserving order
    result_list = []
    seen = set()
    
    # First add your specified numbers (maintaining their order)
    for num in specified_numbers:
        if num not in seen and 1 <= num <= 25:
            result_list.append(num)
            seen.add(num)
    
    # Then add remaining numbers from 1-25
    for num in complete_range:
        if num not in seen:
            result_list.append(num)
            seen.add(num)
    
    return result_list

def main():
    complete_list = generate_complete_list()
    
    print("🔢 COMPLETE NUMBER LIST (1-25 + specified numbers)")
    print("=" * 50)
    print(f"Original specified numbers: [23, 14, 20, 12, 1]")
    print(f"Complete list length: {len(complete_list)}")
    print(f"Complete list: {complete_list}")
    print(f"Compact format: [{','.join(map(str, complete_list))}]")
    print()
    
    # Verification
    print("✅ VERIFICATION:")
    print(f"All numbers 1-25 present: {set(range(1, 26)).issubset(set(complete_list))}")
    print(f"Specified numbers included: {all(num in complete_list for num in [23, 14, 20, 12, 1])}")
    print(f"No duplicates: {len(complete_list) == len(set(complete_list))}")
    
    # Show the positioning
    print(f"\n🎯 POSITION ANALYSIS:")
    for num in [23, 14, 20, 12, 1]:
        position = complete_list.index(num) + 1
        print(f"Number {num} is at position {position}")

if __name__ == "__main__":
    main()