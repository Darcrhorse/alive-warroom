#!/usr/bin/env python3
"""
SQF Syntax Tester
Tests generated SQF code without needing Arma 3
Uses basic pattern matching for validation
"""

import sys
import json
import re
from typing import List, Dict, Tuple


class SQFTester:
    """Tests SQF code for syntax and basic validation"""
    
    def __init__(self):
        self.forbidden_commands = [
            'endMission', 'failMission', 'forceEnd', 'terminate',
            'serverCommand', 'admin', 'saveProfileNamespace', 
            'loadFile', 'preprocessFile'
        ]
    
    def test_syntax(self, code: str) -> Tuple[bool, List[str]]:
        """Test SQF code for basic syntax errors"""
        errors = []
        
        # Check brace balance
        if code.count('{') != code.count('}'):
            errors.append("Unbalanced braces")
        
        # Check bracket balance
        if code.count('[') != code.count(']'):
            errors.append("Unbalanced brackets")
        
        # Check parenthesis balance
        if code.count('(') != code.count(')'):
            errors.append("Unbalanced parentheses")
        
        # Check for statements without semicolons (basic check)
        lines = code.split('\n')
        for i, line in enumerate(lines, 1):
            line = line.strip()
            # Skip empty lines, comments, and lines that are just braces
            if not line or line.startswith('//') or line in ['{', '}', '};']:
                continue
            # Lines that should end with semicolon or brace
            if line and not line.endswith((';', '{', '}', '[')):
                # Check if it's a control structure  
                if not any(line.startswith(kw) for kw in ['if', 'then', 'else', 'while', 'for', 'switch', 'case', 'default']):
                    if 'call' not in line or not line.endswith(')'):
                        errors.append(f"Line {i} may be missing semicolon")
        
        return len(errors) == 0, errors
    
    def check_security(self, code: str) -> Tuple[bool, List[str]]:
        """Check for forbidden commands"""
        violations = []
        
        for cmd in self.forbidden_commands:
            if re.search(r'\b' + re.escape(cmd) + r'\b', code, re.IGNORECASE):
                violations.append(f"Forbidden command detected: {cmd}")
        
        return len(violations) == 0, violations
    
    def test_code(self, code: str, name: str = "test") -> Dict:
        """Full test of SQF code"""
        print(f"\n{'=' * 60}")
        print(f"Testing: {name}")
        print(f"{'=' * 60}")
        print(f"Code preview:\n{code[:200]}{'...' if len(code) > 200 else ''}\n")
        
        # Syntax test
        syntax_ok, syntax_errors = self.test_syntax(code)
        
        # Security test
        security_ok, security_violations = self.check_security(code)
        
        # Results
        results = {
            'name': name,
            'syntax_valid': syntax_ok,
            'security_safe': security_ok,
            'syntax_errors': syntax_errors,
            'security_violations': security_violations,
            'overall_pass': syntax_ok and security_ok
        }
        
        # Print results
        print(f"Syntax: {'✓ PASS' if syntax_ok else '✗ FAIL'}")
        if syntax_errors:
            for error in syntax_errors[:5]:  # Limit output
                print(f"  - {error}")
            if len(syntax_errors) > 5:
                print(f"  ... and {len(syntax_errors) - 5} more")
        
        print(f"Security: {'✓ PASS' if security_ok else '✗ FAIL'}")
        if security_violations:
            for violation in security_violations:
                print(f"  - {violation}")
        
        print(f"\nOverall: {'✓ PASS' if results['overall_pass'] else '✗ FAIL'}")
        
        return results


def run_tests():
    """Run test suite"""
    tester = SQFTester()
    
    test_cases = [
        # Valid spawn code
        ("""private _group = createGroup EAST;
_group createUnit ["O_Soldier_F", [100, 200, 0], [], 0, "FORM"];
_group setBehaviour "AWARE";
_group setCombatMode "YELLOW";""", "Valid Unit Spawn"),
        
        # Valid patrol
        ("""private _spawnPos = [100, 200, 0];
private _group = createGroup EAST;
_group createUnit ["O_Soldier_TL_F", _spawnPos, [], 0, "FORM"];
_group createUnit ["O_Soldier_F", _spawnPos, [], 0, "FORM"];
[_group, _spawnPos, 150] call BIS_fnc_taskPatrol;""", "Valid Patrol Setup"),
        
        # Valid task creation
        ("""private _taskId = "task_1";
[
  true,
  _taskId,
  ["Clear the area", "Assault", ""],
  [100, 200, 0],
  "CREATED",
  1,
  true,
  "ATTACK"
] call BIS_fnc_taskCreate;""", "Valid Task Creation"),
        
        # Invalid - missing semicolon
        ("""private _group = createGroup EAST
_group setBehaviour "AWARE";""", "Invalid - Missing Semicolon"),
        
        # Invalid - forbidden command
        ("""private _group = createGroup EAST;
endMission "END1";""", "Invalid - Forbidden Command (endMission)"),
        
        # Invalid - another forbidden command
        ("""serverCommand "#kick player";""", "Invalid - Forbidden Command (serverCommand)"),
        
        # Valid BIS_fnc_spawnGroup
        ("""private _group = [[100,200,0], EAST, ["O_Soldier_TL_F", "O_Soldier_F"]] call BIS_fnc_spawnGroup;
_group setBehaviour "COMBAT";""", "Valid BIS_fnc_spawnGroup"),
        
        # Valid relative positioning
        ("""private _playerPos = getPosATL player;
private _spawnPos = [_playerPos, 300, 90] call BIS_fnc_relPos;
private _group = [_spawnPos, EAST, ["O_Soldier_F"]] call BIS_fnc_spawnGroup;""", "Valid Relative Positioning"),
        
        # Invalid - unbalanced braces
        ("""private _group = createGroup EAST;
if (true) then {
    _group setBehaviour "AWARE";
""", "Invalid - Unbalanced Braces"),
    ]
    
    results = []
    for code, name in test_cases:
        result = tester.test_code(code.strip(), name)
        results.append(result)
    
    # Summary
    print(f"\n{'=' * 60}")
    print("TEST SUMMARY")
    print(f"{'=' * 60}")
    
    passed = sum(1 for r in results if r['overall_pass'])
    total = len(results)
    failed_tests = [r['name'] for r in results if not r['overall_pass']]
    
    print(f"Total: {total}")
    print(f"Passed: {passed}")
    print(f"Failed: {total - passed}")
    print(f"Success Rate: {(passed/total)*100:.1f}%")
    
    if failed_tests:
        print(f"\nFailed tests:")
        for test_name in failed_tests:
            print(f"  - {test_name}")
    
    # Export results
    with open('/tmp/sqf_test_results.json', 'w') as f:
        json.dump(results, f, indent=2)
    
    print(f"\nResults exported to: /tmp/sqf_test_results.json")
    
    return passed, total


if __name__ == '__main__':
    passed, total = run_tests()
    print(f"\n{'✓' if passed >= total - 3 else '✗'} Tests: {passed}/{total} passed")
    # Allow 3 failures for the intentionally broken tests
    sys.exit(0 if passed >= total - 3 else 1)
