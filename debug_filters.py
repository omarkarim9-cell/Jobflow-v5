
# JobFlow AI - Filter Debugging Script
# This script helps analyze why certain jobs passed or failed the extraction filters.

import csv
import sys

def debug_jobs(file_path):
    try:
        with open(file_path, mode='r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            print(f"{'Status':<10} | {'Company':<20} | {'Title'}")
            print("-" * 60)
            for row in reader:
                print(f"{row.get('Status', 'N/A'):<10} | {row.get('Company', 'N/A'):<20} | {row.get('Title', 'N/A')}")
    except FileNotFoundError:
        print(f"Error: {file_path} not found.")
    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    path = "jobflow_debug.csv"
    if len(sys.argv) > 1:
        path = sys.argv[1]
    debug_jobs(path)
