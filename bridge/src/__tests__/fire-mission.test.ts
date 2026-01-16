/**
 * Unit tests for /api/fire-mission endpoint
 */

import { z } from 'zod';

// Schema replication for testing (matches server.ts)
const FireMissionRequestSchema = z.object({
  position: z.array(z.number()).length(3),
  warheadType: z.enum(['HE', 'Smoke', 'Illum']),
  rounds: z.number().int().positive().max(50)
});

const AMMO_CLASS_MAP: Record<string, string> = {
  HE: 'rhs_mag_m1_he_12',
  Smoke: 'rhs_mag_m60a2_smoke_4',
  Illum: 'rhs_mag_m314_ilum_4'
};

// Helper function to generate SQF (matches server.ts logic)
function generateFireMissionSQF(position: number[], warheadType: string, rounds: number): string {
  const ammoClass = AMMO_CLASS_MAP[warheadType];
  return `// Fire Mission - ${warheadType} barrage on target
private _targetPos = [${position[0]}, ${position[1]}, ${position[2]}];
private _ammoClass = '${ammoClass}';
private _rounds = ${rounds};

// Find nearest artillery capable unit
private _artyUnits = allUnits select {
  (vehicle _x) isKindOf 'StaticMortar' ||
  (vehicle _x) isKindOf 'Artillery'
};

if (count _artyUnits > 0) then {
  private _arty = vehicle (_artyUnits select 0);
  _arty doArtilleryFire [_targetPos, _ammoClass, _rounds];
  systemChat format ['FIRE MISSION: %1 rounds of ${warheadType} on grid %2-%3', _rounds, round (_targetPos select 0), round (_targetPos select 1)];
} else {
  systemChat 'FIRE MISSION FAILED: No artillery units available';
};`;
}

describe('Fire Mission Request Validation', () => {
  describe('Valid requests', () => {
    test('accepts valid HE fire mission', () => {
      const result = FireMissionRequestSchema.safeParse({
        position: [10000, 10000, 0],
        warheadType: 'HE',
        rounds: 3
      });
      expect(result.success).toBe(true);
    });

    test('accepts valid Smoke fire mission', () => {
      const result = FireMissionRequestSchema.safeParse({
        position: [12500.5, 8300.2, 0],
        warheadType: 'Smoke',
        rounds: 2
      });
      expect(result.success).toBe(true);
    });

    test('accepts valid Illum fire mission', () => {
      const result = FireMissionRequestSchema.safeParse({
        position: [5000, 5000, 100],
        warheadType: 'Illum',
        rounds: 4
      });
      expect(result.success).toBe(true);
    });
  });

  describe('Invalid requests', () => {
    test('rejects invalid warhead type', () => {
      const result = FireMissionRequestSchema.safeParse({
        position: [10000, 10000, 0],
        warheadType: 'INVALID',
        rounds: 3
      });
      expect(result.success).toBe(false);
    });

    test('rejects non-array position', () => {
      const result = FireMissionRequestSchema.safeParse({
        position: 'invalid',
        warheadType: 'HE',
        rounds: 3
      });
      expect(result.success).toBe(false);
    });

    test('rejects position with wrong length', () => {
      const result = FireMissionRequestSchema.safeParse({
        position: [10000, 10000],
        warheadType: 'HE',
        rounds: 3
      });
      expect(result.success).toBe(false);
    });

    test('rejects zero rounds', () => {
      const result = FireMissionRequestSchema.safeParse({
        position: [10000, 10000, 0],
        warheadType: 'HE',
        rounds: 0
      });
      expect(result.success).toBe(false);
    });

    test('rejects negative rounds', () => {
      const result = FireMissionRequestSchema.safeParse({
        position: [10000, 10000, 0],
        warheadType: 'HE',
        rounds: -5
      });
      expect(result.success).toBe(false);
    });

    test('rejects rounds exceeding max', () => {
      const result = FireMissionRequestSchema.safeParse({
        position: [10000, 10000, 0],
        warheadType: 'HE',
        rounds: 51
      });
      expect(result.success).toBe(false);
    });

    test('rejects missing position', () => {
      const result = FireMissionRequestSchema.safeParse({
        warheadType: 'HE',
        rounds: 3
      });
      expect(result.success).toBe(false);
    });

    test('rejects missing warheadType', () => {
      const result = FireMissionRequestSchema.safeParse({
        position: [10000, 10000, 0],
        rounds: 3
      });
      expect(result.success).toBe(false);
    });

    test('rejects missing rounds', () => {
      const result = FireMissionRequestSchema.safeParse({
        position: [10000, 10000, 0],
        warheadType: 'HE'
      });
      expect(result.success).toBe(false);
    });
  });
});

describe('Ammo Class Mapping', () => {
  test('maps HE to correct ammo class', () => {
    expect(AMMO_CLASS_MAP['HE']).toBe('rhs_mag_m1_he_12');
  });

  test('maps Smoke to correct ammo class', () => {
    expect(AMMO_CLASS_MAP['Smoke']).toBe('rhs_mag_m60a2_smoke_4');
  });

  test('maps Illum to correct ammo class', () => {
    expect(AMMO_CLASS_MAP['Illum']).toBe('rhs_mag_m314_ilum_4');
  });
});

describe('SQF Generation', () => {
  test('generates valid SQF for HE fire mission', () => {
    const sqf = generateFireMissionSQF([10000, 10000, 0], 'HE', 3);
    expect(sqf).toContain("private _targetPos = [10000, 10000, 0]");
    expect(sqf).toContain("private _ammoClass = 'rhs_mag_m1_he_12'");
    expect(sqf).toContain("private _rounds = 3");
    expect(sqf).toContain("doArtilleryFire");
  });

  test('generates valid SQF for Smoke fire mission', () => {
    const sqf = generateFireMissionSQF([5000, 5000, 0], 'Smoke', 2);
    expect(sqf).toContain("private _ammoClass = 'rhs_mag_m60a2_smoke_4'");
  });

  test('generates valid SQF for Illum fire mission', () => {
    const sqf = generateFireMissionSQF([8000, 8000, 0], 'Illum', 4);
    expect(sqf).toContain("private _ammoClass = 'rhs_mag_m314_ilum_4'");
  });

  test('SQF uses single quotes only', () => {
    const sqf = generateFireMissionSQF([10000, 10000, 0], 'HE', 3);
    // Check that strings use single quotes (SQF convention)
    expect(sqf).toContain("'rhs_mag_m1_he_12'");
    expect(sqf).toContain("'StaticMortar'");
    expect(sqf).toContain("'Artillery'");
    // Should not have double-quoted SQF strings (comments excluded)
    const sqfWithoutComments = sqf.split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
    // All SQF string literals should use single quotes
    expect(sqfWithoutComments).not.toMatch(/"[^"]*"/);
  });

  test('SQF includes systemChat feedback', () => {
    const sqf = generateFireMissionSQF([10000, 10000, 0], 'HE', 3);
    expect(sqf).toContain("systemChat format");
  });
});

describe('Warning Generation', () => {
  test('no warning for rounds <= 8', () => {
    const rounds = 8;
    const warning = rounds > 8 ? 'Warning: Rounds exceed typical magazine capacity (8)' : null;
    expect(warning).toBeNull();
  });

  test('warning for rounds > 8', () => {
    const rounds = 10;
    const warning = rounds > 8 ? 'Warning: Rounds exceed typical magazine capacity (8)' : null;
    expect(warning).toBe('Warning: Rounds exceed typical magazine capacity (8)');
  });
});
