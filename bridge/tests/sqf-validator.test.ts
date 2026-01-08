/**
 * Tests for SQF Validator
 */

import { sqfValidator } from '../src/sqf/validator';

describe('SQFValidator', () => {
  describe('validateSyntax', () => {
    it('should accept valid SQF code', () => {
      const sqf = `
        private _group = createGroup EAST;
        _group createUnit ["O_Soldier_F", [0, 0, 0], [], 0, "FORM"];
      `;
      const result = sqfValidator.validateSyntax(sqf);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject empty code', () => {
      const result = sqfValidator.validateSyntax('');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('SQF code is empty');
    });

    it('should detect unbalanced braces', () => {
      const sqf = 'if (true) then { private _x = 5;';
      const result = sqfValidator.validateSyntax(sqf);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('brace'))).toBe(true);
    });

    it('should detect unbalanced brackets', () => {
      const sqf = 'private _arr = [1, 2, 3;';
      const result = sqfValidator.validateSyntax(sqf);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('bracket'))).toBe(true);
    });
  });

  describe('checkSecurity', () => {
    it('should block endMission', () => {
      const sqf = 'endMission "END1";';
      const result = sqfValidator.checkSecurity(sqf);
      expect(result.safe).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    });

    it('should block failMission', () => {
      const sqf = 'failMission "LOSER";';
      const result = sqfValidator.checkSecurity(sqf);
      expect(result.safe).toBe(false);
    });

    it('should block deleteVehicle player', () => {
      const sqf = 'deleteVehicle player;';
      const result = sqfValidator.checkSecurity(sqf);
      expect(result.safe).toBe(false);
    });

    it('should block serverCommand', () => {
      const sqf = 'serverCommand "#kick player";';
      const result = sqfValidator.checkSecurity(sqf);
      expect(result.safe).toBe(false);
    });

    it('should allow safe spawn commands', () => {
      const sqf = `
        private _group = createGroup EAST;
        _group createUnit ["O_Soldier_F", [100, 200, 0], [], 0, "FORM"];
      `;
      const result = sqfValidator.checkSecurity(sqf);
      expect(result.safe).toBe(true);
      expect(result.violations).toHaveLength(0);
    });
  });

  describe('validate', () => {
    it('should validate both syntax and security', () => {
      const sqf = 'endMission "END1"';
      const result = sqfValidator.validate(sqf);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should pass valid safe code', () => {
      const sqf = 'private _x = 5;';
      const result = sqfValidator.validate(sqf);
      expect(result.valid).toBe(true);
    });
  });

  describe('sanitize', () => {
    it('should remove block comments', () => {
      const sqf = '/* comment */ private _x = 5;';
      const result = sqfValidator.sanitize(sqf);
      expect(result).not.toContain('/*');
      expect(result).not.toContain('*/');
    });

    it('should add semicolon if missing', () => {
      const sqf = 'private _x = 5';
      const result = sqfValidator.sanitize(sqf);
      expect(result.endsWith(';')).toBe(true);
    });
  });
});
