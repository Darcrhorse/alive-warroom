/**
 * ResourceManager - Manages AI Commander resources and reinforcement tickets
 *
 * This service replaces the simple budget system with a multi-layered resource
 * management system including tickets, unit pools, support assets, and strategic bonuses.
 *
 * Follows the singleton pattern from GameStateManager.
 */

import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../../utils/logger';
import {
  CommanderResources,
  UnitPool,
  UnitPoolType,
  SupportAssets,
  SupportAssetType,
  SpendResult,
  RefundResult,
  ResourceTransaction,
  SideResources,
} from './types';
import {
  getDefaultPreset,
  getPresetByLevel,
  getScaledUnitPool,
  getScaledSupportAssets,
} from './presets';

/**
 * Default spawn costs by unit type (in tickets)
 * Matches existing server.ts pattern but mapped to new pool types
 */
export const DEFAULT_SPAWN_COSTS: Record<string, number> = {
  infantry: 1,
  lightVehicle: 5,
  heavyArmor: 15,
  helicopter: 20,
  fixedWing: 30,
  paradrop: 25,
  // Legacy mappings for compatibility with existing spawn types
  light_vehicle: 5,
  apc: 10,
  tank: 20,
  attack_heli: 35,
  jet: 40,
};

/**
 * Maps legacy spawn types to unit pool categories
 */
export const SPAWN_TYPE_TO_POOL: Record<string, UnitPoolType> = {
  infantry: 'infantry',
  lightVehicle: 'lightVehicle',
  light_vehicle: 'lightVehicle',
  apc: 'heavyArmor',
  heavyArmor: 'heavyArmor',
  tank: 'heavyArmor',
  helicopter: 'helicopter',
  attack_heli: 'helicopter',
  fixedWing: 'fixedWing',
  jet: 'fixedWing',
  paradrop: 'infantry',
};

/**
 * Enum representing the status of the last persistence load operation
 */
export enum LoadStatus {
  NOT_LOADED = 'not_loaded',
  SUCCESS = 'success',
  FILE_NOT_FOUND = 'file_not_found',
  EMPTY_FILE = 'empty_file',
  INVALID_JSON = 'invalid_json',
  INVALID_STRUCTURE = 'invalid_structure',
  READ_ERROR = 'read_error',
}

export class ResourceManager {
  private resources: SideResources;
  private transactionHistory: ResourceTransaction[] = [];
  private maxHistorySize: number = 500;
  private lastRegenCheck: number = Date.now();
  private regenIntervalMs: number = 60000; // 1 minute
  private _lastLoadStatus: LoadStatus = LoadStatus.NOT_LOADED;
  private _lastLoadError: string | null = null;

  constructor() {
    // Initialize resources for both sides with default preset
    const preset = getDefaultPreset();
    this.resources = {
      EAST: this.createInitialResources('EAST', preset.level),
      WEST: this.createInitialResources('WEST', preset.level),
    };

    logger.info('ResourceManager initialized', {
      eastTickets: this.resources.EAST.tickets,
      westTickets: this.resources.WEST.tickets,
      difficultyLevel: preset.level,
    });
  }

  /**
   * Create initial resources for a side based on difficulty level
   */
  private createInitialResources(
    side: 'EAST' | 'WEST',
    difficultyLevel: number
  ): CommanderResources {
    const preset = getPresetByLevel(difficultyLevel);
    const unitPool = getScaledUnitPool(preset);
    const supportAssets = getScaledSupportAssets(preset);

    return {
      side,
      tickets: preset.tickets,
      maxTickets: preset.maxTickets,
      ticketRegen: preset.ticketRegen,
      lastRegenTime: Date.now(),
      unitPool,
      supportAssets,
      activeUnits: 0,
      maxActiveUnits: preset.maxActiveUnits,
      lastSpawnTime: 0,
      spawnCooldown: preset.spawnCooldown,
      controlledObjectives: [],
      bonusTicketIncome: 0,
    };
  }

  /**
   * Initialize or reinitialize resources for a specific side
   */
  initializeSide(side: 'EAST' | 'WEST', difficultyLevel: number): void {
    this.resources[side] = this.createInitialResources(side, difficultyLevel);
    logger.info(`Resources initialized for ${side}`, {
      tickets: this.resources[side].tickets,
      difficultyLevel,
    });
  }

  // ==================== State Getters ====================

  /**
   * Get full resources for a side
   */
  getResources(side: 'EAST' | 'WEST'): CommanderResources {
    // Apply pending regeneration before returning
    this.applyTicketRegeneration(side);
    return { ...this.resources[side] };
  }

  /**
   * Get resources for both sides
   */
  getAllResources(): SideResources {
    this.applyTicketRegeneration('EAST');
    this.applyTicketRegeneration('WEST');
    return {
      EAST: { ...this.resources.EAST },
      WEST: { ...this.resources.WEST },
    };
  }

  /**
   * Get current ticket count for a side
   */
  getTickets(side: 'EAST' | 'WEST'): number {
    this.applyTicketRegeneration(side);
    return this.resources[side].tickets;
  }

  /**
   * Get maximum ticket capacity for a side
   */
  getMaxTickets(side: 'EAST' | 'WEST'): number {
    return this.resources[side].maxTickets;
  }

  /**
   * Get ticket regeneration rate for a side
   */
  getTicketRegen(side: 'EAST' | 'WEST'): number {
    return this.resources[side].ticketRegen + this.resources[side].bonusTicketIncome;
  }

  /**
   * Get unit pool for a side
   */
  getUnitPool(side: 'EAST' | 'WEST'): UnitPool {
    return { ...this.resources[side].unitPool };
  }

  /**
   * Get available units in a specific pool category
   */
  getPoolAvailable(side: 'EAST' | 'WEST', poolType: UnitPoolType): number {
    return this.resources[side].unitPool[poolType].available;
  }

  /**
   * Get maximum units in a specific pool category
   */
  getPoolMax(side: 'EAST' | 'WEST', poolType: UnitPoolType): number {
    return this.resources[side].unitPool[poolType].max;
  }

  /**
   * Get deployed units count (max - available) for a pool category
   */
  getPoolDeployed(side: 'EAST' | 'WEST', poolType: UnitPoolType): number {
    const pool = this.resources[side].unitPool[poolType];
    return pool.max - pool.available;
  }

  /**
   * Get support assets for a side
   */
  getSupportAssets(side: 'EAST' | 'WEST'): SupportAssets {
    return { ...this.resources[side].supportAssets };
  }

  /**
   * Get active unit count for a side
   */
  getActiveUnits(side: 'EAST' | 'WEST'): number {
    return this.resources[side].activeUnits;
  }

  /**
   * Get maximum active units allowed for a side
   */
  getMaxActiveUnits(side: 'EAST' | 'WEST'): number {
    return this.resources[side].maxActiveUnits;
  }

  /**
   * Get time since last spawn for a side (milliseconds)
   */
  getTimeSinceLastSpawn(side: 'EAST' | 'WEST'): number {
    if (this.resources[side].lastSpawnTime === 0) {
      return Infinity;
    }
    return Date.now() - this.resources[side].lastSpawnTime;
  }

  /**
   * Get spawn cooldown for a side (milliseconds)
   */
  getSpawnCooldown(side: 'EAST' | 'WEST'): number {
    return this.resources[side].spawnCooldown;
  }

  /**
   * Check if spawn is on cooldown
   */
  isOnCooldown(side: 'EAST' | 'WEST'): boolean {
    return this.getTimeSinceLastSpawn(side) < this.resources[side].spawnCooldown;
  }

  /**
   * Get controlled objectives for a side
   */
  getControlledObjectives(side: 'EAST' | 'WEST'): string[] {
    return [...this.resources[side].controlledObjectives];
  }

  /**
   * Get spawn cost for a unit type
   */
  getSpawnCost(unitType: string): number {
    return DEFAULT_SPAWN_COSTS[unitType] ?? DEFAULT_SPAWN_COSTS.infantry;
  }

  /**
   * Get pool type for a spawn type
   */
  getPoolTypeForSpawn(spawnType: string): UnitPoolType {
    return SPAWN_TYPE_TO_POOL[spawnType] ?? 'infantry';
  }

  // ==================== Ticket Operations ====================

  /**
   * Spend tickets for a spawn
   * @param side - Side spending tickets
   * @param amount - Amount to spend
   * @param description - Description for logging
   * @returns SpendResult with success status and remaining tickets
   */
  spendTickets(side: 'EAST' | 'WEST', amount: number, description: string = ''): SpendResult {
    const resources = this.resources[side];
    const previousValue = resources.tickets;

    // Validate amount
    if (amount <= 0) {
      return {
        success: false,
        remaining: resources.tickets,
        error: 'Invalid spend amount: must be positive',
      };
    }

    // Check if enough tickets
    if (resources.tickets < amount) {
      logger.warn(`Insufficient tickets for ${side}`, {
        requested: amount,
        available: resources.tickets,
        description,
      });
      return {
        success: false,
        remaining: resources.tickets,
        error: `Insufficient tickets: need ${amount}, have ${resources.tickets}`,
      };
    }

    // Deduct tickets (never go negative)
    resources.tickets = Math.max(0, resources.tickets - amount);

    // Log transaction
    this.logTransaction({
      timestamp: Date.now(),
      side,
      type: 'spend',
      amount,
      description: description || `Spend ${amount} tickets`,
      previousValue,
      newValue: resources.tickets,
    });

    logger.debug(`Tickets spent for ${side}`, {
      amount,
      remaining: resources.tickets,
      description,
    });

    return {
      success: true,
      remaining: resources.tickets,
    };
  }

  /**
   * Refund tickets (e.g., for medevac, unit RTB)
   * @param side - Side receiving refund
   * @param amount - Amount to refund
   * @param reason - Reason for refund
   * @returns RefundResult with success status and new total
   */
  refundTickets(side: 'EAST' | 'WEST', amount: number, reason: string = ''): RefundResult {
    const resources = this.resources[side];
    const previousValue = resources.tickets;

    // Validate amount
    if (amount <= 0) {
      return {
        success: false,
        newTotal: resources.tickets,
        error: 'Invalid refund amount: must be positive',
      };
    }

    // Add tickets, capped at max
    resources.tickets = Math.min(resources.maxTickets, resources.tickets + amount);

    // Log transaction
    this.logTransaction({
      timestamp: Date.now(),
      side,
      type: 'refund',
      amount,
      description: reason || `Refund ${amount} tickets`,
      previousValue,
      newValue: resources.tickets,
    });

    logger.debug(`Tickets refunded for ${side}`, {
      amount,
      newTotal: resources.tickets,
      reason,
    });

    return {
      success: true,
      newTotal: resources.tickets,
    };
  }

  /**
   * Apply ticket regeneration based on elapsed time
   */
  private applyTicketRegeneration(side: 'EAST' | 'WEST'): void {
    const resources = this.resources[side];
    const now = Date.now();
    const elapsed = now - resources.lastRegenTime;

    // Only regenerate if at least one interval has passed
    if (elapsed < this.regenIntervalMs) {
      return;
    }

    // Calculate regeneration amount
    const intervals = Math.floor(elapsed / this.regenIntervalMs);
    const totalRegen = this.getTicketRegen(side);
    const regenAmount = totalRegen * intervals;

    if (regenAmount > 0 && resources.tickets < resources.maxTickets) {
      const previousValue = resources.tickets;
      resources.tickets = Math.min(resources.maxTickets, resources.tickets + regenAmount);
      resources.lastRegenTime = now;

      // Only log if tickets actually changed
      if (resources.tickets > previousValue) {
        this.logTransaction({
          timestamp: now,
          side,
          type: 'regen',
          amount: resources.tickets - previousValue,
          description: `Regenerated ${resources.tickets - previousValue} tickets (${intervals} intervals)`,
          previousValue,
          newValue: resources.tickets,
        });

        logger.debug(`Tickets regenerated for ${side}`, {
          amount: resources.tickets - previousValue,
          newTotal: resources.tickets,
          intervals,
        });
      }
    } else {
      // Update time even if no regen occurred (at max)
      resources.lastRegenTime = now;
    }
  }

  /**
   * Force regeneration check for all sides
   */
  processRegeneration(): void {
    this.applyTicketRegeneration('EAST');
    this.applyTicketRegeneration('WEST');
  }

  // ==================== Unit Pool Operations ====================

  /**
   * Deduct from a unit pool
   * @param side - Side to deduct from
   * @param poolType - Unit pool category
   * @param count - Number of units to deduct (must be positive)
   * @returns true if deduction succeeded, false if insufficient units or invalid count
   */
  deductFromPool(side: 'EAST' | 'WEST', poolType: UnitPoolType, count: number = 1): boolean {
    // Validate count parameter
    if (count <= 0) {
      logger.warn(`Invalid deduct count for ${side}`, { poolType, count });
      return false;
    }

    const pool = this.resources[side].unitPool[poolType];

    if (pool.available < count) {
      logger.warn(`Pool exhausted for ${side}`, { poolType, requested: count, available: pool.available });
      return false;
    }

    const previousValue = pool.available;
    pool.available -= count;

    this.logTransaction({
      timestamp: Date.now(),
      side,
      type: 'pool_deduct',
      amount: count,
      description: `Deducted ${count} from ${poolType} pool`,
      previousValue,
      newValue: pool.available,
    });

    logger.debug(`Pool deducted for ${side}`, { poolType, count, remaining: pool.available });
    return true;
  }

  /**
   * Restore units to a pool (e.g., unit destroyed, RTB)
   * @param side - Side to restore to
   * @param poolType - Unit pool category
   * @param count - Number of units to restore (must be positive)
   * @returns true if restoration occurred, false if invalid count
   */
  restoreToPool(side: 'EAST' | 'WEST', poolType: UnitPoolType, count: number = 1): boolean {
    // Validate count parameter
    if (count <= 0) {
      logger.warn(`Invalid restore count for ${side}`, { poolType, count });
      return false;
    }

    const pool = this.resources[side].unitPool[poolType];
    const previousValue = pool.available;

    // Cap at max
    pool.available = Math.min(pool.max, pool.available + count);

    // Only log if value actually changed
    const actualRestored = pool.available - previousValue;
    if (actualRestored > 0) {
      this.logTransaction({
        timestamp: Date.now(),
        side,
        type: 'pool_restore',
        amount: actualRestored,
        description: `Restored ${actualRestored} to ${poolType} pool`,
        previousValue,
        newValue: pool.available,
      });

      logger.debug(`Pool restored for ${side}`, { poolType, count: actualRestored, newAvailable: pool.available });
    } else {
      logger.debug(`Pool already at max for ${side}`, { poolType, max: pool.max });
    }

    return true;
  }

  /**
   * Check if a pool has available units
   */
  hasPoolAvailable(side: 'EAST' | 'WEST', poolType: UnitPoolType, count: number = 1): boolean {
    return this.resources[side].unitPool[poolType].available >= count;
  }

  /**
   * Check if a pool is completely exhausted
   */
  isPoolExhausted(side: 'EAST' | 'WEST', poolType: UnitPoolType): boolean {
    return this.resources[side].unitPool[poolType].available === 0;
  }

  /**
   * Get the utilization percentage of a pool (0.0 = empty, 1.0 = full capacity used)
   * This represents how much of the pool has been deployed (max - available) / max
   */
  getPoolUtilization(side: 'EAST' | 'WEST', poolType: UnitPoolType): number {
    const pool = this.resources[side].unitPool[poolType];
    if (pool.max === 0) return 0;
    return (pool.max - pool.available) / pool.max;
  }

  /**
   * Get the remaining capacity percentage of a pool (0.0 = depleted, 1.0 = full)
   */
  getPoolRemainingPercent(side: 'EAST' | 'WEST', poolType: UnitPoolType): number {
    const pool = this.resources[side].unitPool[poolType];
    if (pool.max === 0) return 0;
    return pool.available / pool.max;
  }

  /**
   * Check if a pool is critically low (below threshold percentage)
   * @param side - Side to check
   * @param poolType - Unit pool category
   * @param threshold - Percentage threshold (0.0 - 1.0, default 0.2 = 20%)
   * @returns true if pool is below threshold
   */
  isPoolCriticallyLow(side: 'EAST' | 'WEST', poolType: UnitPoolType, threshold: number = 0.2): boolean {
    return this.getPoolRemainingPercent(side, poolType) < threshold;
  }

  /**
   * Get all critically low pools for a side
   * @param side - Side to check
   * @param threshold - Percentage threshold (0.0 - 1.0, default 0.2 = 20%)
   * @returns Array of pool types that are below threshold
   */
  getCriticallyLowPools(side: 'EAST' | 'WEST', threshold: number = 0.2): UnitPoolType[] {
    const poolTypes: UnitPoolType[] = ['infantry', 'lightVehicle', 'heavyArmor', 'helicopter', 'fixedWing'];
    return poolTypes.filter(poolType => this.isPoolCriticallyLow(side, poolType, threshold));
  }

  /**
   * Get comprehensive status of all pools for a side
   */
  getPoolStatus(side: 'EAST' | 'WEST'): Record<UnitPoolType, { available: number; max: number; deployed: number; utilized: number; exhausted: boolean; criticallyLow: boolean }> {
    const poolTypes: UnitPoolType[] = ['infantry', 'lightVehicle', 'heavyArmor', 'helicopter', 'fixedWing'];
    const status: Record<string, { available: number; max: number; deployed: number; utilized: number; exhausted: boolean; criticallyLow: boolean }> = {};

    for (const poolType of poolTypes) {
      const pool = this.resources[side].unitPool[poolType];
      status[poolType] = {
        available: pool.available,
        max: pool.max,
        deployed: pool.max - pool.available,
        utilized: this.getPoolUtilization(side, poolType),
        exhausted: pool.available === 0,
        criticallyLow: this.isPoolCriticallyLow(side, poolType),
      };
    }

    return status as Record<UnitPoolType, { available: number; max: number; deployed: number; utilized: number; exhausted: boolean; criticallyLow: boolean }>;
  }

  /**
   * Get summary totals for all pools
   */
  getPoolSummary(side: 'EAST' | 'WEST'): {
    totalAvailable: number;
    totalMax: number;
    totalDeployed: number;
    totalUtilized: number;
    exhaustedPools: UnitPoolType[];
    criticallyLowPools: UnitPoolType[];
  } {
    const poolTypes: UnitPoolType[] = ['infantry', 'lightVehicle', 'heavyArmor', 'helicopter', 'fixedWing'];
    let totalAvailable = 0;
    let totalMax = 0;
    const exhaustedPools: UnitPoolType[] = [];
    const criticallyLowPools: UnitPoolType[] = [];

    for (const poolType of poolTypes) {
      const pool = this.resources[side].unitPool[poolType];
      totalAvailable += pool.available;
      totalMax += pool.max;
      if (pool.available === 0) {
        exhaustedPools.push(poolType);
      }
      if (this.isPoolCriticallyLow(side, poolType)) {
        criticallyLowPools.push(poolType);
      }
    }

    const totalDeployed = totalMax - totalAvailable;

    return {
      totalAvailable,
      totalMax,
      totalDeployed,
      totalUtilized: totalMax > 0 ? totalDeployed / totalMax : 0,
      exhaustedPools,
      criticallyLowPools,
    };
  }

  /**
   * Reset a specific pool to its maximum value
   */
  resetPool(side: 'EAST' | 'WEST', poolType: UnitPoolType): void {
    const pool = this.resources[side].unitPool[poolType];
    const previousValue = pool.available;
    pool.available = pool.max;

    this.logTransaction({
      timestamp: Date.now(),
      side,
      type: 'pool_restore',
      amount: pool.max - previousValue,
      description: `Reset ${poolType} pool to max`,
      previousValue,
      newValue: pool.available,
    });

    logger.debug(`Pool reset for ${side}`, { poolType, newAvailable: pool.available });
  }

  /**
   * Reset all pools for a side to their maximum values
   */
  resetAllPools(side: 'EAST' | 'WEST'): void {
    const poolTypes: UnitPoolType[] = ['infantry', 'lightVehicle', 'heavyArmor', 'helicopter', 'fixedWing'];
    for (const poolType of poolTypes) {
      this.resetPool(side, poolType);
    }
    logger.info(`All pools reset for ${side}`);
  }

  /**
   * Set the maximum value for a pool (useful for objective bonuses)
   */
  setPoolMax(side: 'EAST' | 'WEST', poolType: UnitPoolType, newMax: number): void {
    const pool = this.resources[side].unitPool[poolType];
    const previousMax = pool.max;
    pool.max = Math.max(0, newMax);

    // If available exceeds new max, cap it
    if (pool.available > pool.max) {
      pool.available = pool.max;
    }

    logger.debug(`Pool max updated for ${side}`, { poolType, previousMax, newMax: pool.max });
  }

  /**
   * Add to pool maximum (e.g., from objective capture bonus)
   */
  addPoolBonus(side: 'EAST' | 'WEST', poolType: UnitPoolType, bonus: number): void {
    const pool = this.resources[side].unitPool[poolType];
    pool.max += bonus;
    pool.available += bonus; // Also add to available

    logger.info(`Pool bonus added for ${side}`, { poolType, bonus, newMax: pool.max, newAvailable: pool.available });
  }

  /**
   * Remove pool bonus (e.g., from losing an objective)
   */
  removePoolBonus(side: 'EAST' | 'WEST', poolType: UnitPoolType, bonus: number): void {
    const pool = this.resources[side].unitPool[poolType];
    pool.max = Math.max(0, pool.max - bonus);
    pool.available = Math.min(pool.available, pool.max); // Cap available at new max

    logger.info(`Pool bonus removed for ${side}`, { poolType, bonus, newMax: pool.max, newAvailable: pool.available });
  }

  // ==================== Support Asset Operations ====================

  /**
   * Use a support asset
   * @param side - Side using the asset
   * @param assetType - Type of support asset to use
   * @returns true if asset was used, false if exhausted or invalid
   */
  useSupportAsset(side: 'EAST' | 'WEST', assetType: SupportAssetType): boolean {
    const assets = this.resources[side].supportAssets;

    if (assets[assetType] <= 0) {
      logger.warn(`Support asset exhausted for ${side}`, { assetType });
      return false;
    }

    const previousValue = assets[assetType];
    assets[assetType]--;

    this.logTransaction({
      timestamp: Date.now(),
      side,
      type: 'support_use',
      amount: 1,
      description: `Used ${assetType}`,
      previousValue,
      newValue: assets[assetType],
    });

    logger.debug(`Support asset used for ${side}`, { assetType, remaining: assets[assetType] });
    return true;
  }

  /**
   * Check if a support asset is available
   * @param side - Side to check
   * @param assetType - Type of support asset
   * @param count - Number of assets needed (default 1)
   * @returns true if the asset has sufficient count
   */
  hasSupportAsset(side: 'EAST' | 'WEST', assetType: SupportAssetType, count: number = 1): boolean {
    return this.resources[side].supportAssets[assetType] >= count;
  }

  /**
   * Get count of a specific support asset type
   * @param side - Side to check
   * @param assetType - Type of support asset
   * @returns Current count of the asset
   */
  getSupportAssetCount(side: 'EAST' | 'WEST', assetType: SupportAssetType): number {
    return this.resources[side].supportAssets[assetType];
  }

  /**
   * Check if a support asset is completely exhausted
   * @param side - Side to check
   * @param assetType - Type of support asset
   * @returns true if asset count is 0
   */
  isSupportAssetExhausted(side: 'EAST' | 'WEST', assetType: SupportAssetType): boolean {
    return this.resources[side].supportAssets[assetType] === 0;
  }

  /**
   * Get all exhausted support asset types for a side
   * @param side - Side to check
   * @returns Array of exhausted support asset types
   */
  getExhaustedSupportAssets(side: 'EAST' | 'WEST'): SupportAssetType[] {
    const assetTypes: SupportAssetType[] = ['artilleryStrikes', 'casSorties', 'resupplyDrops', 'medevacMissions'];
    return assetTypes.filter(assetType => this.isSupportAssetExhausted(side, assetType));
  }

  /**
   * Get comprehensive status of all support assets for a side
   * @param side - Side to check
   * @returns Object with status for each support asset type
   */
  getSupportAssetStatus(side: 'EAST' | 'WEST'): Record<SupportAssetType, { available: number; exhausted: boolean }> {
    const assets = this.resources[side].supportAssets;
    return {
      artilleryStrikes: {
        available: assets.artilleryStrikes,
        exhausted: assets.artilleryStrikes === 0,
      },
      casSorties: {
        available: assets.casSorties,
        exhausted: assets.casSorties === 0,
      },
      resupplyDrops: {
        available: assets.resupplyDrops,
        exhausted: assets.resupplyDrops === 0,
      },
      medevacMissions: {
        available: assets.medevacMissions,
        exhausted: assets.medevacMissions === 0,
      },
    };
  }

  /**
   * Get summary of all support assets for a side
   * @param side - Side to check
   * @returns Summary with totals and exhausted assets list
   */
  getSupportAssetSummary(side: 'EAST' | 'WEST'): {
    totalAvailable: number;
    exhaustedAssets: SupportAssetType[];
    assetCounts: SupportAssets;
  } {
    const assets = this.resources[side].supportAssets;
    const totalAvailable =
      assets.artilleryStrikes +
      assets.casSorties +
      assets.resupplyDrops +
      assets.medevacMissions;

    return {
      totalAvailable,
      exhaustedAssets: this.getExhaustedSupportAssets(side),
      assetCounts: { ...assets },
    };
  }

  /**
   * Add support assets (e.g., from objective capture or resupply)
   * @param side - Side to add assets to
   * @param assetType - Type of support asset
   * @param count - Number of assets to add
   */
  addSupportAsset(side: 'EAST' | 'WEST', assetType: SupportAssetType, count: number = 1): void {
    if (count <= 0) {
      logger.warn(`Invalid support asset add count for ${side}`, { assetType, count });
      return;
    }

    const assets = this.resources[side].supportAssets;
    const previousValue = assets[assetType];
    assets[assetType] += count;

    this.logTransaction({
      timestamp: Date.now(),
      side,
      type: 'support_use',
      amount: -count, // Negative to indicate addition
      description: `Added ${count} ${assetType}`,
      previousValue,
      newValue: assets[assetType],
    });

    logger.info(`Support asset added for ${side}`, { assetType, count, newTotal: assets[assetType] });
  }

  /**
   * Set support asset count directly (for initialization or admin override)
   * @param side - Side to modify
   * @param assetType - Type of support asset
   * @param count - New count value
   */
  setSupportAssetCount(side: 'EAST' | 'WEST', assetType: SupportAssetType, count: number): void {
    const assets = this.resources[side].supportAssets;
    const previousValue = assets[assetType];
    assets[assetType] = Math.max(0, count);

    logger.debug(`Support asset count set for ${side}`, { assetType, previousValue, newValue: assets[assetType] });
  }

  /**
   * Reset all support assets to preset values based on difficulty
   * @param side - Side to reset
   * @param difficultyLevel - Optional difficulty level (uses default if not specified)
   */
  resetSupportAssets(side: 'EAST' | 'WEST', difficultyLevel?: number): void {
    const level = difficultyLevel ?? getDefaultPreset().level;
    const preset = getPresetByLevel(level);
    const newAssets = getScaledSupportAssets(preset);

    this.resources[side].supportAssets = newAssets;

    logger.info(`Support assets reset for ${side}`, {
      difficultyLevel: level,
      artilleryStrikes: newAssets.artilleryStrikes,
      casSorties: newAssets.casSorties,
      resupplyDrops: newAssets.resupplyDrops,
      medevacMissions: newAssets.medevacMissions,
    });
  }

  // ==================== Specific Support Asset Operations ====================

  /**
   * Use an artillery strike
   * @param side - Side using the strike
   * @returns true if strike was available and used
   */
  useArtilleryStrike(side: 'EAST' | 'WEST'): boolean {
    const result = this.useSupportAsset(side, 'artilleryStrikes');
    if (result) {
      logger.info(`Artillery strike called by ${side}`, {
        remaining: this.resources[side].supportAssets.artilleryStrikes,
      });
    }
    return result;
  }

  /**
   * Check if artillery strike is available
   * @param side - Side to check
   * @returns true if at least one strike is available
   */
  hasArtilleryStrike(side: 'EAST' | 'WEST'): boolean {
    return this.hasSupportAsset(side, 'artilleryStrikes');
  }

  /**
   * Get remaining artillery strikes count
   * @param side - Side to check
   * @returns Number of available artillery strikes
   */
  getArtilleryStrikesRemaining(side: 'EAST' | 'WEST'): number {
    return this.resources[side].supportAssets.artilleryStrikes;
  }

  /**
   * Use a CAS (Close Air Support) sortie
   * @param side - Side using the sortie
   * @returns true if sortie was available and used
   */
  useCasSortie(side: 'EAST' | 'WEST'): boolean {
    const result = this.useSupportAsset(side, 'casSorties');
    if (result) {
      logger.info(`CAS sortie launched by ${side}`, {
        remaining: this.resources[side].supportAssets.casSorties,
      });
    }
    return result;
  }

  /**
   * Check if CAS sortie is available
   * @param side - Side to check
   * @returns true if at least one sortie is available
   */
  hasCasSortie(side: 'EAST' | 'WEST'): boolean {
    return this.hasSupportAsset(side, 'casSorties');
  }

  /**
   * Get remaining CAS sorties count
   * @param side - Side to check
   * @returns Number of available CAS sorties
   */
  getCasSortiesRemaining(side: 'EAST' | 'WEST'): number {
    return this.resources[side].supportAssets.casSorties;
  }

  /**
   * Use a resupply drop
   * @param side - Side using the drop
   * @returns true if resupply was available and used
   */
  useResupplyDrop(side: 'EAST' | 'WEST'): boolean {
    const result = this.useSupportAsset(side, 'resupplyDrops');
    if (result) {
      logger.info(`Resupply drop requested by ${side}`, {
        remaining: this.resources[side].supportAssets.resupplyDrops,
      });
    }
    return result;
  }

  /**
   * Check if resupply drop is available
   * @param side - Side to check
   * @returns true if at least one resupply is available
   */
  hasResupplyDrop(side: 'EAST' | 'WEST'): boolean {
    return this.hasSupportAsset(side, 'resupplyDrops');
  }

  /**
   * Get remaining resupply drops count
   * @param side - Side to check
   * @returns Number of available resupply drops
   */
  getResupplyDropsRemaining(side: 'EAST' | 'WEST'): number {
    return this.resources[side].supportAssets.resupplyDrops;
  }

  /**
   * Use a medevac mission with optional partial ticket refund
   * Per spec: medevac provides partial ticket refund
   * @param side - Side using the medevac
   * @param ticketRefundPercent - Percentage of spawn cost to refund (0.0 - 1.0, default 0.5 = 50%)
   * @param originalSpawnCost - Original ticket cost of the unit being evacuated
   * @returns Object with success status and refund amount
   */
  useMedevacMission(
    side: 'EAST' | 'WEST',
    ticketRefundPercent: number = 0.5,
    originalSpawnCost: number = 0
  ): { success: boolean; refundAmount: number } {
    const result = this.useSupportAsset(side, 'medevacMissions');

    if (!result) {
      return { success: false, refundAmount: 0 };
    }

    // Calculate and apply partial ticket refund
    let refundAmount = 0;
    if (originalSpawnCost > 0 && ticketRefundPercent > 0) {
      refundAmount = Math.floor(originalSpawnCost * Math.min(1, ticketRefundPercent));
      if (refundAmount > 0) {
        this.refundTickets(side, refundAmount, `Medevac partial refund (${Math.round(ticketRefundPercent * 100)}%)`);
      }
    }

    logger.info(`Medevac mission completed by ${side}`, {
      remaining: this.resources[side].supportAssets.medevacMissions,
      refundAmount,
      originalSpawnCost,
      refundPercent: ticketRefundPercent,
    });

    return { success: true, refundAmount };
  }

  /**
   * Check if medevac mission is available
   * @param side - Side to check
   * @returns true if at least one medevac is available
   */
  hasMedevacMission(side: 'EAST' | 'WEST'): boolean {
    return this.hasSupportAsset(side, 'medevacMissions');
  }

  /**
   * Get remaining medevac missions count
   * @param side - Side to check
   * @returns Number of available medevac missions
   */
  getMedevacMissionsRemaining(side: 'EAST' | 'WEST'): number {
    return this.resources[side].supportAssets.medevacMissions;
  }

  /**
   * Request multiple support assets at once (for complex operations)
   * This is an atomic operation - either all assets are used or none
   * @param side - Side using the assets
   * @param requests - Array of asset type and count pairs
   * @returns true if all assets were available and used
   */
  useMultipleSupportAssets(
    side: 'EAST' | 'WEST',
    requests: Array<{ assetType: SupportAssetType; count: number }>
  ): boolean {
    // First check if all assets are available
    for (const request of requests) {
      if (!this.hasSupportAsset(side, request.assetType, request.count)) {
        logger.warn(`Insufficient support assets for multi-asset request`, {
          side,
          assetType: request.assetType,
          requested: request.count,
          available: this.getSupportAssetCount(side, request.assetType),
        });
        return false;
      }
    }

    // All assets available - deduct them all
    for (const request of requests) {
      for (let i = 0; i < request.count; i++) {
        this.useSupportAsset(side, request.assetType);
      }
    }

    logger.info(`Multiple support assets used by ${side}`, {
      requests: requests.map((r) => ({ type: r.assetType, count: r.count })),
    });

    return true;
  }

  /**
   * Get all available support asset types (those with count > 0)
   * @param side - Side to check
   * @returns Array of available support asset types
   */
  getAvailableSupportAssetTypes(side: 'EAST' | 'WEST'): SupportAssetType[] {
    const assetTypes: SupportAssetType[] = ['artilleryStrikes', 'casSorties', 'resupplyDrops', 'medevacMissions'];
    return assetTypes.filter(assetType => this.hasSupportAsset(side, assetType));
  }

  /**
   * Check if any support assets are available
   * @param side - Side to check
   * @returns true if at least one support asset type has count > 0
   */
  hasAnySupportAsset(side: 'EAST' | 'WEST'): boolean {
    const assets = this.resources[side].supportAssets;
    return (
      assets.artilleryStrikes > 0 ||
      assets.casSorties > 0 ||
      assets.resupplyDrops > 0 ||
      assets.medevacMissions > 0
    );
  }

  /**
   * Check if all support assets are exhausted
   * @param side - Side to check
   * @returns true if all support asset types have count = 0
   */
  areAllSupportAssetsExhausted(side: 'EAST' | 'WEST'): boolean {
    return !this.hasAnySupportAsset(side);
  }

  // ==================== Active Unit Tracking ====================

  /**
   * Update active unit count for a side
   */
  setActiveUnits(side: 'EAST' | 'WEST', count: number): void {
    this.resources[side].activeUnits = Math.max(0, count);
  }

  /**
   * Increment active unit count
   */
  incrementActiveUnits(side: 'EAST' | 'WEST', count: number = 1): void {
    this.resources[side].activeUnits += count;
  }

  /**
   * Decrement active unit count
   */
  decrementActiveUnits(side: 'EAST' | 'WEST', count: number = 1): void {
    this.resources[side].activeUnits = Math.max(0, this.resources[side].activeUnits - count);
  }

  /**
   * Check if active unit cap allows more spawns
   */
  canSpawnMoreUnits(side: 'EAST' | 'WEST', count: number = 1): boolean {
    return this.resources[side].activeUnits + count <= this.resources[side].maxActiveUnits;
  }

  // ==================== Spawn Tracking ====================

  /**
   * Record a spawn time (resets cooldown timer)
   */
  recordSpawn(side: 'EAST' | 'WEST'): void {
    this.resources[side].lastSpawnTime = Date.now();
  }

  // ==================== Strategic Objectives ====================

  /**
   * Add a controlled objective
   */
  addControlledObjective(side: 'EAST' | 'WEST', objectiveId: string, bonusIncome: number = 1): void {
    const resources = this.resources[side];

    if (!resources.controlledObjectives.includes(objectiveId)) {
      resources.controlledObjectives.push(objectiveId);
      resources.bonusTicketIncome += bonusIncome;

      logger.info(`Objective captured by ${side}`, {
        objectiveId,
        bonusIncome,
        totalBonus: resources.bonusTicketIncome,
      });
    }
  }

  /**
   * Remove a controlled objective
   */
  removeControlledObjective(side: 'EAST' | 'WEST', objectiveId: string, bonusIncome: number = 1): void {
    const resources = this.resources[side];
    const index = resources.controlledObjectives.indexOf(objectiveId);

    if (index !== -1) {
      resources.controlledObjectives.splice(index, 1);
      resources.bonusTicketIncome = Math.max(0, resources.bonusTicketIncome - bonusIncome);

      logger.info(`Objective lost by ${side}`, {
        objectiveId,
        bonusIncome,
        totalBonus: resources.bonusTicketIncome,
      });
    }
  }

  // ==================== Transaction History ====================

  /**
   * Log a resource transaction
   */
  private logTransaction(transaction: ResourceTransaction): void {
    this.transactionHistory.push(transaction);

    // Trim history if exceeds max size
    if (this.transactionHistory.length > this.maxHistorySize) {
      this.transactionHistory = this.transactionHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Get recent transactions
   */
  getRecentTransactions(count: number = 20): ResourceTransaction[] {
    return this.transactionHistory.slice(-count);
  }

  /**
   * Get transactions for a specific side
   */
  getTransactionsForSide(side: 'EAST' | 'WEST', count: number = 20): ResourceTransaction[] {
    return this.transactionHistory
      .filter((t) => t.side === side)
      .slice(-count);
  }

  /**
   * Clear transaction history
   */
  clearTransactionHistory(): void {
    this.transactionHistory = [];
    logger.info('Transaction history cleared');
  }

  // ==================== State Management ====================

  /**
   * Reset resources for a side to initial values
   */
  resetSide(side: 'EAST' | 'WEST', difficultyLevel?: number): void {
    const level = difficultyLevel ?? getDefaultPreset().level;
    this.resources[side] = this.createInitialResources(side, level);
    logger.info(`Resources reset for ${side}`, { difficultyLevel: level });
  }

  /**
   * Reset all resources to initial values
   */
  resetAll(difficultyLevel?: number): void {
    this.resetSide('EAST', difficultyLevel);
    this.resetSide('WEST', difficultyLevel);
    this.clearTransactionHistory();
  }

  /**
   * Check if resources are valid/initialized
   */
  isInitialized(side: 'EAST' | 'WEST'): boolean {
    const resources = this.resources[side];
    return resources !== null && resources.maxTickets > 0;
  }

  // ==================== Session Persistence ====================

  /**
   * Get the status of the last load operation
   * @returns LoadStatus enum value indicating what happened during the last loadState() call
   */
  getLastLoadStatus(): LoadStatus {
    return this._lastLoadStatus;
  }

  /**
   * Get the error message from the last load operation (if any)
   * @returns Error message string or null if no error occurred
   */
  getLastLoadError(): string | null {
    return this._lastLoadError;
  }

  /**
   * Check if the last load operation encountered a corrupted file
   * @returns true if the file was corrupted (invalid JSON or structure)
   */
  wasLastLoadCorrupted(): boolean {
    return (
      this._lastLoadStatus === LoadStatus.INVALID_JSON ||
      this._lastLoadStatus === LoadStatus.INVALID_STRUCTURE ||
      this._lastLoadStatus === LoadStatus.EMPTY_FILE
    );
  }

  /**
   * Backup a corrupted persistence file before resetting to defaults
   * Creates a backup with .corrupted.{timestamp} extension
   * @param filePath - Path to the corrupted file
   * @returns Path to the backup file, or null if backup failed
   */
  private backupCorruptedFile(filePath: string): string | null {
    try {
      const timestamp = Date.now();
      const backupPath = `${filePath}.corrupted.${timestamp}`;

      // Only backup if source file exists
      if (fs.existsSync(filePath)) {
        fs.copyFileSync(filePath, backupPath);
        logger.info('Corrupted persistence file backed up', {
          originalPath: filePath,
          backupPath,
        });
        return backupPath;
      }
      return null;
    } catch (error) {
      logger.warn('Failed to backup corrupted file', {
        path: filePath,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Handle a corrupted persistence file by backing it up and optionally deleting the original
   * @param filePath - Path to the corrupted file
   * @param deleteOriginal - Whether to delete the original file after backup (default: true)
   * @returns true if handled successfully
   */
  handleCorruptedFile(filePath?: string, deleteOriginal: boolean = true): boolean {
    const targetPath = filePath ?? this.getDefaultPersistencePath();

    try {
      // Backup the corrupted file
      const backupPath = this.backupCorruptedFile(targetPath);

      if (deleteOriginal && backupPath && fs.existsSync(targetPath)) {
        fs.unlinkSync(targetPath);
        logger.info('Corrupted persistence file removed after backup', {
          path: targetPath,
          backupPath,
        });
      }

      return true;
    } catch (error) {
      logger.error('Failed to handle corrupted file', {
        path: targetPath,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Get the default persistence file path
   * Uses bridge/data/resources.json for session state storage
   */
  private getDefaultPersistencePath(): string {
    // Resolve relative to the bridge directory
    return path.resolve(__dirname, '../../../data/resources.json');
  }

  /**
   * Save current resource state to a JSON file for session persistence
   * @param filePath - Optional custom file path (defaults to bridge/data/resources.json)
   * @returns true if save succeeded, false otherwise
   */
  saveState(filePath?: string): boolean {
    const targetPath = filePath ?? this.getDefaultPersistencePath();

    try {
      // Ensure directory exists
      const dir = path.dirname(targetPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Prepare state for serialization
      const state = {
        version: 1, // Schema version for future migrations
        savedAt: Date.now(),
        resources: this.resources,
        transactionHistory: this.transactionHistory.slice(-100), // Keep only recent history
      };

      // Write state to file with pretty formatting
      fs.writeFileSync(targetPath, JSON.stringify(state, null, 2), 'utf-8');

      logger.info('Resource state saved', {
        path: targetPath,
        eastTickets: this.resources.EAST.tickets,
        westTickets: this.resources.WEST.tickets,
        transactionCount: state.transactionHistory.length,
      });

      return true;
    } catch (error) {
      logger.error('Failed to save resource state', {
        path: targetPath,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Load resource state from a JSON file
   * Gracefully degrades to default state if file is missing or corrupted
   *
   * Graceful degradation behavior:
   * - Missing file: Use default state, no error
   * - Empty file: Backup file, use default state, log warning
   * - Invalid JSON: Backup file, use default state, log error with details
   * - Invalid structure: Backup file, use default state, log warning with specifics
   * - Read error: Use default state, log error
   *
   * After calling this method, use getLastLoadStatus() and getLastLoadError()
   * to understand what happened during the load operation.
   *
   * @param filePath - Optional custom file path (defaults to bridge/data/resources.json)
   * @param backupOnCorruption - Whether to backup corrupted files (default: true)
   * @returns true if load succeeded, false if using default state
   */
  loadState(filePath?: string, backupOnCorruption: boolean = true): boolean {
    const targetPath = filePath ?? this.getDefaultPersistencePath();

    // Reset load status
    this._lastLoadError = null;

    try {
      // Check if file exists
      if (!fs.existsSync(targetPath)) {
        this._lastLoadStatus = LoadStatus.FILE_NOT_FOUND;
        logger.info('No persistence file found, using default state', { path: targetPath });
        return false;
      }

      // Read file content
      let content: string;
      try {
        content = fs.readFileSync(targetPath, 'utf-8');
      } catch (readError) {
        this._lastLoadStatus = LoadStatus.READ_ERROR;
        this._lastLoadError = readError instanceof Error ? readError.message : String(readError);
        logger.error('Failed to read persistence file, using default state', {
          path: targetPath,
          error: this._lastLoadError,
        });
        return false;
      }

      // Check for empty file
      if (!content || content.trim().length === 0) {
        this._lastLoadStatus = LoadStatus.EMPTY_FILE;
        this._lastLoadError = 'Persistence file is empty';
        logger.warn('Empty persistence file detected, using default state', { path: targetPath });

        if (backupOnCorruption) {
          this.backupCorruptedFile(targetPath);
        }
        return false;
      }

      // Parse JSON with detailed error handling
      let state: unknown;
      try {
        state = JSON.parse(content);
      } catch (parseError) {
        this._lastLoadStatus = LoadStatus.INVALID_JSON;
        this._lastLoadError = parseError instanceof Error ? parseError.message : String(parseError);

        // Try to provide more context about the corruption
        const previewLength = Math.min(100, content.length);
        const contentPreview = content.substring(0, previewLength);
        const isBinaryData = /[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(contentPreview);

        logger.error('Corrupted persistence file (invalid JSON), using default state', {
          path: targetPath,
          error: this._lastLoadError,
          contentLength: content.length,
          isBinaryData,
          contentPreview: isBinaryData ? '[binary data]' : contentPreview.replace(/\n/g, '\\n'),
        });

        if (backupOnCorruption) {
          this.backupCorruptedFile(targetPath);
        }
        return false;
      }

      // Validate state structure with detailed error reporting
      const validationResult = this.validatePersistedStateDetailed(state);
      if (!validationResult.valid) {
        this._lastLoadStatus = LoadStatus.INVALID_STRUCTURE;
        this._lastLoadError = validationResult.reason;
        logger.warn('Invalid persisted state structure, using default state', {
          path: targetPath,
          reason: validationResult.reason,
          missingFields: validationResult.missingFields,
        });

        if (backupOnCorruption) {
          this.backupCorruptedFile(targetPath);
        }
        return false;
      }

      // State is valid - restore resources
      const validState = state as {
        version: number;
        savedAt: number;
        resources: SideResources;
        transactionHistory?: ResourceTransaction[];
      };

      this.resources = {
        EAST: this.restoreCommanderResources(validState.resources.EAST, 'EAST'),
        WEST: this.restoreCommanderResources(validState.resources.WEST, 'WEST'),
      };

      // Restore transaction history (if present and valid)
      if (Array.isArray(validState.transactionHistory)) {
        // Filter out any invalid transactions during restore
        this.transactionHistory = validState.transactionHistory.filter(
          (t) => t && typeof t.timestamp === 'number' && typeof t.side === 'string'
        );
      }

      this._lastLoadStatus = LoadStatus.SUCCESS;
      logger.info('Resource state loaded successfully', {
        path: targetPath,
        version: validState.version,
        savedAt: new Date(validState.savedAt).toISOString(),
        eastTickets: this.resources.EAST.tickets,
        westTickets: this.resources.WEST.tickets,
        transactionCount: this.transactionHistory.length,
      });

      return true;
    } catch (error) {
      // Catch-all for any unexpected errors
      this._lastLoadStatus = LoadStatus.READ_ERROR;
      this._lastLoadError = error instanceof Error ? error.message : String(error);
      logger.error('Unexpected error loading resource state, using default state', {
        path: targetPath,
        error: this._lastLoadError,
      });
      return false;
    }
  }

  /**
   * Validate persisted state with detailed error reporting
   * @param state - Parsed JSON state to validate
   * @returns Validation result with reason and missing fields
   */
  private validatePersistedStateDetailed(state: unknown): {
    valid: boolean;
    reason: string;
    missingFields: string[];
  } {
    const missingFields: string[] = [];

    if (typeof state !== 'object' || state === null) {
      return {
        valid: false,
        reason: 'State is not an object',
        missingFields: ['root'],
      };
    }

    const obj = state as Record<string, unknown>;

    // Check required fields
    if (typeof obj.version !== 'number') {
      missingFields.push('version');
    }
    if (typeof obj.savedAt !== 'number') {
      missingFields.push('savedAt');
    }
    if (typeof obj.resources !== 'object' || obj.resources === null) {
      missingFields.push('resources');
    } else {
      const resources = obj.resources as Record<string, unknown>;
      if (!resources.EAST || typeof resources.EAST !== 'object') {
        missingFields.push('resources.EAST');
      }
      if (!resources.WEST || typeof resources.WEST !== 'object') {
        missingFields.push('resources.WEST');
      }
    }

    if (missingFields.length > 0) {
      return {
        valid: false,
        reason: `Missing or invalid required fields: ${missingFields.join(', ')}`,
        missingFields,
      };
    }

    return {
      valid: true,
      reason: '',
      missingFields: [],
    };
  }

  /**
   * Validate that persisted state has the expected structure
   * @param state - Parsed JSON state to validate
   * @returns true if state structure is valid
   * @deprecated Use validatePersistedStateDetailed for more detailed error reporting
   */
  private validatePersistedState(state: unknown): state is {
    version: number;
    savedAt: number;
    resources: SideResources;
    transactionHistory?: ResourceTransaction[];
  } {
    return this.validatePersistedStateDetailed(state).valid;
  }

  /**
   * Restore commander resources with validation and defaults for missing fields
   * @param data - Persisted resource data
   * @param side - Side being restored
   * @returns Validated CommanderResources object
   */
  private restoreCommanderResources(
    data: Partial<CommanderResources>,
    side: 'EAST' | 'WEST'
  ): CommanderResources {
    const preset = getDefaultPreset();
    const defaultResources = this.createInitialResources(side, preset.level);

    // Merge persisted data with defaults for any missing fields
    return {
      side,
      tickets: typeof data.tickets === 'number' ? data.tickets : defaultResources.tickets,
      maxTickets: typeof data.maxTickets === 'number' ? data.maxTickets : defaultResources.maxTickets,
      ticketRegen: typeof data.ticketRegen === 'number' ? data.ticketRegen : defaultResources.ticketRegen,
      lastRegenTime: typeof data.lastRegenTime === 'number' ? data.lastRegenTime : Date.now(),
      unitPool: this.restoreUnitPool(data.unitPool, defaultResources.unitPool),
      supportAssets: this.restoreSupportAssets(data.supportAssets, defaultResources.supportAssets),
      activeUnits: typeof data.activeUnits === 'number' ? data.activeUnits : defaultResources.activeUnits,
      maxActiveUnits: typeof data.maxActiveUnits === 'number' ? data.maxActiveUnits : defaultResources.maxActiveUnits,
      lastSpawnTime: typeof data.lastSpawnTime === 'number' ? data.lastSpawnTime : defaultResources.lastSpawnTime,
      spawnCooldown: typeof data.spawnCooldown === 'number' ? data.spawnCooldown : defaultResources.spawnCooldown,
      controlledObjectives: Array.isArray(data.controlledObjectives) ? data.controlledObjectives : defaultResources.controlledObjectives,
      bonusTicketIncome: typeof data.bonusTicketIncome === 'number' ? data.bonusTicketIncome : defaultResources.bonusTicketIncome,
    };
  }

  /**
   * Restore unit pool with validation and defaults for missing pools
   * @param data - Persisted unit pool data
   * @param defaults - Default unit pool values
   * @returns Validated UnitPool object
   */
  private restoreUnitPool(
    data: Partial<UnitPool> | undefined,
    defaults: UnitPool
  ): UnitPool {
    if (!data || typeof data !== 'object') {
      return defaults;
    }

    const restorePoolCategory = (
      poolData: { available?: number; max?: number } | undefined,
      defaultCategory: { available: number; max: number }
    ) => ({
      available: typeof poolData?.available === 'number' ? poolData.available : defaultCategory.available,
      max: typeof poolData?.max === 'number' ? poolData.max : defaultCategory.max,
    });

    return {
      infantry: restorePoolCategory(data.infantry, defaults.infantry),
      lightVehicle: restorePoolCategory(data.lightVehicle, defaults.lightVehicle),
      heavyArmor: restorePoolCategory(data.heavyArmor, defaults.heavyArmor),
      helicopter: restorePoolCategory(data.helicopter, defaults.helicopter),
      fixedWing: restorePoolCategory(data.fixedWing, defaults.fixedWing),
    };
  }

  /**
   * Restore support assets with validation and defaults for missing assets
   * @param data - Persisted support assets data
   * @param defaults - Default support assets values
   * @returns Validated SupportAssets object
   */
  private restoreSupportAssets(
    data: Partial<SupportAssets> | undefined,
    defaults: SupportAssets
  ): SupportAssets {
    if (!data || typeof data !== 'object') {
      return defaults;
    }

    return {
      artilleryStrikes: typeof data.artilleryStrikes === 'number' ? data.artilleryStrikes : defaults.artilleryStrikes,
      casSorties: typeof data.casSorties === 'number' ? data.casSorties : defaults.casSorties,
      resupplyDrops: typeof data.resupplyDrops === 'number' ? data.resupplyDrops : defaults.resupplyDrops,
      medevacMissions: typeof data.medevacMissions === 'number' ? data.medevacMissions : defaults.medevacMissions,
    };
  }

  /**
   * Delete the persistence file
   * @param filePath - Optional custom file path
   * @returns true if deletion succeeded or file doesn't exist
   */
  deletePersistenceFile(filePath?: string): boolean {
    const targetPath = filePath ?? this.getDefaultPersistencePath();

    try {
      if (fs.existsSync(targetPath)) {
        fs.unlinkSync(targetPath);
        logger.info('Persistence file deleted', { path: targetPath });
      }
      return true;
    } catch (error) {
      logger.error('Failed to delete persistence file', {
        path: targetPath,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Check if a persistence file exists
   * @param filePath - Optional custom file path
   * @returns true if file exists
   */
  hasPersistenceFile(filePath?: string): boolean {
    const targetPath = filePath ?? this.getDefaultPersistencePath();
    return fs.existsSync(targetPath);
  }
}

// Export singleton instance
export const resourceManager = new ResourceManager();
