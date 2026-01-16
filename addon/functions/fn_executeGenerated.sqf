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

// Convert to lowercase for case-insensitive matching
private _sqfLower = toLower _sqf;

{
    private _cmd = _x;
    private _cmdLower = toLower _cmd;
    // Use simple string search (case-insensitive via toLower)
    if (_sqfLower find _cmdLower >= 0) then {
        _safe = false;
        _violations pushBack _cmd;
        diag_log format ["[LLMGM] ERROR: Blocked command detected: %1", _cmd];
    };
} forEach _blockedCommands;

// Additional security: check for player harm
// Check for deleteVehicle followed by player (with any whitespace)
if (_sqfLower find "deletevehicle" >= 0 && {_sqfLower find "player" >= 0}) then {
    // More precise check - see if "player" appears after "deletevehicle"
    private _deletePos = _sqfLower find "deletevehicle";
    private _playerPos = _sqfLower find "player";
    if (_playerPos > _deletePos) then {
        _safe = false;
        _violations pushBack "deleteVehicle player";
        diag_log "[LLMGM] ERROR: Attempt to delete player detected";
    };
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

// Pre-compilation quote validation
// Check for common quote-related issues before compilation
private _quoteIssues = [];
private _sqfLength = count _sqf;

// Check for unconverted __DQUOTE__ placeholders
if (_sqf find "__DQUOTE__" >= 0) then {
    _quoteIssues pushBack "Unconverted __DQUOTE__ placeholder detected - quote conversion failed in bridge";
    // Log context around the placeholder
    private _placeholderPos = _sqf find "__DQUOTE__";
    private _contextStart = (_placeholderPos - 20) max 0;
    private _contextEnd = (_placeholderPos + 30) min _sqfLength;
    private _context = _sqf select [_contextStart, _contextEnd - _contextStart];
    diag_log format ["[LLMGM] QUOTE ERROR: __DQUOTE__ found at position %1", _placeholderPos];
    diag_log format ["[LLMGM] Context: ...%1...", _context];
};

// Check for double quotes (which can cause Pythia transport issues)
private _doubleQuotePos = _sqf find '"';
if (_doubleQuotePos >= 0) then {
    _quoteIssues pushBack "Double quotes detected - may cause transport corruption";
    private _contextStart = (_doubleQuotePos - 15) max 0;
    private _contextEnd = (_doubleQuotePos + 25) min _sqfLength;
    private _context = _sqf select [_contextStart, _contextEnd - _contextStart];
    diag_log format ["[LLMGM] QUOTE WARNING: Double quote found at position %1", _doubleQuotePos];
    diag_log format ["[LLMGM] Context: ...%1...", _context];
};

// Count single quotes to check for mismatches (outside comments)
private _singleQuoteCount = 0;
{
    if (_x == 39) then { // ASCII 39 = single quote
        _singleQuoteCount = _singleQuoteCount + 1;
    };
} forEach (toArray _sqf);

// Odd number of single quotes suggests mismatched quotes (accounting for doubled escapes)
// This is a heuristic - doubled quotes ('') should balance out
if (_singleQuoteCount mod 2 != 0) then {
    _quoteIssues pushBack format ["Potentially mismatched single quotes (count: %1)", _singleQuoteCount];
    diag_log format ["[LLMGM] QUOTE WARNING: Odd number of single quotes (%1) - may indicate mismatch", _singleQuoteCount];
};

// Log any pre-compilation quote issues
if (count _quoteIssues > 0) then {
    diag_log "=== LLMGM QUOTE ANALYSIS ===";
    {
        diag_log format ["[LLMGM] Issue %1: %2", _forEachIndex + 1, _x];
    } forEach _quoteIssues;
    diag_log "=== END QUOTE ANALYSIS ===";
};

// Execute in safe context
private _success = false;
private _error = "";

try {
    // Compile and execute the code
    private _code = compile _sqf;

    // Check if compilation succeeded
    if (isNil "_code") then {
        // Enhanced error logging for compilation failure
        diag_log "[LLMGM] Compilation failed - analyzing SQF structure...";

        // Log first 200 characters for context
        private _preview = _sqf select [0, 200 min _sqfLength];
        diag_log format ["[LLMGM] SQF preview: %1", _preview];

        // Check for common syntax issues around quotes
        // Look for patterns that often break: setBehaviour, setCombatMode, format
        private _patterns = ["setBehaviour", "setCombatMode", "setWaypointType", "format ["];
        {
            private _pattern = _x;
            private _patternPos = _sqf find _pattern;
            if (_patternPos >= 0) then {
                private _contextStart = _patternPos;
                private _contextEnd = (_patternPos + 50) min _sqfLength;
                private _context = _sqf select [_contextStart, _contextEnd - _contextStart];
                diag_log format ["[LLMGM] Found '%1' at position %2: %3", _pattern, _patternPos, _context];
            };
        } forEach _patterns;

        throw "Compilation failed - check quote formatting";
    };

    // Execute
    call _code;
    _success = true;
    diag_log "[LLMGM] SQF executed successfully";
} catch {
    _error = str _exception;
    _success = false;

    // Enhanced error logging
    diag_log format ["[LLMGM] ERROR executing SQF: %1", _exception];

    // If there were quote issues detected earlier, remind about them
    if (count _quoteIssues > 0) then {
        diag_log "[LLMGM] NOTE: Quote issues were detected before compilation - likely related to failure";
        diag_log format ["[LLMGM] Quote issues: %1", _quoteIssues];
    };

    // Log character codes around problematic positions for debugging
    if (_sqfLength > 0) then {
        private _firstChars = _sqf select [0, 50 min _sqfLength];
        diag_log format ["[LLMGM] First 50 chars: %1", _firstChars];
        diag_log format ["[LLMGM] First 50 char codes: %1", toArray _firstChars];
    };
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
