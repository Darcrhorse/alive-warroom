/**
 * Type definitions for Strategic Objective System
 *
 * Defines interfaces for all 5 objective types used by AI Commanders:
 * - Capture: Location-based objectives with progress tracking
 * - Defend: Time-limited protection missions
 * - Destroy: Target high-value enemy assets
 * - Patrol: Area denial/presence missions
 * - HVT: Time-sensitive kill/capture missions
 */

import { Position } from '../../game-state/types';

/**
 * Objective owner sides
 */
export type ObjectiveOwner = 'EAST' | 'WEST' | 'NEUTRAL';

/**
 * Objective status states
 */
export type ObjectiveStatus = 'active' | 'completed' | 'failed' | 'contested';

/**
 * Objective type identifiers
 */
export type ObjectiveType = 'capture' | 'defend' | 'destroy' | 'patrol' | 'hvt';

/**
 * Intel quality levels for HVT objectives
 */
export type IntelQuality = 'low' | 'medium' | 'high' | 'confirmed';

/**
 * Base objective interface with common fields for all objective types
 */
export interface BaseObjective {
  /** Unique identifier for the objective (format: obj_timestamp_counter) */
  id: string;

  /** Type of objective */
  type: ObjectiveType;

  /** Human-readable description of the objective */
  description: string;

  /** Center position of the objective area */
  position: Position;

  /** Radius of the objective area in meters */
  radius: number;

  /** Priority level (1-10, higher = more important) */
  priority: number;

  /** Which side owns/controls this objective */
  owner: ObjectiveOwner;

  /** Current status of the objective */
  status: ObjectiveStatus;

  /** IDs of units assigned to this objective */
  assignedUnits: string[];

  /** Strategic value score (0-100) */
  strategicValue: number;

  /** Timestamp when objective was created */
  createdAt: number;

  /** Timestamp when objective was last updated */
  updatedAt: number;
}

/**
 * Capture objective - Location-based objectives with progress tracking
 *
 * Progress increases when only one side is present in the capture zone.
 * Progress freezes (not decreases) when both sides are present (contested).
 * Completes at 100% progress.
 */
export interface CaptureObjective extends BaseObjective {
  type: 'capture';

  /** Current capture progress (0-100) */
  captureProgress: number;

  /** Rate of capture progress per second when uncontested */
  captureRate: number;

  /** Side currently capturing (null if contested or empty) */
  capturingSide: ObjectiveOwner | null;

  /** Whether objective is currently contested (both sides present) */
  isContested: boolean;
}

/**
 * Defend objective - Time-limited protection missions
 *
 * Success when timer expires with asset/position still protected.
 * Fails if asset is destroyed or position is captured before timer.
 */
export interface DefendObjective extends BaseObjective {
  type: 'defend';

  /** Time limit in seconds for defense */
  timeLimit: number;

  /** Remaining time in seconds */
  timeRemaining: number;

  /** ID of asset to defend (unit, vehicle, or building) */
  assetId?: string;

  /** Type of asset being defended */
  assetType?: 'unit' | 'vehicle' | 'building' | 'position';

  /** Whether defense has been breached (enemy in zone) */
  isBreached: boolean;
}

/**
 * Destroy objective - Target high-value enemy assets
 *
 * Requires reconnaissance to discover target.
 * Completes when target is destroyed.
 */
export interface DestroyObjective extends BaseObjective {
  type: 'destroy';

  /** Type of target to destroy */
  targetType: 'vehicle' | 'building' | 'fortification' | 'supply_cache' | 'equipment';

  /** Timestamp when target was discovered (null if not yet found) */
  discoveredAt: number | null;

  /** Whether target has been discovered via reconnaissance */
  isDiscovered: boolean;

  /** ID of the specific target unit/object */
  targetId?: string;

  /** Estimated enemy strength guarding target (0-1) */
  estimatedDefense: number;
}

/**
 * Patrol objective - Area denial/presence missions
 *
 * Lower priority tier objective for maintaining area control.
 * Useful for intelligence gathering.
 */
export interface PatrolObjective extends BaseObjective {
  type: 'patrol';

  /** Ordered list of waypoint positions for patrol route */
  patrolRoute: Position[];

  /** Current waypoint index in the patrol route */
  currentWaypointIndex: number;

  /** Number of enemy contacts detected during patrol */
  detectionCount: number;

  /** Number of completed patrol cycles */
  completedCycles: number;

  /** Whether patrol should loop continuously */
  isLooping: boolean;

  /** Intel gathered during patrol */
  intelGathered: string[];
}

/**
 * HVT (High Value Target) objective - Time-sensitive kill/capture missions
 *
 * Targets specific enemy units with time pressure.
 * Intel quality affects position accuracy.
 */
export interface HVTObjective extends BaseObjective {
  type: 'hvt';

  /** ID of the target unit */
  targetUnitId: string;

  /** Timestamp when objective expires (target escapes) */
  expiresAt: number;

  /** Quality of intelligence on target location */
  intelQuality: IntelQuality;

  /** Whether to capture alive (true) or eliminate (false) */
  captureAlive: boolean;

  /** Last known position of target */
  lastKnownPosition: Position;

  /** Timestamp of last position update */
  lastPositionUpdate: number;

  /** Target's name/designation for briefing */
  targetDesignation: string;
}

/**
 * Union type of all objective types
 */
export type Objective = CaptureObjective | DefendObjective | DestroyObjective | PatrolObjective | HVTObjective;

/**
 * Parameters for creating a new objective
 */
export interface CreateObjectiveParams {
  type: ObjectiveType;
  description?: string;
  position: Position;
  radius?: number;
  priority?: number;
  owner?: ObjectiveOwner;
  strategicValue?: number;

  // Type-specific optional fields
  captureRate?: number;
  timeLimit?: number;
  assetId?: string;
  assetType?: 'unit' | 'vehicle' | 'building' | 'position';
  targetType?: 'vehicle' | 'building' | 'fortification' | 'supply_cache' | 'equipment';
  targetId?: string;
  estimatedDefense?: number;
  patrolRoute?: Position[];
  isLooping?: boolean;
  targetUnitId?: string;
  expiresAt?: number;
  intelQuality?: IntelQuality;
  captureAlive?: boolean;
  targetDesignation?: string;
}

/**
 * Parameters for updating an objective
 */
export interface UpdateObjectiveParams {
  description?: string;
  priority?: number;
  status?: ObjectiveStatus;
  assignedUnits?: string[];
  strategicValue?: number;

  // Capture-specific
  captureProgress?: number;
  capturingSide?: ObjectiveOwner | null;
  isContested?: boolean;

  // Defend-specific
  timeRemaining?: number;
  isBreached?: boolean;

  // Destroy-specific
  discoveredAt?: number | null;
  isDiscovered?: boolean;

  // Patrol-specific
  currentWaypointIndex?: number;
  detectionCount?: number;
  completedCycles?: number;
  intelGathered?: string[];

  // HVT-specific
  lastKnownPosition?: Position;
  lastPositionUpdate?: number;
  intelQuality?: IntelQuality;
}

/**
 * Objective scoring context for AI decision-making
 */
export interface ObjectiveScoringContext {
  /** Current position of the commander's forces */
  commanderPosition: Position;

  /** Available unit count */
  availableUnits: number;

  /** Estimated enemy strength in area (0-1) */
  enemyStrength: number;

  /** Current mission phase (early/mid/late) */
  missionPhase: 'early' | 'mid' | 'late';

  /** Time pressure factor (0-1, higher = more time sensitive) */
  timePressure: number;
}

/**
 * Result of objective scoring
 */
export interface ObjectiveScore {
  /** The objective being scored */
  objectiveId: string;

  /** Final calculated score (0-100) */
  score: number;

  /** Breakdown of score components */
  breakdown: {
    strategicValueScore: number;
    distanceScore: number;
    priorityScore: number;
    riskScore: number;
    timeScore: number;
  };

  /** Reasoning for the score */
  reasoning: string;
}

/**
 * Objective filter options for queries
 */
export interface ObjectiveFilter {
  type?: ObjectiveType;
  owner?: ObjectiveOwner;
  status?: ObjectiveStatus;
  minPriority?: number;
  maxDistance?: number;
  fromPosition?: Position;
}
