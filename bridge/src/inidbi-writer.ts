/**
 * INIDBI2 Command Writer
 *
 * Writes pending commands to an INI file that Arma 3's OO_INIDBI extension can read.
 * This provides an alternative to the custom extension for command delivery.
 *
 * INI Format:
 * [commands]
 * pending=<SQF code>
 *
 * [metadata]
 * id=cmd_1234_1
 * timestamp=1234567890
 * type=qrf_spawn
 */

import * as fs from 'fs';
import * as path from 'path';
import { logger } from './utils/logger';

export interface CommandMetadata {
  commandId: string;
  type: string;
  timestamp: number;
  [key: string]: any;
}

export interface InidbiWriterConfig {
  /** Path to the INI file directory (default: userconfig/claude_warroom) */
  outputDir: string;
  /** INI database name (default: claude_warroom) */
  dbName: string;
  /** Whether to clear commands after writing (for single-command mode) */
  clearOnWrite: boolean;
}

const DEFAULT_CONFIG: InidbiWriterConfig = {
  outputDir: process.env.INIDBI_OUTPUT_DIR || path.join(process.cwd(), 'userconfig', 'claude_warroom'),
  dbName: process.env.INIDBI_DB_NAME || 'claude_warroom',
  clearOnWrite: false
};

/**
 * Escapes a value for INI file format
 * INIDBI2 stores values as-is, but we need to handle special characters
 */
function escapeIniValue(value: string): string {
  // INIDBI2 handles most values directly, but newlines would break the format
  // Replace newlines with escaped versions that SQF can handle
  return value
    .replace(/\r\n/g, '\\n')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\n');
}

/**
 * Generates INI file content from command data
 */
function generateIniContent(sqf: string, metadata: CommandMetadata): string {
  const lines: string[] = [];

  // Commands section
  lines.push('[commands]');
  lines.push(`pending=${escapeIniValue(sqf)}`);
  lines.push('');

  // Metadata section
  lines.push('[metadata]');
  lines.push(`id=${metadata.commandId}`);
  lines.push(`timestamp=${metadata.timestamp}`);
  lines.push(`type=${metadata.type}`);

  // Add any additional metadata
  for (const [key, value] of Object.entries(metadata)) {
    if (!['commandId', 'timestamp', 'type'].includes(key)) {
      const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
      lines.push(`${key}=${escapeIniValue(valueStr)}`);
    }
  }

  lines.push('');

  // Status section for result feedback
  lines.push('[status]');
  lines.push('executed=false');
  lines.push('result=');
  lines.push('error=');
  lines.push('');

  return lines.join('\n');
}

export class InidbiWriter {
  private config: InidbiWriterConfig;
  private iniFilePath: string;
  private initialized: boolean = false;

  constructor(config?: Partial<InidbiWriterConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.iniFilePath = path.join(this.config.outputDir, `${this.config.dbName}.ini`);
  }

  /**
   * Initialize the writer - creates output directory if needed
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Create output directory if it doesn't exist
      if (!fs.existsSync(this.config.outputDir)) {
        fs.mkdirSync(this.config.outputDir, { recursive: true });
        logger.info('Created INIDBI output directory', { path: this.config.outputDir });
      }

      this.initialized = true;
      logger.info('INIDBI writer initialized', {
        outputDir: this.config.outputDir,
        dbName: this.config.dbName,
        iniFilePath: this.iniFilePath
      });
    } catch (error) {
      logger.error('Failed to initialize INIDBI writer', { error });
      throw error;
    }
  }

  /**
   * Write a command to the INI file for game polling
   */
  async writeCommand(sqf: string, metadata: CommandMetadata): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const content = generateIniContent(sqf, metadata);

      fs.writeFileSync(this.iniFilePath, content, { encoding: 'utf-8' });

      logger.info('Command written to INIDBI file', {
        commandId: metadata.commandId,
        type: metadata.type,
        filePath: this.iniFilePath,
        sqfLength: sqf.length
      });

      return true;
    } catch (error) {
      logger.error('Failed to write command to INIDBI file', {
        error,
        commandId: metadata.commandId,
        filePath: this.iniFilePath
      });
      return false;
    }
  }

  /**
   * Clear the pending command (called after game acknowledges execution)
   */
  async clearCommand(): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const clearContent = [
        '[commands]',
        'pending=',
        '',
        '[metadata]',
        'id=',
        'timestamp=',
        'type=',
        '',
        '[status]',
        'executed=false',
        'result=',
        'error=',
        ''
      ].join('\n');

      fs.writeFileSync(this.iniFilePath, clearContent, { encoding: 'utf-8' });

      logger.debug('Cleared INIDBI command file', { filePath: this.iniFilePath });
      return true;
    } catch (error) {
      logger.error('Failed to clear INIDBI command file', { error, filePath: this.iniFilePath });
      return false;
    }
  }

  /**
   * Check if there's a pending command (for debugging)
   */
  hasPendingCommand(): boolean {
    try {
      if (!fs.existsSync(this.iniFilePath)) {
        return false;
      }

      const content = fs.readFileSync(this.iniFilePath, { encoding: 'utf-8' });
      const match = content.match(/^\[commands\]\s*\npending=(.+)/m);
      return match !== null && match[1].trim().length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Read the execution status from the INI file (game writes this back)
   */
  readExecutionStatus(): { executed: boolean; result: string; error: string } | null {
    try {
      if (!fs.existsSync(this.iniFilePath)) {
        return null;
      }

      const content = fs.readFileSync(this.iniFilePath, { encoding: 'utf-8' });

      const executedMatch = content.match(/^\[status\][\s\S]*?executed=(\w+)/m);
      const resultMatch = content.match(/^\[status\][\s\S]*?result=(.*)$/m);
      const errorMatch = content.match(/^\[status\][\s\S]*?error=(.*)$/m);

      return {
        executed: executedMatch ? executedMatch[1] === 'true' : false,
        result: resultMatch ? resultMatch[1] : '',
        error: errorMatch ? errorMatch[1] : ''
      };
    } catch {
      return null;
    }
  }

  /**
   * Get the INI file path (for configuration/debugging)
   */
  getFilePath(): string {
    return this.iniFilePath;
  }

  /**
   * Get the configuration
   */
  getConfig(): InidbiWriterConfig {
    return { ...this.config };
  }
}

// Singleton instance for convenience
export const inidbiWriter = new InidbiWriter();
