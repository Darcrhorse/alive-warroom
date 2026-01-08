#include "script_component.hpp"

// CBA pre-init
if (!hasInterface && !isDedicated) exitWith {};

diag_log "[LLMGM] Pre-init starting...";

// Initialize global variables
LLMGM_version = "0.1.0";
LLMGM_initialized = false;

diag_log "[LLMGM] Pre-init complete";
