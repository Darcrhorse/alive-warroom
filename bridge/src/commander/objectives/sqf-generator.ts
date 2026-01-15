/**
 * Objective SQF Generator - Generates Arma 3 SQF code for strategic objectives
 *
 * Generates SQF code for:
 * - Map markers (objective visualization)
 * - Capture triggers (zone control tracking)
 * - Defend triggers (asset protection)
 * - Destroy triggers (target destruction tracking)
 * - Status reporting (bridge communication)
 *
 * CRITICAL: All SQF strings use single quotes (Arma 3 requirement)
 */

import {
  Objective,
  CaptureObjective,
  DefendObjective,
  DestroyObjective,
  PatrolObjective,
  HVTObjective,
  ObjectiveOwner
} from './types';
import { Position } from '../../game-state/types';
import { logger } from '../../utils/logger';

/**
 * Parameters for creating a map marker
 */
export interface MarkerParams {
  id: string;
  position: Position;
  type: 'capture' | 'defend' | 'destroy' | 'patrol' | 'hvt';
  owner: ObjectiveOwner;
  label?: string;
  radius?: number;
}

/**
 * Parameters for creating a capture trigger
 */
export interface CaptureTriggerParams {
  objectiveId: string;
  position: Position;
  radius: number;
  captureRate: number;
  bridgeEndpoint: string;
}

/**
 * Parameters for creating a defend trigger
 */
export interface DefendTriggerParams {
  objectiveId: string;
  position: Position;
  radius: number;
  timeLimit: number;
  assetId?: string;
  bridgeEndpoint: string;
}

/**
 * Parameters for creating a destroy trigger
 */
export interface DestroyTriggerParams {
  objectiveId: string;
  targetId: string;
  position: Position;
  bridgeEndpoint: string;
}

/**
 * Parameters for creating a patrol route
 */
export interface PatrolRouteParams {
  objectiveId: string;
  waypoints: Position[];
  isLooping: boolean;
  bridgeEndpoint: string;
}

/**
 * Parameters for creating an HVT tracking trigger
 */
export interface HVTTriggerParams {
  objectiveId: string;
  targetUnitId: string;
  position: Position;
  radius: number;
  expiresAt: number;
  captureAlive: boolean;
  bridgeEndpoint: string;
}

/**
 * Parameters for status reporting
 */
export interface StatusReportParams {
  objectiveId: string;
  status: 'active' | 'completed' | 'failed' | 'contested';
  bridgeEndpoint: string;
  additionalData?: Record<string, unknown>;
}

/**
 * Generates SQF code for strategic objectives in Arma 3
 */
export class ObjectiveSQFGenerator {
  private readonly defaultBridgeEndpoint: string;

  constructor(bridgeEndpoint: string = 'http://localhost:3000') {
    this.defaultBridgeEndpoint = bridgeEndpoint;
    logger.debug('ObjectiveSQFGenerator initialized', { bridgeEndpoint });
  }

  /**
   * Generate SQF code to create a map marker for an objective
   */
  generateMarker(params: MarkerParams): string {
    const {
      id,
      position,
      type,
      owner,
      label = '',
      radius = 100
    } = params;

    const markerId = `LLMGM_obj_marker_${id}`;
    const markerAreaId = `LLMGM_obj_area_${id}`;

    // Determine marker color based on owner
    const colorMap: Record<ObjectiveOwner, string> = {
      EAST: 'ColorOPFOR',
      WEST: 'ColorBLUFOR',
      NEUTRAL: 'ColorYellow'
    };
    const markerColor = colorMap[owner];

    // Determine marker icon based on objective type
    const iconMap: Record<string, string> = {
      capture: 'mil_flag',
      defend: 'mil_box',
      destroy: 'mil_destroy',
      patrol: 'mil_dot',
      hvt: 'mil_warning'
    };
    const markerIcon = iconMap[type] || 'mil_dot';

    return `
// Create objective marker: ${type} - ${id}
private _markerId = '${markerId}';
private _markerAreaId = '${markerAreaId}';
private _markerPos = [${position.x}, ${position.y}, ${position.z}];

// Delete existing markers if they exist
deleteMarker _markerId;
deleteMarker _markerAreaId;

// Create area marker (shows objective zone)
private _areaMarker = createMarker [_markerAreaId, _markerPos];
_areaMarker setMarkerShape 'ELLIPSE';
_areaMarker setMarkerSize [${radius}, ${radius}];
_areaMarker setMarkerColor '${markerColor}';
_areaMarker setMarkerAlpha 0.3;
_areaMarker setMarkerBrush 'SolidBorder';

// Create icon marker (shows objective type)
private _iconMarker = createMarker [_markerId, _markerPos];
_iconMarker setMarkerType '${markerIcon}';
_iconMarker setMarkerColor '${markerColor}';
_iconMarker setMarkerText '${label}';
_iconMarker setMarkerSize [1, 1];

// Store marker references for tracking
if (isNil 'LLMGM_objectiveMarkers') then {
  LLMGM_objectiveMarkers = createHashMap;
};
LLMGM_objectiveMarkers set ['${id}', [_markerId, _markerAreaId]];

[_markerId, _markerAreaId]
`.trim();
  }

  /**
   * Generate SQF code to create a capture trigger
   * Tracks units in zone and reports capture progress to bridge
   */
  generateCaptureTrigger(params: CaptureTriggerParams): string {
    const {
      objectiveId,
      position,
      radius,
      captureRate,
      bridgeEndpoint = this.defaultBridgeEndpoint
    } = params;

    const triggerId = `LLMGM_capture_trg_${objectiveId}`;

    return `
// Capture trigger for objective: ${objectiveId}
private _triggerId = '${triggerId}';
private _triggerPos = [${position.x}, ${position.y}, ${position.z}];
private _radius = ${radius};
private _captureRate = ${captureRate};
private _objectiveId = '${objectiveId}';
private _bridgeEndpoint = '${bridgeEndpoint}';

// Create the capture zone trigger
private _trigger = createTrigger ['EmptyDetector', _triggerPos, false];
_trigger setTriggerArea [_radius, _radius, 0, false];
_trigger setTriggerActivation ['ANY', 'PRESENT', true];
_trigger setTriggerStatements [
  'this',
  '',
  ''
];

// Store trigger reference
if (isNil 'LLMGM_objectiveTriggers') then {
  LLMGM_objectiveTriggers = createHashMap;
};
LLMGM_objectiveTriggers set [_objectiveId, _trigger];

// Initialize capture tracking variables
missionNamespace setVariable [format ['LLMGM_capture_%1_progress', _objectiveId], 0];
missionNamespace setVariable [format ['LLMGM_capture_%1_lastUpdate', _objectiveId], time];
missionNamespace setVariable [format ['LLMGM_capture_%1_contested', _objectiveId], false];

// Spawn capture progress handler
[_trigger, _objectiveId, _radius, _captureRate, _bridgeEndpoint] spawn {
  params ['_trigger', '_objectiveId', '_radius', '_captureRate', '_bridgeEndpoint'];

  private _progressVar = format ['LLMGM_capture_%1_progress', _objectiveId];
  private _lastUpdateVar = format ['LLMGM_capture_%1_lastUpdate', _objectiveId];
  private _contestedVar = format ['LLMGM_capture_%1_contested', _objectiveId];
  private _triggerPos = getPos _trigger;

  while {!isNull _trigger} do {
    // Get units in zone
    private _unitsInZone = _triggerPos nearEntities ['Man', _radius];
    private _eastCount = {side _x == EAST && alive _x} count _unitsInZone;
    private _westCount = {side _x == WEST && alive _x} count _unitsInZone;

    // Determine capture state
    private _currentProgress = missionNamespace getVariable [_progressVar, 0];
    private _lastUpdate = missionNamespace getVariable [_lastUpdateVar, time];
    private _deltaTime = time - _lastUpdate;
    private _contested = false;
    private _capturingSide = 'NEUTRAL';

    if (_eastCount > 0 && _westCount > 0) then {
      // Contested - progress freezes
      _contested = true;
    } else {
      if (_eastCount > 0) then {
        _capturingSide = 'EAST';
        _currentProgress = (_currentProgress + (_captureRate * _deltaTime)) min 100;
      };
      if (_westCount > 0) then {
        _capturingSide = 'WEST';
        _currentProgress = (_currentProgress + (_captureRate * _deltaTime)) min 100;
      };
    };

    // Update tracking variables
    missionNamespace setVariable [_progressVar, _currentProgress];
    missionNamespace setVariable [_lastUpdateVar, time];
    missionNamespace setVariable [_contestedVar, _contested];

    // Report status to bridge if significant change
    private _statusJson = format [
      '{\"objectiveId\":\"%1\",\"type\":\"capture_update\",\"progress\":%2,\"contested\":%3,\"capturingSide\":\"%4\",\"eastUnits\":%5,\"westUnits\":%6}',
      _objectiveId,
      _currentProgress,
      _contested,
      _capturingSide,
      _eastCount,
      _westCount
    ];

    // Check for completion
    if (_currentProgress >= 100) then {
      private _completeJson = format [
        '{\"objectiveId\":\"%1\",\"type\":\"objective_complete\",\"status\":\"completed\",\"completedBy\":\"%2\"}',
        _objectiveId,
        _capturingSide
      ];
      // Notify completion
      [_bridgeEndpoint + '/api/objectives/status', _completeJson] call LLMGM_fnc_httpPost;

      // Clean up trigger
      deleteVehicle _trigger;
    };

    sleep 2;
  };
};

_trigger
`.trim();
  }

  /**
   * Generate SQF code to create a defend trigger
   * Monitors area/asset and tracks defense status
   */
  generateDefendTrigger(params: DefendTriggerParams): string {
    const {
      objectiveId,
      position,
      radius,
      timeLimit,
      assetId,
      bridgeEndpoint = this.defaultBridgeEndpoint
    } = params;

    const triggerId = `LLMGM_defend_trg_${objectiveId}`;

    return `
// Defend trigger for objective: ${objectiveId}
private _triggerId = '${triggerId}';
private _triggerPos = [${position.x}, ${position.y}, ${position.z}];
private _radius = ${radius};
private _timeLimit = ${timeLimit};
private _objectiveId = '${objectiveId}';
private _bridgeEndpoint = '${bridgeEndpoint}';
${assetId ? `private _assetId = '${assetId}';` : 'private _assetId = objNull;'}

// Create defend zone trigger
private _trigger = createTrigger ['EmptyDetector', _triggerPos, false];
_trigger setTriggerArea [_radius, _radius, 0, false];
_trigger setTriggerActivation ['ANY', 'PRESENT', true];
_trigger setTriggerStatements [
  'this',
  '',
  ''
];

// Store trigger reference
if (isNil 'LLMGM_objectiveTriggers') then {
  LLMGM_objectiveTriggers = createHashMap;
};
LLMGM_objectiveTriggers set [_objectiveId, _trigger];

// Initialize defend tracking variables
private _startTime = time;
missionNamespace setVariable [format ['LLMGM_defend_%1_startTime', _objectiveId], _startTime];
missionNamespace setVariable [format ['LLMGM_defend_%1_breached', _objectiveId], false];
missionNamespace setVariable [format ['LLMGM_defend_%1_timeRemaining', _objectiveId], _timeLimit];

// Spawn defend progress handler
[_trigger, _objectiveId, _radius, _timeLimit, _startTime, _assetId, _bridgeEndpoint] spawn {
  params ['_trigger', '_objectiveId', '_radius', '_timeLimit', '_startTime', '_assetId', '_bridgeEndpoint'];

  private _breachedVar = format ['LLMGM_defend_%1_breached', _objectiveId];
  private _timeRemainingVar = format ['LLMGM_defend_%1_timeRemaining', _objectiveId];
  private _triggerPos = getPos _trigger;
  private _ownerSide = WEST; // Defending side - could be parameterized

  while {!isNull _trigger} do {
    private _elapsed = time - _startTime;
    private _timeRemaining = _timeLimit - _elapsed;

    // Update time remaining
    missionNamespace setVariable [_timeRemainingVar, _timeRemaining max 0];

    // Check for enemy presence (breach)
    private _unitsInZone = _triggerPos nearEntities ['Man', _radius];
    private _enemyCount = {(side _x != _ownerSide) && (side _x != CIVILIAN) && alive _x} count _unitsInZone;
    private _isBreached = _enemyCount > 0;
    missionNamespace setVariable [_breachedVar, _isBreached];

    // Check asset status if specified
    private _assetAlive = true;
    if (!isNull _assetId) then {
      private _asset = missionNamespace getVariable [_assetId, objNull];
      if (!isNull _asset) then {
        _assetAlive = alive _asset;
      };
    };

    // Report status
    private _statusJson = format [
      '{\"objectiveId\":\"%1\",\"type\":\"defend_update\",\"timeRemaining\":%2,\"breached\":%3,\"enemyCount\":%4,\"assetAlive\":%5}',
      _objectiveId,
      _timeRemaining,
      _isBreached,
      _enemyCount,
      _assetAlive
    ];

    // Check for success (time expired with asset alive)
    if (_timeRemaining <= 0 && _assetAlive) then {
      private _successJson = format [
        '{\"objectiveId\":\"%1\",\"type\":\"objective_complete\",\"status\":\"completed\"}',
        _objectiveId
      ];
      [_bridgeEndpoint + '/api/objectives/status', _successJson] call LLMGM_fnc_httpPost;
      deleteVehicle _trigger;
    };

    // Check for failure (asset destroyed)
    if (!_assetAlive) then {
      private _failJson = format [
        '{\"objectiveId\":\"%1\",\"type\":\"objective_complete\",\"status\":\"failed\",\"reason\":\"asset_destroyed\"}',
        _objectiveId
      ];
      [_bridgeEndpoint + '/api/objectives/status', _failJson] call LLMGM_fnc_httpPost;
      deleteVehicle _trigger;
    };

    sleep 3;
  };
};

_trigger
`.trim();
  }

  /**
   * Generate SQF code to create a destroy trigger
   * Monitors target and reports destruction to bridge
   */
  generateDestroyTrigger(params: DestroyTriggerParams): string {
    const {
      objectiveId,
      targetId,
      position,
      bridgeEndpoint = this.defaultBridgeEndpoint
    } = params;

    const triggerId = `LLMGM_destroy_trg_${objectiveId}`;

    return `
// Destroy trigger for objective: ${objectiveId}
private _triggerId = '${triggerId}';
private _targetId = '${targetId}';
private _targetPos = [${position.x}, ${position.y}, ${position.z}];
private _objectiveId = '${objectiveId}';
private _bridgeEndpoint = '${bridgeEndpoint}';

// Find target object
private _target = missionNamespace getVariable [_targetId, objNull];

// If target not found by ID, try to find nearest object at position
if (isNull _target) then {
  private _nearObjects = nearestObjects [_targetPos, [], 50];
  if (count _nearObjects > 0) then {
    _target = _nearObjects select 0;
  };
};

if (isNull _target) exitWith {
  systemChat format ['[LLMGM] Warning: Destroy objective %1 - target not found', _objectiveId];
  objNull
};

// Initialize destroy tracking
missionNamespace setVariable [format ['LLMGM_destroy_%1_target', _objectiveId], _target];
missionNamespace setVariable [format ['LLMGM_destroy_%1_discovered', _objectiveId], false];

// Store for tracking
if (isNil 'LLMGM_objectiveTargets') then {
  LLMGM_objectiveTargets = createHashMap;
};
LLMGM_objectiveTargets set [_objectiveId, _target];

// Spawn destruction monitor
[_target, _objectiveId, _bridgeEndpoint] spawn {
  params ['_target', '_objectiveId', '_bridgeEndpoint'];

  private _discoveredVar = format ['LLMGM_destroy_%1_discovered', _objectiveId];

  // Wait for target to be destroyed
  waitUntil {
    sleep 2;
    !alive _target || isNull _target
  };

  // Report destruction
  private _successJson = format [
    '{\"objectiveId\":\"%1\",\"type\":\"objective_complete\",\"status\":\"completed\",\"targetDestroyed\":true}',
    _objectiveId
  ];

  [_bridgeEndpoint + '/api/objectives/status', _successJson] call LLMGM_fnc_httpPost;

  // Clean up tracking
  LLMGM_objectiveTargets deleteAt _objectiveId;

  systemChat format ['[LLMGM] Destroy objective %1 completed', _objectiveId];
};

_target
`.trim();
  }

  /**
   * Generate SQF code to create patrol waypoints
   */
  generatePatrolRoute(params: PatrolRouteParams): string {
    const {
      objectiveId,
      waypoints,
      isLooping,
      bridgeEndpoint = this.defaultBridgeEndpoint
    } = params;

    // Convert waypoints to SQF array format
    const waypointsStr = waypoints
      .map(wp => `[${wp.x}, ${wp.y}, ${wp.z}]`)
      .join(', ');

    return `
// Patrol route for objective: ${objectiveId}
private _objectiveId = '${objectiveId}';
private _waypoints = [${waypointsStr}];
private _isLooping = ${isLooping};
private _bridgeEndpoint = '${bridgeEndpoint}';

// Initialize patrol tracking
missionNamespace setVariable [format ['LLMGM_patrol_%1_waypoints', _objectiveId], _waypoints];
missionNamespace setVariable [format ['LLMGM_patrol_%1_currentWP', _objectiveId], 0];
missionNamespace setVariable [format ['LLMGM_patrol_%1_detections', _objectiveId], 0];
missionNamespace setVariable [format ['LLMGM_patrol_%1_cycles', _objectiveId], 0];
missionNamespace setVariable [format ['LLMGM_patrol_%1_intel', _objectiveId], []];

// Create patrol markers
{
  private _wpIndex = _forEachIndex;
  private _markerId = format ['LLMGM_patrol_%1_wp%2', _objectiveId, _wpIndex];
  deleteMarker _markerId;

  private _marker = createMarker [_markerId, _x];
  _marker setMarkerType 'mil_dot';
  _marker setMarkerColor 'ColorGreen';
  _marker setMarkerAlpha 0.5;
  _marker setMarkerText format ['WP%1', _wpIndex + 1];
} forEach _waypoints;

// Create patrol route line markers
for '_i' from 0 to ((count _waypoints) - 2) do {
  private _lineId = format ['LLMGM_patrol_%1_line%2', _objectiveId, _i];
  deleteMarker _lineId;

  private _startPos = _waypoints select _i;
  private _endPos = _waypoints select (_i + 1);
  private _midPos = [
    (_startPos select 0) + ((_endPos select 0) - (_startPos select 0)) / 2,
    (_startPos select 1) + ((_endPos select 1) - (_startPos select 1)) / 2,
    0
  ];

  private _marker = createMarker [_lineId, _midPos];
  _marker setMarkerShape 'RECTANGLE';
  private _length = _startPos distance2D _endPos;
  _marker setMarkerSize [10, _length / 2];
  private _dir = _startPos getDir _endPos;
  _marker setMarkerDir _dir;
  _marker setMarkerColor 'ColorGreen';
  _marker setMarkerAlpha 0.3;
};

// Function to apply patrol to a group
LLMGM_fnc_applyPatrol = {
  params ['_group', '_objectiveId'];

  private _waypoints = missionNamespace getVariable [format ['LLMGM_patrol_%1_waypoints', _objectiveId], []];
  private _isLooping = missionNamespace getVariable [format ['LLMGM_patrol_%1_looping', _objectiveId], true];

  // Clear existing waypoints
  while {count waypoints _group > 0} do {
    deleteWaypoint [_group, 0];
  };

  // Add patrol waypoints
  {
    private _wp = _group addWaypoint [_x, 30];
    _wp setWaypointType 'MOVE';
    _wp setWaypointBehaviour 'AWARE';
    _wp setWaypointSpeed 'LIMITED';
  } forEach _waypoints;

  // Add cycle waypoint if looping
  if (_isLooping && count _waypoints > 0) then {
    private _wp = _group addWaypoint [_waypoints select 0, 30];
    _wp setWaypointType 'CYCLE';
  };

  _group
};

// Store looping setting
missionNamespace setVariable [format ['LLMGM_patrol_%1_looping', _objectiveId], _isLooping];

// Return waypoints for reference
_waypoints
`.trim();
  }

  /**
   * Generate SQF code to create an HVT tracking trigger
   */
  generateHVTTrigger(params: HVTTriggerParams): string {
    const {
      objectiveId,
      targetUnitId,
      position,
      radius,
      expiresAt,
      captureAlive,
      bridgeEndpoint = this.defaultBridgeEndpoint
    } = params;

    const triggerId = `LLMGM_hvt_trg_${objectiveId}`;

    return `
// HVT trigger for objective: ${objectiveId}
private _triggerId = '${triggerId}';
private _targetUnitId = '${targetUnitId}';
private _initialPos = [${position.x}, ${position.y}, ${position.z}];
private _radius = ${radius};
private _expiresAt = ${expiresAt};
private _captureAlive = ${captureAlive};
private _objectiveId = '${objectiveId}';
private _bridgeEndpoint = '${bridgeEndpoint}';

// Find target unit
private _targetUnit = missionNamespace getVariable [_targetUnitId, objNull];

// If not found by ID, search by type/class near position
if (isNull _targetUnit) then {
  private _nearUnits = _initialPos nearEntities ['Man', _radius * 2];
  private _officers = _nearUnits select {
    (rank _x) in ['COLONEL', 'MAJOR', 'CAPTAIN', 'LIEUTENANT']
  };
  if (count _officers > 0) then {
    _targetUnit = _officers select 0;
  } else {
    if (count _nearUnits > 0) then {
      _targetUnit = _nearUnits select 0;
    };
  };
};

if (isNull _targetUnit) exitWith {
  systemChat format ['[LLMGM] Warning: HVT objective %1 - target not found', _objectiveId];
  objNull
};

// Store target reference
missionNamespace setVariable [format ['LLMGM_hvt_%1_target', _objectiveId], _targetUnit];
missionNamespace setVariable [format ['LLMGM_hvt_%1_lastKnownPos', _objectiveId], getPos _targetUnit];
missionNamespace setVariable [format ['LLMGM_hvt_%1_lastUpdate', _objectiveId], time];

// Create HVT marker
private _markerId = format ['LLMGM_hvt_marker_%1', _objectiveId];
deleteMarker _markerId;
private _marker = createMarker [_markerId, getPos _targetUnit];
_marker setMarkerType 'mil_warning';
_marker setMarkerColor 'ColorRed';
_marker setMarkerText 'HVT';

// Store in tracking
if (isNil 'LLMGM_hvtTargets') then {
  LLMGM_hvtTargets = createHashMap;
};
LLMGM_hvtTargets set [_objectiveId, _targetUnit];

// Spawn HVT monitor
[_targetUnit, _objectiveId, _expiresAt, _captureAlive, _markerId, _bridgeEndpoint] spawn {
  params ['_target', '_objectiveId', '_expiresAt', '_captureAlive', '_markerId', '_bridgeEndpoint'];

  private _lastKnownPosVar = format ['LLMGM_hvt_%1_lastKnownPos', _objectiveId];
  private _lastUpdateVar = format ['LLMGM_hvt_%1_lastUpdate', _objectiveId];

  while {true} do {
    // Check expiration
    private _currentTime = systemTime call BIS_fnc_systemTimeToTotalSeconds;
    if (_currentTime > _expiresAt) exitWith {
      // Objective expired
      private _expiredJson = format [
        '{\"objectiveId\":\"%1\",\"type\":\"objective_complete\",\"status\":\"failed\",\"reason\":\"expired\"}',
        _objectiveId
      ];
      [_bridgeEndpoint + '/api/objectives/status', _expiredJson] call LLMGM_fnc_httpPost;
      deleteMarker _markerId;
      systemChat format ['[LLMGM] HVT objective %1 expired', _objectiveId];
    };

    // Check target status
    if (isNull _target) exitWith {
      // Target no longer exists
      deleteMarker _markerId;
    };

    // Update last known position
    if (alive _target) then {
      missionNamespace setVariable [_lastKnownPosVar, getPos _target];
      missionNamespace setVariable [_lastUpdateVar, time];
      _markerId setMarkerPos (getPos _target);
    };

    // Check for elimination
    if (!alive _target) exitWith {
      private _status = if (_captureAlive) then {'failed'} else {'completed'};
      private _reason = if (_captureAlive) then {'target_killed'} else {'target_eliminated'};

      private _resultJson = format [
        '{\"objectiveId\":\"%1\",\"type\":\"objective_complete\",\"status\":\"%2\",\"reason\":\"%3\"}',
        _objectiveId,
        _status,
        _reason
      ];
      [_bridgeEndpoint + '/api/objectives/status', _resultJson] call LLMGM_fnc_httpPost;
      deleteMarker _markerId;

      systemChat format ['[LLMGM] HVT objective %1 - target %2', _objectiveId, _reason];
    };

    // Check for capture (if capture alive required)
    if (_captureAlive && captive _target) exitWith {
      private _capturedJson = format [
        '{\"objectiveId\":\"%1\",\"type\":\"objective_complete\",\"status\":\"completed\",\"reason\":\"target_captured\"}',
        _objectiveId
      ];
      [_bridgeEndpoint + '/api/objectives/status', _capturedJson] call LLMGM_fnc_httpPost;
      deleteMarker _markerId;

      systemChat format ['[LLMGM] HVT objective %1 - target captured', _objectiveId];
    };

    sleep 3;
  };

  // Clean up
  LLMGM_hvtTargets deleteAt _objectiveId;
};

_targetUnit
`.trim();
  }

  /**
   * Generate SQF code to report objective status to the bridge
   */
  generateStatusReport(params: StatusReportParams): string {
    const {
      objectiveId,
      status,
      bridgeEndpoint = this.defaultBridgeEndpoint,
      additionalData = {}
    } = params;

    // Build additional data string
    const additionalDataStr = Object.entries(additionalData)
      .map(([key, value]) => `\"${key}\":\"${value}\"`)
      .join(',');

    const dataSection = additionalDataStr ? `,${additionalDataStr}` : '';

    return `
// Report objective status: ${objectiveId}
private _objectiveId = '${objectiveId}';
private _status = '${status}';
private _bridgeEndpoint = '${bridgeEndpoint}';

private _reportJson = format [
  '{\"objectiveId\":\"%1\",\"type\":\"status_report\",\"status\":\"%2\",\"timestamp\":%3${dataSection}}',
  _objectiveId,
  _status,
  systemTime call BIS_fnc_systemTimeToTotalSeconds
];

// Send status report to bridge
[_bridgeEndpoint + '/api/objectives/status', _reportJson] call LLMGM_fnc_httpPost;

systemChat format ['[LLMGM] Objective %1 status: %2', _objectiveId, _status];

true
`.trim();
  }

  /**
   * Generate SQF code for a complete objective setup
   * Combines marker, trigger, and status reporting
   */
  generateCompleteObjective(objective: Objective): string {
    const sqfParts: string[] = [];

    // Add header comment
    sqfParts.push(`// ========================================`);
    sqfParts.push(`// Complete setup for ${objective.type} objective: ${objective.id}`);
    sqfParts.push(`// Created at: ${new Date(objective.createdAt).toISOString()}`);
    sqfParts.push(`// ========================================`);
    sqfParts.push('');

    // Generate marker
    sqfParts.push(this.generateMarker({
      id: objective.id,
      position: objective.position,
      type: objective.type,
      owner: objective.owner,
      label: objective.description,
      radius: objective.radius
    }));
    sqfParts.push('');

    // Generate type-specific trigger
    switch (objective.type) {
      case 'capture': {
        const captureObj = objective as CaptureObjective;
        sqfParts.push(this.generateCaptureTrigger({
          objectiveId: objective.id,
          position: objective.position,
          radius: objective.radius,
          captureRate: captureObj.captureRate,
          bridgeEndpoint: this.defaultBridgeEndpoint
        }));
        break;
      }

      case 'defend': {
        const defendObj = objective as DefendObjective;
        sqfParts.push(this.generateDefendTrigger({
          objectiveId: objective.id,
          position: objective.position,
          radius: objective.radius,
          timeLimit: defendObj.timeLimit,
          assetId: defendObj.assetId,
          bridgeEndpoint: this.defaultBridgeEndpoint
        }));
        break;
      }

      case 'destroy': {
        const destroyObj = objective as DestroyObjective;
        sqfParts.push(this.generateDestroyTrigger({
          objectiveId: objective.id,
          targetId: destroyObj.targetId || '',
          position: objective.position,
          bridgeEndpoint: this.defaultBridgeEndpoint
        }));
        break;
      }

      case 'patrol': {
        const patrolObj = objective as PatrolObjective;
        sqfParts.push(this.generatePatrolRoute({
          objectiveId: objective.id,
          waypoints: patrolObj.patrolRoute,
          isLooping: patrolObj.isLooping,
          bridgeEndpoint: this.defaultBridgeEndpoint
        }));
        break;
      }

      case 'hvt': {
        const hvtObj = objective as HVTObjective;
        sqfParts.push(this.generateHVTTrigger({
          objectiveId: objective.id,
          targetUnitId: hvtObj.targetUnitId,
          position: hvtObj.lastKnownPosition,
          radius: objective.radius,
          expiresAt: hvtObj.expiresAt,
          captureAlive: hvtObj.captureAlive,
          bridgeEndpoint: this.defaultBridgeEndpoint
        }));
        break;
      }
    }

    logger.debug('Generated complete objective SQF', {
      objectiveId: objective.id,
      type: objective.type,
      sqfLength: sqfParts.join('\n').length
    });

    return sqfParts.join('\n');
  }

  /**
   * Generate SQF code to clean up an objective
   * Removes markers, triggers, and tracking variables
   */
  generateCleanup(objectiveId: string): string {
    return `
// Clean up objective: ${objectiveId}
private _objectiveId = '${objectiveId}';

// Delete markers
if (!isNil 'LLMGM_objectiveMarkers') then {
  private _markers = LLMGM_objectiveMarkers getOrDefault [_objectiveId, []];
  {deleteMarker _x} forEach _markers;
  LLMGM_objectiveMarkers deleteAt _objectiveId;
};

// Delete triggers
if (!isNil 'LLMGM_objectiveTriggers') then {
  private _trigger = LLMGM_objectiveTriggers getOrDefault [_objectiveId, objNull];
  if (!isNull _trigger) then {
    deleteVehicle _trigger;
  };
  LLMGM_objectiveTriggers deleteAt _objectiveId;
};

// Delete patrol markers
private _waypointIndex = 0;
while {true} do {
  private _wpMarker = format ['LLMGM_patrol_%1_wp%2', _objectiveId, _waypointIndex];
  if (getMarkerType _wpMarker == '') exitWith {};
  deleteMarker _wpMarker;
  _waypointIndex = _waypointIndex + 1;
};

private _lineIndex = 0;
while {true} do {
  private _lineMarker = format ['LLMGM_patrol_%1_line%2', _objectiveId, _lineIndex];
  if (getMarkerType _lineMarker == '') exitWith {};
  deleteMarker _lineMarker;
  _lineIndex = _lineIndex + 1;
};

// Delete HVT marker
deleteMarker format ['LLMGM_hvt_marker_%1', _objectiveId];

// Clean up target tracking
if (!isNil 'LLMGM_objectiveTargets') then {
  LLMGM_objectiveTargets deleteAt _objectiveId;
};
if (!isNil 'LLMGM_hvtTargets') then {
  LLMGM_hvtTargets deleteAt _objectiveId;
};

// Clear namespace variables (common patterns)
{
  missionNamespace setVariable [_x, nil];
} forEach [
  format ['LLMGM_capture_%1_progress', _objectiveId],
  format ['LLMGM_capture_%1_lastUpdate', _objectiveId],
  format ['LLMGM_capture_%1_contested', _objectiveId],
  format ['LLMGM_defend_%1_startTime', _objectiveId],
  format ['LLMGM_defend_%1_breached', _objectiveId],
  format ['LLMGM_defend_%1_timeRemaining', _objectiveId],
  format ['LLMGM_destroy_%1_target', _objectiveId],
  format ['LLMGM_destroy_%1_discovered', _objectiveId],
  format ['LLMGM_patrol_%1_waypoints', _objectiveId],
  format ['LLMGM_patrol_%1_currentWP', _objectiveId],
  format ['LLMGM_patrol_%1_detections', _objectiveId],
  format ['LLMGM_patrol_%1_cycles', _objectiveId],
  format ['LLMGM_patrol_%1_intel', _objectiveId],
  format ['LLMGM_patrol_%1_looping', _objectiveId],
  format ['LLMGM_hvt_%1_target', _objectiveId],
  format ['LLMGM_hvt_%1_lastKnownPos', _objectiveId],
  format ['LLMGM_hvt_%1_lastUpdate', _objectiveId]
];

systemChat format ['[LLMGM] Objective %1 cleaned up', _objectiveId];

true
`.trim();
  }

  /**
   * Generate HTTP POST function for bridge communication
   * This is a utility function that should be defined once in the mission
   */
  generateHttpPostFunction(): string {
    return `
// LLMGM HTTP POST function for bridge communication
// Should be called once during mission init
if (isNil 'LLMGM_fnc_httpPost') then {
  LLMGM_fnc_httpPost = {
    params ['_url', '_data'];

    // Use extension or alternative method to send HTTP request
    // This is a placeholder - actual implementation depends on the
    // HTTP extension being used (e.g., ArmaExtension, CBA)

    private _request = format [
      'LLMGM_HTTP_POST:%1:%2',
      _url,
      _data
    ];

    // Log the request for debugging
    diag_log format ['[LLMGM] HTTP POST: %1 -> %2', _url, _data];

    // If using a specific extension, call it here
    // Example: 'alive_extension' callExtension _request;

    true
  };

  systemChat '[LLMGM] HTTP POST function initialized';
};
`.trim();
  }
}

// Export singleton instance for global access
export const objectiveSQFGenerator = new ObjectiveSQFGenerator();
