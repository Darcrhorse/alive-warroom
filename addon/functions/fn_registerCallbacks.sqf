/**
 * Register event handlers for automatic event logging
 */

if (!isServer) exitWith {};

// Entity killed
addMissionEventHandler ["EntityKilled", {
    params ["_killed", "_killer", "_instigator"];
    
    ["kill", createHashMapFromArray [
        ["killed", typeOf _killed],
        ["killedSide", str side _killed],
        ["killer", if (!isNull _killer) then {typeOf _killer} else {"unknown"}],
        ["killerSide", if (!isNull _killer) then {str side _killer} else {"unknown"}]
    ]] call LLMGM_fnc_logEvent;
}];

// Task state changed
["TaskSetAsCurrent", {
    params ["_task"];
    
    ["objective_active", createHashMapFromArray [
        ["taskId", _task],
        ["state", [_task] call BIS_fnc_taskState]
    ]] call LLMGM_fnc_logEvent;
}] call CBA_fnc_addEventHandler;

["TaskSetAsComplete", {
    params ["_task", "_state"];
    
    ["objective_complete", createHashMapFromArray [
        ["taskId", _task],
        ["state", _state]
    ]] call LLMGM_fnc_logEvent;
}] call CBA_fnc_addEventHandler;

// Player events
addMissionEventHandler ["HandleDisconnect", {
    params ["_unit"];
    
    ["player_disconnect", createHashMapFromArray [
        ["name", name _unit],
        ["uid", getPlayerUID _unit]
    ]] call LLMGM_fnc_logEvent;
}];

diag_log "[LLMGM] Event handlers registered";
