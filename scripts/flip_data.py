#!/usr/bin/env python3
"""
Script to reverse the order of data in data.json
Flips the results array so oldest data comes first, newest last
"""

import json
import sys
from datetime import datetime

def flip_data_json(input_file='data.json', output_file='data_flipped.json'):
    """
    Flip the order of results in data.json
    
    Args:
        input_file (str): Path to input JSON file
        output_file (str): Path to output JSON file
    """
    try:
        # Read the original data
        with open(input_file, 'r') as f:
            data = json.load(f)
        
        print(f"Original data stats:")
        print(f"  Total results: {data['totalResults']}")
        print(f"  Pages scraped: {data['pagesScraped']}")
        print(f"  Export date: {data['exportDate']}")
        print(f"  Results array length: {len(data['results'])}")
        
        # Store original first and last few elements for verification
        original_first = data['results'][:5]
        original_last = data['results'][-5:]
        
        print(f"\nOriginal first 5: {original_first}")
        print(f"Original last 5:  {original_last}")
        
        # Reverse the results array
        data['results'].reverse()
        
        # Update export date
        data['exportDate'] = datetime.utcnow().isoformat() + 'Z'
        
        # Store new first and last few elements
        new_first = data['results'][:5]
        new_last = data['results'][-5:]
        
        print(f"\nAfter flipping:")
        print(f"  New first 5: {new_first}")
        print(f"  New last 5:  {new_last}")
        
        # Write to output file
        with open(output_file, 'w') as f:
            json.dump(data, f, indent=2)
        
        print(f"\n✅ Successfully flipped data!")
        print(f"   Output saved to: {output_file}")
        print(f"   You can now replace the original file if needed")
        
        return True
        
    except FileNotFoundError:
        print(f"❌ Error: {input_file} not found")
        return False
    except json.JSONDecodeError as e:
        print(f"❌ Error: Invalid JSON format - {e}")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def replace_original():
    """Replace the original data.json with flipped version"""
    import os
    import shutil
    
    original = 'data.json'
    flipped = 'data_flipped2.json'
    backup = 'data_backup.json'
    
    try:
        # Create backup
        shutil.copy2(original, backup)
        print(f"✅ Backup created: {backup}")
        
        # Replace original with flipped version
        shutil.move(flipped, original)
        print(f"✅ Original file replaced with flipped version")
        print(f"   Backup saved as: {backup}")
        
        return True
    except Exception as e:
        print(f"❌ Error replacing files: {e}")
        return False

if __name__ == "__main__":
    print("🔄 Data Flipping Tool")
    print("=" * 30)
    
    # Flip the data
    if flip_data_json():
        print("\nOptions:")
        print("1. Keep both files (original + flipped)")
        print("2. Replace original with flipped version (creates backup)")
        print("3. Exit without changes")
        
        choice = input("\nEnter your choice (1/2/3): ").strip()
        
        if choice == '2':
            replace_original()
        elif choice == '1':
            print("✅ Keeping both files")
        else:
            print("✅ No changes made")
    else:
        print("❌ Failed to flip data")
        sys.exit(1)
