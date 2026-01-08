/**
 * Collect comprehensive game state
 * Returns: HashMap of game state data
 */

private _state = createHashMap;

// Timestamp
_state set ["timestamp", time * 1000]; // Convert to milliseconds

// Collect player data
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

// Collect friendly units (BLUFOR)
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
        
        _friendlyUnits pushBack _unitData;
    };
} forEach allUnits;
_state set ["friendlyUnits", _friendlyUnits];

// Collect enemy units (OPFOR - only if spotted/known)
private _enemyUnits = [];
{
    if (side _x == EAST && alive _x) then {
        // Check if any player knows about this unit
        private _known = false;
        {
            if (_x knowsAbout _x > 1) then {
                _known = true;
            };
        } forEach allPlayers;
        
        if (_known) then {
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
            _unitData set ["side", "OPFOR"];
            
            _enemyUnits pushBack _unitData;
        };
    };
} forEach allUnits;
_state set ["enemyUnits", _enemyUnits];

// Collect objectives (simplified tasks)
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
_state set ["environment", _environment];

// Mission context
private _missionContext = createHashMap;
_missionContext set ["missionName", missionName];
_missionContext set ["briefing", briefingName];
_missionContext set ["elapsedTime", time];
_state set ["missionContext", _missionContext];

_state
