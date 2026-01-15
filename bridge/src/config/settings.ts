/**
 * Configuration management
 */

import { Config } from '../game-state/types';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * Resource system configuration interface
 * Defines settings for the AI Commander Resource and Reinforcement System
 */
export interface ResourceConfig {
  /** Starting tickets for commanders */
  initialTickets: number;
  /** Maximum ticket capacity */
  maxTickets: number;
  /** Tickets regenerated per minute */
  ticketRegen: number;
  /** Hard limit on total active units (performance cap) */
  maxActiveUnits: number;
  /** Minimum time between spawns in milliseconds */
  spawnCooldown: number;
  /** Base unit pool sizes before difficulty scaling */
  baseUnitPool: {
    infantry: number;
    lightVehicle: number;
    heavyArmor: number;
    helicopter: number;
    fixedWing: number;
  };
  /** Support asset base counts before difficulty scaling */
  baseSupportAssets: {
    artilleryStrikes: number;
    casSorties: number;
    resupplyDrops: number;
    medevacMissions: number;
  };
  /** Spawn costs by unit type (in tickets) */
  spawnCosts: {
    infantry: number;
    lightVehicle: number;
    heavyArmor: number;
    helicopter: number;
    fixedWing: number;
    paradrop: number;
  };
}

/**
 * Default resource configuration with environment variable overrides
 * All values can be customized via environment variables
 */
export const defaultResourceConfig: ResourceConfig = {
  // Ticket System - core resource values
  initialTickets: parseInt(process.env.RESOURCE_INITIAL_TICKETS || '100'),
  maxTickets: parseInt(process.env.RESOURCE_MAX_TICKETS || '150'),
  ticketRegen: parseInt(process.env.RESOURCE_TICKET_REGEN || '5'),
  maxActiveUnits: parseInt(process.env.RESOURCE_MAX_ACTIVE_UNITS || '50'),
  spawnCooldown: parseInt(process.env.RESOURCE_SPAWN_COOLDOWN || '30000'),

  // Base Unit Pool - medium difficulty baseline (scaled by difficulty multiplier)
  baseUnitPool: {
    infantry: parseInt(process.env.RESOURCE_POOL_INFANTRY || '30'),
    lightVehicle: parseInt(process.env.RESOURCE_POOL_LIGHT_VEHICLE || '15'),
    heavyArmor: parseInt(process.env.RESOURCE_POOL_HEAVY_ARMOR || '8'),
    helicopter: parseInt(process.env.RESOURCE_POOL_HELICOPTER || '4'),
    fixedWing: parseInt(process.env.RESOURCE_POOL_FIXED_WING || '2'),
  },

  // Base Support Assets - medium difficulty baseline
  baseSupportAssets: {
    artilleryStrikes: parseInt(process.env.RESOURCE_SUPPORT_ARTILLERY || '5'),
    casSorties: parseInt(process.env.RESOURCE_SUPPORT_CAS || '3'),
    resupplyDrops: parseInt(process.env.RESOURCE_SUPPORT_RESUPPLY || '4'),
    medevacMissions: parseInt(process.env.RESOURCE_SUPPORT_MEDEVAC || '3'),
  },

  // Spawn Costs - ticket cost per spawn type
  spawnCosts: {
    infantry: parseInt(process.env.RESOURCE_COST_INFANTRY || '2'),
    lightVehicle: parseInt(process.env.RESOURCE_COST_LIGHT_VEHICLE || '5'),
    heavyArmor: parseInt(process.env.RESOURCE_COST_HEAVY_ARMOR || '10'),
    helicopter: parseInt(process.env.RESOURCE_COST_HELICOPTER || '8'),
    fixedWing: parseInt(process.env.RESOURCE_COST_FIXED_WING || '10'),
    paradrop: parseInt(process.env.RESOURCE_COST_PARADROP || '12'),
  },
};

export const defaultConfig: Config = {
  llm: {
    provider: (process.env.LLM_PROVIDER as any) || 'openai',
    apiKey: process.env.OPENAI_API_KEY || process.env.CLAUDE_API_KEY,
    model: process.env.OPENAI_MODEL || 'gpt-4',
    endpoint: process.env.OLLAMA_ENDPOINT,
    maxTokens: 2000,
    temperature: 0.7
  },
  gm: {
    updateInterval: parseInt(process.env.GM_UPDATE_INTERVAL || '30'),
    minActionInterval: parseInt(process.env.GM_MIN_ACTION_INTERVAL || '60'),
    maxActionInterval: parseInt(process.env.GM_MAX_ACTION_INTERVAL || '300'),
    difficultyBase: parseInt(process.env.GM_DIFFICULTY_BASE || '5'),
    adaptiveDifficulty: process.env.GM_ADAPTIVE_DIFFICULTY !== 'false',
    narrativeMode: process.env.GM_NARRATIVE_MODE !== 'false',
    respectMissionDesign: true
  },
  safety: {
    maxUnitsPerSpawn: parseInt(process.env.SAFETY_MAX_UNITS_PER_SPAWN || '12'),
    minSpawnDistance: parseInt(process.env.SAFETY_MIN_SPAWN_DISTANCE || '200'),
    blockedCommands: [
      'endMission',
      'failMission',
      'forceEnd',
      'terminate',
      'serverCommand',
      'saveProfileNamespace',
      'loadFile',
      'preprocessFile'
    ],
    logAllExecutions: process.env.SAFETY_LOG_ALL_EXECUTIONS !== 'false',
    dryRunMode: process.env.SAFETY_DRY_RUN_MODE === 'true'
  },
  server: {
    port: parseInt(process.env.SERVER_PORT || '3000'),
    host: process.env.SERVER_HOST || 'localhost',
    enableWebSocket: process.env.ENABLE_WEBSOCKET !== 'false',
    enableREST: process.env.ENABLE_REST !== 'false',
    corsOrigins: ['*']
  }
};

export class ConfigManager {
  private config: Config;

  constructor(initialConfig?: Partial<Config>) {
    this.config = { ...defaultConfig, ...initialConfig };
  }

  getConfig(): Config {
    return { ...this.config };
  }

  updateConfig(updates: Partial<Config>): void {
    this.config = { ...this.config, ...updates };
  }

  get<K extends keyof Config>(key: K): Config[K] {
    return this.config[key];
  }

  set<K extends keyof Config>(key: K, value: Config[K]): void {
    this.config[key] = value;
  }
}

export const configManager = new ConfigManager();
