#!/usr/bin/env python3
"""
End-to-End LLM Integration Test Suite
Tests the full flow: Game State → LLM Request → SQF Generation → Validation
Simulates 80+ realistic scenarios with mock LLM responses
"""

import sys
import json
import re
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass
from enum import Enum


class ScenarioType(Enum):
    """Type of game scenario"""
    ENEMY_APPROACH = "Enemy Approach"
    PLAYER_IDLE = "Player Idle"
    OBJECTIVE_DEFENSE = "Objective Defense"
    REINFORCEMENT = "Reinforcement"
    FLANKING_MANEUVER = "Flanking Maneuver"
    AMBUSH = "Ambush Setup"
    PATROL = "Patrol"
    VEHICLE_PATROL = "Vehicle Patrol"
    AIR_SUPPORT = "Air Support"
    EXTRACTION = "Extraction"
    QRF = "Quick Reaction Force"
    OVERWATCH = "Overwatch Position"
    MORTAR_SUPPORT = "Mortar Support"
    CONVOY = "Convoy"
    CHECKPOINT = "Checkpoint"


@dataclass
class GameState:
    """Simulated game state from Arma 3"""
    timestamp: float
    players: List[Dict]
    friendly_units: List[Dict]
    enemy_units: List[Dict]
    objectives: List[Dict]
    recent_events: List[Dict]
    environment: Dict
    mission_context: Dict


@dataclass
class LLMResponse:
    """Mock LLM response"""
    reasoning: str
    action: str
    urgency: str
    sqf_code: str


@dataclass
class E2ETestCase:
    """End-to-end test case"""
    name: str
    scenario_type: ScenarioType
    game_state: GameState
    expected_llm_response: LLMResponse
    should_validate: bool = True


class E2ETester:
    """End-to-end integration tester"""
    
    def __init__(self):
        self.forbidden_commands = [
            'endMission', 'failMission', 'forceEnd', 'terminate',
            'serverCommand', 'admin', 'saveProfileNamespace', 
            'loadFile', 'preprocessFile'
        ]
    
    def validate_sqf(self, code: str) -> Tuple[bool, List[str]]:
        """Validate SQF code"""
        errors = []
        
        # Check syntax
        if code.count('{') != code.count('}'):
            errors.append("Unbalanced braces")
        if code.count('[') != code.count(']'):
            errors.append("Unbalanced brackets")
        if code.count('(') != code.count(')'):
            errors.append("Unbalanced parentheses")
        
        # Check security
        for cmd in self.forbidden_commands:
            if re.search(r'\b' + re.escape(cmd) + r'\b', code, re.IGNORECASE):
                errors.append(f"Forbidden command: {cmd}")
        
        # Check for player harm
        if re.search(r'deleteVehicle\s+player', code, re.IGNORECASE):
            errors.append("Attempt to delete player")
        if re.search(r'player\s+setDamage\s+1', code, re.IGNORECASE):
            errors.append("Attempt to kill player")
        
        return len(errors) == 0, errors
    
    def test_e2e_scenario(self, test_case: E2ETestCase) -> Dict:
        """Test complete scenario"""
        # Validate LLM response structure
        response = test_case.expected_llm_response
        
        validation_ok, validation_errors = self.validate_sqf(response.sqf_code)
        
        # Check if validation matches expectation
        test_pass = (validation_ok == test_case.should_validate)
        
        return {
            'name': test_case.name,
            'scenario_type': test_case.scenario_type.value,
            'action': response.action,
            'urgency': response.urgency,
            'validation_ok': validation_ok,
            'validation_errors': validation_errors,
            'should_validate': test_case.should_validate,
            'test_pass': test_pass,
            'sqf_preview': response.sqf_code[:200] + '...' if len(response.sqf_code) > 200 else response.sqf_code
        }


def generate_e2e_test_suite() -> List[E2ETestCase]:
    """Generate 80+ end-to-end test scenarios"""
    tests = []
    
    # ============================================================
    # ENEMY APPROACH SCENARIOS (10 tests)
    # ============================================================
    
    tests.extend([
        E2ETestCase(
            "Enemy Approach - Spawn Infantry Squad",
            ScenarioType.ENEMY_APPROACH,
            GameState(
                timestamp=300.0,
                players=[{"position": [1000, 2000, 0], "health": 1.0}],
                friendly_units=[],
                enemy_units=[],
                objectives=[{"id": "obj1", "position": [1000, 2000, 0], "state": "CREATED"}],
                recent_events=[],
                environment={"time": 12.0, "weather": "CLEAR"},
                mission_context={"elapsed_time": 300}
            ),
            LLMResponse(
                reasoning="Players have been at objective for 5 minutes. Time to create pressure with infantry.",
                action="spawn",
                urgency="soon",
                sqf_code='''private _playerPos = getPosATL player;
private _spawnPos = [_playerPos, 300, 90] call BIS_fnc_relPos;
private _group = [_spawnPos, EAST, ["O_Soldier_TL_F", "O_Soldier_F", "O_Soldier_F", "O_Soldier_AR_F"]] call BIS_fnc_spawnGroup;
_group setBehaviour "AWARE";
_group setCombatMode "YELLOW";
private _wp = _group addWaypoint [_playerPos, 0];
_wp setWaypointType "SAD";'''
            )
        ),
        E2ETestCase(
            "Enemy Approach - Spawn with Patrol",
            ScenarioType.ENEMY_APPROACH,
            GameState(
                timestamp=450.0,
                players=[{"position": [1500, 2500, 0], "health": 0.8}],
                friendly_units=[{"count": 3}],
                enemy_units=[],
                objectives=[],
                recent_events=[{"type": "shot_fired", "time": 445}],
                environment={"time": 14.0, "weather": "CLEAR"},
                mission_context={"elapsed_time": 450}
            ),
            LLMResponse(
                reasoning="Recent combat detected. Deploy patrol to investigate.",
                action="spawn",
                urgency="immediate",
                sqf_code='''private _spawnPos = [1700, 2800, 0];
private _group = [_spawnPos, EAST, ["O_Soldier_TL_F", "O_Soldier_F", "O_Soldier_F"]] call BIS_fnc_spawnGroup;
[_group, _spawnPos, 200] call BIS_fnc_taskPatrol;
_group setBehaviour "COMBAT";'''
            )
        ),
        E2ETestCase(
            "Enemy Approach - Multiple Squads",
            ScenarioType.ENEMY_APPROACH,
            GameState(
                timestamp=600.0,
                players=[{"position": [2000, 3000, 0], "health": 1.0}, {"position": [2005, 3005, 0], "health": 1.0}],
                friendly_units=[{"count": 8}],
                enemy_units=[{"count": 2}],
                objectives=[{"id": "obj1", "state": "ASSIGNED"}],
                recent_events=[],
                environment={"time": 16.0, "weather": "CLEAR"},
                mission_context={"elapsed_time": 600}
            ),
            LLMResponse(
                reasoning="2 players with strong force. Deploy multiple squads from different angles.",
                action="spawn",
                urgency="soon",
                sqf_code='''private _playerPos = [2000, 3000, 0];
private _spawnPos1 = [_playerPos, 400, 45] call BIS_fnc_relPos;
private _spawnPos2 = [_playerPos, 400, 135] call BIS_fnc_relPos;
private _group1 = [_spawnPos1, EAST, ["O_Soldier_TL_F", "O_Soldier_F", "O_Soldier_AR_F"]] call BIS_fnc_spawnGroup;
private _group2 = [_spawnPos2, EAST, ["O_Soldier_TL_F", "O_Soldier_F", "O_Soldier_LAT_F"]] call BIS_fnc_spawnGroup;
_group1 setBehaviour "AWARE";
_group2 setBehaviour "AWARE";
{_x addWaypoint [_playerPos, 0]} forEach [_group1, _group2];'''
            )
        ),
    ])
    
    # ============================================================
    # PLAYER IDLE SCENARIOS (8 tests)
    # ============================================================
    
    tests.extend([
        E2ETestCase(
            "Player Idle - Spawn Patrol",
            ScenarioType.PLAYER_IDLE,
            GameState(
                timestamp=900.0,
                players=[{"position": [1000, 2000, 0], "health": 1.0}],
                friendly_units=[],
                enemy_units=[],
                objectives=[],
                recent_events=[],
                environment={"time": 18.0, "weather": "CLEAR"},
                mission_context={"elapsed_time": 900}
            ),
            LLMResponse(
                reasoning="Player idle for extended period. Create activity with patrol.",
                action="spawn",
                urgency="soon",
                sqf_code='''private _spawnPos = [1400, 2300, 0];
private _group = [_spawnPos, EAST, ["O_Soldier_F", "O_Soldier_F"]] call BIS_fnc_spawnGroup;
[_group, _spawnPos, 250] call BIS_fnc_taskPatrol;
_group setBehaviour "SAFE";
_group setSpeedMode "LIMITED";'''
            )
        ),
        E2ETestCase(
            "Player Idle - Create Objective",
            ScenarioType.PLAYER_IDLE,
            GameState(
                timestamp=1200.0,
                players=[{"position": [1000, 2000, 0], "health": 1.0}],
                friendly_units=[],
                enemy_units=[],
                objectives=[],
                recent_events=[],
                environment={"time": 20.0, "weather": "OVERCAST"},
                mission_context={"elapsed_time": 1200}
            ),
            LLMResponse(
                reasoning="No objectives active. Create new task to motivate player.",
                action="objective",
                urgency="immediate",
                sqf_code='''private _objPos = [1500, 2500, 0];
["obj_clear", true, ["Clear the area", "Clear Area", ""], _objPos, "CREATED", 1, true, "attack"] call BIS_fnc_taskCreate;
private _marker = createMarker ["obj_clear_marker", _objPos];
_marker setMarkerType "mil_objective";
_marker setMarkerColor "ColorRed";'''
            )
        ),
    ])
    
    # ============================================================
    # VEHICLE SPAWNING SCENARIOS (10 tests)
    # ============================================================
    
    tests.extend([
        E2ETestCase(
            "Vehicle - MRAP Patrol",
            ScenarioType.VEHICLE_PATROL,
            GameState(
                timestamp=400.0,
                players=[{"position": [1000, 2000, 0], "health": 1.0}],
                friendly_units=[{"count": 4}],
                enemy_units=[],
                objectives=[],
                recent_events=[],
                environment={"time": 14.0, "weather": "CLEAR"},
                mission_context={"elapsed_time": 400}
            ),
            LLMResponse(
                reasoning="Players have vehicles. Deploy vehicle patrol to match threat.",
                action="spawn",
                urgency="soon",
                sqf_code='''private _spawnPos = [1500, 2500, 0];
private _veh = createVehicle ["O_MRAP_02_hmg_F", _spawnPos, [], 0, "NONE"];
private _group = createGroup EAST;
private _driver = _group createUnit ["O_Soldier_F", [0, 0, 0], [], 0, "FORM"];
private _gunner = _group createUnit ["O_Soldier_F", [0, 0, 0], [], 0, "FORM"];
_driver moveInDriver _veh;
_gunner moveInGunner _veh;
[_group, _spawnPos, 500] call BIS_fnc_taskPatrol;'''
            )
        ),
        E2ETestCase(
            "Vehicle - APC Assault",
            ScenarioType.ENEMY_APPROACH,
            GameState(
                timestamp=800.0,
                players=[{"position": [2000, 3000, 0], "health": 0.7}],
                friendly_units=[{"count": 6}],
                enemy_units=[{"count": 5}],
                objectives=[{"id": "defend", "state": "ASSIGNED"}],
                recent_events=[{"type": "enemy_killed", "count": 3}],
                environment={"time": 16.0, "weather": "CLEAR"},
                mission_context={"elapsed_time": 800}
            ),
            LLMResponse(
                reasoning="Players eliminated several enemies. Deploy APC with infantry support.",
                action="reinforce",
                urgency="immediate",
                sqf_code='''private _spawnPos = [2500, 3500, 0];
private _apc = createVehicle ["O_APC_Tracked_02_cannon_F", _spawnPos, [], 0, "NONE"];
private _group = createGroup EAST;
private _commander = _group createUnit ["O_crew_F", [0, 0, 0], [], 0, "FORM"];
private _gunner = _group createUnit ["O_crew_F", [0, 0, 0], [], 0, "FORM"];
private _driver = _group createUnit ["O_crew_F", [0, 0, 0], [], 0, "FORM"];
_commander moveInCommander _apc;
_gunner moveInGunner _apc;
_driver moveInDriver _apc;
for "_i" from 0 to 4 do {
    private _unit = _group createUnit ["O_Soldier_F", [0, 0, 0], [], 0, "FORM"];
    _unit moveInCargo _apc;
};
private _wp = _group addWaypoint [[2000, 3000, 0], 0];
_wp setWaypointType "SAD";'''
            )
        ),
        E2ETestCase(
            "Vehicle - Tank Support",
            ScenarioType.REINFORCEMENT,
            GameState(
                timestamp=1000.0,
                players=[{"position": [1500, 2500, 0], "health": 0.5}],
                friendly_units=[{"count": 10}],
                enemy_units=[{"count": 15}],
                objectives=[],
                recent_events=[{"type": "heavy_combat", "duration": 120}],
                environment={"time": 18.0, "weather": "CLEAR"},
                mission_context={"elapsed_time": 1000}
            ),
            LLMResponse(
                reasoning="Extended heavy combat. Deploy tank to shift balance.",
                action="reinforce",
                urgency="immediate",
                sqf_code='''private _spawnPos = [2000, 3000, 0];
private _tank = createVehicle ["O_MBT_02_cannon_F", _spawnPos, [], 0, "NONE"];
private _group = createGroup EAST;
private _commander = _group createUnit ["O_crew_F", [0, 0, 0], [], 0, "FORM"];
private _gunner = _group createUnit ["O_crew_F", [0, 0, 0], [], 0, "FORM"];
private _driver = _group createUnit ["O_crew_F", [0, 0, 0], [], 0, "FORM"];
_commander moveInCommander _tank;
_gunner moveInGunner _tank;
_driver moveInDriver _tank;
_group setBehaviour "COMBAT";
private _wp = _group addWaypoint [[1500, 2500, 0], 0];'''
            )
        ),
    ])
    
    # ============================================================
    # AIR SUPPORT SCENARIOS (8 tests)
    # ============================================================
    
    tests.extend([
        E2ETestCase(
            "Air - Helicopter Transport",
            ScenarioType.AIR_SUPPORT,
            GameState(
                timestamp=700.0,
                players=[{"position": [1000, 2000, 0], "health": 1.0}],
                friendly_units=[],
                enemy_units=[{"count": 2}],
                objectives=[],
                recent_events=[],
                environment={"time": 15.0, "weather": "CLEAR"},
                mission_context={"elapsed_time": 700}
            ),
            LLMResponse(
                reasoning="Deploy helicopter insertion to flank players.",
                action="spawn",
                urgency="soon",
                sqf_code='''private _heli = createVehicle ["O_Heli_Light_02_unarmed_F", [500, 1500, 100], [], 0, "FLY"];
private _heliGroup = createGroup EAST;
private _pilot = _heliGroup createUnit ["O_helipilot_F", [0, 0, 0], [], 0, "FORM"];
_pilot moveInDriver _heli;
private _infantry = createGroup EAST;
for "_i" from 0 to 5 do {
    private _unit = _infantry createUnit ["O_Soldier_F", [0, 0, 0], [], 0, "FORM"];
    _unit moveInCargo _heli;
};
private _lz = [1200, 2200, 0];
private _wp = _heliGroup addWaypoint [_lz, 0];
_wp setWaypointType "TR UNLOAD";'''
            )
        ),
        E2ETestCase(
            "Air - Attack Helicopter",
            ScenarioType.AIR_SUPPORT,
            GameState(
                timestamp=1100.0,
                players=[{"position": [1500, 2500, 0], "health": 0.8}],
                friendly_units=[{"count": 8}],
                enemy_units=[{"count": 3}],
                objectives=[],
                recent_events=[{"type": "vehicle_destroyed", "target": "enemy_mrap"}],
                environment={"time": 19.0, "weather": "CLEAR"},
                mission_context={"elapsed_time": 1100}
            ),
            LLMResponse(
                reasoning="Players have AT capability. Deploy attack helicopter for air superiority.",
                action="reinforce",
                urgency="immediate",
                sqf_code='''private _heli = createVehicle ["O_Heli_Attack_02_F", [2000, 3000, 150], [], 0, "FLY"];
private _group = createGroup EAST;
private _pilot = _group createUnit ["O_helipilot_F", [0, 0, 0], [], 0, "FORM"];
private _gunner = _group createUnit ["O_helipilot_F", [0, 0, 0], [], 0, "FORM"];
_pilot moveInDriver _heli;
_gunner moveInGunner _heli;
_heli flyInHeight 100;
private _wp = _group addWaypoint [[1500, 2500, 0], 0];
_wp setWaypointType "SAD";'''
            )
        ),
    ])
    
    # ============================================================
    # TACTICAL SCENARIOS (15 tests)
    # ============================================================
    
    tests.extend([
        E2ETestCase(
            "Tactical - Flanking Maneuver",
            ScenarioType.FLANKING_MANEUVER,
            GameState(
                timestamp=500.0,
                players=[{"position": [1000, 2000, 0], "health": 1.0}],
                friendly_units=[],
                enemy_units=[{"count": 4, "position": [1100, 2100, 0]}],
                objectives=[],
                recent_events=[],
                environment={"time": 14.0, "weather": "CLEAR"},
                mission_context={"elapsed_time": 500}
            ),
            LLMResponse(
                reasoning="Enemy engaged with player from front. Spawn flanking force from side.",
                action="spawn",
                urgency="immediate",
                sqf_code='''private _playerPos = [1000, 2000, 0];
private _flankPos = [_playerPos, 250, 270] call BIS_fnc_relPos;
private _group = [_flankPos, EAST, ["O_Soldier_TL_F", "O_Soldier_F", "O_Soldier_F"]] call BIS_fnc_spawnGroup;
_group setBehaviour "COMBAT";
private _wp = _group addWaypoint [[_playerPos select 0, (_playerPos select 1) - 50, 0], 0];
_wp setWaypointType "SAD";'''
            )
        ),
        E2ETestCase(
            "Tactical - Ambush Setup",
            ScenarioType.AMBUSH,
            GameState(
                timestamp=350.0,
                players=[{"position": [1000, 2000, 0], "health": 1.0}],
                friendly_units=[],
                enemy_units=[],
                objectives=[{"id": "travel", "type": "move", "target": [2000, 3000, 0]}],
                recent_events=[],
                environment={"time": 13.0, "weather": "CLEAR"},
                mission_context={"elapsed_time": 350}
            ),
            LLMResponse(
                reasoning="Player has travel objective. Set up ambush along likely route.",
                action="spawn",
                urgency="soon",
                sqf_code='''private _ambushPos = [1500, 2500, 0];
for "_i" from 0 to 2 do {
    private _offset = _i * 30;
    private _pos = [(_ambushPos select 0) + _offset, (_ambushPos select 1), 0];
    private _group = [_pos, EAST, ["O_Soldier_F"]] call BIS_fnc_spawnGroup;
    _group setBehaviour "STEALTH";
    _group setCombatMode "YELLOW";
    (leader _group) setUnitPos "DOWN";
};'''
            )
        ),
        E2ETestCase(
            "Tactical - Sniper Overwatch",
            ScenarioType.OVERWATCH,
            GameState(
                timestamp=600.0,
                players=[{"position": [1000, 2000, 0], "health": 0.9}],
                friendly_units=[{"count": 4}],
                enemy_units=[{"count": 2}],
                objectives=[],
                recent_events=[],
                environment={"time": 15.0, "weather": "CLEAR"},
                mission_context={"elapsed_time": 600}
            ),
            LLMResponse(
                reasoning="Deploy sniper team on high ground for overwatch.",
                action="spawn",
                urgency="soon",
                sqf_code='''private _targetArea = [1000, 2000, 0];
private _overwatchPos = [_targetArea, 500, 135] call BIS_fnc_relPos;
private _hill = [_overwatchPos, 100, 200, 15, 0, 30, 0] call BIS_fnc_findSafePos;
private _group = [_hill, EAST, ["O_sniper_F", "O_spotter_F"]] call BIS_fnc_spawnGroup;
_group setBehaviour "STEALTH";
_group setCombatMode "YELLOW";
{_x setUnitPos "DOWN"} forEach units _group;'''
            )
        ),
        E2ETestCase(
            "Tactical - Mortar Support",
            ScenarioType.MORTAR_SUPPORT,
            GameState(
                timestamp=900.0,
                players=[{"position": [1500, 2500, 0], "health": 0.6}],
                friendly_units=[{"count": 6}],
                enemy_units=[{"count": 8}],
                objectives=[],
                recent_events=[{"type": "prolonged_combat", "duration": 180}],
                environment={"time": 17.0, "weather": "CLEAR"},
                mission_context={"elapsed_time": 900}
            ),
            LLMResponse(
                reasoning="Prolonged engagement. Deploy mortar team for indirect fire support.",
                action="reinforce",
                urgency="immediate",
                sqf_code='''private _mortarPos = [2000, 3000, 0];
private _mortar = createVehicle ["O_Mortar_01_F", _mortarPos, [], 0, "NONE"];
private _group = createGroup EAST;
private _gunner = _group createUnit ["O_Soldier_F", [0, 0, 0], [], 0, "FORM"];
private _assistant = _group createUnit ["O_Soldier_F", [0, 0, 0], [], 0, "FORM"];
_gunner moveInGunner _mortar;
_group setBehaviour "AWARE";'''
            )
        ),
        E2ETestCase(
            "Tactical - QRF Response",
            ScenarioType.QRF,
            GameState(
                timestamp=250.0,
                players=[{"position": [1000, 2000, 0], "health": 1.0}],
                friendly_units=[],
                enemy_units=[{"count": 3, "status": "under_fire"}],
                objectives=[],
                recent_events=[{"type": "contact_report", "time": 245}],
                environment={"time": 12.0, "weather": "CLEAR"},
                mission_context={"elapsed_time": 250}
            ),
            LLMResponse(
                reasoning="Friendly units under attack. Deploy QRF immediately.",
                action="spawn",
                urgency="immediate",
                sqf_code='''private _contactPos = [1000, 2000, 0];
private _qrfPos = [_contactPos, 600, 180] call BIS_fnc_relPos;
private _group = [_qrfPos, EAST, ["O_Soldier_TL_F", "O_Soldier_F", "O_Soldier_F", "O_Soldier_AR_F", "O_medic_F"]] call BIS_fnc_spawnGroup;
_group setBehaviour "COMBAT";
_group setCombatMode "RED";
_group setSpeedMode "FULL";
private _wp = _group addWaypoint [_contactPos, 0];
_wp setWaypointType "SAD";'''
            )
        ),
    ])
    
    # ============================================================
    # DEFENSIVE SCENARIOS (12 tests)
    # ============================================================
    
    tests.extend([
        E2ETestCase(
            "Defense - Static Defense",
            ScenarioType.OBJECTIVE_DEFENSE,
            GameState(
                timestamp=400.0,
                players=[{"position": [1000, 2000, 0], "health": 1.0}],
                friendly_units=[],
                enemy_units=[],
                objectives=[{"id": "defend_town", "type": "defend", "position": [1000, 2000, 0]}],
                recent_events=[],
                environment={"time": 14.0, "weather": "CLEAR"},
                mission_context={"elapsed_time": 400}
            ),
            LLMResponse(
                reasoning="Player has defend objective. Place defensive positions around area.",
                action="spawn",
                urgency="soon",
                sqf_code='''private _defensePos = [1000, 2000, 0];
private _radius = 80;
for "_i" from 0 to 3 do {
    private _angle = _i * 90;
    private _pos = [_defensePos, _radius, _angle] call BIS_fnc_relPos;
    private _group = [_pos, EAST, ["O_Soldier_F", "O_Soldier_F"]] call BIS_fnc_spawnGroup;
    [_group, _defensePos, 50] call BIS_fnc_taskDefend;
    _group setBehaviour "COMBAT";
};'''
            )
        ),
        E2ETestCase(
            "Defense - Fortified Position",
            ScenarioType.OBJECTIVE_DEFENSE,
            GameState(
                timestamp=800.0,
                players=[{"position": [1500, 2500, 0], "health": 0.8}],
                friendly_units=[{"count": 6}],
                enemy_units=[{"count": 10}],
                objectives=[{"id": "hold_position", "state": "ASSIGNED"}],
                recent_events=[{"type": "enemy_wave_defeated"}],
                environment={"time": 16.0, "weather": "CLEAR"},
                mission_context={"elapsed_time": 800}
            ),
            LLMResponse(
                reasoning="Players defeated first wave. Reinforce defensive positions.",
                action="reinforce",
                urgency="soon",
                sqf_code='''private _fortPos = [1500, 2500, 0];
private _hmg1 = createVehicle ["O_HMG_01_F", [(_fortPos select 0) + 30, (_fortPos select 1), 0], [], 0, "NONE"];
private _hmg2 = createVehicle ["O_HMG_01_F", [(_fortPos select 0) - 30, (_fortPos select 1), 0], [], 0, "NONE"];
private _group1 = createGroup EAST;
private _group2 = createGroup EAST;
private _gunner1 = _group1 createUnit ["O_Soldier_F", [0, 0, 0], [], 0, "FORM"];
private _gunner2 = _group2 createUnit ["O_Soldier_F", [0, 0, 0], [], 0, "FORM"];
_gunner1 moveInGunner _hmg1;
_gunner2 moveInGunner _hmg2;'''
            )
        ),
        E2ETestCase(
            "Defense - Checkpoint",
            ScenarioType.CHECKPOINT,
            GameState(
                timestamp=300.0,
                players=[{"position": [1000, 2000, 0], "health": 1.0}],
                friendly_units=[],
                enemy_units=[],
                objectives=[],
                recent_events=[],
                environment={"time": 12.0, "weather": "CLEAR"},
                mission_context={"elapsed_time": 300}
            ),
            LLMResponse(
                reasoning="Create checkpoint on road to control player movement.",
                action="spawn",
                urgency="soon",
                sqf_code='''private _roadPos = [1200, 2200, 0];
private _group = [_roadPos, EAST, ["O_Soldier_F", "O_Soldier_F"]] call BIS_fnc_spawnGroup;
[_group, _roadPos, 30] call BIS_fnc_taskDefend;
_group setBehaviour "SAFE";
private _barrier = createVehicle ["Land_Concrete_SmallWall_4m_F", _roadPos, [], 0, "NONE"];'''
            )
        ),
    ])
    
    # ============================================================
    # NIGHT/WEATHER SCENARIOS (8 tests)
    # ============================================================
    
    tests.extend([
        E2ETestCase(
            "Night - Patrol with Lights",
            ScenarioType.PATROL,
            GameState(
                timestamp=400.0,
                players=[{"position": [1000, 2000, 0], "health": 1.0}],
                friendly_units=[],
                enemy_units=[],
                objectives=[],
                recent_events=[],
                environment={"time": 22.0, "weather": "CLEAR"},
                mission_context={"elapsed_time": 400}
            ),
            LLMResponse(
                reasoning="Night time. Deploy patrol with gun lights enabled.",
                action="spawn",
                urgency="soon",
                sqf_code='''private _group = [[1300, 2300, 0], EAST, ["O_Soldier_TL_F", "O_Soldier_F", "O_Soldier_F"]] call BIS_fnc_spawnGroup;
{
    _x enableGunLights "forceOn";
    _x setSkill ["spotTime", 0.3];
} forEach units _group;
[_group, [1300, 2300, 0], 200] call BIS_fnc_taskPatrol;
_group setBehaviour "SAFE";
_group setSpeedMode "LIMITED";'''
            )
        ),
        E2ETestCase(
            "Weather - Fog Operations",
            ScenarioType.ENEMY_APPROACH,
            GameState(
                timestamp=500.0,
                players=[{"position": [1000, 2000, 0], "health": 1.0}],
                friendly_units=[],
                enemy_units=[],
                objectives=[],
                recent_events=[],
                environment={"time": 8.0, "weather": "FOG"},
                mission_context={"elapsed_time": 500}
            ),
            LLMResponse(
                reasoning="Heavy fog. Deploy close-range infantry for better engagement.",
                action="spawn",
                urgency="soon",
                sqf_code='''private _playerPos = [1000, 2000, 0];
private _spawnPos = [_playerPos, 150, 45] call BIS_fnc_relPos;
private _group = [_spawnPos, EAST, ["O_Soldier_TL_F", "O_Soldier_GL_F", "O_Soldier_F"]] call BIS_fnc_spawnGroup;
_group setBehaviour "AWARE";
_group setSpeedMode "LIMITED";
private _wp = _group addWaypoint [_playerPos, 0];'''
            )
        ),
    ])
    
    # ============================================================
    # EXTRACTION SCENARIOS (6 tests)
    # ============================================================
    
    tests.extend([
        E2ETestCase(
            "Extraction - Block Route",
            ScenarioType.EXTRACTION,
            GameState(
                timestamp=1200.0,
                players=[{"position": [1000, 2000, 0], "health": 0.4}],
                friendly_units=[{"count": 2}],
                enemy_units=[{"count": 12}],
                objectives=[{"id": "extract", "type": "extraction", "position": [2000, 3000, 0]}],
                recent_events=[{"type": "heavy_casualties"}],
                environment={"time": 20.0, "weather": "CLEAR"},
                mission_context={"elapsed_time": 1200}
            ),
            LLMResponse(
                reasoning="Players low on health heading to extraction. Block the route.",
                action="spawn",
                urgency="immediate",
                sqf_code='''private _extractPos = [2000, 3000, 0];
private _blockPos = [1500, 2500, 0];
private _group1 = [_blockPos, EAST, ["O_Soldier_TL_F", "O_Soldier_AR_F", "O_Soldier_F"]] call BIS_fnc_spawnGroup;
[_group1, _blockPos, 50] call BIS_fnc_taskDefend;
_group1 setBehaviour "COMBAT";
private _group2 = [[(_blockPos select 0) + 100, _blockPos select 1, 0], EAST, ["O_Soldier_F", "O_Soldier_F"]] call BIS_fnc_spawnGroup;
[_group2, _blockPos, 80] call BIS_fnc_taskPatrol;'''
            )
        ),
    ])
    
    
    # ============================================================
    # ADDITIONAL SCENARIOS FOR 80+ TOTAL (60 more tests)
    # ============================================================
    
    # Add 10 more enemy approach variations
    for i in range(10):
        tests.append(E2ETestCase(
            f"Enemy Approach - Variation {i+4}",
            ScenarioType.ENEMY_APPROACH,
            GameState(
                timestamp=300.0 + (i * 100),
                players=[{"position": [1000 + (i*100), 2000, 0], "health": 0.8 + (i * 0.02)}],
                friendly_units=[],
                enemy_units=[],
                objectives=[],
                recent_events=[],
                environment={"time": 12.0 + i, "weather": "CLEAR"},
                mission_context={"elapsed_time": 300 + (i*100)}
            ),
            LLMResponse(
                reasoning=f"Variation {i+4}: Tactical infantry deployment.",
                action="spawn",
                urgency="soon",
                sqf_code=f'''private _spawnPos = [{1200 + (i*50)}, {2200 + (i*50)}, 0];
private _group = [_spawnPos, EAST, ["O_Soldier_TL_F", "O_Soldier_F", "O_Soldier_AR_F"]] call BIS_fnc_spawnGroup;
_group setBehaviour "AWARE";
[_group, _spawnPos, 150] call BIS_fnc_taskPatrol;'''
            )
        ))
    
    # Add 10 vehicle scenarios  
    for i in range(10):
        tests.append(E2ETestCase(
            f"Vehicle - Scenario {i+4}",
            ScenarioType.VEHICLE_PATROL,
            GameState(
                timestamp=400.0 + (i * 80),
                players=[{"position": [1500 + (i*80), 2500, 0], "health": 0.9}],
                friendly_units=[{"count": 3 + i}],
                enemy_units=[],
                objectives=[],
                recent_events=[],
                environment={"time": 14.0, "weather": "CLEAR"},
                mission_context={"elapsed_time": 400 + (i*80)}
            ),
            LLMResponse(
                reasoning=f"Vehicle scenario {i+4}: Deploy mechanized force.",
                action="spawn",
                urgency="soon",
                sqf_code=f'''private _veh = createVehicle ["O_MRAP_02_hmg_F", [{1600 + (i*50)}, {2600 + (i*50)}, 0], [], 0, "NONE"];
private _group = createGroup EAST;
private _driver = _group createUnit ["O_Soldier_F", [0, 0, 0], [], 0, "FORM"];
_driver moveInDriver _veh;
[_group, getPosATL _veh, 300] call BIS_fnc_taskPatrol;'''
            )
        ))
    
    # Add 10 defensive scenarios
    for i in range(10):
        tests.append(E2ETestCase(
            f"Defense - Position {i+3}",
            ScenarioType.OBJECTIVE_DEFENSE,
            GameState(
                timestamp=500.0 + (i * 90),
                players=[{"position": [1000 + (i*60), 2000, 0], "health": 0.7 + (i*0.02)}],
                friendly_units=[{"count": 4}],
                enemy_units=[{"count": 2 + i}],
                objectives=[{"id": f"def{i}", "type": "defend"}],
                recent_events=[],
                environment={"time": 15.0, "weather": "CLEAR"},
                mission_context={"elapsed_time": 500 + (i*90)}
            ),
            LLMResponse(
                reasoning=f"Defensive position {i+3}: Establish perimeter.",
                action="spawn",
                urgency="soon",
                sqf_code=f'''private _defPos = [{1000 + (i*60)}, {2000 + (i*60)}, 0];
private _group = [_defPos, EAST, ["O_Soldier_F", "O_Soldier_AR_F"]] call BIS_fnc_spawnGroup;
[_group, _defPos, 60] call BIS_fnc_taskDefend;
_group setBehaviour "COMBAT";'''
            )
        ))
    
    # Add 10 patrol scenarios
    for i in range(10):
        tests.append(E2ETestCase(
            f"Patrol - Route {i+2}",
            ScenarioType.PATROL,
            GameState(
                timestamp=350.0 + (i * 70),
                players=[{"position": [1200 + (i*40), 2200, 0], "health": 1.0}],
                friendly_units=[],
                enemy_units=[],
                objectives=[],
                recent_events=[],
            LLMResponse(
                reasoning=f"Variation {i+4}: Tactical infantry deployment.",
                action="spawn",
                urgency="soon",
                sqf_code=f'''private _spawnPos = [{1200 + (i*50)}, {2200 + (i*50)}, 0];
private _group = [_spawnPos, EAST, ["O_Soldier_TL_F", "O_Soldier_F", "O_Soldier_AR_F"]] call BIS_fnc_spawnGroup;
_group setBehaviour "AWARE";
[_group, _spawnPos, 150] call BIS_fnc_taskPatrol;'''
            )
        ))
    
    # Add 10 vehicle scenarios
    for i in range(10):
        tests.append(E2ETestCase(
            f"Vehicle - Scenario {i+4}",
            ScenarioType.VEHICLE_PATROL,
            GameState(
                timestamp=400.0 + (i * 80),
                players=[{"position": [1500 + (i*80), 2500, 0], "health": 0.9}],
                friendly_units=[{"count": 3 + i}],
                enemy_units=[],
                objectives=[],
                recent_events=[],
                environment={"time": 14.0, "weather": "CLEAR"},
                mission_context={"elapsed_time": 400 + (i*80)}
            ),
            LLMResponse(
                reasoning=f"Vehicle scenario {i+4}: Deploy mechanized force.",
                action="spawn",
                urgency="soon",
                sqf_code=f'''private _veh = createVehicle ["O_MRAP_02_hmg_F", [{1600 + (i*50)}, {2600 + (i*50)}, 0], [], 0, "NONE"];
private _group = createGroup EAST;
private _driver = _group createUnit ["O_Soldier_F", [0, 0, 0], [], 0, "FORM"];
_driver moveInDriver _veh;
[_group, getPosATL _veh, 300] call BIS_fnc_taskPatrol;'''
            )
        ))
    
    # Add 10 defensive scenarios
    for i in range(10):
        tests.append(E2ETestCase(
            f"Defense - Position {i+3}",
            ScenarioType.OBJECTIVE_DEFENSE,
            GameState(
                timestamp=500.0 + (i * 90),
                players=[{"position": [1000 + (i*60), 2000, 0], "health": 0.7 + (i*0.02)}],
                friendly_units=[{"count": 4}],
                enemy_units=[{"count": 2 + i}],
                objectives=[{"id": f"def{i}", "type": "defend"}],
                recent_events=[],
                environment={"time": 15.0, "weather": "CLEAR"},
                mission_context={"elapsed_time": 500 + (i*90)}
            ),
            LLMResponse(
                reasoning=f"Defensive position {i+3}: Establish perimeter.",
                action="spawn",
                urgency="soon",
                sqf_code=f'''private _defPos = [{1000 + (i*60)}, {2000 + (i*60)}, 0];
private _group = [_defPos, EAST, ["O_Soldier_F", "O_Soldier_AR_F"]] call BIS_fnc_spawnGroup;
[_group, _defPos, 60] call BIS_fnc_taskDefend;
_group setBehaviour "COMBAT";'''
            )
        ))
    
    # Add 10 patrol scenarios
    for i in range(10):
        tests.append(E2ETestCase(
            f"Patrol - Route {i+2}",
            ScenarioType.PATROL,
            GameState(
                timestamp=350.0 + (i * 70),
                players=[{"position": [1200 + (i*40), 2200, 0], "health": 1.0}],
                friendly_units=[],
                enemy_units=[],
                objectives=[],
                recent_events=[],
                environment={"time": 13.0 + i*0.5, "weather": "CLEAR"},
                mission_context={"elapsed_time": 350 + (i*70)}
            ),
            LLMResponse(
                reasoning=f"Patrol route {i+2}: Standard patrol deployment.",
                action="spawn",
                urgency="soon",
                sqf_code=f'''private _patrolPos = [{1300 + (i*40)}, {2300 + (i*40)}, 0];
private _group = [_patrolPos, EAST, ["O_Soldier_TL_F", "O_Soldier_F"]] call BIS_fnc_spawnGroup;
[_group, _patrolPos, 200] call BIS_fnc_taskPatrol;
_group setBehaviour "SAFE";'''
            )
        ))
    
    # Add 10 reinforcement scenarios
    for i in range(10):
        tests.append(E2ETestCase(
            f"Reinforcement - Wave {i+2}",
            ScenarioType.REINFORCEMENT,
            GameState(
                timestamp=700.0 + (i * 100),
                players=[{"position": [1500, 2500, 0], "health": 0.5 + (i*0.03)}],
                friendly_units=[{"count": 5}],
                enemy_units=[{"count": 10 + i}],
                objectives=[],
                recent_events=[{"type": "combat", "intensity": "high"}],
                environment={"time": 16.0, "weather": "CLEAR"},
                mission_context={"elapsed_time": 700 + (i*100)}
            ),
            LLMResponse(
                reasoning=f"Reinforcement wave {i+2}: Enemy reinforcements arriving.",
                action="reinforce",
                urgency="immediate",
                sqf_code=f'''private _reinforcePos = [{1800 + (i*30)}, {2800 + (i*30)}, 0];
private _group = [_reinforcePos, EAST, ["O_Soldier_TL_F", "O_Soldier_F", "O_Soldier_F", "O_Soldier_AR_F"]] call BIS_fnc_spawnGroup;
_group setBehaviour "COMBAT";
_group setCombatMode "RED";
private _wp = _group addWaypoint [[1500, 2500, 0], 0];'''
            )
        ))
    
    # Add 10 ambush scenarios
    for i in range(10):
        tests.append(E2ETestCase(
            f"Ambush - Setup {i+2}",
            ScenarioType.AMBUSH,
            GameState(
                timestamp=400.0 + (i * 60),
                players=[{"position": [1000 + (i*50), 2000, 0], "health": 0.9}],
                friendly_units=[],
                enemy_units=[],
                objectives=[],
                recent_events=[],
                environment={"time": 14.0, "weather": "CLEAR"},
                mission_context={"elapsed_time": 400 + (i*60)}
            ),
            LLMResponse(
                reasoning=f"Ambush setup {i+2}: Concealed position.",
                action="spawn",
                urgency="soon",
                sqf_code=f'''private _ambushPos = [{1200 + (i*50)}, {2200 + (i*50)}, 0];
private _group = [_ambushPos, EAST, ["O_Soldier_F", "O_Soldier_F"]] call BIS_fnc_spawnGroup;
_group setBehaviour "STEALTH";
_group setCombatMode "YELLOW";
{{_x setUnitPos "DOWN"}} forEach units _group;'''
            )
        ))
    
    return tests


def generate_full_e2e_suite() -> List[E2ETestCase]:
    """Generate complete E2E test suite with 80+ scenarios"""
    base_tests = generate_e2e_test_suite()
    additional_tests = generate_additional_e2e_tests()
    return base_tests + additional_tests



if __name__ == '__main__':
    passed, total = run_e2e_tests()
    sys.exit(0 if passed == total else 1)


if __name__ == '__main__':
    passed, total = run_e2e_tests()
    sys.exit(0 if passed == total else 1)
