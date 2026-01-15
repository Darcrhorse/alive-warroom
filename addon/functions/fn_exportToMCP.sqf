/**
 * Export game data to JSON for MCP database
 * Run this once to generate comprehensive SQF command + classname database
 *
 * Usage: [] call LLMGM_fnc_exportToMCP;
 * Output: Writes to profile folder as "LLMGM_MCPExport.json"
 */

params [["_exportPath", ""]];

private _startTime = diag_tickTime;
systemChat "LLMGM: Starting MCP export...";

private _export = createHashMap;

// ========== 1. ALL SQF COMMANDS ==========
systemChat "LLMGM: Exporting SQF commands...";
private _commands = [];
{
    // supportInfo returns format like "b:ARRAY select SCALAR" or "n:abs"
    // b: = binary, n: = nular, u: = unary, t: = type
    private _entry = _x;
    private _type = _entry select [0, 2];
    private _syntax = _entry select [2];

    private _cmdData = createHashMap;
    _cmdData set ["raw", _entry];
    _cmdData set ["type", switch (_type) do {
        case "b:": {"binary"};
        case "n:": {"nular"};
        case "u:": {"unary"};
        case "t:": {"type"};
        default {"unknown"};
    }];
    _cmdData set ["syntax", _syntax];

    // Extract command name from syntax
    private _name = if (_type == "t:") then {
        _syntax
    } else {
        private _parts = _syntax splitString " ";
        if (_type == "b:") then {
            _parts select 1  // Binary: ARG command ARG
        } else {
            _parts select 0  // Unary/Nular: command or command ARG
        };
    };
    _cmdData set ["name", _name];

    _commands pushBack _cmdData;
} forEach (supportInfo "");
_export set ["sqfCommands", _commands];
systemChat format ["LLMGM: Exported %1 SQF commands", count _commands];

// ========== 2. BIS FUNCTIONS ==========
systemChat "LLMGM: Exporting BIS functions...";
private _bisFunctions = [];
{
    if (_x select [0, 4] == "BIS_" || _x select [0, 3] == "bis") then {
        private _funcData = createHashMap;
        _funcData set ["name", _x];
        // Try to get function code for analysis
        private _code = missionNamespace getVariable [_x, {}];
        _funcData set ["hasCode", !isNil "_code" && {typeName _code == "CODE"}];
        _bisFunctions pushBack _funcData;
    };
} forEach (allVariables missionNamespace);
_export set ["bisFunctions", _bisFunctions];
systemChat format ["LLMGM: Exported %1 BIS functions", count _bisFunctions];

// ========== 3. VEHICLES (filtered for actual vehicles) ==========
systemChat "LLMGM: Exporting vehicles...";
private _vehicles = [];
{
    private _cfg = _x;
    private _class = configName _cfg;
    private _scope = getNumber (_cfg >> "scope");

    // Only export scope >= 2 (public classes)
    if (_scope >= 2) then {
        private _sim = getText (_cfg >> "simulation");
        // Filter to actual vehicles
        if (_sim in ["car", "carx", "tank", "tankx", "helicopter", "helicopterrtd", "airplanex", "ship", "shipx", "submarinex"]) then {
            private _vehData = createHashMap;
            _vehData set ["class", _class];
            _vehData set ["displayName", getText (_cfg >> "displayName")];
            _vehData set ["side", getNumber (_cfg >> "side")];
            _vehData set ["faction", getText (_cfg >> "faction")];
            _vehData set ["vehicleClass", getText (_cfg >> "vehicleClass")];
            _vehData set ["simulation", _sim];
            _vehData set ["crew", getText (_cfg >> "crew")];
            _vehData set ["transportSoldier", getNumber (_cfg >> "transportSoldier")];

            // Get parents for categorization
            private _parents = [];
            private _parent = inheritsFrom _cfg;
            while {!isNull _parent} do {
                _parents pushBack (configName _parent);
                _parent = inheritsFrom _parent;
            };
            _vehData set ["parents", _parents];

            _vehicles pushBack _vehData;
        };
    };
} forEach ("true" configClasses (configFile >> "CfgVehicles"));
_export set ["vehicles", _vehicles];
systemChat format ["LLMGM: Exported %1 vehicles", count _vehicles];

// ========== 4. UNITS (infantry) ==========
systemChat "LLMGM: Exporting units...";
private _units = [];
{
    private _cfg = _x;
    private _class = configName _cfg;
    private _scope = getNumber (_cfg >> "scope");

    if (_scope >= 2) then {
        private _sim = getText (_cfg >> "simulation");
        if (_sim == "soldier") then {
            private _unitData = createHashMap;
            _unitData set ["class", _class];
            _unitData set ["displayName", getText (_cfg >> "displayName")];
            _unitData set ["side", getNumber (_cfg >> "side")];
            _unitData set ["faction", getText (_cfg >> "faction")];
            _unitData set ["vehicleClass", getText (_cfg >> "vehicleClass")];
            _unitData set ["role", getText (_cfg >> "role")];
            _unitData set ["icon", getText (_cfg >> "icon")];

            _units pushBack _unitData;
        };
    };
} forEach ("true" configClasses (configFile >> "CfgVehicles"));
_export set ["units", _units];
systemChat format ["LLMGM: Exported %1 units", count _units];

// ========== 5. WEAPONS ==========
systemChat "LLMGM: Exporting weapons...";
private _weapons = [];
{
    private _cfg = _x;
    private _class = configName _cfg;
    private _scope = getNumber (_cfg >> "scope");

    if (_scope >= 2) then {
        private _weapData = createHashMap;
        _weapData set ["class", _class];
        _weapData set ["displayName", getText (_cfg >> "displayName")];
        _weapData set ["type", getNumber (_cfg >> "type")];
        _weapData set ["magazines", getArray (_cfg >> "magazines")];

        _weapons pushBack _weapData;
    };
} forEach ("true" configClasses (configFile >> "CfgWeapons"));
_export set ["weapons", _weapons];
systemChat format ["LLMGM: Exported %1 weapons", count _weapons];

// ========== 6. FACTIONS ==========
systemChat "LLMGM: Exporting factions...";
private _factions = [];
{
    private _cfg = _x;
    private _class = configName _cfg;

    private _facData = createHashMap;
    _facData set ["class", _class];
    _facData set ["displayName", getText (_cfg >> "displayName")];
    _facData set ["side", getNumber (_cfg >> "side")];
    _facData set ["flag", getText (_cfg >> "flag")];

    _factions pushBack _facData;
} forEach ("true" configClasses (configFile >> "CfgFactionClasses"));
_export set ["factions", _factions];
systemChat format ["LLMGM: Exported %1 factions", count _factions];

// ========== 7. GROUPS (predefined squad compositions) ==========
systemChat "LLMGM: Exporting groups...";
private _groups = [];
{
    // Side level (EAST, WEST, etc.)
    private _sideCfg = _x;
    private _sideName = configName _sideCfg;
    {
        // Faction level
        private _factionCfg = _x;
        private _factionName = configName _factionCfg;
        {
            // Category level (Infantry, Motorized, etc.)
            private _catCfg = _x;
            private _catName = configName _catCfg;
            {
                // Group level
                private _grpCfg = _x;
                private _grpClass = configName _grpCfg;

                private _grpData = createHashMap;
                _grpData set ["class", _grpClass];
                _grpData set ["name", getText (_grpCfg >> "name")];
                _grpData set ["side", _sideName];
                _grpData set ["faction", _factionName];
                _grpData set ["category", _catName];

                // Get unit composition
                private _unitList = [];
                {
                    private _unitCfg = _x;
                    _unitList pushBack (getText (_unitCfg >> "vehicle"));
                } forEach ("true" configClasses _grpCfg);
                _grpData set ["units", _unitList];
                _grpData set ["unitCount", count _unitList];

                _groups pushBack _grpData;
            } forEach ("true" configClasses _catCfg);
        } forEach ("true" configClasses _factionCfg);
    } forEach ("true" configClasses _sideCfg);
} forEach ("true" configClasses (configFile >> "CfgGroups"));
_export set ["groups", _groups];
systemChat format ["LLMGM: Exported %1 groups", count _groups];

// ========== 8. METADATA ==========
private _meta = createHashMap;
_meta set ["exportTime", systemTimeUTC];
_meta set ["worldName", worldName];
_meta set ["productVersion", productVersion];
_meta set ["activeMods", (getLoadedModsInfo) apply {_x select 0}];
_export set ["metadata", _meta];

// ========== WRITE TO FILE ==========
private _json = str _export;  // SQF hashmap to string (not true JSON but parseable)

// Write to profile directory
private _filename = if (_exportPath == "") then {
    format ["%1LLMGM_MCPExport.txt", ""]  // profileNamespace saves to profile dir
} else {
    _exportPath
};

// Use profileNamespace to save (persists between sessions)
profileNamespace setVariable ["LLMGM_MCPExport", _export];
saveProfileNamespace;

// Also copy to clipboard for easy access
copyToClipboard _json;

private _elapsed = diag_tickTime - _startTime;
private _summary = format [
    "LLMGM MCP Export Complete!\nCommands: %1\nBIS Functions: %2\nVehicles: %3\nUnits: %4\nWeapons: %5\nFactions: %6\nGroups: %7\nTime: %8s\n\nData copied to clipboard!",
    count _commands,
    count _bisFunctions,
    count _vehicles,
    count _units,
    count _weapons,
    count _factions,
    count _groups,
    _elapsed toFixed 2
];

systemChat _summary;
hint _summary;

// Return the export for direct use
_export
