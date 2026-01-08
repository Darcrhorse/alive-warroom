# Arma 3 Terrain Awareness System

## Overview
Provides LLM with "eyes on the battlefield" - terrain awareness including roads, buildings, water, elevation, and valid spawn locations to prevent invalid placements (like tanks on roofs).

## Terrain Data Structure

### Map Metadata
```json
{
  "mapName": "Altis",
  "size": [30720, 30720],
  "origin": [0, 0],
  "gridSquareSize": 1000,
  "realWorldBasis": "Lemnos, Greece (0.75x scale)",
  "terrainTypes": ["urban", "forest", "hills", "coast", "plains"]
}
```

### Major Maps

#### Altis
- **Size**: 30.72 km × 30.72 km (944 km²)
- **Grid**: 0-30720 meters on both axes
- **Features**: Large towns, military bases, airport, seaports, mountains
- **Key Locations**:
  - Kavala (NE): [26000, 21000] - Major city with port
  - Pyrgos (SW): [16800, 12600] - Town with airfield
  - Salt Lake (center): [14300, 16400] - Large flat area
  - Military base: [23300, 25900] - North coast

#### Stratis
- **Size**: 8.192 km × 8.192 km (67 km²)
- **Grid**: 0-8192 meters on both axes
- **Features**: Airfield, military bases, small towns
- **Key Locations**:
  - Airfield: [2200, 5800]
  - Main base: [1800, 5900]
  - Town: [4100, 6200]

#### Malden
- **Size**: 6 km × 6 km (36 km²)
- **Grid**: 0-6000 meters on both axes
- **Features**: Rural terrain, small towns, airfield

## Terrain Analysis Functions

### SQF Terrain Queries

```sqf
// Find nearby roads
_roads = player nearRoads 500;  // Returns array of road objects within 500m

// Check if on road
_onRoad = isOnRoad player;  // Returns boolean

// Get surface type
_surface = surfaceType (getPosATL player);  // Returns string: "#road", "grass", etc.

// Find nearest road
_nearestRoad = [getPosATL player, 500] call BIS_fnc_nearestRoad;

// Get building positions
_building = nearestBuilding player;
_positions = _building buildingPos -1;  // -1 returns all positions

// Check terrain height
_elevation = getTerrainHeightASL [x, y];

// Find safe position
_safePos = [center, minDist, maxDist, objDist, waterMode, maxGrad, shoreMode] call BIS_fnc_findSafePos;
```

### Terrain Feature Detection

```sqf
// Check if position is in water
_inWater = surfaceIsWater [x, y];

// Get slope at position
_slope = [x, y] call BIS_fnc_terrainGradAngle;

// Find nearest location (town, hill, etc.)
_location = nearestLocation [player, "NameCityCapital"];

// Check line of sight
_canSee = [unit1, "VIEW", unit2] checkVisibility [getPosASL unit1, getPosASL unit2];
```

## Spawn Location Validation

### Invalid Spawn Locations
- **Water bodies** (unless spawning boats/divers)
- **Steep slopes** (>30 degrees for vehicles, >45 for infantry)
- **Building rooftops** (unless intentional overwatch)
- **Inside solid objects** (rocks, walls)
- **Too close to players** (<200m infantry, <300m vehicles)

### Valid Spawn Zones by Type

#### Infantry
- **Preferred**: Flat ground, near cover, forest edges
- **Acceptable**: Roads, building positions, moderate slopes (<30°)
- **Avoid**: Water, steep terrain, open areas near players

#### Vehicles (Wheeled)
- **Preferred**: Roads, flat terrain, parking areas
- **Acceptable**: Dirt roads, gentle slopes (<15°)
- **Avoid**: Steep terrain, forest, water, buildings

#### Vehicles (Tracked)
- **Preferred**: Roads, flat/moderate terrain
- **Acceptable**: Moderate slopes (<25°), off-road
- **Avoid**: Steep terrain (>30°), dense forest, water

#### Aircraft
- **Spawn**: Flat areas, helipads, airfields
- **Initial altitude**: 50-100m AGL
- **Special mode**: "FLY" parameter

## Terrain Context for LLM

### Context Template
```json
{
  "terrain": {
    "mapName": "Altis",
    "playerLocation": {
      "position": [15000, 20000, 25],
      "grid": "150200",
      "nearestTown": "Pyrgos (2.1km SW)",
      "nearestRoad": "Main highway (150m E)",
      "terrain": "urban outskirts",
      "elevation": "25m ASL",
      "cover": "moderate (buildings nearby)"
    },
    "surroundings": {
      "north": {"distance": 500, "type": "forest", "cover": "high"},
      "east": {"distance": 150, "type": "road", "cover": "none"},
      "south": {"distance": 800, "type": "open field", "cover": "low"},
      "west": {"distance": 300, "type": "hills", "cover": "moderate"}
    },
    "spawnZones": {
      "infantry": [
        {"position": [15300, 20400], "distance": 400, "direction": "NE", "terrain": "forest", "concealment": "high"},
        {"position": [14700, 19700], "distance": 400, "direction": "SW", "terrain": "buildings", "concealment": "moderate"}
      ],
      "vehicles": [
        {"position": [15150, 20500], "distance": 500, "direction": "NE", "terrain": "road", "accessible": true},
        {"position": [14500, 19500], "distance": 700, "direction": "SW", "terrain": "dirt road", "accessible": true}
      ]
    }
  }
}
```

## ALiVE-Inspired Placement System

### Automatic Terrain Scanning

Based on ALiVE mod's approach:

1. **Pre-scan map locations**:
   - Military objectives (bases, airports)
   - Civilian locations (towns, villages)
   - Strategic points (hills, crossroads)
   - Tactical positions (overwatch, chokepoints)

2. **Classify spawn zones**:
   - Priority: High-value objectives
   - Type: Infantry/Vehicle/Mixed
   - Accessibility: Road access, terrain type
   - Concealment: Cover availability

3. **Dynamic placement**:
   - Virtual profiles until player proximity
   - Spawn at logical tactical positions
   - Avoid impossible locations

### Terrain Analysis Logic

```sqf
// ALiVE-style safe spawn position finder
LLMGM_fnc_findValidSpawnPos = {
    params ["_centerPos", "_minDist", "_maxDist", "_unitType"];
    
    private _attempts = 0;
    private _maxAttempts = 20;
    private _validPos = [];
    
    while {_attempts < _maxAttempts && count _validPos == 0} do {
        _attempts = _attempts + 1;
        
        // Get candidate position
        private _testPos = [_centerPos, _minDist, _maxDist, 5, 0, 0.3, 0] call BIS_fnc_findSafePos;
        
        // Validate based on unit type
        private _isValid = true;
        
        // Check not in water (unless boat)
        if (_unitType != "boat" && surfaceIsWater _testPos) then {
            _isValid = false;
        };
        
        // Check slope for vehicles
        if (_unitType in ["vehicle_wheeled", "vehicle_tracked"]) then {
            private _slope = [_testPos select 0, _testPos select 1] call BIS_fnc_terrainGradAngle;
            if (_slope > 15 && _unitType == "vehicle_wheeled") then {_isValid = false};
            if (_slope > 25 && _unitType == "vehicle_tracked") then {_isValid = false};
        };
        
        // Check line of sight to player
        private _hasLOS = [_testPos, "VIEW", player] checkVisibility [
            AGLToASL _testPos,
            getPosASL player
        ];
        if (_hasLOS > 0.5) then {_isValid = false};  // Too visible
        
        if (_isValid) then {
            _validPos = _testPos;
        };
    };
    
    _validPos
};
```

## Enhanced Game State with Terrain

### Terrain Context Collection

```sqf
LLMGM_fnc_collectTerrainContext = {
    params ["_playerPos"];
    
    private _terrainData = createHashMap;
    
    // Basic info
    _terrainData set ["mapName", worldName];
    _terrainData set ["mapSize", worldSize];
    
    // Player location analysis
    private _elevation = getTerrainHeightASL _playerPos;
    private _surface = surfaceType _playerPos;
    private _inWater = surfaceIsWater _playerPos;
    private _nearestRoad = [_playerPos, 200] call BIS_fnc_nearestRoad;
    
    _terrainData set ["playerElevation", _elevation];
    _terrainData set ["surfaceType", _surface];
    _terrainData set ["inWater", _inWater];
    _terrainData set ["nearRoad", !isNull _nearestRoad];
    
    // Nearest location
    private _nearestTown = nearestLocation [_playerPos, "NameCityCapital"];
    if (!isNull _nearestTown) then {
        _terrainData set ["nearestTown", [
            text _nearestTown,
            _playerPos distance _nearestTown
        ]];
    };
    
    // Surrounding terrain (4 directions)
    private _directions = [0, 90, 180, 270];
    private _surroundings = [];
    {
        private _checkPos = [_playerPos, 500, _x] call BIS_fnc_relPos;
        private _terrain = surfaceType _checkPos;
        private _roads = _checkPos nearRoads 100;
        private _buildings = nearestObjects [_checkPos, ["House"], 100];
        
        _surroundings pushBack [
            ["direction", _x],
            ["terrain", _terrain],
            ["hasRoads", count _roads > 0],
            ["buildings", count _buildings]
        ];
    } forEach _directions;
    
    _terrainData set ["surroundings", _surroundings];
    
    // Find valid spawn zones
    private _infantryZones = [];
    private _vehicleZones = [];
    
    for "_i" from 0 to 3 do {
        private _angle = _i * 90;
        private _distance = 300 + (random 200);
        
        // Infantry spawn
        private _infantryPos = [[_playerPos, _distance, _distance + 200, 5, 0, 0.3, 0] call BIS_fnc_findSafePos, _distance, _angle];
        _infantryZones pushBack _infantryPos;
        
        // Vehicle spawn (needs road access)
        private _roadPos = [_playerPos, _distance + 200] call BIS_fnc_nearestRoad;
        if (!isNull _roadPos) then {
            _vehicleZones pushBack [getPosATL _roadPos, _distance + 200, _angle];
        };
    };
    
    _terrainData set ["validInfantrySpawns", _infantryZones];
    _terrainData set ["validVehicleSpawns", _vehicleZones];
    
    _terrainData
};
```

## LLM System Prompt Enhancement

### Terrain Awareness Instructions

```markdown
## Terrain Awareness

You have detailed terrain information:
- Map name and size
- Player location with grid reference
- Surrounding terrain types (forest, road, urban, water)
- Elevation and slope information
- Valid spawn zones pre-calculated

### Spawn Rules Based on Terrain

1. **Infantry**: Use validInfantrySpawns positions
   - Forest: High concealment, good for ambush
   - Urban: Building positions available
   - Hills: Overwatch positions
   - Roads: Quick deployment but exposed

2. **Vehicles**: Use validVehicleSpawns positions
   - MUST spawn near roads
   - Check slope <15° for wheeled, <25° for tracked
   - Never spawn in forest or water
   - Need flat terrain for deployment

3. **Aircraft**: 
   - Spawn at altitude (50-100m AGL)
   - Use "FLY" special parameter
   - Clear of terrain/buildings

### Example with Terrain Context

**Context**: Player at Pyrgos (urban), forest 500m north, road 150m east

**Good Decision**:
```sqf
// Spawn in forest (concealment) with patrol to town
private _forestPos = [15300, 20400, 0];  // Pre-validated spawn zone
private _group = [_forestPos, EAST, ["O_Soldier_F"]] call BIS_fnc_spawnGroup;
[_group, _forestPos, 200] call BIS_fnc_taskPatrol;
```

**Bad Decision**: ❌ 
```sqf
// WRONG: Spawning on building roof
private _building = nearestBuilding player;
private _roofPos = _building buildingPos 10;  // Building position
private _tank = createVehicle ["O_MBT_02_cannon_F", _roofPos];  // Tank on roof!
```
```

## Map Data Resources

### Web-Based Maps
- **Arma3Map**: https://jetelain.github.io/Arma3Map/
- **iZurvive**: https://www.izurvive.com/altis/
- **PLANOPS Atlas**: https://maps.a3wc.dev/maps/arma3/altis

### Official Maps
- **Bohemia PDF**: https://cdn.cloudflare.steamstatic.com/steam/apps/107410/manuals/Arma_3_map_ENG.pdf

## Implementation in Bridge Server

### Terrain Data Service

```typescript
interface TerrainContext {
  mapName: string;
  mapSize: [number, number];
  playerLocation: {
    position: [number, number, number];
    gridRef: string;
    elevation: number;
    surfaceType: string;
    nearRoad: boolean;
    nearestTown?: {name: string; distance: number};
  };
  surroundings: {
    [direction: string]: {
      terrain: string;
      cover: 'none' | 'low' | 'moderate' | 'high';
      hasRoads: boolean;
      buildingCount: number;
    };
  };
  validSpawns: {
    infantry: Array<{position: [number, number], distance: number, direction: number, terrain: string}>;
    vehicles: Array<{position: [number, number], distance: number, direction: number, accessible: boolean}>;
  };
}
```

### Enhanced LLM Prompt

Include terrain context in every LLM request:
```typescript
const systemPrompt = `${basePrompt}

Current Terrain Context:
- Map: ${terrain.mapName} (${terrain.mapSize[0]}m x ${terrain.mapSize[1]}m)
- Player at: ${terrain.playerLocation.gridRef} (${terrain.playerLocation.elevation}m elevation)
- Surface: ${terrain.playerLocation.surfaceType}
- Nearest town: ${terrain.playerLocation.nearestTown?.name} (${terrain.playerLocation.nearestTown?.distance}m)

Surroundings:
- North (500m): ${terrain.surroundings.north.terrain}, cover: ${terrain.surroundings.north.cover}
- East (500m): ${terrain.surroundings.east.terrain}, cover: ${terrain.surroundings.east.cover}
- South (500m): ${terrain.surroundings.south.terrain}, cover: ${terrain.surroundings.south.cover}
- West (500m): ${terrain.surroundings.west.terrain}, cover: ${terrain.surroundings.west.cover}

Valid Spawn Zones (pre-calculated):
Infantry: ${terrain.validSpawns.infantry.length} positions available
Vehicles: ${terrain.validSpawns.vehicles.length} positions available

Use these pre-validated positions for spawning!
`;
```

## Benefits

✅ **Prevents Invalid Spawns**: No tanks on roofs, boats on land, etc.
✅ **Tactical Realism**: Units spawn in logical positions
✅ **Performance**: Pre-calculated spawn zones
✅ **LLM-Friendly**: Clear context in natural language
✅ **ALiVE-Inspired**: Proven terrain analysis approach

## References

- ALiVE Mod: https://github.com/ALiVEOS/ALiVE.OS
- BI Wiki - nearRoads: https://community.bistudio.com/wiki/nearRoads
- BI Wiki - BIS_fnc_findSafePos: https://community.bistudio.com/wiki/BIS_fnc_findSafePos
- BI Wiki - BIS_fnc_nearestRoad: https://community.bistudio.com/wiki/BIS_fnc_nearestRoad
