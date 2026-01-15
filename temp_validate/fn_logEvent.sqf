/**
 * Log game event to history
 * Params:
 *   0: String - Event type
 *   1: HashMap - Event data
 */

params ["_type", "_data"];

private _event = createHashMap;
_event set ["timestamp", time * 1000];
_event set ["type", _type];
_event set ["data", _data];

// Add to history
LLMGM_eventHistory pushBack _event;

// Trim history if too large
if (count LLMGM_eventHistory > LLMGM_maxHistorySize) then {
    LLMGM_eventHistory = LLMGM_eventHistory select [(count LLMGM_eventHistory - LLMGM_maxHistorySize), LLMGM_maxHistorySize];
};

diag_log format ["[LLMGM] Event logged: %1", _type];
