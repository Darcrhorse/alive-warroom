/**
 * Tactical SQF Templates for AI Commanders
 * Query via MCP tools - keeps prompts lean
 */

export interface TacticalTemplate {
  name: string;
  description: string;
  parameters: string[];
  sqf: string;
  notes?: string;
}

// =============================================================================
// INFANTRY OPERATIONS
// =============================================================================

export const INFANTRY_TEMPLATES: Record<string, TacticalTemplate> = {
  spawn_infantry_squad: {
    name: "Spawn Infantry Squad",
    description: "Spawn a full infantry squad at position with optional waypoint",
    parameters: ["_spawnPos (Array)", "_side (EAST/WEST)", "_targetPos (Array, optional)"],
    sqf: `
// Spawn infantry squad
private _classes = if (_side == EAST) then {
  ['rhs_vdv_rifleman', 'rhs_vdv_rifleman', 'rhs_vdv_grenadier', 'rhs_vdv_machinegunner', 'rhs_vdv_marksman', 'rhs_vdv_medic', 'rhs_vdv_at', 'rhs_vdv_squadleader']
} else {
  ['rhsusf_army_ucp_rifleman', 'rhsusf_army_ucp_rifleman', 'rhsusf_army_ucp_grenadier', 'rhsusf_army_ucp_autorifleman', 'rhsusf_army_ucp_marksman', 'rhsusf_army_ucp_medic', 'rhsusf_army_ucp_javelin', 'rhsusf_army_ucp_squadleader']
};

private _group = [_spawnPos, _side, _classes] call BIS_fnc_spawnGroup;
_group setBehaviour 'AWARE';
_group setCombatMode 'RED';

// Optional: Add waypoint to target
if (!isNil '_targetPos') then {
  private _wp = _group addWaypoint [_targetPos, 50];
  _wp setWaypointType 'SAD';
  _wp setWaypointSpeed 'NORMAL';
};

// Return group for tracking
_group
`,
    notes: "Uses RHS units. Adjust classnames for other factions."
  },

  spawn_fireteam: {
    name: "Spawn Fireteam",
    description: "Spawn a 4-man fireteam for quick response",
    parameters: ["_spawnPos (Array)", "_side (EAST/WEST)"],
    sqf: `
private _classes = if (_side == EAST) then {
  ['rhs_vdv_rifleman', 'rhs_vdv_rifleman', 'rhs_vdv_grenadier', 'rhs_vdv_teamleader']
} else {
  ['rhsusf_army_ucp_rifleman', 'rhsusf_army_ucp_rifleman', 'rhsusf_army_ucp_grenadier', 'rhsusf_army_ucp_teamleader']
};

private _group = [_spawnPos, _side, _classes] call BIS_fnc_spawnGroup;
_group setBehaviour 'AWARE';
_group
`
  },

  spawn_sniper_team: {
    name: "Spawn Sniper Team",
    description: "Spawn a 2-man sniper/spotter team",
    parameters: ["_spawnPos (Array)", "_side (EAST/WEST)", "_overwatchPos (Array)"],
    sqf: `
private _classes = if (_side == EAST) then {
  ['rhs_vdv_marksman', 'rhs_vdv_rifleman']
} else {
  ['rhsusf_army_ucp_sniper', 'rhsusf_army_ucp_rifleman']
};

private _group = [_spawnPos, _side, _classes] call BIS_fnc_spawnGroup;
_group setBehaviour 'STEALTH';
_group setCombatMode 'GREEN';

// Move to overwatch position
private _wp = _group addWaypoint [_overwatchPos, 10];
_wp setWaypointType 'HOLD';
_wp setWaypointBehaviour 'STEALTH';

_group
`
  }
};

// =============================================================================
// HELICOPTER OPERATIONS
// =============================================================================

export const HELICOPTER_TEMPLATES: Record<string, TacticalTemplate> = {
  heli_insert_troops: {
    name: "Helicopter Troop Insert",
    description: "Full helicopter insertion: spawn heli, load troops, fly to LZ, unload, RTB",
    parameters: ["_fobPos (Array)", "_lzPos (Array)", "_side (EAST/WEST)", "_objectivePos (Array)"],
    sqf: `
// CRITICAL: Create invisible helipad at LZ for proper landing!
private _helipad = createVehicle ['Land_HelipadEmpty_F', _lzPos, [], 0, 'NONE'];

// Spawn transport helicopter using BIS_fnc_spawnVehicle (proper crew handling)
private _heliClass = if (_side == EAST) then {'RHS_Mi8mt_Cargo_vvsc'} else {'RHS_UH60M'};
private _heliData = [_fobPos, 0, _heliClass, _side] call BIS_fnc_spawnVehicle;
private _heli = _heliData select 0;
private _heliGrp = _heliData select 2;
_heli flyInHeight 80;

// Create infantry squad AT FOB POSITION
private _classes = if (_side == EAST) then {
  ['rhs_vdv_squadleader', 'rhs_vdv_rifleman', 'rhs_vdv_rifleman', 'rhs_vdv_grenadier', 'rhs_vdv_machinegunner', 'rhs_vdv_medic']
} else {
  ['rhsusf_army_ucp_squadleader', 'rhsusf_army_ucp_rifleman', 'rhsusf_army_ucp_rifleman', 'rhsusf_army_ucp_grenadier', 'rhsusf_army_ucp_autorifleman', 'rhsusf_army_ucp_medic']
};

private _squad = [_fobPos, _side, _classes] call BIS_fnc_spawnGroup;

// CRITICAL: BOTH assignAsCargo AND moveInCargo needed!
{
  _x assignAsCargo _heli;
  _x moveInCargo _heli;
} forEach units _squad;

systemChat format ['LOADED: %1 soldiers aboard transport helicopter!', count units _squad];

// Heli waypoint to LZ with UNLOAD type and LAND command
private _wpLZ = _heliGrp addWaypoint [_lzPos, 0];
_wpLZ setWaypointType 'UNLOAD';
_wpLZ setWaypointSpeed 'FULL';
_wpLZ setWaypointBehaviour 'CARELESS';
_wpLZ setWaypointStatements ['true', '(vehicle this) land ''GET OUT'''];

// Tell troops to leave when arrived
[_squad, _heli, _lzPos, _objectivePos] spawn {
  params ['_squad', '_heli', '_lzPos', '_objectivePos'];
  waitUntil {sleep 1; (_heli distance2D _lzPos) < 100};
  _squad leaveVehicle _heli;
  waitUntil {sleep 1; {_x in _heli} count units _squad == 0};
  // Assault objective after disembark
  private _wpAssault = _squad addWaypoint [_objectivePos, 50];
  _wpAssault setWaypointType 'SAD';
  _wpAssault setWaypointBehaviour 'AWARE';
  [_squad, _objectivePos] call lambs_wp_fnc_taskAssault;
};

// RTB waypoint
private _wpRTB = _heliGrp addWaypoint [_fobPos, 50];
_wpRTB setWaypointType 'MOVE';
_wpRTB setWaypointStatements ['true', '(vehicle this) land ''LAND'''];

// Radio callout
private _sideName = if (_side == EAST) then {'OPFOR'} else {'BLUFOR'};
[format ['%1 Actual: Heli insertion with %2 troops inbound to LZ!', _sideName, count units _squad]] remoteExec ['systemChat', 0];

// Return references
[_heli, _squad, _helipad]
`,
    notes: "Creates helipad at LZ, uses UNLOAD waypoint with LAND command. Spawned thread handles disembark and assault."
  },

  heli_extract_troops: {
    name: "Helicopter Extraction",
    description: "Extract troops from position and RTB",
    parameters: ["_fobPos (Array)", "_extractPos (Array)", "_side (EAST/WEST)", "_group (Group)"],
    sqf: `
// Spawn extraction helicopter
private _heliClass = if (_side == EAST) then {'RHS_Mi8mt_Cargo_vvsc'} else {'RHS_UH60M'};
private _heli = createVehicle [_heliClass, _fobPos, [], 0, 'FLY'];
createVehicleCrew _heli;
_heli flyInHeight 50;

private _heliGrp = group driver _heli;

// Fly to extraction point
private _wpPickup = _heliGrp addWaypoint [_extractPos, 30];
_wpPickup setWaypointType 'TR UNLOAD';
_wpPickup setWaypointBehaviour 'CARELESS';
_wpPickup setWaypointStatements ['true', 'vehicle this land ''LAND'''];

// Order troops to board
{_x assignAsCargo _heli; _x orderGetIn true} forEach units _group;

// RTB after pickup (delayed)
[_heliGrp, _fobPos, _heli] spawn {
  params ['_heliGrp', '_fobPos', '_heli'];
  sleep 60; // Wait for boarding
  private _wpRTB = _heliGrp addWaypoint [_fobPos, 50];
  _wpRTB setWaypointType 'MOVE';
  _wpRTB setWaypointStatements ['true', 'vehicle this land ''LAND'''];
};

_heli
`
  },

  load_existing_heli: {
    name: "Load Troops into Existing Helicopter",
    description: "Find existing helicopter, spawn troops at its location, load them, fly to LZ",
    parameters: ["_heliSearch (Array - position to search)", "_lzPos (Array)", "_objectivePos (Array)", "_side (EAST/WEST)"],
    sqf: `
// Find nearest empty transport helicopter
private _heliTypes = ['RHS_Mi8mt_Cargo_vvsc', 'RHS_UH60M', 'B_Heli_Transport_01_F', 'O_Heli_Transport_04_F', 'I_Heli_Transport_02_F'];
private _nearHelis = _heliSearch nearEntities ['Helicopter', 500];
private _heli = objNull;

{
  if (alive _x && {canMove _x} && {count crew _x > 0} && {(_x emptyPositions 'cargo') > 3}) exitWith {
    _heli = _x;
  };
} forEach _nearHelis;

if (isNull _heli) exitWith {
  ['No available transport helicopter found nearby!'] remoteExec ['systemChat', 0];
};

// Spawn infantry squad AT THE HELICOPTER POSITION
private _heliPos = getPosATL _heli;
private _classes = if (_side == EAST) then {
  ['rhs_vdv_rifleman', 'rhs_vdv_rifleman', 'rhs_vdv_grenadier', 'rhs_vdv_machinegunner', 'rhs_vdv_medic', 'rhs_vdv_at', 'rhs_vdv_squadleader']
} else {
  ['rhsusf_army_ucp_rifleman', 'rhsusf_army_ucp_rifleman', 'rhsusf_army_ucp_grenadier', 'rhsusf_army_ucp_autorifleman', 'rhsusf_army_ucp_medic', 'rhsusf_army_ucp_javelin', 'rhsusf_army_ucp_squadleader']
};

private _squad = [_heliPos, _side, _classes] call BIS_fnc_spawnGroup;

// LOAD TROOPS INTO HELICOPTER
{_x moveInCargo _heli} forEach units _squad;

// Clear existing waypoints
private _heliGrp = group driver _heli;
while {count waypoints _heliGrp > 0} do {
  deleteWaypoint [_heliGrp, 0];
};

// Fly to LZ and unload
_heli flyInHeight 80;
private _wpLZ = _heliGrp addWaypoint [_lzPos, 30];
_wpLZ setWaypointType 'TR UNLOAD';
_wpLZ setWaypointBehaviour 'CARELESS';
_wpLZ setWaypointSpeed 'FULL';

// RTB waypoint
private _fobPos = if (_side == EAST) then {LLMGM_eastFobPos} else {LLMGM_westFobPos};
private _wpRTB = _heliGrp addWaypoint [_fobPos, 50];
_wpRTB setWaypointType 'MOVE';
_wpRTB setWaypointStatements ['true', 'vehicle this land ''LAND'''];

// Infantry assault waypoint after unload
private _wpAssault = _squad addWaypoint [_objectivePos, 50];
_wpAssault setWaypointType 'SAD';
_wpAssault setWaypointBehaviour 'AWARE';

// Radio callout
private _sideName = if (_side == EAST) then {'OPFOR'} else {'BLUFOR'};
[format ['%1 Actual: Troops loaded! Heli en route to LZ with %2 soldiers aboard', _sideName, count units _squad]] remoteExec ['systemChat', 0];

[_heli, _squad]
`,
    notes: "Use when helicopters already exist and need to be loaded. Searches 500m radius for transport helis."
  },

  spawn_cas_helicopter: {
    name: "Spawn CAS Helicopter",
    description: "Spawn attack helicopter for close air support",
    parameters: ["_fobPos (Array)", "_targetPos (Array)", "_side (EAST/WEST)"],
    sqf: `
// Spawn attack helicopter
private _heliClass = if (_side == EAST) then {'RHS_Mi24V_vvsc'} else {'RHS_AH64D_wd'};
private _heli = createVehicle [_heliClass, _fobPos, [], 0, 'FLY'];
createVehicleCrew _heli;
_heli flyInHeight 100;

private _heliGrp = group driver _heli;
_heliGrp setBehaviour 'COMBAT';
_heliGrp setCombatMode 'RED';

// SAD waypoint at target
private _wpSAD = _heliGrp addWaypoint [_targetPos, 200];
_wpSAD setWaypointType 'SAD';
_wpSAD setWaypointLoiterType 'CIRCLE';
_wpSAD setWaypointLoiterRadius 300;

// RTB waypoint
private _wpRTB = _heliGrp addWaypoint [_fobPos, 50];
_wpRTB setWaypointType 'MOVE';

private _sideName = if (_side == EAST) then {'OPFOR'} else {'BLUFOR'};
[format ['%1 Air: Attack helicopter en route to target area', _sideName]] remoteExec ['systemChat', 0];

_heli
`
  }
};

// =============================================================================
// VEHICLE OPERATIONS
// =============================================================================

export const VEHICLE_TEMPLATES: Record<string, TacticalTemplate> = {
  spawn_apc_with_dismounts: {
    name: "APC with Dismount Squad",
    description: "Spawn APC with crew and infantry dismounts - proper loading for TR UNLOAD",
    parameters: ["_spawnPos (Array)", "_dismountPos (Array)", "_objectivePos (Array)", "_side (EAST/WEST)"],
    sqf: `
// Spawn APC using BIS_fnc_spawnVehicle for proper crew
private _apcClass = if (_side == EAST) then {'rhs_btr80a_vv'} else {'rhsusf_m113_usarmy_wd'};
private _apcData = [_spawnPos, 0, _apcClass, _side] call BIS_fnc_spawnVehicle;
private _apc = _apcData select 0;
private _apcGrp = _apcData select 2;

// Create dismount squad at APC position
private _classes = if (_side == EAST) then {
  ['rhs_vdv_teamleader', 'rhs_vdv_rifleman', 'rhs_vdv_rifleman', 'rhs_vdv_grenadier', 'rhs_vdv_at']
} else {
  ['rhsusf_army_ucp_teamleader', 'rhsusf_army_ucp_rifleman', 'rhsusf_army_ucp_rifleman', 'rhsusf_army_ucp_grenadier', 'rhsusf_army_ucp_javelin']
};

private _dismounts = [_spawnPos, _side, _classes] call BIS_fnc_spawnGroup;
// CRITICAL: BOTH assignAsCargo AND moveInCargo for proper unload!
{
  _x assignAsCargo _apc;
  _x moveInCargo _apc;
} forEach units _dismounts;

systemChat format ['APC loaded with %1 dismounts', count units _dismounts];

// APC drives to dismount point
private _apcGrp = group driver _apc;
private _wp1 = _apcGrp addWaypoint [_dismountPos, 30];
_wp1 setWaypointType 'TR UNLOAD';
_wp1 setWaypointSpeed 'NORMAL';

// Dismounts assault using LAMBS
[_dismounts, _objectivePos] call lambs_wp_fnc_taskAssault;

// APC provides overwatch
private _wp2 = _apcGrp addWaypoint [_dismountPos vectorAdd [50, 50, 0], 20];
_wp2 setWaypointType 'HOLD';

[_apc, _dismounts]
`,
    notes: "Uses LAMBS for smart assault behavior after dismount."
  },

  spawn_tank: {
    name: "Spawn Main Battle Tank",
    description: "Spawn tank with crew",
    parameters: ["_spawnPos (Array)", "_targetPos (Array)", "_side (EAST/WEST)"],
    sqf: `
private _tankClass = if (_side == EAST) then {'rhs_t72ba_tv'} else {'rhsusf_m1a2sep1wd_usarmy'};
private _tank = createVehicle [_tankClass, _spawnPos, [], 0, 'NONE'];
createVehicleCrew _tank;

private _tankGrp = group commander _tank;
_tankGrp setBehaviour 'COMBAT';
_tankGrp setCombatMode 'RED';

private _wp = _tankGrp addWaypoint [_targetPos, 100];
_wp setWaypointType 'SAD';

_tank
`
  },

  convoy_movement: {
    name: "Convoy Movement",
    description: "Create multi-vehicle convoy moving to destination",
    parameters: ["_spawnPos (Array)", "_destPos (Array)", "_side (EAST/WEST)", "_vehicleCount (Number)"],
    sqf: `
private _vehicles = [];
private _vehClasses = if (_side == EAST) then {
  ['rhs_tigr_sts_vmf', 'rhs_kamaz5350_vmf', 'rhs_btr80_vmf']
} else {
  ['rhsusf_m1025_w', 'rhsusf_M1078A1P2_wd', 'rhsusf_m113_usarmy_wd']
};

// Spawn vehicles in column
for '_i' from 0 to (_vehicleCount - 1) do {
  private _offset = _i * 30;
  private _vehPos = _spawnPos vectorAdd [0, -_offset, 0];
  private _veh = createVehicle [selectRandom _vehClasses, _vehPos, [], 0, 'NONE'];
  createVehicleCrew _veh;
  _vehicles pushBack _veh;
};

// Lead vehicle gets waypoint, others follow
private _leadGrp = group driver (_vehicles select 0);
private _wp = _leadGrp addWaypoint [_destPos, 50];
_wp setWaypointType 'MOVE';
_wp setWaypointSpeed 'LIMITED';
_wp setWaypointFormation 'COLUMN';

// Other vehicles join lead group
{
  (units group driver _x) joinSilent _leadGrp;
} forEach (_vehicles select [1, count _vehicles]);

_vehicles
`
  }
};

// =============================================================================
// LOGISTICS & SUPPLY
// =============================================================================

export const LOGISTICS_TEMPLATES: Record<string, TacticalTemplate> = {
  spawn_troop_transport_truck: {
    name: "Troop Transport Truck",
    description: "Spawn truck with infantry, drive to destination, unload",
    parameters: ["_fobPos (Array)", "_destPos (Array)", "_objectivePos (Array)", "_side (EAST/WEST)"],
    sqf: `
// Spawn transport truck
private _truckClass = if (_side == EAST) then {'rhs_kamaz5350_vmf'} else {'rhsusf_M1078A1P2_wd'};
private _truckData = [_fobPos, 0, _truckClass, _side] call BIS_fnc_spawnVehicle;
private _truck = _truckData select 0;
private _truckGrp = _truckData select 2;

// Spawn infantry squad and LOAD into truck
private _classes = if (_side == EAST) then {
  ['rhs_vdv_squadleader', 'rhs_vdv_rifleman', 'rhs_vdv_rifleman', 'rhs_vdv_grenadier', 'rhs_vdv_machinegunner', 'rhs_vdv_medic']
} else {
  ['rhsusf_army_ucp_squadleader', 'rhsusf_army_ucp_rifleman', 'rhsusf_army_ucp_rifleman', 'rhsusf_army_ucp_grenadier', 'rhsusf_army_ucp_autorifleman', 'rhsusf_army_ucp_medic']
};

private _squad = [_fobPos, _side, _classes] call BIS_fnc_spawnGroup;

// CRITICAL: Load troops properly
{
  _x assignAsCargo _truck;
  _x moveInCargo _truck;
} forEach units _squad;

systemChat format ['TRANSPORT: %1 troops loaded into truck', count units _squad];

// Drive to destination with UNLOAD waypoint
private _wpDest = _truckGrp addWaypoint [_destPos, 20];
_wpDest setWaypointType 'UNLOAD';
_wpDest setWaypointSpeed 'NORMAL';
_wpDest setWaypointStatements ['true', '(vehicle this) setFuel 0.9'];

// Handle troop disembark and assault
[_squad, _truck, _destPos, _objectivePos] spawn {
  params ['_squad', '_truck', '_destPos', '_objectivePos'];
  waitUntil {sleep 1; (_truck distance2D _destPos) < 50};
  _squad leaveVehicle _truck;
  waitUntil {sleep 1; {_x in _truck} count units _squad == 0};
  sleep 2;
  [_squad, _objectivePos] call lambs_wp_fnc_taskAssault;
};

// RTB
private _wpRTB = _truckGrp addWaypoint [_fobPos, 30];
_wpRTB setWaypointType 'MOVE';

[_truck, _squad]
`,
    notes: "Proper troop transport - loads infantry, drives to dest, unloads, assaults"
  },

  spawn_supply_truck: {
    name: "Supply Truck Run",
    description: "Spawn supply truck to resupply forward position and heal units",
    parameters: ["_fobPos (Array)", "_supplyPoint (Array)", "_side (EAST/WEST)"],
    sqf: `
private _truckClass = if (_side == EAST) then {'rhs_gaz66_ammo_vmf'} else {'rhsusf_M1078A1P2_B_M2_wd'};
private _truckData = [_fobPos, 0, _truckClass, _side] call BIS_fnc_spawnVehicle;
private _truck = _truckData select 0;
private _truckGrp = _truckData select 2;

// Drive to supply point
private _wp = _truckGrp addWaypoint [_supplyPoint, 20];
_wp setWaypointType 'MOVE';
_wp setWaypointSpeed 'LIMITED';

// Resupply action when arriving
[_truck, _supplyPoint] spawn {
  params ['_truck', '_supplyPoint'];
  waitUntil {sleep 2; (_truck distance2D _supplyPoint) < 50};
  // Heal nearby troops
  private _nearUnits = _supplyPoint nearEntities ['Man', 150];
  {
    _x setDamage ((damage _x) max 0) - 0.5;
    _x setFatigue 0;
  } forEach _nearUnits;
  // Create ammo crate
  private _crate = createVehicle ['Box_NATO_Ammo_F', _supplyPoint, [], 5, 'NONE'];
  systemChat format ['LOGISTICS: Supply point established - %1 units resupplied', count _nearUnits];
};

// RTB
private _wpRTB = _truckGrp addWaypoint [_fobPos, 30];
_wpRTB setWaypointType 'MOVE';

_truck
`
  },

  spawn_ammo_crate: {
    name: "Spawn Ammo Crate",
    description: "Create ammunition resupply crate at position",
    parameters: ["_pos (Array)", "_side (EAST/WEST)"],
    sqf: `
private _crateClass = if (_side == EAST) then {'rhs_7ya37_1_single'} else {'Box_NATO_Ammo_F'};
private _crate = createVehicle [_crateClass, _pos, [], 0, 'NONE'];

// Add basic supplies
clearMagazineCargoGlobal _crate;
clearWeaponCargoGlobal _crate;
clearItemCargoGlobal _crate;

_crate addMagazineCargoGlobal ['rhs_30Rnd_545x39_7N10_AK', 30];
_crate addMagazineCargoGlobal ['rhs_100Rnd_762x54mmR', 10];
_crate addMagazineCargoGlobal ['rhs_mag_rgd5', 20];
_crate addItemCargoGlobal ['FirstAidKit', 20];

_crate
`
  }
};

// =============================================================================
// GARRISON & DEFENSE
// =============================================================================

export const GARRISON_TEMPLATES: Record<string, TacticalTemplate> = {
  garrison_area: {
    name: "Garrison Area (LAMBS)",
    description: "Garrison buildings in area using LAMBS AI",
    parameters: ["_group (Group)", "_centerPos (Array)", "_radius (Number)"],
    sqf: `
// LAMBS garrison - AI will occupy buildings intelligently
[_group, _centerPos, _radius, nil, false, true] call lambs_wp_fnc_taskGarrison;

// Set defensive behavior
_group setBehaviour 'AWARE';
_group setCombatMode 'RED';
`,
    notes: "Requires LAMBS Danger mod. AI will automatically find and occupy buildings."
  },

  setup_defense_position: {
    name: "Setup Defense Position",
    description: "Create defensive position with static weapons",
    parameters: ["_centerPos (Array)", "_side (EAST/WEST)"],
    sqf: `
// Spawn static weapons
private _hmgClass = if (_side == EAST) then {'rhs_KORD_high_MSV'} else {'RHS_M2StaticMG_WD'};
private _positions = [
  _centerPos vectorAdd [20, 0, 0],
  _centerPos vectorAdd [-20, 0, 0],
  _centerPos vectorAdd [0, 20, 0]
];

private _group = createGroup _side;

{
  private _hmg = createVehicle [_hmgClass, _x, [], 0, 'NONE'];
  private _gunner = _group createUnit [
    if (_side == EAST) then {'rhs_vdv_rifleman'} else {'rhsusf_army_ucp_rifleman'},
    _x, [], 0, 'NONE'
  ];
  _gunner moveInGunner _hmg;
} forEach _positions;

_group setBehaviour 'COMBAT';
_group setCombatMode 'RED';

_group
`
  },

  spawn_mortar_team: {
    name: "Spawn Mortar Team",
    description: "Create mortar position with crew",
    parameters: ["_pos (Array)", "_side (EAST/WEST)"],
    sqf: `
private _mortarClass = if (_side == EAST) then {'rhs_2b14_82mm_msv'} else {'RHS_M252_WD'};
private _mortar = createVehicle [_mortarClass, _pos, [], 0, 'NONE'];

private _group = createGroup _side;
private _unitClass = if (_side == EAST) then {'rhs_vdv_rifleman'} else {'rhsusf_army_ucp_rifleman'};

private _gunner = _group createUnit [_unitClass, _pos, [], 0, 'NONE'];
private _loader = _group createUnit [_unitClass, _pos vectorAdd [2, 0, 0], [], 0, 'NONE'];

_gunner moveInGunner _mortar;

_group
`
  }
};

// =============================================================================
// ARTILLERY OPERATIONS
// =============================================================================

export const ARTILLERY_TEMPLATES: Record<string, TacticalTemplate> = {
  fire_mission: {
    name: "Fire Mission",
    description: "Call artillery fire mission on target position using doArtilleryFire",
    parameters: ["_targetPos (Array)", "_ammoClass (String)", "_rounds (Number)"],
    sqf: `
// Fire Mission Template
// _ammoClass options:
//   HE: 'rhs_mag_m1_he_12'
//   Smoke: 'rhs_mag_m60a2_smoke_4'
//   Illum: 'rhs_mag_m314_ilum_4'

private _artyUnits = allUnits select {
  (vehicle _x) isKindOf 'StaticMortar' ||
  (vehicle _x) isKindOf 'Artillery'
};

if (count _artyUnits > 0) then {
  private _arty = vehicle (_artyUnits select 0);
  _arty doArtilleryFire [_targetPos, _ammoClass, _rounds];
  systemChat format ['FIRE MISSION: %1 rounds on target', _rounds];
} else {
  systemChat 'FIRE MISSION FAILED: No artillery units available';
};
`,
    notes: "Uses native doArtilleryFire command. Requires artillery/mortar units in mission."
  },

  spawn_artillery_battery: {
    name: "Spawn Artillery Battery",
    description: "Create M119 howitzer with crew at position",
    parameters: ["_pos (Array)", "_side (EAST/WEST)"],
    sqf: `
private _artyClass = if (_side == EAST) then {'rhs_D30_msv'} else {'RHS_M119_WD'};
private _arty = createVehicle [_artyClass, _pos, [], 0, 'NONE'];

private _group = createGroup _side;
private _unitClass = if (_side == EAST) then {'rhs_vdv_rifleman'} else {'rhsusf_army_ucp_rifleman'};

private _gunner = _group createUnit [_unitClass, _pos, [], 0, 'NONE'];
private _loader = _group createUnit [_unitClass, _pos vectorAdd [2, 0, 0], [], 0, 'NONE'];

_gunner moveInGunner _arty;

_group
`,
    notes: "Creates M119 (WEST) or D30 (EAST) with two-man crew"
  }
};

// =============================================================================
// LAMBS AI BEHAVIORS
// =============================================================================

export const LAMBS_TEMPLATES: Record<string, TacticalTemplate> = {
  lambs_assault: {
    name: "LAMBS Assault",
    description: "Aggressive assault on position",
    parameters: ["_group (Group)", "_targetPos (Array)"],
    sqf: `[_group, _targetPos] call lambs_wp_fnc_taskAssault;`,
    notes: "Units rush aggressively, use cover, suppress enemies"
  },

  lambs_garrison: {
    name: "LAMBS Garrison",
    description: "Garrison buildings in area",
    parameters: ["_group (Group)", "_centerPos (Array)", "_radius (Number, default 100)"],
    sqf: `[_group, _centerPos, _radius, nil, false, true] call lambs_wp_fnc_taskGarrison;`,
    notes: "AI intelligently occupies buildings, sets up defensive positions"
  },

  lambs_hunt: {
    name: "LAMBS Hunt",
    description: "Search area for enemies",
    parameters: ["_group (Group)", "_searchCenter (Array)", "_radius (Number, default 200)"],
    sqf: `[_group, _searchCenter, _radius] call lambs_wp_fnc_taskHunt;`,
    notes: "AI methodically searches area, clears buildings"
  },

  lambs_cqb: {
    name: "LAMBS CQB",
    description: "Close quarters battle - clear buildings",
    parameters: ["_group (Group)", "_buildingPos (Array)"],
    sqf: `[_group, _buildingPos] call lambs_wp_fnc_taskCQB;`,
    notes: "AI stacks up, breaches, clears rooms"
  },

  lambs_patrol: {
    name: "LAMBS Patrol",
    description: "Patrol area with smart movement",
    parameters: ["_group (Group)", "_centerPos (Array)", "_radius (Number)"],
    sqf: `[_group, _centerPos, _radius] call lambs_wp_fnc_taskPatrol;`,
    notes: "More intelligent than vanilla patrol, uses cover"
  },

  lambs_creep: {
    name: "LAMBS Creep",
    description: "Slow tactical advance",
    parameters: ["_group (Group)", "_targetPos (Array)"],
    sqf: `[_group, _targetPos] call lambs_wp_fnc_taskCreep;`,
    notes: "Stealthy approach, engages when detected"
  },

  lambs_rush: {
    name: "LAMBS Rush",
    description: "Fast aggressive movement with suppression",
    parameters: ["_group (Group)", "_targetPos (Array)"],
    sqf: `[_group, _targetPos] call lambs_wp_fnc_taskRush;`,
    notes: "Bounding overwatch, suppressive fire"
  },

  lambs_camp: {
    name: "LAMBS Camp",
    description: "Hold defensive position",
    parameters: ["_group (Group)", "_pos (Array)"],
    sqf: `[_group, _pos] call lambs_wp_fnc_taskCamp;`,
    notes: "AI holds position, engages threats"
  }
};

// =============================================================================
// TASKS / OBJECTIVES
// =============================================================================

export const TASK_TEMPLATES: Record<string, TacticalTemplate> = {
  create_attack_task: {
    name: "Create Attack Task",
    description: "Create visible attack objective for side",
    parameters: ["_side (EAST/WEST)", "_targetPos (Array)", "_title (String)", "_description (String)"],
    sqf: `
private _taskId = format ['task_attack_%1', floor random 9999];
private _taskSide = if (_side == EAST) then {EAST} else {WEST};

[_taskSide, _taskId, [_description, _title, ''], _targetPos, 'ASSIGNED', 1, true, 'attack'] call BIS_fnc_taskCreate;

// Store task ID for tracking
if (isNil 'LLMGM_activeTasks') then {LLMGM_activeTasks = []};
LLMGM_activeTasks pushBack _taskId;

_taskId
`,
    notes: "Creates map marker and task visible to all units on that side"
  },

  create_defend_task: {
    name: "Create Defend Task",
    description: "Create visible defend objective",
    parameters: ["_side (EAST/WEST)", "_targetPos (Array)", "_title (String)", "_description (String)"],
    sqf: `
private _taskId = format ['task_defend_%1', floor random 9999];
private _taskSide = if (_side == EAST) then {EAST} else {WEST};

[_taskSide, _taskId, [_description, _title, ''], _targetPos, 'ASSIGNED', 1, true, 'defend'] call BIS_fnc_taskCreate;

if (isNil 'LLMGM_activeTasks') then {LLMGM_activeTasks = []};
LLMGM_activeTasks pushBack _taskId;

_taskId
`
  },

  create_recon_task: {
    name: "Create Recon Task",
    description: "Create reconnaissance objective",
    parameters: ["_side (EAST/WEST)", "_targetPos (Array)", "_title (String)", "_description (String)"],
    sqf: `
private _taskId = format ['task_recon_%1', floor random 9999];
private _taskSide = if (_side == EAST) then {EAST} else {WEST};

[_taskSide, _taskId, [_description, _title, ''], _targetPos, 'ASSIGNED', 1, true, 'scout'] call BIS_fnc_taskCreate;

if (isNil 'LLMGM_activeTasks') then {LLMGM_activeTasks = []};
LLMGM_activeTasks pushBack _taskId;

_taskId
`
  },

  complete_task: {
    name: "Complete Task",
    description: "Mark task as succeeded",
    parameters: ["_taskId (String)"],
    sqf: `
[_taskId, 'SUCCEEDED'] call BIS_fnc_taskSetState;
LLMGM_activeTasks = LLMGM_activeTasks - [_taskId];
`
  },

  fail_task: {
    name: "Fail Task",
    description: "Mark task as failed",
    parameters: ["_taskId (String)"],
    sqf: `
[_taskId, 'FAILED'] call BIS_fnc_taskSetState;
LLMGM_activeTasks = LLMGM_activeTasks - [_taskId];
`
  }
};

// =============================================================================
// USE EXISTING FORCES (DO NOT SPAWN NEW - USE WHAT'S ALREADY THERE)
// =============================================================================

export const EXISTING_FORCES_TEMPLATES: Record<string, TacticalTemplate> = {
  load_existing_into_vehicles: {
    name: "Load Existing Troops Into Existing Vehicles",
    description: "Find existing infantry at FOB, load them into existing vehicles, move to objective",
    parameters: ["_fobPos (Array)", "_objectivePos (Array)", "_side (EAST/WEST)"],
    sqf: `
// CRITICAL: Use EXISTING units - DO NOT spawn new ones!
private _sideEnum = if (_side == EAST) then {EAST} else {WEST};

// Find existing infantry near FOB (within 300m)
private _existingInfantry = _fobPos nearEntities ['Man', 300] select {
  side _x == _sideEnum &&
  isNull objectParent _x &&  // Not in vehicle
  alive _x
};

// Find existing vehicles near FOB
private _existingVehicles = _fobPos nearEntities [['Car', 'Tank', 'Helicopter', 'APC_Wheeled_F'], 500] select {
  alive _x &&
  canMove _x &&
  (count (fullCrew [_x, 'cargo', true] select {isNull (_x select 0)})) > 0  // Has empty cargo seats
};

if (count _existingInfantry == 0) exitWith {
  systemChat format ['[%1] No infantry found at FOB to load!', _side];
};

if (count _existingVehicles == 0) exitWith {
  systemChat format ['[%1] No vehicles with cargo space found at FOB!', _side];
};

systemChat format ['[%1] Loading %2 troops into %3 vehicles...', _side, count _existingInfantry, count _existingVehicles];

// Load troops into vehicles
private _loaded = 0;
{
  private _veh = _x;
  private _cargoSeats = count (fullCrew [_veh, 'cargo', true] select {isNull (_x select 0)});

  {
    if (_loaded < count _existingInfantry && _cargoSeats > 0) then {
      private _unit = _existingInfantry select _loaded;
      _unit assignAsCargo _veh;
      _unit moveInCargo _veh;
      _loaded = _loaded + 1;
      _cargoSeats = _cargoSeats - 1;
    };
  } forEach _existingInfantry;
} forEach _existingVehicles;

// Order loaded vehicles to move to objective
{
  private _veh = _x;
  if ((count crew _veh) > 0) then {
    private _grp = group (driver _veh);

    // Clear existing waypoints
    while {count waypoints _grp > 0} do {
      deleteWaypoint [_grp, 0];
    };

    // Add waypoint to objective
    private _wp = _grp addWaypoint [_objectivePos, 50];
    _wp setWaypointType 'TR UNLOAD';
    _wp setWaypointBehaviour 'AWARE';
    _wp setWaypointSpeed 'FULL';
  };
} forEach _existingVehicles;

systemChat format ['[%1] %2 troops loaded! Vehicles moving to objective!', _side, _loaded];
`,
    notes: "CRITICAL: This template uses EXISTING forces, does NOT spawn anything new!"
  },

  move_all_existing_to_objective: {
    name: "Move All Existing Units to Objective",
    description: "Order ALL existing friendly units to assault the objective",
    parameters: ["_fobPos (Array)", "_objectivePos (Array)", "_side (EAST/WEST)"],
    sqf: `
// Order ALL existing units to move to objective
private _sideEnum = if (_side == EAST) then {EAST} else {WEST};

// Get all friendly units
private _allFriendlyUnits = allUnits select {
  side _x == _sideEnum &&
  alive _x &&
  !isPlayer _x
};

private _processedGroups = [];

{
  private _grp = group _x;

  // Skip if already processed this group
  if (!(_grp in _processedGroups)) then {
    _processedGroups pushBack _grp;

    // Clear existing waypoints
    while {count waypoints _grp > 0} do {
      deleteWaypoint [_grp, 0];
    };

    // Use LAMBS assault if available, otherwise standard waypoint
    if (!isNil 'lambs_wp_fnc_taskAssault') then {
      [_grp, _objectivePos, 100] call lambs_wp_fnc_taskAssault;
    } else {
      private _wp = _grp addWaypoint [_objectivePos, 50];
      _wp setWaypointType 'SAD';
      _wp setWaypointBehaviour 'COMBAT';
      _wp setWaypointCombatMode 'RED';
    };
  };
} forEach _allFriendlyUnits;

systemChat format ['[%1] All %2 units ordered to assault objective!', _side, count _processedGroups];
`,
    notes: "Orders ALL existing units to attack. Does not spawn anything new."
  },

  use_existing_heli_transport: {
    name: "Use Existing Helicopter For Transport",
    description: "Find existing helicopter, load nearby infantry, fly to LZ",
    parameters: ["_fobPos (Array)", "_lzPos (Array)", "_objectivePos (Array)", "_side (EAST/WEST)"],
    sqf: `
private _sideEnum = if (_side == EAST) then {EAST} else {WEST};

// Find existing helicopter at FOB
private _heli = objNull;
private _nearHelis = _fobPos nearEntities ['Helicopter', 500] select {
  alive _x && canMove _x && (driver _x != objNull)
};

if (count _nearHelis == 0) exitWith {
  systemChat format ['[%1] No helicopters found at FOB!', _side];
};

_heli = _nearHelis select 0;
private _heliGrp = group (driver _heli);

// Find infantry to load
private _infantry = _fobPos nearEntities ['Man', 200] select {
  side _x == _sideEnum &&
  isNull objectParent _x &&
  alive _x &&
  !((typeOf _x) in ['Helicopter'])
};

if (count _infantry == 0) exitWith {
  systemChat format ['[%1] No infantry found to load!', _side];
};

// Load infantry
private _cargoCount = getNumber (configFile >> 'CfgVehicles' >> typeOf _heli >> 'transportSoldier');
private _toLoad = _infantry select [0, _cargoCount min count _infantry];

{
  _x assignAsCargo _heli;
  _x moveInCargo _heli;
} forEach _toLoad;

systemChat format ['[%1] Loaded %2 troops into %3', _side, count _toLoad, typeOf _heli];

// Create invisible helipad at LZ
private _helipad = createVehicle ['Land_HelipadEmpty_F', _lzPos, [], 0, 'NONE'];

// Clear existing waypoints
while {count waypoints _heliGrp > 0} do {
  deleteWaypoint [_heliGrp, 0];
};

// Fly to LZ and unload
private _wpLZ = _heliGrp addWaypoint [_lzPos, 0];
_wpLZ setWaypointType 'TR UNLOAD';
_wpLZ setWaypointBehaviour 'CARELESS';
_wpLZ setWaypointStatements ['true', '(vehicle this) land ''GET OUT'''];

// RTB waypoint
private _wpRTB = _heliGrp addWaypoint [_fobPos, 50];
_wpRTB setWaypointType 'MOVE';
_wpRTB setWaypointStatements ['true', '(vehicle this) land ''LAND'''];

// Infantry assault after unload
[_toLoad, _heli, _lzPos, _objectivePos] spawn {
  params ['_troops', '_heli', '_lz', '_obj'];

  waitUntil {sleep 2; (_heli distance2D _lz) < 100 || !alive _heli};

  if (alive _heli) then {
    {
      if (alive _x) then {
        unassignVehicle _x;
        _x action ['Eject', _heli];
      };
    } forEach _troops;

    sleep 5;

    // Assault objective
    private _grps = [];
    {if (!((group _x) in _grps)) then {_grps pushBack (group _x)}} forEach _troops;

    {
      if (!isNil 'lambs_wp_fnc_taskAssault') then {
        [_x, _obj, 50] call lambs_wp_fnc_taskAssault;
      } else {
        private _wp = _x addWaypoint [_obj, 30];
        _wp setWaypointType 'SAD';
      };
    } forEach _grps;

    systemChat '[HELI] Troops inserted! Assaulting objective!';
  };
};

systemChat format ['[%1] Helicopter en route to LZ with %2 troops!', _side, count _toLoad];
`,
    notes: "Uses EXISTING helicopter and infantry. Does not spawn new assets."
  }
};

// =============================================================================
// EXPORT ALL TEMPLATES
// =============================================================================

export const ALL_TEMPLATES = {
  infantry: INFANTRY_TEMPLATES,
  helicopter: HELICOPTER_TEMPLATES,
  vehicle: VEHICLE_TEMPLATES,
  logistics: LOGISTICS_TEMPLATES,
  garrison: GARRISON_TEMPLATES,
  artillery: ARTILLERY_TEMPLATES,
  lambs: LAMBS_TEMPLATES,
  tasks: TASK_TEMPLATES,
  existing: EXISTING_FORCES_TEMPLATES
};

// Helper to get template by category and name
export function getTemplate(category: string, name: string): TacticalTemplate | null {
  const categoryTemplates = ALL_TEMPLATES[category as keyof typeof ALL_TEMPLATES];
  if (!categoryTemplates) return null;
  return categoryTemplates[name] || null;
}

// List all available templates
export function listTemplates(): string[] {
  const templates: string[] = [];
  for (const [category, items] of Object.entries(ALL_TEMPLATES)) {
    for (const name of Object.keys(items)) {
      templates.push(`${category}/${name}`);
    }
  }
  return templates;
}
