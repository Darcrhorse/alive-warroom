/**
 * Send game state to bridge server
 * Params:
 *   0: HashMap - Game state data
 */

params ["_state"];

if (!LLMGM_enabled) exitWith {};

// Convert HashMap to JSON string (simplified - in production would use proper JSON serialization)
private _json = str _state;

// Send via extension
private _result = "llmgm" callExtension ["send", _json];

if ((_result select 0) == "ok") then {
    diag_log "[LLMGM] Game state sent successfully";
    LLMGM_lastUpdate = time;
} else {
    diag_log format ["[LLMGM] Error sending game state: %1", _result select 0];
};
