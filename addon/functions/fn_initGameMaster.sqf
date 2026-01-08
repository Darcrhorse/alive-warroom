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
if (!isServer) exitWith {};

// Prevent double initialization
if (!isNil "LLMGM_initialized" && {LLMGM_initialized}) exitWith {
    diag_log "[LLMGM] Already initialized, skipping...";
};

diag_log "[LLMGM] Initializing LLM Game Master system...";

// Initialize variables if not already done (safety check)
if (isNil "LLMGM_enabled") then {
    LLMGM_enabled = false;
    LLMGM_updateInterval = 30;
    LLMGM_lastUpdate = 0;
    LLMGM_actionQueue = [];
    LLMGM_eventHistory = [];
    LLMGM_maxHistorySize = 100;
};

// Check if extension is available
private _extTest = "llmgm" callExtension ["status", ""];
if ((_extTest select 0) == "") then {
    diag_log "[LLMGM] Warning: Extension not loaded. Running in test mode without extension.";
    diag_log "[LLMGM] System will work but cannot communicate with bridge server yet.";
    // Still enable the system for testing without extension
    LLMGM_enabled = true;
} else {
    LLMGM_enabled = true;
    diag_log "[LLMGM] Extension loaded successfully";
};

// Register event handlers for automatic event logging
[] call LLMGM_fnc_registerCallbacks;

// Start main update loop
if (LLMGM_enabled) then {
    [] spawn {
        // Wait a bit for mission to fully initialize
        sleep 5;
        
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

// Mark as initialized
LLMGM_initialized = true;

diag_log "[LLMGM] LLM Game Master initialized successfully";

true
