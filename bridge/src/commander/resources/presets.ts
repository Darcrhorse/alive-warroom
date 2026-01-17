/**
 * Difficulty-scaled resource presets for AI Commander Resource System
 *
 * Defines Easy, Medium, and Hard difficulty configurations that scale
 * resource availability, regeneration rates, and spawn limits.
 *
 * Difficulty ranges:
 * - Easy (1-3): High tickets, fast regen, generous limits
 * - Medium (4-6): Balanced gameplay
 * - Hard (7-10): Limited resources, slow regen, tight constraints
 */

import * as dotenv from 'dotenv';
import { DifficultyPreset, UnitPool, SupportAssets } from './types';

dotenv.config();

/**
 * Base resource values (Medium difficulty baseline)
 * These can be overridden via environment variables
 */
export const BASE_RESOURCE_VALUES = {
  initialTickets: parseInt(process.env.RESOURCE_INITIAL_TICKETS || '100'),
  maxTickets: parseInt(process.env.RESOURCE_MAX_TICKETS || '150'),
  ticketRegen: parseInt(process.env.RESOURCE_TICKET_REGEN || '5'),
  maxActiveUnits: parseInt(process.env.RESOURCE_MAX_ACTIVE_UNITS || '50'),
  spawnCooldown: parseInt(process.env.RESOURCE_SPAWN_COOLDOWN || '30000'),
};

/**
 * Base unit pool sizes (Medium difficulty)
 * Multiplied by difficulty preset's unitPoolMultiplier
 */
export const BASE_UNIT_POOL: UnitPool = {
  infantry: { available: 30, max: 30 },
  lightVehicle: { available: 15, max: 15 },
  heavyArmor: { available: 8, max: 8 },
  helicopter: { available: 4, max: 4 },
  fixedWing: { available: 2, max: 2 },
};

/**
 * Base support asset counts (Medium difficulty)
 * Scaled by difficulty level
 */
export const BASE_SUPPORT_ASSETS: SupportAssets = {
  artilleryStrikes: 5,
  casSorties: 3,
  resupplyDrops: 4,
  medevacMissions: 3,
};

/**
 * Easy difficulty preset (Levels 1-3)
 * High resources, fast regeneration, generous unit limits
 */
export const EASY_PRESET: DifficultyPreset = {
  level: 2,
  tickets: Math.round(BASE_RESOURCE_VALUES.initialTickets * 1.5),
  maxTickets: Math.round(BASE_RESOURCE_VALUES.maxTickets * 1.5),
  ticketRegen: Math.round(BASE_RESOURCE_VALUES.ticketRegen * 2),
  unitPoolMultiplier: 1.5,
  spawnCooldown: Math.round(BASE_RESOURCE_VALUES.spawnCooldown * 0.5),
  maxActiveUnits: Math.round(BASE_RESOURCE_VALUES.maxActiveUnits * 1.4),
};

/**
 * Medium difficulty preset (Levels 4-6)
 * Balanced gameplay - baseline values
 */
export const MEDIUM_PRESET: DifficultyPreset = {
  level: 5,
  tickets: BASE_RESOURCE_VALUES.initialTickets,
  maxTickets: BASE_RESOURCE_VALUES.maxTickets,
  ticketRegen: BASE_RESOURCE_VALUES.ticketRegen,
  unitPoolMultiplier: 1.0,
  spawnCooldown: BASE_RESOURCE_VALUES.spawnCooldown,
  maxActiveUnits: BASE_RESOURCE_VALUES.maxActiveUnits,
};

/**
 * Hard difficulty preset (Levels 7-10)
 * Limited resources, slow regeneration, tight constraints
 */
export const HARD_PRESET: DifficultyPreset = {
  level: 8,
  tickets: Math.round(BASE_RESOURCE_VALUES.initialTickets * 0.6),
  maxTickets: Math.round(BASE_RESOURCE_VALUES.maxTickets * 0.7),
  ticketRegen: Math.round(BASE_RESOURCE_VALUES.ticketRegen * 0.5),
  unitPoolMultiplier: 0.6,
  spawnCooldown: Math.round(BASE_RESOURCE_VALUES.spawnCooldown * 1.5),
  maxActiveUnits: Math.round(BASE_RESOURCE_VALUES.maxActiveUnits * 0.7),
};

/**
 * All difficulty presets indexed by name
 */
export const DIFFICULTY_PRESETS: Record<string, DifficultyPreset> = {
  easy: EASY_PRESET,
  medium: MEDIUM_PRESET,
  hard: HARD_PRESET,
};

/**
 * Get difficulty preset by numeric level (1-10)
 * Maps level ranges to appropriate preset:
 * - 1-3: Easy
 * - 4-6: Medium
 * - 7-10: Hard
 *
 * @param level - Difficulty level (1-10)
 * @returns Corresponding difficulty preset
 */
export function getPresetByLevel(level: number): DifficultyPreset {
  const clampedLevel = Math.max(1, Math.min(10, level));

  if (clampedLevel <= 3) {
    return { ...EASY_PRESET, level: clampedLevel };
  } else if (clampedLevel <= 6) {
    return { ...MEDIUM_PRESET, level: clampedLevel };
  } else {
    return { ...HARD_PRESET, level: clampedLevel };
  }
}

/**
 * Get difficulty preset by name
 *
 * @param name - Preset name ('easy', 'medium', 'hard')
 * @returns Corresponding difficulty preset or medium as default
 */
export function getPresetByName(name: string): DifficultyPreset {
  const normalizedName = name.toLowerCase();
  return DIFFICULTY_PRESETS[normalizedName] || MEDIUM_PRESET;
}

/**
 * Calculate scaled unit pool based on difficulty multiplier
 *
 * @param preset - Difficulty preset with unitPoolMultiplier
 * @returns Scaled unit pool with adjusted available and max counts
 */
export function getScaledUnitPool(preset: DifficultyPreset): UnitPool {
  const multiplier = preset.unitPoolMultiplier;

  return {
    infantry: {
      available: Math.round(BASE_UNIT_POOL.infantry.max * multiplier),
      max: Math.round(BASE_UNIT_POOL.infantry.max * multiplier),
    },
    lightVehicle: {
      available: Math.round(BASE_UNIT_POOL.lightVehicle.max * multiplier),
      max: Math.round(BASE_UNIT_POOL.lightVehicle.max * multiplier),
    },
    heavyArmor: {
      available: Math.round(BASE_UNIT_POOL.heavyArmor.max * multiplier),
      max: Math.round(BASE_UNIT_POOL.heavyArmor.max * multiplier),
    },
    helicopter: {
      available: Math.round(BASE_UNIT_POOL.helicopter.max * multiplier),
      max: Math.round(BASE_UNIT_POOL.helicopter.max * multiplier),
    },
    fixedWing: {
      available: Math.round(BASE_UNIT_POOL.fixedWing.max * multiplier),
      max: Math.round(BASE_UNIT_POOL.fixedWing.max * multiplier),
    },
  };
}

/**
 * Calculate scaled support assets based on difficulty level
 * Higher difficulty = fewer support assets
 *
 * @param preset - Difficulty preset
 * @returns Scaled support assets
 */
export function getScaledSupportAssets(preset: DifficultyPreset): SupportAssets {
  // Scale based on inverse of difficulty (easier = more assets)
  const scaleFactor = preset.level <= 3 ? 1.5 : preset.level <= 6 ? 1.0 : 0.6;

  return {
    artilleryStrikes: Math.round(BASE_SUPPORT_ASSETS.artilleryStrikes * scaleFactor),
    casSorties: Math.round(BASE_SUPPORT_ASSETS.casSorties * scaleFactor),
    resupplyDrops: Math.round(BASE_SUPPORT_ASSETS.resupplyDrops * scaleFactor),
    medevacMissions: Math.round(BASE_SUPPORT_ASSETS.medevacMissions * scaleFactor),
  };
}

/**
 * Get the default difficulty level from environment or config
 * Reads GM_DIFFICULTY_BASE environment variable (default: 5)
 *
 * @returns Default difficulty level (1-10)
 */
export function getDefaultDifficultyLevel(): number {
  const level = parseInt(process.env.GM_DIFFICULTY_BASE || '5');
  return Math.max(1, Math.min(10, level));
}

/**
 * Get the default preset based on environment configuration
 *
 * @returns Default difficulty preset
 */
export function getDefaultPreset(): DifficultyPreset {
  return getPresetByLevel(getDefaultDifficultyLevel());
}
