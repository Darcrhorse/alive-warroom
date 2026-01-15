/**
 * Initialize LLM Game Master system
 * Server execution only
 */

// Only run on server
if (!isServer) exitWith {};

// Prevent double initialization
if (!isNil "LLMGM_initialized" && {LLMGM_initialized}) exitWith {
    diag_log "[LLMGM] Already initialized, skipping...";
};

diag_log "[LLMGM] Initializing LLM Game Master system...";

// Initialize variables
if (isNil "LLMGM_enabled") then {
    LLMGM_enabled = false;
    LLMGM_updateInterval = 30;
    LLMGM_lastUpdate = 0;
    LLMGM_actionQueue = [];
    LLMGM_eventHistory = [];
    LLMGM_maxHistorySize = 100;
};

// Check if Pythia extension is available
private _pythiaAvailable = !isNil "py3_fnc_callExtension";

if (_pythiaAvailable) then {
    private _initResult = ["claude_bridge.init", []] call py3_fnc_callExtension;
    diag_log format ["[LLMGM] ClaudeBridge init: %1", _initResult];
    LLMGM_enabled = true;
    diag_log "[LLMGM] Pythia/ClaudeBridge loaded successfully";
} else {
    diag_log "[LLMGM] Warning: Pythia extension not available.";
    LLMGM_enabled = true;
};

// Register event handlers
[] call LLMGM_fnc_registerCallbacks;

// Start main update loop
if (LLMGM_enabled) then {
    [] spawn {
        sleep 5;
        while {true} do {
            sleep LLMGM_updateInterval;
            if (LLMGM_enabled) then {
                private _state = [] call LLMGM_fnc_collectGameState;
                [_state] call LLMGM_fnc_sendToBridge;
                [] call LLMGM_fnc_receiveFromBridge;
            };
        };
    };
    diag_log format ["[LLMGM] Update loop started (interval: %1s)", LLMGM_updateInterval];
};

LLMGM_initialized = true;
diag_log "[LLMGM] LLM Game Master initialized successfully";
true
