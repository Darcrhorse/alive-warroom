/**
 * Receive and process actions from bridge server
 * Called periodically from the main update loop
 *
 * Diagnostic logging is included to trace command polling attempts and results.
 * Look for [LLMGM][DIAG] entries in RPT log for debugging.
 */

diag_log "[LLMGM][DIAG] fn_receiveFromBridge: Function called";

if (!LLMGM_enabled) exitWith {
    diag_log "[LLMGM][DIAG] fn_receiveFromBridge: Exiting early - LLMGM_enabled is false";
};

diag_log "[LLMGM][DIAG] fn_receiveFromBridge: LLMGM_enabled is true, proceeding with poll";

// Poll for pending actions via extension
diag_log "[LLMGM][DIAG] fn_receiveFromBridge: Calling extension 'llmgm' with ['receive', '']...";
private _result = "llmgm" callExtension ["receive", ""];

// Log the raw extension result for debugging
private _resultString = _result select 0;
private _resultCode = _result select 1;
diag_log format ["[LLMGM][DIAG] fn_receiveFromBridge: Extension result string: '%1'", _resultString];
diag_log format ["[LLMGM][DIAG] fn_receiveFromBridge: Extension return code: %1", _resultCode];

if (_resultString == "") then {
    diag_log "[LLMGM][DIAG] fn_receiveFromBridge: Extension returned empty string - no action pending or extension not loaded";
} else {
    diag_log format ["[LLMGM][DIAG] fn_receiveFromBridge: Got non-empty response, length: %1", count _resultString];
    diag_log "[LLMGM][DIAG] fn_receiveFromBridge: Attempting to parse response...";

    // Parse response (would be JSON in production)
    private _response = nil;
    private _parseError = false;

    try {
        _response = call compile _resultString;
    } catch {
        _parseError = true;
        diag_log format ["[LLMGM][WARN] fn_receiveFromBridge: Failed to parse response - %1", str _exception];
    };

    if (_parseError) exitWith {
        diag_log "[LLMGM][WARN] fn_receiveFromBridge: Exiting due to parse error";
    };

    if (isNil "_response") then {
        diag_log "[LLMGM][WARN] fn_receiveFromBridge: Parsed response is nil";
    } else {
        diag_log format ["[LLMGM][DIAG] fn_receiveFromBridge: Parsed response type: %1", typeName _response];

        if (typeName _response == "HASHMAP") then {
            diag_log format ["[LLMGM][DIAG] fn_receiveFromBridge: Response is HASHMAP with keys: %1", keys _response];

            private _hasAction = _response getOrDefault ["hasAction", false];
            diag_log format ["[LLMGM][DIAG] fn_receiveFromBridge: hasAction = %1", _hasAction];

            if (_hasAction) then {
                private _sqf = _response getOrDefault ["sqf", ""];
                private _metadata = _response getOrDefault ["metadata", createHashMap];

                diag_log format ["[LLMGM][DIAG] fn_receiveFromBridge: SQF code length: %1", count _sqf];
                diag_log format ["[LLMGM][DIAG] fn_receiveFromBridge: Metadata: %1", _metadata];

                if (_sqf != "") then {
                    private _actionName = _metadata getOrDefault ["action", "unknown"];
                    diag_log format ["[LLMGM] Received action from bridge: %1", _actionName];
                    diag_log format ["[LLMGM][DIAG] fn_receiveFromBridge: About to call LLMGM_fnc_executeGenerated with SQF (first 100 chars): %1", _sqf select [0, 100]];

                    // Execute the generated SQF
                    private _execResult = [_sqf, _metadata] call LLMGM_fnc_executeGenerated;
                    diag_log format ["[LLMGM][DIAG] fn_receiveFromBridge: LLMGM_fnc_executeGenerated returned: %1", _execResult];
                } else {
                    diag_log "[LLMGM][WARN] fn_receiveFromBridge: hasAction is true but SQF code is empty";
                };
            } else {
                diag_log "[LLMGM][DIAG] fn_receiveFromBridge: No action pending (hasAction is false)";
            };
        } else {
            diag_log format ["[LLMGM][WARN] fn_receiveFromBridge: Response is not a HASHMAP, got: %1", typeName _response];
        };
    };
};

diag_log "[LLMGM][DIAG] fn_receiveFromBridge: Function complete";
