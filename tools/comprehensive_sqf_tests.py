#!/usr/bin/env python3
"""
Comprehensive SQF Test Suite
Tests 100+ scenarios for LLM-generated SQF code validation
"""

import sys
import json
import re
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass
from enum import Enum


class TestCategory(Enum):
    """Test categories"""
    UNIT_SPAWNING = "Unit Spawning"
    VEHICLE_SPAWNING = "Vehicle Spawning"
    WAYPOINTS = "Waypoints & Movement"
    TASKS = "Task Creation"
    TRIGGERS = "Triggers & Events"
    MARKERS = "Markers"
    GROUPS = "Group Management"
    AI_BEHAVIOR = "AI Behavior"
    POSITIONING = "Positioning Functions"
    SECURITY = "Security Violations"
    SYNTAX_ERRORS = "Syntax Errors"
    ADVANCED = "Advanced Scenarios"


@dataclass
class TestCase:
    """SQF test case"""
    name: str
    code: str
    category: TestCategory
    should_pass: bool
    expected_errors: Optional[List[str]] = None


class ComprehensiveSQFTester:
    """Comprehensive SQF code tester"""
    
    def __init__(self):
        self.forbidden_commands = [
            'endMission', 'failMission', 'forceEnd', 'terminate',
            'serverCommand', 'admin', 'saveProfileNamespace', 
            'loadFile', 'preprocessFile', 'compileScript',
            'exportJIPMessages', 'serverCommandAvailable'
        ]
        
        self.forbidden_patterns = [
            (r'deleteVehicle\s+player', 'deleteVehicle player'),
            (r'setDamage\s+1\s*;?\s*player', 'setDamage 1 on player'),
            (r'player\s+setDamage\s+1', 'player setDamage 1'),
        ]
    
    def test_syntax(self, code: str) -> Tuple[bool, List[str]]:
        """Test SQF code for syntax errors"""
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
        
        # Check for strings with unmatched quotes
        # Simple check: count quotes not in comments
        lines_without_comments = []
        for line in code.split('\n'):
            comment_pos = line.find('//')
            if comment_pos != -1:
                line = line[:comment_pos]
            lines_without_comments.append(line)
        
        code_without_comments = '\n'.join(lines_without_comments)
        
        # Check double quotes
        if code_without_comments.count('"') % 2 != 0:
            errors.append("Unmatched double quotes")
        
        # Check single quotes
        if code_without_comments.count("'") % 2 != 0:
            errors.append("Unmatched single quotes")
        
        return len(errors) == 0, errors
    
    def check_security(self, code: str) -> Tuple[bool, List[str]]:
        """Check for security violations"""
        violations = []
        
        # Check forbidden commands
        for cmd in self.forbidden_commands:
            if re.search(r'\b' + re.escape(cmd) + r'\b', code, re.IGNORECASE):
                violations.append(f"Forbidden command: {cmd}")
        
        # Check forbidden patterns
        for pattern, desc in self.forbidden_patterns:
            if re.search(pattern, code, re.IGNORECASE):
                violations.append(f"Forbidden pattern: {desc}")
        
        return len(violations) == 0, violations
    
    def test_code(self, test_case: TestCase) -> Dict:
        """Test a single test case"""
        syntax_ok, syntax_errors = self.test_syntax(test_case.code)
        security_ok, security_violations = self.check_security(test_case.code)
        
        overall_pass = syntax_ok and security_ok
        test_pass = overall_pass == test_case.should_pass
        
        return {
            'name': test_case.name,
            'category': test_case.category.value,
            'should_pass': test_case.should_pass,
            'syntax_valid': syntax_ok,
            'security_safe': security_ok,
            'syntax_errors': syntax_errors,
            'security_violations': security_violations,
            'overall_pass': overall_pass,
            'test_pass': test_pass
        }


def generate_test_suite() -> List[TestCase]:
    """Generate comprehensive test suite with 100+ tests"""
    tests = []
    
    # ============================================================
    # UNIT SPAWNING TESTS (20 tests)
    # ============================================================
    
    # Valid unit spawning
    tests.extend([
        TestCase(
            "Unit Spawn - Basic Infantry",
            '''private _group = createGroup EAST;
private _unit = _group createUnit ["O_Soldier_F", [100, 200, 0], [], 0, "NONE"];''',
            TestCategory.UNIT_SPAWNING,
            True
        ),
        TestCase(
            "Unit Spawn - Squad with loadout",
            '''private _group = createGroup EAST;
private _leader = _group createUnit ["O_Soldier_TL_F", [100, 200, 0], [], 0, "FORM"];
private _rifleman = _group createUnit ["O_Soldier_F", [100, 200, 0], [], 0, "FORM"];
private _medic = _group createUnit ["O_medic_F", [100, 200, 0], [], 0, "FORM"];
removeAllWeapons _medic;
_medic addWeapon "hgun_P07_F";''',
            TestCategory.UNIT_SPAWNING,
            True
        ),
        TestCase(
            "Unit Spawn - Multiple groups",
            '''private _group1 = createGroup EAST;
private _group2 = createGroup EAST;
_group1 createUnit ["O_Soldier_F", [100, 200, 0], [], 0, "FORM"];
_group2 createUnit ["O_Soldier_F", [150, 250, 0], [], 0, "FORM"];''',
            TestCategory.UNIT_SPAWNING,
            True
        ),
        TestCase(
            "Unit Spawn - BIS_fnc_spawnGroup",
            '''private _group = [[100, 200, 0], EAST, ["O_Soldier_TL_F", "O_Soldier_F", "O_Soldier_AR_F"]] call BIS_fnc_spawnGroup;''',
            TestCategory.UNIT_SPAWNING,
            True
        ),
        TestCase(
            "Unit Spawn - West faction",
            '''private _group = createGroup WEST;
_group createUnit ["B_Soldier_F", [100, 200, 0], [], 0, "FORM"];''',
            TestCategory.UNIT_SPAWNING,
            True
        ),
        TestCase(
            "Unit Spawn - Independent faction",
            '''private _group = createGroup INDEPENDENT;
_group createUnit ["I_Soldier_F", [100, 200, 0], [], 0, "FORM"];''',
            TestCategory.UNIT_SPAWNING,
            True
        ),
        TestCase(
            "Unit Spawn - With skill settings",
            '''private _group = createGroup EAST;
private _unit = _group createUnit ["O_Soldier_F", [100, 200, 0], [], 0, "FORM"];
_unit setSkill 0.8;
_unit setSkill ["aimingAccuracy", 0.7];''',
            TestCategory.UNIT_SPAWNING,
            True
        ),
        TestCase(
            "Unit Spawn - With rank",
            '''private _group = createGroup EAST;
private _unit = _group createUnit ["O_Soldier_F", [100, 200, 0], [], 0, "FORM"];
_unit setRank "SERGEANT";''',
            TestCategory.UNIT_SPAWNING,
            True
        ),
        TestCase(
            "Unit Spawn - Sniper team",
            '''private _group = createGroup EAST;
private _sniper = _group createUnit ["O_sniper_F", [100, 200, 0], [], 0, "FORM"];
private _spotter = _group createUnit ["O_spotter_F", [100, 200, 0], [], 0, "FORM"];''',
            TestCategory.UNIT_SPAWNING,
            True
        ),
        TestCase(
            "Unit Spawn - AT team",
            '''private _group = createGroup EAST;
_group createUnit ["O_Soldier_TL_F", [100, 200, 0], [], 0, "FORM"];
_group createUnit ["O_Soldier_AT_F", [100, 200, 0], [], 0, "FORM"];
_group createUnit ["O_Soldier_AT_F", [100, 200, 0], [], 0, "FORM"];''',
            TestCategory.UNIT_SPAWNING,
            True
        ),
    ])
    
    # ============================================================
    # VEHICLE SPAWNING TESTS (15 tests)
    # ============================================================
    
    tests.extend([
        TestCase(
            "Vehicle Spawn - Basic",
            '''private _veh = createVehicle ["O_MRAP_02_F", [100, 200, 0], [], 0, "NONE"];''',
            TestCategory.VEHICLE_SPAWNING,
            True
        ),
        TestCase(
            "Vehicle Spawn - With crew",
            '''private _veh = createVehicle ["O_MRAP_02_F", [100, 200, 0], [], 0, "NONE"];
private _group = createGroup EAST;
private _driver = _group createUnit ["O_Soldier_F", [0, 0, 0], [], 0, "FORM"];
_driver moveInDriver _veh;''',
            TestCategory.VEHICLE_SPAWNING,
            True
        ),
        TestCase(
            "Vehicle Spawn - Tank",
            '''private _tank = createVehicle ["O_MBT_02_cannon_F", [100, 200, 0], [], 0, "NONE"];''',
            TestCategory.VEHICLE_SPAWNING,
            True
        ),
        TestCase(
            "Vehicle Spawn - Helicopter",
            '''private _heli = createVehicle ["O_Heli_Light_02_unarmed_F", [100, 200, 50], [], 0, "FLY"];''',
            TestCategory.VEHICLE_SPAWNING,
            True
        ),
        TestCase(
            "Vehicle Spawn - With fuel and ammo",
            '''private _veh = createVehicle ["O_MRAP_02_F", [100, 200, 0], [], 0, "NONE"];
_veh setFuel 1;
_veh setVehicleAmmo 1;''',
            TestCategory.VEHICLE_SPAWNING,
            True
        ),
        TestCase(
            "Vehicle Spawn - Multiple vehicles",
            '''private _veh1 = createVehicle ["O_MRAP_02_F", [100, 200, 0], [], 0, "NONE"];
private _veh2 = createVehicle ["O_MRAP_02_F", [120, 200, 0], [], 0, "NONE"];
private _veh3 = createVehicle ["O_Truck_03_transport_F", [140, 200, 0], [], 0, "NONE"];''',
            TestCategory.VEHICLE_SPAWNING,
            True
        ),
        TestCase(
            "Vehicle Spawn - APС with full crew",
            '''private _apc = createVehicle ["O_APC_Tracked_02_cannon_F", [100, 200, 0], [], 0, "NONE"];
private _group = createGroup EAST;
{
    private _unit = _group createUnit ["O_Soldier_F", [0, 0, 0], [], 0, "FORM"];
    _unit moveInAny _apc;
} forEach [1,2,3,4];''',
            TestCategory.VEHICLE_SPAWNING,
            True
        ),
    ])
    
    # ============================================================
    # WAYPOINTS & MOVEMENT TESTS (15 tests)
    # ============================================================
    
    tests.extend([
        TestCase(
            "Waypoint - Basic move",
            '''private _group = createGroup EAST;
_group createUnit ["O_Soldier_F", [100, 200, 0], [], 0, "FORM"];
private _wp = _group addWaypoint [[200, 300, 0], 0];
_wp setWaypointType "MOVE";''',
            TestCategory.WAYPOINTS,
            True
        ),
        TestCase(
            "Waypoint - Patrol",
            '''private _group = createGroup EAST;
_group createUnit ["O_Soldier_F", [100, 200, 0], [], 0, "FORM"];
[_group, [100, 200, 0], 150] call BIS_fnc_taskPatrol;''',
            TestCategory.WAYPOINTS,
            True
        ),
        TestCase(
            "Waypoint - Multiple waypoints",
            '''private _group = createGroup EAST;
_group createUnit ["O_Soldier_F", [100, 200, 0], [], 0, "FORM"];
private _wp1 = _group addWaypoint [[200, 300, 0], 0];
private _wp2 = _group addWaypoint [[300, 400, 0], 0];
private _wp3 = _group addWaypoint [[100, 200, 0], 0];
_wp3 setWaypointType "CYCLE";''',
            TestCategory.WAYPOINTS,
            True
        ),
        TestCase(
            "Waypoint - Defend",
            '''private _group = createGroup EAST;
_group createUnit ["O_Soldier_F", [100, 200, 0], [], 0, "FORM"];
[_group, [100, 200, 0], 50] call BIS_fnc_taskDefend;''',
            TestCategory.WAYPOINTS,
            True
        ),
        TestCase(
            "Waypoint - Search area",
            '''private _group = createGroup EAST;
_group createUnit ["O_Soldier_F", [100, 200, 0], [], 0, "FORM"];
[_group, [200, 300, 0], 100] call BIS_fnc_taskSearchArea;''',
            TestCategory.WAYPOINTS,
            True
        ),
        TestCase(
            "Waypoint - Vehicle patrol",
            '''private _veh = createVehicle ["O_MRAP_02_F", [100, 200, 0], [], 0, "NONE"];
private _group = createGroup EAST;
private _driver = _group createUnit ["O_Soldier_F", [0, 0, 0], [], 0, "FORM"];
_driver moveInDriver _veh;
[_group, [100, 200, 0], 500] call BIS_fnc_taskPatrol;''',
            TestCategory.WAYPOINTS,
            True
        ),
    ])
    
    # ============================================================
    # TASK CREATION TESTS (10 tests)
    # ============================================================
    
    tests.extend([
        TestCase(
            "Task - Basic creation",
            '''["task1", true, ["Clear the area", "Clear Area", ""], [100, 200, 0], "CREATED", 1, true, "attack"] call BIS_fnc_taskCreate;''',
            TestCategory.TASKS,
            True
        ),
        TestCase(
            "Task - Multiple tasks",
            '''["task1", true, ["Objective 1", "OBJ 1", ""], [100, 200, 0], "CREATED"] call BIS_fnc_taskCreate;
["task2", true, ["Objective 2", "OBJ 2", ""], [200, 300, 0], "CREATED"] call BIS_fnc_taskCreate;''',
            TestCategory.TASKS,
            True
        ),
        TestCase(
            "Task - Complete task",
            '''["task1", "SUCCEEDED"] call BIS_fnc_taskSetState;''',
            TestCategory.TASKS,
            True
        ),
        TestCase(
            "Task - Nested tasks",
            '''["parentTask", true, ["Main Objective", "Main", ""], objNull, "CREATED"] call BIS_fnc_taskCreate;
["subTask1", "parentTask", ["Sub Objective 1", "Sub 1", ""], [100, 200, 0], "CREATED"] call BIS_fnc_taskCreate;''',
            TestCategory.TASKS,
            True
        ),
    ])
    
    # ============================================================
    # AI BEHAVIOR TESTS (15 tests)
    # ============================================================
    
    tests.extend([
        TestCase(
            "AI - Set behavior",
            '''private _group = createGroup EAST;
_group createUnit ["O_Soldier_F", [100, 200, 0], [], 0, "FORM"];
_group setBehaviour "AWARE";''',
            TestCategory.AI_BEHAVIOR,
            True
        ),
        TestCase(
            "AI - Combat mode",
            '''private _group = createGroup EAST;
_group createUnit ["O_Soldier_F", [100, 200, 0], [], 0, "FORM"];
_group setCombatMode "YELLOW";''',
            TestCategory.AI_BEHAVIOR,
            True
        ),
        TestCase(
            "AI - Speed mode",
            '''private _group = createGroup EAST;
_group createUnit ["O_Soldier_F", [100, 200, 0], [], 0, "FORM"];
_group setSpeedMode "NORMAL";''',
            TestCategory.AI_BEHAVIOR,
            True
        ),
        TestCase(
            "AI - Formation",
            '''private _group = createGroup EAST;
_group createUnit ["O_Soldier_F", [100, 200, 0], [], 0, "FORM"];
_group setFormation "WEDGE";''',
            TestCategory.AI_BEHAVIOR,
            True
        ),
        TestCase(
            "AI - All behaviors",
            '''private _group = createGroup EAST;
_group createUnit ["O_Soldier_F", [100, 200, 0], [], 0, "FORM"];
_group setBehaviour "COMBAT";
_group setCombatMode "RED";
_group setSpeedMode "FULL";
_group setFormation "LINE";''',
            TestCategory.AI_BEHAVIOR,
            True
        ),
        TestCase(
            "AI - Stealth mode",
            '''private _group = createGroup EAST;
_group createUnit ["O_Soldier_F", [100, 200, 0], [], 0, "FORM"];
_group setBehaviour "STEALTH";
_group setCombatMode "GREEN";
_group setSpeedMode "LIMITED";''',
            TestCategory.AI_BEHAVIOR,
            True
        ),
        TestCase(
            "AI - Garrison building",
            '''private _group = createGroup EAST;
_group createUnit ["O_Soldier_F", [100, 200, 0], [], 0, "FORM"];
private _building = nearestBuilding [100, 200, 0];
[_group, _building] call BIS_fnc_taskDefend;''',
            TestCategory.AI_BEHAVIOR,
            True
        ),
    ])
    
    # ============================================================
    # POSITIONING TESTS (10 tests)
    # ============================================================
    
    tests.extend([
        TestCase(
            "Position - Relative position",
            '''private _playerPos = getPosATL player;
private _spawnPos = [_playerPos, 300, 90] call BIS_fnc_relPos;
private _group = [_spawnPos, EAST, ["O_Soldier_F"]] call BIS_fnc_spawnGroup;''',
            TestCategory.POSITIONING,
            True
        ),
        TestCase(
            "Position - Random position",
            '''private _centerPos = [100, 200, 0];
private _randomPos = [_centerPos, 50, 100, 0, 0, 20, 0] call BIS_fnc_findSafePos;
private _group = [_randomPos, EAST, ["O_Soldier_F"]] call BIS_fnc_spawnGroup;''',
            TestCategory.POSITIONING,
            True
        ),
        TestCase(
            "Position - Multiple spawn positions",
            '''private _positions = [[100,200,0], [150,250,0], [200,300,0]];
{
    private _group = [_x, EAST, ["O_Soldier_F"]] call BIS_fnc_spawnGroup;
} forEach _positions;''',
            TestCategory.POSITIONING,
            True
        ),
        TestCase(
            "Position - Near marker",
            '''private _markerPos = getMarkerPos "spawn_marker";
private _spawnPos = [_markerPos, 50, 100, 0, 0, 20, 0] call BIS_fnc_findSafePos;
private _group = [_spawnPos, EAST, ["O_Soldier_F"]] call BIS_fnc_spawnGroup;''',
            TestCategory.POSITIONING,
            True
        ),
    ])
    
    # ============================================================
    # MARKERS TESTS (8 tests)
    # ============================================================
    
    tests.extend([
        TestCase(
            "Marker - Create marker",
            '''private _marker = createMarker ["objective1", [100, 200, 0]];
_marker setMarkerType "mil_objective";
_marker setMarkerColor "ColorRed";''',
            TestCategory.MARKERS,
            True
        ),
        TestCase(
            "Marker - Area marker",
            '''private _marker = createMarker ["area1", [100, 200, 0]];
_marker setMarkerShape "RECTANGLE";
_marker setMarkerSize [100, 100];
_marker setMarkerColor "ColorRed";
_marker setMarkerBrush "SolidBorder";''',
            TestCategory.MARKERS,
            True
        ),
        TestCase(
            "Marker - Delete marker",
            '''deleteMarker "oldMarker";''',
            TestCategory.MARKERS,
            True
        ),
    ])
    
    # ============================================================
    # SECURITY VIOLATION TESTS (15 tests)
    # ============================================================
    
    tests.extend([
        TestCase(
            "Security - endMission",
            '''endMission "END1";''',
            TestCategory.SECURITY,
            False
        ),
        TestCase(
            "Security - failMission",
            '''failMission "LOSER";''',
            TestCategory.SECURITY,
            False
        ),
        TestCase(
            "Security - forceEnd",
            '''forceEnd;''',
            TestCategory.SECURITY,
            False
        ),
        TestCase(
            "Security - serverCommand",
            '''serverCommand "#kick player";''',
            TestCategory.SECURITY,
            False
        ),
        TestCase(
            "Security - deleteVehicle player",
            '''deleteVehicle player;''',
            TestCategory.SECURITY,
            False
        ),
        TestCase(
            "Security - player setDamage 1",
            '''player setDamage 1;''',
            TestCategory.SECURITY,
            False
        ),
        TestCase(
            "Security - saveProfileNamespace",
            '''profileNamespace setVariable ["data", _data];
saveProfileNamespace;''',
            TestCategory.SECURITY,
            False
        ),
        TestCase(
            "Security - loadFile",
            '''private _data = loadFile "somefile.sqf";''',
            TestCategory.SECURITY,
            False
        ),
        TestCase(
            "Security - preprocessFile",
            '''private _code = preprocessFile "malicious.sqf";''',
            TestCategory.SECURITY,
            False
        ),
        TestCase(
            "Security - compileScript",
            '''private _script = compileScript ["script.sqf"];''',
            TestCategory.SECURITY,
            False
        ),
    ])
    
    # ============================================================
    # SYNTAX ERROR TESTS (10 tests)
    # ============================================================
    
    tests.extend([
        TestCase(
            "Syntax - Missing semicolon",
            '''private _group = createGroup EAST
_group setBehaviour "AWARE";''',
            TestCategory.SYNTAX_ERRORS,
            False
        ),
        TestCase(
            "Syntax - Unbalanced braces",
            '''private _group = createGroup EAST;
if (true) then {
    _group setBehaviour "AWARE";''',
            TestCategory.SYNTAX_ERRORS,
            False
        ),
        TestCase(
            "Syntax - Unbalanced brackets",
            '''private _array = [1, 2, 3;''',
            TestCategory.SYNTAX_ERRORS,
            False
        ),
        TestCase(
            "Syntax - Unbalanced parentheses",
            '''if (true then {
    hint "error";
};''',
            TestCategory.SYNTAX_ERRORS,
            False
        ),
        TestCase(
            "Syntax - Unmatched quotes",
            '''private _str = "Hello world;''',
            TestCategory.SYNTAX_ERRORS,
            False
        ),
    ])
    
    # ============================================================
    # ADVANCED SCENARIOS (15+ tests)
    # ============================================================
    
    tests.extend([
        TestCase(
            "Advanced - Convoy setup",
            '''private _vehicles = [];
for "_i" from 0 to 2 do {
    private _veh = createVehicle ["O_MRAP_02_F", [100 + (_i * 20), 200, 0], [], 0, "NONE"];
    private _group = createGroup EAST;
    private _driver = _group createUnit ["O_Soldier_F", [0, 0, 0], [], 0, "FORM"];
    _driver moveInDriver _veh;
    _vehicles pushBack _veh;
};
private _group = group (_vehicles select 0);
[_group, [500, 600, 0], 200] call BIS_fnc_taskPatrol;''',
            TestCategory.ADVANCED,
            True
        ),
        TestCase(
            "Advanced - Ambush setup",
            '''private _ambushPos = [200, 300, 0];
private _roadPos = [_ambushPos, 50] call BIS_fnc_nearestRoad;
for "_i" from 0 to 3 do {
    private _pos = [_roadPos, 30, 50, 0, 0, 20, 0] call BIS_fnc_findSafePos;
    private _group = [_pos, EAST, ["O_Soldier_F"]] call BIS_fnc_spawnGroup;
    _group setBehaviour "STEALTH";
    _group setCombatMode "YELLOW";
};''',
            TestCategory.ADVANCED,
            True
        ),
        TestCase(
            "Advanced - Fortified position",
            '''private _centerPos = [100, 200, 0];
private _defensePositions = [_centerPos, 50, 8] call BIS_fnc_posDifference;
{
    private _group = [_x, EAST, ["O_Soldier_F"]] call BIS_fnc_spawnGroup;
    [_group, _centerPos, 50] call BIS_fnc_taskDefend;
    _group setBehaviour "COMBAT";
} forEach _defensePositions;''',
            TestCategory.ADVANCED,
            True
        ),
        TestCase(
            "Advanced - Helicopter insertion",
            '''private _heli = createVehicle ["O_Heli_Light_02_unarmed_F", [0, 0, 100], [], 0, "FLY"];
private _heliGroup = createGroup EAST;
private _pilot = _heliGroup createUnit ["O_Soldier_F", [0, 0, 0], [], 0, "FORM"];
_pilot moveInDriver _heli;
private _infantry = createGroup EAST;
for "_i" from 0 to 5 do {
    private _unit = _infantry createUnit ["O_Soldier_F", [0, 0, 0], [], 0, "FORM"];
    _unit moveInCargo _heli;
};
private _lz = [200, 300, 0];
private _wp = _heliGroup addWaypoint [_lz, 0];
_wp setWaypointType "TR UNLOAD";''',
            TestCategory.ADVANCED,
            True
        ),
        TestCase(
            "Advanced - Attack wave",
            '''for "_wave" from 1 to 3 do {
    private _spawnPos = [100 + (_wave * 50), 200, 0];
    private _group = [_spawnPos, EAST, ["O_Soldier_TL_F", "O_Soldier_F", "O_Soldier_F", "O_Soldier_AR_F"]] call BIS_fnc_spawnGroup;
    private _targetPos = [500, 600, 0];
    _group setBehaviour "AWARE";
    _group setCombatMode "RED";
    private _wp = _group addWaypoint [_targetPos, 0];
    _wp setWaypointType "SAD";
};''',
            TestCategory.ADVANCED,
            True
        ),
        TestCase(
            "Advanced - Dynamic QRF",
            '''private _qrfTrigger = createTrigger ["EmptyDetector", [200, 300, 0]];
_qrfTrigger setTriggerArea [100, 100, 0, false];
_qrfTrigger setTriggerActivation ["WEST", "PRESENT", true];
_qrfTrigger setTriggerStatements [
    "this",
    "private _spawnPos = [400, 500, 0]; private _group = [_spawnPos, EAST, ['O_Soldier_TL_F', 'O_Soldier_F', 'O_Soldier_F']] call BIS_fnc_spawnGroup; _group setBehaviour 'COMBAT';",
    ""
];''',
            TestCategory.ADVANCED,
            True
        ),
    ])
    
    return tests


def run_comprehensive_tests():
    """Run all tests"""
    print("=" * 80)
    print(" " * 20 + "COMPREHENSIVE SQF TEST SUITE")
    print("=" * 80)
    print()
    
    tester = ComprehensiveSQFTester()
    test_suite = generate_test_suite()
    
    print(f"Total tests: {len(test_suite)}")
    print()
    
    results = []
    category_results = {}
    
    for test_case in test_suite:
        result = tester.test_code(test_case)
        results.append(result)
        
        # Track by category
        category = result['category']
        if category not in category_results:
            category_results[category] = {'passed': 0, 'failed': 0}
        
        if result['test_pass']:
            category_results[category]['passed'] += 1
        else:
            category_results[category]['failed'] += 1
    
    # Print detailed results for failures
    print("\n" + "=" * 80)
    print("FAILED TESTS (if any)")
    print("=" * 80)
    
    failed_tests = [r for r in results if not r['test_pass']]
    if failed_tests:
        for result in failed_tests[:10]:  # Show first 10 failures
            print(f"\n❌ {result['name']}")
            print(f"   Category: {result['category']}")
            print(f"   Should pass: {result['should_pass']}")
            print(f"   Actually passed: {result['overall_pass']}")
            if result['syntax_errors']:
                print(f"   Syntax errors: {', '.join(result['syntax_errors'])}")
            if result['security_violations']:
                print(f"   Security violations: {', '.join(result['security_violations'])}")
        
        if len(failed_tests) > 10:
            print(f"\n... and {len(failed_tests) - 10} more failures")
    else:
        print("\n✓ All tests behaving as expected!")
    
    # Summary by category
    print("\n" + "=" * 80)
    print("RESULTS BY CATEGORY")
    print("=" * 80)
    
    for category, stats in sorted(category_results.items()):
        total = stats['passed'] + stats['failed']
        pass_rate = (stats['passed'] / total * 100) if total > 0 else 0
        status = "✓" if stats['failed'] == 0 else "✗"
        print(f"{status} {category:30s} {stats['passed']:3d}/{total:3d} ({pass_rate:5.1f}%)")
    
    # Overall summary
    print("\n" + "=" * 80)
    print("OVERALL SUMMARY")
    print("=" * 80)
    
    total_tests = len(results)
    passed_tests = sum(1 for r in results if r['test_pass'])
    failed_tests_count = total_tests - passed_tests
    pass_rate = (passed_tests / total_tests * 100) if total_tests > 0 else 0
    
    print(f"Total tests: {total_tests}")
    print(f"Passed: {passed_tests}")
    print(f"Failed: {failed_tests_count}")
    print(f"Success rate: {pass_rate:.1f}%")
    
    # Export results
    output_file = '/tmp/comprehensive_sqf_test_results.json'
    with open(output_file, 'w') as f:
        json.dump({
            'summary': {
                'total': total_tests,
                'passed': passed_tests,
                'failed': failed_tests_count,
                'pass_rate': pass_rate
            },
            'by_category': category_results,
            'results': results
        }, f, indent=2)
    
    print(f"\nResults exported to: {output_file}")
    
    return passed_tests, total_tests

def generate_additional_tests() -> List[TestCase]:
    """Generate additional 50+ tests to reach 100+ total"""
    tests = []
    
    # ============================================================
    # TRIGGERS & EVENTS (10 tests)
    # ============================================================
    
    tests.extend([
        TestCase(
            "Trigger - Basic area trigger",
            '''private _trigger = createTrigger ["EmptyDetector", [100, 200, 0]];
_trigger setTriggerArea [50, 50, 0, false];
_trigger setTriggerActivation ["WEST", "PRESENT", true];''',
            TestCategory.TRIGGERS,
            True
        ),
        TestCase(
            "Trigger - With statements",
            '''private _trigger = createTrigger ["EmptyDetector", [100, 200, 0]];
_trigger setTriggerArea [100, 100, 0, false];
_trigger setTriggerActivation ["EAST", "PRESENT", false];
_trigger setTriggerStatements ["this", "hint 'Enemy detected';", "hint 'Clear';"];''',
            TestCategory.TRIGGERS,
            True
        ),
        TestCase(
            "Trigger - Spawn on activation",
            '''private _trigger = createTrigger ["EmptyDetector", [100, 200, 0]];
_trigger setTriggerArea [100, 100, 0, false];
_trigger setTriggerActivation ["WEST", "PRESENT", true];
_trigger setTriggerStatements ["this", "private _grp = [[200,300,0], EAST, ['O_Soldier_F']] call BIS_fnc_spawnGroup;", ""];''',
            TestCategory.TRIGGERS,
            True
        ),
        TestCase(
            "Event - EntityKilled handler",
            '''private _unit = leader (createGroup EAST);
_unit addEventHandler ["Killed", {
    params ["_unit", "_killer"];
    hint format ["Unit killed by %1", name _killer];
}];''',
            TestCategory.TRIGGERS,
            True
        ),
        TestCase(
            "Event - FiredNear handler",
            '''private _unit = leader (createGroup EAST);
_unit addEventHandler ["FiredNear", {
    params ["_unit", "_firer"];
    _unit setBehaviour "COMBAT";
}];''',
            TestCategory.TRIGGERS,
            True
        ),
        TestCase(
            "Event - Hit handler",
            '''private _veh = createVehicle ["O_MRAP_02_F", [100, 200, 0], [], 0, "NONE"];
_veh addEventHandler ["Hit", {
    params ["_unit", "_source"];
    hint "Vehicle hit!";
}];''',
            TestCategory.TRIGGERS,
            True
        ),
        TestCase(
            "Event - GetIn handler",
            '''private _veh = createVehicle ["O_MRAP_02_F", [100, 200, 0], [], 0, "NONE"];
_veh addEventHandler ["GetIn", {
    params ["_vehicle", "_role", "_unit"];
    hint format ["%1 got in as %2", name _unit, _role];
}];''',
            TestCategory.TRIGGERS,
            True
        ),
    ])
    
    # ============================================================
    # GROUP MANAGEMENT (12 tests)
    # ============================================================
    
    tests.extend([
        TestCase(
            "Group - Create and join",
            '''private _group = createGroup EAST;
private _unit1 = _group createUnit ["O_Soldier_F", [100, 200, 0], [], 0, "FORM"];
private _unit2 = _group createUnit ["O_Soldier_F", [100, 200, 0], [], 0, "FORM"];''',
            TestCategory.GROUPS,
            True
        ),
        TestCase(
            "Group - Set leader",
            '''private _group = createGroup EAST;
private _unit1 = _group createUnit ["O_Soldier_F", [100, 200, 0], [], 0, "FORM"];
private _unit2 = _group createUnit ["O_Soldier_TL_F", [100, 200, 0], [], 0, "FORM"];
_group selectLeader _unit2;''',
            TestCategory.GROUPS,
            True
        ),
        TestCase(
            "Group - Join group",
            '''private _group1 = createGroup EAST;
private _group2 = createGroup EAST;
private _unit = _group1 createUnit ["O_Soldier_F", [100, 200, 0], [], 0, "FORM"];
[_unit] joinSilent _group2;''',
            TestCategory.GROUPS,
            True
        ),
        TestCase(
            "Group - Delete empty group",
            '''private _group = createGroup EAST;
deleteGroup _group;''',
            TestCategory.GROUPS,
            True
        ),
        TestCase(
            "Group - Get units",
            '''private _group = createGroup EAST;
_group createUnit ["O_Soldier_F", [100, 200, 0], [], 0, "FORM"];
private _units = units _group;''',
            TestCategory.GROUPS,
            True
        ),
        TestCase(
            "Group - Enable/disable AI",
            '''private _group = createGroup EAST;
private _unit = _group createUnit ["O_Soldier_F", [100, 200, 0], [], 0, "FORM"];
_unit disableAI "MOVE";
_unit enableAI "MOVE";''',
            TestCategory.GROUPS,
            True
        ),
        TestCase(
            "Group - Set group ID",
            '''private _group = createGroup EAST;
_group setGroupId ["Alpha 1-1"];''',
            TestCategory.GROUPS,
            True
        ),
        TestCase(
            "Group - Share knowledge",
            '''private _group1 = createGroup EAST;
private _group2 = createGroup EAST;
_group1 reveal [player, 4];
{_x reveal [player, 4]} forEach units _group2;''',
            TestCategory.GROUPS,
            True
        ),
    ])
    
    # ============================================================
    # ADDITIONAL UNIT SPAWNING (10 tests)
    # ============================================================
    
    tests.extend([
        TestCase(
            "Unit - Special forces",
            '''private _group = [[100, 200, 0], EAST, ["O_soldier_exp_F", "O_soldier_exp_F"]] call BIS_fnc_spawnGroup;
_group setBehaviour "STEALTH";''',
            TestCategory.UNIT_SPAWNING,
            True
        ),
        TestCase(
            "Unit - Engineers",
            '''private _group = createGroup EAST;
_group createUnit ["O_engineer_F", [100, 200, 0], [], 0, "FORM"];
_group createUnit ["O_engineer_F", [100, 200, 0], [], 0, "FORM"];''',
            TestCategory.UNIT_SPAWNING,
            True
        ),
        TestCase(
            "Unit - Crew",
            '''private _group = createGroup EAST;
_group createUnit ["O_crew_F", [100, 200, 0], [], 0, "FORM"];
_group createUnit ["O_crew_F", [100, 200, 0], [], 0, "FORM"];''',
            TestCategory.UNIT_SPAWNING,
            True
        ),
        TestCase(
            "Unit - Pilots",
            '''private _group = createGroup EAST;
_group createUnit ["O_Pilot_F", [100, 200, 0], [], 0, "FORM"];
_group createUnit ["O_helipilot_F", [100, 200, 0], [], 0, "FORM"];''',
            TestCategory.UNIT_SPAWNING,
            True
        ),
        TestCase(
            "Unit - Divers",
            '''private _group = [[100, 200, 0], EAST, ["O_diver_F", "O_diver_F"]] call BIS_fnc_spawnGroup;''',
            TestCategory.UNIT_SPAWNING,
            True
        ),
        TestCase(
            "Unit - Recon team",
            '''private _group = [[100, 200, 0], EAST, ["O_recon_TL_F", "O_recon_M_F", "O_recon_F"]] call BIS_fnc_spawnGroup;
_group setBehaviour "STEALTH";
_group setCombatMode "YELLOW";''',
            TestCategory.UNIT_SPAWNING,
            True
        ),
        TestCase(
            "Unit - Urban assault",
            '''private _group = [[100, 200, 0], EAST, ["O_Soldier_GL_F", "O_Soldier_F", "O_Soldier_LAT_F"]] call BIS_fnc_spawnGroup;
{_unit = _x; removeAllWeapons _unit; _unit addWeapon "arifle_Katiba_F";} forEach units _group;''',
            TestCategory.UNIT_SPAWNING,
            True
        ),
    ])
    
    # ============================================================
    # ADDITIONAL VEHICLE SPAWNING (8 tests)
    # ============================================================
    
    tests.extend([
        TestCase(
            "Vehicle - Artillery",
            '''private _arty = createVehicle ["O_MBT_02_arty_F", [100, 200, 0], [], 0, "NONE"];
private _group = createGroup EAST;
{
    private _unit = _group createUnit ["O_crew_F", [0, 0, 0], [], 0, "FORM"];
    _unit moveInAny _arty;
} forEach [1,2,3];''',
            TestCategory.VEHICLE_SPAWNING,
            True
        ),
        TestCase(
            "Vehicle - Transport truck full",
            '''private _truck = createVehicle ["O_Truck_03_transport_F", [100, 200, 0], [], 0, "NONE"];
private _group = createGroup EAST;
for "_i" from 0 to 15 do {
    private _unit = _group createUnit ["O_Soldier_F", [0, 0, 0], [], 0, "FORM"];
    _unit moveInCargo _truck;
};''',
            TestCategory.VEHICLE_SPAWNING,
            True
        ),
        TestCase(
            "Vehicle - Boat",
            '''private _boat = createVehicle ["O_Boat_Armed_01_hmg_F", [100, 200, 0], [], 0, "NONE"];''',
            TestCategory.VEHICLE_SPAWNING,
            True
        ),
        TestCase(
            "Vehicle - UAV",
            '''private _uav = createVehicle ["O_UAV_02_F", [100, 200, 50], [], 0, "FLY"];
createVehicleCrew _uav;''',
            TestCategory.VEHICLE_SPAWNING,
            True
        ),
        TestCase(
            "Vehicle - Static weapon",
            '''private _hmg = createVehicle ["O_HMG_01_F", [100, 200, 0], [], 0, "NONE"];
private _group = createGroup EAST;
private _gunner = _group createUnit ["O_Soldier_F", [0, 0, 0], [], 0, "FORM"];
_gunner moveInGunner _hmg;''',
            TestCategory.VEHICLE_SPAWNING,
            True
        ),
    ])
    
    # ============================================================
    # ADDITIONAL POSITIONING (8 tests)
    # ============================================================
    
    tests.extend([
        TestCase(
            "Position - Grid pattern",
            '''private _center = [100, 200, 0];
for "_x" from 0 to 2 do {
    for "_y" from 0 to 2 do {
        private _pos = [(_center select 0) + (_x * 50), (_center select 1) + (_y * 50), 0];
        private _group = [_pos, EAST, ["O_Soldier_F"]] call BIS_fnc_spawnGroup;
    };
};''',
            TestCategory.POSITIONING,
            True
        ),
        TestCase(
            "Position - Circle pattern",
            '''private _center = [100, 200, 0];
private _radius = 100;
for "_i" from 0 to 7 do {
    private _angle = _i * 45;
    private _pos = [_center, _radius, _angle] call BIS_fnc_relPos;
    private _group = [_pos, EAST, ["O_Soldier_F"]] call BIS_fnc_spawnGroup;
};''',
            TestCategory.POSITIONING,
            True
        ),
        TestCase(
            "Position - Height offset",
            '''private _building = nearestBuilding [100, 200, 0];
private _positions = _building buildingPos -1;
{
    private _group = [_x, EAST, ["O_Soldier_F"]] call BIS_fnc_spawnGroup;
    (leader _group) setPos _x;
} forEach _positions;''',
            TestCategory.POSITIONING,
            True
        ),
    ])
    
    # ============================================================
    # ADDITIONAL SECURITY TESTS (5 tests)
    # ============================================================
    
    tests.extend([
        TestCase(
            "Security - terminate",
            '''terminate;''',
            TestCategory.SECURITY,
            False
        ),
        TestCase(
            "Security - exportJIPMessages",
            '''exportJIPMessages "messages";''',
            TestCategory.SECURITY,
            False
        ),
        TestCase(
            "Security - admin check",
            '''if (admin owner player > 0) then {
    hint "Admin";
};''',
            TestCategory.SECURITY,
            False
        ),
        TestCase(
            "Security - serverCommandAvailable",
            '''if (serverCommandAvailable "#kick") then {
    serverCommand "#kick player";
};''',
            TestCategory.SECURITY,
            False
        ),
    ])
    
    # ============================================================
    # ADDITIONAL ADVANCED SCENARIOS (10 tests)
    # ============================================================
    
    tests.extend([
        TestCase(
            "Advanced - Mortar team",
            '''private _mortarPos = [100, 200, 0];
private _mortar = createVehicle ["O_Mortar_01_F", _mortarPos, [], 0, "NONE"];
private _group = createGroup EAST;
private _gunner = _group createUnit ["O_Soldier_F", [0, 0, 0], [], 0, "FORM"];
private _assistant = _group createUnit ["O_Soldier_F", [0, 0, 0], [], 0, "FORM"];
_gunner moveInGunner _mortar;
_assistant moveInTurret [_mortar, [0]];''',
            TestCategory.ADVANCED,
            True
        ),
        TestCase(
            "Advanced - AA team",
            '''private _group = [[100, 200, 0], EAST, ["O_Soldier_TL_F", "O_Soldier_AA_F", "O_Soldier_AA_F"]] call BIS_fnc_spawnGroup;
_group setCombatMode "YELLOW";
_group setBehaviour "AWARE";
{_x disableAI "AUTOCOMBAT"} forEach units _group;''',
            TestCategory.ADVANCED,
            True
        ),
        TestCase(
            "Advanced - Roadblock",
            '''private _roadPos = [200, 300, 0];
private _road = [_roadPos, 50] call BIS_fnc_nearestRoad;
private _barrier1 = createVehicle ["Land_Concrete_SmallWall_4m_F", getPos _road, [], 0, "NONE"];
private _barrier2 = createVehicle ["Land_Concrete_SmallWall_4m_F", [getPos _road select 0, (getPos _road select 1) + 5, 0], [], 0, "NONE"];
private _group = [[getPos _road, 20] call BIS_fnc_nearestRoad, EAST, ["O_Soldier_F", "O_Soldier_F"]] call BIS_fnc_spawnGroup;''',
            TestCategory.ADVANCED,
            True
        ),
        TestCase(
            "Advanced - Sniper overwatch",
            '''private _targetArea = [200, 300, 0];
private _overwatchPos = [_targetArea, 400, 45] call BIS_fnc_relPos;
private _hill = [_overwatchPos, 100, 150, 10, 0, 45, 0] call BIS_fnc_findSafePos;
private _group = [_hill, EAST, ["O_sniper_F", "O_spotter_F"]] call BIS_fnc_spawnGroup;
_group setBehaviour "STEALTH";
private _wp = _group addWaypoint [_targetArea, 0];
_wp setWaypointType "SCRIPTED";
_wp setWaypointScript "A3\\functions_f\\waypoints\\fn_wpSniper.sqf";''',
            TestCategory.ADVANCED,
            True
        ),
        TestCase(
            "Advanced - Counterattack",
            '''private _defenders = [[100, 200, 0], EAST, ["O_Soldier_TL_F", "O_Soldier_F", "O_Soldier_F", "O_Soldier_AR_F"]] call BIS_fnc_spawnGroup;
[_defenders, [100, 200, 0], 50] call BIS_fnc_taskDefend;
private _reinforcements = [[500, 600, 0], EAST, ["O_Soldier_TL_F", "O_Soldier_F", "O_Soldier_F", "O_Soldier_LAT_F"]] call BIS_fnc_spawnGroup;
private _wp = _reinforcements addWaypoint [[100, 200, 0], 0];
_wp setWaypointType "SAD";
_reinforcements setBehaviour "AWARE";''',
            TestCategory.ADVANCED,
            True
        ),
        TestCase(
            "Advanced - Night patrol",
            '''private _group = [[100, 200, 0], EAST, ["O_Soldier_TL_F", "O_Soldier_F", "O_Soldier_F"]] call BIS_fnc_spawnGroup;
{_x enableGunLights "forceOn"; _x setSkill ["spotTime", 0.3];} forEach units _group;
[_group, [100, 200, 0], 200] call BIS_fnc_taskPatrol;
_group setBehaviour "SAFE";
_group setSpeedMode "LIMITED";''',
            TestCategory.ADVANCED,
            True
        ),
        TestCase(
            "Advanced - Urban CQB",
            '''private _buildings = nearestObjects [[200, 300, 0], ["House"], 100];
{
    private _positions = _x buildingPos -1;
    if (count _positions > 0) then {
        private _pos = selectRandom _positions;
        private _group = [_pos, EAST, ["O_Soldier_F"]] call BIS_fnc_spawnGroup;
        (leader _group) setPos _pos;
        _group setBehaviour "STEALTH";
    };
} forEach _buildings;''',
            TestCategory.ADVANCED,
            True
        ),
        TestCase(
            "Advanced - Supply drop",
            '''private _plane = createVehicle ["O_Plane_CAS_02_F", [0, 0, 500], [], 0, "FLY"];
private _cargo = createVehicle ["B_supplyCrate_F", [0, 0, 500], [], 0, "NONE"];
_cargo attachTo [_plane, [0, -5, -2]];
private _dropPos = [200, 300, 0];
_plane flyInHeight 200;
private _wp = group _plane addWaypoint [_dropPos, 0];
_wp setWaypointStatements ["true", "detach (_thislist select 0); (_thislist select 0) setVelocity [0, 0, -10];"];''',
            TestCategory.ADVANCED,
            True
        ),
    ])
    
    return tests


# Update the main test generation function
def generate_full_test_suite() -> List[TestCase]:
    """Generate full test suite with 100+ tests"""
    base_tests = generate_test_suite()
    additional_tests = generate_additional_tests()
    return base_tests + additional_tests


# Update run_comprehensive_tests to use full suite
def run_full_comprehensive_tests():
    """Run all 100+ tests"""
    print("=" * 80)
    print(" " * 15 + "COMPREHENSIVE SQF TEST SUITE (100+ Tests)")
    print("=" * 80)
    print()
    
    tester = ComprehensiveSQFTester()
    test_suite = generate_full_test_suite()
    
    print(f"Total tests: {len(test_suite)}")
    print()
    
    results = []
    category_results = {}
    
    for test_case in test_suite:
        result = tester.test_code(test_case)
        results.append(result)
        
        # Track by category
        category = result['category']
        if category not in category_results:
            category_results[category] = {'passed': 0, 'failed': 0}
        
        if result['test_pass']:
            category_results[category]['passed'] += 1
        else:
            category_results[category]['failed'] += 1
    
    # Print detailed results for failures
    print("\n" + "=" * 80)
    print("FAILED TESTS (if any)")
    print("=" * 80)
    
    failed_tests = [r for r in results if not r['test_pass']]
    if failed_tests:
        for result in failed_tests[:15]:  # Show first 15 failures
            print(f"\n❌ {result['name']}")
            print(f"   Category: {result['category']}")
            print(f"   Should pass: {result['should_pass']}")
            print(f"   Actually passed: {result['overall_pass']}")
            if result['syntax_errors']:
                print(f"   Syntax errors: {', '.join(result['syntax_errors'][:3])}")
            if result['security_violations']:
                print(f"   Security violations: {', '.join(result['security_violations'][:3])}")
        
        if len(failed_tests) > 15:
            print(f"\n... and {len(failed_tests) - 15} more failures")
    else:
        print("\n✓ All tests behaving as expected!")
    
    # Summary by category
    print("\n" + "=" * 80)
    print("RESULTS BY CATEGORY")
    print("=" * 80)
    
    for category, stats in sorted(category_results.items()):
        total = stats['passed'] + stats['failed']
        pass_rate = (stats['passed'] / total * 100) if total > 0 else 0
        status = "✓" if stats['failed'] == 0 else "✗"
        print(f"{status} {category:30s} {stats['passed']:3d}/{total:3d} ({pass_rate:5.1f}%)")
    
    # Overall summary
    print("\n" + "=" * 80)
    print("OVERALL SUMMARY")
    print("=" * 80)
    
    total_tests = len(results)
    passed_tests = sum(1 for r in results if r['test_pass'])
    failed_tests_count = total_tests - passed_tests
    pass_rate = (passed_tests / total_tests * 100) if total_tests > 0 else 0
    
    print(f"Total tests: {total_tests}")
    print(f"Passed: {passed_tests}")
    print(f"Failed: {failed_tests_count}")
    print(f"Success rate: {pass_rate:.1f}%")
    
    # Export results
    output_file = '/tmp/comprehensive_sqf_test_results.json'
    with open(output_file, 'w') as f:
        json.dump({
            'summary': {
                'total': total_tests,
                'passed': passed_tests,
                'failed': failed_tests_count,
                'pass_rate': pass_rate
            },
            'by_category': category_results,
            'results': results
        }, f, indent=2)
    
    print(f"\nResults exported to: {output_file}")
    
    # Show validation message
    if total_tests >= 100:
        print(f"\n{'✓' * 40}")
        print(f"✓ TEST SUITE COMPLETE: {total_tests} tests created!")
        print(f"{'✓' * 40}")
    
    return passed_tests, total_tests



if __name__ == '__main__':
    # Run the full comprehensive test suite
    passed, total = run_full_comprehensive_tests()
    
    # Exit with success if all tests behave as expected
    sys.exit(0 if passed == total else 1)
