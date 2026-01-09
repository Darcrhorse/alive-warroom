// CBA Extended Event Handler - Post-Init
// This runs after all mission objects exist
// Perfect for: registering event handlers, accessing mission objects, starting systems

// Only run on server
if (!isServer) exitWith {};

diag_log "[LLMGM] XEH Post-init starting...";

// Initialize the Game Master system
// This is safe here because all mission objects exist
[] call LLMGM_fnc_initGameMaster;

diag_log "[LLMGM] XEH Post-init complete";
