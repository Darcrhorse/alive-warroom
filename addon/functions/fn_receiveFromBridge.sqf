/**
 * Receive and process actions from bridge server
 */

if (!LLMGM_enabled) exitWith {};

// Poll for pending actions
private _result = "llmgm" callExtension ["receive", ""];

if ((_result select 0) != "") then {
    // Parse response (would be JSON in production)
    private _response = call compile (_result select 0);
    
    if (!isNil "_response" && {typeName _response == "HASHMAP"}) then {
        if (_response get "hasAction") then {
            private _sqf = _response get "sqf";
            private _metadata = _response get "metadata";
            
            if (!isNil "_sqf" && _sqf != "") then {
                diag_log format ["[LLMGM] Received action from bridge: %1", _metadata get "action"];
                
                // Execute the generated SQF
                [_sqf, _metadata] call LLMGM_fnc_executeGenerated;
            };
        };
    };
};
