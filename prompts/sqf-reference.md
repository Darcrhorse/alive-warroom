# Arma 3 SQF Reference for LLM Game Master

This document provides essential SQF commands and patterns for the LLM Game Master system.
Reference: Bohemia Interactive Community Wiki (community.bistudio.com/wiki)

## Core Commands

### Unit Creation

```sqf
// Create a group
_group = createGroup EAST;  // EAST, WEST, INDEPENDENT, CIVILIAN

// Create a unit in a group
_unit = _group createUnit ["classname", position, [], 0, "FORM"];

// Alternative: spawn a full group
_group = [position, EAST, ["O_Soldier_TL_F", "O_Soldier_F"]] call BIS_fnc_spawnGroup;
```

### Vehicle Creation

```sqf
// Create vehicle
_vehicle = createVehicle ["vehicleClass", position, [], 0, "NONE"];

// Add crew to vehicle
_crew = createVehicleCrew _vehicle;
```

### Position Commands

```sqf
// Get position
_pos = getPosATL unit;  // Above terrain level
_pos = getPosASL unit;  // Above sea level

// Set position
unit setPosATL [x, y, z];

// Calculate relative position
_newPos = [startPos, distance, direction] call BIS_fnc_relPos;
```

### AI Behavior

```sqf
// Set group behaviour
_group setBehaviour "CARELESS";  // Ignores enemies
_group setBehaviour "SAFE";      // Normal patrol
_group setBehaviour "AWARE";     // Alert, looking for enemies
_group setBehaviour "COMBAT";    // In combat, aggressive
_group setBehaviour "STEALTH";   // Stealthy movement

// Set combat mode
_group setCombatMode "BLUE";     // Never fire
_group setCombatMode "GREEN";    // Hold fire, defend only
_group setCombatMode "YELLOW";   // Fire at will, keep formation
_group setCombatMode "RED";      // Fire at will, free movement

// Set speed mode
_group setSpeedMode "LIMITED";   // Slow
_group setSpeedMode "NORMAL";    // Normal
_group setSpeedMode "FULL";      // Fast

// Set formation
_group setFormation "COLUMN";    // Column
_group setFormation "LINE";      // Line
_group setFormation "WEDGE";     // Wedge
```

### Waypoints

```sqf
// Add waypoint
_wp = _group addWaypoint [position, radius];
_wp setWaypointType "MOVE";      // Movement waypoint
_wp setWaypointType "DESTROY";   // Attack waypoint
_wp setWaypointType "SAD";       // Search and destroy

// Patrol using BIS function
[_group, position, radius] call BIS_fnc_taskPatrol;

// Defend position
[_group, position, radius] call BIS_fnc_taskDefend;
```

### Tasks/Objectives

```sqf
// Create task
[
  owner,           // true for all players, or [player1, player2]
  taskId,          // Unique string ID
  [description, title, marker],
  position,        // Task location
  state,           // "CREATED", "ASSIGNED", "SUCCEEDED", "FAILED", "CANCELED"
  priority,        // Number (higher = more important)
  showNotification,// true/false
  type            // "ATTACK", "DEFEND", "MOVE", etc.
] call BIS_fnc_taskCreate;

// Update task state
[taskId, "SUCCEEDED"] call BIS_fnc_taskSetState;
```

### Communication

```sqf
// Radio message (side chat)
[unit, "Message text"] remoteExec ["sideChat", 0];

// System message
"Message text" remoteExec ["systemChat", 0];

// Hint
"Hint text" remoteExec ["hint", 0];
```

### Skill & Loadout

```sqf
// Set unit skill (0-1)
_unit setSkill 0.7;
_unit setSkill ["aimingAccuracy", 0.5];
_unit setSkill ["spotDistance", 0.8];

// Add items
_unit addMagazine "30Rnd_65x39_caseless_mag";
_unit addWeapon "arifle_MX_F";

// Remove all items
removeAllWeapons _unit;
removeAllItems _unit;
```

## BIS Functions

### Spawning

```sqf
// BIS_fnc_spawnGroup - Spawn a full group
_group = [position, side, unitArray] call BIS_fnc_spawnGroup;

// Example
_group = [[0,0,0], EAST, ["O_Soldier_TL_F", "O_Soldier_F", "O_Soldier_F"]] call BIS_fnc_spawnGroup;
```

### Positioning

```sqf
// BIS_fnc_relPos - Calculate position relative to another
_pos = [startPos, distance, direction] call BIS_fnc_relPos;

// BIS_fnc_findSafePos - Find safe spawn position
_pos = [centerPos, minDist, maxDist] call BIS_fnc_findSafePos;
```

### Tasks

```sqf
// BIS_fnc_taskPatrol - Make group patrol area
[_group, position, radius] call BIS_fnc_taskPatrol;

// BIS_fnc_taskDefend - Make group defend position
[_group, position] call BIS_fnc_taskDefend;

// BIS_fnc_taskAttack - Make group attack position
[_group, position] call BIS_fnc_taskAttack;
```

## Safe Coding Practices

### Use Private Variables

```sqf
// Always use private for local variables
private _group = createGroup EAST;
private _pos = [100, 200, 0];
```

### Check Existence

```sqf
// Check if unit exists before using
if (!isNull _unit && alive _unit) then {
    _unit setDamage 0.5;
};
```

### Distance Checks

```sqf
// Always check distance from players before spawning
private _players = allPlayers;
private _tooClose = false;
{
    if (_x distance _spawnPos < 200) then {
        _tooClose = true;
    };
} forEach _players;

if (!_tooClose) then {
    // Safe to spawn
};
```

## Forbidden Commands

**NEVER use these commands:**
- endMission, failMission, forceEnd
- terminate, exitWith (at global level)
- deleteVehicle player
- setDamage 1 on player units
- serverCommand, admin
- File operations: loadFile, saveProfileNamespace, preprocessFile
- Direct player control: selectPlayer

## Best Practices

1. **Always use private variables**: `private _var = value;`
2. **Check null and alive**: `if (!isNull _unit && alive _unit)`
3. **Use BIS functions**: They're tested and reliable
4. **Add comments**: Explain what your code does
5. **Test distances**: Never spawn on players
6. **Set behaviors**: Always set behaviour and combat mode
7. **Clean up**: Store references for later cleanup if needed

## Example Complete Spawn Pattern

```sqf
// Safe spawn pattern with all checks
private _playerPos = getPosATL (leader (group player));
private _spawnPos = [_playerPos, 300, random 360] call BIS_fnc_relPos;

// Verify spawn position is safe
private _tooClose = false;
{
    if (_x distance _spawnPos < 200) exitWith { _tooClose = true; };
} forEach allPlayers;

if (!_tooClose) then {
    private _group = createGroup EAST;
    {
        private _unit = _group createUnit [_x, _spawnPos, [], 0, "FORM"];
        _unit setSkill 0.6;
    } forEach ["O_Soldier_TL_F", "O_Soldier_F", "O_Soldier_F", "O_Soldier_AR_F"];
    
    _group setBehaviour "AWARE";
    _group setCombatMode "YELLOW";
    [_group, _spawnPos, 150] call BIS_fnc_taskPatrol;
    
    // Log for debugging
    diag_log format ["[LLMGM] Spawned group at %1", _spawnPos];
};
```
