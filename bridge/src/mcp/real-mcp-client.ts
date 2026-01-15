/**
 * Real MCP Client - Connects to the Arma 3 MCP Server
 * Spawns the Python MCP server and communicates via JSON-RPC over stdio
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger';

interface MCPRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: any;
}

interface MCPResponse {
  jsonrpc: '2.0';
  id: number;
  result?: any;
  error?: {
    code: number;
    message: string;
  };
}

class RealMCPClient extends EventEmitter {
  private process: ChildProcess | null = null;
  private requestId = 0;
  private pendingRequests: Map<number, { resolve: Function; reject: Function }> = new Map();
  private buffer = '';
  private initialized = false;

  async start(): Promise<void> {
    if (this.process) {
      return;
    }

    return new Promise((resolve, reject) => {
      // Spawn the Python MCP server
      this.process = spawn('py', ['F:\\PENTESTING\\arma3-mcp\\server.py'], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      this.process.stdout?.on('data', (data: Buffer) => {
        this.handleData(data.toString());
      });

      this.process.stderr?.on('data', (data: Buffer) => {
        logger.debug('MCP Server stderr', { data: data.toString() });
      });

      this.process.on('error', (err) => {
        logger.error('MCP Server error', { error: err.message });
        reject(err);
      });

      this.process.on('close', (code) => {
        logger.info('MCP Server closed', { code });
        this.process = null;
        this.initialized = false;
      });

      // Give the server time to start
      setTimeout(async () => {
        try {
          // Initialize the MCP connection
          await this.sendRequest('initialize', {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { name: 'llmgm-bridge', version: '1.0.0' }
          });
          this.initialized = true;
          logger.info('MCP Server initialized successfully');
          resolve();
        } catch (err) {
          reject(err);
        }
      }, 1000);
    });
  }

  private handleData(data: string): void {
    this.buffer += data;

    // Try to parse complete JSON messages
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.trim()) {
        try {
          const response: MCPResponse = JSON.parse(line);
          const pending = this.pendingRequests.get(response.id);
          if (pending) {
            this.pendingRequests.delete(response.id);
            if (response.error) {
              pending.reject(new Error(response.error.message));
            } else {
              pending.resolve(response.result);
            }
          }
        } catch (e) {
          // Not valid JSON, might be partial
        }
      }
    }
  }

  private async sendRequest(method: string, params?: any): Promise<any> {
    if (!this.process) {
      throw new Error('MCP Server not started');
    }

    const id = ++this.requestId;
    const request: MCPRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.process!.stdin?.write(JSON.stringify(request) + '\n');

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('MCP request timeout'));
        }
      }, 30000);
    });
  }

  async callTool(name: string, args: Record<string, any>, retries: number = 2): Promise<any> {
    if (!this.initialized) {
      await this.start();
    }

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const result = await this.sendRequest('tools/call', {
          name,
          arguments: args
        });
        return result;
      } catch (error: any) {
        if (error.message === 'MCP request timeout' && attempt < retries) {
          logger.warn(`MCP timeout on ${name}, retrying (${attempt + 1}/${retries})...`);
          // If process seems dead, restart it
          if (!this.process || this.process.exitCode !== null) {
            logger.info('MCP process appears dead, restarting...');
            this.initialized = false;
            await this.start();
          }
          continue;
        }
        throw error;
      }
    }
    throw new Error(`MCP request failed after ${retries} retries`);
  }

  async searchClassname(query: string, options?: {
    category?: string;
    side?: 'WEST' | 'EAST' | 'GUER' | 'CIV';
    faction?: string;
    limit?: number;
  }): Promise<any> {
    return this.callTool('search_classname', {
      query,
      ...options
    });
  }

  async listUnits(options?: {
    side?: 'WEST' | 'EAST' | 'GUER' | 'CIV';
    faction?: string;
    limit?: number;
  }): Promise<any> {
    return this.callTool('list_units', options || {});
  }

  async listVehicles(options?: {
    vehicle_type?: 'ground' | 'air' | 'naval' | 'static';
    side?: 'WEST' | 'EAST' | 'GUER' | 'CIV';
    limit?: number;
  }): Promise<any> {
    return this.callTool('list_vehicles', options || {});
  }

  async listFactions(side?: 'WEST' | 'EAST' | 'GUER' | 'CIV'): Promise<any> {
    return this.callTool('list_factions', side ? { side } : {});
  }

  stop(): void {
    if (this.process) {
      this.process.kill();
      this.process = null;
      this.initialized = false;
    }
  }
}

// Singleton instance
export const realMCPClient = new RealMCPClient();
