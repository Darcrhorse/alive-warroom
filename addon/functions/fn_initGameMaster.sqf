/**
 * Initialize LLM Game Master system
 * Called automatically via CBA Extended Event Handlers (postInit)
 *
 * Arguments: None
 * Return Value: None
 *
 * Server execution only
 */

#include "..\script_component.hpp"

// Only run on server
if (!isServer) exitWith {
    diag_log "[LLMGM][DIAG] Not server - skipping initialization";
};

// Prevent double initialization
if (!isNil "LLMGM_initialized" && {LLMGM_initialized}) exitWith {
    diag_log "[LLMGM][DIAG] Already initialized, skipping...";
    diag_log format ["[LLMGM][DIAG] Current state - LLMGM_enabled: %1", LLMGM_enabled];
};

diag_log "[LLMGM] ================================================";
diag_log "[LLMGM] Initializing LLM Game Master system...";
diag_log format ["[LLMGM][DIAG] Server time: %1", serverTime];
diag_log format ["[LLMGM][DIAG] Mission name: %1", missionName];

// Initialize variables if not already done (safety check)
private _varsInitialized = false;
if (isNil "LLMGM_enabled") then {
    LLMGM_enabled = false;
    LLMGM_updateInterval = 30;
    LLMGM_lastUpdate = 0;
    LLMGM_actionQueue = [];
    LLMGM_eventHistory = [];
    LLMGM_maxHistorySize = 100;
    _varsInitialized = true;
    diag_log "[LLMGM][DIAG] Variables initialized (first time)";
} else {
    diag_log "[LLMGM][DIAG] Variables already existed, preserving values";
};

// Log current variable states
diag_log format ["[LLMGM][DIAG] Variable states:"];
diag_log format ["[LLMGM][DIAG]   LLMGM_enabled: %1", LLMGM_enabled];
diag_log format ["[LLMGM][DIAG]   LLMGM_updateInterval: %1", LLMGM_updateInterval];
diag_log format ["[LLMGM][DIAG]   LLMGM_actionQueue count: %1", count LLMGM_actionQueue];
diag_log format ["[LLMGM][DIAG]   LLMGM_eventHistory count: %1", count LLMGM_eventHistory];

// Check if extension is available
diag_log "[LLMGM][DIAG] Testing extension availability...";
private _extTest = "llmgm" callExtension ["status", ""];
private _extResult = _extTest select 0;
private _extReturnCode = _extTest select 1;
diag_log format ["[LLMGM][DIAG] Extension test result: '%1'", _extResult];
diag_log format ["[LLMGM][DIAG] Extension return code: %1", _extReturnCode];

if (_extResult == "") then {
    diag_log "[LLMGM][WARN] Extension NOT loaded - callExtension returned empty string";
    diag_log "[LLMGM][WARN] This typically means the llmgm.dll is not present or failed to load";
    diag_log "[LLMGM][WARN] Running in test mode without extension - bridge communication disabled";
    // Still enable the system for testing without extension
    LLMGM_enabled = true;
} else {
    LLMGM_enabled = true;
    diag_log format ["[LLMGM][DIAG] Extension loaded successfully, status: %1", _extResult];
};

diag_log format ["[LLMGM][DIAG] LLMGM_enabled set to: %1", LLMGM_enabled];

// Register event handlers for automatic event logging
diag_log "[LLMGM][DIAG] Registering event callbacks...";
[] call LLMGM_fnc_registerCallbacks;
diag_log "[LLMGM][DIAG] Event callbacks registered";

// Start main update loop
if (LLMGM_enabled) then {
    diag_log "[LLMGM][DIAG] Spawning update loop thread...";

    [] spawn {
        // Wait a bit for mission to fully initialize
        diag_log "[LLMGM][DIAG] Update loop: waiting 5 seconds for mission to initialize...";
        sleep 5;

        diag_log "[LLMGM][DIAG] Update loop: starting main polling loop";
        diag_log format ["[LLMGM][DIAG] Update loop: poll interval is %1 seconds", LLMGM_updateInterval];

        private _loopCount = 0;

        while {true} do {
            sleep LLMGM_updateInterval;
            _loopCount = _loopCount + 1;

            if (LLMGM_enabled) then {
                diag_log format ["[LLMGM][DIAG] Update loop iteration #%1 at time %2", _loopCount, serverTime];

                // Collect and send game state
                diag_log "[LLMGM][DIAG] Collecting game state...";
                private _state = [] call LLMGM_fnc_collectGameState;
                diag_log "[LLMGM][DIAG] Sending state to bridge...";
                [_state] call LLMGM_fnc_sendToBridge;

                // Check for pending actions
                diag_log "[LLMGM][DIAG] Checking for pending actions from bridge...";
                [] call LLMGM_fnc_receiveFromBridge;

                diag_log format ["[LLMGM][DIAG] Update loop iteration #%1 complete", _loopCount];
            } else {
                diag_log format ["[LLMGM][DIAG] Update loop iteration #%1 skipped - system disabled", _loopCount];
            };
        };
    };

    diag_log format ["[LLMGM] Update loop started (interval: %1s)", LLMGM_updateInterval];
} else {
    diag_log "[LLMGM][WARN] Update loop NOT started - LLMGM_enabled is false";
};

// Mark as initialized
LLMGM_initialized = true;

diag_log "[LLMGM] ================================================";
diag_log "[LLMGM] LLM Game Master initialized successfully";
diag_log format ["[LLMGM][DIAG] Final state - LLMGM_enabled: %1, LLMGM_initialized: %2", LLMGM_enabled, LLMGM_initialized];
diag_log "[LLMGM] ================================================";

true
