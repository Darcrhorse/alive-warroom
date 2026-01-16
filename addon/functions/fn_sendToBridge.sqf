/**
 * Send game state to bridge server via INIDBI2 file
 * Params:
 *   0: HashMap - Game state data
 *
 * This function writes game state to an INI file (llmgm_gamestate.ini) that
 * the bridge server can read. Uses OO_INIDBI (INIDBI2 extension) for file-based
 * communication since the custom llmgm extension DLL is not compiled.
 *
 * State is organized into sections:
 *   [state] - Current game state key-value pairs
 *   [metadata] - Timestamp, update counter, server info
 *   [units] - Unit count summaries by side
 *
 * NOTE: For simple command execution workflows, state sending may be optional.
 * The bridge can function in one-way mode (commands -> game) without game state.
 */

params ["_state"];

diag_log "[LLMGM][DIAG] fn_sendToBridge: Function called";

if (!LLMGM_enabled) exitWith {
    diag_log "[LLMGM][DIAG] fn_sendToBridge: Exiting early - LLMGM_enabled is false";
};

// Check if state is valid
if (isNil "_state" || {!(_state isEqualType createHashMap)}) exitWith {
    diag_log "[LLMGM][WARN] fn_sendToBridge: Invalid state parameter (nil or not hashmap)";
};

diag_log format ["[LLMGM][DIAG] fn_sendToBridge: State has %1 keys", count keys _state];

// Check if OO_INIDBI is available
if (isNil "OO_INIDBI") exitWith {
    diag_log "[LLMGM][WARN] fn_sendToBridge: OO_INIDBI is nil - INIDBI2 extension not loaded";
    diag_log "[LLMGM][WARN] fn_sendToBridge: State sending skipped - operating in one-way mode";
};

// Open the gamestate database (uses userconfig/llmgm_gamestate.ini)
private _dbName = "llmgm_gamestate";
diag_log format ["[LLMGM][DIAG] fn_sendToBridge: Opening database '%1'...", _dbName];

private _db = ["new", _dbName] call OO_INIDBI;

if (isNil "_db") exitWith {
    diag_log "[LLMGM][WARN] fn_sendToBridge: Failed to open INIDBI database - _db is nil";
};

diag_log format ["[LLMGM][DIAG] fn_sendToBridge: Database handle: %1", _db];

// Write metadata section
private _timestamp = systemTimeUTC;
private _timestampStr = format ["%1-%2-%3T%4:%5:%6Z",
    _timestamp select 0,
    _timestamp select 1,
    _timestamp select 2,
    _timestamp select 3,
    _timestamp select 4,
    _timestamp select 5];

["write", ["metadata", "timestamp", _timestampStr]] call _db;
["write", ["metadata", "gameTime", str time]] call _db;
["write", ["metadata", "serverName", serverName]] call _db;
["write", ["metadata", "missionName", missionName]] call _db;
["write", ["metadata", "updateCount", str (missionNamespace getVariable ["LLMGM_updateCount", 0])]] call _db;

diag_log format ["[LLMGM][DIAG] fn_sendToBridge: Metadata written - timestamp: %1, gameTime: %2", _timestampStr, time];

// Write state section - iterate through hashmap keys
private _keysWritten = 0;
{
    private _key = _x;
    private _value = _state get _key;

    // Convert value to string representation
    private _valueStr = if (_value isEqualType "") then {
        _value
    } else {
        str _value
    };

    // Write to state section
    ["write", ["state", _key, _valueStr]] call _db;
    _keysWritten = _keysWritten + 1;
} forEach (keys _state);

diag_log format ["[LLMGM][DIAG] fn_sendToBridge: Wrote %1 state keys", _keysWritten];

// Write unit summary section (useful for bridge to understand game situation)
private _bluforCount = {side _x == west} count allUnits;
private _opforCount = {side _x == east} count allUnits;
private _indepCount = {side _x == independent} count allUnits;
private _civCount = {side _x == civilian} count allUnits;

["write", ["units", "blufor", str _bluforCount]] call _db;
["write", ["units", "opfor", str _opforCount]] call _db;
["write", ["units", "independent", str _indepCount]] call _db;
["write", ["units", "civilian", str _civCount]] call _db;
["write", ["units", "total", str count allUnits]] call _db;

diag_log format ["[LLMGM][DIAG] fn_sendToBridge: Unit counts - BLUFOR: %1, OPFOR: %2, INDEP: %3, CIV: %4",
    _bluforCount, _opforCount, _indepCount, _civCount];

// Update the last update timestamp
LLMGM_lastUpdate = time;
missionNamespace setVariable ["LLMGM_updateCount", (missionNamespace getVariable ["LLMGM_updateCount", 0]) + 1];

diag_log "[LLMGM] Game state sent successfully via INIDBI2";
diag_log "[LLMGM][DIAG] fn_sendToBridge: Function complete";
