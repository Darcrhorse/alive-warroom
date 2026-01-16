/**
 * Receive and process actions from bridge server
 * Uses Pythia extension for Python bridge integration
 */

if (!LLMGM_enabled) exitWith {};

// Poll for pending actions using Pythia
private _result = ["claude_bridge.get_command", []] call py3_fnc_callExtension;

if (!isNil "_result" && {_result isNotEqualTo ""}) then {
    private _response = _result;

    // Handle both HASHMAP and ARRAY responses from Pythia
    if (typeName _response == "HASHMAP") then {
        if (_response getOrDefault ["hasAction", false]) then {
            private _sqf = _response getOrDefault ["sqf", ""];
            private _metadata = _response getOrDefault ["metadata", createHashMap];

            if (_sqf != "") then {
                diag_log format ["[LLMGM] Received action from bridge: %1", _metadata getOrDefault ["action", "unknown"]];

                // Execute the generated SQF
                [_sqf, _metadata] call LLMGM_fnc_executeGenerated;
            };
        };
    } else {
        if (typeName _response == "ARRAY" && {count _response > 0}) then {
            // Handle array response format
            private _hasAction = _response param [0, false];
            if (_hasAction) then {
                private _sqf = _response param [1, ""];
                private _metadata = _response param [2, createHashMap];

                if (_sqf != "") then {
                    diag_log format ["[LLMGM] Received action from bridge: %1", _metadata getOrDefault ["action", "unknown"]];

                    // Execute the generated SQF
                    [_sqf, _metadata] call LLMGM_fnc_executeGenerated;
                };
            };
        };
    };
};
