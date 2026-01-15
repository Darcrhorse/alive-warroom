/**
 * Send game state to bridge server via Pythia
 * Params:
 *   0: HashMap - Game state data
 */

params ["_state"];

if (!LLMGM_enabled) exitWith {};

// Convert HashMap to array format for Pythia
private _stateArray = [];
{
    _stateArray pushBack [_x, _y];
} forEach _state;

// Send via Pythia/ClaudeBridge extension
private _result = ["claude_bridge.push_state", [_stateArray]] call py3_fnc_callExtension;

if (!isNil "_result" && {(_result getOrDefault ["success", false])}) then {
    diag_log "[LLMGM] Game state sent successfully";
    LLMGM_lastUpdate = time;
} else {
    diag_log format ["[LLMGM] Error sending game state: %1", _result getOrDefault ["error", "unknown"]];
};
