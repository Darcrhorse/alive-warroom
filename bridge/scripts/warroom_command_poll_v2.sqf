// Claude War Room - Command Polling Script v2
// Now with result feedback support!
//
// This script:
// 1. Polls INIDBI2 for commands from Claude
// 2. Executes them with error handling
// 3. Writes results back for the sidecar to POST to the bridge
//
// The bridge-side result sidecar reads result_ready and posts to /api/result

if (!isServer) exitWith {};
if (!isNil "WARROOM_CMDPOLL_RUNNING") exitWith {
    systemChat "[WARROOM] Poll already running";
};

WARROOM_CMDPOLL_RUNNING = true;
systemChat "[WARROOM v2] Command poll started (with result feedback)";
diag_log "[WARROOM v2] Command poll started (with result feedback)";

private _db = ["new", "claude_warroom"] call OO_INIDBI;
private _lastCmd = "";
private _cmdCount = 0;

while {true} do {
    private _pendingCmd = ["read", ["commands", "pending", ""]] call _db;
    private _commandId = ["read", ["commands", "pending_command_id", ""]] call _db;

    if (_pendingCmd isEqualType "" && {_pendingCmd != "" && _pendingCmd != _lastCmd}) then {
        _cmdCount = _cmdCount + 1;
        private _preview = if (count _pendingCmd > 60) then {
            (_pendingCmd select [0, 60]) + "..."
        } else {
            _pendingCmd
        };

        systemChat format["[WARROOM #%1] Executing: %2", _cmdCount, _preview];
        diag_log format["[WARROOM] Full command: %1", _pendingCmd];
        diag_log format["[WARROOM] Command ID: %1", _commandId];

        _lastCmd = _pendingCmd;

        // Execute command with error handling
        private _result = nil;
        private _error = "";
        private _success = true;

        try {
            _result = call compile _pendingCmd;
        } catch {
            _error = format["ERROR: %1", _exception];
            _success = false;
            systemChat format["[WARROOM] Error: %1", _exception];
            diag_log format["[WARROOM] Execution error: %1", _exception];
        };

        // Convert result to string for storage
        private _resultStr = if (isNil "_result") then {
            "nil"
        } else {
            str _result
        };

        // Clear pending command
        ["write", ["commands", "pending", ""]] call _db;
        ["write", ["commands", "pending_command_id", ""]] call _db;

        // Write execution metadata
        ["write", ["commands", "last_executed", _pendingCmd]] call _db;
        ["write", ["commands", "last_result", _resultStr]] call _db;
        ["write", ["commands", "cmd_count", str _cmdCount]] call _db;

        // Write result feedback data for sidecar
        if (_commandId != "") then {
            ["write", ["commands", "current_command_id", _commandId]] call _db;
            ["write", ["commands", "result_error", _error]] call _db;
            ["write", ["commands", "result_ready", "1"]] call _db;  // Signal sidecar
            diag_log format["[WARROOM] Result ready for command %1: %2", _commandId, _resultStr];
        };

        // Also show result in systemChat for immediate feedback
        if (_success) then {
            private _resultPreview = if (count _resultStr > 80) then {
                (_resultStr select [0, 80]) + "..."
            } else {
                _resultStr
            };
            systemChat format["[WARROOM] Result: %1", _resultPreview];
        };
    };

    sleep 0.5;
};
