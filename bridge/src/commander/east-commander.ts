/**
 * EAST Commander (OPFOR) - Faction-specific AI commander implementation
 *
 * The EAST commander represents OPFOR/CSAT forces with aggressive tactics,
 * emphasis on armor and mobile warfare, and offensive-focused strategy.
 */

import {
  GameState,
  Position,
  CommanderObjective
} from '../game-state/types';
import { UnitType } from './resources';
import { BaseCommander, CommanderConfig } from './commander-core';
import { logger } from '../utils/logger';

/**
 * EAST (OPFOR/CSAT) unit class names for Arma 3
 * All use the O_ prefix indicating OPFOR faction
 */
const EAST_UNIT_CLASSES: Record<UnitType, string[]> = {
  infantrySquads: [
    'O_Soldier_SL_F',      // Squad Leader
    'O_Soldier_TL_F',      // Team Leader
    'O_Soldier_F',         // Rifleman
    'O_Soldier_AR_F',      // Autorifleman
    'O_Soldier_GL_F',      // Grenadier
    'O_medic_F',           // Medic
    'O_Soldier_LAT_F',     // Light AT
    'O_Soldier_M_F'        // Marksman
  ],
  lightVehicles: [
    'O_MRAP_02_F',         // Ifrit (unarmed)
    'O_MRAP_02_hmg_F',     // Ifrit HMG
    'O_MRAP_02_gmg_F',     // Ifrit GMG
    'O_LSV_02_unarmed_F',  // Qilin (unarmed)
    'O_LSV_02_armed_F'     // Qilin (armed)
  ],
  apcs: [
    'O_APC_Wheeled_02_rcws_v2_F',  // MSE-3 Marid
    'O_APC_Tracked_02_cannon_F',   // BTR-K Kamysh
    'O_APC_Tracked_02_AA_F'        // ZSU-39 Tigris (AA variant)
  ],
  tanks: [
    'O_MBT_02_cannon_F',   // T-100 Varsuk
    'O_MBT_04_cannon_F',   // T-140 Angara
    'O_MBT_04_command_F'   // T-140K (command variant)
  ],
  helicopters: [
    'O_Heli_Light_02_dynamicLoadout_F',  // PO-30 Orca
    'O_Heli_Attack_02_dynamicLoadout_F', // Mi-48 Kajman
    'O_Heli_Transport_04_covered_F'      // Mi-290 Taru (transport)
  ],
  aircraft: [
    'O_Plane_CAS_02_dynamicLoadout_F',   // To-199 Neophron (CAS)
    'O_Plane_Fighter_02_F',              // To-201 Shikra (air superiority)
    'O_UAV_02_dynamicLoadout_F'          // K40 Ababil-3 (UCAV)
  ]
};

/**
 * EAST tactical doctrine preferences
 */
interface EastTacticalPreferences {
  aggressiveness: number;
  defensiveThreshold: number;
  preferredUnitTypes: UnitType[];
  tacticalStyle: string;
}

/**
 * EastCommander - OPFOR AI Commander
 *
 * Characteristics:
 * - Aggressive, offense-focused tactics
 * - Heavy reliance on armor and mechanized infantry
 * - Willing to accept higher casualties for objectives
 * - Favors combined arms with air support
 * - Lower defensive threshold (more likely to attack than defend)
 */
export class EastCommander extends BaseCommander {
  private tacticalPreferences: EastTacticalPreferences;

  constructor(config: Omit<CommanderConfig, 'side'>) {
    // Force side to EAST
    super({ ...config, side: 'EAST' });

    // Initialize faction-specific tactical preferences
    this.tacticalPreferences = this.initializeTacticalPreferences();

    logger.info('EastCommander initialized', {
      difficulty: this.difficulty,
      mode: config.mode,
      aggressiveness: this.tacticalPreferences.aggressiveness,
      tacticalStyle: this.tacticalPreferences.tacticalStyle
    });
  }

  /**
   * Initialize tactical preferences based on difficulty
   */
  private initializeTacticalPreferences(): EastTacticalPreferences {
    // Scale aggressiveness with difficulty (0.5 to 0.9)
    const baseAggressiveness = 0.5 + (this.difficulty / 10) * 0.4;

    // Lower defensive threshold at higher difficulties (more willing to attack)
    const defensiveThreshold = Math.max(0.4, 0.8 - (this.difficulty / 10) * 0.3);

    return {
      aggressiveness: baseAggressiveness,
      defensiveThreshold,
      preferredUnitTypes: this.determinePreferredUnits(),
      tacticalStyle: this.determineTacticalStyle()
    };
  }

  /**
   * Determine preferred unit types based on difficulty
   */
  private determinePreferredUnits(): UnitType[] {
    if (this.difficulty >= 8) {
      // High difficulty: Combined arms with heavy armor and air
      return ['tanks', 'apcs', 'helicopters', 'infantrySquads', 'aircraft'];
    } else if (this.difficulty >= 5) {
      // Medium difficulty: Mechanized infantry with armor support
      return ['apcs', 'infantrySquads', 'tanks', 'lightVehicles'];
    } else {
      // Low difficulty: Light forces with vehicle support
      return ['infantrySquads', 'lightVehicles', 'apcs'];
    }
  }

  /**
   * Determine tactical style description
   */
  private determineTacticalStyle(): string {
    if (this.difficulty >= 8) {
      return 'Combined Arms Assault - Coordinated armor, infantry, and air attacks';
    } else if (this.difficulty >= 5) {
      return 'Mechanized Assault - APC-supported infantry with armor reserve';
    } else {
      return 'Mobile Infantry - Light vehicle supported infantry operations';
    }
  }

  /**
   * Get faction-specific tactical preferences
   * @implements BaseCommander.getTacticalPreferences
   */
  getTacticalPreferences(): {
    aggressiveness: number;
    defensiveThreshold: number;
    preferredUnitTypes: UnitType[];
    tacticalStyle: string;
  } {
    return { ...this.tacticalPreferences };
  }

  /**
   * Generate faction-specific initial objectives based on game state
   * @implements BaseCommander.generateInitialObjectives
   *
   * EAST doctrine prioritizes:
   * 1. Establishing forward operating positions
   * 2. Offensive operations against key targets
   * 3. Aggressive patrol and reconnaissance
   */
  generateInitialObjectives(gameState: GameState): void {
    const existingObjectives = this.objectiveManager.getAllObjectives();

    // Don't regenerate if we already have active objectives
    if (existingObjectives.filter(o => o.status === 'pending' || o.status === 'active').length >= 3) {
      logger.debug('EastCommander: Sufficient objectives exist, skipping generation');
      return;
    }

    // Analyze enemy positions for targeting
    const enemyPositions = gameState.friendlyUnits
      .filter(u => u.side === 'BLUFOR')
      .map(u => u.position);

    const playerPositions = gameState.players.map(p => p.position);

    // Generate offensive objectives based on enemy presence
    if (enemyPositions.length > 0 || playerPositions.length > 0) {
      this.generateOffensiveObjectives(enemyPositions, playerPositions);
    }

    // Generate patrol objectives for area control
    this.generatePatrolObjectives(gameState);

    // Generate capture objectives for strategic points
    this.generateCaptureObjectives(gameState);

    logger.info('EastCommander: Initial objectives generated', {
      total: this.objectiveManager.getAllObjectives().length
    });
  }

  /**
   * Generate offensive objectives targeting enemy positions
   */
  private generateOffensiveObjectives(
    enemyPositions: Position[],
    playerPositions: Position[]
  ): void {
    // Prioritize player positions for engagement
    const priorityTargets = [...playerPositions, ...enemyPositions];

    if (priorityTargets.length === 0) {
      return;
    }

    // Create destroy objective for highest threat area
    const primaryTarget = priorityTargets[0];
    if (primaryTarget) {
      this.objectiveManager.createObjective({
        type: 'destroy',
        position: primaryTarget,
        priority: Math.min(10, 6 + Math.floor(this.difficulty / 3)),
        strategicValue: 8,
        description: 'EAST Offensive: Engage and destroy enemy forces'
      });
    }

    // Create secondary attack objective if high difficulty
    if (this.difficulty >= 6 && priorityTargets.length > 1) {
      const secondaryTarget = priorityTargets[1];
      this.objectiveManager.createObjective({
        type: 'capture',
        position: secondaryTarget,
        priority: 5,
        strategicValue: 6,
        description: 'EAST Offensive: Secondary assault on enemy position'
      });
    }
  }

  /**
   * Generate patrol objectives for area control and reconnaissance
   */
  private generatePatrolObjectives(gameState: GameState): void {
    // Calculate patrol points based on map coverage
    // Use objective positions or generate grid-based patrol points
    const existingObjectivePositions = gameState.objectives.map(o => o.position);

    if (existingObjectivePositions.length > 0) {
      // Patrol near mission objectives
      const patrolPoint = existingObjectivePositions[
        Math.floor(Math.random() * existingObjectivePositions.length)
      ];

      this.objectiveManager.createObjective({
        type: 'patrol',
        position: this.offsetPosition(patrolPoint, 300, 500),
        priority: 3,
        strategicValue: 4,
        description: 'EAST Patrol: Reconnaissance and area denial'
      });
    } else {
      // Generate patrol in random strategic area
      this.objectiveManager.createObjective({
        type: 'patrol',
        position: { x: 5000 + Math.random() * 2000, y: 5000 + Math.random() * 2000, z: 0 },
        priority: 3,
        strategicValue: 3,
        description: 'EAST Patrol: Area reconnaissance'
      });
    }
  }

  /**
   * Generate capture objectives for strategic positions
   */
  private generateCaptureObjectives(gameState: GameState): void {
    // Target active mission objectives for capture
    const activeObjectives = gameState.objectives.filter(o => o.state === 'active');

    for (const obj of activeObjectives.slice(0, 2)) {
      const existingCapture = this.objectiveManager.getObjectivesByType('capture')
        .some(c => this.isNearPosition(c.position, obj.position, 200));

      if (!existingCapture) {
        this.objectiveManager.createObjective({
          type: 'capture',
          position: obj.position,
          priority: Math.min(10, 5 + Math.floor(this.difficulty / 2)),
          strategicValue: 7,
          description: `EAST Capture: Seize ${obj.description || 'strategic position'}`
        });
      }
    }

    // If no mission objectives, create generic capture objectives
    if (activeObjectives.length === 0) {
      this.objectiveManager.createObjective({
        type: 'capture',
        position: { x: 6000, y: 6000, z: 0 },
        priority: 5,
        strategicValue: 6,
        description: 'EAST Capture: Establish forward position'
      });
    }
  }

  /**
   * Get faction-specific unit class names for spawning
   * @implements BaseCommander.getUnitClasses
   */
  getUnitClasses(unitType: UnitType): string[] {
    const classes = EAST_UNIT_CLASSES[unitType];

    if (!classes || classes.length === 0) {
      logger.warn('EastCommander: No unit classes found for type', { unitType });
      return EAST_UNIT_CLASSES.infantrySquads; // Fallback to infantry
    }

    return [...classes];
  }

  /**
   * Get a random unit class for the specified type
   */
  getRandomUnitClass(unitType: UnitType): string {
    const classes = this.getUnitClasses(unitType);
    return classes[Math.floor(Math.random() * classes.length)];
  }

  /**
   * Get infantry composition for a squad
   * Returns an array of unit classes for a balanced squad
   */
  getSquadComposition(size: number = 6): string[] {
    const infantry = EAST_UNIT_CLASSES.infantrySquads;
    const composition: string[] = [];

    // Always include squad leader
    composition.push(infantry[0]); // SL

    // Add team leader for larger squads
    if (size >= 4) {
      composition.push(infantry[1]); // TL
    }

    // Fill remaining slots with balanced composition
    const fillerUnits = [
      infantry[2], // Rifleman
      infantry[3], // AR
      infantry[4], // Grenadier
      infantry[5]  // Medic
    ];

    while (composition.length < size && composition.length < infantry.length) {
      const unit = fillerUnits[composition.length % fillerUnits.length];
      composition.push(unit);
    }

    return composition;
  }

  /**
   * Get recommended unit type for current tactical situation
   */
  getRecommendedUnitType(threatLevel: number): UnitType {
    const preferred = this.tacticalPreferences.preferredUnitTypes;

    // High threat: Deploy heavy armor
    if (threatLevel > 0.7) {
      return preferred.includes('tanks') ? 'tanks' : 'apcs';
    }

    // Medium threat: Mechanized infantry
    if (threatLevel > 0.4) {
      return preferred.includes('apcs') ? 'apcs' : 'infantrySquads';
    }

    // Low threat: Light mobile forces
    return preferred.includes('lightVehicles') ? 'lightVehicles' : 'infantrySquads';
  }

  /**
   * Check if commander should escalate force level
   */
  shouldEscalateForce(): boolean {
    const stats = this.getStatistics();

    // Escalate if losing too many units
    if (stats.resources.isCritical) {
      return false; // Can't escalate with no resources
    }

    // Escalate based on threat level and aggressiveness
    if (stats.threatLevel > 0.6 && this.tacticalPreferences.aggressiveness > 0.6) {
      return true;
    }

    // Escalate if objectives are stalling
    const objectiveStats = stats.objectives;
    if (objectiveStats.active > 0 && objectiveStats.completed === 0) {
      return true;
    }

    return false;
  }

  /**
   * Offset a position by a random amount within min/max range
   */
  private offsetPosition(pos: Position, minOffset: number, maxOffset: number): Position {
    const angle = Math.random() * Math.PI * 2;
    const distance = minOffset + Math.random() * (maxOffset - minOffset);

    return {
      x: pos.x + Math.cos(angle) * distance,
      y: pos.y + Math.sin(angle) * distance,
      z: pos.z
    };
  }

  /**
   * Check if two positions are within a certain distance
   */
  private isNearPosition(pos1: Position, pos2: Position, maxDistance: number): boolean {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    const dz = pos1.z - pos2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz) <= maxDistance;
  }
}

/**
 * Factory function to create an EastCommander instance
 */
export function createEastCommander(
  mode: CommanderConfig['mode'],
  difficulty: number,
  options?: {
    maxUnits?: number;
    initialResources?: CommanderConfig['initialResources'];
  }
): EastCommander {
  return new EastCommander({
    mode,
    difficulty,
    maxUnits: options?.maxUnits,
    initialResources: options?.initialResources
  });
}
