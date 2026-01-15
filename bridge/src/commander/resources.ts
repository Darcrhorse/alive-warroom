/**
 * Resources System - Unit pools, reinforcement tickets, ammo/fuel tracking, and resource regeneration
 */

import { UnitPool } from '../game-state/types';
import { logger } from '../utils/logger';

/**
 * Unit type categories for spawning
 */
export type UnitType = keyof UnitPool;

/**
 * Configuration for resource regeneration
 */
export interface RegenerationConfig {
  ticketRegenRate: number; // tickets per minute
  ticketRegenInterval: number; // milliseconds between regen checks
  ammoRegenRate: number; // percentage points per minute
  fuelRegenRate: number; // percentage points per minute
  maxTickets: number;
  maxAmmo: number; // 0-100
  maxFuel: number; // 0-100
}

/**
 * Cost definition for spawning units
 */
export interface UnitCost {
  tickets: number;
  ammo: number; // percentage points consumed
  fuel: number; // percentage points consumed
}

/**
 * Default costs for each unit type
 */
const DEFAULT_UNIT_COSTS: Record<UnitType, UnitCost> = {
  infantrySquads: { tickets: 1, ammo: 5, fuel: 0 },
  lightVehicles: { tickets: 2, ammo: 3, fuel: 10 },
  apcs: { tickets: 3, ammo: 8, fuel: 15 },
  tanks: { tickets: 5, ammo: 15, fuel: 25 },
  helicopters: { tickets: 4, ammo: 10, fuel: 20 },
  aircraft: { tickets: 6, ammo: 20, fuel: 30 }
};

/**
 * Default initial unit pool
 */
const DEFAULT_UNIT_POOL: UnitPool = {
  infantrySquads: 10,
  lightVehicles: 5,
  apcs: 3,
  tanks: 2,
  helicopters: 2,
  aircraft: 1
};

/**
 * Default regeneration configuration
 */
const DEFAULT_REGEN_CONFIG: RegenerationConfig = {
  ticketRegenRate: 1, // 1 ticket per minute
  ticketRegenInterval: 60000, // check every minute
  ammoRegenRate: 2, // 2% per minute
  fuelRegenRate: 3, // 3% per minute
  maxTickets: 50,
  maxAmmo: 100,
  maxFuel: 100
};

/**
 * Result of a resource consumption attempt
 */
export interface ConsumptionResult {
  success: boolean;
  reason?: string;
  consumed?: {
    tickets: number;
    ammo: number;
    fuel: number;
  };
}

/**
 * Resource snapshot for state serialization
 */
export interface ResourceSnapshot {
  unitPool: UnitPool;
  reinforcementTickets: number;
  ammoSupply: number;
  fuelSupply: number;
  deployedCounts: Record<UnitType, number>;
}

/**
 * ResourceManager - Manages unit pools, tickets, and supplies for a commander
 *
 * Handles resource tracking, consumption, regeneration, and availability checks.
 */
export class ResourceManager {
  private side: 'EAST' | 'WEST';
  private unitPool: UnitPool;
  private deployedUnits: Record<UnitType, number>;
  private reinforcementTickets: number;
  private ammoSupply: number; // 0-100
  private fuelSupply: number; // 0-100
  private maxUnits: number;
  private regenConfig: RegenerationConfig;
  private unitCosts: Record<UnitType, UnitCost>;
  private lastRegenTime: number;
  private regenIntervalId: ReturnType<typeof setInterval> | null = null;

  constructor(
    side: 'EAST' | 'WEST',
    options?: {
      initialPool?: Partial<UnitPool>;
      initialTickets?: number;
      initialAmmo?: number;
      initialFuel?: number;
      maxUnits?: number;
      regenConfig?: Partial<RegenerationConfig>;
      unitCosts?: Partial<Record<UnitType, UnitCost>>;
    }
  ) {
    this.side = side;
    this.unitPool = { ...DEFAULT_UNIT_POOL, ...options?.initialPool };
    this.deployedUnits = {
      infantrySquads: 0,
      lightVehicles: 0,
      apcs: 0,
      tanks: 0,
      helicopters: 0,
      aircraft: 0
    };
    this.reinforcementTickets = options?.initialTickets ?? 20;
    this.ammoSupply = options?.initialAmmo ?? 100;
    this.fuelSupply = options?.initialFuel ?? 100;
    this.maxUnits = options?.maxUnits ?? 50;
    this.regenConfig = { ...DEFAULT_REGEN_CONFIG, ...options?.regenConfig };
    this.unitCosts = { ...DEFAULT_UNIT_COSTS, ...options?.unitCosts };
    this.lastRegenTime = Date.now();

    logger.info('ResourceManager initialized', {
      side,
      tickets: this.reinforcementTickets,
      ammo: this.ammoSupply,
      fuel: this.fuelSupply
    });
  }

  /**
   * Start automatic resource regeneration
   */
  startRegeneration(): void {
    if (this.regenIntervalId !== null) {
      logger.warn('Regeneration already running', { side: this.side });
      return;
    }

    this.regenIntervalId = setInterval(() => {
      this.regenerateResources();
    }, this.regenConfig.ticketRegenInterval);

    logger.info('Resource regeneration started', {
      side: this.side,
      interval: this.regenConfig.ticketRegenInterval
    });
  }

  /**
   * Stop automatic resource regeneration
   */
  stopRegeneration(): void {
    if (this.regenIntervalId !== null) {
      clearInterval(this.regenIntervalId);
      this.regenIntervalId = null;
      logger.info('Resource regeneration stopped', { side: this.side });
    }
  }

  /**
   * Perform resource regeneration tick
   */
  private regenerateResources(): void {
    const now = Date.now();
    const elapsedMinutes = (now - this.lastRegenTime) / 60000;
    this.lastRegenTime = now;

    let regenerated = false;

    // Regenerate tickets
    if (this.reinforcementTickets < this.regenConfig.maxTickets) {
      const ticketRegen = Math.floor(this.regenConfig.ticketRegenRate * elapsedMinutes);
      if (ticketRegen > 0) {
        this.reinforcementTickets = Math.min(
          this.regenConfig.maxTickets,
          this.reinforcementTickets + ticketRegen
        );
        regenerated = true;
      }
    }

    // Regenerate ammo
    if (this.ammoSupply < this.regenConfig.maxAmmo) {
      const ammoRegen = this.regenConfig.ammoRegenRate * elapsedMinutes;
      this.ammoSupply = Math.min(this.regenConfig.maxAmmo, this.ammoSupply + ammoRegen);
      regenerated = true;
    }

    // Regenerate fuel
    if (this.fuelSupply < this.regenConfig.maxFuel) {
      const fuelRegen = this.regenConfig.fuelRegenRate * elapsedMinutes;
      this.fuelSupply = Math.min(this.regenConfig.maxFuel, this.fuelSupply + fuelRegen);
      regenerated = true;
    }

    if (regenerated) {
      logger.debug('Resources regenerated', {
        side: this.side,
        tickets: this.reinforcementTickets,
        ammo: this.ammoSupply.toFixed(1),
        fuel: this.fuelSupply.toFixed(1)
      });
    }
  }

  /**
   * Check if a unit type can be spawned (has available units and resources)
   */
  canSpawn(unitType: UnitType, count: number = 1): boolean {
    // Check unit pool availability
    if (this.unitPool[unitType] < count) {
      return false;
    }

    // Check max units limit
    const totalDeployed = this.getTotalDeployedUnits();
    if (totalDeployed + count > this.maxUnits) {
      return false;
    }

    // Check resource costs
    const cost = this.unitCosts[unitType];
    const totalCost = {
      tickets: cost.tickets * count,
      ammo: cost.ammo * count,
      fuel: cost.fuel * count
    };

    return (
      this.reinforcementTickets >= totalCost.tickets &&
      this.ammoSupply >= totalCost.ammo &&
      this.fuelSupply >= totalCost.fuel
    );
  }

  /**
   * Attempt to consume resources for spawning units
   */
  consumeForSpawn(unitType: UnitType, count: number = 1): ConsumptionResult {
    if (!this.canSpawn(unitType, count)) {
      const reasons: string[] = [];

      if (this.unitPool[unitType] < count) {
        reasons.push(`Insufficient ${unitType} in pool (${this.unitPool[unitType]}/${count})`);
      }

      const totalDeployed = this.getTotalDeployedUnits();
      if (totalDeployed + count > this.maxUnits) {
        reasons.push(`Would exceed max units (${totalDeployed + count}/${this.maxUnits})`);
      }

      const cost = this.unitCosts[unitType];
      if (this.reinforcementTickets < cost.tickets * count) {
        reasons.push(`Insufficient tickets (${this.reinforcementTickets}/${cost.tickets * count})`);
      }
      if (this.ammoSupply < cost.ammo * count) {
        reasons.push(`Insufficient ammo (${this.ammoSupply.toFixed(1)}/${cost.ammo * count})`);
      }
      if (this.fuelSupply < cost.fuel * count) {
        reasons.push(`Insufficient fuel (${this.fuelSupply.toFixed(1)}/${cost.fuel * count})`);
      }

      logger.warn('Spawn consumption failed', {
        side: this.side,
        unitType,
        count,
        reasons
      });

      return {
        success: false,
        reason: reasons.join('; ')
      };
    }

    const cost = this.unitCosts[unitType];
    const totalCost = {
      tickets: cost.tickets * count,
      ammo: cost.ammo * count,
      fuel: cost.fuel * count
    };

    // Consume resources
    this.unitPool[unitType] -= count;
    this.deployedUnits[unitType] += count;
    this.reinforcementTickets -= totalCost.tickets;
    this.ammoSupply -= totalCost.ammo;
    this.fuelSupply -= totalCost.fuel;

    logger.info('Resources consumed for spawn', {
      side: this.side,
      unitType,
      count,
      consumed: totalCost,
      remaining: {
        tickets: this.reinforcementTickets,
        ammo: this.ammoSupply.toFixed(1),
        fuel: this.fuelSupply.toFixed(1)
      }
    });

    return {
      success: true,
      consumed: totalCost
    };
  }

  /**
   * Return units to the pool (e.g., after extraction or group dissolution)
   */
  returnToPool(unitType: UnitType, count: number = 1): void {
    const returnable = Math.min(count, this.deployedUnits[unitType]);
    this.deployedUnits[unitType] -= returnable;
    this.unitPool[unitType] += returnable;

    logger.info('Units returned to pool', {
      side: this.side,
      unitType,
      count: returnable,
      poolTotal: this.unitPool[unitType]
    });
  }

  /**
   * Mark units as lost (destroyed in combat)
   */
  markLost(unitType: UnitType, count: number = 1): void {
    const lostCount = Math.min(count, this.deployedUnits[unitType]);
    this.deployedUnits[unitType] -= lostCount;

    logger.info('Units marked as lost', {
      side: this.side,
      unitType,
      count: lostCount,
      remainingDeployed: this.deployedUnits[unitType]
    });
  }

  /**
   * Get total deployed units across all types
   */
  getTotalDeployedUnits(): number {
    return Object.values(this.deployedUnits).reduce((sum, count) => sum + count, 0);
  }

  /**
   * Get total available units in pool
   */
  getTotalAvailableUnits(): number {
    return Object.values(this.unitPool).reduce((sum, count) => sum + count, 0);
  }

  /**
   * Get the current unit pool
   */
  getUnitPool(): UnitPool {
    return { ...this.unitPool };
  }

  /**
   * Get deployed unit counts
   */
  getDeployedUnits(): Record<UnitType, number> {
    return { ...this.deployedUnits };
  }

  /**
   * Get current reinforcement tickets
   */
  getTickets(): number {
    return this.reinforcementTickets;
  }

  /**
   * Get current ammo supply
   */
  getAmmo(): number {
    return this.ammoSupply;
  }

  /**
   * Get current fuel supply
   */
  getFuel(): number {
    return this.fuelSupply;
  }

  /**
   * Get max units limit
   */
  getMaxUnits(): number {
    return this.maxUnits;
  }

  /**
   * Directly add tickets (e.g., from capturing objectives)
   */
  addTickets(amount: number): void {
    const newTotal = Math.min(this.regenConfig.maxTickets, this.reinforcementTickets + amount);
    const added = newTotal - this.reinforcementTickets;
    this.reinforcementTickets = newTotal;

    logger.info('Tickets added', {
      side: this.side,
      requested: amount,
      added,
      total: this.reinforcementTickets
    });
  }

  /**
   * Directly add ammo (e.g., from supply drops)
   */
  addAmmo(amount: number): void {
    const newTotal = Math.min(this.regenConfig.maxAmmo, this.ammoSupply + amount);
    const added = newTotal - this.ammoSupply;
    this.ammoSupply = newTotal;

    logger.debug('Ammo added', {
      side: this.side,
      requested: amount,
      added: added.toFixed(1),
      total: this.ammoSupply.toFixed(1)
    });
  }

  /**
   * Directly add fuel (e.g., from supply drops)
   */
  addFuel(amount: number): void {
    const newTotal = Math.min(this.regenConfig.maxFuel, this.fuelSupply + amount);
    const added = newTotal - this.fuelSupply;
    this.fuelSupply = newTotal;

    logger.debug('Fuel added', {
      side: this.side,
      requested: amount,
      added: added.toFixed(1),
      total: this.fuelSupply.toFixed(1)
    });
  }

  /**
   * Consume ammo for operations (e.g., artillery fire)
   */
  consumeAmmo(amount: number): boolean {
    if (this.ammoSupply < amount) {
      logger.warn('Insufficient ammo for operation', {
        side: this.side,
        requested: amount,
        available: this.ammoSupply.toFixed(1)
      });
      return false;
    }

    this.ammoSupply -= amount;
    logger.debug('Ammo consumed', {
      side: this.side,
      amount,
      remaining: this.ammoSupply.toFixed(1)
    });
    return true;
  }

  /**
   * Consume fuel for operations (e.g., extended air operations)
   */
  consumeFuel(amount: number): boolean {
    if (this.fuelSupply < amount) {
      logger.warn('Insufficient fuel for operation', {
        side: this.side,
        requested: amount,
        available: this.fuelSupply.toFixed(1)
      });
      return false;
    }

    this.fuelSupply -= amount;
    logger.debug('Fuel consumed', {
      side: this.side,
      amount,
      remaining: this.fuelSupply.toFixed(1)
    });
    return true;
  }

  /**
   * Check if resources are critically low
   */
  isResourcesCritical(): boolean {
    return (
      this.reinforcementTickets <= 2 ||
      this.ammoSupply <= 10 ||
      this.fuelSupply <= 10
    );
  }

  /**
   * Check if resources are sufficient for active operations
   */
  hasOperationalCapacity(): boolean {
    return (
      this.reinforcementTickets > 0 &&
      this.ammoSupply > 20 &&
      this.fuelSupply > 20 &&
      this.getTotalAvailableUnits() > 0
    );
  }

  /**
   * Get a snapshot of current resource state
   */
  getSnapshot(): ResourceSnapshot {
    return {
      unitPool: this.getUnitPool(),
      reinforcementTickets: this.reinforcementTickets,
      ammoSupply: this.ammoSupply,
      fuelSupply: this.fuelSupply,
      deployedCounts: this.getDeployedUnits()
    };
  }

  /**
   * Get resource statistics
   */
  getStatistics(): {
    side: 'EAST' | 'WEST';
    totalAvailable: number;
    totalDeployed: number;
    tickets: number;
    maxTickets: number;
    ammo: number;
    fuel: number;
    isCritical: boolean;
    hasCapacity: boolean;
  } {
    return {
      side: this.side,
      totalAvailable: this.getTotalAvailableUnits(),
      totalDeployed: this.getTotalDeployedUnits(),
      tickets: this.reinforcementTickets,
      maxTickets: this.regenConfig.maxTickets,
      ammo: Math.round(this.ammoSupply),
      fuel: Math.round(this.fuelSupply),
      isCritical: this.isResourcesCritical(),
      hasCapacity: this.hasOperationalCapacity()
    };
  }

  /**
   * Get unit cost for a specific type
   */
  getUnitCost(unitType: UnitType): UnitCost {
    return { ...this.unitCosts[unitType] };
  }

  /**
   * Update unit costs (for difficulty scaling)
   */
  setUnitCosts(costs: Partial<Record<UnitType, Partial<UnitCost>>>): void {
    for (const [unitType, cost] of Object.entries(costs)) {
      if (cost && unitType in this.unitCosts) {
        this.unitCosts[unitType as UnitType] = {
          ...this.unitCosts[unitType as UnitType],
          ...cost
        };
      }
    }

    logger.info('Unit costs updated', { side: this.side });
  }

  /**
   * Reset resources to initial state
   */
  reset(options?: {
    pool?: Partial<UnitPool>;
    tickets?: number;
    ammo?: number;
    fuel?: number;
  }): void {
    this.unitPool = { ...DEFAULT_UNIT_POOL, ...options?.pool };
    this.deployedUnits = {
      infantrySquads: 0,
      lightVehicles: 0,
      apcs: 0,
      tanks: 0,
      helicopters: 0,
      aircraft: 0
    };
    this.reinforcementTickets = options?.tickets ?? 20;
    this.ammoSupply = options?.ammo ?? 100;
    this.fuelSupply = options?.fuel ?? 100;
    this.lastRegenTime = Date.now();

    logger.info('Resources reset', {
      side: this.side,
      tickets: this.reinforcementTickets,
      ammo: this.ammoSupply,
      fuel: this.fuelSupply
    });
  }

  /**
   * Clean up resources (stop regeneration timer)
   */
  dispose(): void {
    this.stopRegeneration();
    logger.info('ResourceManager disposed', { side: this.side });
  }
}

/**
 * Factory function to create a ResourceManager for a specific side
 */
export function createResourceManager(
  side: 'EAST' | 'WEST',
  options?: {
    initialPool?: Partial<UnitPool>;
    initialTickets?: number;
    initialAmmo?: number;
    initialFuel?: number;
    maxUnits?: number;
    regenConfig?: Partial<RegenerationConfig>;
    unitCosts?: Partial<Record<UnitType, UnitCost>>;
  }
): ResourceManager {
  return new ResourceManager(side, options);
}
