/*
 * Author: LLM Game Master Team
 * Collects comprehensive terrain context for LLM decision-making
 * Provides "eyes on the battlefield" - roads, buildings, elevation, spawn zones
 *
 * Arguments:
 * 0: Position - Center position for analysis (usually player position)
 * 1: Number - Scan radius in meters (default: 1000)
 *
 * Return Value:
 * HashMap - Comprehensive terrain context
 *
 * Example:
 * private _terrain = [getPosATL player, 1000] call LLMGM_fnc_collectTerrainContext;
 *
 * Public: Yes
 */

params [
    ["_centerPos", [0, 0, 0], [[]], [2,3]],
    ["_scanRadius", 1000, [0]]
];

private _terrainData = createHashMap;

// ============================================================
// BASIC MAP INFORMATION
// ============================================================

_terrainData set ["mapName", worldName];
_terrainData set ["mapSize", worldSize];
_terrainData set ["timestamp", serverTime];

// ============================================================
// CENTER POSITION ANALYSIS
// ============================================================

private _locationData = createHashMap;

// Elevation
_locationData set ["elevation", getTerrainHeightASL _centerPos];
_locationData set ["position", _centerPos];

// Surface type
private _surface = surfaceType _centerPos;
_locationData set ["surfaceType", _surface];
_locationData set ["inWater", surfaceIsWater _centerPos];

// Road proximity
private _nearestRoad = [_centerPos, 200] call BIS_fnc_nearestRoad;
_locationData set ["nearRoad", !isNull _nearestRoad];
if (!isNull _nearestRoad) then {
    _locationData set ["roadDistance", _centerPos distance _nearestRoad];
};

// Nearest location (town/city)
private _nearestTown = nearestLocation [_centerPos, "NameCityCapital"];
if (isNull _nearestTown) then {
    _nearestTown = nearestLocation [_centerPos, "NameCity"];
};
if (isNull _nearestTown) then {
    _nearestTown = nearestLocation [_centerPos, "NameVillage"];
};

if (!isNull _nearestTown) then {
    _locationData set ["nearestTown", [text _nearestTown, _centerPos distance _nearestTown]];
};

// Slope at center
private _slope = [_centerPos select 0, _centerPos select 1] call BIS_fnc_terrainGradAngle;
_locationData set ["slope", _slope];

_terrainData set ["centerLocation", _locationData];

// ============================================================
// SURROUNDING TERRAIN (8 directions)
// ============================================================

private _surroundings = [];
private _directions = [0, 45, 90, 135, 180, 225, 270, 315];
private _directionNames = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

{
    private _angle = _x;
    private _dirName = _directionNames select _forEachIndex;
    private _checkPos = [_centerPos, 500, _angle] call BIS_fnc_relPos;
    
    private _dirData = createHashMap;
    _dirData set ["direction", _dirName];
    _dirData set ["angle", _angle];
    
    // Terrain type
    _dirData set ["surfaceType", surfaceType _checkPos];
    _dirData set ["inWater", surfaceIsWater _checkPos];
    
    // Roads
    private _roads = _checkPos nearRoads 100;
    _dirData set ["roadCount", count _roads];
    _dirData set ["hasRoads", count _roads > 0];
    
    // Buildings
    private _buildings = nearestObjects [_checkPos, ["House", "Building"], 100];
    _dirData set ["buildingCount", count _buildings];
    
    // Concealment rating
    private _concealment = "none";
    if (count _buildings > 5) then {_concealment = "high"};  // Urban
    if (_dirData get "surfaceType" find "forest" >= 0) then {_concealment = "high"};
    if (_dirData get "surfaceType" find "grass" >= 0 && count _buildings > 0) then {_concealment = "moderate"};
    _dirData set ["concealment", _concealment];
    
    _surroundings pushBack _dirData;
} forEach _directions;

_terrainData set ["surroundings", _surroundings];

// ============================================================
// VALID SPAWN ZONES (ALiVE-inspired)
// ============================================================

private _infantrySpawns = [];
private _vehicleSpawns = [];
private _aircraftSpawns = [];

// Generate spawn zones in 8 directions
{
    private _angle = _x;
    private _dirName = _directionNames select _forEachIndex;
    private _minDist = 250;
    private _maxDist = 600;
    
    // INFANTRY SPAWN ZONE
    private _infantryPos = [_centerPos, _minDist, _maxDist, 5, 0, 0.3, 0] call BIS_fnc_findSafePos;
    
    if (count _infantryPos > 0) then {
        private _spawnData = createHashMap;
        _spawnData set ["position", _infantryPos];
        _spawnData set ["distance", _centerPos distance _infantryPos];
        _spawnData set ["direction", _dirName];
        _spawnData set ["angle", _angle];
        
        // Analyze terrain at spawn
        private _spawnSurface = surfaceType _infantryPos;
        _spawnData set ["terrain", _spawnSurface];
        
        // Check concealment
        private _nearBuildings = nearestObjects [_infantryPos, ["House"], 50];
        private _concealment = "low";
        if (count _nearBuildings > 3) then {_concealment = "high"};
        if (_spawnSurface find "forest" >= 0) then {_concealment = "high"};
        if (_spawnSurface find "grass" >= 0) then {_concealment = "moderate"};
        _spawnData set ["concealment", _concealment];
        
        // Line of sight check
        private _hasLOS = [_infantryPos, "VIEW", player] checkVisibility [
            AGLToASL _infantryPos,
            getPosASL player
        ];
        _spawnData set ["visibleToPlayer", _hasLOS > 0.3];
        
        _infantrySpawns pushBack _spawnData;
    };
    
    // VEHICLE SPAWN ZONE (needs road access)
    private _vehicleMinDist = 400;
    private _vehicleMaxDist = 800;
    private _roadPos = [_centerPos, _vehicleMaxDist] call BIS_fnc_nearestRoad;
    
    if (!isNull _roadPos) then {
        private _roadPosATL = getPosATL _roadPos;
        
        // Check if far enough and right direction
        private _roadDist = _centerPos distance _roadPosATL;
        private _roadDir = _centerPos getDir _roadPosATL;
        private _angleDiff = abs (_roadDir - _angle);
        
        if (_roadDist >= _vehicleMinDist && _angleDiff < 60) then {
            private _vehData = createHashMap;
            _vehData set ["position", _roadPosATL];
            _vehData set ["distance", _roadDist];
            _vehData set ["direction", _dirName];
            _vehData set ["angle", _roadDir];
            _vehData set ["terrain", "road"];
            
            // Check slope (vehicles need flat terrain)
            private _slope = [_roadPosATL select 0, _roadPosATL select 1] call BIS_fnc_terrainGradAngle;
            _vehData set ["slope", _slope];
            _vehData set ["accessibleWheeled", _slope < 15];
            _vehData set ["accessibleTracked", _slope < 25];
            
            _vehicleSpawns pushBack _vehData;
        };
    };
    
    // AIRCRAFT SPAWN ZONE (altitude 50-100m)
    if (_forEachIndex < 4) then {  // Only 4 zones for aircraft
        private _aircraftPos = [_centerPos, 500, 1000, 10, 0, 0.1, 0] call BIS_fnc_findSafePos;
        
        if (count _aircraftPos > 0) then {
            _aircraftPos set [2, 75];  // Set altitude to 75m
            
            private _airData = createHashMap;
            _airData set ["position", _aircraftPos];
            _airData set ["distance", _centerPos distance _aircraftPos];
            _airData set ["direction", _dirName];
            _airData set ["angle", _angle];
            _airData set ["altitude", 75];
            
            _aircraftSpawns pushBack _airData;
        };
    };
    
} forEach _directions;

_terrainData set ["validInfantrySpawns", _infantrySpawns];
_terrainData set ["validVehicleSpawns", _vehicleSpawns];
_terrainData set ["validAircraftSpawns", _aircraftSpawns];

// ============================================================
// TACTICAL ANALYSIS
// ============================================================

private _tactical = createHashMap;

// Count total roads in area
private _allRoads = _centerPos nearRoads _scanRadius;
_tactical set ["totalRoads", count _allRoads];

// Count buildings
private _allBuildings = nearestObjects [_centerPos, ["House", "Building"], _scanRadius];
_tactical set ["totalBuildings", count _allBuildings];

// Identify terrain type
private _terrainType = "open";
if (count _allBuildings > 20) then {_terrainType = "urban"};
if (_surface find "forest" >= 0 || count _allBuildings < 5) then {_terrainType = "rural"};
if (_slope > 15) then {_terrainType = "mountainous"};
_tactical set ["overallTerrain", _terrainType];

// Cover availability
private _coverRating = "low";
if (count _allBuildings > 10 || count _allRoads > 5) then {_coverRating = "moderate"};
if (count _allBuildings > 30) then {_coverRating = "high"};
_tactical set ["coverAvailable", _coverRating];

_terrainData set ["tacticalSummary", _tactical];

// ============================================================
// RETURN TERRAIN DATA
// ============================================================

_terrainData
