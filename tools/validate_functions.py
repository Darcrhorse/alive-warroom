#!/usr/bin/env python3
"""
SQF Function Validator
Validates generated SQF code against official Bohemia Interactive function signatures
"""

import re
import json
from typing import Dict, List, Tuple, Optional


class FunctionValidator:
    """Validates SQF functions against official signatures"""
    
    def __init__(self):
        # Official function signatures from BI Community Wiki
        self.signatures = {
            'createGroup': {
                'syntax': ['createGroup side', 'createGroup [side, deleteWhenEmpty]'],
                'params': {
                    'side': 'Side',
                    'deleteWhenEmpty': 'Boolean'
                },
                'return': 'Group'
            },
            'createUnit': {
                'syntax': ['_group createUnit [type, position, markers, placement, special]'],
                'params': {
                    'group': 'Group',
                    'type': 'String',
                    'position': 'Position/Object',
                    'markers': 'Array',
                    'placement': 'Number',
                    'special': 'String (NONE/FORM/CAN_COLLIDE/CARGO)'
                },
                'return': 'Object'
            },
            'BIS_fnc_spawnGroup': {
                'syntax': ['[position, side, toSpawn, ...] call BIS_fnc_spawnGroup'],
                'params': {
                    'position': 'Position/Object',
                    'side': 'Side',
                    'toSpawn': 'Array/Number/Config'
                },
                'return': 'Group'
            },
            'BIS_fnc_taskPatrol': {
                'syntax': ['[group, position, distance, blacklist] call BIS_fnc_taskPatrol'],
                'params': {
                    'group': 'Group',
                    'position': 'Position/Object',
                    'distance': 'Number'
                },
                'return': 'Boolean'
            },
            'BIS_fnc_taskDefend': {
                'syntax': ['[group, position] call BIS_fnc_taskDefend'],
                'params': {
                    'group': 'Group',
                    'position': 'Position/Object'
                },
                'return': 'Boolean'
            },
            'BIS_fnc_relPos': {
                'syntax': ['[origin, distance, direction] call BIS_fnc_relPos'],
                'params': {
                    'origin': 'Position/Object',
                    'distance': 'Number',
                    'direction': 'Number (0-360)'
                },
                'return': 'Position'
            },
            'BIS_fnc_taskCreate': {
                'syntax': ['[owner, taskID, description, destination, state, ...] call BIS_fnc_taskCreate'],
                'params': {
                    'owner': 'Boolean/Object/Group/Side',
                    'taskID': 'String/Array',
                    'description': 'Array',
                    'destination': 'Position/Object'
                },
                'return': 'String'
            },
            'setBehaviour': {
                'syntax': ['unitOrGroup setBehaviour behaviour'],
                'params': {
                    'behaviour': 'String (CARELESS/SAFE/AWARE/COMBAT/STEALTH)'
                },
                'return': 'Nothing'
            },
            'setCombatMode': {
                'syntax': ['groupOrUnit setCombatMode mode'],
                'params': {
                    'mode': 'String (BLUE/GREEN/WHITE/YELLOW/RED)'
                },
                'return': 'Nothing'
            },
            'addWaypoint': {
                'syntax': ['group addWaypoint [position, radius]'],
                'params': {
                    'position': 'Position',
                    'radius': 'Number'
                },
                'return': 'Waypoint'
            },
            'createVehicle': {
                'syntax': ['type createVehicle position', 'createVehicle [type, position, markers, placement, special]'],
                'params': {
                    'type': 'String',
                    'position': 'Position',
                    'special': 'String (NONE/CAN_COLLIDE/FLY)'
                },
                'return': 'Object'
            }
        }
        
        # Valid enum values
        self.valid_enums = {
            'behaviour': ['CARELESS', 'SAFE', 'AWARE', 'COMBAT', 'STEALTH'],
            'combatMode': ['BLUE', 'GREEN', 'WHITE', 'YELLOW', 'RED'],
            'speedMode': ['LIMITED', 'NORMAL', 'FULL'],
            'special': ['NONE', 'FORM', 'CAN_COLLIDE', 'CARGO', 'FLY'],
            'taskState': ['CREATED', 'ASSIGNED', 'AUTOASSIGNED', 'SUCCEEDED', 'FAILED', 'CANCELED'],
            'side': ['EAST', 'WEST', 'INDEPENDENT', 'CIVILIAN', 'SIDELOGIC']
        }
    
    def validate_function_call(self, code: str) -> Tuple[bool, List[str]]:
        """Validate that function calls match official signatures"""
        issues = []
        
        # Check BIS_fnc_spawnGroup calls
        spawn_group_pattern = r'\[\s*([^\]]+)\s*\]\s*call\s+BIS_fnc_spawnGroup'
        for match in re.finditer(spawn_group_pattern, code):
            params = match.group(1)
            # Check minimum parameters (position, side, toSpawn)
            param_count = params.count(',') + 1
            if param_count < 3:
                issues.append(f"BIS_fnc_spawnGroup requires at least 3 parameters (position, side, toSpawn), found {param_count}")
        
        # Check BIS_fnc_taskPatrol calls
        patrol_pattern = r'\[\s*([^\]]+)\s*\]\s*call\s+BIS_fnc_taskPatrol'
        for match in re.finditer(patrol_pattern, code):
            params = match.group(1)
            param_count = params.count(',') + 1
            if param_count < 3:
                issues.append(f"BIS_fnc_taskPatrol requires at least 3 parameters (group, position, distance), found {param_count}")
        
        # Check BIS_fnc_taskDefend calls
        defend_pattern = r'\[\s*([^\]]+)\s*\]\s*call\s+BIS_fnc_taskDefend'
        for match in re.finditer(defend_pattern, code):
            params = match.group(1)
            param_count = params.count(',') + 1
            if param_count < 2:
                issues.append(f"BIS_fnc_taskDefend requires at least 2 parameters (group, position), found {param_count}")
        
        # Check BIS_fnc_relPos calls
        relpos_pattern = r'\[\s*([^\]]+)\s*\]\s*call\s+BIS_fnc_relPos'
        for match in re.finditer(relpos_pattern, code):
            params = match.group(1)
            param_count = params.count(',') + 1
            if param_count < 3:
                issues.append(f"BIS_fnc_relPos requires 3 parameters (origin, distance, direction), found {param_count}")
        
        # Check behaviour values
        behaviour_pattern = r'setBehaviour\s+"([^"]+)"'
        for match in re.finditer(behaviour_pattern, code):
            value = match.group(1).upper()
            if value not in self.valid_enums['behaviour']:
                issues.append(f"Invalid behaviour '{value}', must be one of: {', '.join(self.valid_enums['behaviour'])}")
        
        # Check combat mode values
        combat_pattern = r'setCombatMode\s+"([^"]+)"'
        for match in re.finditer(combat_pattern, code):
            value = match.group(1).upper()
            if value not in self.valid_enums['combatMode']:
                issues.append(f"Invalid combat mode '{value}', must be one of: {', '.join(self.valid_enums['combatMode'])}")
        
        # Check createUnit special parameter
        createunit_pattern = r'createUnit\s*\[.*?,.*?,.*?,.*?,\s*"([^"]+)"\s*\]'
        for match in re.finditer(createunit_pattern, code):
            value = match.group(1).upper()
            if value not in self.valid_enums['special']:
                issues.append(f"Invalid createUnit special '{value}', must be one of: {', '.join(self.valid_enums['special'])}")
        
        # Check side values
        side_pattern = r'createGroup\s+(\w+)'
        for match in re.finditer(side_pattern, code):
            value = match.group(1).upper()
            if value not in self.valid_enums['side']:
                issues.append(f"Invalid side '{value}', must be one of: {', '.join(self.valid_enums['side'])}")
        
        return len(issues) == 0, issues
    
    def validate_distances(self, code: str) -> Tuple[bool, List[str]]:
        """Validate minimum safe spawn distances"""
        issues = []
        
        # Check BIS_fnc_relPos distances
        relpos_pattern = r'\[\s*[^,]+,\s*(\d+)\s*,\s*\d+\s*\]\s*call\s+BIS_fnc_relPos'
        for match in re.finditer(relpos_pattern, code):
            distance = int(match.group(1))
            if distance < 150:
                issues.append(f"BIS_fnc_relPos distance {distance}m is too close (recommend 200m+ for infantry, 300m+ for vehicles)")
        
        return len(issues) == 0, issues
    
    def generate_report(self, code: str) -> Dict:
        """Generate comprehensive validation report"""
        func_valid, func_issues = self.validate_function_call(code)
        dist_valid, dist_issues = self.validate_distances(code)
        
        # Count function usage
        function_usage = {}
        for func_name in self.signatures.keys():
            count = len(re.findall(func_name, code))
            if count > 0:
                function_usage[func_name] = count
        
        return {
            'valid': func_valid and dist_valid,
            'function_validation': {
                'valid': func_valid,
                'issues': func_issues
            },
            'distance_validation': {
                'valid': dist_valid,
                'issues': dist_issues
            },
            'function_usage': function_usage,
            'total_issues': len(func_issues) + len(dist_issues)
        }


def validate_test_suite():
    """Validate all test cases against official function signatures"""
    import sys
    sys.path.insert(0, '/home/runner/work/alive-warroom/alive-warroom/tools')
    
    from e2e_llm_tests import generate_e2e_test_suite
    
    validator = FunctionValidator()
    test_suite = generate_e2e_test_suite()
    
    print("=" * 80)
    print(" " * 20 + "FUNCTION SIGNATURE VALIDATION")
    print("=" * 80)
    print()
    print(f"Validating {len(test_suite)} E2E test scenarios against official BI Wiki signatures...")
    print()
    
    all_valid = True
    total_issues = 0
    scenarios_with_issues = []
    
    for test_case in test_suite:
        report = validator.generate_report(test_case.expected_llm_response.sqf_code)
        
        if not report['valid']:
            all_valid = False
            total_issues += report['total_issues']
            scenarios_with_issues.append({
                'name': test_case.name,
                'issues': report['function_validation']['issues'] + report['distance_validation']['issues']
            })
    
    # Results
    if all_valid:
        print("✓" * 80)
        print("✓ ALL TESTS PASS OFFICIAL FUNCTION SIGNATURE VALIDATION!")
        print("✓" * 80)
        print()
        print("All generated SQF code matches official Bohemia Interactive signatures.")
        print("Functions validated:")
        
        # Aggregate function usage
        all_usage = {}
        for test_case in test_suite:
            report = validator.generate_report(test_case.expected_llm_response.sqf_code)
            for func, count in report['function_usage'].items():
                all_usage[func] = all_usage.get(func, 0) + count
        
        for func, count in sorted(all_usage.items()):
            print(f"  - {func}: {count} usages")
        
        print()
        print("✓ 100% VALIDATION SUCCESS RATE")
        return 0
    else:
        print("❌ VALIDATION ISSUES DETECTED")
        print("=" * 80)
        print(f"Total issues: {total_issues}")
        print(f"Scenarios with issues: {len(scenarios_with_issues)}")
        print()
        
        for scenario in scenarios_with_issues[:10]:
            print(f"\n❌ {scenario['name']}")
            for issue in scenario['issues'][:3]:
                print(f"   - {issue}")
        
        if len(scenarios_with_issues) > 10:
            print(f"\n... and {len(scenarios_with_issues) - 10} more scenarios with issues")
        
        return 1


if __name__ == '__main__':
    exit_code = validate_test_suite()
    exit(exit_code)
