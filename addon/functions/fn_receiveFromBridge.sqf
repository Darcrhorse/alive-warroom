/**
 * Receive and process actions from bridge server via INIDBI2 file polling
 * Called periodically from the main update loop
 *
 * This function reads commands from an INI file written by the bridge server.
 * Uses OO_INIDBI (INIDBI2 extension) for file-based communication since
 * the custom llmgm extension DLL is not compiled.
 *
 * Diagnostic logging is included to trace command polling attempts and results.
 * Look for [LLMGM][DIAG] entries in RPT log for debugging.
 */

diag_log "[LLMGM][DIAG] fn_receiveFromBridge: Function called";

if (!LLMGM_enabled) exitWith {
    diag_log "[LLMGM][DIAG] fn_receiveFromBridge: Exiting early - LLMGM_enabled is false";
};

diag_log "[LLMGM][DIAG] fn_receiveFromBridge: LLMGM_enabled is true, proceeding with poll";

// Check if OO_INIDBI is available
if (isNil "OO_INIDBI") exitWith {
    diag_log "[LLMGM][WARN] fn_receiveFromBridge: OO_INIDBI is nil - INIDBI2 extension not loaded";
    diag_log "[LLMGM][WARN] fn_receiveFromBridge: Please ensure @INIDBI2 mod is loaded";
};

// Open the command database (uses userconfig/claude_warroom.ini)
private _dbName = "claude_warroom";
diag_log format ["[LLMGM][DIAG] fn_receiveFromBridge: Opening database '%1'...", _dbName];

private _db = ["new", _dbName] call OO_INIDBI;

if (isNil "_db") exitWith {
    diag_log "[LLMGM][WARN] fn_receiveFromBridge: Failed to open INIDBI database - _db is nil";
};

diag_log format ["[LLMGM][DIAG] fn_receiveFromBridge: Database handle: %1", _db];

// Read pending command from [commands] section
private _pendingCmd = ["read", ["commands", "pending", ""]] call _db;

diag_log format ["[LLMGM][DIAG] fn_receiveFromBridge: Read pending command: '%1' (type: %2)",
    if (_pendingCmd isEqualType "" && {count _pendingCmd > 50}) then {(_pendingCmd select [0, 50]) + "..."} else {_pendingCmd},
    typeName _pendingCmd];

// Check if there's a pending command
if (!(_pendingCmd isEqualType "") || {_pendingCmd == ""}) exitWith {
    diag_log "[LLMGM][DIAG] fn_receiveFromBridge: No pending command (empty or wrong type)";
    diag_log "[LLMGM][DIAG] fn_receiveFromBridge: Function complete";
};

// We have a command to execute!
diag_log format ["[LLMGM][DIAG] fn_receiveFromBridge: Found pending command, length: %1", count _pendingCmd];

// Read metadata
private _cmdId = ["read", ["metadata", "id", "unknown"]] call _db;
private _cmdType = ["read", ["metadata", "type", "unknown"]] call _db;
private _cmdTimestamp = ["read", ["metadata", "timestamp", "0"]] call _db;

diag_log format ["[LLMGM][DIAG] fn_receiveFromBridge: Command metadata - id: %1, type: %2, timestamp: %3",
    _cmdId, _cmdType, _cmdTimestamp];

// Clear the pending command BEFORE execution to prevent re-execution on crash
diag_log "[LLMGM][DIAG] fn_receiveFromBridge: Clearing pending command to prevent re-execution...";
["write", ["commands", "pending", ""]] call _db;

// Handle escaped newlines from bridge (bridge escapes \n as \\n)
private _sqf = _pendingCmd;

diag_log format ["[LLMGM] Received action from bridge: %1 (id: %2)", _cmdType, _cmdId];
diag_log format ["[LLMGM][DIAG] fn_receiveFromBridge: SQF code preview (first 100 chars): %1", _sqf select [0, 100]];

// Build metadata hashmap for executeGenerated
private _metadata = createHashMap;
_metadata set ["action", _cmdType];
_metadata set ["commandId", _cmdId];
_metadata set ["timestamp", _cmdTimestamp];
_metadata set ["source", "inidbi"];

// Mark as executing
["write", ["status", "executed", "pending"]] call _db;

// Execute the SQF code
private _execResult = false;
private _execError = "";

diag_log "[LLMGM][DIAG] fn_receiveFromBridge: About to call LLMGM_fnc_executeGenerated...";

try {
    _execResult = [_sqf, _metadata] call LLMGM_fnc_executeGenerated;
    diag_log format ["[LLMGM][DIAG] fn_receiveFromBridge: LLMGM_fnc_executeGenerated returned: %1", _execResult];
} catch {
    _execError = str _exception;
    diag_log format ["[LLMGM][WARN] fn_receiveFromBridge: Exception during execution: %1", _execError];
};

// Write execution result back to INI file for bridge feedback
if (_execResult) then {
    ["write", ["status", "executed", "true"]] call _db;
    ["write", ["status", "result", "success"]] call _db;
    ["write", ["status", "error", ""]] call _db;
    diag_log format ["[LLMGM] Command executed successfully: %1 (id: %2)", _cmdType, _cmdId];
} else {
    ["write", ["status", "executed", "true"]] call _db;
    ["write", ["status", "result", "failed"]] call _db;
    ["write", ["status", "error", _execError]] call _db;
    diag_log format ["[LLMGM][WARN] Command execution failed: %1 (id: %2)", _cmdType, _cmdId];
};

diag_log "[LLMGM][DIAG] fn_receiveFromBridge: Function complete";
