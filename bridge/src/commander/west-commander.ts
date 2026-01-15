/**
 * WEST Commander (BLUFOR) - Faction-specific AI commander implementation
 *
 * The WEST commander represents BLUFOR/NATO forces with defensive-oriented tactics,
 * emphasis on coordinated fire support and air superiority, and combined arms operations.
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
 * WEST (BLUFOR/NATO) unit class names for Arma 3
 * All use the B_ prefix indicating BLUFOR faction
 */
const WEST_UNIT_CLASSES: Record<UnitType, string[]> = {
  infantrySquads: [
    'B_Soldier_SL_F',      // Squad Leader
    'B_Soldier_TL_F',      // Team Leader
    'B_Soldier_F',         // Rifleman
    'B_Soldier_AR_F',      // Autorifleman
    'B_Soldier_GL_F',      // Grenadier
    'B_medic_F',           // Medic
    'B_Soldier_LAT_F',     // Light AT
    'B_soldier_M_F'        // Marksman
  ],
  lightVehicles: [
    'B_MRAP_01_F',         // Hunter (unarmed)
    'B_MRAP_01_hmg_F',     // Hunter HMG
    'B_MRAP_01_gmg_F',     // Hunter GMG
    'B_LSV_01_unarmed_F',  // Prowler (unarmed)
    'B_LSV_01_armed_F'     // Prowler (armed)
  ],
  apcs: [
    'B_APC_Wheeled_01_cannon_F',   // AMV-7 Marshall
    'B_APC_Tracked_01_rcws_F',     // IFV-6c Panther
    'B_APC_Tracked_01_AA_F'        // IFV-6a Cheetah (AA variant)
  ],
  tanks: [
    'B_MBT_01_cannon_F',   // M2A4 Slammer
    'B_MBT_01_TUSK_F',     // M2A4 Slammer UP (TUSK variant)
    'B_AFV_Wheeled_01_cannon_F'  // Rhino MGS
  ],
  helicopters: [
    'B_Heli_Light_01_dynamicLoadout_F',   // MH-9 Hummingbird
    'B_Heli_Attack_01_dynamicLoadout_F',  // AH-99 Blackfoot
    'B_Heli_Transport_01_F'               // UH-80 Ghost Hawk
  ],
  aircraft: [
    'B_Plane_CAS_01_dynamicLoadout_F',    // A-164 Wipeout (CAS)
    'B_Plane_Fighter_01_F',               // F/A-181 Black Wasp II
    'B_UAV_02_dynamicLoadout_F'           // MQ-4A Greyhawk (UCAV)
  ]
};

/**
 * WEST tactical doctrine preferences
 */
interface WestTacticalPreferences {
  aggressiveness: number;
  defensiveThreshold: number;
  preferredUnitTypes: UnitType[];
  tacticalStyle: string;
}

/**
 * WestCommander - BLUFOR AI Commander
 *
 * Characteristics:
 * - Defensive-oriented, combined arms tactics
 * - Emphasis on fire support, air superiority, and coordinated attacks
 * - Preference for holding ground and controlling key positions
 * - Strong reliance on infantry and mechanized combined arms
 * - Higher defensive threshold (more likely to defend than attack)
 */
export class WestCommander extends BaseCommander {
  private tacticalPreferences: WestTacticalPreferences;

  constructor(config: Omit<CommanderConfig, 'side'>) {
    // Force side to WEST
    super({ ...config, side: 'WEST' });

    // Initialize faction-specific tactical preferences
    this.tacticalPreferences = this.initializeTacticalPreferences();

    logger.info('WestCommander initialized', {
      difficulty: this.difficulty,
      mode: config.mode,
      aggressiveness: this.tacticalPreferences.aggressiveness,
      tacticalStyle: this.tacticalPreferences.tacticalStyle
    });
  }

  /**
   * Initialize tactical preferences based on difficulty
   */
  private initializeTacticalPreferences(): WestTacticalPreferences {
    // WEST is less aggressive than EAST (0.3 to 0.7)
    const baseAggressiveness = 0.3 + (this.difficulty / 10) * 0.4;

    // Higher defensive threshold (more likely to defend)
    const defensiveThreshold = Math.max(0.5, 0.9 - (this.difficulty / 10) * 0.3);

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
      // High difficulty: Full combined arms with air superiority
      return ['aircraft', 'helicopters', 'tanks', 'infantrySquads', 'apcs'];
    } else if (this.difficulty >= 5) {
      // Medium difficulty: Mechanized infantry with air support
      return ['infantrySquads', 'apcs', 'helicopters', 'lightVehicles'];
    } else {
      // Low difficulty: Infantry-focused with light vehicle support
      return ['infantrySquads', 'lightVehicles', 'apcs'];
    }
  }

  /**
   * Determine tactical style description
   */
  private determineTacticalStyle(): string {
    if (this.difficulty >= 8) {
      return 'Combined Arms Defense - Coordinated air, armor, and infantry with fire support emphasis';
    } else if (this.difficulty >= 5) {
      return 'Mechanized Defense - Infantry with vehicle support and helicopter QRF';
    } else {
      return 'Light Infantry Defense - Infantry patrols with light vehicle mobility';
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
   * WEST doctrine prioritizes:
   * 1. Defending key positions and objectives
   * 2. Establishing defensive perimeters
   * 3. Reconnaissance and early warning patrols
   */
  generateInitialObjectives(gameState: GameState): void {
    const existingObjectives = this.objectiveManager.getAllObjectives();

    // Don't regenerate if we already have active objectives
    if (existingObjectives.filter(o => o.status === 'pending' || o.status === 'active').length >= 3) {
      logger.debug('WestCommander: Sufficient objectives exist, skipping generation');
      return;
    }

    // Analyze enemy positions for threat assessment
    const enemyPositions = gameState.enemyUnits
      .filter(u => u.side === 'OPFOR')
      .map(u => u.position);

    const friendlyPositions = gameState.friendlyUnits
      .filter(u => u.side === 'BLUFOR')
      .map(u => u.position);

    // Generate defensive objectives for friendly positions
    if (friendlyPositions.length > 0) {
      this.generateDefensiveObjectives(friendlyPositions, enemyPositions);
    }

    // Generate patrol objectives for reconnaissance
    this.generatePatrolObjectives(gameState);

    // Generate reinforce objectives if under pressure
    if (enemyPositions.length > 0) {
      this.generateReinforcementObjectives(friendlyPositions, enemyPositions);
    }

    logger.info('WestCommander: Initial objectives generated', {
      total: this.objectiveManager.getAllObjectives().length
    });
  }

  /**
   * Generate defensive objectives to protect friendly positions
   */
  private generateDefensiveObjectives(
    friendlyPositions: Position[],
    enemyPositions: Position[]
  ): void {
    // Identify positions under threat
    const threatenedPositions = friendlyPositions.filter(fp => {
      for (const ep of enemyPositions) {
        const distance = this.calculatePositionDistance(fp, ep);
        if (distance < 1000) {
          return true;
        }
      }
      return false;
    });

    // Create defend objectives for threatened positions
    for (const pos of threatenedPositions.slice(0, 2)) {
      const existingDefense = this.objectiveManager.getObjectivesByType('defend')
        .some(d => this.isNearPosition(d.position, pos, 200));

      if (!existingDefense) {
        this.objectiveManager.createObjective({
          type: 'defend',
          position: pos,
          priority: Math.min(10, 7 + Math.floor(this.difficulty / 3)),
          strategicValue: 9,
          description: 'WEST Defense: Hold position against enemy advance'
        });
      }
    }

    // Create general defensive perimeter if no immediate threats
    if (threatenedPositions.length === 0 && friendlyPositions.length > 0) {
      const centralPosition = this.calculateCentroid(friendlyPositions);
      this.objectiveManager.createObjective({
        type: 'defend',
        position: centralPosition,
        priority: 5,
        strategicValue: 7,
        description: 'WEST Defense: Establish defensive perimeter'
      });
    }
  }

  /**
   * Generate patrol objectives for reconnaissance and early warning
   */
  private generatePatrolObjectives(gameState: GameState): void {
    // Patrol near mission objectives for security
    const existingObjectivePositions = gameState.objectives.map(o => o.position);

    if (existingObjectivePositions.length > 0) {
      // Security patrol around objectives
      const patrolPoint = existingObjectivePositions[
        Math.floor(Math.random() * existingObjectivePositions.length)
      ];

      this.objectiveManager.createObjective({
        type: 'patrol',
        position: this.offsetPosition(patrolPoint, 200, 400),
        priority: 4,
        strategicValue: 5,
        description: 'WEST Patrol: Security sweep and reconnaissance'
      });
    } else {
      // Generate patrol in defensive sector
      this.objectiveManager.createObjective({
        type: 'patrol',
        position: { x: 4000 + Math.random() * 2000, y: 4000 + Math.random() * 2000, z: 0 },
        priority: 3,
        strategicValue: 4,
        description: 'WEST Patrol: Area reconnaissance and early warning'
      });
    }
  }

  /**
   * Generate reinforcement objectives for positions under pressure
   */
  private generateReinforcementObjectives(
    friendlyPositions: Position[],
    enemyPositions: Position[]
  ): void {
    if (friendlyPositions.length === 0) {
      return;
    }

    // Find position closest to enemy for reinforcement
    let closestPosition: Position | null = null;
    let shortestDistance = Infinity;

    for (const fp of friendlyPositions) {
      for (const ep of enemyPositions) {
        const distance = this.calculatePositionDistance(fp, ep);
        if (distance < shortestDistance) {
          shortestDistance = distance;
          closestPosition = fp;
        }
      }
    }

    // Create reinforce objective if position is under pressure
    if (closestPosition && shortestDistance < 800) {
      const existingReinforce = this.objectiveManager.getObjectivesByType('reinforce')
        .some(r => this.isNearPosition(r.position, closestPosition!, 300));

      if (!existingReinforce) {
        this.objectiveManager.createObjective({
          type: 'reinforce',
          position: closestPosition,
          priority: Math.min(10, 6 + Math.floor(this.difficulty / 2)),
          strategicValue: 8,
          description: 'WEST Reinforce: Bolster defensive position'
        });
      }
    }
  }

  /**
   * Get faction-specific unit class names for spawning
   * @implements BaseCommander.getUnitClasses
   */
  getUnitClasses(unitType: UnitType): string[] {
    const classes = WEST_UNIT_CLASSES[unitType];

    if (!classes || classes.length === 0) {
      logger.warn('WestCommander: No unit classes found for type', { unitType });
      return WEST_UNIT_CLASSES.infantrySquads; // Fallback to infantry
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
    const infantry = WEST_UNIT_CLASSES.infantrySquads;
    const composition: string[] = [];

    // Always include squad leader
    composition.push(infantry[0]); // SL

    // Add team leader for larger squads
    if (size >= 4) {
      composition.push(infantry[1]); // TL
    }

    // WEST doctrine emphasizes medics and support
    const fillerUnits = [
      infantry[2], // Rifleman
      infantry[3], // AR
      infantry[5], // Medic (prioritized for WEST)
      infantry[4]  // Grenadier
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

    // High threat: Deploy air support and armor for defense
    if (threatLevel > 0.7) {
      if (preferred.includes('helicopters')) {
        return 'helicopters'; // QRF with air support
      }
      return preferred.includes('tanks') ? 'tanks' : 'apcs';
    }

    // Medium threat: Mechanized infantry response
    if (threatLevel > 0.4) {
      return preferred.includes('apcs') ? 'apcs' : 'infantrySquads';
    }

    // Low threat: Infantry patrol and reconnaissance
    return preferred.includes('infantrySquads') ? 'infantrySquads' : 'lightVehicles';
  }

  /**
   * Check if commander should request fire support
   * WEST doctrine emphasizes fire support over direct engagement
   */
  shouldRequestFireSupport(): boolean {
    const stats = this.getStatistics();

    // Request fire support when under significant threat
    if (stats.threatLevel > 0.5) {
      return true;
    }

    // Request fire support if armor threat is significant
    if (stats.resources.hasCapacity) {
      const prefs = this.getTacticalPreferences();
      return prefs.aggressiveness < 0.5 && stats.threatLevel > 0.3;
    }

    return false;
  }

  /**
   * Check if commander should consolidate positions
   * WEST prefers holding ground over expanding
   */
  shouldConsolidatePositions(): boolean {
    const stats = this.getStatistics();

    // Consolidate if resources are getting low
    if (stats.resources.isCritical) {
      return true;
    }

    // Consolidate if threat is high and aggressiveness is low
    if (stats.threatLevel > 0.6 && this.tacticalPreferences.aggressiveness < 0.5) {
      return true;
    }

    // Consolidate if too many active objectives
    if (stats.objectives.active > 4) {
      return true;
    }

    return false;
  }

  /**
   * Calculate distance between two positions
   */
  private calculatePositionDistance(pos1: Position, pos2: Position): number {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    const dz = pos1.z - pos2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Calculate centroid of multiple positions
   */
  private calculateCentroid(positions: Position[]): Position {
    if (positions.length === 0) {
      return { x: 5000, y: 5000, z: 0 };
    }

    const sum = positions.reduce(
      (acc, pos) => ({
        x: acc.x + pos.x,
        y: acc.y + pos.y,
        z: acc.z + pos.z
      }),
      { x: 0, y: 0, z: 0 }
    );

    return {
      x: sum.x / positions.length,
      y: sum.y / positions.length,
      z: sum.z / positions.length
    };
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
    return this.calculatePositionDistance(pos1, pos2) <= maxDistance;
  }
}

/**
 * Factory function to create a WestCommander instance
 */
export function createWestCommander(
  mode: CommanderConfig['mode'],
  difficulty: number,
  options?: {
    maxUnits?: number;
    initialResources?: CommanderConfig['initialResources'];
  }
): WestCommander {
  return new WestCommander({
    mode,
    difficulty,
    maxUnits: options?.maxUnits,
    initialResources: options?.initialResources
  });
}
