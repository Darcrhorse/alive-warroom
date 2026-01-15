/**
 * Receive and process actions from bridge server via Pythia
 */

if (!LLMGM_enabled) exitWith {};

// Poll for pending commands via Pythia/ClaudeBridge
private _result = ["claude_bridge.get_command", []] call py3_fnc_callExtension;

if (!isNil "_result" && {!isNull _result}) then {
    private _response = _result;
    
    if (typeName _response == "HASHMAP" || typeName _response == "ARRAY") then {
        private _sqf = if (typeName _response == "HASHMAP") then {
            _response getOrDefault ["sqf", ""]
        } else {
            _response param [0, ""]
        };
        
        private _metadata = if (typeName _response == "HASHMAP") then {
            _response getOrDefault ["metadata", createHashMap]
        } else {
            createHashMap
        };
        
        if (!isNil "_sqf" && {_sqf != ""}) then {
            diag_log format ["[LLMGM] Received action from bridge: %1", _metadata getOrDefault ["action", "unknown"]];
            
            // Execute the generated SQF
            [_sqf, _metadata] call LLMGM_fnc_executeGenerated;
        };
    };
};
