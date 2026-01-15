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

/**
 * Represents the available and maximum counts for a unit pool category
 */
export interface UnitPoolCategory {
  available: number;
  max: number;
}

/**
 * Faction-specific limits on unit types
 * Pools deplete as units spawn and track available vs max counts
 */
export interface UnitPool {
  infantry: UnitPoolCategory;
  lightVehicle: UnitPoolCategory;
  heavyArmor: UnitPoolCategory;
  helicopter: UnitPoolCategory;
  fixedWing: UnitPoolCategory;
}

/**
 * Unit pool type keys for validation and lookup
 */
export type UnitPoolType = keyof UnitPool;

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
