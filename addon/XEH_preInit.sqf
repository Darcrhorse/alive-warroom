#include "script_component.hpp"

// CBA Extended Event Handler - Pre-Init
// This runs before mission objects are created
// Perfect for: function compilation, variable initialization, settings

ADDON = false;

// Compile functions
PREP_RECOMPILE_START;
#include "XEH_PREP.hpp"
PREP_RECOMPILE_END;

// Check if running on correct machine
if (!hasInterface && !isDedicated) exitWith {};

diag_log "[LLMGM] XEH Pre-init starting...";

// Initialize global variables (server-side)
if (isServer) then {
    GVAR(version) = "0.1.0";
    GVAR(initialized) = false;
    GVAR(enabled) = false;
    GVAR(updateInterval) = 30;
    GVAR(lastUpdate) = 0;
    GVAR(actionQueue) = [];
    GVAR(eventHistory) = [];
    GVAR(maxHistorySize) = 100;
    
    diag_log format ["[LLMGM] Global variables initialized (v%1)", GVAR(version)];
};

ADDON = true;

diag_log "[LLMGM] XEH Pre-init complete";
