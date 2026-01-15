/**
 * Configuration management
 */

import { Config } from '../game-state/types';
import * as dotenv from 'dotenv';

dotenv.config();

export const defaultConfig: Config = {
  llm: {
    // MODE TOGGLE: 'single' = one AI controls both, 'dual' = two AIs battle, 'disabled' = no AI
    mode: (process.env.AI_MODE as 'single' | 'dual' | 'disabled') || 'single',

    // Shared settings (single mode or fallback)
    provider: (process.env.LLM_PROVIDER as any) || 'claude',
    apiKey: process.env.OPENAI_API_KEY || process.env.CLAUDE_API_KEY,
    model: process.env.CLAUDE_MODEL || process.env.OPENAI_MODEL || 'claude-sonnet-4-20250514',
    endpoint: process.env.OLLAMA_ENDPOINT,
    maxTokens: 16384,  // Doubled from 8192 for complex multi-phase operations
    temperature: 0.7,

    // DUAL MODE: EAST Commander (OPFOR) config
    east: {
      apiKey: process.env.CLAUDE_EAST_API_KEY || process.env.CLAUDE_API_KEY,
      model: process.env.CLAUDE_EAST_MODEL || 'claude-sonnet-4-20250514',
    },

    // DUAL MODE: WEST Commander (BLUFOR) config
    west: {
      apiKey: process.env.CLAUDE_WEST_API_KEY || process.env.CLAUDE_API_KEY,
      model: process.env.CLAUDE_WEST_MODEL || 'claude-sonnet-4-20250514',
    }
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
