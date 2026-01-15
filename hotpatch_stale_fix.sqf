// HOT PATCH: Fix stale connection loop
// Run this from debug console (LOCAL EXEC) after mission starts
// This replaces the unreliable spawn loop with CBA scheduler

// Stop any existing loop
LLMGM_enabled = false;
sleep 0.5;

// Re-enable
LLMGM_enabled = true;

// Define new reliable update function using CBA
LLMGM_fnc_reliableUpdate = {
    if (!LLMGM_enabled) exitWith {
        systemChat "[LLMGM] Loop stopped";
    };

    // Collect and send game state
    private _state = [] call LLMGM_fnc_collectGameState;
    [_state] call LLMGM_fnc_sendToBridge;

    // Receive commands from bridge
    [] call LLMGM_fnc_receiveFromBridge;

    // Schedule next update using CBA (much more reliable than spawn sleep)
    [LLMGM_fnc_reliableUpdate, [], LLMGM_updateInterval] call CBA_fnc_waitAndExecute;
};

// Start the new loop
systemChat "[LLMGM] HOT PATCH: Starting reliable CBA update loop...";
[LLMGM_fnc_reliableUpdate, [], 2] call CBA_fnc_waitAndExecute;

systemChat format ["[LLMGM] Update interval: %1s - Patch active!", LLMGM_updateInterval];
