// CBA Extended Event Handler - Pre-Init
// This runs before mission objects are created
// Perfect for: function compilation, variable initialization, settings

llmgm_main = false;

// Compile functions
if (uiNamespace getVariable ["llmgm_recompile", false]) then {
    llmgm_fnc_initGameMaster = {_this call llmgm_fnc_initGameMaster};
    llmgm_fnc_collectGameState = {_this call llmgm_fnc_collectGameState};
    llmgm_fnc_sendToBridge = {_this call llmgm_fnc_sendToBridge};
    llmgm_fnc_receiveFromBridge = {_this call llmgm_fnc_receiveFromBridge};
    llmgm_fnc_executeGenerated = {_this call llmgm_fnc_executeGenerated};
    llmgm_fnc_logEvent = {_this call llmgm_fnc_logEvent};
    llmgm_fnc_registerCallbacks = {_this call llmgm_fnc_registerCallbacks};
};

// Check if running on correct machine
if (!hasInterface && !isDedicated) exitWith {};

diag_log "[LLMGM] XEH Pre-init starting...";

// Initialize global variables (server-side)
if (isServer) then {
    llmgm_main_version = "0.1.0";
    llmgm_main_initialized = false;
    llmgm_main_enabled = false;
    llmgm_main_updateInterval = 30;
    llmgm_main_lastUpdate = 0;
    llmgm_main_actionQueue = [];
    llmgm_main_eventHistory = [];
    llmgm_main_maxHistorySize = 100;
    
    diag_log format ["[LLMGM] Global variables initialized (v%1)", llmgm_main_version];
};

llmgm_main = true;

diag_log "[LLMGM] XEH Pre-init complete";
