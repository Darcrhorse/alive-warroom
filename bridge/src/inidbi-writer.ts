/**
 * INIDBI2 Writer - Writes commands to INIDBI2 database for game pickup
 *
 * This allows the bridge to queue commands that the game polls via INIDBI2
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as ini from 'ini';
import { logger } from './utils/logger';

// Default INIDBI2 path - Documents\Arma 3 (NOT AppData\Local\Arma 3\db)
const DEFAULT_DB_PATH = path.join(
  os.homedir(),
  'Documents',
  'Arma 3',
  'claude_warroom.ini'
);

export class InidbiWriter {
  private dbPath: string;

  constructor(dbPath?: string) {
    this.dbPath = dbPath || DEFAULT_DB_PATH;
    this.ensureDbExists();
  }

  private ensureDbExists(): void {
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(this.dbPath)) {
      fs.writeFileSync(this.dbPath, '');
    }
  }

  private readIni(): Record<string, Record<string, string>> {
    try {
      const content = fs.readFileSync(this.dbPath, 'utf-8');
      return ini.parse(content);
    } catch (e) {
      return {};
    }
  }

  private writeIni(data: Record<string, Record<string, string>>): void {
    const content = ini.stringify(data);
    fs.writeFileSync(this.dbPath, content);
  }

  /**
   * Write a command for the game to execute
   */
  writeCommand(sqf: string, commandId?: string): void {
    const data = this.readIni();

    if (!data.commands) {
      data.commands = {};
    }

    data.commands.pending = sqf;
    if (commandId) {
      data.commands.pending_command_id = commandId;
    }

    this.writeIni(data);
    logger.info('Command written to INIDBI2', {
      commandId,
      sqfLength: sqf.length,
      dbPath: this.dbPath
    });
  }

  /**
   * Read the last result from the game
   */
  readResult(): { result: string; commandId: string; ready: boolean } | null {
    const data = this.readIni();

    if (!data.commands) {
      return null;
    }

    return {
      result: data.commands.last_result || '',
      commandId: data.commands.current_command_id || '',
      ready: data.commands.result_ready === '1'
    };
  }

  /**
   * Clear the result ready flag
   */
  clearResultReady(): void {
    const data = this.readIni();
    if (data.commands) {
      data.commands.result_ready = '0';
      this.writeIni(data);
    }
  }

  /**
   * Get the database path
   */
  getPath(): string {
    return this.dbPath;
  }
}

// Singleton instance
export const inidbiWriter = new InidbiWriter();
