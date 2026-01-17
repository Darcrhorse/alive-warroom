/**
 * Type definitions for AI Commander Resource and Reinforcement System
 *
 * This module defines the core interfaces for managing commander resources,
 * including reinforcement tickets, unit pools, support assets, and spawn validation.
 */

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

/**
 * Time-limited support actions available to commanders
 * Each support type has hourly/mission limits
 */
export interface SupportAssets {
  artilleryStrikes: number;
  casSorties: number;
  resupplyDrops: number;
  medevacMissions: number;
}

/**
 * Support asset type keys for validation and lookup
 */
export type SupportAssetType = keyof SupportAssets;

/**
 * Primary resource tracking interface for AI Commanders
 *
 * This replaces the simple budget system with a multi-layered resource gate
 * that controls all AI spawning decisions through 5 validation checks.
 */
export interface CommanderResources {
  /** Side identifier (EAST = OPFOR, WEST = BLUFOR) */
  side: 'EAST' | 'WEST';

  // Ticket System
  /** Current available tickets for spawning */
  tickets: number;
  /** Maximum ticket capacity */
  maxTickets: number;
  /** Tickets regenerated per minute */
  ticketRegen: number;
  /** Timestamp of last regeneration check */
  lastRegenTime: number;

  // Unit Pools
  /** Faction-specific unit availability pools */
  unitPool: UnitPool;

  // Support Assets
  /** Available support actions */
  supportAssets: SupportAssets;

  // Active Unit Tracking
  /** Currently active spawned units count */
  activeUnits: number;
  /** Hard performance limit on total spawned units */
  maxActiveUnits: number;

  // Spawn Cooldown
  /** Timestamp of last spawn */
  lastSpawnTime: number;
  /** Minimum time between spawns in milliseconds */
  spawnCooldown: number;

  // Strategic Bonuses
  /** List of controlled objective IDs */
  controlledObjectives: string[];
  /** Additional ticket regen per minute from objectives */
  bonusTicketIncome: number;
}

/**
 * Result of spawn validation chain
 * All 5 checks must pass for spawn to be allowed
 */
export interface SpawnValidation {
  /** Whether the spawn is allowed after all checks */
  allowed: boolean;
  /** List of failed check descriptions */
  failedChecks: string[];
  /** Non-blocking warnings */
  warnings: string[];
  /** Ticket cost for this spawn */
  ticketCost: number;
  /** Unit pool category this spawn affects */
  poolType: UnitPoolType;
}

/**
 * Difficulty-scaled resource configuration preset
 * Ranges from Easy (1-3) to Medium (4-6) to Hard (7-10)
 */
export interface DifficultyPreset {
  /** Difficulty level (1-10) */
  level: number;
  /** Starting tickets */
  tickets: number;
  /** Maximum ticket capacity */
  maxTickets: number;
  /** Tickets regenerated per minute */
  ticketRegen: number;
  /** Multiplier for unit pool sizes (0.5 - 2.0) */
  unitPoolMultiplier: number;
  /** Minimum time between spawns in milliseconds */
  spawnCooldown: number;
  /** Hard limit on total active units */
  maxActiveUnits: number;
}

/**
 * Spawn cost configuration by unit type
 * Maps spawn type strings to their ticket costs
 */
export interface SpawnCosts {
  infantry: number;
  lightVehicle: number;
  heavyArmor: number;
  helicopter: number;
  fixedWing: number;
  paradrop: number;
  [key: string]: number;
}

/**
 * Result of a ticket spending operation
 */
export interface SpendResult {
  /** Whether the spend was successful */
  success: boolean;
  /** Remaining tickets after spend (or current if failed) */
  remaining: number;
  /** Error message if spend failed */
  error?: string;
}

/**
 * Result of a ticket refund operation
 */
export interface RefundResult {
  /** Whether the refund was successful */
  success: boolean;
  /** New ticket total after refund */
  newTotal: number;
  /** Error message if refund failed */
  error?: string;
}

/**
 * Strategic objective types that provide resource bonuses
 */
export type ObjectiveType = 'airfield' | 'depot' | 'base' | 'outpost';

/**
 * Bonus configuration for controlled objectives
 */
export interface ObjectiveBonus {
  /** Type of objective */
  type: ObjectiveType;
  /** Additional ticket income per minute */
  ticketIncome: number;
  /** Unit pool bonus (added to max) */
  poolBonus?: Partial<Record<UnitPoolType, number>>;
  /** Support asset bonus */
  supportBonus?: Partial<SupportAssets>;
}

/**
 * Side-specific resource state for tracking both commanders
 */
export interface SideResources {
  EAST: CommanderResources;
  WEST: CommanderResources;
}

/**
 * Resource transaction log entry for debugging
 */
export interface ResourceTransaction {
  /** Timestamp of transaction */
  timestamp: number;
  /** Side that performed the transaction */
  side: 'EAST' | 'WEST';
  /** Type of transaction */
  type: 'spend' | 'refund' | 'regen' | 'bonus' | 'pool_deduct' | 'pool_restore' | 'support_use';
  /** Amount changed */
  amount: number;
  /** Description of the transaction */
  description: string;
  /** Previous value before transaction */
  previousValue: number;
  /** New value after transaction */
  newValue: number;
}
