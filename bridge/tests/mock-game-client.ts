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

// Arma 3 realistic data constants
const PLAYER_NAMES = ['Alpha 1-1', 'Alpha 1-2', 'Alpha 1-3', 'Alpha 1-4', 'Bravo 1-1', 'Bravo 1-2'];
const WEAPON_TYPES = ['arifle_MX_F', 'arifle_MX_GL_F', 'arifle_MXC_F', 'arifle_MXM_F', 'LMG_Mk200_F', 'srifle_EBR_F'];
const VEHICLE_TYPES = ['B_MRAP_01_F', 'B_Truck_01_transport_F', 'B_Heli_Light_01_F', 'B_APC_Wheeled_01_cannon_F'];
const FRIENDLY_UNIT_TYPES = ['B_Soldier_F', 'B_Soldier_AR_F', 'B_Soldier_GL_F', 'B_Soldier_M_F', 'B_Soldier_LAT_F', 'B_medic_F'];
const ENEMY_UNIT_TYPES = ['O_Soldier_F', 'O_Soldier_AR_F', 'O_Soldier_GL_F', 'O_Soldier_M_F', 'O_Soldier_LAT_F', 'O_medic_F'];
const BEHAVIORS: Unit['behavior'][] = ['CARELESS', 'SAFE', 'AWARE', 'COMBAT', 'STEALTH'];
const OBJECTIVE_TYPES = ['destroy', 'capture', 'defend', 'rescue', 'recon', 'extract'];
const EVENT_TYPES: GameEvent['type'][] = ['kill', 'objective_complete', 'objective_failed', 'radio_message', 'player_death', 'unit_spotted', 'custom'];

/**
 * Mock game client that simulates Arma 3 communication with the bridge
 */
export class MockGameClient {
  private running: boolean = false;
  private intervalHandle: NodeJS.Timeout | null = null;
  private tickCount: number = 0;
  private missionStartTime: number = Date.now();

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
    const now = Date.now();
    const elapsedSeconds = Math.floor((now - this.missionStartTime) / 1000);

    return {
      timestamp: now,
      players: this.generatePlayers(),
      friendlyUnits: this.generateUnits('BLUFOR', 4 + Math.floor(Math.random() * 4)),
      enemyUnits: this.generateUnits('OPFOR', 6 + Math.floor(Math.random() * 6)),
      objectives: this.generateObjectives(),
      recentEvents: this.generateRecentEvents(),
      environment: this.generateEnvironment(),
      missionContext: this.generateMissionContext(elapsedSeconds)
    };
  }

  /**
   * Generate a random position within typical Arma 3 map coordinates
   */
  private generatePosition(baseX?: number, baseY?: number, spread: number = 500): Position {
    const x = (baseX ?? 5000) + (Math.random() - 0.5) * spread;
    const y = (baseY ?? 5000) + (Math.random() - 0.5) * spread;
    const z = Math.random() * 5; // Slight elevation variation
    return { x, y, z };
  }

  /**
   * Pick a random element from an array
   */
  private randomElement<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
  }

  /**
   * Generate player data
   */
  private generatePlayers(): Player[] {
    const playerCount = 2 + Math.floor(Math.random() * 4); // 2-5 players
    const players: Player[] = [];
    const basePosition = { x: 5000, y: 5000 };

    for (let i = 0; i < playerCount; i++) {
      const inVehicle = Math.random() < 0.2;
      players.push({
        uid: `player_${i + 1}_${Date.now()}`,
        name: PLAYER_NAMES[i] || `Player ${i + 1}`,
        position: this.generatePosition(basePosition.x, basePosition.y, 100),
        health: 0.5 + Math.random() * 0.5, // 0.5-1.0 health
        vehicle: inVehicle ? this.randomElement(VEHICLE_TYPES) : null,
        weapons: [
          this.randomElement(WEAPON_TYPES),
          'hgun_P07_F' // Sidearm
        ],
        currentTask: Math.random() < 0.7 ? 'Moving to objective' : null
      });
    }

    return players;
  }

  /**
   * Generate unit data for friendly or enemy forces
   */
  private generateUnits(side: 'BLUFOR' | 'OPFOR', count: number): Unit[] {
    const units: Unit[] = [];
    const unitTypes = side === 'BLUFOR' ? FRIENDLY_UNIT_TYPES : ENEMY_UNIT_TYPES;
    const baseX = side === 'BLUFOR' ? 5000 : 6000;
    const baseY = side === 'BLUFOR' ? 5000 : 5500;

    for (let i = 0; i < count; i++) {
      const inVehicle = Math.random() < 0.15;
      units.push({
        id: `${side.toLowerCase()}_unit_${i + 1}`,
        type: this.randomElement(unitTypes),
        position: this.generatePosition(baseX, baseY, 300),
        health: 0.3 + Math.random() * 0.7, // 0.3-1.0 health
        vehicle: inVehicle ? this.randomElement(VEHICLE_TYPES) : null,
        behavior: this.randomElement(BEHAVIORS),
        side: side
      });
    }

    return units;
  }

  /**
   * Generate mission objectives
   */
  private generateObjectives(): Objective[] {
    const objectives: Objective[] = [
      {
        id: 'obj_primary_1',
        type: 'destroy',
        description: 'Destroy the enemy communications array',
        position: this.generatePosition(6200, 5800, 50),
        state: 'active',
        assignedTo: ['player_1']
      },
      {
        id: 'obj_secondary_1',
        type: 'rescue',
        description: 'Rescue the captured pilot',
        position: this.generatePosition(6500, 5200, 50),
        state: Math.random() < 0.3 ? 'completed' : 'assigned',
        assignedTo: ['player_1', 'player_2']
      },
      {
        id: 'obj_extract',
        type: 'extract',
        description: 'Extract at designated LZ',
        position: this.generatePosition(4500, 4800, 100),
        state: 'assigned'
      }
    ];

    return objectives;
  }

  /**
   * Generate recent game events
   */
  private generateRecentEvents(): GameEvent[] {
    const now = Date.now();
    const events: GameEvent[] = [];
    const eventCount = Math.floor(Math.random() * 5); // 0-4 events

    for (let i = 0; i < eventCount; i++) {
      const eventType = this.randomElement(EVENT_TYPES);
      const timestamp = now - Math.floor(Math.random() * 60000); // Within last minute

      events.push({
        timestamp,
        type: eventType,
        data: this.generateEventData(eventType)
      });
    }

    // Sort by timestamp descending (most recent first)
    return events.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Generate event-specific data
   */
  private generateEventData(eventType: GameEvent['type']): Record<string, unknown> {
    switch (eventType) {
      case 'kill':
        return {
          killer: 'player_1',
          victim: 'opfor_unit_3',
          weapon: this.randomElement(WEAPON_TYPES),
          distance: Math.floor(50 + Math.random() * 300)
        };
      case 'objective_complete':
        return {
          objectiveId: 'obj_secondary_1',
          completedBy: ['player_1', 'player_2']
        };
      case 'objective_failed':
        return {
          objectiveId: 'obj_secondary_2',
          reason: 'Time limit exceeded'
        };
      case 'radio_message':
        return {
          sender: 'HQ',
          message: 'Be advised, enemy reinforcements spotted moving to your position.',
          frequency: '50.0'
        };
      case 'player_death':
        return {
          player: 'player_3',
          killer: 'opfor_unit_5',
          respawnTime: 30
        };
      case 'unit_spotted':
        return {
          spotter: 'player_1',
          unitType: this.randomElement(ENEMY_UNIT_TYPES),
          position: this.generatePosition(6100, 5400, 100)
        };
      case 'custom':
      default:
        return {
          message: 'Custom event triggered',
          source: 'mission_script'
        };
    }
  }

  /**
   * Generate environment conditions
   */
  private generateEnvironment(): Environment {
    // Simulate time progression based on tick count
    const baseHour = 8; // Start at 0800
    const hoursElapsed = (this.tickCount * UPDATE_INTERVAL) / (1000 * 60 * 20); // 20 min = 1 game hour
    const timeOfDay = (baseHour + hoursElapsed) % 24;

    return {
      timeOfDay: parseFloat(timeOfDay.toFixed(2)),
      weather: parseFloat((Math.random() * 0.4).toFixed(2)), // Light to moderate overcast
      fog: parseFloat((Math.random() * 0.2).toFixed(2)) // Light fog
    };
  }

  /**
   * Generate mission context information
   */
  private generateMissionContext(elapsedTime: number): MissionContext {
    return {
      missionName: 'Operation Watchdog',
      briefing: 'Infiltrate the enemy compound, destroy communications equipment, rescue the downed pilot, and extract to the designated LZ. Expect moderate resistance. ROE: Weapons free on all OPFOR contacts.',
      elapsedTime
    };
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
