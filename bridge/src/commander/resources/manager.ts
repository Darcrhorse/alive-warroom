/**
 * ResourceManager - Manages AI Commander resources and reinforcement tickets
 *
 * This service replaces the simple budget system with a multi-layered resource
 * management system including tickets, unit pools, support assets, and strategic bonuses.
 *
 * Follows the singleton pattern from GameStateManager.
 */

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

export class ResourceManager {
  private resources: SideResources;
  private transactionHistory: ResourceTransaction[] = [];
  private maxHistorySize: number = 500;
  private lastRegenCheck: number = Date.now();
  private regenIntervalMs: number = 60000; // 1 minute

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
   */
  deductFromPool(side: 'EAST' | 'WEST', poolType: UnitPoolType, count: number = 1): boolean {
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
   */
  restoreToPool(side: 'EAST' | 'WEST', poolType: UnitPoolType, count: number = 1): void {
    const pool = this.resources[side].unitPool[poolType];
    const previousValue = pool.available;

    // Cap at max
    pool.available = Math.min(pool.max, pool.available + count);

    this.logTransaction({
      timestamp: Date.now(),
      side,
      type: 'pool_restore',
      amount: count,
      description: `Restored ${count} to ${poolType} pool`,
      previousValue,
      newValue: pool.available,
    });

    logger.debug(`Pool restored for ${side}`, { poolType, count, newAvailable: pool.available });
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
   * Get comprehensive status of all pools for a side
   */
  getPoolStatus(side: 'EAST' | 'WEST'): Record<UnitPoolType, { available: number; max: number; utilized: number; exhausted: boolean }> {
    const poolTypes: UnitPoolType[] = ['infantry', 'lightVehicle', 'heavyArmor', 'helicopter', 'fixedWing'];
    const status: Record<string, { available: number; max: number; utilized: number; exhausted: boolean }> = {};

    for (const poolType of poolTypes) {
      const pool = this.resources[side].unitPool[poolType];
      status[poolType] = {
        available: pool.available,
        max: pool.max,
        utilized: this.getPoolUtilization(side, poolType),
        exhausted: pool.available === 0,
      };
    }

    return status as Record<UnitPoolType, { available: number; max: number; utilized: number; exhausted: boolean }>;
  }

  /**
   * Get summary totals for all pools
   */
  getPoolSummary(side: 'EAST' | 'WEST'): { totalAvailable: number; totalMax: number; totalUtilized: number; exhaustedPools: UnitPoolType[] } {
    const poolTypes: UnitPoolType[] = ['infantry', 'lightVehicle', 'heavyArmor', 'helicopter', 'fixedWing'];
    let totalAvailable = 0;
    let totalMax = 0;
    const exhaustedPools: UnitPoolType[] = [];

    for (const poolType of poolTypes) {
      const pool = this.resources[side].unitPool[poolType];
      totalAvailable += pool.available;
      totalMax += pool.max;
      if (pool.available === 0) {
        exhaustedPools.push(poolType);
      }
    }

    return {
      totalAvailable,
      totalMax,
      totalUtilized: totalMax > 0 ? (totalMax - totalAvailable) / totalMax : 0,
      exhaustedPools,
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
   */
  hasSupportAsset(side: 'EAST' | 'WEST', assetType: SupportAssetType): boolean {
    return this.resources[side].supportAssets[assetType] > 0;
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
}

// Export singleton instance
export const resourceManager = new ResourceManager();
