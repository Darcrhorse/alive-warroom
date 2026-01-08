/**
 * Safely execute LLM-generated SQF code
 * 
 * Arguments:
 *   0: String - SQF code to execute
 *   1: HashMap - Metadata about the action
 * 
 * Return Value: Boolean - True if execution succeeded
 * 
 * Server execution only
 */

#include "..\script_component.hpp"

// Validate parameters
params [
    ["_sqf", "", [""]],
    ["_metadata", createHashMap, [createHashMap]]
];

// Only run on server
if (!isServer) exitWith {
    diag_log "[LLMGM] ERROR: executeGenerated called on client";
    false
};

// Check if system is enabled
if (!LLMGM_enabled) exitWith {
    diag_log "[LLMGM] System disabled, skipping execution";
    false
};

// Validate input
if (_sqf == "") exitWith {
    diag_log "[LLMGM] ERROR: Empty SQF code provided";
    false
};

// Log execution
diag_log "=== LLMGM EXECUTING GENERATED SQF ===";
diag_log format ["Action: %1", _metadata getOrDefault ["action", "unknown"]];
diag_log format ["Timestamp: %1", _metadata getOrDefault ["timestamp", 0]];
diag_log format ["Reasoning: %1", _metadata getOrDefault ["reasoning", "none"]];
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
    "preprocessFile"
];

// Check for dangerous patterns
private _safe = true;
private _violations = [];

{
    private _cmd = _x;
    // Use case-insensitive search with word boundaries
    if (_sqf regexMatch ("(?i)\b" + _cmd + "\b")) then {
        _safe = false;
        _violations pushBack _cmd;
        diag_log format ["[LLMGM] ERROR: Blocked command detected: %1", _cmd];
    };
} forEach _blockedCommands;

// Additional security: check for player harm
if (_sqf regexMatch "(?i)deleteVehicle\s+player") then {
    _safe = false;
    _violations pushBack "deleteVehicle player";
    diag_log "[LLMGM] ERROR: Attempt to delete player detected";
};

// Exit if unsafe
if (!_safe) exitWith {
    diag_log "[LLMGM] EXECUTION BLOCKED - Security violation detected";
    
    // Log the security event
    ["security_violation", createHashMapFromArray [
        ["command", "executeGenerated"],
        ["reason", "blocked_command_detected"],
        ["violations", _violations]
    ]] call LLMGM_fnc_logEvent;
    
    false
};

// Execute in safe context
private _success = false;
private _error = "";

try {
    // Compile and execute the code
    private _code = compile _sqf;
    
    // Check if compilation succeeded
    if (isNil "_code") then {
        throw "Compilation failed";
    };
    
    // Execute
    call _code;
    _success = true;
    diag_log "[LLMGM] SQF executed successfully";
} catch {
    _error = str _exception;
    _success = false;
    diag_log format ["[LLMGM] ERROR executing SQF: %1", _exception];
};

// Log execution result
if (_success) then {
    ["sqf_executed", createHashMapFromArray [
        ["action", _metadata getOrDefault ["action", "unknown"]],
        ["success", true],
        ["timestamp", time]
    ]] call LLMGM_fnc_logEvent;
} else {
    ["sqf_execution_failed", createHashMapFromArray [
        ["action", _metadata getOrDefault ["action", "unknown"]],
        ["error", _error],
        ["timestamp", time]
    ]] call LLMGM_fnc_logEvent;
};

_success
