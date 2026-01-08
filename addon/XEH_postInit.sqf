#include "script_component.hpp"

// CBA post-init
if (!isServer) exitWith {};

diag_log "[LLMGM] Post-init starting...";

// Initialize the Game Master system
[] call LLMGM_fnc_initGameMaster;

diag_log "[LLMGM] Post-init complete";
