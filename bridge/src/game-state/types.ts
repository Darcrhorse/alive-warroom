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
  // Enhanced combat effectiveness data
  suppression?: number; // 0-1 (0 = calm, 1 = fully suppressed)
  morale?: number; // -1 to 1 (negative = broken, positive = confident)
  // Combat info - what the unit is doing
  currentCommand?: string; // MOVE, ATTACK, DEFEND, etc.
  assignedTarget?: string; // Type of target being engaged
  hasTarget?: boolean;
  // Ammo status
  ammoStatus?: 'CRITICAL' | 'LOW' | 'MEDIUM' | 'FULL';
  ammoPercent?: number; // 0-1
}

// Target intelligence from targetsQuery
export interface TargetIntel {
  accuracy: number; // How accurate the position info is (0-1)
  type: string; // Target type (e.g., "Man", "Car", "Tank")
  age: number; // How old the intel is in seconds
  position: Position;
  isVehicle: boolean;
  reportedBy: string; // Group ID that reported this
  side: string; // Target's side
}

export interface TargetIntelligence {
  EAST_knows_about_WEST: TargetIntel[];
  WEST_knows_about_EAST: TargetIntel[];
}

// Vehicle status with fuel, damage, mobility
export interface VehicleStatus {
  id: string;
  type: string;
  displayName: string;
  position: Position;
  fuel: number; // 0-1
  damage: number; // 0-1
  canMove: boolean;
  canFire: boolean;
  crewCount: number;
  emptyPositions: number;
  isEngineOn?: boolean;
  direction?: number; // 0-360 degrees
  // Hitpoint damage - specific components (engine, tracks, turret)
  hitpointDamage?: Record<string, number>; // e.g., {"HitEngine": 0.5, "HitLTrack": 0.3}
  // Aircraft-specific
  altitude?: number;
  speed?: number;
  isFlying?: boolean;
  // Logistics capabilities
  isLogistics?: boolean;
  ammoCargo?: number;
  fuelCargo?: number;
  repairCargo?: number;
  // Vehicle-in-vehicle cargo (Blackfish carrying MRAPs)
  vehicleCargo?: string[];
}

export interface SideVehicleStatus {
  EAST: VehicleStatus[];
  WEST: VehicleStatus[];
}

// Casualty tracking using allDeadMen
export interface CasualtyRecord {
  type: string; // Unit classname
  position: Position;
  side: 'EAST' | 'WEST' | 'GUER' | 'CIV'; // Original side from config
}

export interface CasualtyTracking {
  EAST: number;
  WEST: number;
  GUER: number;
  CIV: number;
  recentDeaths: CasualtyRecord[]; // Last N deaths for context
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
  worldName: string; // Map name (e.g., "Altis", "Takistan", "Chernarus")
  briefing: string;
  elapsedTime: number; // seconds since mission start
}

export interface UnitCounts {
  BLUFOR: number;
  OPFOR: number;
  INDEPENDENT: number;
  CIVILIAN: number;
}

// Enhanced group tracking for AI visibility
export interface GroupStatus {
  groupId: string;
  alive: number;
  total: number;
  position: Position;
  behavior: string;  // CARELESS, SAFE, AWARE, COMBAT, STEALTH, DEAD
  combatMode: string;  // BLUE, GREEN, WHITE, YELLOW, RED
  waypointIndex: number;
  waypointType: string;  // MOVE, SAD, DESTROY, TR UNLOAD, etc.
  inCombat: boolean;
  nearbyEnemies: number;
  vehicles: string[];  // Vehicle classnames if mounted
  // Enhanced fields from fn_collectGameState.sqf
  speedMode?: string; // LIMITED, NORMAL, FULL
  formation?: string; // COLUMN, STAG COLUMN, WEDGE, ECH LEFT, ECH RIGHT, VEE, LINE, FILE, DIAMOND
  waypointCount?: number;
  distanceToWaypoint?: number; // meters to current waypoint
  avgSuppression?: number; // 0-1 average suppression of group members
  isMounted?: boolean; // true if group is in vehicles
}

export interface SideGroupStatus {
  EAST: GroupStatus[];
  WEST: GroupStatus[];
}

// Battle objective - the location both commanders fight to control
export interface BattleObjective {
  position: Position;
  name: string;
  distanceFromEastFob: number;
  distanceFromWestFob: number;
  eastUnitsNearby: number;
  westUnitsNearby: number;
  controlStatus: 'NEUTRAL' | 'EAST' | 'WEST' | 'CONTESTED';
}

// Combat summary for quick tactical assessment
export interface CombatSummary {
  EAST: {
    groupsEngaged: number;
    groupsSuppressed: number;
    totalGroups: number;
  };
  WEST: {
    groupsEngaged: number;
    groupsSuppressed: number;
    totalGroups: number;
  };
}

export interface GameState {
  timestamp: number;
  players: Player[];
  // New format - all units with side info
  allUnits?: Unit[];
  unitCounts?: UnitCounts;
  // Enhanced group tracking for AI visibility
  groupStatus?: SideGroupStatus;
  // Battle objective - both sides fight for this location
  battleObjective?: BattleObjective;
  // Legacy format - kept for backwards compatibility
  friendlyUnits?: Unit[];
  enemyUnits?: Unit[];
  objectives: Objective[];
  recentEvents: GameEvent[];
  environment: Environment;
  missionContext: MissionContext;
  // NEW: Enhanced intelligence and status fields
  targetIntelligence?: TargetIntelligence; // What each side knows about enemies
  vehicleStatus?: SideVehicleStatus; // Detailed vehicle status (fuel, damage, etc.)
  casualtyTracking?: CasualtyTracking; // Death counts and recent casualties
  combatSummary?: CombatSummary; // Quick tactical overview
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

// Spawn history tracking for anti-repetition
export type SpawnCategory = 'infantry' | 'light_vehicle' | 'apc' | 'tank' | 'helicopter' | 'static_weapon' | 'support';

export interface SpawnRecord {
  timestamp: number;
  category: SpawnCategory;
  unitTypes: string[];  // Actual classnames spawned
  count: number;        // Number of units
  side: 'EAST' | 'WEST';
  reasoning: string;
}

export interface SpawnHistory {
  records: SpawnRecord[];
  maxRecords: number;  // Keep last N spawns (default 10)
}

// AI Mode - single AI controls both sides, dual AIs battle each other, or disabled for manual control only
export type AIMode = 'single' | 'dual' | 'disabled';

// Side-specific LLM configuration for dual mode
export interface SideLLMConfig {
  apiKey?: string;
  model: string;
}

export interface Config {
  llm: {
    // Mode toggle: 'single' = one AI, 'dual' = two AIs (EAST vs WEST)
    mode: AIMode;
    provider: 'openai' | 'claude' | 'claude-cli' | 'ollama' | 'copilot' | 'custom';
    apiKey?: string;
    model: string;
    endpoint?: string;
    maxTokens: number;
    temperature: number;
    // Dual mode: separate configs for each side
    east?: SideLLMConfig;
    west?: SideLLMConfig;
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
