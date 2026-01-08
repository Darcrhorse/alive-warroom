/**
 * Configuration management
 */

import { Config } from '../game-state/types';
import * as dotenv from 'dotenv';

dotenv.config();

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
