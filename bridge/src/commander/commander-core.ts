/**
 * Commander Core - Base commander abstract class with state management,
 * fog of war integration, decision processing, and common commander logic.
 */

import {
  GameState,
  CommanderState,
  CommanderMode,
  CommanderObjective,
  Position,
  IntelReport,
  ThreatMatrix,
  UnitPool,
  GroupInfo,
  Unit,
  GMDecision
} from '../game-state/types';
import { ObjectiveManager, createObjectiveManager, ObjectiveScoringFactors } from './objectives';
import { ResourceManager, createResourceManager, UnitType, ResourceSnapshot } from './resources';
import { DecisionEngine, createDecisionEngine, DecisionResult, DecisionContext, DecisionEngineConfig } from './decisions';
import { logger } from '../utils/logger';

/**
 * Configuration options for initializing a commander
 */
export interface CommanderConfig {
  side: 'EAST' | 'WEST';
  mode: CommanderMode;
  difficulty: number; // 1-10
  maxUnits?: number;
  initialResources?: {
    pool?: Partial<UnitPool>;
    tickets?: number;
    ammo?: number;
    fuel?: number;
  };
  decisionConfig?: Partial<DecisionEngineConfig>;
}

/**
 * Result of processing a game state update
 */
export interface ProcessingResult {
  decision: DecisionResult;
  stateSnapshot: CommanderState;
  shouldAct: boolean;
}

/**
 * Fog of war configuration
 */
export interface FogOfWarConfig {
  detectionRange: number; // meters for infantry
  vehicleDetectionRange: number; // meters for vehicles
  airDetectionRange: number; // meters for aircraft
  intelDecayTime: number; // milliseconds before intel becomes stale
  confidenceDecayRate: number; // 0-1 per minute
}

/**
 * Default fog of war settings
 */
const DEFAULT_FOG_CONFIG: FogOfWarConfig = {
  detectionRange: 500,
  vehicleDetectionRange: 1000,
  airDetectionRange: 2000,
  intelDecayTime: 300000, // 5 minutes
  confidenceDecayRate: 0.1
};

/**
 * BaseCommander - Abstract base class for AI commanders
 *
 * Provides core functionality for state management, fog of war,
 * decision processing, and intel tracking. Extended by faction-specific
 * commanders (EastCommander, WestCommander).
 */
export abstract class BaseCommander {
  protected side: 'EAST' | 'WEST';
  protected mode: CommanderMode;
  protected difficulty: number;
  protected isActive: boolean = false;
  protected hasEstablishedFOB: boolean = false;

  // Core managers
  protected objectiveManager: ObjectiveManager;
  protected resourceManager: ResourceManager;
  protected decisionEngine: DecisionEngine;

  // Intel tracking
  protected knownEnemyPositions: IntelReport[] = [];
  protected lastContactTimes: Record<string, number> = {};
  protected threatAssessment: ThreatMatrix;

  // Deployed groups tracking
  protected deployedGroups: GroupInfo[] = [];

  // Fog of war configuration
  protected fogConfig: FogOfWarConfig;

  // Last processed state
  protected lastGameState: GameState | null = null;
  protected lastDecisionReasoning: string = '';
  protected lastActionTime: number = 0;

  constructor(config: CommanderConfig) {
    this.side = config.side;
    this.mode = config.mode;
    this.difficulty = Math.max(1, Math.min(10, config.difficulty));
    this.fogConfig = { ...DEFAULT_FOG_CONFIG };

    // Initialize threat assessment with defaults
    this.threatAssessment = this.createDefaultThreatMatrix();

    // Initialize core managers
    this.objectiveManager = createObjectiveManager(this.side);
    this.resourceManager = createResourceManager(this.side, {
      initialPool: config.initialResources?.pool,
      initialTickets: config.initialResources?.tickets,
      initialAmmo: config.initialResources?.ammo,
      initialFuel: config.initialResources?.fuel,
      maxUnits: config.maxUnits ?? 50
    });

    // Scale decision engine config based on difficulty
    const decisionConfig = this.scaleConfigByDifficulty(config.decisionConfig);
    this.decisionEngine = createDecisionEngine(
      this.side,
      this.objectiveManager,
      this.resourceManager,
      decisionConfig
    );

    logger.info('BaseCommander initialized', {
      side: this.side,
      mode: this.mode,
      difficulty: this.difficulty
    });
  }

  /**
   * Activate the commander
   */
  activate(): void {
    if (this.isActive) {
      logger.warn('Commander already active', { side: this.side });
      return;
    }

    this.isActive = true;
    this.resourceManager.startRegeneration();

    logger.info('Commander activated', { side: this.side });
  }

  /**
   * Deactivate the commander
   */
  deactivate(): void {
    if (!this.isActive) {
      logger.warn('Commander already inactive', { side: this.side });
      return;
    }

    this.isActive = false;
    this.resourceManager.stopRegeneration();

    logger.info('Commander deactivated', { side: this.side });
  }

  /**
   * Process a game state update and return decisions
   */
  async processGameState(gameState: GameState): Promise<ProcessingResult> {
    if (!this.isActive) {
      logger.debug('Commander inactive, skipping processing', { side: this.side });
      return {
        decision: this.createInactiveDecision(),
        stateSnapshot: this.getState(),
        shouldAct: false
      };
    }

    // Apply fog of war to filter what this commander can see
    const filteredState = this.applyFogOfWar(gameState);

    // Update intel based on filtered state
    this.updateIntel(filteredState);

    // Update threat assessment
    this.threatAssessment = this.assessThreats(filteredState);

    // Build decision context
    const context = this.buildDecisionContext(filteredState);

    // Get decision from engine
    const decision = await this.decisionEngine.makeDecision(context);

    // Update tracking
    if (decision.shouldExecute) {
      this.lastActionTime = Date.now();
      this.lastDecisionReasoning = decision.reasoning;
    }

    // Store last game state
    this.lastGameState = filteredState;

    logger.debug('Game state processed', {
      side: this.side,
      shouldAct: decision.shouldExecute,
      action: decision.decision.action
    });

    return {
      decision,
      stateSnapshot: this.getState(),
      shouldAct: decision.shouldExecute
    };
  }

  /**
   * Apply fog of war to game state - filter enemy visibility
   */
  protected applyFogOfWar(gameState: GameState): GameState {
    // Get positions of our units for detection
    const ownUnits = this.side === 'EAST'
      ? gameState.enemyUnits.filter(u => u.side === 'OPFOR')
      : gameState.friendlyUnits.filter(u => u.side === 'BLUFOR');

    // Determine which enemy units we can see
    const visibleEnemies = this.side === 'EAST'
      ? this.filterVisibleUnits(gameState.friendlyUnits, ownUnits)
      : this.filterVisibleUnits(gameState.enemyUnits, ownUnits);

    // Partially visible enemies become intel reports with reduced confidence
    const partialEnemies = this.side === 'EAST'
      ? this.getPartiallyVisibleUnits(gameState.friendlyUnits, ownUnits)
      : this.getPartiallyVisibleUnits(gameState.enemyUnits, ownUnits);

    // Update intel from partial detections
    for (const partial of partialEnemies) {
      this.addOrUpdateIntel({
        id: `partial_${partial.id}`,
        position: partial.position,
        unitType: this.classifyUnitType(partial),
        estimatedStrength: 1,
        confidence: partial.confidence,
        lastSeen: Date.now(),
        source: 'visual'
      });
    }

    // Return filtered game state
    return {
      ...gameState,
      enemyUnits: this.side === 'EAST' ? visibleEnemies : gameState.enemyUnits,
      friendlyUnits: this.side === 'WEST' ? visibleEnemies : gameState.friendlyUnits
    };
  }

  /**
   * Filter units that are fully visible to our forces
   */
  protected filterVisibleUnits(targetUnits: Unit[], ownUnits: Unit[]): Unit[] {
    return targetUnits.filter(target => {
      for (const own of ownUnits) {
        const distance = this.calculateDistance(own.position, target.position);
        const detectionRange = this.getDetectionRange(own, target);

        if (distance <= detectionRange) {
          return true;
        }
      }
      return false;
    });
  }

  /**
   * Get partially visible units with confidence levels
   */
  protected getPartiallyVisibleUnits(
    targetUnits: Unit[],
    ownUnits: Unit[]
  ): Array<Unit & { confidence: number }> {
    const partial: Array<Unit & { confidence: number }> = [];

    for (const target of targetUnits) {
      let bestConfidence = 0;

      for (const own of ownUnits) {
        const distance = this.calculateDistance(own.position, target.position);
        const detectionRange = this.getDetectionRange(own, target);
        const extendedRange = detectionRange * 2;

        if (distance > detectionRange && distance <= extendedRange) {
          // Partial detection - confidence decreases with distance
          const confidence = 1 - ((distance - detectionRange) / detectionRange);
          bestConfidence = Math.max(bestConfidence, confidence);
        }
      }

      if (bestConfidence > 0.1) {
        partial.push({ ...target, confidence: bestConfidence });
      }
    }

    return partial;
  }

  /**
   * Get detection range based on unit types
   */
  protected getDetectionRange(observer: Unit, target: Unit): number {
    // Base detection range
    let range = this.fogConfig.detectionRange;

    // Observer bonuses
    if (observer.vehicle) {
      range = this.fogConfig.vehicleDetectionRange;
    }

    // Target modifiers (vehicles are easier to spot)
    if (target.vehicle) {
      range *= 1.5;
    }

    // Behavior modifiers
    if (target.behavior === 'STEALTH') {
      range *= 0.5;
    } else if (target.behavior === 'COMBAT') {
      range *= 1.2;
    }

    return range;
  }

  /**
   * Update intel based on current observations
   */
  protected updateIntel(gameState: GameState): void {
    const now = Date.now();

    // Add intel from visible enemy units
    const enemyUnits = this.side === 'EAST'
      ? gameState.friendlyUnits
      : gameState.enemyUnits;

    for (const unit of enemyUnits) {
      this.addOrUpdateIntel({
        id: `unit_${unit.id}`,
        position: unit.position,
        unitType: this.classifyUnitType(unit),
        estimatedStrength: 1,
        confidence: 1.0,
        lastSeen: now,
        source: 'visual'
      });
    }

    // Decay old intel
    this.decayIntel(now);

    // Update contact times for areas with activity
    for (const intel of this.knownEnemyPositions) {
      const areaKey = this.getAreaKey(intel.position);
      this.lastContactTimes[areaKey] = intel.lastSeen;
    }
  }

  /**
   * Add or update an intel report
   */
  protected addOrUpdateIntel(report: IntelReport): void {
    const existingIndex = this.knownEnemyPositions.findIndex(
      r => r.id === report.id
    );

    if (existingIndex >= 0) {
      // Update existing report
      this.knownEnemyPositions[existingIndex] = report;
    } else {
      // Add new report
      this.knownEnemyPositions.push(report);
    }

    // Limit total intel reports
    if (this.knownEnemyPositions.length > 50) {
      // Remove oldest, lowest confidence reports
      this.knownEnemyPositions.sort((a, b) => {
        const scoreA = a.confidence * a.lastSeen;
        const scoreB = b.confidence * b.lastSeen;
        return scoreB - scoreA;
      });
      this.knownEnemyPositions = this.knownEnemyPositions.slice(0, 50);
    }
  }

  /**
   * Decay old intel - reduce confidence over time
   */
  protected decayIntel(now: number): void {
    const decayPerMs = this.fogConfig.confidenceDecayRate / 60000;

    this.knownEnemyPositions = this.knownEnemyPositions.filter(intel => {
      const age = now - intel.lastSeen;

      // Remove stale intel
      if (age > this.fogConfig.intelDecayTime) {
        return false;
      }

      // Decay confidence
      intel.confidence = Math.max(0.1, intel.confidence - (age * decayPerMs));
      return intel.confidence > 0.1;
    });
  }

  /**
   * Assess threats based on current intel
   */
  protected assessThreats(gameState: GameState): ThreatMatrix {
    const enemyUnits = this.side === 'EAST'
      ? gameState.friendlyUnits
      : gameState.enemyUnits;

    // Count threats by type
    let infantryCount = 0;
    let armorCount = 0;
    let airCount = 0;
    const hotspots: Position[] = [];

    for (const unit of enemyUnits) {
      if (unit.vehicle?.includes('Tank') || unit.vehicle?.includes('MBT')) {
        armorCount++;
      } else if (unit.vehicle?.includes('Heli') || unit.vehicle?.includes('Plane')) {
        airCount++;
      } else {
        infantryCount++;
      }

      // Add high-activity areas as hotspots
      hotspots.push(unit.position);
    }

    // Calculate threat levels (normalized 0-1)
    const totalThreats = enemyUnits.length + this.knownEnemyPositions.length;
    const maxThreatUnits = 20; // Reference point for max threat

    const infantryThreat = Math.min(1, infantryCount / maxThreatUnits);
    const armorThreat = Math.min(1, (armorCount * 2) / maxThreatUnits);
    const airThreat = Math.min(1, (airCount * 3) / maxThreatUnits);
    const overallThreat = Math.min(1, totalThreats / maxThreatUnits);

    // Identify safe zones (areas without recent contact)
    const safeZones = this.identifySafeZones(gameState);

    // Predict enemy objective based on movement patterns
    const predictedEnemyObjective = this.predictEnemyObjective();

    return {
      overallThreat,
      infantryThreat,
      armorThreat,
      airThreat,
      artilleryThreat: 0, // Not tracked in current implementation
      hotspots: this.clusterPositions(hotspots),
      safeZones,
      predictedEnemyObjective
    };
  }

  /**
   * Build decision context from filtered game state
   */
  protected buildDecisionContext(gameState: GameState): DecisionContext {
    // Get friendly positions for context
    const friendlyUnits = this.side === 'EAST'
      ? gameState.enemyUnits.filter(u => u.side === 'OPFOR')
      : gameState.friendlyUnits.filter(u => u.side === 'BLUFOR');

    const friendlyPositions = friendlyUnits.map(u => u.position);

    return {
      gameState,
      threatAssessment: this.threatAssessment,
      knownEnemyPositions: this.knownEnemyPositions,
      friendlyPositions,
      hasEstablishedFOB: this.hasEstablishedFOB
    };
  }

  /**
   * Get current commander state snapshot
   */
  getState(): CommanderState {
    const resourceSnapshot = this.resourceManager.getSnapshot();

    return {
      side: this.side,
      mode: this.mode,
      difficulty: this.difficulty,
      availableUnits: resourceSnapshot.unitPool,
      deployedGroups: this.deployedGroups,
      maxUnits: this.resourceManager.getMaxUnits(),
      objectives: this.objectiveManager.getAllObjectives(),
      currentPriority: this.objectiveManager.getHighestPriorityObjective()?.id ?? '',
      reinforcementTickets: resourceSnapshot.reinforcementTickets,
      ammoSupply: resourceSnapshot.ammoSupply,
      fuelSupply: resourceSnapshot.fuelSupply,
      knownEnemyPositions: this.knownEnemyPositions,
      lastContactTimes: this.lastContactTimes,
      threatAssessment: this.threatAssessment,
      lastActionTime: this.lastActionTime,
      lastDecisionReasoning: this.lastDecisionReasoning,
      isActive: this.isActive,
      hasEstablishedFOB: this.hasEstablishedFOB
    };
  }

  /**
   * Add an objective to this commander
   */
  addObjective(
    type: CommanderObjective['type'],
    position: Position,
    priority?: number,
    description?: string
  ): CommanderObjective {
    return this.objectiveManager.createObjective({
      type,
      position,
      priority,
      description
    });
  }

  /**
   * Mark FOB as established
   */
  setFOBEstablished(established: boolean): void {
    this.hasEstablishedFOB = established;
    logger.info('FOB status updated', { side: this.side, established });
  }

  /**
   * Register a deployed group
   */
  registerGroup(group: GroupInfo): void {
    this.deployedGroups.push(group);
    logger.debug('Group registered', { side: this.side, groupId: group.id });
  }

  /**
   * Update deployed group status
   */
  updateGroupStatus(groupId: string, status: GroupInfo['status']): void {
    const group = this.deployedGroups.find(g => g.id === groupId);
    if (group) {
      group.status = status;

      // If destroyed, remove from tracking
      if (status === 'destroyed') {
        this.deployedGroups = this.deployedGroups.filter(g => g.id !== groupId);
        this.objectiveManager.unassignUnitFromAll(groupId);
        logger.info('Group destroyed', { side: this.side, groupId });
      }
    }
  }

  /**
   * Get statistics for this commander
   */
  getStatistics(): {
    side: 'EAST' | 'WEST';
    isActive: boolean;
    difficulty: number;
    objectives: ReturnType<ObjectiveManager['getStatistics']>;
    resources: ReturnType<ResourceManager['getStatistics']>;
    decisions: ReturnType<DecisionEngine['getStatistics']>;
    intelCount: number;
    deployedGroups: number;
    threatLevel: number;
  } {
    return {
      side: this.side,
      isActive: this.isActive,
      difficulty: this.difficulty,
      objectives: this.objectiveManager.getStatistics(),
      resources: this.resourceManager.getStatistics(),
      decisions: this.decisionEngine.getStatistics(),
      intelCount: this.knownEnemyPositions.length,
      deployedGroups: this.deployedGroups.length,
      threatLevel: this.threatAssessment.overallThreat
    };
  }

  /**
   * Reset commander to initial state
   */
  reset(): void {
    this.objectiveManager.clearAll();
    this.resourceManager.reset();
    this.decisionEngine.resetTiming();
    this.knownEnemyPositions = [];
    this.lastContactTimes = {};
    this.deployedGroups = [];
    this.threatAssessment = this.createDefaultThreatMatrix();
    this.lastGameState = null;
    this.lastDecisionReasoning = '';
    this.lastActionTime = 0;
    this.hasEstablishedFOB = false;

    logger.info('Commander reset', { side: this.side });
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.deactivate();
    this.resourceManager.dispose();
    logger.info('Commander disposed', { side: this.side });
  }

  // ============================================================================
  // Abstract methods - must be implemented by faction-specific commanders
  // ============================================================================

  /**
   * Get faction-specific tactical preferences
   */
  abstract getTacticalPreferences(): {
    aggressiveness: number;
    defensiveThreshold: number;
    preferredUnitTypes: UnitType[];
    tacticalStyle: string;
  };

  /**
   * Generate faction-specific initial objectives
   */
  abstract generateInitialObjectives(gameState: GameState): void;

  /**
   * Get faction-specific unit class names
   */
  abstract getUnitClasses(unitType: UnitType): string[];

  // ============================================================================
  // Protected helper methods
  // ============================================================================

  /**
   * Create default threat matrix
   */
  protected createDefaultThreatMatrix(): ThreatMatrix {
    return {
      overallThreat: 0,
      infantryThreat: 0,
      armorThreat: 0,
      airThreat: 0,
      artilleryThreat: 0,
      hotspots: [],
      safeZones: [],
      predictedEnemyObjective: null
    };
  }

  /**
   * Scale decision config based on difficulty
   */
  protected scaleConfigByDifficulty(
    baseConfig?: Partial<DecisionEngineConfig>
  ): Partial<DecisionEngineConfig> {
    // Higher difficulty = faster decisions, more aggressive
    const difficultyFactor = this.difficulty / 10;

    return {
      ...baseConfig,
      difficulty: this.difficulty,
      // Reduce action interval at higher difficulties
      minActionInterval: Math.max(20, 45 - (this.difficulty * 2)),
      maxActionInterval: Math.max(30, 60 - (this.difficulty * 2)),
      // Increase aggressiveness with difficulty
      aggressiveness: baseConfig?.aggressiveness ?? (0.3 + (difficultyFactor * 0.5))
    };
  }

  /**
   * Calculate distance between two positions
   */
  protected calculateDistance(pos1: Position, pos2: Position): number {
    return Math.sqrt(
      Math.pow(pos1.x - pos2.x, 2) +
      Math.pow(pos1.y - pos2.y, 2) +
      Math.pow(pos1.z - pos2.z, 2)
    );
  }

  /**
   * Classify unit type from Unit object
   */
  protected classifyUnitType(unit: Unit): string {
    if (!unit.vehicle) {
      return 'infantry';
    }
    if (unit.vehicle.includes('Tank') || unit.vehicle.includes('MBT')) {
      return 'armor';
    }
    if (unit.vehicle.includes('Heli') || unit.vehicle.includes('Plane')) {
      return 'air';
    }
    return 'vehicle';
  }

  /**
   * Get area key for position (grid-based)
   */
  protected getAreaKey(position: Position): string {
    const gridSize = 500; // 500m grid
    const gridX = Math.floor(position.x / gridSize);
    const gridY = Math.floor(position.y / gridSize);
    return `${gridX}_${gridY}`;
  }

  /**
   * Identify safe zones based on lack of enemy activity
   */
  protected identifySafeZones(gameState: GameState): Position[] {
    const safeZones: Position[] = [];
    const friendlyUnits = this.side === 'EAST'
      ? gameState.enemyUnits.filter(u => u.side === 'OPFOR')
      : gameState.friendlyUnits.filter(u => u.side === 'BLUFOR');

    // Areas near friendly units without recent enemy contact are safe
    for (const friendly of friendlyUnits) {
      const areaKey = this.getAreaKey(friendly.position);
      const lastContact = this.lastContactTimes[areaKey] ?? 0;
      const timeSinceContact = Date.now() - lastContact;

      if (timeSinceContact > 120000) { // 2 minutes
        safeZones.push(friendly.position);
      }
    }

    return this.clusterPositions(safeZones);
  }

  /**
   * Cluster nearby positions to reduce redundancy
   */
  protected clusterPositions(positions: Position[]): Position[] {
    if (positions.length <= 3) {
      return positions;
    }

    const clustered: Position[] = [];
    const used = new Set<number>();
    const clusterRadius = 200;

    for (let i = 0; i < positions.length; i++) {
      if (used.has(i)) continue;

      const cluster: Position[] = [positions[i]];
      used.add(i);

      for (let j = i + 1; j < positions.length; j++) {
        if (used.has(j)) continue;

        const dist = this.calculateDistance(positions[i], positions[j]);
        if (dist < clusterRadius) {
          cluster.push(positions[j]);
          used.add(j);
        }
      }

      // Use centroid of cluster
      const centroid: Position = {
        x: cluster.reduce((sum, p) => sum + p.x, 0) / cluster.length,
        y: cluster.reduce((sum, p) => sum + p.y, 0) / cluster.length,
        z: cluster.reduce((sum, p) => sum + p.z, 0) / cluster.length
      };

      clustered.push(centroid);
    }

    return clustered;
  }

  /**
   * Predict enemy objective based on movement patterns
   */
  protected predictEnemyObjective(): string | null {
    if (this.knownEnemyPositions.length < 3) {
      return null;
    }

    // Find highest concentration of enemy intel
    const hotspot = this.clusterPositions(
      this.knownEnemyPositions.map(i => i.position)
    )[0];

    if (!hotspot) {
      return null;
    }

    // Check if hotspot is near any of our objectives
    const objectives = this.objectiveManager.getAllObjectives();
    for (const obj of objectives) {
      const dist = this.calculateDistance(hotspot, obj.position);
      if (dist < 500) {
        return obj.id;
      }
    }

    return null;
  }

  /**
   * Create an inactive decision result
   */
  protected createInactiveDecision(): DecisionResult {
    return {
      decision: {
        action: 'wait',
        reasoning: 'Commander is inactive',
        urgency: 'whenever',
        parameters: { waitReason: 'inactive' }
      },
      objective: null,
      sqfCode: null,
      reasoning: 'Commander is inactive',
      shouldExecute: false,
      waitReason: 'inactive'
    };
  }
}

/**
 * Type guard to check if an object is a valid CommanderConfig
 */
export function isValidCommanderConfig(obj: unknown): obj is CommanderConfig {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  const config = obj as Record<string, unknown>;

  return (
    (config.side === 'EAST' || config.side === 'WEST') &&
    (config.mode === 'dual' || config.mode === 'east_only' ||
     config.mode === 'west_only' || config.mode === 'interactive') &&
    typeof config.difficulty === 'number' &&
    config.difficulty >= 1 && config.difficulty <= 10
  );
}
