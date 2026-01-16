/**
 * Tests for Resource Manager
 */

import { ResourceManager, DEFAULT_SPAWN_COSTS, SPAWN_TYPE_TO_POOL } from '../src/commander/resources/manager';
import { getDefaultPreset, getPresetByLevel } from '../src/commander/resources/presets';

describe('ResourceManager', () => {
  let manager: ResourceManager;

  beforeEach(() => {
    // Create a fresh instance for each test
    manager = new ResourceManager();
  });

  describe('initialization', () => {
    it('should initialize with default preset for both sides', () => {
      const preset = getDefaultPreset();
      const eastResources = manager.getResources('EAST');
      const westResources = manager.getResources('WEST');

      expect(eastResources.side).toBe('EAST');
      expect(westResources.side).toBe('WEST');
      expect(eastResources.tickets).toBe(preset.tickets);
      expect(westResources.tickets).toBe(preset.tickets);
    });

    it('should initialize with valid unit pools', () => {
      const eastPool = manager.getUnitPool('EAST');

      expect(eastPool.infantry.available).toBeGreaterThan(0);
      expect(eastPool.infantry.available).toBe(eastPool.infantry.max);
      expect(eastPool.lightVehicle.available).toBe(eastPool.lightVehicle.max);
      expect(eastPool.heavyArmor.available).toBe(eastPool.heavyArmor.max);
      expect(eastPool.helicopter.available).toBe(eastPool.helicopter.max);
      expect(eastPool.fixedWing.available).toBe(eastPool.fixedWing.max);
    });

    it('should initialize with valid support assets', () => {
      const eastAssets = manager.getSupportAssets('EAST');

      expect(eastAssets.artilleryStrikes).toBeGreaterThan(0);
      expect(eastAssets.casSorties).toBeGreaterThan(0);
      expect(eastAssets.resupplyDrops).toBeGreaterThan(0);
      expect(eastAssets.medevacMissions).toBeGreaterThan(0);
    });

    it('should initialize with zero active units', () => {
      expect(manager.getActiveUnits('EAST')).toBe(0);
      expect(manager.getActiveUnits('WEST')).toBe(0);
    });

    it('should initialize with valid max active units limit', () => {
      expect(manager.getMaxActiveUnits('EAST')).toBeGreaterThan(0);
      expect(manager.getMaxActiveUnits('WEST')).toBeGreaterThan(0);
    });

    it('should report as initialized for both sides', () => {
      expect(manager.isInitialized('EAST')).toBe(true);
      expect(manager.isInitialized('WEST')).toBe(true);
    });

    it('should initialize side with specific difficulty level', () => {
      const hardLevel = 8;
      const hardPreset = getPresetByLevel(hardLevel);

      manager.initializeSide('EAST', hardLevel);
      const resources = manager.getResources('EAST');

      expect(resources.tickets).toBe(hardPreset.tickets);
      expect(resources.maxTickets).toBe(hardPreset.maxTickets);
    });

    it('should have empty controlled objectives initially', () => {
      const objectives = manager.getControlledObjectives('EAST');
      expect(objectives).toHaveLength(0);
    });

    it('should start with no spawn cooldown active', () => {
      expect(manager.isOnCooldown('EAST')).toBe(false);
      expect(manager.isOnCooldown('WEST')).toBe(false);
    });
  });

  describe('spendTickets', () => {
    it('should successfully spend tickets when sufficient', () => {
      const initialTickets = manager.getTickets('EAST');
      const spendAmount = 10;

      const result = manager.spendTickets('EAST', spendAmount, 'Test spend');

      expect(result.success).toBe(true);
      expect(result.remaining).toBe(initialTickets - spendAmount);
      expect(manager.getTickets('EAST')).toBe(initialTickets - spendAmount);
    });

    it('should fail when spending more than available', () => {
      const initialTickets = manager.getTickets('EAST');
      const spendAmount = initialTickets + 100;

      const result = manager.spendTickets('EAST', spendAmount, 'Too much');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Insufficient tickets');
      expect(result.remaining).toBe(initialTickets); // Unchanged
    });

    it('should fail when spending zero or negative amount', () => {
      const result = manager.spendTickets('EAST', 0, 'Invalid amount');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid spend amount');
    });

    it('should fail when spending negative amount', () => {
      const result = manager.spendTickets('EAST', -5, 'Negative amount');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid spend amount');
    });

    it('should never allow tickets to go negative', () => {
      const initialTickets = manager.getTickets('EAST');

      // Spend exactly all tickets
      manager.spendTickets('EAST', initialTickets, 'Spend all');

      expect(manager.getTickets('EAST')).toBe(0);
      expect(manager.getTickets('EAST')).toBeGreaterThanOrEqual(0);
    });

    it('should spend tickets independently per side', () => {
      const eastInitial = manager.getTickets('EAST');
      const westInitial = manager.getTickets('WEST');

      manager.spendTickets('EAST', 20, 'East spend');

      expect(manager.getTickets('EAST')).toBe(eastInitial - 20);
      expect(manager.getTickets('WEST')).toBe(westInitial); // Unchanged
    });

    it('should return correct remaining tickets after spend', () => {
      const initialTickets = manager.getTickets('EAST');

      const result1 = manager.spendTickets('EAST', 10);
      expect(result1.remaining).toBe(initialTickets - 10);

      const result2 = manager.spendTickets('EAST', 5);
      expect(result2.remaining).toBe(initialTickets - 15);
    });
  });

  describe('refundTickets', () => {
    it('should successfully refund tickets', () => {
      const initialTickets = manager.getTickets('EAST');

      // First spend some tickets
      manager.spendTickets('EAST', 30, 'Initial spend');
      const afterSpend = manager.getTickets('EAST');

      // Refund some
      const result = manager.refundTickets('EAST', 15, 'Medevac refund');

      expect(result.success).toBe(true);
      expect(result.newTotal).toBe(afterSpend + 15);
    });

    it('should cap refund at max tickets', () => {
      const maxTickets = manager.getMaxTickets('EAST');

      // Try to refund way more than max
      const result = manager.refundTickets('EAST', 1000, 'Huge refund');

      expect(result.success).toBe(true);
      expect(result.newTotal).toBeLessThanOrEqual(maxTickets);
      expect(manager.getTickets('EAST')).toBeLessThanOrEqual(maxTickets);
    });

    it('should fail when refunding zero amount', () => {
      const result = manager.refundTickets('EAST', 0, 'Zero refund');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid refund amount');
    });

    it('should fail when refunding negative amount', () => {
      const result = manager.refundTickets('EAST', -10, 'Negative refund');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid refund amount');
    });

    it('should refund tickets independently per side', () => {
      // Spend tickets on both sides
      manager.spendTickets('EAST', 20, 'East spend');
      manager.spendTickets('WEST', 20, 'West spend');

      const eastAfterSpend = manager.getTickets('EAST');
      const westAfterSpend = manager.getTickets('WEST');

      // Refund only EAST
      manager.refundTickets('EAST', 10, 'East refund');

      expect(manager.getTickets('EAST')).toBe(eastAfterSpend + 10);
      expect(manager.getTickets('WEST')).toBe(westAfterSpend); // Unchanged
    });

    it('should return correct new total after refund', () => {
      manager.spendTickets('EAST', 50);
      const afterSpend = manager.getTickets('EAST');

      const result = manager.refundTickets('EAST', 20, 'Partial refund');

      expect(result.newTotal).toBe(afterSpend + 20);
      expect(manager.getTickets('EAST')).toBe(result.newTotal);
    });
  });

  describe('unit pool operations', () => {
    it('should deduct from pool successfully', () => {
      const initialAvailable = manager.getPoolAvailable('EAST', 'infantry');

      const result = manager.deductFromPool('EAST', 'infantry', 1);

      expect(result).toBe(true);
      expect(manager.getPoolAvailable('EAST', 'infantry')).toBe(initialAvailable - 1);
    });

    it('should fail to deduct when pool is exhausted', () => {
      const available = manager.getPoolAvailable('EAST', 'fixedWing');

      // Exhaust the pool
      for (let i = 0; i < available; i++) {
        manager.deductFromPool('EAST', 'fixedWing', 1);
      }

      // Try to deduct one more
      const result = manager.deductFromPool('EAST', 'fixedWing', 1);
      expect(result).toBe(false);
      expect(manager.isPoolExhausted('EAST', 'fixedWing')).toBe(true);
    });

    it('should restore to pool successfully', () => {
      // First deduct
      manager.deductFromPool('EAST', 'heavyArmor', 2);
      const afterDeduct = manager.getPoolAvailable('EAST', 'heavyArmor');

      // Restore
      const result = manager.restoreToPool('EAST', 'heavyArmor', 1);

      expect(result).toBe(true);
      expect(manager.getPoolAvailable('EAST', 'heavyArmor')).toBe(afterDeduct + 1);
    });

    it('should cap restoration at pool max', () => {
      const poolMax = manager.getPoolMax('EAST', 'infantry');

      // Restore more than possible
      manager.restoreToPool('EAST', 'infantry', 100);

      expect(manager.getPoolAvailable('EAST', 'infantry')).toBe(poolMax);
    });

    it('should reject invalid deduct counts', () => {
      expect(manager.deductFromPool('EAST', 'infantry', 0)).toBe(false);
      expect(manager.deductFromPool('EAST', 'infantry', -1)).toBe(false);
    });

    it('should reject invalid restore counts', () => {
      expect(manager.restoreToPool('EAST', 'infantry', 0)).toBe(false);
      expect(manager.restoreToPool('EAST', 'infantry', -1)).toBe(false);
    });

    it('should correctly report pool utilization', () => {
      const poolMax = manager.getPoolMax('EAST', 'helicopter');

      // Deduct half
      const toDeduct = Math.floor(poolMax / 2);
      manager.deductFromPool('EAST', 'helicopter', toDeduct);

      const utilization = manager.getPoolUtilization('EAST', 'helicopter');
      expect(utilization).toBeCloseTo(toDeduct / poolMax, 2);
    });

    it('should correctly identify critically low pools', () => {
      const poolMax = manager.getPoolMax('EAST', 'fixedWing');

      // Deduct most of the pool (leaving < 20%)
      const toDeduct = Math.ceil(poolMax * 0.9);
      manager.deductFromPool('EAST', 'fixedWing', toDeduct);

      expect(manager.isPoolCriticallyLow('EAST', 'fixedWing')).toBe(true);
    });
  });

  describe('support assets', () => {
    it('should use support asset successfully', () => {
      const initial = manager.getSupportAssetCount('EAST', 'artilleryStrikes');

      const result = manager.useSupportAsset('EAST', 'artilleryStrikes');

      expect(result).toBe(true);
      expect(manager.getSupportAssetCount('EAST', 'artilleryStrikes')).toBe(initial - 1);
    });

    it('should fail to use exhausted support asset', () => {
      // Exhaust artillery strikes
      while (manager.hasSupportAsset('EAST', 'artilleryStrikes')) {
        manager.useSupportAsset('EAST', 'artilleryStrikes');
      }

      const result = manager.useSupportAsset('EAST', 'artilleryStrikes');
      expect(result).toBe(false);
    });

    it('should correctly check if support asset is available', () => {
      expect(manager.hasSupportAsset('EAST', 'casSorties')).toBe(true);

      // Exhaust CAS sorties
      while (manager.getSupportAssetCount('EAST', 'casSorties') > 0) {
        manager.useSupportAsset('EAST', 'casSorties');
      }

      expect(manager.hasSupportAsset('EAST', 'casSorties')).toBe(false);
    });

    it('should add support assets correctly', () => {
      const initial = manager.getSupportAssetCount('EAST', 'resupplyDrops');

      manager.addSupportAsset('EAST', 'resupplyDrops', 3);

      expect(manager.getSupportAssetCount('EAST', 'resupplyDrops')).toBe(initial + 3);
    });

    it('should handle medevac with ticket refund', () => {
      // Spend some tickets first
      manager.spendTickets('EAST', 40);
      const afterSpend = manager.getTickets('EAST');

      // Use medevac with 50% refund of a 20-ticket unit
      const result = manager.useMedevacMission('EAST', 0.5, 20);

      expect(result.success).toBe(true);
      expect(result.refundAmount).toBe(10); // 50% of 20
      expect(manager.getTickets('EAST')).toBe(afterSpend + 10);
    });
  });

  describe('active unit tracking', () => {
    it('should increment active units', () => {
      manager.incrementActiveUnits('EAST', 5);
      expect(manager.getActiveUnits('EAST')).toBe(5);
    });

    it('should decrement active units', () => {
      manager.incrementActiveUnits('EAST', 10);
      manager.decrementActiveUnits('EAST', 3);
      expect(manager.getActiveUnits('EAST')).toBe(7);
    });

    it('should not allow active units to go negative', () => {
      manager.incrementActiveUnits('EAST', 5);
      manager.decrementActiveUnits('EAST', 10);
      expect(manager.getActiveUnits('EAST')).toBe(0);
    });

    it('should check if more units can spawn', () => {
      const maxActive = manager.getMaxActiveUnits('EAST');

      expect(manager.canSpawnMoreUnits('EAST', 1)).toBe(true);

      manager.setActiveUnits('EAST', maxActive);
      expect(manager.canSpawnMoreUnits('EAST', 1)).toBe(false);
    });
  });

  describe('spawn tracking', () => {
    it('should record spawn time and trigger cooldown', () => {
      expect(manager.isOnCooldown('EAST')).toBe(false);

      manager.recordSpawn('EAST');

      expect(manager.isOnCooldown('EAST')).toBe(true);
    });

    it('should track spawn time correctly', () => {
      const beforeSpawn = Date.now();
      manager.recordSpawn('EAST');
      const afterSpawn = Date.now();

      const timeSinceSpawn = manager.getTimeSinceLastSpawn('EAST');

      expect(timeSinceSpawn).toBeLessThanOrEqual(afterSpawn - beforeSpawn + 100);
      expect(timeSinceSpawn).toBeGreaterThanOrEqual(0);
    });
  });

  describe('strategic objectives', () => {
    it('should add controlled objective with bonus', () => {
      const initialRegen = manager.getTicketRegen('EAST');

      manager.addControlledObjective('EAST', 'airfield_alpha', 2);

      expect(manager.getControlledObjectives('EAST')).toContain('airfield_alpha');
      expect(manager.getTicketRegen('EAST')).toBe(initialRegen + 2);
    });

    it('should not add duplicate objectives', () => {
      manager.addControlledObjective('EAST', 'depot_bravo', 1);
      manager.addControlledObjective('EAST', 'depot_bravo', 1);

      const objectives = manager.getControlledObjectives('EAST');
      const count = objectives.filter(o => o === 'depot_bravo').length;
      expect(count).toBe(1);
    });

    it('should remove controlled objective and bonus', () => {
      manager.addControlledObjective('EAST', 'base_charlie', 3);
      const regenWithBonus = manager.getTicketRegen('EAST');

      manager.removeControlledObjective('EAST', 'base_charlie', 3);

      expect(manager.getControlledObjectives('EAST')).not.toContain('base_charlie');
      expect(manager.getTicketRegen('EAST')).toBe(regenWithBonus - 3);
    });
  });

  describe('reset operations', () => {
    it('should reset single side resources', () => {
      // Modify EAST resources
      manager.spendTickets('EAST', 50);
      manager.deductFromPool('EAST', 'infantry', 10);

      // Reset EAST
      manager.resetSide('EAST');

      const preset = getDefaultPreset();
      expect(manager.getTickets('EAST')).toBe(preset.tickets);
    });

    it('should reset all resources', () => {
      // Modify both sides
      manager.spendTickets('EAST', 30);
      manager.spendTickets('WEST', 40);

      // Reset all
      manager.resetAll();

      const preset = getDefaultPreset();
      expect(manager.getTickets('EAST')).toBe(preset.tickets);
      expect(manager.getTickets('WEST')).toBe(preset.tickets);
    });

    it('should reset pools to max values', () => {
      // Deplete some pool
      manager.deductFromPool('EAST', 'heavyArmor', 5);

      manager.resetPool('EAST', 'heavyArmor');

      expect(manager.getPoolAvailable('EAST', 'heavyArmor')).toBe(manager.getPoolMax('EAST', 'heavyArmor'));
    });
  });

  describe('transaction history', () => {
    it('should record transactions', () => {
      manager.spendTickets('EAST', 10, 'Test transaction');

      const transactions = manager.getRecentTransactions(5);
      expect(transactions.length).toBeGreaterThan(0);

      const lastTransaction = transactions[transactions.length - 1];
      expect(lastTransaction.type).toBe('spend');
      expect(lastTransaction.amount).toBe(10);
    });

    it('should filter transactions by side', () => {
      manager.spendTickets('EAST', 10, 'East spend');
      manager.spendTickets('WEST', 15, 'West spend');

      const eastTransactions = manager.getTransactionsForSide('EAST', 10);
      const westTransactions = manager.getTransactionsForSide('WEST', 10);

      expect(eastTransactions.every(t => t.side === 'EAST')).toBe(true);
      expect(westTransactions.every(t => t.side === 'WEST')).toBe(true);
    });

    it('should clear transaction history', () => {
      manager.spendTickets('EAST', 10);
      expect(manager.getRecentTransactions().length).toBeGreaterThan(0);

      manager.clearTransactionHistory();
      expect(manager.getRecentTransactions()).toHaveLength(0);
    });
  });

  describe('spawn costs and mappings', () => {
    it('should have valid default spawn costs', () => {
      expect(DEFAULT_SPAWN_COSTS.infantry).toBe(1);
      expect(DEFAULT_SPAWN_COSTS.lightVehicle).toBe(5);
      expect(DEFAULT_SPAWN_COSTS.heavyArmor).toBe(15);
      expect(DEFAULT_SPAWN_COSTS.helicopter).toBe(20);
      expect(DEFAULT_SPAWN_COSTS.fixedWing).toBe(30);
    });

    it('should map spawn types to pools correctly', () => {
      expect(SPAWN_TYPE_TO_POOL.infantry).toBe('infantry');
      expect(SPAWN_TYPE_TO_POOL.tank).toBe('heavyArmor');
      expect(SPAWN_TYPE_TO_POOL.attack_heli).toBe('helicopter');
      expect(SPAWN_TYPE_TO_POOL.jet).toBe('fixedWing');
    });

    it('should get spawn cost for known types', () => {
      expect(manager.getSpawnCost('infantry')).toBe(1);
      expect(manager.getSpawnCost('tank')).toBe(20);
    });

    it('should default to infantry cost for unknown types', () => {
      expect(manager.getSpawnCost('unknown_unit')).toBe(1);
    });

    it('should get pool type for spawn type', () => {
      expect(manager.getPoolTypeForSpawn('infantry')).toBe('infantry');
      expect(manager.getPoolTypeForSpawn('apc')).toBe('heavyArmor');
    });

    it('should default to infantry pool for unknown spawn types', () => {
      expect(manager.getPoolTypeForSpawn('unknown_type')).toBe('infantry');
    });
  });
});
