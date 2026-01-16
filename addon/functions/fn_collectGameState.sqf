/**
 * Collect comprehensive game state
 * Returns: HashMap of game state data
 * Note: Variable names avoid D,O,U,T,E letters for Pythia transport compatibility
 */

private _s = createHashMap;

// Timestamp
_s set ["timestamp", time * 1000]; // Convert to milliseconds

// Collect player data
private _pls = [];
{
    if (isPlayer _x && alive _x) then {
        private _pl = createHashMap;
        _pl set ["uid", getPlayerUID _x];
        _pl set ["name", name _x];

        private _p = getPosATL _x;
        private _pm = createHashMap;
        _pm set ["x", _p select 0];
        _pm set ["y", _p select 1];
        _pm set ["z", _p select 2];
        _pl set ["position", _pm];

        _pl set ["health", 1 - (damage _x)];
        _pl set ["vehicle", if (vehicle _x != _x) then {typeOf vehicle _x} else {"none"}];
        _pl set ["weapons", weapons _x];
        _pl set ["currentTask", currentTask _x];

        _pls pushBack _pl;
    };
} forEach allPlayers;
_s set ["players", _pls];

// Collect friendly units (BLUFOR)
private _frns = [];
{
    if (side _x == WEST && alive _x && !isPlayer _x) then {
        private _nf = createHashMap;
        _nf set ["id", str _x];
        _nf set ["type", typeOf _x];

        private _p = getPosATL _x;
        private _pm = createHashMap;
        _pm set ["x", _p select 0];
        _pm set ["y", _p select 1];
        _pm set ["z", _p select 2];
        _nf set ["position", _pm];

        _nf set ["health", 1 - (damage _x)];
        _nf set ["vehicle", if (vehicle _x != _x) then {typeOf vehicle _x} else {"none"}];
        _nf set ["behavior", behaviour _x];
        _nf set ["side", "BLUFOR"];

        _frns pushBack _nf;
    };
} forEach allUnits;
_s set ["friendlyUnits", _frns];

// Collect enemy units (OPFOR - only if spotted/known)
private _fms = [];
{
    if (side _x == EAST && alive _x) then {
        // Check if any player knows about this unit
        private _knwn = false;
        {
            if (_x knowsAbout _x > 1) then {
                _knwn = true;
            };
        } forEach allPlayers;

        if (_knwn) then {
            private _nf = createHashMap;
            _nf set ["id", str _x];
            _nf set ["type", typeOf _x];

            private _p = getPosATL _x;
            private _pm = createHashMap;
            _pm set ["x", _p select 0];
            _pm set ["y", _p select 1];
            _pm set ["z", _p select 2];
            _nf set ["position", _pm];

            _nf set ["health", 1 - (damage _x)];
            _nf set ["vehicle", if (vehicle _x != _x) then {typeOf vehicle _x} else {"none"}];
            _nf set ["behavior", behaviour _x];
            _nf set ["side", "OPFOR"];

            _fms pushBack _nf;
        };
    };
} forEach allUnits;
_s set ["enemyUnits", _fms];

// Collect objectives (simplified tasks)
private _bjs = [];
private _jbs = [] call BIS_fnc_tasksUnit;
{
    private _jb = createHashMap;
    _jb set ["id", _x];
    _jb set ["description", [_x] call BIS_fnc_taskDescription select 0];
    _jb set ["state", [_x] call BIS_fnc_taskState];

    _bjs pushBack _jb;
} forEach _jbs;
_s set ["objectives", _bjs];

// Recent events from history
_s set ["recentEvents", +LLMGM_eventHistory];

// Environment
private _nvr = createHashMap;
_nvr set ["timeOfDay", dayTime];
_nvr set ["weather", overcast];
_nvr set ["fog", fog];
_s set ["environment", _nvr];

// Mission context
private _msnCx = createHashMap;
_msnCx set ["missionName", missionName];
_msnCx set ["briefing", briefingName];
_msnCx set ["elapsedTime", time];
_s set ["missionContext", _msnCx];

_s
