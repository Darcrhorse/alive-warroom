/**
 * Safely execute LLM-generated SQF code
 * Params:
 *   0: String - SQF code to execute
 *   1: HashMap - Metadata about the action
 */

params ["_sqf", "_metadata"];

if (!LLMGM_enabled) exitWith {};

// Log execution
diag_log "=== LLMGM EXECUTING GENERATED SQF ===";
diag_log format ["Action: %1", _metadata get "action"];
diag_log format ["Timestamp: %1", _metadata get "timestamp"];
diag_log format ["Reasoning: %1", _metadata get "reasoning"];
diag_log "=== SQF CODE ===";
diag_log _sqf;
diag_log "=== END SQF CODE ===";

// Security check - blocked commands
private _blockedCommands = [
    "endMission",
    "failMission",
    "forceEnd",
    "terminate",
    "serverCommand",
    "saveProfileNamespace",
    "loadFile",
    "preprocessFile",
    "deleteVehicle player"
];

private _safe = true;
{
    if (_sqf find _x >= 0) then {
        _safe = false;
        diag_log format ["[LLMGM] ERROR: Blocked command detected: %1", _x];
    };
} forEach _blockedCommands;

if (!_safe) exitWith {
    diag_log "[LLMGM] EXECUTION BLOCKED - Security violation detected";
    
    // Log the security event
    ["security_violation", createHashMapFromArray [
        ["command", "executeGenerated"],
        ["reason", "blocked_command_detected"]
    ]] call LLMGM_fnc_logEvent;
};

// Execute in try-catch equivalent (using error handling)
private _success = false;
private _error = "";

try {
    // Compile and execute
    private _code = compile _sqf;
    call _code;
    _success = true;
    diag_log "[LLMGM] SQF executed successfully";
} catch {
    _error = _exception;
    diag_log format ["[LLMGM] ERROR executing SQF: %1", _exception];
};

// Log execution result
if (_success) then {
    ["sqf_executed", createHashMapFromArray [
        ["action", _metadata get "action"],
        ["success", true]
    ]] call LLMGM_fnc_logEvent;
} else {
    ["sqf_execution_failed", createHashMapFromArray [
        ["action", _metadata get "action"],
        ["error", _error]
    ]] call LLMGM_fnc_logEvent;
};

_success
