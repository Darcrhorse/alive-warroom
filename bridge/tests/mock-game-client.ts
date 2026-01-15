/**
 * Mock Arma 3 Game Client for Testing
 *
 * Simulates the game-side communication with the bridge server.
 * Used for testing and debugging the bridge functionality without
 * running the actual Arma 3 game.
 */

import {
  GameState,
  Player,
  Unit,
  Position,
  Environment,
  MissionContext,
  Objective,
  GameEvent
} from '../src/game-state/types';

// Configuration from environment variables
const BRIDGE_URL = process.env.BRIDGE_URL || 'http://localhost:3000';
const UPDATE_INTERVAL = parseInt(process.env.MOCK_CLIENT_INTERVAL || '5000', 10);

/**
 * Mock game client that simulates Arma 3 communication with the bridge
 */
export class MockGameClient {
  private running: boolean = false;
  private intervalHandle: NodeJS.Timeout | null = null;
  private tickCount: number = 0;

  /**
   * Start the mock client
   */
  async start(): Promise<void> {
    this.running = true;
    console.log(`Mock Game Client starting, connecting to ${BRIDGE_URL}`);
    console.log(`Update interval: ${UPDATE_INTERVAL}ms`);

    // Initial tick
    await this.tick();

    // Main loop
    this.intervalHandle = setInterval(async () => {
      await this.tick();
    }, UPDATE_INTERVAL);
  }

  /**
   * Main tick cycle - generate state, send it, poll for actions
   */
  private async tick(): Promise<void> {
    this.tickCount++;

    try {
      // 1. Generate and send game state
      const state = this.generateGameState();
      await this.sendState(state);

      // 2. Poll for actions
      await this.pollActions();
    } catch (error) {
      console.error(`Tick ${this.tickCount} error:`, error instanceof Error ? error.message : error);
    }
  }

  /**
   * Generate a realistic game state with sample data
   */
  generateGameState(): GameState {
    // TODO: Implement in subtask 1-2
    throw new Error('Not implemented');
  }

  /**
   * Send game state to bridge server via POST /api/state
   */
  private async sendState(state: GameState): Promise<void> {
    // TODO: Implement in subtask 1-3
    throw new Error('Not implemented');
  }

  /**
   * Poll for pending actions from bridge via GET /api/action
   */
  private async pollActions(): Promise<void> {
    // TODO: Implement in subtask 1-3
    throw new Error('Not implemented');
  }

  /**
   * Send command execution result via POST /api/result
   */
  private async sendResult(commandId: string, result: unknown, error?: string): Promise<void> {
    // TODO: Implement in subtask 1-3
    throw new Error('Not implemented');
  }

  /**
   * Stop the mock client gracefully
   */
  stop(): void {
    this.running = false;

    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }

    console.log(`Mock Game Client stopped after ${this.tickCount} ticks`);
  }

  /**
   * Check if the client is currently running
   */
  isRunning(): boolean {
    return this.running;
  }
}

// Main entry point - only run when executed directly
if (require.main === module) {
  const client = new MockGameClient();
  client.start().catch((error) => {
    console.error('Failed to start mock client:', error);
    process.exit(1);
  });

  // Graceful shutdown handlers
  process.on('SIGINT', () => {
    console.log('\nReceived SIGINT, shutting down...');
    client.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\nReceived SIGTERM, shutting down...');
    client.stop();
    process.exit(0);
  });
}
