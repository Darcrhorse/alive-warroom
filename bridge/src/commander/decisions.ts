/**
 * Decision Engine - Core decision-making engine with rate limiting and anti-spam
 *
 * Evaluates objectives, checks resources, enforces rate limiting (30-60s),
 * and generates reasoned decisions with SQF code.
 */

import {
  GameState,
  GMDecision,
  CommanderObjective,
  Position,
  IntelReport,
  ThreatMatrix
} from '../game-state/types';
import { ObjectiveManager, ObjectiveEvaluation, ObjectiveScoringFactors } from './objectives';
import { ResourceManager, UnitType } from './resources';
import { logger } from '../utils/logger';

/**
 * Configuration for the decision engine
 */
export interface DecisionEngineConfig {
  minActionInterval: number; // minimum seconds between actions (default: 30)
  maxActionInterval: number; // maximum seconds between actions (default: 60)
  difficulty: number; // 1-10 difficulty level
  aggressiveness: number; // 0-1 how aggressive the commander is
  defensiveThreshold: number; // threat level above which to prioritize defense
}

/**
 * Result of a decision evaluation
 */
export interface DecisionResult {
  decision: GMDecision;
  objective: CommanderObjective | null;
  sqfCode: string | null;
  reasoning: string;
  shouldExecute: boolean;
  waitReason?: string;
}

/**
 * Context provided to the decision engine for evaluation
 */
export interface DecisionContext {
  gameState: GameState;
  threatAssessment: ThreatMatrix;
  knownEnemyPositions: IntelReport[];
  friendlyPositions: Position[];
  hasEstablishedFOB: boolean;
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: DecisionEngineConfig = {
  minActionInterval: 30,
  maxActionInterval: 60,
  difficulty: 5,
  aggressiveness: 0.5,
  defensiveThreshold: 0.7
};

/**
 * Unit type mapping for spawning based on objective type
 */
const OBJECTIVE_UNIT_PREFERENCES: Record<CommanderObjective['type'], UnitType[]> = {
  capture: ['infantrySquads', 'apcs'],
  defend: ['infantrySquads', 'tanks'],
  destroy: ['tanks', 'helicopters', 'aircraft'],
  patrol: ['infantrySquads', 'lightVehicles'],
  reinforce: ['infantrySquads', 'apcs', 'lightVehicles']
};

/**
 * EAST (OPFOR) unit class names by type
 */
const EAST_UNIT_CLASSES: Record<UnitType, string[]> = {
  infantrySquads: [
    'O_Soldier_SL_F',
    'O_Soldier_TL_F',
    'O_Soldier_F',
    'O_Soldier_AR_F',
    'O_Soldier_GL_F',
    'O_medic_F'
  ],
  lightVehicles: ['O_MRAP_02_F', 'O_MRAP_02_hmg_F'],
  apcs: ['O_APC_Wheeled_02_rcws_v2_F', 'O_APC_Tracked_02_cannon_F'],
  tanks: ['O_MBT_02_cannon_F'],
  helicopters: ['O_Heli_Light_02_dynamicLoadout_F', 'O_Heli_Attack_02_dynamicLoadout_F'],
  aircraft: ['O_Plane_CAS_02_dynamicLoadout_F']
};

/**
 * WEST (BLUFOR) unit class names by type
 */
const WEST_UNIT_CLASSES: Record<UnitType, string[]> = {
  infantrySquads: [
    'B_Soldier_SL_F',
    'B_Soldier_TL_F',
    'B_Soldier_F',
    'B_Soldier_AR_F',
    'B_Soldier_GL_F',
    'B_medic_F'
  ],
  lightVehicles: ['B_MRAP_01_F', 'B_MRAP_01_hmg_F'],
  apcs: ['B_APC_Wheeled_01_cannon_F', 'B_APC_Tracked_01_rcws_F'],
  tanks: ['B_MBT_01_cannon_F'],
  helicopters: ['B_Heli_Light_01_dynamicLoadout_F', 'B_Heli_Attack_01_dynamicLoadout_F'],
  aircraft: ['B_Plane_CAS_01_dynamicLoadout_F']
};

/**
 * DecisionEngine - Makes strategic decisions for a commander
 *
 * Integrates objectives, resources, and game state to produce
 * reasoned decisions with executable SQF code.
 */
export class DecisionEngine {
  private side: 'EAST' | 'WEST';
  private objectiveManager: ObjectiveManager;
  private resourceManager: ResourceManager;
  private config: DecisionEngineConfig;
  private lastDecisionTime: number = 0;
  private lastDecisionReasoning: string = '';
  private consecutiveWaits: number = 0;

  constructor(
    side: 'EAST' | 'WEST',
    objectiveManager: ObjectiveManager,
    resourceManager: ResourceManager,
    config?: Partial<DecisionEngineConfig>
  ) {
    this.side = side;
    this.objectiveManager = objectiveManager;
    this.resourceManager = resourceManager;
    this.config = { ...DEFAULT_CONFIG, ...config };

    logger.info('DecisionEngine initialized', {
      side,
      minInterval: this.config.minActionInterval,
      maxInterval: this.config.maxActionInterval,
      difficulty: this.config.difficulty
    });
  }

  /**
   * Make a decision based on current context
   */
  async makeDecision(context: DecisionContext): Promise<DecisionResult> {
    const now = Date.now();
    const timeSinceLastAction = (now - this.lastDecisionTime) / 1000;

    // Check rate limiting
    if (timeSinceLastAction < this.config.minActionInterval) {
      const waitTime = this.config.minActionInterval - timeSinceLastAction;
      logger.debug('Rate limit: too soon since last action', {
        side: this.side,
        timeSinceLastAction: timeSinceLastAction.toFixed(1),
        waitTime: waitTime.toFixed(1)
      });

      return this.createWaitDecision(
        `Rate limited - ${waitTime.toFixed(0)}s remaining before next action`,
        'rate_limit'
      );
    }

    // Check if we have operational capacity
    if (!this.resourceManager.hasOperationalCapacity()) {
      logger.info('No operational capacity', { side: this.side });
      return this.createWaitDecision(
        'Resources critically low - entering consolidation mode',
        'resources_critical'
      );
    }

    // Evaluate the situation
    const evaluation = this.evaluateSituation(context);

    // If no actionable objectives, consider creating one or waiting
    if (!evaluation.topObjective) {
      // Check if we should create a new objective
      if (this.shouldCreateNewObjective(context)) {
        const newObjective = this.createStrategicObjective(context);
        if (newObjective) {
          return this.executeObjective(newObjective, context);
        }
      }

      this.consecutiveWaits++;
      return this.createWaitDecision(
        'No actionable objectives - monitoring battlefield',
        'no_objectives'
      );
    }

    // Execute the top priority objective
    return this.executeObjective(evaluation.topObjective, context);
  }

  /**
   * Evaluate the current battlefield situation
   */
  private evaluateSituation(context: DecisionContext): {
    topObjective: CommanderObjective | null;
    scoringFactors: ObjectiveScoringFactors;
    evaluations: ObjectiveEvaluation[];
  } {
    // Calculate scoring factors from context
    const scoringFactors = this.calculateScoringFactors(context);

    // Get objective evaluations
    const evaluations = this.objectiveManager.evaluateObjectives(scoringFactors);

    // Find the highest-scoring executable objective
    let topObjective: CommanderObjective | null = null;

    for (const evaluation of evaluations) {
      const canExecute = this.canExecuteObjective(evaluation.objective);
      if (canExecute) {
        topObjective = evaluation.objective;
        break;
      }
    }

    return { topObjective, scoringFactors, evaluations };
  }

  /**
   * Calculate scoring factors from decision context
   */
  private calculateScoringFactors(context: DecisionContext): ObjectiveScoringFactors {
    const threat = context.threatAssessment;

    // Calculate friendly unit proximity (simplified)
    const distanceToFriendlyUnits = context.friendlyPositions.length > 0 ? 0.7 : 0.3;

    // Calculate enemy proximity based on known intel
    const distanceToEnemyUnits = context.knownEnemyPositions.length > 0
      ? Math.min(1, context.knownEnemyPositions.length / 5)
      : 0.2;

    // Strategic importance based on FOB status and threat
    const strategicImportance = context.hasEstablishedFOB ? 0.6 : 0.9;

    // Resource availability
    const resources = this.resourceManager.getStatistics();
    const resourceAvailability = resources.hasCapacity
      ? (resources.tickets / resources.maxTickets)
      : 0.1;

    // Time urgency based on threat level
    const timeUrgency = threat.overallThreat > this.config.defensiveThreshold ? 0.9 : 0.5;

    return {
      distanceToFriendlyUnits,
      distanceToEnemyUnits,
      strategicImportance,
      resourceAvailability,
      timeUrgency
    };
  }

  /**
   * Check if an objective can be executed with current resources
   */
  private canExecuteObjective(objective: CommanderObjective): boolean {
    const preferredUnits = OBJECTIVE_UNIT_PREFERENCES[objective.type];

    // Check if we can spawn at least one preferred unit type
    for (const unitType of preferredUnits) {
      if (this.resourceManager.canSpawn(unitType, 1)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Execute an objective by generating decision and SQF code
   */
  private executeObjective(
    objective: CommanderObjective,
    context: DecisionContext
  ): DecisionResult {
    // Determine unit type to spawn
    const unitType = this.selectUnitTypeForObjective(objective);
    if (!unitType) {
      return this.createWaitDecision(
        `Cannot spawn units for objective ${objective.id} - insufficient resources`,
        'insufficient_resources'
      );
    }

    // Calculate spawn position
    const spawnPosition = this.calculateSpawnPosition(objective, context);

    // Generate reasoning
    const reasoning = this.generateReasoning(objective, unitType, context);

    // Generate SQF code
    const sqfCode = this.generateSQFCode(objective, unitType, spawnPosition);

    // Mark objective as active if pending
    if (objective.status === 'pending') {
      this.objectiveManager.updateStatus(objective.id, 'active');
    }

    // Update timing
    this.lastDecisionTime = Date.now();
    this.lastDecisionReasoning = reasoning;
    this.consecutiveWaits = 0;

    // Consume resources
    const consumption = this.resourceManager.consumeForSpawn(unitType, 1);
    if (!consumption.success) {
      logger.warn('Resource consumption failed after check', {
        side: this.side,
        unitType,
        reason: consumption.reason
      });
      return this.createWaitDecision(
        `Resource consumption failed: ${consumption.reason}`,
        'resource_consumption_failed'
      );
    }

    logger.info('Decision made', {
      side: this.side,
      objectiveId: objective.id,
      objectiveType: objective.type,
      unitType,
      reasoning
    });

    return {
      decision: {
        action: 'spawn',
        reasoning,
        urgency: objective.priority >= 8 ? 'immediate' : 'soon',
        parameters: {
          sqf: sqfCode,
          objectiveId: objective.id,
          unitType,
          spawnPosition
        }
      },
      objective,
      sqfCode,
      reasoning,
      shouldExecute: true
    };
  }

  /**
   * Select the best unit type for an objective based on resources
   */
  private selectUnitTypeForObjective(objective: CommanderObjective): UnitType | null {
    const preferredUnits = OBJECTIVE_UNIT_PREFERENCES[objective.type];

    // Scale preferred units by difficulty
    const scaledPreferences = this.config.difficulty >= 7
      ? preferredUnits
      : preferredUnits.slice(0, 2); // Lower difficulty = simpler units

    for (const unitType of scaledPreferences) {
      if (this.resourceManager.canSpawn(unitType, 1)) {
        return unitType;
      }
    }

    return null;
  }

  /**
   * Calculate safe spawn position for objective
   */
  private calculateSpawnPosition(
    objective: CommanderObjective,
    context: DecisionContext
  ): Position {
    const objPos = objective.position;

    // Calculate offset based on objective type
    let offsetDistance = 300; // default spawn distance from objective
    let angle = Math.random() * Math.PI * 2; // random angle

    switch (objective.type) {
      case 'capture':
      case 'destroy':
        // Spawn behind objective relative to enemy
        offsetDistance = 400;
        break;
      case 'defend':
      case 'reinforce':
        // Spawn closer to objective
        offsetDistance = 200;
        break;
      case 'patrol':
        // Spawn at center of patrol area
        offsetDistance = 100;
        break;
    }

    // Apply offset
    const spawnX = objPos.x + Math.cos(angle) * offsetDistance;
    const spawnY = objPos.y + Math.sin(angle) * offsetDistance;

    // Ensure minimum distance from player positions
    const minPlayerDistance = 250;
    for (const player of context.gameState.players) {
      const dist = Math.sqrt(
        Math.pow(spawnX - player.position.x, 2) +
        Math.pow(spawnY - player.position.y, 2)
      );
      if (dist < minPlayerDistance) {
        // Adjust spawn position away from player
        const awayAngle = Math.atan2(
          spawnY - player.position.y,
          spawnX - player.position.x
        );
        return {
          x: player.position.x + Math.cos(awayAngle) * minPlayerDistance,
          y: player.position.y + Math.sin(awayAngle) * minPlayerDistance,
          z: 0
        };
      }
    }

    return { x: spawnX, y: spawnY, z: 0 };
  }

  /**
   * Generate human-readable reasoning for decision
   */
  private generateReasoning(
    objective: CommanderObjective,
    unitType: UnitType,
    context: DecisionContext
  ): string {
    const threat = context.threatAssessment;
    const parts: string[] = [];

    // Objective reasoning
    parts.push(`Executing ${objective.type} objective at priority ${objective.priority}/10.`);

    // Threat assessment
    if (threat.overallThreat > 0.7) {
      parts.push('High threat detected - aggressive response required.');
    } else if (threat.overallThreat > 0.4) {
      parts.push('Moderate enemy presence observed.');
    } else {
      parts.push('Battlefield relatively quiet - proactive action.');
    }

    // Unit selection
    const unitDescriptions: Record<UnitType, string> = {
      infantrySquads: 'infantry squad',
      lightVehicles: 'light vehicle patrol',
      apcs: 'APC with infantry support',
      tanks: 'armored unit',
      helicopters: 'helicopter support',
      aircraft: 'air support'
    };
    parts.push(`Deploying ${unitDescriptions[unitType]}.`);

    // Resource status
    const resources = this.resourceManager.getStatistics();
    if (resources.isCritical) {
      parts.push('Resources critical - limited reinforcements available.');
    }

    return parts.join(' ');
  }

  /**
   * Generate SQF code for spawning units
   * CRITICAL: All SQF code uses SINGLE QUOTES only
   */
  private generateSQFCode(
    objective: CommanderObjective,
    unitType: UnitType,
    spawnPosition: Position
  ): string {
    const sideStr = this.side;
    const unitClasses = this.side === 'EAST'
      ? EAST_UNIT_CLASSES[unitType]
      : WEST_UNIT_CLASSES[unitType];

    // Generate objective-specific SQF based on unit type
    switch (unitType) {
      case 'infantrySquads':
        return this.generateInfantrySQF(objective, spawnPosition, unitClasses, sideStr);
      case 'lightVehicles':
      case 'apcs':
      case 'tanks':
        return this.generateVehicleSQF(objective, spawnPosition, unitClasses[0], sideStr);
      case 'helicopters':
      case 'aircraft':
        return this.generateAirSQF(objective, spawnPosition, unitClasses[0], sideStr);
      default:
        return this.generateInfantrySQF(objective, spawnPosition, unitClasses, sideStr);
    }
  }

  /**
   * Generate SQF for infantry spawn
   * Uses SINGLE QUOTES for all strings
   */
  private generateInfantrySQF(
    objective: CommanderObjective,
    position: Position,
    unitClasses: string[],
    side: string
  ): string {
    const objectivePos = objective.position;
    const behavior = this.getBehaviorForObjective(objective.type);
    const combatMode = this.getCombatModeForObjective(objective.type);
    const skill = Math.min(1, 0.3 + (this.config.difficulty * 0.07));

    // Build unit types array with single quotes
    const unitTypesStr = unitClasses.map(c => `'${c}'`).join(', ');

    return `
// Commander Decision: ${objective.type} objective (${objective.id})
// Reasoning: ${this.lastDecisionReasoning.substring(0, 100)}
private _spawnPos = [${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)}];
private _objectivePos = [${objectivePos.x.toFixed(1)}, ${objectivePos.y.toFixed(1)}, ${objectivePos.z.toFixed(1)}];
private _unitTypes = [${unitTypesStr}];
private _group = createGroup ${side};

// Spawn infantry units
{
  private _unit = _group createUnit [_x, _spawnPos, [], 5, 'FORM'];
  _unit setSkill ${skill.toFixed(2)};
} forEach _unitTypes;

// Set group behavior and combat mode
_group setBehaviour '${behavior}';
_group setCombatMode '${combatMode}';
_group setSpeedMode 'NORMAL';

// Add waypoint to objective position
private _wp = _group addWaypoint [_objectivePos, 50];
_wp setWaypointType '${this.getWaypointTypeForObjective(objective.type)}';
_wp setWaypointBehaviour '${behavior}';
_wp setWaypointCombatMode '${combatMode}';

// Store group reference for tracking
missionNamespace setVariable ['LLMGM_lastGroup_${this.side}', _group];
missionNamespace setVariable ['LLMGM_objective_${objective.id}', _group];

// Log spawn
diag_log format ['[LLMGM] ${this.side} spawned infantry for %1 at %2', '${objective.type}', _spawnPos];

_group
`.trim();
  }

  /**
   * Generate SQF for vehicle spawn
   * Uses SINGLE QUOTES for all strings
   */
  private generateVehicleSQF(
    objective: CommanderObjective,
    position: Position,
    vehicleClass: string,
    side: string
  ): string {
    const objectivePos = objective.position;
    const behavior = this.getBehaviorForObjective(objective.type);
    const combatMode = this.getCombatModeForObjective(objective.type);
    const skill = Math.min(1, 0.3 + (this.config.difficulty * 0.07));

    return `
// Commander Decision: ${objective.type} objective (${objective.id}) - Vehicle
// Reasoning: ${this.lastDecisionReasoning.substring(0, 100)}
private _spawnPos = [${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)}];
private _objectivePos = [${objectivePos.x.toFixed(1)}, ${objectivePos.y.toFixed(1)}, ${objectivePos.z.toFixed(1)}];

// Spawn vehicle
private _vehicle = createVehicle ['${vehicleClass}', _spawnPos, [], 0, 'NONE'];

// Create crew
private _group = createVehicleCrew _vehicle;

// Set crew skills and behavior
{
  _x setSkill ${skill.toFixed(2)};
} forEach units _group;

_group setBehaviour '${behavior}';
_group setCombatMode '${combatMode}';
_group setSpeedMode 'NORMAL';

// Add waypoint to objective
private _wp = _group addWaypoint [_objectivePos, 50];
_wp setWaypointType '${this.getWaypointTypeForObjective(objective.type)}';
_wp setWaypointBehaviour '${behavior}';
_wp setWaypointCombatMode '${combatMode}';

// Store references for tracking
missionNamespace setVariable ['LLMGM_lastVehicle_${this.side}', _vehicle];
missionNamespace setVariable ['LLMGM_lastGroup_${this.side}', _group];
missionNamespace setVariable ['LLMGM_objective_${objective.id}', _group];

// Log spawn
diag_log format ['[LLMGM] ${this.side} spawned vehicle %1 for %2', '${vehicleClass}', '${objective.type}'];

_vehicle
`.trim();
  }

  /**
   * Generate SQF for air unit spawn
   * Uses SINGLE QUOTES for all strings
   */
  private generateAirSQF(
    objective: CommanderObjective,
    position: Position,
    aircraftClass: string,
    side: string
  ): string {
    const objectivePos = objective.position;
    const skill = Math.min(1, 0.4 + (this.config.difficulty * 0.06));

    // Spawn aircraft at altitude
    const spawnAltitude = aircraftClass.includes('Heli') ? 100 : 500;

    return `
// Commander Decision: ${objective.type} objective (${objective.id}) - Air Support
// Reasoning: ${this.lastDecisionReasoning.substring(0, 100)}
private _spawnPos = [${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${spawnAltitude}];
private _objectivePos = [${objectivePos.x.toFixed(1)}, ${objectivePos.y.toFixed(1)}, ${objectivePos.z.toFixed(1)}];

// Spawn aircraft at altitude
private _aircraft = createVehicle ['${aircraftClass}', _spawnPos, [], 0, 'FLY'];

// Create crew
private _group = createVehicleCrew _aircraft;

// Set crew skills
{
  _x setSkill ${skill.toFixed(2)};
} forEach units _group;

_group setBehaviour 'AWARE';
_group setCombatMode 'RED';

// Add search and destroy waypoint
private _wp = _group addWaypoint [_objectivePos, 200];
_wp setWaypointType 'SAD';
_wp setWaypointBehaviour 'AWARE';
_wp setWaypointCombatMode 'RED';

// Add loiter waypoint after SAD
private _wp2 = _group addWaypoint [_objectivePos, 500];
_wp2 setWaypointType 'LOITER';
_wp2 setWaypointLoiterType 'CIRCLE';
_wp2 setWaypointLoiterRadius 500;

// Store references
missionNamespace setVariable ['LLMGM_lastAircraft_${this.side}', _aircraft];
missionNamespace setVariable ['LLMGM_lastGroup_${this.side}', _group];
missionNamespace setVariable ['LLMGM_objective_${objective.id}', _group];

// Log spawn
diag_log format ['[LLMGM] ${this.side} spawned air support %1 for %2', '${aircraftClass}', '${objective.type}'];

_aircraft
`.trim();
  }

  /**
   * Get behavior setting for objective type
   */
  private getBehaviorForObjective(type: CommanderObjective['type']): string {
    const behaviors: Record<CommanderObjective['type'], string> = {
      capture: 'AWARE',
      defend: 'COMBAT',
      destroy: 'COMBAT',
      patrol: 'SAFE',
      reinforce: 'AWARE'
    };
    return behaviors[type];
  }

  /**
   * Get combat mode for objective type
   */
  private getCombatModeForObjective(type: CommanderObjective['type']): string {
    const modes: Record<CommanderObjective['type'], string> = {
      capture: 'YELLOW',
      defend: 'RED',
      destroy: 'RED',
      patrol: 'YELLOW',
      reinforce: 'GREEN'
    };
    return modes[type];
  }

  /**
   * Get waypoint type for objective type
   */
  private getWaypointTypeForObjective(type: CommanderObjective['type']): string {
    const waypoints: Record<CommanderObjective['type'], string> = {
      capture: 'MOVE',
      defend: 'HOLD',
      destroy: 'SAD',
      patrol: 'LOITER',
      reinforce: 'MOVE'
    };
    return waypoints[type];
  }

  /**
   * Determine if we should create a new objective
   */
  private shouldCreateNewObjective(context: DecisionContext): boolean {
    const stats = this.objectiveManager.getStatistics();

    // Create objective if we have none or all are completed/failed
    if (stats.total === 0 || (stats.pending === 0 && stats.active === 0)) {
      return true;
    }

    // Create objective if threat is high and we have no active defense
    if (context.threatAssessment.overallThreat > 0.6) {
      const defendingObjectives = this.objectiveManager.getObjectivesByType('defend');
      if (defendingObjectives.filter(o => o.status === 'active').length === 0) {
        return true;
      }
    }

    // Don't create too many objectives
    if (stats.active >= 3) {
      return false;
    }

    // Create with some randomness based on time since last action
    const timeSinceLastAction = (Date.now() - this.lastDecisionTime) / 1000;
    return timeSinceLastAction > this.config.maxActionInterval;
  }

  /**
   * Create a strategic objective based on current situation
   */
  private createStrategicObjective(context: DecisionContext): CommanderObjective | null {
    const threat = context.threatAssessment;

    // Determine objective type based on threat level and aggressiveness
    let objectiveType: CommanderObjective['type'];

    if (threat.overallThreat > this.config.defensiveThreshold) {
      // High threat - prioritize defense
      objectiveType = 'defend';
    } else if (this.config.aggressiveness > 0.6) {
      // Aggressive commander - attack
      objectiveType = Math.random() > 0.5 ? 'capture' : 'destroy';
    } else {
      // Balanced - patrol or reinforce
      objectiveType = Math.random() > 0.5 ? 'patrol' : 'reinforce';
    }

    // Calculate objective position
    let position: Position;

    if (objectiveType === 'defend') {
      // Defend hotspots or friendly positions
      position = threat.hotspots[0] ?? context.friendlyPositions[0] ?? { x: 0, y: 0, z: 0 };
    } else if (context.knownEnemyPositions.length > 0) {
      // Target known enemy positions
      const target = context.knownEnemyPositions[
        Math.floor(Math.random() * context.knownEnemyPositions.length)
      ];
      position = target.position;
    } else {
      // Random position in area (placeholder)
      position = { x: 5000, y: 5000, z: 0 };
    }

    // Calculate priority based on threat
    const priority = Math.min(10, Math.ceil(threat.overallThreat * 10) + 2);

    const objective = this.objectiveManager.createObjective({
      type: objectiveType,
      position,
      priority,
      strategicValue: priority,
      description: `Auto-generated ${objectiveType} objective based on battlefield analysis`
    });

    logger.info('Created strategic objective', {
      side: this.side,
      objectiveId: objective.id,
      type: objectiveType,
      priority,
      threatLevel: threat.overallThreat.toFixed(2)
    });

    return objective;
  }

  /**
   * Create a wait decision result
   */
  private createWaitDecision(reason: string, waitReason: string): DecisionResult {
    logger.debug('Wait decision', { side: this.side, reason, waitReason });

    return {
      decision: {
        action: 'wait',
        reasoning: reason,
        urgency: 'whenever',
        parameters: { waitReason }
      },
      objective: null,
      sqfCode: null,
      reasoning: reason,
      shouldExecute: false,
      waitReason
    };
  }

  /**
   * Get the last decision reasoning
   */
  getLastDecisionReasoning(): string {
    return this.lastDecisionReasoning;
  }

  /**
   * Get time since last decision in seconds
   */
  getTimeSinceLastDecision(): number {
    return (Date.now() - this.lastDecisionTime) / 1000;
  }

  /**
   * Get decision engine statistics
   */
  getStatistics(): {
    side: 'EAST' | 'WEST';
    lastDecisionTime: number;
    timeSinceLastDecision: number;
    consecutiveWaits: number;
    config: DecisionEngineConfig;
  } {
    return {
      side: this.side,
      lastDecisionTime: this.lastDecisionTime,
      timeSinceLastDecision: this.getTimeSinceLastDecision(),
      consecutiveWaits: this.consecutiveWaits,
      config: { ...this.config }
    };
  }

  /**
   * Update engine configuration
   */
  updateConfig(config: Partial<DecisionEngineConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('DecisionEngine config updated', { side: this.side, config: this.config });
  }

  /**
   * Reset decision timing (useful for testing)
   */
  resetTiming(): void {
    this.lastDecisionTime = 0;
    this.consecutiveWaits = 0;
    logger.debug('Decision timing reset', { side: this.side });
  }
}

/**
 * Factory function to create a DecisionEngine for a specific side
 */
export function createDecisionEngine(
  side: 'EAST' | 'WEST',
  objectiveManager: ObjectiveManager,
  resourceManager: ResourceManager,
  config?: Partial<DecisionEngineConfig>
): DecisionEngine {
  return new DecisionEngine(side, objectiveManager, resourceManager, config);
}
