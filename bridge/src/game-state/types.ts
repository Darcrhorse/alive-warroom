/**
 * Type definitions for Arma 3 game state and related structures
 */

export interface Position {
  x: number;
  y: number;
  z: number;
}

export interface Player {
  uid: string;
  name: string;
  position: Position;
  health: number; // 0-1 (0 = dead, 1 = full health)
  vehicle: string | null;
  weapons: string[];
  currentTask: string | null;
}

export interface Unit {
  id: string;
  type: string;
  position: Position;
  health: number;
  vehicle: string | null;
  behavior: string; // CARELESS, SAFE, AWARE, COMBAT, STEALTH
  side: 'BLUFOR' | 'OPFOR' | 'INDEPENDENT' | 'CIVILIAN';
}

export interface Objective {
  id: string;
  type: string;
  description: string;
  position: Position;
  state: 'active' | 'completed' | 'failed' | 'assigned';
  assignedTo?: string[];
}

export interface GameEvent {
  timestamp: number;
  type: 'kill' | 'objective_complete' | 'objective_failed' | 'radio_message' | 'player_death' | 'unit_spotted' | 'custom';
  data: Record<string, any>;
}

export interface Environment {
  timeOfDay: number; // 0-24
  weather: number; // overcast 0-1
  fog: number; // fog density 0-1
}

export interface MissionContext {
  missionName: string;
  briefing: string;
  elapsedTime: number; // seconds since mission start
}

export interface GameState {
  timestamp: number;
  players: Player[];
  friendlyUnits: Unit[];
  enemyUnits: Unit[];
  objectives: Objective[];
  recentEvents: GameEvent[];
  environment: Environment;
  missionContext: MissionContext;
}

export interface EventHistory {
  events: GameEvent[];
  maxSize: number;
}

export interface GMDecision {
  action: 'spawn' | 'objective' | 'reinforce' | 'extract' | 'narrative' | 'wait';
  reasoning: string;
  urgency: 'immediate' | 'soon' | 'whenever';
  parameters: Record<string, any>;
}

export interface GMAction {
  type: string;
  target?: Position | Unit;
  units?: string[];
  message?: string;
  [key: string]: any;
}

export interface GameContext {
  state: GameState;
  history: EventHistory;
  lastAction?: GMAction;
  lastActionTime?: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface SecurityResult {
  safe: boolean;
  violations: string[];
  blockedPatterns: string[];
}

export interface DifficultyParams {
  enemySkill: number; // 0-1
  enemyCount: number;
  reinforcementRate: number;
  aggressiveness: number; // 0-1
}

export interface PlayerStats {
  averageHealth: number;
  killCount: number;
  deathCount: number;
  objectivesCompleted: number;
  objectivesFailed: number;
  engagementLevel: number; // 0-1
  idleTime: number; // seconds
}

export interface AnalysisResult {
  playerStats: PlayerStats;
  threatLevel: number; // 0-1
  missionProgress: number; // 0-1
  pacing: 'slow' | 'normal' | 'fast';
  shouldAct: boolean;
  suggestedAction: string;
}

export interface Config {
  llm: {
    provider: 'openai' | 'claude' | 'ollama' | 'custom';
    apiKey?: string;
    model: string;
    endpoint?: string;
    maxTokens: number;
    temperature: number;
  };
  gm: {
    updateInterval: number;
    minActionInterval: number;
    maxActionInterval: number;
    difficultyBase: number;
    adaptiveDifficulty: boolean;
    narrativeMode: boolean;
    respectMissionDesign: boolean;
  };
  safety: {
    maxUnitsPerSpawn: number;
    minSpawnDistance: number;
    blockedCommands: string[];
    logAllExecutions: boolean;
    dryRunMode: boolean;
  };
  server: {
    port: number;
    host: string;
    enableWebSocket: boolean;
    enableREST: boolean;
    corsOrigins: string[];
  };
}

// ============================================================================
// Commander System Types
// ============================================================================

/**
 * Operational modes for the AI Commander system
 * - dual: Two AI commanders (EAST vs WEST) fight autonomously
 * - east_only: Only EAST commander active (opposes player on WEST)
 * - west_only: Only WEST commander active (opposes player on EAST)
 * - interactive: Allied commander responds to player chat requests
 */
export type CommanderMode = 'dual' | 'east_only' | 'west_only' | 'interactive';

/**
 * Available units by type for a commander
 */
export interface UnitPool {
  infantrySquads: number;
  lightVehicles: number;
  apcs: number;
  tanks: number;
  helicopters: number;
  aircraft: number;
}

/**
 * Information about a deployed group in the field
 */
export interface GroupInfo {
  id: string;
  type: string; // infantry, armor, air, etc.
  unitCount: number;
  position: Position;
  assignedObjective: string | null;
  status: 'moving' | 'engaged' | 'holding' | 'retreating' | 'destroyed';
  health: number; // 0-1 average health of group
}

/**
 * Intelligence report about enemy positions and activity
 */
export interface IntelReport {
  id: string;
  position: Position;
  unitType: string; // infantry, armor, air, unknown
  estimatedStrength: number; // estimated unit count
  confidence: number; // 0-1 how confident we are in this intel
  lastSeen: number; // timestamp of last observation
  source: 'visual' | 'contact' | 'patrol' | 'radar' | 'comms';
}

/**
 * Threat assessment matrix for battlefield analysis
 */
export interface ThreatMatrix {
  overallThreat: number; // 0-1 overall threat level
  infantryThreat: number; // 0-1
  armorThreat: number; // 0-1
  airThreat: number; // 0-1
  artilleryThreat: number; // 0-1
  hotspots: Position[]; // high-threat areas
  safeZones: Position[]; // low-threat areas
  predictedEnemyObjective: string | null;
}

/**
 * Strategic objective for a commander
 */
export interface CommanderObjective {
  id: string;
  type: 'capture' | 'defend' | 'destroy' | 'patrol' | 'reinforce';
  position: Position;
  priority: number; // 1-10 (10 = highest priority)
  assignedUnits: string[]; // group IDs assigned to this objective
  status: 'pending' | 'active' | 'completed' | 'failed';
  strategicValue: number; // importance to overall mission
  description?: string;
  timeLimit?: number; // optional time limit in seconds
}

/**
 * Complete state of an AI Commander
 */
export interface CommanderState {
  side: 'EAST' | 'WEST';
  mode: CommanderMode;
  difficulty: number; // 1-10

  // Unit tracking
  availableUnits: UnitPool;
  deployedGroups: GroupInfo[];
  maxUnits: number;

  // Objectives
  objectives: CommanderObjective[];
  currentPriority: string; // ID of current priority objective

  // Resources
  reinforcementTickets: number;
  ammoSupply: number; // 0-100 percentage
  fuelSupply: number; // 0-100 percentage

  // Intel
  knownEnemyPositions: IntelReport[];
  lastContactTimes: Record<string, number>; // area ID -> timestamp
  threatAssessment: ThreatMatrix;

  // Timing
  lastActionTime: number;
  lastDecisionReasoning: string;

  // Status flags
  isActive: boolean;
  hasEstablishedFOB: boolean;
}
