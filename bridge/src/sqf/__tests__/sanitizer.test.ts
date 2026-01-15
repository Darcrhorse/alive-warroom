/**
 * Tests for SQF Sanitizer
 */

import { sqfSanitizer, SQFSanitizer } from '../sanitizer';

describe('SQFSanitizer', () => {
  let sanitizer: SQFSanitizer;

  beforeEach(() => {
    sanitizer = new SQFSanitizer();
  });

  describe('convertQuotes', () => {
    describe('basic quote conversion', () => {
      it('should convert double quotes to single quotes', () => {
        const input = '"Hello World"';
        const result = sanitizer.convertQuotes(input);
        expect(result).toBe("'Hello World'");
      });

      it('should convert multiple double-quoted strings', () => {
        const input = 'hint "First"; hint "Second";';
        const result = sanitizer.convertQuotes(input);
        expect(result).toBe("hint 'First'; hint 'Second';");
      });

      it('should preserve code outside quotes', () => {
        const input = 'private _x = "test"; diag_log _x;';
        const result = sanitizer.convertQuotes(input);
        expect(result).toBe("private _x = 'test'; diag_log _x;");
      });
    });

    describe('nested quotes', () => {
      it('should handle single quotes inside double quotes', () => {
        const input = '"It\'s working"';
        const result = sanitizer.convertQuotes(input);
        expect(result).toBe("'It''s working'");
      });

      it('should handle escaped double quotes (doubled)', () => {
        // In SQF, "" inside double quotes is an escaped double quote character
        // "Say ""Hello"" to them" = string containing: Say "Hello" to them
        // When converted, "" becomes '' (escaped single quote in single-quoted string)
        const input = '"Say ""Hello"" to them"';
        const result = sanitizer.convertQuotes(input);
        expect(result).toBe("'Say ''Hello'' to them'");
      });

      it('should handle multiple single quotes inside string', () => {
        const input = '"Don\'t do that, they\'re busy"';
        const result = sanitizer.convertQuotes(input);
        expect(result).toBe("'Don''t do that, they''re busy'");
      });
    });

    describe('format strings', () => {
      it('should handle format string with placeholders', () => {
        const input = 'format ["%1 units spawned", _count]';
        const result = sanitizer.convertQuotes(input);
        expect(result).toBe("format ['%1 units spawned', _count]");
      });

      it('should handle complex format string', () => {
        const input = 'format ["%1: %2 at position %3", _type, _name, _pos]';
        const result = sanitizer.convertQuotes(input);
        expect(result).toBe("format ['%1: %2 at position %3', _type, _name, _pos]");
      });

      it('should handle diag_log format patterns', () => {
        const input = 'diag_log format ["[DEBUG] %1 - Status: %2", _unit, _status];';
        const result = sanitizer.convertQuotes(input);
        expect(result).toBe("diag_log format ['[DEBUG] %1 - Status: %2', _unit, _status];");
      });
    });

    describe('empty strings', () => {
      it('should handle empty double-quoted string', () => {
        const input = '""';
        const result = sanitizer.convertQuotes(input);
        expect(result).toBe("''");
      });

      it('should handle empty string in variable assignment', () => {
        const input = 'private _name = "";';
        const result = sanitizer.convertQuotes(input);
        expect(result).toBe("private _name = '';");
      });

      it('should return empty string when given empty input', () => {
        const result = sanitizer.convertQuotes('');
        expect(result).toBe('');
      });
    });

    describe('edge cases', () => {
      it('should handle string with only spaces', () => {
        const input = '"   "';
        const result = sanitizer.convertQuotes(input);
        expect(result).toBe("'   '");
      });

      it('should handle adjacent strings', () => {
        // In SQF, "a""b" is a single string containing a"b (where "" is escaped quote)
        // When converted: "a""b" -> 'a''b' (where '' is escaped single quote)
        const input = '"a""b"';
        const result = sanitizer.convertQuotes(input);
        expect(result).toBe("'a''b'");
      });
    });
  });

  describe('removeInlineComments', () => {
    describe('comment preservation in strings', () => {
      it('should not remove comments that appear inside strings', () => {
        const input = 'hint "Check // this out";';
        const result = sanitizer.removeInlineComments(input);
        expect(result).toBe('hint "Check // this out";');
      });

      it('should remove comments outside strings', () => {
        const input = 'private _x = 5; // This is a comment';
        const result = sanitizer.removeInlineComments(input);
        expect(result).toBe('private _x = 5; ');
      });

      it('should preserve line structure', () => {
        const input = 'line1;\nline2; // comment\nline3;';
        const result = sanitizer.removeInlineComments(input);
        expect(result).toBe('line1;\nline2; \nline3;');
      });

      it('should handle string followed by comment', () => {
        const input = 'hint "Hello"; // Display greeting';
        const result = sanitizer.removeInlineComments(input);
        expect(result).toBe('hint "Hello"; ');
      });
    });
  });

  describe('sanitizeVariableName', () => {
    it('should keep alphanumeric characters and underscores', () => {
      const result = sanitizer.sanitizeVariableName('_myVariable123');
      expect(result).toBe('_myVariable123');
    });

    it('should remove special characters', () => {
      const result = sanitizer.sanitizeVariableName('my$var!@#');
      expect(result).toBe('myvar');
    });

    it('should remove spaces', () => {
      const result = sanitizer.sanitizeVariableName('my variable');
      expect(result).toBe('myvariable');
    });
  });

  describe('sanitizeString', () => {
    it('should escape double quotes', () => {
      const result = sanitizer.sanitizeString('Say "Hello"');
      expect(result).toBe('Say ""Hello""');
    });

    it('should escape single quotes', () => {
      const result = sanitizer.sanitizeString("It's working");
      expect(result).toBe("It''s working");
    });

    it('should escape both quote types', () => {
      const result = sanitizer.sanitizeString('Say "It\'s fine"');
      expect(result).toBe('Say ""It\'\'s fine""');
    });
  });

  describe('wrapInSafeContext', () => {
    it('should wrap code in try-catch', () => {
      const input = 'private _x = 5;';
      const result = sanitizer.wrapInSafeContext(input);
      expect(result).toContain('try {');
      expect(result).toContain('} catch {');
      expect(result).toContain('private _x = 5;');
    });

    it('should include LLM-Generated Code comment', () => {
      const result = sanitizer.wrapInSafeContext('hint "test";');
      expect(result).toContain('LLM-Generated Code');
    });

    it('should include error logging', () => {
      const result = sanitizer.wrapInSafeContext('hint "test";');
      expect(result).toContain('diag_log');
      expect(result).toContain('[LLMGM]');
    });
  });

  describe('sanitize (full pipeline)', () => {
    it('should apply all sanitization steps', () => {
      const input = 'hint "Hello World";';
      const result = sanitizer.sanitize(input);

      // Should convert quotes
      expect(result).toContain("'Hello World'");
      // Should be wrapped in safe context
      expect(result).toContain('try {');
    });

    it('should handle complex code with comments', () => {
      const input = 'private _x = "test"; // Set variable\nhint _x;';
      const result = sanitizer.sanitize(input);

      // Should convert quotes
      expect(result).toContain("'test'");
      // Should be wrapped
      expect(result).toContain('try {');
    });

    it('should produce output with NO double quotes in SQF strings', () => {
      // This is the critical verification for Pythia transport compatibility
      const input = '_group setBehaviour "AWARE"; format ["%1 spawned", _unit];';
      const result = sanitizer.sanitize(input);

      // Count double-quoted strings (excluding comments which start with //)
      const sqfLines = result.split('\n').filter(line => !line.trim().startsWith('//'));
      const sqfCode = sqfLines.join('\n');
      const doubleQuotes = (sqfCode.match(/"[^"]*"/g) || []).length;

      expect(doubleQuotes).toBe(0);
      expect(result).toContain("'AWARE'");
      expect(result).toContain("'%1 spawned'");
    });

    it('should ensure wrapInSafeContext uses single quotes', () => {
      const input = 'hint "test";';
      const result = sanitizer.sanitize(input);

      // The diag_log in catch block should use single quotes
      expect(result).toContain("diag_log format ['[LLMGM]");
      // Verify no double quotes in the format string
      expect(result).not.toMatch(/diag_log format \[".*?"\]/);
    });
  });

  describe('addMetadata', () => {
    it('should add timestamp and action', () => {
      const sqf = 'hint "test";';
      const result = sanitizer.addMetadata(sqf, {
        timestamp: 1704067200000, // 2024-01-01T00:00:00.000Z
        action: 'spawn_unit'
      });

      expect(result).toContain('Generated by LLM Game Master');
      expect(result).toContain('Action: spawn_unit');
      expect(result).toContain('hint "test";');
    });

    it('should include reasoning when provided', () => {
      const sqf = 'hint "test";';
      const result = sanitizer.addMetadata(sqf, {
        timestamp: Date.now(),
        action: 'spawn_unit',
        reasoning: 'Player requested reinforcements'
      });

      expect(result).toContain('Reasoning: Player requested reinforcements');
    });

    it('should not include reasoning line when not provided', () => {
      const sqf = 'hint "test";';
      const result = sanitizer.addMetadata(sqf, {
        timestamp: Date.now(),
        action: 'spawn_unit'
      });

      expect(result).not.toContain('Reasoning:');
    });
  });

  describe('exported singleton', () => {
    it('should export a singleton instance', () => {
      expect(sqfSanitizer).toBeInstanceOf(SQFSanitizer);
    });

    it('should have all methods available', () => {
      expect(typeof sqfSanitizer.convertQuotes).toBe('function');
      expect(typeof sqfSanitizer.sanitize).toBe('function');
      expect(typeof sqfSanitizer.removeInlineComments).toBe('function');
    });
  });
});
