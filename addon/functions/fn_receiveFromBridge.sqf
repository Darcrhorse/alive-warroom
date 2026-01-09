/**
 * Receive and process actions from bridge server
 */

if (!LLMGM_enabled) exitWith {};

// Poll for pending actions
private _result = "llmgm" callExtension ["receive", ""];

if ((_result select 0) != "") then {
    // Parse response (Pythia returns Python dicts as [["key", "value"], ...] arrays)
    private _response = call compile (_result select 0);
    
    if (!isNil "_response") then {
        private _hasAction = false;
        private _sqf = "";
        private _metadata = createHashMap;
        
        // Check if response is HashMap (old format) or array (Pythia format)
        if (typeName _response == "HASHMAP") then {
            // Old format - direct HashMap
            _hasAction = _response get "hasAction";
            _sqf = _response get "sqf";
            _metadata = _response get "metadata";
        } else {
            // New format - Parse [["sqf", "code"], ["metadata", [...]]] format
            if (_response isEqualType []) then {
                {
                    if (_x isEqualType [] && {count _x == 2}) then {
                        private _key = _x select 0;
                        private _value = _x select 1;
                        
                        if (_key == "hasAction") then { _hasAction = _value; };
                        if (_key == "sqf") then { _sqf = _value; };
                        if (_key == "metadata") then {
                            // Convert metadata array to HashMap
                            if (_value isEqualType []) then {
                                {
                                    if (_x isEqualType [] && {count _x == 2}) then {
                                        _metadata set [_x select 0, _x select 1];
                                    };
                                } forEach _value;
                            } else {
                                _metadata = _value;
                            };
                        };
                    };
                } forEach _response;
            };
        };
        
        // Execute if we have an action
        if (_hasAction && _sqf != "") then {
            diag_log format ["[LLMGM] Received action from bridge: %1", _metadata getOrDefault ["action", "unknown"]];
            
            // Execute the generated SQF
            [_sqf, _metadata] call LLMGM_fnc_executeGenerated;
        };
    };
};
