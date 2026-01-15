import sys
import os
import re

def validate_sqf(filepath):
    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        code = f.read()
    
    errors = []
    filename = os.path.basename(filepath)
    
    # Check bracket balance
    if code.count('{') != code.count('}'):
        errors.append(f"Unbalanced braces: {{ = {code.count('{')}, }} = {code.count('}')}")
    
    if code.count('[') != code.count(']'):
        errors.append(f"Unbalanced brackets: [ = {code.count('[')}, ] = {code.count(']')}")
    
    if code.count('(') != code.count(')'):
        errors.append(f"Unbalanced parentheses: ( = {code.count('(')}, ) = {code.count(')')}")
    
    # Check for forbidden commands
    forbidden = ['endMission', 'failMission', 'forceEnd', 'serverCommand', 'admin', 'deleteVehicle player']
    for cmd in forbidden:
        if re.search(r'\b' + re.escape(cmd) + r'\b', code, re.IGNORECASE):
            errors.append(f"Forbidden command: {cmd}")
    
    # Check for common syntax issues
    lines = code.split('\n')
    for i, line in enumerate(lines, 1):
        stripped = line.strip()
        # Skip comments and empty lines
        if not stripped or stripped.startswith('//'):
            continue
        # Check for stray brackets (] without matching [ on same line, excluding array definitions)
        open_b = line.count('[')
        close_b = line.count(']')
        if close_b > open_b and '];' not in line and '] call' not in line and '] spawn' not in line and '] foreach' not in line.lower():
            # Could be legitimate multi-line array
            pass
    
    return errors

# Validate all files
folder = sys.argv[1] if len(sys.argv) > 1 else '.'
all_valid = True
for f in os.listdir(folder):
    if f.endswith('.sqf'):
        filepath = os.path.join(folder, f)
        errors = validate_sqf(filepath)
        if errors:
            print(f"❌ {f}")
            for e in errors:
                print(f"   {e}")
            all_valid = False
        else:
            print(f"✓ {f}")

sys.exit(0 if all_valid else 1)
