/**
 * Integration tests for Commander System API endpoints
 * Tests the initialization flow: init -> sitrep -> update cycle
 */

import express from 'express';
import request from 'supertest';

// Mock dependencies before importing server
jest.mock('../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

jest.mock('../src/config/settings', () => ({
  configManager: {
    get: jest.fn().mockReturnValue({
      corsOrigins: '*',
      port: 3000,
      host: 'localhost',
      enableWebSocket: false
    }),
    getConfig: jest.fn().mockReturnValue({
      gm: { minActionInterval: 30 },
      safety: { dryRunMode: true }
    }),
    updateConfig: jest.fn()
  }
}));

jest.mock('../src/game-state/manager', () => ({
  gameStateManager: {
    updateState: jest.fn(),
    getState: jest.fn().mockReturnValue({
      timestamp: Date.now(),
      players: [],
      enemyUnits: [],
      friendlyUnits: []
    }),
    addEvent: jest.fn(),
    getHistory: jest.fn().mockReturnValue([])
  }
}));

import { BridgeServer } from '../src/server';

describe('Commander Integration Tests', () => {
  let app: express.Application;
  let server: BridgeServer;

  beforeAll(() => {
    // Create server instance for testing
    server = new BridgeServer();
    // Access the internal express app for testing
    app = (server as any).app;
  });

  afterAll(() => {
    // Cleanup
    server.stop();
  });

  describe('Commander Initialization Flow', () => {
    /**
     * Test 1: POST /api/commander/init with mode=dual returns 200
     */
    describe('POST /api/commander/init', () => {
      it('should initialize dual commander mode with 200 status', async () => {
        const response = await request(app)
          .post('/api/commander/init')
          .send({
            mode: 'dual',
            difficulty: 5,
            map: 'Altis',
            playerSide: 'WEST'
          })
          .expect('Content-Type', /json/)
          .expect(200);

        expect(response.body).toHaveProperty('initialized', true);
        expect(response.body).toHaveProperty('mode', 'dual');
        expect(response.body).toHaveProperty('difficulty', 5);
        expect(response.body).toHaveProperty('map', 'Altis');
        expect(response.body).toHaveProperty('playerSide', 'WEST');
        expect(response.body).toHaveProperty('commanders');
        expect(response.body.commanders.east).not.toBeNull();
        expect(response.body.commanders.west).not.toBeNull();
        expect(response.body.commanders.east.active).toBe(true);
        expect(response.body.commanders.west.active).toBe(true);
      });

      it('should initialize east_only mode correctly', async () => {
        const response = await request(app)
          .post('/api/commander/init')
          .send({
            mode: 'east_only',
            difficulty: 7,
            map: 'Stratis',
            playerSide: 'WEST'
          })
          .expect(200);

        expect(response.body.initialized).toBe(true);
        expect(response.body.mode).toBe('east_only');
        expect(response.body.commanders.east).not.toBeNull();
        expect(response.body.commanders.west).toBeNull();
      });

      it('should initialize west_only mode correctly', async () => {
        const response = await request(app)
          .post('/api/commander/init')
          .send({
            mode: 'west_only',
            difficulty: 3,
            map: 'Tanoa',
            playerSide: 'EAST'
          })
          .expect(200);

        expect(response.body.initialized).toBe(true);
        expect(response.body.mode).toBe('west_only');
        expect(response.body.commanders.east).toBeNull();
        expect(response.body.commanders.west).not.toBeNull();
      });

      it('should initialize interactive mode correctly', async () => {
        const response = await request(app)
          .post('/api/commander/init')
          .send({
            mode: 'interactive',
            difficulty: 5,
            map: 'Altis',
            playerSide: 'WEST'
          })
          .expect(200);

        expect(response.body.initialized).toBe(true);
        expect(response.body.mode).toBe('interactive');
        expect(response.body.commanders.west).not.toBeNull();
      });

      it('should return 400 for missing required fields', async () => {
        const response = await request(app)
          .post('/api/commander/init')
          .send({
            mode: 'dual'
            // Missing: difficulty, map, playerSide
          })
          .expect(400);

        expect(response.body).toHaveProperty('error', 'Missing required fields');
      });

      it('should return 400 for invalid mode', async () => {
        const response = await request(app)
          .post('/api/commander/init')
          .send({
            mode: 'invalid_mode',
            difficulty: 5,
            map: 'Altis',
            playerSide: 'WEST'
          })
          .expect(400);

        expect(response.body).toHaveProperty('error', 'Invalid mode');
      });

      it('should return 400 for invalid difficulty', async () => {
        const response = await request(app)
          .post('/api/commander/init')
          .send({
            mode: 'dual',
            difficulty: 15, // Invalid: must be 1-10
            map: 'Altis',
            playerSide: 'WEST'
          })
          .expect(400);

        expect(response.body).toHaveProperty('error', 'Invalid difficulty');
      });

      it('should return 400 for invalid playerSide', async () => {
        const response = await request(app)
          .post('/api/commander/init')
          .send({
            mode: 'dual',
            difficulty: 5,
            map: 'Altis',
            playerSide: 'INVALID'
          })
          .expect(400);

        expect(response.body).toHaveProperty('error', 'Invalid playerSide');
      });
    });

    /**
     * Test 2: GET /api/commander/sitrep returns both commander states
     */
    describe('GET /api/commander/sitrep', () => {
      beforeEach(async () => {
        // Initialize dual mode before each sitrep test
        await request(app)
          .post('/api/commander/init')
          .send({
            mode: 'dual',
            difficulty: 5,
            map: 'Altis',
            playerSide: 'WEST'
          });
      });

      it('should return both commander states after dual mode init', async () => {
        const response = await request(app)
          .get('/api/commander/sitrep')
          .expect('Content-Type', /json/)
          .expect(200);

        expect(response.body).toHaveProperty('eastState');
        expect(response.body).toHaveProperty('westState');
        expect(response.body).toHaveProperty('battleStatus');
        expect(response.body).toHaveProperty('recommendedActions');

        // Both states should be non-null in dual mode
        expect(response.body.eastState).not.toBeNull();
        expect(response.body.westState).not.toBeNull();

        // Battle status should indicate active battle
        expect(response.body.battleStatus).toBe('battle_in_progress');
      });

      it('should return correct battle status for dual mode', async () => {
        const response = await request(app)
          .get('/api/commander/sitrep')
          .expect(200);

        expect(response.body.battleStatus).toBe('battle_in_progress');
      });

      it('should return recommended actions array', async () => {
        const response = await request(app)
          .get('/api/commander/sitrep')
          .expect(200);

        expect(Array.isArray(response.body.recommendedActions)).toBe(true);
      });

      it('should return commander state properties', async () => {
        const response = await request(app)
          .get('/api/commander/sitrep')
          .expect(200);

        // Check eastState properties
        const eastState = response.body.eastState;
        expect(eastState).toHaveProperty('isActive');
        expect(eastState.isActive).toBe(true);

        // Check westState properties
        const westState = response.body.westState;
        expect(westState).toHaveProperty('isActive');
        expect(westState.isActive).toBe(true);
      });
    });

    /**
     * Test 3: POST /api/commander/update with game state returns decisions
     */
    describe('POST /api/commander/update', () => {
      beforeEach(async () => {
        // Initialize dual mode before each update test
        await request(app)
          .post('/api/commander/init')
          .send({
            mode: 'dual',
            difficulty: 5,
            map: 'Altis',
            playerSide: 'WEST'
          });
      });

      it('should process game state and return decisions', async () => {
        const gameState = {
          timestamp: Date.now(),
          players: [
            {
              uid: 'player1',
              name: 'Alpha-1',
              side: 'WEST',
              position: { x: 1000, y: 2000, z: 0 },
              health: 1.0,
              role: 'rifleman',
              isAlive: true,
              vehicle: null,
              loadout: { primary: 'rifle', secondary: null }
            }
          ],
          enemyUnits: [
            {
              id: 'enemy1',
              side: 'EAST',
              position: { x: 1500, y: 2500, z: 0 },
              type: 'infantry',
              health: 1.0,
              vehicle: null,
              behavior: 'COMBAT'
            }
          ],
          friendlyUnits: [],
          objectives: [],
          weather: { overcast: 0.3, fog: 0, rain: 0, wind: { x: 1, y: 0 } },
          timeOfDay: 12.5
        };

        const response = await request(app)
          .post('/api/commander/update')
          .send(gameState)
          .expect('Content-Type', /json/)
          .expect(200);

        expect(response.body).toHaveProperty('processed', true);
        expect(response.body).toHaveProperty('timestamp');
        expect(response.body).toHaveProperty('mode', 'dual');
        expect(response.body).toHaveProperty('decisions');

        // Both commanders should have decision entries
        expect(response.body.decisions).toHaveProperty('east');
        expect(response.body.decisions).toHaveProperty('west');
      });

      it('should return decision structure with shouldAct flag', async () => {
        const gameState = {
          timestamp: Date.now(),
          players: [],
          enemyUnits: [],
          friendlyUnits: []
        };

        const response = await request(app)
          .post('/api/commander/update')
          .send(gameState)
          .expect(200);

        // Each commander decision should have shouldAct flag
        if (response.body.decisions.east) {
          expect(response.body.decisions.east).toHaveProperty('shouldAct');
          expect(response.body.decisions.east).toHaveProperty('decision');
          expect(response.body.decisions.east).toHaveProperty('state');
        }

        if (response.body.decisions.west) {
          expect(response.body.decisions.west).toHaveProperty('shouldAct');
          expect(response.body.decisions.west).toHaveProperty('decision');
          expect(response.body.decisions.west).toHaveProperty('state');
        }
      });

      it('should return 400 for invalid game state', async () => {
        const response = await request(app)
          .post('/api/commander/update')
          .send({
            // Missing timestamp and players
          })
          .expect(400);

        expect(response.body).toHaveProperty('error', 'Invalid game state');
      });

      it('should return 400 when commander not initialized', async () => {
        // First, re-initialize to reset, then stop commanders
        // Create a fresh server instance for this test
        const freshServer = new BridgeServer();
        const freshApp = (freshServer as any).app;

        const response = await request(freshApp)
          .post('/api/commander/update')
          .send({
            timestamp: Date.now(),
            players: []
          })
          .expect(400);

        expect(response.body).toHaveProperty('error', 'Commander system not initialized');
        freshServer.stop();
      });
    });

    /**
     * Full flow test: init -> sitrep -> update cycle
     */
    describe('Full Initialization Flow', () => {
      it('should complete full init -> sitrep -> update cycle', async () => {
        // Step 1: Initialize dual mode
        const initResponse = await request(app)
          .post('/api/commander/init')
          .send({
            mode: 'dual',
            difficulty: 5,
            map: 'Altis',
            playerSide: 'WEST'
          })
          .expect(200);

        expect(initResponse.body.initialized).toBe(true);
        expect(initResponse.body.commanders.east.active).toBe(true);
        expect(initResponse.body.commanders.west.active).toBe(true);

        // Step 2: Get sitrep
        const sitrepResponse = await request(app)
          .get('/api/commander/sitrep')
          .expect(200);

        expect(sitrepResponse.body.eastState).not.toBeNull();
        expect(sitrepResponse.body.westState).not.toBeNull();
        expect(sitrepResponse.body.battleStatus).toBe('battle_in_progress');

        // Step 3: Update with game state
        const updateResponse = await request(app)
          .post('/api/commander/update')
          .send({
            timestamp: Date.now(),
            players: [
              {
                uid: 'test-player',
                name: 'Test',
                side: 'WEST',
                position: { x: 0, y: 0, z: 0 },
                health: 1.0,
                role: 'rifleman',
                isAlive: true,
                vehicle: null,
                loadout: {}
              }
            ],
            enemyUnits: [],
            friendlyUnits: [],
            objectives: [],
            weather: { overcast: 0, fog: 0, rain: 0, wind: { x: 0, y: 0 } },
            timeOfDay: 12
          })
          .expect(200);

        expect(updateResponse.body.processed).toBe(true);
        expect(updateResponse.body.decisions).toBeDefined();
        expect(updateResponse.body.decisions.east).not.toBeNull();
        expect(updateResponse.body.decisions.west).not.toBeNull();
      });

      it('should handle multiple update cycles', async () => {
        // Initialize
        await request(app)
          .post('/api/commander/init')
          .send({
            mode: 'dual',
            difficulty: 5,
            map: 'Altis',
            playerSide: 'WEST'
          })
          .expect(200);

        // Multiple update cycles
        for (let i = 0; i < 3; i++) {
          const response = await request(app)
            .post('/api/commander/update')
            .send({
              timestamp: Date.now() + i * 1000,
              players: [],
              enemyUnits: [],
              friendlyUnits: []
            })
            .expect(200);

          expect(response.body.processed).toBe(true);
        }
      });
    });
  });

  describe('Commander Chat (Interactive Mode)', () => {
    beforeEach(async () => {
      // Initialize interactive mode
      await request(app)
        .post('/api/commander/init')
        .send({
          mode: 'interactive',
          difficulty: 5,
          map: 'Altis',
          playerSide: 'WEST'
        });
    });

    it('should process chat messages in interactive mode', async () => {
      const response = await request(app)
        .post('/api/commander/chat')
        .send({
          message: 'Request sitrep',
          playerName: 'Alpha-1',
          playerPosition: { x: 1000, y: 2000, z: 0 }
        })
        .expect(200);

      expect(response.body).toHaveProperty('response');
      expect(response.body).toHaveProperty('actions');
      expect(response.body).toHaveProperty('reasoning');
    });

    it('should reject chat in non-interactive mode', async () => {
      // Switch to dual mode
      await request(app)
        .post('/api/commander/init')
        .send({
          mode: 'dual',
          difficulty: 5,
          map: 'Altis',
          playerSide: 'WEST'
        });

      const response = await request(app)
        .post('/api/commander/chat')
        .send({
          message: 'Request CAS',
          playerName: 'Alpha-1',
          playerPosition: { x: 1000, y: 2000, z: 0 }
        })
        .expect(400);

      expect(response.body.error).toContain('interactive mode');
    });
  });
});
