/**
 * Tests for Spawn Validator - 5-Check Gate for AI Commander Spawns
 */

import { ResourceManager } from '../src/commander/resources/manager';
import {
  SpawnValidator,
  SpawnRequest,
  DEFAULT_VALIDATION_CONFIG,
  validateSpawn,
  canSpawn,
  getSpawnCost,
  getPoolTypeForSpawn,
} from '../src/commander/resources/validator';

describe('SpawnValidator', () => {
  let manager: ResourceManager;
  let validator: SpawnValidator;

  beforeEach(() => {
    // Create fresh instances for each test
    manager = new ResourceManager();
    validator = new SpawnValidator({
      enforceCooldown: false, // Disable cooldown by default for testing
      enforceObjective: false,
    });
  });

  describe('validateSpawn - 5 Check Gate', () => {
    describe('Check 1: Ticket Availability', () => {
      it('should pass when sufficient tickets available', () => {
        const request: SpawnRequest = {
          side: 'EAST',
          spawnType: 'infantry',
          count: 1,
        };

        const result = validator.validateSpawn(manager, request);

        expect(result.allowed).toBe(true);
        expect(result.failedChecks).toHaveLength(0);
      });

      it('should fail when insufficient tickets', () => {
        // Spend most tickets first
        const tickets = manager.getTickets('EAST');
        manager.spendTickets('EAST', tickets - 1, 'Deplete tickets');

        // Request expensive unit
        const request: SpawnRequest = {
          side: 'EAST',
          spawnType: 'heavyArmor', // Costs 15 tickets
          count: 1,
        };

        const result = validator.validateSpawn(manager, request);

        expect(result.allowed).toBe(false);
        expect(result.failedChecks.some(c => c.includes('Insufficient tickets'))).toBe(true);
      });

      it('should account for count when checking tickets', () => {
        // Spend tickets leaving just 5
        const tickets = manager.getTickets('EAST');
        manager.spendTickets('EAST', tickets - 5, 'Leave 5 tickets');

        // Try spawning 6 infantry (6 tickets needed)
        const request: SpawnRequest = {
          side: 'EAST',
          spawnType: 'infantry', // 1 ticket each
          count: 6,
        };

        const result = validator.validateSpawn(manager, request);

        expect(result.allowed).toBe(false);
        expect(result.failedChecks.some(c => c.includes('Insufficient tickets'))).toBe(true);
      });

      it('should warn when tickets are low', () => {
        // Spend most tickets to trigger warning threshold
        const maxTickets = manager.getMaxTickets('EAST');
        const tickets = manager.getTickets('EAST');
        const toSpend = tickets - Math.floor(maxTickets * 0.1); // Leave ~10%
        manager.spendTickets('EAST', toSpend, 'Lower tickets');

        const request: SpawnRequest = {
          side: 'EAST',
          spawnType: 'infantry',
          count: 1,
        };

        const result = validator.validateSpawn(manager, request);

        expect(result.allowed).toBe(true);
        expect(result.warnings.some(w => w.includes('Low tickets'))).toBe(true);
      });

      it('should support cost override', () => {
        // Leave only 5 tickets
        const tickets = manager.getTickets('EAST');
        manager.spendTickets('EAST', tickets - 5, 'Leave 5 tickets');

        // Use cost override to make heavy armor affordable
        const request: SpawnRequest = {
          side: 'EAST',
          spawnType: 'heavyArmor', // Would cost 15 normally
          count: 1,
          costOverride: 3, // Override to 3 tickets
        };

        const result = validator.validateSpawn(manager, request);

        expect(result.allowed).toBe(true);
        expect(result.ticketCost).toBe(3);
      });
    });

    describe('Check 2: Unit Pool Availability', () => {
      it('should pass when pool has available units', () => {
        const request: SpawnRequest = {
          side: 'EAST',
          spawnType: 'infantry',
          count: 1,
        };

        const result = validator.validateSpawn(manager, request);

        expect(result.allowed).toBe(true);
        expect(result.poolType).toBe('infantry');
      });

      it('should fail when pool is exhausted', () => {
        // Exhaust the fixedWing pool
        const available = manager.getPoolAvailable('EAST', 'fixedWing');
        for (let i = 0; i < available; i++) {
          manager.deductFromPool('EAST', 'fixedWing', 1);
        }

        const request: SpawnRequest = {
          side: 'EAST',
          spawnType: 'fixedWing',
          count: 1,
        };

        const result = validator.validateSpawn(manager, request);

        expect(result.allowed).toBe(false);
        expect(result.failedChecks.some(c => c.includes('pool'))).toBe(true);
      });

      it('should fail when pool has insufficient capacity for count', () => {
        const available = manager.getPoolAvailable('EAST', 'helicopter');

        const request: SpawnRequest = {
          side: 'EAST',
          spawnType: 'helicopter',
          count: available + 5, // More than available
        };

        const result = validator.validateSpawn(manager, request);

        expect(result.allowed).toBe(false);
        expect(result.failedChecks.some(c => c.includes('pool'))).toBe(true);
      });

      it('should warn when pool is getting low', () => {
        // Deplete pool to trigger warning (< 20% remaining)
        const poolMax = manager.getPoolMax('EAST', 'heavyArmor');
        const toDeduct = Math.ceil(poolMax * 0.85); // Leave ~15%
        manager.deductFromPool('EAST', 'heavyArmor', toDeduct);

        const request: SpawnRequest = {
          side: 'EAST',
          spawnType: 'heavyArmor',
          count: 1,
        };

        const result = validator.validateSpawn(manager, request);

        expect(result.allowed).toBe(true);
        expect(result.warnings.some(w => w.includes('pool') && w.includes('remaining'))).toBe(true);
      });

      it('should map spawn types to correct pool', () => {
        const tankRequest: SpawnRequest = {
          side: 'EAST',
          spawnType: 'tank', // Maps to heavyArmor
          count: 1,
        };

        const result = validator.validateSpawn(manager, tankRequest);

        expect(result.poolType).toBe('heavyArmor');
      });
    });

    describe('Check 3: Active Unit Cap', () => {
      it('should pass when under active unit cap', () => {
        const request: SpawnRequest = {
          side: 'EAST',
          spawnType: 'infantry',
          count: 1,
        };

        const result = validator.validateSpawn(manager, request);

        expect(result.allowed).toBe(true);
      });

      it('should fail when at active unit cap', () => {
        // Set active units to max
        const maxActive = manager.getMaxActiveUnits('EAST');
        manager.setActiveUnits('EAST', maxActive);

        const request: SpawnRequest = {
          side: 'EAST',
          spawnType: 'infantry',
          count: 1,
        };

        const result = validator.validateSpawn(manager, request);

        expect(result.allowed).toBe(false);
        expect(result.failedChecks.some(c => c.includes('Active unit cap'))).toBe(true);
      });

      it('should fail when spawn would exceed cap', () => {
        // Set active units close to max
        const maxActive = manager.getMaxActiveUnits('EAST');
        manager.setActiveUnits('EAST', maxActive - 2);

        const request: SpawnRequest = {
          side: 'EAST',
          spawnType: 'infantry',
          count: 5, // Would exceed cap
        };

        const result = validator.validateSpawn(manager, request);

        expect(result.allowed).toBe(false);
        expect(result.failedChecks.some(c => c.includes('Active unit cap'))).toBe(true);
      });

      it('should warn when approaching cap', () => {
        // Set active units to > 80% of max
        const maxActive = manager.getMaxActiveUnits('EAST');
        manager.setActiveUnits('EAST', Math.floor(maxActive * 0.75));

        const request: SpawnRequest = {
          side: 'EAST',
          spawnType: 'infantry',
          count: Math.ceil(maxActive * 0.1), // Push over 80%
        };

        const result = validator.validateSpawn(manager, request);

        expect(result.allowed).toBe(true);
        expect(result.warnings.some(w => w.includes('Approaching active unit cap'))).toBe(true);
      });
    });

    describe('Check 4: Objective Assignment', () => {
      beforeEach(() => {
        // Enable objective enforcement for these tests
        validator.setObjectiveEnforcement(true);
      });

      it('should pass when target objective is controlled', () => {
        manager.addControlledObjective('EAST', 'airfield_alpha', 1);

        const request: SpawnRequest = {
          side: 'EAST',
          spawnType: 'infantry',
          count: 1,
          targetObjective: 'airfield_alpha',
        };

        const result = validator.validateSpawn(manager, request);

        expect(result.allowed).toBe(true);
      });

      it('should fail when no objective and no controlled objectives', () => {
        // No objectives controlled

        const request: SpawnRequest = {
          side: 'EAST',
          spawnType: 'infantry',
          count: 1,
          // No targetObjective
        };

        const result = validator.validateSpawn(manager, request);

        expect(result.allowed).toBe(false);
        expect(result.failedChecks.some(c => c.includes('No target objective'))).toBe(true);
      });

      it('should warn when targeting uncontrolled objective', () => {
        manager.addControlledObjective('EAST', 'airfield_alpha', 1);

        const request: SpawnRequest = {
          side: 'EAST',
          spawnType: 'infantry',
          count: 1,
          targetObjective: 'depot_bravo', // Not controlled
        };

        const result = validator.validateSpawn(manager, request);

        expect(result.allowed).toBe(true);
        expect(result.warnings.some(w => w.includes('not controlled'))).toBe(true);
      });

      it('should skip check when enforcement is disabled', () => {
        validator.setObjectiveEnforcement(false);

        const request: SpawnRequest = {
          side: 'EAST',
          spawnType: 'infantry',
          count: 1,
          // No objective
        };

        const result = validator.validateSpawn(manager, request);

        expect(result.allowed).toBe(true);
        expect(result.failedChecks.some(c => c.includes('objective'))).toBe(false);
      });
    });

    describe('Check 5: Spawn Cooldown', () => {
      beforeEach(() => {
        // Enable cooldown enforcement for these tests
        validator.setCooldownEnforcement(true);
      });

      it('should pass when no previous spawn', () => {
        const request: SpawnRequest = {
          side: 'EAST',
          spawnType: 'infantry',
          count: 1,
        };

        const result = validator.validateSpawn(manager, request);

        expect(result.allowed).toBe(true);
      });

      it('should fail when on cooldown', () => {
        // Record a spawn to start cooldown
        manager.recordSpawn('EAST');

        const request: SpawnRequest = {
          side: 'EAST',
          spawnType: 'infantry',
          count: 1,
        };

        const result = validator.validateSpawn(manager, request);

        expect(result.allowed).toBe(false);
        expect(result.failedChecks.some(c => c.includes('cooldown'))).toBe(true);
      });

      it('should skip check when enforcement is disabled', () => {
        validator.setCooldownEnforcement(false);
        manager.recordSpawn('EAST'); // Start cooldown

        const request: SpawnRequest = {
          side: 'EAST',
          spawnType: 'infantry',
          count: 1,
        };

        const result = validator.validateSpawn(manager, request);

        expect(result.allowed).toBe(true);
      });
    });
  });

  describe('validateSpawn - Multi-Check Failures', () => {
    it('should report all failed checks', () => {
      // Enable all checks
      validator.setConfig({
        enforceCooldown: true,
        enforceObjective: true,
      });

      // Set up multiple failures:
      // 1. Deplete tickets
      const tickets = manager.getTickets('EAST');
      manager.spendTickets('EAST', tickets, 'Deplete all');
      // 2. Max out active units
      manager.setActiveUnits('EAST', manager.getMaxActiveUnits('EAST'));
      // 3. Start cooldown
      manager.recordSpawn('EAST');

      const request: SpawnRequest = {
        side: 'EAST',
        spawnType: 'infantry',
        count: 1,
      };

      const result = validator.validateSpawn(manager, request);

      expect(result.allowed).toBe(false);
      expect(result.failedChecks.length).toBeGreaterThan(1);
    });
  });

  describe('SpawnValidator configuration', () => {
    it('should use default config values', () => {
      const defaultValidator = new SpawnValidator();
      const config = defaultValidator.getConfig();

      expect(config.enforceCooldown).toBe(DEFAULT_VALIDATION_CONFIG.enforceCooldown);
      expect(config.enforceObjective).toBe(DEFAULT_VALIDATION_CONFIG.enforceObjective);
      expect(config.poolWarningThreshold).toBe(DEFAULT_VALIDATION_CONFIG.poolWarningThreshold);
      expect(config.ticketWarningThreshold).toBe(DEFAULT_VALIDATION_CONFIG.ticketWarningThreshold);
    });

    it('should allow partial config override', () => {
      const customValidator = new SpawnValidator({
        enforceCooldown: false,
      });
      const config = customValidator.getConfig();

      expect(config.enforceCooldown).toBe(false);
      expect(config.enforceObjective).toBe(DEFAULT_VALIDATION_CONFIG.enforceObjective);
    });

    it('should update config via setConfig', () => {
      validator.setConfig({
        poolWarningThreshold: 0.3,
        ticketWarningThreshold: 0.4,
      });

      const config = validator.getConfig();

      expect(config.poolWarningThreshold).toBe(0.3);
      expect(config.ticketWarningThreshold).toBe(0.4);
    });
  });

  describe('Convenience Functions', () => {
    it('validateSpawn should work without validator instance', () => {
      const request: SpawnRequest = {
        side: 'EAST',
        spawnType: 'infantry',
        count: 1,
      };

      const result = validateSpawn(manager, request, { enforceCooldown: false });

      expect(result.allowed).toBe(true);
    });

    it('canSpawn should return boolean result', () => {
      expect(canSpawn(manager, 'EAST', 'infantry', 1)).toBe(true);

      // Deplete tickets
      const tickets = manager.getTickets('EAST');
      manager.spendTickets('EAST', tickets, 'Deplete');

      expect(canSpawn(manager, 'EAST', 'heavyArmor', 1)).toBe(false);
    });

    it('getSpawnCost should return correct costs', () => {
      expect(getSpawnCost('infantry')).toBe(1);
      expect(getSpawnCost('heavyArmor')).toBe(15);
      expect(getSpawnCost('helicopter')).toBe(20);
      expect(getSpawnCost('fixedWing')).toBe(30);
    });

    it('getSpawnCost should default to infantry for unknown types', () => {
      expect(getSpawnCost('unknown_type')).toBe(1);
    });

    it('getPoolTypeForSpawn should return correct pool types', () => {
      expect(getPoolTypeForSpawn('infantry')).toBe('infantry');
      expect(getPoolTypeForSpawn('tank')).toBe('heavyArmor');
      expect(getPoolTypeForSpawn('attack_heli')).toBe('helicopter');
      expect(getPoolTypeForSpawn('jet')).toBe('fixedWing');
    });

    it('getPoolTypeForSpawn should default to infantry for unknown types', () => {
      expect(getPoolTypeForSpawn('unknown_type')).toBe('infantry');
    });
  });

  describe('SpawnValidation Result Structure', () => {
    it('should include all required fields in result', () => {
      const request: SpawnRequest = {
        side: 'EAST',
        spawnType: 'infantry',
        count: 1,
      };

      const result = validator.validateSpawn(manager, request);

      expect(result).toHaveProperty('allowed');
      expect(result).toHaveProperty('failedChecks');
      expect(result).toHaveProperty('warnings');
      expect(result).toHaveProperty('ticketCost');
      expect(result).toHaveProperty('poolType');
      expect(Array.isArray(result.failedChecks)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
    });

    it('should calculate correct ticket cost for multiple units', () => {
      const request: SpawnRequest = {
        side: 'EAST',
        spawnType: 'lightVehicle', // 5 tickets each
        count: 3,
      };

      const result = validator.validateSpawn(manager, request);

      expect(result.ticketCost).toBe(15); // 5 * 3
    });
  });
});
