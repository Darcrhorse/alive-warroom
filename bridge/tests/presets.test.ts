/**
 * Tests for Difficulty Presets - AI Commander Resource System
 *
 * Verifies difficulty configurations (Easy/Medium/Hard) and scaling functions
 * for unit pools and support assets.
 */

import {
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
} from '../src/commander/resources/presets';
import { DifficultyPreset } from '../src/commander/resources/types';

describe('Difficulty Presets', () => {
  describe('BASE_RESOURCE_VALUES', () => {
    it('should have valid initial tickets', () => {
      expect(BASE_RESOURCE_VALUES.initialTickets).toBeGreaterThan(0);
      expect(typeof BASE_RESOURCE_VALUES.initialTickets).toBe('number');
    });

    it('should have valid max tickets', () => {
      expect(BASE_RESOURCE_VALUES.maxTickets).toBeGreaterThan(0);
      expect(BASE_RESOURCE_VALUES.maxTickets).toBeGreaterThanOrEqual(BASE_RESOURCE_VALUES.initialTickets);
    });

    it('should have valid ticket regen rate', () => {
      expect(BASE_RESOURCE_VALUES.ticketRegen).toBeGreaterThan(0);
      expect(typeof BASE_RESOURCE_VALUES.ticketRegen).toBe('number');
    });

    it('should have valid max active units', () => {
      expect(BASE_RESOURCE_VALUES.maxActiveUnits).toBeGreaterThan(0);
      expect(typeof BASE_RESOURCE_VALUES.maxActiveUnits).toBe('number');
    });

    it('should have valid spawn cooldown', () => {
      expect(BASE_RESOURCE_VALUES.spawnCooldown).toBeGreaterThan(0);
      expect(typeof BASE_RESOURCE_VALUES.spawnCooldown).toBe('number');
    });
  });

  describe('BASE_UNIT_POOL', () => {
    it('should have infantry pool', () => {
      expect(BASE_UNIT_POOL.infantry).toBeDefined();
      expect(BASE_UNIT_POOL.infantry.available).toBeGreaterThan(0);
      expect(BASE_UNIT_POOL.infantry.max).toBeGreaterThan(0);
      expect(BASE_UNIT_POOL.infantry.available).toBe(BASE_UNIT_POOL.infantry.max);
    });

    it('should have lightVehicle pool', () => {
      expect(BASE_UNIT_POOL.lightVehicle).toBeDefined();
      expect(BASE_UNIT_POOL.lightVehicle.available).toBeGreaterThan(0);
      expect(BASE_UNIT_POOL.lightVehicle.max).toBeGreaterThan(0);
    });

    it('should have heavyArmor pool', () => {
      expect(BASE_UNIT_POOL.heavyArmor).toBeDefined();
      expect(BASE_UNIT_POOL.heavyArmor.available).toBeGreaterThan(0);
      expect(BASE_UNIT_POOL.heavyArmor.max).toBeGreaterThan(0);
    });

    it('should have helicopter pool', () => {
      expect(BASE_UNIT_POOL.helicopter).toBeDefined();
      expect(BASE_UNIT_POOL.helicopter.available).toBeGreaterThan(0);
      expect(BASE_UNIT_POOL.helicopter.max).toBeGreaterThan(0);
    });

    it('should have fixedWing pool', () => {
      expect(BASE_UNIT_POOL.fixedWing).toBeDefined();
      expect(BASE_UNIT_POOL.fixedWing.available).toBeGreaterThan(0);
      expect(BASE_UNIT_POOL.fixedWing.max).toBeGreaterThan(0);
    });

    it('should have all pools with available equal to max', () => {
      expect(BASE_UNIT_POOL.infantry.available).toBe(BASE_UNIT_POOL.infantry.max);
      expect(BASE_UNIT_POOL.lightVehicle.available).toBe(BASE_UNIT_POOL.lightVehicle.max);
      expect(BASE_UNIT_POOL.heavyArmor.available).toBe(BASE_UNIT_POOL.heavyArmor.max);
      expect(BASE_UNIT_POOL.helicopter.available).toBe(BASE_UNIT_POOL.helicopter.max);
      expect(BASE_UNIT_POOL.fixedWing.available).toBe(BASE_UNIT_POOL.fixedWing.max);
    });
  });

  describe('BASE_SUPPORT_ASSETS', () => {
    it('should have artillery strikes', () => {
      expect(BASE_SUPPORT_ASSETS.artilleryStrikes).toBeGreaterThan(0);
      expect(typeof BASE_SUPPORT_ASSETS.artilleryStrikes).toBe('number');
    });

    it('should have CAS sorties', () => {
      expect(BASE_SUPPORT_ASSETS.casSorties).toBeGreaterThan(0);
      expect(typeof BASE_SUPPORT_ASSETS.casSorties).toBe('number');
    });

    it('should have resupply drops', () => {
      expect(BASE_SUPPORT_ASSETS.resupplyDrops).toBeGreaterThan(0);
      expect(typeof BASE_SUPPORT_ASSETS.resupplyDrops).toBe('number');
    });

    it('should have medevac missions', () => {
      expect(BASE_SUPPORT_ASSETS.medevacMissions).toBeGreaterThan(0);
      expect(typeof BASE_SUPPORT_ASSETS.medevacMissions).toBe('number');
    });
  });

  describe('EASY_PRESET', () => {
    it('should have level in easy range (1-3)', () => {
      expect(EASY_PRESET.level).toBeGreaterThanOrEqual(1);
      expect(EASY_PRESET.level).toBeLessThanOrEqual(3);
    });

    it('should have more tickets than medium baseline', () => {
      expect(EASY_PRESET.tickets).toBeGreaterThan(BASE_RESOURCE_VALUES.initialTickets);
    });

    it('should have higher max tickets than medium baseline', () => {
      expect(EASY_PRESET.maxTickets).toBeGreaterThan(BASE_RESOURCE_VALUES.maxTickets);
    });

    it('should have faster ticket regen than medium baseline', () => {
      expect(EASY_PRESET.ticketRegen).toBeGreaterThan(BASE_RESOURCE_VALUES.ticketRegen);
    });

    it('should have unit pool multiplier > 1', () => {
      expect(EASY_PRESET.unitPoolMultiplier).toBeGreaterThan(1);
    });

    it('should have shorter spawn cooldown than medium baseline', () => {
      expect(EASY_PRESET.spawnCooldown).toBeLessThan(BASE_RESOURCE_VALUES.spawnCooldown);
    });

    it('should have more max active units than medium baseline', () => {
      expect(EASY_PRESET.maxActiveUnits).toBeGreaterThan(BASE_RESOURCE_VALUES.maxActiveUnits);
    });

    it('should have all required DifficultyPreset properties', () => {
      expect(EASY_PRESET).toHaveProperty('level');
      expect(EASY_PRESET).toHaveProperty('tickets');
      expect(EASY_PRESET).toHaveProperty('maxTickets');
      expect(EASY_PRESET).toHaveProperty('ticketRegen');
      expect(EASY_PRESET).toHaveProperty('unitPoolMultiplier');
      expect(EASY_PRESET).toHaveProperty('spawnCooldown');
      expect(EASY_PRESET).toHaveProperty('maxActiveUnits');
    });
  });

  describe('MEDIUM_PRESET', () => {
    it('should have level in medium range (4-6)', () => {
      expect(MEDIUM_PRESET.level).toBeGreaterThanOrEqual(4);
      expect(MEDIUM_PRESET.level).toBeLessThanOrEqual(6);
    });

    it('should use base ticket values', () => {
      expect(MEDIUM_PRESET.tickets).toBe(BASE_RESOURCE_VALUES.initialTickets);
      expect(MEDIUM_PRESET.maxTickets).toBe(BASE_RESOURCE_VALUES.maxTickets);
      expect(MEDIUM_PRESET.ticketRegen).toBe(BASE_RESOURCE_VALUES.ticketRegen);
    });

    it('should have unit pool multiplier of 1.0', () => {
      expect(MEDIUM_PRESET.unitPoolMultiplier).toBe(1.0);
    });

    it('should use base spawn cooldown', () => {
      expect(MEDIUM_PRESET.spawnCooldown).toBe(BASE_RESOURCE_VALUES.spawnCooldown);
    });

    it('should use base max active units', () => {
      expect(MEDIUM_PRESET.maxActiveUnits).toBe(BASE_RESOURCE_VALUES.maxActiveUnits);
    });

    it('should have all required DifficultyPreset properties', () => {
      expect(MEDIUM_PRESET).toHaveProperty('level');
      expect(MEDIUM_PRESET).toHaveProperty('tickets');
      expect(MEDIUM_PRESET).toHaveProperty('maxTickets');
      expect(MEDIUM_PRESET).toHaveProperty('ticketRegen');
      expect(MEDIUM_PRESET).toHaveProperty('unitPoolMultiplier');
      expect(MEDIUM_PRESET).toHaveProperty('spawnCooldown');
      expect(MEDIUM_PRESET).toHaveProperty('maxActiveUnits');
    });
  });

  describe('HARD_PRESET', () => {
    it('should have level in hard range (7-10)', () => {
      expect(HARD_PRESET.level).toBeGreaterThanOrEqual(7);
      expect(HARD_PRESET.level).toBeLessThanOrEqual(10);
    });

    it('should have fewer tickets than medium baseline', () => {
      expect(HARD_PRESET.tickets).toBeLessThan(BASE_RESOURCE_VALUES.initialTickets);
    });

    it('should have lower max tickets than medium baseline', () => {
      expect(HARD_PRESET.maxTickets).toBeLessThan(BASE_RESOURCE_VALUES.maxTickets);
    });

    it('should have slower ticket regen than medium baseline', () => {
      expect(HARD_PRESET.ticketRegen).toBeLessThan(BASE_RESOURCE_VALUES.ticketRegen);
    });

    it('should have unit pool multiplier < 1', () => {
      expect(HARD_PRESET.unitPoolMultiplier).toBeLessThan(1);
    });

    it('should have longer spawn cooldown than medium baseline', () => {
      expect(HARD_PRESET.spawnCooldown).toBeGreaterThan(BASE_RESOURCE_VALUES.spawnCooldown);
    });

    it('should have fewer max active units than medium baseline', () => {
      expect(HARD_PRESET.maxActiveUnits).toBeLessThan(BASE_RESOURCE_VALUES.maxActiveUnits);
    });

    it('should have all required DifficultyPreset properties', () => {
      expect(HARD_PRESET).toHaveProperty('level');
      expect(HARD_PRESET).toHaveProperty('tickets');
      expect(HARD_PRESET).toHaveProperty('maxTickets');
      expect(HARD_PRESET).toHaveProperty('ticketRegen');
      expect(HARD_PRESET).toHaveProperty('unitPoolMultiplier');
      expect(HARD_PRESET).toHaveProperty('spawnCooldown');
      expect(HARD_PRESET).toHaveProperty('maxActiveUnits');
    });
  });

  describe('DIFFICULTY_PRESETS collection', () => {
    it('should contain easy preset', () => {
      expect(DIFFICULTY_PRESETS.easy).toBeDefined();
      expect(DIFFICULTY_PRESETS.easy).toBe(EASY_PRESET);
    });

    it('should contain medium preset', () => {
      expect(DIFFICULTY_PRESETS.medium).toBeDefined();
      expect(DIFFICULTY_PRESETS.medium).toBe(MEDIUM_PRESET);
    });

    it('should contain hard preset', () => {
      expect(DIFFICULTY_PRESETS.hard).toBeDefined();
      expect(DIFFICULTY_PRESETS.hard).toBe(HARD_PRESET);
    });

    it('should have exactly 3 presets', () => {
      expect(Object.keys(DIFFICULTY_PRESETS)).toHaveLength(3);
    });
  });

  describe('Preset Relationships', () => {
    it('should have Easy tickets > Medium tickets > Hard tickets', () => {
      expect(EASY_PRESET.tickets).toBeGreaterThan(MEDIUM_PRESET.tickets);
      expect(MEDIUM_PRESET.tickets).toBeGreaterThan(HARD_PRESET.tickets);
    });

    it('should have Easy maxTickets > Medium maxTickets > Hard maxTickets', () => {
      expect(EASY_PRESET.maxTickets).toBeGreaterThan(MEDIUM_PRESET.maxTickets);
      expect(MEDIUM_PRESET.maxTickets).toBeGreaterThan(HARD_PRESET.maxTickets);
    });

    it('should have Easy regen > Medium regen > Hard regen', () => {
      expect(EASY_PRESET.ticketRegen).toBeGreaterThan(MEDIUM_PRESET.ticketRegen);
      expect(MEDIUM_PRESET.ticketRegen).toBeGreaterThan(HARD_PRESET.ticketRegen);
    });

    it('should have Easy multiplier > Medium multiplier > Hard multiplier', () => {
      expect(EASY_PRESET.unitPoolMultiplier).toBeGreaterThan(MEDIUM_PRESET.unitPoolMultiplier);
      expect(MEDIUM_PRESET.unitPoolMultiplier).toBeGreaterThan(HARD_PRESET.unitPoolMultiplier);
    });

    it('should have Easy cooldown < Medium cooldown < Hard cooldown', () => {
      expect(EASY_PRESET.spawnCooldown).toBeLessThan(MEDIUM_PRESET.spawnCooldown);
      expect(MEDIUM_PRESET.spawnCooldown).toBeLessThan(HARD_PRESET.spawnCooldown);
    });

    it('should have Easy maxActive > Medium maxActive > Hard maxActive', () => {
      expect(EASY_PRESET.maxActiveUnits).toBeGreaterThan(MEDIUM_PRESET.maxActiveUnits);
      expect(MEDIUM_PRESET.maxActiveUnits).toBeGreaterThan(HARD_PRESET.maxActiveUnits);
    });
  });

  describe('getPresetByLevel', () => {
    describe('Easy range (1-3)', () => {
      it('should return easy-like preset for level 1', () => {
        const preset = getPresetByLevel(1);
        expect(preset.level).toBe(1);
        expect(preset.tickets).toBe(EASY_PRESET.tickets);
        expect(preset.unitPoolMultiplier).toBe(EASY_PRESET.unitPoolMultiplier);
      });

      it('should return easy-like preset for level 2', () => {
        const preset = getPresetByLevel(2);
        expect(preset.level).toBe(2);
        expect(preset.tickets).toBe(EASY_PRESET.tickets);
      });

      it('should return easy-like preset for level 3', () => {
        const preset = getPresetByLevel(3);
        expect(preset.level).toBe(3);
        expect(preset.tickets).toBe(EASY_PRESET.tickets);
      });
    });

    describe('Medium range (4-6)', () => {
      it('should return medium-like preset for level 4', () => {
        const preset = getPresetByLevel(4);
        expect(preset.level).toBe(4);
        expect(preset.tickets).toBe(MEDIUM_PRESET.tickets);
        expect(preset.unitPoolMultiplier).toBe(MEDIUM_PRESET.unitPoolMultiplier);
      });

      it('should return medium-like preset for level 5', () => {
        const preset = getPresetByLevel(5);
        expect(preset.level).toBe(5);
        expect(preset.tickets).toBe(MEDIUM_PRESET.tickets);
      });

      it('should return medium-like preset for level 6', () => {
        const preset = getPresetByLevel(6);
        expect(preset.level).toBe(6);
        expect(preset.tickets).toBe(MEDIUM_PRESET.tickets);
      });
    });

    describe('Hard range (7-10)', () => {
      it('should return hard-like preset for level 7', () => {
        const preset = getPresetByLevel(7);
        expect(preset.level).toBe(7);
        expect(preset.tickets).toBe(HARD_PRESET.tickets);
        expect(preset.unitPoolMultiplier).toBe(HARD_PRESET.unitPoolMultiplier);
      });

      it('should return hard-like preset for level 8', () => {
        const preset = getPresetByLevel(8);
        expect(preset.level).toBe(8);
        expect(preset.tickets).toBe(HARD_PRESET.tickets);
      });

      it('should return hard-like preset for level 10', () => {
        const preset = getPresetByLevel(10);
        expect(preset.level).toBe(10);
        expect(preset.tickets).toBe(HARD_PRESET.tickets);
      });
    });

    describe('Edge cases and clamping', () => {
      it('should clamp level 0 to 1 (easy)', () => {
        const preset = getPresetByLevel(0);
        expect(preset.level).toBe(1);
        expect(preset.tickets).toBe(EASY_PRESET.tickets);
      });

      it('should clamp negative levels to 1 (easy)', () => {
        const preset = getPresetByLevel(-5);
        expect(preset.level).toBe(1);
        expect(preset.tickets).toBe(EASY_PRESET.tickets);
      });

      it('should clamp level 11+ to 10 (hard)', () => {
        const preset = getPresetByLevel(11);
        expect(preset.level).toBe(10);
        expect(preset.tickets).toBe(HARD_PRESET.tickets);
      });

      it('should clamp very large levels to 10 (hard)', () => {
        const preset = getPresetByLevel(100);
        expect(preset.level).toBe(10);
        expect(preset.tickets).toBe(HARD_PRESET.tickets);
      });

      it('should return new object (not reference to original preset)', () => {
        const preset = getPresetByLevel(5);
        expect(preset).not.toBe(MEDIUM_PRESET);
        expect(preset).toEqual({ ...MEDIUM_PRESET, level: 5 });
      });
    });
  });

  describe('getPresetByName', () => {
    it('should return easy preset for "easy"', () => {
      const preset = getPresetByName('easy');
      expect(preset).toBe(EASY_PRESET);
    });

    it('should return medium preset for "medium"', () => {
      const preset = getPresetByName('medium');
      expect(preset).toBe(MEDIUM_PRESET);
    });

    it('should return hard preset for "hard"', () => {
      const preset = getPresetByName('hard');
      expect(preset).toBe(HARD_PRESET);
    });

    it('should be case-insensitive', () => {
      expect(getPresetByName('EASY')).toBe(EASY_PRESET);
      expect(getPresetByName('Easy')).toBe(EASY_PRESET);
      expect(getPresetByName('MEDIUM')).toBe(MEDIUM_PRESET);
      expect(getPresetByName('Medium')).toBe(MEDIUM_PRESET);
      expect(getPresetByName('HARD')).toBe(HARD_PRESET);
      expect(getPresetByName('Hard')).toBe(HARD_PRESET);
    });

    it('should return medium preset for unknown names', () => {
      expect(getPresetByName('unknown')).toBe(MEDIUM_PRESET);
      expect(getPresetByName('invalid')).toBe(MEDIUM_PRESET);
      expect(getPresetByName('')).toBe(MEDIUM_PRESET);
    });
  });

  describe('getScaledUnitPool', () => {
    it('should scale infantry pool with multiplier', () => {
      const scaledPool = getScaledUnitPool(EASY_PRESET);
      const expectedCount = Math.round(BASE_UNIT_POOL.infantry.max * EASY_PRESET.unitPoolMultiplier);

      expect(scaledPool.infantry.available).toBe(expectedCount);
      expect(scaledPool.infantry.max).toBe(expectedCount);
    });

    it('should scale lightVehicle pool with multiplier', () => {
      const scaledPool = getScaledUnitPool(EASY_PRESET);
      const expectedCount = Math.round(BASE_UNIT_POOL.lightVehicle.max * EASY_PRESET.unitPoolMultiplier);

      expect(scaledPool.lightVehicle.available).toBe(expectedCount);
      expect(scaledPool.lightVehicle.max).toBe(expectedCount);
    });

    it('should scale heavyArmor pool with multiplier', () => {
      const scaledPool = getScaledUnitPool(HARD_PRESET);
      const expectedCount = Math.round(BASE_UNIT_POOL.heavyArmor.max * HARD_PRESET.unitPoolMultiplier);

      expect(scaledPool.heavyArmor.available).toBe(expectedCount);
      expect(scaledPool.heavyArmor.max).toBe(expectedCount);
    });

    it('should scale helicopter pool with multiplier', () => {
      const scaledPool = getScaledUnitPool(MEDIUM_PRESET);
      const expectedCount = Math.round(BASE_UNIT_POOL.helicopter.max * MEDIUM_PRESET.unitPoolMultiplier);

      expect(scaledPool.helicopter.available).toBe(expectedCount);
      expect(scaledPool.helicopter.max).toBe(expectedCount);
    });

    it('should scale fixedWing pool with multiplier', () => {
      const scaledPool = getScaledUnitPool(EASY_PRESET);
      const expectedCount = Math.round(BASE_UNIT_POOL.fixedWing.max * EASY_PRESET.unitPoolMultiplier);

      expect(scaledPool.fixedWing.available).toBe(expectedCount);
      expect(scaledPool.fixedWing.max).toBe(expectedCount);
    });

    it('should produce larger pools for easy than medium', () => {
      const easyPool = getScaledUnitPool(EASY_PRESET);
      const mediumPool = getScaledUnitPool(MEDIUM_PRESET);

      expect(easyPool.infantry.max).toBeGreaterThan(mediumPool.infantry.max);
      expect(easyPool.heavyArmor.max).toBeGreaterThan(mediumPool.heavyArmor.max);
    });

    it('should produce smaller pools for hard than medium', () => {
      const hardPool = getScaledUnitPool(HARD_PRESET);
      const mediumPool = getScaledUnitPool(MEDIUM_PRESET);

      expect(hardPool.infantry.max).toBeLessThan(mediumPool.infantry.max);
      expect(hardPool.heavyArmor.max).toBeLessThan(mediumPool.heavyArmor.max);
    });

    it('should set available equal to max for all pools', () => {
      const scaledPool = getScaledUnitPool(EASY_PRESET);

      expect(scaledPool.infantry.available).toBe(scaledPool.infantry.max);
      expect(scaledPool.lightVehicle.available).toBe(scaledPool.lightVehicle.max);
      expect(scaledPool.heavyArmor.available).toBe(scaledPool.heavyArmor.max);
      expect(scaledPool.helicopter.available).toBe(scaledPool.helicopter.max);
      expect(scaledPool.fixedWing.available).toBe(scaledPool.fixedWing.max);
    });

    it('should handle custom preset with arbitrary multiplier', () => {
      const customPreset: DifficultyPreset = {
        ...MEDIUM_PRESET,
        unitPoolMultiplier: 2.0,
      };

      const scaledPool = getScaledUnitPool(customPreset);
      const expectedInfantry = Math.round(BASE_UNIT_POOL.infantry.max * 2.0);

      expect(scaledPool.infantry.max).toBe(expectedInfantry);
    });
  });

  describe('getScaledSupportAssets', () => {
    it('should scale artillery strikes for easy (1.5x)', () => {
      const scaledAssets = getScaledSupportAssets(EASY_PRESET);
      const expected = Math.round(BASE_SUPPORT_ASSETS.artilleryStrikes * 1.5);

      expect(scaledAssets.artilleryStrikes).toBe(expected);
    });

    it('should scale CAS sorties for easy (1.5x)', () => {
      const scaledAssets = getScaledSupportAssets(EASY_PRESET);
      const expected = Math.round(BASE_SUPPORT_ASSETS.casSorties * 1.5);

      expect(scaledAssets.casSorties).toBe(expected);
    });

    it('should keep base assets for medium (1.0x)', () => {
      const scaledAssets = getScaledSupportAssets(MEDIUM_PRESET);

      expect(scaledAssets.artilleryStrikes).toBe(BASE_SUPPORT_ASSETS.artilleryStrikes);
      expect(scaledAssets.casSorties).toBe(BASE_SUPPORT_ASSETS.casSorties);
      expect(scaledAssets.resupplyDrops).toBe(BASE_SUPPORT_ASSETS.resupplyDrops);
      expect(scaledAssets.medevacMissions).toBe(BASE_SUPPORT_ASSETS.medevacMissions);
    });

    it('should scale assets for hard (0.6x)', () => {
      const scaledAssets = getScaledSupportAssets(HARD_PRESET);

      expect(scaledAssets.artilleryStrikes).toBe(Math.round(BASE_SUPPORT_ASSETS.artilleryStrikes * 0.6));
      expect(scaledAssets.casSorties).toBe(Math.round(BASE_SUPPORT_ASSETS.casSorties * 0.6));
      expect(scaledAssets.resupplyDrops).toBe(Math.round(BASE_SUPPORT_ASSETS.resupplyDrops * 0.6));
      expect(scaledAssets.medevacMissions).toBe(Math.round(BASE_SUPPORT_ASSETS.medevacMissions * 0.6));
    });

    it('should produce more assets for easy than medium', () => {
      const easyAssets = getScaledSupportAssets(EASY_PRESET);
      const mediumAssets = getScaledSupportAssets(MEDIUM_PRESET);

      expect(easyAssets.artilleryStrikes).toBeGreaterThan(mediumAssets.artilleryStrikes);
      expect(easyAssets.casSorties).toBeGreaterThan(mediumAssets.casSorties);
    });

    it('should produce fewer assets for hard than medium', () => {
      const hardAssets = getScaledSupportAssets(HARD_PRESET);
      const mediumAssets = getScaledSupportAssets(MEDIUM_PRESET);

      expect(hardAssets.artilleryStrikes).toBeLessThan(mediumAssets.artilleryStrikes);
      expect(hardAssets.resupplyDrops).toBeLessThan(mediumAssets.resupplyDrops);
    });

    it('should use level-based scaling', () => {
      // Level 2 (easy range) should get 1.5x
      const preset2 = getPresetByLevel(2);
      const assets2 = getScaledSupportAssets(preset2);
      expect(assets2.artilleryStrikes).toBe(Math.round(BASE_SUPPORT_ASSETS.artilleryStrikes * 1.5));

      // Level 5 (medium range) should get 1.0x
      const preset5 = getPresetByLevel(5);
      const assets5 = getScaledSupportAssets(preset5);
      expect(assets5.artilleryStrikes).toBe(BASE_SUPPORT_ASSETS.artilleryStrikes);

      // Level 9 (hard range) should get 0.6x
      const preset9 = getPresetByLevel(9);
      const assets9 = getScaledSupportAssets(preset9);
      expect(assets9.artilleryStrikes).toBe(Math.round(BASE_SUPPORT_ASSETS.artilleryStrikes * 0.6));
    });
  });

  describe('getDefaultDifficultyLevel', () => {
    it('should return a valid level between 1-10', () => {
      const level = getDefaultDifficultyLevel();

      expect(level).toBeGreaterThanOrEqual(1);
      expect(level).toBeLessThanOrEqual(10);
    });

    it('should return a number', () => {
      expect(typeof getDefaultDifficultyLevel()).toBe('number');
    });
  });

  describe('getDefaultPreset', () => {
    it('should return a valid DifficultyPreset', () => {
      const preset = getDefaultPreset();

      expect(preset).toHaveProperty('level');
      expect(preset).toHaveProperty('tickets');
      expect(preset).toHaveProperty('maxTickets');
      expect(preset).toHaveProperty('ticketRegen');
      expect(preset).toHaveProperty('unitPoolMultiplier');
      expect(preset).toHaveProperty('spawnCooldown');
      expect(preset).toHaveProperty('maxActiveUnits');
    });

    it('should have valid values', () => {
      const preset = getDefaultPreset();

      expect(preset.level).toBeGreaterThanOrEqual(1);
      expect(preset.level).toBeLessThanOrEqual(10);
      expect(preset.tickets).toBeGreaterThan(0);
      expect(preset.maxTickets).toBeGreaterThan(0);
      expect(preset.ticketRegen).toBeGreaterThan(0);
      expect(preset.unitPoolMultiplier).toBeGreaterThan(0);
      expect(preset.spawnCooldown).toBeGreaterThan(0);
      expect(preset.maxActiveUnits).toBeGreaterThan(0);
    });

    it('should match getPresetByLevel with default difficulty', () => {
      const defaultLevel = getDefaultDifficultyLevel();
      const presetByLevel = getPresetByLevel(defaultLevel);
      const defaultPreset = getDefaultPreset();

      expect(defaultPreset.level).toBe(presetByLevel.level);
      expect(defaultPreset.tickets).toBe(presetByLevel.tickets);
    });
  });

  describe('Preset Value Constraints', () => {
    const allPresets = [EASY_PRESET, MEDIUM_PRESET, HARD_PRESET];

    it('all presets should have positive tickets', () => {
      allPresets.forEach(preset => {
        expect(preset.tickets).toBeGreaterThan(0);
      });
    });

    it('all presets should have maxTickets >= tickets', () => {
      allPresets.forEach(preset => {
        expect(preset.maxTickets).toBeGreaterThanOrEqual(preset.tickets);
      });
    });

    it('all presets should have positive regen rate', () => {
      allPresets.forEach(preset => {
        expect(preset.ticketRegen).toBeGreaterThan(0);
      });
    });

    it('all presets should have positive unit pool multiplier', () => {
      allPresets.forEach(preset => {
        expect(preset.unitPoolMultiplier).toBeGreaterThan(0);
      });
    });

    it('all presets should have positive spawn cooldown', () => {
      allPresets.forEach(preset => {
        expect(preset.spawnCooldown).toBeGreaterThan(0);
      });
    });

    it('all presets should have positive max active units', () => {
      allPresets.forEach(preset => {
        expect(preset.maxActiveUnits).toBeGreaterThan(0);
      });
    });
  });
});
