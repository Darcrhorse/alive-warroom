/**
 * Spawn Validator - 5-Check Gate for AI Commander Spawns
 *
 * Implements the spawn validation chain that must pass before ANY spawn occurs.
 * All 5 checks must pass; if ANY fails, the spawn is blocked with logged reason.
 *
 * Checks:
 * 1. Ticket availability - Enough tickets for the spawn cost
 * 2. Unit pool availability - Pool has available units
 * 3. Active unit cap - Not exceeding maximum active units
 * 4. Objective assignment - Valid objective for the spawn
 * 5. Spawn cooldown - Enough time has passed since last spawn
 */

import { logger } from '../../utils/logger';
import {
  CommanderResources,
  SpawnValidation,
  UnitPoolType,
} from './types';
import {
  ResourceManager,
  DEFAULT_SPAWN_COSTS,
  SPAWN_TYPE_TO_POOL,
} from './manager';

/**
 * Configuration for spawn validation
 */
export interface SpawnValidationConfig {
  /** Whether to enforce cooldown check (can be disabled for testing) */
  enforceCooldown: boolean;
  /** Whether to enforce objective assignment check */
  enforceObjective: boolean;
  /** Minimum pool availability warning threshold (percentage 0.0-1.0) */
  poolWarningThreshold: number;
  /** Minimum ticket warning threshold (percentage 0.0-1.0) */
  ticketWarningThreshold: number;
}

/**
 * Default validation configuration
 */
export const DEFAULT_VALIDATION_CONFIG: SpawnValidationConfig = {
  enforceCooldown: true,
  enforceObjective: false, // Disabled by default - objectives are optional
  poolWarningThreshold: 0.2, // Warn when pool is below 20%
  ticketWarningThreshold: 0.25, // Warn when tickets are below 25%
};

/**
 * Request for spawn validation
 */
export interface SpawnRequest {
  /** Side requesting the spawn */
  side: 'EAST' | 'WEST';
  /** Type of unit to spawn (e.g., 'infantry', 'tank', 'helicopter') */
  spawnType: string;
  /** Number of units to spawn (default 1) */
  count?: number;
  /** Optional target objective ID for the spawn */
  targetObjective?: string;
  /** Override spawn cost (uses default if not provided) */
  costOverride?: number;
}

/**
 * SpawnValidator - Implements the 5-check gate for spawn validation
 *
 * Follows the pattern from SQFValidator for consistent error handling
 * and result reporting.
 */
export class SpawnValidator {
  private config: SpawnValidationConfig;

  constructor(config: Partial<SpawnValidationConfig> = {}) {
    this.config = { ...DEFAULT_VALIDATION_CONFIG, ...config };
  }

  /**
   * Validate a spawn request against all 5 checks
   *
   * @param resourceManager - ResourceManager instance to check against
   * @param request - Spawn request details
   * @returns SpawnValidation result with allowed status and any failures/warnings
   */
  validateSpawn(resourceManager: ResourceManager, request: SpawnRequest): SpawnValidation {
    const failedChecks: string[] = [];
    const warnings: string[] = [];

    const count = request.count ?? 1;
    const poolType = this.getPoolType(request.spawnType);
    const ticketCost = this.getTicketCost(request.spawnType, request.costOverride) * count;

    // Get current resource state
    const resources = resourceManager.getResources(request.side);

    // Run all 5 validation checks
    this.checkTicketAvailability(resources, ticketCost, failedChecks, warnings);
    this.checkPoolAvailability(resources, poolType, count, failedChecks, warnings);
    this.checkActiveUnitCap(resources, count, failedChecks, warnings);
    this.checkObjectiveAssignment(resources, request.targetObjective, failedChecks, warnings);
    this.checkSpawnCooldown(resources, failedChecks, warnings);

    const allowed = failedChecks.length === 0;

    // Log validation result
    if (!allowed) {
      logger.warn(`Spawn validation FAILED for ${request.side}`, {
        spawnType: request.spawnType,
        count,
        ticketCost,
        poolType,
        failedChecks,
        warnings,
      });
    } else if (warnings.length > 0) {
      logger.debug(`Spawn validation PASSED with warnings for ${request.side}`, {
        spawnType: request.spawnType,
        count,
        ticketCost,
        poolType,
        warnings,
      });
    }

    return {
      allowed,
      failedChecks,
      warnings,
      ticketCost,
      poolType,
    };
  }

  /**
   * Check 1: Ticket Availability
   * Verifies the commander has enough tickets for the spawn cost
   */
  private checkTicketAvailability(
    resources: CommanderResources,
    ticketCost: number,
    failedChecks: string[],
    warnings: string[]
  ): void {
    const { tickets, maxTickets } = resources;

    // Check if enough tickets
    if (tickets < ticketCost) {
      failedChecks.push(
        `Insufficient tickets: need ${ticketCost}, have ${tickets}. ` +
        `Wait for regeneration (${resources.ticketRegen + resources.bonusTicketIncome}/min)`
      );
      return;
    }

    // Warn if tickets are getting low
    const ticketRatio = tickets / maxTickets;
    if (ticketRatio < this.config.ticketWarningThreshold) {
      warnings.push(
        `Low tickets: ${tickets}/${maxTickets} (${Math.round(ticketRatio * 100)}%). ` +
        `Consider waiting for regeneration`
      );
    }

    // Warn if this spawn will deplete tickets significantly
    const remainingAfter = tickets - ticketCost;
    const remainingRatio = remainingAfter / maxTickets;
    if (remainingRatio < this.config.ticketWarningThreshold && ticketRatio >= this.config.ticketWarningThreshold) {
      warnings.push(
        `This spawn will leave only ${remainingAfter} tickets (${Math.round(remainingRatio * 100)}%)`
      );
    }
  }

  /**
   * Check 2: Unit Pool Availability
   * Verifies the unit pool has available slots for the requested unit type
   */
  private checkPoolAvailability(
    resources: CommanderResources,
    poolType: UnitPoolType,
    count: number,
    failedChecks: string[],
    warnings: string[]
  ): void {
    const pool = resources.unitPool[poolType];
    const { available, max } = pool;

    // Check if pool has enough available units
    if (available < count) {
      if (available === 0) {
        failedChecks.push(
          `Unit pool exhausted: ${poolType} pool is empty (0/${max}). ` +
          `Wait for units to be destroyed or RTB`
        );
      } else {
        failedChecks.push(
          `Insufficient pool capacity: ${poolType} pool has ${available}/${max}, need ${count}. ` +
          `Try spawning fewer units or wait for units to return`
        );
      }
      return;
    }

    // Warn if pool is getting low
    const poolRatio = available / max;
    if (poolRatio < this.config.poolWarningThreshold && max > 0) {
      warnings.push(
        `Low ${poolType} pool: ${available}/${max} (${Math.round(poolRatio * 100)}%) remaining`
      );
    }

    // Warn if this spawn will deplete the pool significantly
    const remainingAfter = available - count;
    const remainingRatio = max > 0 ? remainingAfter / max : 0;
    if (remainingRatio < this.config.poolWarningThreshold && poolRatio >= this.config.poolWarningThreshold) {
      warnings.push(
        `This spawn will leave only ${remainingAfter} ${poolType} units (${Math.round(remainingRatio * 100)}%)`
      );
    }
  }

  /**
   * Check 3: Active Unit Cap
   * Verifies the total active unit count won't exceed the performance limit
   */
  private checkActiveUnitCap(
    resources: CommanderResources,
    count: number,
    failedChecks: string[],
    warnings: string[]
  ): void {
    const { activeUnits, maxActiveUnits } = resources;

    // Check if adding units would exceed cap
    const newTotal = activeUnits + count;
    if (newTotal > maxActiveUnits) {
      const available = maxActiveUnits - activeUnits;
      failedChecks.push(
        `Active unit cap reached: ${activeUnits}/${maxActiveUnits} active. ` +
        `Can only spawn ${Math.max(0, available)} more units. ` +
        `Wait for units to die or RTB`
      );
      return;
    }

    // Warn if approaching cap
    const utilizationRatio = newTotal / maxActiveUnits;
    if (utilizationRatio > 0.8) {
      const remaining = maxActiveUnits - newTotal;
      warnings.push(
        `Approaching active unit cap: ${newTotal}/${maxActiveUnits} after spawn. ` +
        `Only ${remaining} more units can be spawned`
      );
    }
  }

  /**
   * Check 4: Objective Assignment
   * Validates that the spawn has a valid objective (if enforcement is enabled)
   *
   * This check can be:
   * - Disabled: All spawns pass regardless of objective
   * - Enabled: Spawns must have a target objective or controlled objective
   */
  private checkObjectiveAssignment(
    resources: CommanderResources,
    targetObjective: string | undefined,
    failedChecks: string[],
    warnings: string[]
  ): void {
    // Skip check if not enforced
    if (!this.config.enforceObjective) {
      return;
    }

    const { controlledObjectives } = resources;

    // If no target objective specified
    if (!targetObjective) {
      if (controlledObjectives.length === 0) {
        failedChecks.push(
          'No target objective specified and no controlled objectives. ' +
          'Spawns require a strategic objective for deployment'
        );
      } else {
        warnings.push(
          `No target objective specified. Consider assigning to: ${controlledObjectives.join(', ')}`
        );
      }
      return;
    }

    // Warn if target objective is not controlled (units may have longer travel)
    if (!controlledObjectives.includes(targetObjective)) {
      warnings.push(
        `Target objective '${targetObjective}' is not controlled by ${resources.side}. ` +
        `Units may face hostile territory during deployment`
      );
    }
  }

  /**
   * Check 5: Spawn Cooldown
   * Verifies enough time has passed since the last spawn
   */
  private checkSpawnCooldown(
    resources: CommanderResources,
    failedChecks: string[],
    warnings: string[]
  ): void {
    // Skip check if not enforced
    if (!this.config.enforceCooldown) {
      return;
    }

    const { lastSpawnTime, spawnCooldown } = resources;

    // If never spawned, allow
    if (lastSpawnTime === 0) {
      return;
    }

    const now = Date.now();
    const elapsed = now - lastSpawnTime;
    const remaining = spawnCooldown - elapsed;

    if (remaining > 0) {
      const remainingSec = Math.ceil(remaining / 1000);
      failedChecks.push(
        `Spawn cooldown active: ${remainingSec} seconds remaining. ` +
        `Wait before spawning more units`
      );
      return;
    }

    // Warn if just came off cooldown (within 5 seconds)
    if (elapsed < spawnCooldown + 5000) {
      warnings.push('Spawn cooldown just ended. Consider spacing out spawns for tactical flexibility');
    }
  }

  // ==================== Helper Methods ====================

  /**
   * Get the unit pool type for a spawn type
   */
  private getPoolType(spawnType: string): UnitPoolType {
    return SPAWN_TYPE_TO_POOL[spawnType] ?? 'infantry';
  }

  /**
   * Get the ticket cost for a spawn type
   */
  private getTicketCost(spawnType: string, costOverride?: number): number {
    if (costOverride !== undefined && costOverride >= 0) {
      return costOverride;
    }
    return DEFAULT_SPAWN_COSTS[spawnType] ?? DEFAULT_SPAWN_COSTS.infantry;
  }

  /**
   * Update validation configuration
   */
  setConfig(config: Partial<SpawnValidationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current validation configuration
   */
  getConfig(): SpawnValidationConfig {
    return { ...this.config };
  }

  /**
   * Enable/disable cooldown enforcement
   */
  setCooldownEnforcement(enabled: boolean): void {
    this.config.enforceCooldown = enabled;
  }

  /**
   * Enable/disable objective enforcement
   */
  setObjectiveEnforcement(enabled: boolean): void {
    this.config.enforceObjective = enabled;
  }
}

// ==================== Convenience Functions ====================

/**
 * Validate a spawn request using the default validator
 * Convenience function for quick validation checks
 */
export function validateSpawn(
  resourceManager: ResourceManager,
  request: SpawnRequest,
  config?: Partial<SpawnValidationConfig>
): SpawnValidation {
  const validator = new SpawnValidator(config);
  return validator.validateSpawn(resourceManager, request);
}

/**
 * Quick check if a spawn would be allowed (without full validation details)
 */
export function canSpawn(
  resourceManager: ResourceManager,
  side: 'EAST' | 'WEST',
  spawnType: string,
  count: number = 1
): boolean {
  const result = validateSpawn(resourceManager, { side, spawnType, count });
  return result.allowed;
}

/**
 * Get spawn cost for a unit type
 */
export function getSpawnCost(spawnType: string): number {
  return DEFAULT_SPAWN_COSTS[spawnType] ?? DEFAULT_SPAWN_COSTS.infantry;
}

/**
 * Get pool type for a spawn type
 */
export function getPoolTypeForSpawn(spawnType: string): UnitPoolType {
  return SPAWN_TYPE_TO_POOL[spawnType] ?? 'infantry';
}

// Export singleton validator for convenience
export const spawnValidator = new SpawnValidator();
