/**
 * Initialize LLM Game Master system
 * Called automatically via CBA
 */

if (!isServer) exitWith {};

LLMGM_enabled = false;
LLMGM_updateInterval = 30; // seconds
LLMGM_lastUpdate = 0;
LLMGM_actionQueue = [];
LLMGM_eventHistory = [];
LLMGM_maxHistorySize = 100;

// Check if extension is available
private _extTest = "llmgm" callExtension ["status", ""];
if (_extTest select 0 == "") then {
    diag_log "[LLMGM] Warning: Extension not loaded. LLM Game Master disabled.";
} else {
    LLMGM_enabled = true;
    diag_log "[LLMGM] LLM Game Master initialized successfully";
    
    // Register event handlers
    [] call LLMGM_fnc_registerCallbacks;
    
    // Start update loop
    [] spawn {
        while {true} do {
            sleep LLMGM_updateInterval;
            
            if (LLMGM_enabled) then {
                // Collect and send game state
                private _state = [] call LLMGM_fnc_collectGameState;
                [_state] call LLMGM_fnc_sendToBridge;
                
                // Check for pending actions
                [] call LLMGM_fnc_receiveFromBridge;
            };
        };
    };
    
    diag_log format ["[LLMGM] Update loop started (interval: %1s)", LLMGM_updateInterval];
};

LLMGM_initialized = true;
