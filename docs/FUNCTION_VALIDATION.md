# Arma 3 Function Definitions - Official Validation Reference

## Purpose
This document contains **officially validated** function definitions from Bohemia Interactive Community Wiki to ensure 100% correctness of LLM-generated SQF code.

## Core Spawning Functions

### createGroup
**Official Syntax:**
```sqf
createGroup side
createGroup [side, deleteWhenEmpty]
```

**Parameters:**
- `side`: Side (west/BLUFOR, east/OPFOR, resistance/INDEPENDENT, civilian, sideLogic)
- `deleteWhenEmpty`: Boolean (optional) - auto-delete when empty

**Returns:** Group object (or `grpNull` if limit reached)

**Example:**
```sqf
private _group = createGroup EAST;
private _group = createGroup [WEST, true];
```

**Source:** https://community.bistudio.com/wiki/createGroup

---

### createUnit
**Official Syntax:**
```sqf
_group createUnit [type, position, markers, placement, special]
```

**Parameters:**
- `_group`: Group - must be local
- `type`: String - unit classname from CfgVehicles
- `position`: Position/Object/Group - spawn reference
- `markers`: Array - marker names for random placement
- `placement`: Number - radius in meters
- `special`: String - "NONE", "FORM", "CAN_COLLIDE", "CARGO"

**Returns:** Object - the created unit

**Special Values:**
- `"NONE"` - nearest available position
- `"FORM"` - formation position
- `"CAN_COLLIDE"` - exact position
- `"CARGO"` - in vehicle cargo

**Example:**
```sqf
private _group = createGroup EAST;
private _unit = _group createUnit ["O_Soldier_F", [100, 200, 0], [], 0, "NONE"];
```

**Source:** https://community.bistudio.com/wiki/createUnit

---

### BIS_fnc_spawnGroup
**Official Syntax:**
```sqf
[position, side, toSpawn, relPositions, ranks, skillRange, ammoRange, randomControls, azimuth, precisePos, maxVehicles] call BIS_fnc_spawnGroup
```

**Parameters:**
1. `position`: Array/Object - spawn position
2. `side`: Side - faction (EAST, WEST, INDEPENDENT, CIVILIAN)
3. `toSpawn`: Array/Number/Config
   - Array: list of classnames ["O_Soldier_TL_F", "O_Soldier_F"]
   - Number: count of random units
   - Config: CfgGroups entry
4. `relPositions`: Array (optional) - relative positions for each unit
5. `ranks`: Array (optional) - ranks ["PRIVATE", "SERGEANT", "COLONEL"]
6. `skillRange`: Array (optional) - [min, max] skill 0.0-1.0
7. `ammoRange`: Array (optional) - [min, max] ammo 0.0-1.0
8. `randomControls`: Array (optional) - [minUnits, chance]
9. `azimuth`: Number (optional, default 0) - facing direction
10. `precisePos`: Boolean (optional, default true) - exact positioning
11. `maxVehicles`: Number (optional) - vehicle limit

**Returns:** Group object

**Example:**
```sqf
// Simple spawn
private _group = [[100, 200, 0], EAST, ["O_Soldier_TL_F", "O_Soldier_F", "O_Soldier_AR_F"]] call BIS_fnc_spawnGroup;

// With skill and facing
private _group = [[100, 200, 0], EAST, ["O_Soldier_F"], [], ["SERGEANT"], [0.5, 0.9], [], [1, 1], 180] call BIS_fnc_spawnGroup;
```

**Source:** https://community.bistudio.com/wiki/BIS_fnc_spawnGroup

---

### createVehicle
**Official Syntax:**
```sqf
type createVehicle position
createVehicle [type, position, markers, placement, special]
```

**Parameters:**
- `type`: String - vehicle classname
- `position`: Position array
- `markers`: Array (optional) - markers for random placement
- `placement`: Number (optional) - radius
- `special`: String (optional) - "NONE", "CAN_COLLIDE", "FLY"

**Returns:** Object - the created vehicle

**Example:**
```sqf
private _veh = "O_MRAP_02_F" createVehicle [100, 200, 0];
private _heli = createVehicle ["O_Heli_Light_02_unarmed_F", [100, 200, 50], [], 0, "FLY"];
```

**Source:** https://community.bistudio.com/wiki/createVehicle

---

## Movement & Waypoint Functions

### BIS_fnc_taskPatrol
**Official Syntax:**
```sqf
[group, position, distance, blacklist] call BIS_fnc_taskPatrol
```

**Parameters:**
- `group`: Group - the group to patrol
- `position`: Position/Object/Location - center of patrol area
- `distance`: Number - maximum distance between waypoints in meters
- `blacklist`: Array (optional) - areas to avoid

**Returns:** Boolean

**Example:**
```sqf
[_group, [1000, 2000, 0], 200] call BIS_fnc_taskPatrol;
[group _unit, getPos _unit, 1000] call BIS_fnc_taskPatrol;
```

**Source:** https://community.bistudio.com/wiki/BIS_fnc_taskPatrol

---

### BIS_fnc_taskDefend
**Official Syntax:**
```sqf
[group, position] call BIS_fnc_taskDefend
```

**Parameters:**
- `group`: Group - the group that will defend
- `position`: Position/Object/Location - location to defend

**Returns:** Boolean

**Example:**
```sqf
[_group, [1000, 2000, 0]] call BIS_fnc_taskDefend;
[group this, getPosATL this] call BIS_fnc_taskDefend;
```

**Source:** https://community.bistudio.com/wiki/BIS_fnc_taskDefend

---

### addWaypoint
**Official Syntax:**
```sqf
group addWaypoint [position, radius]
```

**Parameters:**
- `position`: Position array - waypoint location
- `radius`: Number - completion radius

**Returns:** Waypoint array

**Example:**
```sqf
private _wp = _group addWaypoint [[1000, 2000, 0], 0];
_wp setWaypointType "MOVE";
_wp setWaypointBehaviour "AWARE";
```

**Source:** https://community.bistudio.com/wiki/addWaypoint

---

## AI Behavior Functions

### setBehaviour
**Official Syntax:**
```sqf
unitOrGroup setBehaviour behaviour
```

**Parameters:**
- `behaviour`: String - "CARELESS", "SAFE", "AWARE", "COMBAT", "STEALTH"

**Behavior Descriptions:**
- `"CARELESS"` - Ignores enemies, fast movement
- `"SAFE"` - Assumes no enemies
- `"AWARE"` - Expects enemies, ready to engage
- `"COMBAT"` - Enemies present, actively engaging
- `"STEALTH"` - Maximum stealth, slow movement

**Returns:** Nothing

**Example:**
```sqf
_group setBehaviour "COMBAT";
player setBehaviour "STEALTH";
```

**Source:** https://community.bistudio.com/wiki/setBehaviour

---

### setCombatMode
**Official Syntax:**
```sqf
groupOrUnit setCombatMode mode
```

**Parameters:**
- `mode`: String - "BLUE", "GREEN", "WHITE", "YELLOW", "RED"

**Combat Modes:**
- `"BLUE"` - Never fire
- `"GREEN"` - Hold fire (defend only)
- `"WHITE"` - Hold fire, engage at will
- `"YELLOW"` - Fire at will
- `"RED"` - Fire at will, engage at will (most aggressive)

**Returns:** Nothing

**Example:**
```sqf
_group setCombatMode "RED";
_group setCombatMode "YELLOW";
```

**Source:** https://community.bistudio.com/wiki/setCombatMode

---

### setSpeedMode
**Official Syntax:**
```sqf
group setSpeedMode mode
```

**Parameters:**
- `mode`: String - "LIMITED", "NORMAL", "FULL"

**Returns:** Nothing

**Example:**
```sqf
_group setSpeedMode "FULL";
```

---

### setFormation
**Official Syntax:**
```sqf
group setFormation formation
```

**Parameters:**
- `formation`: String - "COLUMN", "STAG COLUMN", "WEDGE", "ECH LEFT", "ECH RIGHT", "VEE", "LINE", "FILE", "DIAMOND"

**Returns:** Nothing

**Example:**
```sqf
_group setFormation "WEDGE";
```

---

## Positioning Functions

### BIS_fnc_relPos
**Official Syntax:**
```sqf
[origin, distance, direction] call BIS_fnc_relPos
```

**Parameters:**
- `origin`: Object/Position - starting point
- `distance`: Number - distance in meters
- `direction`: Number - compass direction in degrees (0=North, 90=East, 180=South, 270=West)

**Returns:** Position array

**Example:**
```sqf
private _playerPos = getPosATL player;
private _spawnPos = [_playerPos, 300, 90] call BIS_fnc_relPos; // 300m East
private _flankPos = [_playerPos, 250, 270] call BIS_fnc_relPos; // 250m West
```

**Source:** https://community.bistudio.com/wiki/BIS_fnc_relPos

---

### BIS_fnc_findSafePos
**Official Syntax:**
```sqf
[center, minDist, maxDist, objDist, waterMode, maxGrad, shoreMode, blacklistPos, defaultPos] call BIS_fnc_findSafePos
```

**Parameters:**
1. `center`: Position/Object (optional) - search center
2. `minDist`: Number (optional, default 0) - minimum distance from center
3. `maxDist`: Number (optional, default -1) - maximum distance (-1 = use world radius)
4. `objDist`: Number (optional, default 0) - minimum distance to nearest terrain object (0-10 recommended)
5. `waterMode`: Number (optional, default 0)
   - 0: not in water
   - 1: can be anywhere
   - 2: must be in water
6. `maxGrad`: Number (optional, default 0) - maximum terrain slope (0.1-0.3 for flat)
7. `shoreMode`: Number (optional, default 0)
   - 0: anywhere
   - 1: must be at shore
8. `blacklistPos`: Array (optional) - areas to exclude
9. `defaultPos`: Array (optional) - fallback position if none found

**Returns:** Position array

**Example:**
```sqf
// Find safe spawn 100-500m from player, flat terrain
private _safePos = [getPos player, 100, 500, 5, 0, 0.2, 0] call BIS_fnc_findSafePos;

// With exclusion zones
private _pos = [getPos player, 50, 200, 3, 0, 0.15, 0, [[1000,1000,100]], [[0,0,0]]] call BIS_fnc_findSafePos;
```

**Source:** https://community.bistudio.com/wiki/BIS_fnc_findSafePos

---

## Task Functions

### BIS_fnc_taskCreate
**Official Syntax:**
```sqf
[owner, taskID, description, destination, state, priority, showNotification, type, visibleIn3D] call BIS_fnc_taskCreate
```

**Parameters:**
1. `owner`: Boolean/Object/Group/Side/Array
   - true: all playable units
   - Object: specific unit
   - Group: all in group
   - Side: all of side
2. `taskID`: String or Array ["taskID", "parentTaskID"]
3. `description`: Array ["description", "title", "marker"] or String (CfgTaskDescriptions class)
4. `destination`: Object/Array (optional)
   - objNull: no position
   - [target, precision]: target object, show on map
5. `state`: String (optional, default "CREATED")
   - "CREATED", "ASSIGNED", "AUTOASSIGNED", "SUCCEEDED", "FAILED", "CANCELED"
6. `priority`: Number (optional, default 0) - task priority (-1 = no auto-assign)
7. `showNotification`: Boolean (optional, default true) - show task notification
8. `type`: String (optional) - task type/icon
9. `visibleIn3D`: Boolean (optional, default false) - always visible in 3D

**Returns:** String - task ID

**Example:**
```sqf
// Simple task
["task1", true, ["Clear the area", "Clear Area", ""], [1000, 2000, 0], "CREATED", 1, true, "attack"] call BIS_fnc_taskCreate;

// Subtask
["subTask", ["parentTask"], ["Complete subtask", "Subtask", ""], objNull, "ASSIGNED"] call BIS_fnc_taskCreate;
```

**Source:** https://community.bistudio.com/wiki/BIS_fnc_taskCreate

---

## Marker Functions

### createMarker
**Official Syntax:**
```sqf
createMarker [name, position]
```

**Parameters:**
- `name`: String - unique marker name
- `position`: Position array or Object

**Returns:** String - marker name

**Example:**
```sqf
private _marker = createMarker ["obj1", [1000, 2000, 0]];
_marker setMarkerType "mil_objective";
_marker setMarkerColor "ColorRed";
```

---

## Validation Checklist

When generating SQF code, ensure:

### ✓ Correct Parameter Order
- All parameters must be in exact order as documented
- Optional parameters can be omitted from the end

### ✓ Proper Data Types
- Positions as arrays: `[x, y, z]` or `[x, y]`
- Sides in UPPERCASE: `EAST`, `WEST`, `INDEPENDENT`, `CIVILIAN`
- Strings in quotes: `"O_Soldier_F"`, `"AWARE"`, `"RED"`
- Numbers without quotes: `300`, `0.8`, `150`

### ✓ Valid Enum Values
- Behaviour: CARELESS, SAFE, AWARE, COMBAT, STEALTH
- Combat Mode: BLUE, GREEN, WHITE, YELLOW, RED
- Speed Mode: LIMITED, NORMAL, FULL
- Special: NONE, FORM, CAN_COLLIDE, CARGO, FLY
- Task State: CREATED, ASSIGNED, SUCCEEDED, FAILED, CANCELED

### ✓ Minimum Safe Distances
- Infantry spawn: 200m+ from players
- Vehicle spawn: 300m+ from players
- Air spawn: 500m+ from players

### ✓ Valid Classnames
- Use official classnames from CfgVehicles
- Examples: "O_Soldier_F", "O_MRAP_02_hmg_F", "O_Heli_Attack_02_F"

---

## Common Patterns

### Infantry Squad Spawn
```sqf
private _spawnPos = [_playerPos, 300, 90] call BIS_fnc_relPos;
private _group = [_spawnPos, EAST, ["O_Soldier_TL_F", "O_Soldier_F", "O_Soldier_AR_F"]] call BIS_fnc_spawnGroup;
_group setBehaviour "AWARE";
_group setCombatMode "YELLOW";
[_group, _spawnPos, 200] call BIS_fnc_taskPatrol;
```

### Vehicle with Crew
```sqf
private _veh = createVehicle ["O_MRAP_02_hmg_F", [1000, 2000, 0], [], 0, "NONE"];
private _group = createGroup EAST;
private _driver = _group createUnit ["O_Soldier_F", [0, 0, 0], [], 0, "FORM"];
private _gunner = _group createUnit ["O_Soldier_F", [0, 0, 0], [], 0, "FORM"];
_driver moveInDriver _veh;
_gunner moveInGunner _veh;
[_group, getPos _veh, 500] call BIS_fnc_taskPatrol;
```

### Defensive Position
```sqf
private _group = [[1000, 2000, 0], EAST, ["O_Soldier_F", "O_Soldier_AR_F"]] call BIS_fnc_spawnGroup;
[_group, [1000, 2000, 0], 50] call BIS_fnc_taskDefend;
_group setBehaviour "COMBAT";
_group setCombatMode "YELLOW";
```

---

## References

All function definitions verified against:
- Bohemia Interactive Community Wiki (official)
- https://community.bistudio.com/wiki/
- Last verified: January 2026

**Critical:** Always use these exact syntaxes to ensure game compatibility.
