/**
 * Collect comprehensive game state with ENHANCED INTELLIGENCE
 * Returns: HashMap of game state data
 *
 * NEW: Target intelligence, vehicle status, suppression/morale, waypoint progress
 */

private _state = createHashMap;

// Timestamp
_state set ["timestamp", time * 1000]; // Convert to milliseconds

// ========== PLAYER DATA ==========
private _players = [];
{
    if (isPlayer _x && alive _x) then {
        private _playerData = createHashMap;
        _playerData set ["uid", getPlayerUID _x];
        _playerData set ["name", name _x];

        private _pos = getPosATL _x;
        private _posMap = createHashMap;
        _posMap set ["x", _pos select 0];
        _posMap set ["y", _pos select 1];
        _posMap set ["z", _pos select 2];
        _playerData set ["position", _posMap];

        _playerData set ["health", 1 - (damage _x)];
        _playerData set ["vehicle", if (vehicle _x != _x) then {typeOf vehicle _x} else {null}];
        _playerData set ["weapons", weapons _x];
        _playerData set ["currentTask", currentTask _x];

        _players pushBack _playerData;
    };
} forEach allPlayers;
_state set ["players", _players];

// ========== FRIENDLY UNITS (BLUFOR) ==========
private _friendlyUnits = [];
{
    if (side _x == WEST && alive _x && !isPlayer _x) then {
        private _unitData = createHashMap;
        _unitData set ["id", str _x];
        _unitData set ["type", typeOf _x];

        private _pos = getPosATL _x;
        private _posMap = createHashMap;
        _posMap set ["x", _pos select 0];
        _posMap set ["y", _pos select 1];
        _posMap set ["z", _pos select 2];
        _unitData set ["position", _posMap];

        _unitData set ["health", 1 - (damage _x)];
        _unitData set ["vehicle", if (vehicle _x != _x) then {typeOf vehicle _x} else {null}];
        _unitData set ["behavior", behaviour _x];
        _unitData set ["side", "BLUFOR"];

        // Suppression and morale
        _unitData set ["suppression", getSuppression _x];
        _unitData set ["morale", morale _x];

        // Combat info - what is the unit doing
        _unitData set ["currentCommand", currentCommand _x];
        private _target = assignedTarget _x;
        _unitData set ["assignedTarget", if (!isNull _target) then {typeOf _target} else {""}];
        _unitData set ["hasTarget", !isNull _target];

        // Ammo status - calculate from magazinesAmmoFull
        private _mags = magazinesAmmoFull _x;
        private _totalAmmo = 0;
        private _maxAmmo = 0;
        {
            _x params ["_mag", "_ammoCount", "_loaded", "_type", "_location"];
            _totalAmmo = _totalAmmo + _ammoCount;
            _maxAmmo = _maxAmmo + (getNumber (configFile >> "CfgMagazines" >> _mag >> "count"));
        } forEach _mags;
        private _ammoPercent = if (_maxAmmo > 0) then {_totalAmmo / _maxAmmo} else {1};
        _unitData set ["ammoStatus", switch (true) do {
            case (_ammoPercent < 0.25): {"CRITICAL"};
            case (_ammoPercent < 0.5): {"LOW"};
            case (_ammoPercent < 0.75): {"MEDIUM"};
            default {"FULL"};
        }];
        _unitData set ["ammoPercent", _ammoPercent];

        _friendlyUnits pushBack _unitData;
    };
} forEach allUnits;
_state set ["friendlyUnits", _friendlyUnits];

// ========== ENEMY UNITS (OPFOR - fog of war) ==========
private _enemyUnits = [];
{
    if (side _x == EAST && alive _x) then {
        private _enemy = _x;
        private _known = false;
        {
            if (_x knowsAbout _enemy > 1) then {
                _known = true;
            };
        } forEach allPlayers;

        if (_known) then {
            private _unitData = createHashMap;
            _unitData set ["id", str _enemy];
            _unitData set ["type", typeOf _enemy];

            private _pos = getPosATL _enemy;
            private _posMap = createHashMap;
            _posMap set ["x", _pos select 0];
            _posMap set ["y", _pos select 1];
            _posMap set ["z", _pos select 2];
            _unitData set ["position", _posMap];

            _unitData set ["health", 1 - (damage _enemy)];
            _unitData set ["vehicle", if (vehicle _enemy != _enemy) then {typeOf vehicle _enemy} else {null}];
            _unitData set ["behavior", behaviour _enemy];
            _unitData set ["side", "OPFOR"];

            _enemyUnits pushBack _unitData;
        };
    };
} forEach allUnits;
_state set ["enemyUnits", _enemyUnits];

// ========== TARGET INTELLIGENCE ==========
// What each side KNOWS about enemy positions (from their perspective)
private _targetIntel = createHashMap;

// EAST's intelligence about WEST targets
private _eastIntel = [];
{
    private _grp = _x;
    private _ldr = leader _grp;
    if (alive _ldr) then {
        // Get targets this group knows about (using targetsQuery for detailed info)
        private _knownTargets = _ldr targetsQuery [objNull, WEST, "", [], 120]; // Targets < 2 min old
        {
            _x params ["_accuracy", "_target", "_targetSide", "_targetType", "_targetPos", "_targetAge"];
            if (!isNull _target && alive _target) then {
                private _intelData = createHashMap;
                _intelData set ["accuracy", _accuracy];
                _intelData set ["type", _targetType];
                _intelData set ["age", _targetAge];
                _intelData set ["position", createHashMapFromArray [["x", _targetPos select 0], ["y", _targetPos select 1]]];
                _intelData set ["isVehicle", _target isKindOf "LandVehicle" || _target isKindOf "Air"];
                _intelData set ["reportedBy", groupId _grp];
                _eastIntel pushBack _intelData;
            };
        } forEach _knownTargets;
    };
} forEach (allGroups select {side _x == EAST});
_targetIntel set ["EAST_knows_about_WEST", _eastIntel];

// WEST's intelligence about EAST targets
private _westIntel = [];
{
    private _grp = _x;
    private _ldr = leader _grp;
    if (alive _ldr && !({isPlayer _x} count units _grp > 0)) then {
        private _knownTargets = _ldr targetsQuery [objNull, EAST, "", [], 120];
        {
            _x params ["_accuracy", "_target", "_targetSide", "_targetType", "_targetPos", "_targetAge"];
            if (!isNull _target && alive _target) then {
                private _intelData = createHashMap;
                _intelData set ["accuracy", _accuracy];
                _intelData set ["type", _targetType];
                _intelData set ["age", _targetAge];
                _intelData set ["position", createHashMapFromArray [["x", _targetPos select 0], ["y", _targetPos select 1]]];
                _intelData set ["isVehicle", _target isKindOf "LandVehicle" || _target isKindOf "Air"];
                _intelData set ["reportedBy", groupId _grp];
                _westIntel pushBack _intelData;
            };
        } forEach _knownTargets;
    };
} forEach (allGroups select {side _x == WEST});
_targetIntel set ["WEST_knows_about_EAST", _westIntel];

_state set ["targetIntelligence", _targetIntel];

// ========== VEHICLE STATUS ==========
private _vehicleStatus = createHashMap;

// EAST vehicles
private _eastVehicles = [];
{
    private _veh = _x;
    if (alive _veh && !isNull _veh && (_veh isKindOf "LandVehicle" || _veh isKindOf "Air" || _veh isKindOf "Ship")) then {
        private _vehData = createHashMap;
        _vehData set ["type", typeOf _veh];
        _vehData set ["displayName", getText (configFile >> "CfgVehicles" >> typeOf _veh >> "displayName")];

        private _pos = getPosATL _veh;
        _vehData set ["position", createHashMapFromArray [["x", _pos select 0], ["y", _pos select 1], ["z", _pos select 2]]];

        // Fuel and ammo status
        _vehData set ["fuel", fuel _veh];
        _vehData set ["damage", damage _veh];
        _vehData set ["canMove", canMove _veh];
        _vehData set ["canFire", canFire _veh];
        _vehData set ["isEngineOn", isEngineOn _veh];
        _vehData set ["direction", getDir _veh];

        // Hitpoint damage - specific component damage (engine, tracks, turret, etc.)
        private _hitpointDamage = getAllHitPointsDamage _veh;
        if (count _hitpointDamage > 0) then {
            _hitpointDamage params ["_hitpoints", "_selections", "_damages"];
            private _criticalDamage = createHashMap;
            {
                private _hp = _hitpoints select _forEachIndex;
                private _dmg = _damages select _forEachIndex;
                // Only report damaged components (> 0.1 damage)
                if (_dmg > 0.1) then {
                    _criticalDamage set [_hp, _dmg];
                };
            } forEach _selections;
            _vehData set ["hitpointDamage", _criticalDamage];
        };

        // Crew info
        _vehData set ["crewCount", count crew _veh];
        _vehData set ["emptyPositions", _veh emptyPositions "cargo"];

        // For aircraft
        if (_veh isKindOf "Air") then {
            _vehData set ["altitude", (getPosASL _veh) select 2];
            _vehData set ["speed", speed _veh];
            _vehData set ["isFlying", !isTouchingGround _veh];
        };

        // Check if it's a logistics vehicle
        private _ammoCargo = getAmmoCargo _veh;
        private _fuelCargo = getFuelCargo _veh;
        private _repairCargo = getRepairCargo _veh;
        if (_ammoCargo > 0 || _fuelCargo > 0 || _repairCargo > 0) then {
            _vehData set ["isLogistics", true];
            _vehData set ["ammoCargo", _ammoCargo];
            _vehData set ["fuelCargo", _fuelCargo];
            _vehData set ["repairCargo", _repairCargo];
        };

        // Vehicle-in-vehicle cargo (Blackfish carrying MRAPs, etc.)
        private _vehicleCargo = getVehicleCargo _veh;
        if (count _vehicleCargo > 0) then {
            _vehData set ["vehicleCargo", _vehicleCargo apply {typeOf _x}];
        };

        _eastVehicles pushBack _vehData;
    };
} forEach (vehicles select {side _x == EAST || (side driver _x == EAST)});
_vehicleStatus set ["EAST", _eastVehicles];

// WEST vehicles
private _westVehicles = [];
{
    private _veh = _x;
    if (alive _veh && !isNull _veh && (_veh isKindOf "LandVehicle" || _veh isKindOf "Air" || _veh isKindOf "Ship")) then {
        private _vehData = createHashMap;
        _vehData set ["type", typeOf _veh];
        _vehData set ["displayName", getText (configFile >> "CfgVehicles" >> typeOf _veh >> "displayName")];

        private _pos = getPosATL _veh;
        _vehData set ["position", createHashMapFromArray [["x", _pos select 0], ["y", _pos select 1], ["z", _pos select 2]]];

        _vehData set ["fuel", fuel _veh];
        _vehData set ["damage", damage _veh];
        _vehData set ["canMove", canMove _veh];
        _vehData set ["canFire", canFire _veh];
        _vehData set ["isEngineOn", isEngineOn _veh];
        _vehData set ["direction", getDir _veh];

        // Hitpoint damage - specific component damage
        private _hitpointDamage = getAllHitPointsDamage _veh;
        if (count _hitpointDamage > 0) then {
            _hitpointDamage params ["_hitpoints", "_selections", "_damages"];
            private _criticalDamage = createHashMap;
            {
                private _hp = _hitpoints select _forEachIndex;
                private _dmg = _damages select _forEachIndex;
                if (_dmg > 0.1) then {
                    _criticalDamage set [_hp, _dmg];
                };
            } forEach _selections;
            _vehData set ["hitpointDamage", _criticalDamage];
        };

        _vehData set ["crewCount", count crew _veh];
        _vehData set ["emptyPositions", _veh emptyPositions "cargo"];

        if (_veh isKindOf "Air") then {
            _vehData set ["altitude", (getPosASL _veh) select 2];
            _vehData set ["speed", speed _veh];
            _vehData set ["isFlying", !isTouchingGround _veh];
        };

        // Check if it's a logistics vehicle
        private _ammoCargo = getAmmoCargo _veh;
        private _fuelCargo = getFuelCargo _veh;
        private _repairCargo = getRepairCargo _veh;
        if (_ammoCargo > 0 || _fuelCargo > 0 || _repairCargo > 0) then {
            _vehData set ["isLogistics", true];
            _vehData set ["ammoCargo", _ammoCargo];
            _vehData set ["fuelCargo", _fuelCargo];
            _vehData set ["repairCargo", _repairCargo];
        };

        // Vehicle-in-vehicle cargo (Blackfish carrying MRAPs, etc.)
        private _vehicleCargo = getVehicleCargo _veh;
        if (count _vehicleCargo > 0) then {
            _vehData set ["vehicleCargo", _vehicleCargo apply {typeOf _x}];
        };

        _westVehicles pushBack _vehData;
    };
} forEach (vehicles select {side _x == WEST || (side driver _x == WEST)});
_vehicleStatus set ["WEST", _westVehicles];

_state set ["vehicleStatus", _vehicleStatus];

// ========== OBJECTIVES ==========
private _objectives = [];
private _tasks = [] call BIS_fnc_tasksUnit;
{
    private _taskData = createHashMap;
    _taskData set ["id", _x];
    _taskData set ["description", [_x] call BIS_fnc_taskDescription select 0];
    _taskData set ["state", [_x] call BIS_fnc_taskState];

    _objectives pushBack _taskData;
} forEach _tasks;
_state set ["objectives", _objectives];

// Recent events from history
_state set ["recentEvents", +LLMGM_eventHistory];

// Environment
private _environment = createHashMap;
_environment set ["timeOfDay", dayTime];
_environment set ["weather", overcast];
_environment set ["fog", fog];
_environment set ["rain", rain];
_environment set ["wind", wind];
_state set ["environment", _environment];

// Mission context
private _missionContext = createHashMap;
_missionContext set ["missionName", missionName];
_missionContext set ["worldName", worldName];
_missionContext set ["briefing", briefingName];
_missionContext set ["elapsedTime", time];
_state set ["missionContext", _missionContext];

// ========== BATTLE OBJECTIVE ==========
private _battleObjective = createHashMap;

private _objPos = if (!isNil "LLMGM_objectivePos") then {LLMGM_objectivePos} else {[0,0,0]};
private _objPosMap = createHashMap;
_objPosMap set ["x", _objPos select 0];
_objPosMap set ["y", _objPos select 1];
_objPosMap set ["z", _objPos select 2];
_battleObjective set ["position", _objPosMap];

_battleObjective set ["name", if (!isNil "LLMGM_objectiveName") then {LLMGM_objectiveName} else {"Unknown Objective"}];

private _eastFobPos = if (!isNil "LLMGM_eastFobPos") then {LLMGM_eastFobPos} else {[0,0,0]};
private _westFobPos = if (!isNil "LLMGM_westFobPos") then {LLMGM_westFobPos} else {[0,0,0]};
_battleObjective set ["distanceFromEastFob", round (_objPos distance2D _eastFobPos)];
_battleObjective set ["distanceFromWestFob", round (_objPos distance2D _westFobPos)];

private _eastUnitsNear = count (allUnits select {side _x == EAST && alive _x && (_x distance2D _objPos) < 200});
private _westUnitsNear = count (allUnits select {side _x == WEST && alive _x && (_x distance2D _objPos) < 200});
_battleObjective set ["eastUnitsNearby", _eastUnitsNear];
_battleObjective set ["westUnitsNearby", _westUnitsNear];
_battleObjective set ["controlStatus",
    if (_eastUnitsNear > 0 && _westUnitsNear > 0) then {"CONTESTED"}
    else {if (_eastUnitsNear > _westUnitsNear) then {"EAST"} else {if (_westUnitsNear > 0) then {"WEST"} else {"NEUTRAL"}}}
];

_state set ["battleObjective", _battleObjective];

// ========== ENHANCED GROUP TRACKING ==========
private _groupStatus = createHashMap;

// EAST (OPFOR) groups with ENHANCED data
private _eastGroups = [];
{
    private _grp = _x;
    private _ldr = leader _grp;
    private _aliveUnits = {alive _x} count units _grp;
    private _totalUnits = count units _grp;

    if (_totalUnits > 0) then {
        private _grpData = createHashMap;
        _grpData set ["groupId", groupId _grp];
        _grpData set ["alive", _aliveUnits];
        _grpData set ["total", _totalUnits];

        private _ldrPos = if (alive _ldr) then {getPosATL _ldr} else {[0,0,0]};
        private _posMap = createHashMap;
        _posMap set ["x", _ldrPos select 0];
        _posMap set ["y", _ldrPos select 1];
        _posMap set ["z", _ldrPos select 2];
        _grpData set ["position", _posMap];

        _grpData set ["behavior", if (alive _ldr) then {behaviour _ldr} else {"DEAD"}];
        _grpData set ["combatMode", combatMode _grp];
        _grpData set ["speedMode", speedMode _grp];
        _grpData set ["formation", formation _grp];

        // Waypoint info with distance
        private _wpIndex = currentWaypoint _grp;
        private _wpCount = count waypoints _grp;
        private _wpType = if (_wpIndex < _wpCount) then {waypointType [_grp, _wpIndex]} else {"NONE"};
        private _wpPos = if (_wpIndex < _wpCount) then {waypointPosition [_grp, _wpIndex]} else {[0,0,0]};
        private _distToWp = if (_wpIndex < _wpCount && alive _ldr) then {round (_ldrPos distance2D _wpPos)} else {-1};

        _grpData set ["waypointIndex", _wpIndex];
        _grpData set ["waypointCount", _wpCount];
        _grpData set ["waypointType", _wpType];
        _grpData set ["distanceToWaypoint", _distToWp];

        // Combat status
        private _knownTargets = if (alive _ldr) then {count (_ldr targets [true, 500])} else {0};
        _grpData set ["inCombat", _knownTargets > 0];
        _grpData set ["nearbyEnemies", _knownTargets];

        // Average suppression of group
        private _avgSuppression = 0;
        {
            _avgSuppression = _avgSuppression + (getSuppression _x);
        } forEach (units _grp select {alive _x});
        _grpData set ["avgSuppression", if (_aliveUnits > 0) then {_avgSuppression / _aliveUnits} else {0}];

        // Vehicle info
        private _vehicles = [];
        {
            if (vehicle _x != _x) then {
                private _veh = vehicle _x;
                if !((typeOf _veh) in _vehicles) then {
                    _vehicles pushBack (typeOf _veh);
                };
            };
        } forEach units _grp;
        _grpData set ["vehicles", _vehicles];
        _grpData set ["isMounted", count _vehicles > 0];

        _eastGroups pushBack _grpData;
    };
} forEach (allGroups select {side _x == EAST});
_groupStatus set ["EAST", _eastGroups];

// WEST (BLUFOR) groups with ENHANCED data
private _westGroups = [];
{
    private _grp = _x;
    private _ldr = leader _grp;
    private _aliveUnits = {alive _x} count units _grp;
    private _totalUnits = count units _grp;

    if (_totalUnits > 0 && !({isPlayer _x} count units _grp > 0)) then {
        private _grpData = createHashMap;
        _grpData set ["groupId", groupId _grp];
        _grpData set ["alive", _aliveUnits];
        _grpData set ["total", _totalUnits];

        private _ldrPos = if (alive _ldr) then {getPosATL _ldr} else {[0,0,0]};
        private _posMap = createHashMap;
        _posMap set ["x", _ldrPos select 0];
        _posMap set ["y", _ldrPos select 1];
        _posMap set ["z", _ldrPos select 2];
        _grpData set ["position", _posMap];

        _grpData set ["behavior", if (alive _ldr) then {behaviour _ldr} else {"DEAD"}];
        _grpData set ["combatMode", combatMode _grp];
        _grpData set ["speedMode", speedMode _grp];
        _grpData set ["formation", formation _grp];

        private _wpIndex = currentWaypoint _grp;
        private _wpCount = count waypoints _grp;
        private _wpType = if (_wpIndex < _wpCount) then {waypointType [_grp, _wpIndex]} else {"NONE"};
        private _wpPos = if (_wpIndex < _wpCount) then {waypointPosition [_grp, _wpIndex]} else {[0,0,0]};
        private _distToWp = if (_wpIndex < _wpCount && alive _ldr) then {round (_ldrPos distance2D _wpPos)} else {-1};

        _grpData set ["waypointIndex", _wpIndex];
        _grpData set ["waypointCount", _wpCount];
        _grpData set ["waypointType", _wpType];
        _grpData set ["distanceToWaypoint", _distToWp];

        private _knownTargets = if (alive _ldr) then {count (_ldr targets [true, 500])} else {0};
        _grpData set ["inCombat", _knownTargets > 0];
        _grpData set ["nearbyEnemies", _knownTargets];

        private _avgSuppression = 0;
        {
            _avgSuppression = _avgSuppression + (getSuppression _x);
        } forEach (units _grp select {alive _x});
        _grpData set ["avgSuppression", if (_aliveUnits > 0) then {_avgSuppression / _aliveUnits} else {0}];

        private _vehicles = [];
        {
            if (vehicle _x != _x) then {
                private _veh = vehicle _x;
                if !((typeOf _veh) in _vehicles) then {
                    _vehicles pushBack (typeOf _veh);
                };
            };
        } forEach units _grp;
        _grpData set ["vehicles", _vehicles];
        _grpData set ["isMounted", count _vehicles > 0];

        _westGroups pushBack _grpData;
    };
} forEach (allGroups select {side _x == WEST});
_groupStatus set ["WEST", _westGroups];

// Unit counts by side
private _unitCounts = createHashMap;
_unitCounts set ["BLUFOR", count (allUnits select {side _x == WEST && alive _x})];
_unitCounts set ["OPFOR", count (allUnits select {side _x == EAST && alive _x})];
_unitCounts set ["INDEPENDENT", count (allUnits select {side _x == INDEPENDENT && alive _x})];
_unitCounts set ["CIVILIAN", count (allUnits select {side _x == CIVILIAN && alive _x})];

_state set ["groupStatus", _groupStatus];
_state set ["unitCounts", _unitCounts];

// ========== COMBAT SUMMARY ==========
// Quick overview for commanders
private _combatSummary = createHashMap;

// EAST summary
private _eastEngaged = {(_x getVariable ["LLMGM_inCombat", false]) || (behaviour leader _x == "COMBAT")} count (allGroups select {side _x == EAST});
private _eastSuppressed = {(getSuppression leader _x) > 0.5} count (allGroups select {side _x == EAST && alive leader _x});
_combatSummary set ["eastGroupsEngaged", _eastEngaged];
_combatSummary set ["eastGroupsSuppressed", _eastSuppressed];
_combatSummary set ["eastTotalGroups", count (allGroups select {side _x == EAST})];

// WEST summary
private _westEngaged = {(_x getVariable ["LLMGM_inCombat", false]) || (behaviour leader _x == "COMBAT")} count (allGroups select {side _x == WEST});
private _westSuppressed = {(getSuppression leader _x) > 0.5} count (allGroups select {side _x == WEST && alive leader _x});
_combatSummary set ["westGroupsEngaged", _westEngaged];
_combatSummary set ["westGroupsSuppressed", _westSuppressed];
_combatSummary set ["westTotalGroups", count (allGroups select {side _x == WEST})];

_state set ["combatSummary", _combatSummary];

// ========== CASUALTY TRACKING ==========
// Using allDeadMen - note: dead units become CIVILIAN side, must check configFile for original side
private _casualtyTracking = createHashMap;
private _eastDeaths = 0;
private _westDeaths = 0;
private _guerDeaths = 0;
private _civDeaths = 0;
private _recentDeaths = [];

{
    private _deadUnit = _x;
    private _configSide = getNumber (configFile >> "CfgVehicles" >> typeOf _deadUnit >> "side");
    // Config side values: 0=EAST, 1=WEST, 2=GUER, 3=CIV

    switch (_configSide) do {
        case 0: { _eastDeaths = _eastDeaths + 1; };
        case 1: { _westDeaths = _westDeaths + 1; };
        case 2: { _guerDeaths = _guerDeaths + 1; };
        case 3: { _civDeaths = _civDeaths + 1; };
    };

    // Track recent deaths (last 10) for context
    if (count _recentDeaths < 10) then {
        private _deathRecord = createHashMap;
        _deathRecord set ["type", typeOf _deadUnit];
        private _pos = getPosATL _deadUnit;
        _deathRecord set ["position", createHashMapFromArray [["x", _pos select 0], ["y", _pos select 1], ["z", _pos select 2]]];
        _deathRecord set ["side", switch (_configSide) do {
            case 0: {"EAST"};
            case 1: {"WEST"};
            case 2: {"GUER"};
            default {"CIV"};
        }];
        _recentDeaths pushBack _deathRecord;
    };
} forEach allDeadMen;

_casualtyTracking set ["EAST", _eastDeaths];
_casualtyTracking set ["WEST", _westDeaths];
_casualtyTracking set ["GUER", _guerDeaths];
_casualtyTracking set ["CIV", _civDeaths];
_casualtyTracking set ["recentDeaths", _recentDeaths];

_state set ["casualtyTracking", _casualtyTracking];

// ========== TERRAIN AWARENESS ==========
// Give commanders understanding of the map terrain
private _terrainData = createHashMap;

// Map info
_terrainData set ["worldName", worldName];
_terrainData set ["worldSize", worldSize];

// Key locations near the battle area (towns, hills, military areas)
private _battleCenter = if (!isNil "LLMGM_objectivePos") then {LLMGM_objectivePos} else {
    // Fall back to center between FOBs
    private _eastFob = if (!isNil "LLMGM_eastFobPos") then {LLMGM_eastFobPos} else {[worldSize/2, worldSize/2, 0]};
    private _westFob = if (!isNil "LLMGM_westFobPos") then {LLMGM_westFobPos} else {[worldSize/2, worldSize/2, 0]};
    [(_eastFob select 0 + _westFob select 0) / 2, (_eastFob select 1 + _westFob select 1) / 2, 0]
};

// Named locations within 3km of battle area
private _nearbyLocations = [];
{
    private _locPos = locationPosition _x;
    if (_locPos distance2D _battleCenter < 3000) then {
        private _locData = createHashMap;
        _locData set ["name", text _x];
        _locData set ["type", type _x];
        _locData set ["position", createHashMapFromArray [["x", _locPos select 0], ["y", _locPos select 1]]];
        _locData set ["distance", round (_locPos distance2D _battleCenter)];
        _nearbyLocations pushBack _locData;
    };
} forEach nearestLocations [_battleCenter, ["NameCity", "NameCityCapital", "NameVillage", "NameLocal", "Hill", "NameMarine"], 3000];
_terrainData set ["nearbyLocations", _nearbyLocations];

// Roads near battle area (for convoy routing)
private _nearbyRoads = [];
private _roadSegments = _battleCenter nearRoads 1500;
{
    private _roadInfo = getRoadInfo _x;
    if (count _roadInfo > 0) then {
        private _roadPos = getPosATL _x;
        private _roadData = createHashMap;
        _roadData set ["position", createHashMapFromArray [["x", _roadPos select 0], ["y", _roadPos select 1]]];
        _roadData set ["type", _roadInfo select 0]; // ROAD, MAIN ROAD, TRACK, etc.
        _roadData set ["width", _roadInfo select 1];
        _nearbyRoads pushBack _roadData;
    };
} forEach (_roadSegments select [0, 20 min count _roadSegments]); // Limit to 20 road points
_terrainData set ["nearbyRoads", _nearbyRoads];

// Terrain analysis around key positions
private _terrainAnalysis = createHashMap;

// Analyze objective area
private _objElevation = getTerrainHeightASL _battleCenter;
private _objForest = count (nearestTerrainObjects [_battleCenter, ["TREE", "BUSH"], 100, false]);
private _objBuildings = count (nearestTerrainObjects [_battleCenter, ["BUILDING", "HOUSE"], 200, false]);
private _objRocks = count (nearestTerrainObjects [_battleCenter, ["ROCK", "ROCKS"], 150, false]);
_terrainAnalysis set ["objective", createHashMapFromArray [
    ["elevation", round _objElevation],
    ["forestDensity", if (_objForest > 50) then {"HEAVY"} else {if (_objForest > 20) then {"MODERATE"} else {"SPARSE"}}],
    ["urbanDensity", if (_objBuildings > 20) then {"URBAN"} else {if (_objBuildings > 5) then {"VILLAGE"} else {"RURAL"}}],
    ["coverAvailable", (_objForest + _objBuildings + _objRocks) > 30]
]];

// Find high ground nearby (potential overwatch positions)
private _highGroundPoints = [];
for "_i" from 0 to 7 do {
    private _angle = _i * 45;
    private _checkPos = _battleCenter getPos [800, _angle];
    private _elev = getTerrainHeightASL _checkPos;
    if (_elev > _objElevation + 20) then {
        _highGroundPoints pushBack createHashMapFromArray [
            ["direction", switch (true) do {
                case (_angle < 23): {"N"};
                case (_angle < 68): {"NE"};
                case (_angle < 113): {"E"};
                case (_angle < 158): {"SE"};
                case (_angle < 203): {"S"};
                case (_angle < 248): {"SW"};
                case (_angle < 293): {"W"};
                case (_angle < 338): {"NW"};
                default {"N"};
            }],
            ["elevation", round _elev],
            ["elevationAdvantage", round (_elev - _objElevation)],
            ["position", createHashMapFromArray [["x", _checkPos select 0], ["y", _checkPos select 1]]]
        ];
    };
};
_terrainAnalysis set ["highGround", _highGroundPoints];

// Tactical positions using selectBestPlaces
private _tacticalPositions = createHashMap;

// Best defensive positions (hills + cover)
private _defensePos = selectBestPlaces [_battleCenter, 600, "hills + 0.5*forest + 0.3*trees - houses", 25, 3];
private _defenseData = [];
{
    _defenseData pushBack createHashMapFromArray [
        ["position", createHashMapFromArray [["x", (_x select 0) select 0], ["y", (_x select 0) select 1]]],
        ["score", _x select 1]
    ];
} forEach _defensePos;
_tacticalPositions set ["defensivePositions", _defenseData];

// Best ambush positions (forest cover)
private _ambushPos = selectBestPlaces [_battleCenter, 500, "forest + trees - meadow - (2*houses)", 25, 3];
private _ambushData = [];
{
    _ambushData pushBack createHashMapFromArray [
        ["position", createHashMapFromArray [["x", (_x select 0) select 0], ["y", (_x select 0) select 1]]],
        ["score", _x select 1]
    ];
} forEach _ambushPos;
_tacticalPositions set ["ambushPositions", _ambushData];

// Best landing zones (flat, open, no obstacles)
private _lzPos = selectBestPlaces [_battleCenter, 800, "meadow - trees - forest - (3*houses) - (5*sea)", 30, 3];
private _lzData = [];
{
    _lzData pushBack createHashMapFromArray [
        ["position", createHashMapFromArray [["x", (_x select 0) select 0], ["y", (_x select 0) select 1]]],
        ["score", _x select 1]
    ];
} forEach _lzPos;
_tacticalPositions set ["landingZones", _lzData];

// Best overwatch (high ground with view)
private _overwatchPos = selectBestPlaces [_battleCenter, 700, "hills - forest - (2*houses)", 25, 3];
private _overwatchData = [];
{
    _overwatchData pushBack createHashMapFromArray [
        ["position", createHashMapFromArray [["x", (_x select 0) select 0], ["y", (_x select 0) select 1]]],
        ["score", _x select 1]
    ];
} forEach _overwatchPos;
_tacticalPositions set ["overwatchPositions", _overwatchData];

_terrainAnalysis set ["tacticalPositions", _tacticalPositions];

// Water/rivers check (movement obstacles)
private _waterNearby = false;
{
    private _surfaceType = surfaceType _x;
    if ("water" in (toLower _surfaceType)) exitWith {
        _waterNearby = true;
    };
} forEach [
    _battleCenter,
    _battleCenter getPos [500, 0],
    _battleCenter getPos [500, 90],
    _battleCenter getPos [500, 180],
    _battleCenter getPos [500, 270]
];
_terrainAnalysis set ["waterNearby", _waterNearby];

_terrainData set ["analysis", _terrainAnalysis];

_state set ["terrainData", _terrainData];

_state
