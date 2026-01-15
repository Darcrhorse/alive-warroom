/**
 * Resource Module - AI Commander Resource and Reinforcement System
 *
 * This module provides comprehensive resource management for AI commanders including:
 * - Ticket-based spawning system with regeneration
 * - Faction-specific unit pools (infantry, vehicles, aircraft)
 * - Support assets (artillery, CAS, resupply, medevac)
 * - Strategic objective bonuses
 * - Difficulty-scaled presets
 *
 * @example
 * ```typescript
 * import { resourceManager, ResourceManager } from './commander/resources';
 *
 * // Check if OPFOR can spawn
 * const tickets = resourceManager.getTickets('EAST');
 * const hasPool = resourceManager.hasPoolAvailable('EAST', 'infantry');
 *
 * // Spend tickets and deduct from pool
 * resourceManager.spendTickets('EAST', 5, 'infantry spawn');
 * resourceManager.deductFromPool('EAST', 'infantry');
 * ```
 */

// Type definitions
export type {
  UnitPoolCategory,
  UnitPool,
  UnitPoolType,
  SupportAssets,
  SupportAssetType,
  CommanderResources,
  SpawnValidation,
  DifficultyPreset,
  SpawnCosts,
  SpendResult,
  RefundResult,
  ObjectiveType,
  ObjectiveBonus,
  SideResources,
  ResourceTransaction,
} from './types';

// Difficulty presets and scaling functions
export {
  BASE_RESOURCE_VALUES,
  BASE_UNIT_POOL,
  BASE_SUPPORT_ASSETS,
  EASY_PRESET,
  MEDIUM_PRESET,
  HARD_PRESET,
  DIFFICULTY_PRESETS,
  getPresetByLevel,
  getPresetByName,
  getScaledUnitPool,
  getScaledSupportAssets,
  getDefaultDifficultyLevel,
  getDefaultPreset,
} from './presets';

// Resource manager class and singleton
export {
  DEFAULT_SPAWN_COSTS,
  SPAWN_TYPE_TO_POOL,
  ResourceManager,
  resourceManager,
} from './manager';

// Spawn validator and validation functions
export type {
  SpawnValidationConfig,
  SpawnRequest,
} from './validator';

export {
  DEFAULT_VALIDATION_CONFIG,
  SpawnValidator,
  spawnValidator,
  validateSpawn,
  canSpawn,
  getSpawnCost,
  getPoolTypeForSpawn,
} from './validator';
