/**
 * HTTP/WebSocket Server for LLM Game Master Bridge
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import { z } from 'zod';
import { WebSocketServer, WebSocket } from 'ws';
import { Server as HTTPServer } from 'http';
import { GameState, GameEvent } from './game-state/types';
import { gameStateManager } from './game-state/manager';
import { sqfValidator } from './sqf/validator';
import { sqfSanitizer } from './sqf/sanitizer';
import { sqfParser } from './sqf/parser';
import { sqfTemplates, SpawnQRFParams } from './sqf/templates';
import { OpenAIClient } from './llm/openai';
import { configManager } from './config/settings';
import { logger, truncateSQF } from './utils/logger';
import { inidbiWriter, CommandMetadata } from './inidbi-writer';
import {
  resourceManager,
  UnitPoolType,
  SPAWN_TYPE_TO_POOL,
  DEFAULT_SPAWN_COSTS,
  spawnValidator,
  SpawnRequest,
  CommanderResources,
} from './commander/resources';
import {
  buildResourceAwarePrompt,
  buildCommanderSystemPrompt,
  detectSpawn,
  spawnTypeToPoolType,
  getSpawnTicketCost,
  DEFAULT_COMMANDERS,
  CommanderPromptContext,
  DetectedSpawn,
} from './commander';

export class BridgeServer {
  private app: express.Application;
  private httpServer: HTTPServer | null = null;
  private wss: WebSocketServer | null = null;
  private llmClient: OpenAIClient | null = null;
  private actionQueue: Array<{ sqf: string; metadata: any }> = [];
  private lastActionTime: number = 0;
  private commandIdCounter: number = 0;

  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupLLMClient();
    this.initializeResources();
  }

  private initializeResources(): void {
    // ResourceManager singleton is auto-initialized with EAST/WEST resources
    const eastResources = resourceManager.getResources('EAST');
    const westResources = resourceManager.getResources('WEST');

    logger.info('Resource system initialized', {
      eastTickets: eastResources.tickets,
      eastMaxTickets: eastResources.maxTickets,
      westTickets: westResources.tickets,
      westMaxTickets: westResources.maxTickets,
    });
  }

  private setupMiddleware(): void {
    this.app.use(cors({ origin: configManager.get('server').corsOrigins }));
    this.app.use(express.json({ limit: '10mb' }));
    
    // Request logging with encoding/decoding debug info
    this.app.use((req, res, next) => {
      logger.debug(`${req.method} ${req.path}`);
      if (req.body && Object.keys(req.body).length > 0) {
        logger.debug('Request body decoded (JSON)', {
          path: req.path,
          bodySize: JSON.stringify(req.body).length
        });
      }
      next();
    });
  }

  private setupLLMClient(): void {
    const llmConfig = configManager.get('llm');
    
    if (llmConfig.provider === 'openai' && llmConfig.apiKey) {
      this.llmClient = new OpenAIClient(
        llmConfig.apiKey,
        llmConfig.model,
        llmConfig.maxTokens,
        llmConfig.temperature
      );
      logger.info('OpenAI client initialized', { model: llmConfig.model });
    } else {
      logger.warn('LLM client not configured - running in passive mode');
    }
  }

  private generateCommandId(): string {
    this.commandIdCounter++;
    return `cmd_${Date.now()}_${this.commandIdCounter}`;
  }

  /**
   * Write a command to the INIDBI file for game polling
   * This provides an alternative to the extension-based communication
   */
  private async writeToInidbi(sqf: string, metadata: any): Promise<void> {
    const commandMetadata: CommandMetadata = {
      commandId: metadata.commandId || this.generateCommandId(),
      type: metadata.type || 'unknown',
      timestamp: metadata.timestamp || Date.now(),
      ...metadata
    };

    const success = await inidbiWriter.writeCommand(sqf, commandMetadata);
    if (!success) {
      throw new Error('Failed to write command to INIDBI file');
    }
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({ status: 'ok', timestamp: Date.now() });
    });

    // Get status
    this.app.get('/api/status', (req: Request, res: Response) => {
      res.json({
        connected: true,
        llmStatus: this.llmClient?.isConfigured() ? 'ready' : 'not configured',
        queueLength: this.actionQueue.length,
        lastActionTime: this.lastActionTime
      });
    });

    // Get current game state (for AI commander feedback)
    this.app.get('/api/state', (req: Request, res: Response) => {
      const state = gameStateManager.getState();
      if (!state) {
        return res.json({ hasState: false, message: 'No game state received yet' });
      }
      res.json({
        hasState: true,
        timestamp: state.timestamp,
        players: state.players,
        friendlyUnits: state.friendlyUnits?.length || 0,
        enemyUnits: state.enemyUnits?.length || 0,
        objectives: state.objectives,
        environment: state.environment,
        recentEvents: state.recentEvents?.slice(-5) || []
      });
    });

    // Receive game state
    this.app.post('/api/state', async (req: Request, res: Response) => {
      try {
        const gameState: GameState = req.body;
        
        // Validate game state
        if (!gameState.timestamp || !gameState.players) {
          return res.status(400).json({ error: 'Invalid game state' });
        }

        // Update state
        gameStateManager.updateState(gameState);

        // Detailed game state logging
        const playersAlive = gameState.players.filter((p: any) => p.alive !== false).length;
        const playersInVehicles = gameState.players.filter((p: any) => p.vehicle).length;
        const avgHealth = gameState.players.length > 0
          ? gameState.players.reduce((sum: number, p: any) => sum + (p.health ?? 1), 0) / gameState.players.length
          : 0;

        logger.info('Game state received', {
          timestamp: gameState.timestamp,
          mission: {
            name: gameState.missionContext?.missionName || 'unknown',
            elapsedTime: gameState.missionContext?.elapsedTime || 0
          },
          players: {
            total: gameState.players.length,
            alive: playersAlive,
            inVehicles: playersInVehicles,
            avgHealth: Math.round(avgHealth * 100) / 100
          },
          units: {
            friendly: gameState.friendlyUnits?.length || 0,
            enemy: gameState.enemyUnits?.length || 0
          },
          objectives: {
            active: gameState.objectives?.filter((o: any) => o.state === 'active')?.length || 0,
            completed: gameState.objectives?.filter((o: any) => o.state === 'completed')?.length || 0,
            failed: gameState.objectives?.filter((o: any) => o.state === 'failed')?.length || 0
          },
          environment: {
            timeOfDay: gameState.environment?.timeOfDay || 'unknown',
            weather: gameState.environment?.weather || 'unknown'
          },
          recentEvents: gameState.recentEvents?.length || 0
        });

        // Process state asynchronously
        this.processGameState(gameState).catch(err => {
          logger.error('Error processing game state', { error: err });
        });

        res.json({ received: true, queuePosition: this.actionQueue.length });
      } catch (error) {
        logger.error('Error handling state update', { error });
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Get pending action
    this.app.get('/api/action', (req: Request, res: Response) => {
      if (this.actionQueue.length === 0) {
        return res.json({ hasAction: false });
      }

      const action = this.actionQueue.shift();
      const sqfTruncated = action?.sqf ? truncateSQF(action.sqf) : null;

      logger.info('Action sent to game', {
        metadata: action?.metadata,
        sqf: sqfTruncated,
        sqfLength: action?.sqf?.length ?? 0,
        remainingInQueue: this.actionQueue.length
      });

      logger.debug('Response encoding (JSON)', {
        endpoint: '/api/action',
        responseSize: JSON.stringify({ hasAction: true, sqf: action?.sqf, metadata: action?.metadata }).length
      });

      res.json({
        hasAction: true,
        sqf: action?.sqf,
        metadata: action?.metadata
      });
    });

    // Log event
    this.app.post('/api/event', (req: Request, res: Response) => {
      try {
        const event: GameEvent = req.body;
        gameStateManager.addEvent(event);
        logger.info('Event logged', { type: event.type });
        res.json({ logged: true });
      } catch (error) {
        logger.error('Error logging event', { error });
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // POST /api/objectives/status - Receive objective status updates from game
    this.app.post('/api/objectives/status', (req: Request, res: Response) => {
      const { objectiveId, status, progress, data } = req.body;
      
      // Validate required fields (using strict null/undefined checks to allow falsy values like empty strings)
      if (objectiveId == null || status == null) {
        return res.status(400).json({
          error: 'Missing required fields',
          message: 'objectiveId and status are required'
        });
      }
      
      // Validate status is one of: ACTIVE, COMPLETE, FAILED, EXPIRED, PROGRESS
      const validStatuses = ['ACTIVE', 'COMPLETE', 'FAILED', 'EXPIRED', 'PROGRESS'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          error: 'Invalid status',
          message: `status must be one of: ${validStatuses.join(', ')}`
        });
      }
      
      // Log the status update
      logger.info(`Objective ${objectiveId} status: ${status}`, {
        progress,
        data
      });
      
      // TODO: Store/process the objective status update
      // For now, just acknowledge receipt
      
      res.json({
        received: true,
        objectiveId,
        status,
        timestamp: Date.now()
      });
    });

    // Update configuration
    this.app.post('/api/config', (req: Request, res: Response) => {
      try {
        configManager.updateConfig(req.body);
        logger.info('Configuration updated');

        // Re-initialize LLM client if needed
        this.setupLLMClient();

        res.json({ updated: true });
      } catch (error) {
        logger.error('Error updating config', { error });
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Spawn QRF (Quick Reaction Force)
    this.app.post('/api/spawn/qrf', (req: Request, res: Response) => {
      try {
        const { position, side, unitCount, faction, targetPosition } = req.body;

        // Validate required parameters
        if (!position || typeof position.x !== 'number' || typeof position.y !== 'number') {
          return res.status(400).json({ error: 'Missing or invalid position (requires x, y coordinates)' });
        }

        // Validate side parameter
        const validSides = ['EAST', 'WEST', 'INDEPENDENT', 'CIVILIAN'];
        if (!side || !validSides.includes(side)) {
          return res.status(400).json({ error: 'Missing or invalid side (must be EAST, WEST, INDEPENDENT, or CIVILIAN)' });
        }

        // Validate and cap unit count
        const safetyConfig = configManager.get('safety');
        const maxUnits = safetyConfig.maxUnitsPerSpawn;
        let effectiveUnitCount = typeof unitCount === 'number' ? unitCount : 6;
        if (effectiveUnitCount < 1) effectiveUnitCount = 1;
        if (effectiveUnitCount > maxUnits) effectiveUnitCount = maxUnits;

        // Generate command ID
        const commandId = this.generateCommandId();

        // Build QRF spawn parameters
        const qrfParams: SpawnQRFParams = {
          position: {
            x: position.x,
            y: position.y,
            z: typeof position.z === 'number' ? position.z : 0
          },
          side: side as 'EAST' | 'WEST' | 'INDEPENDENT' | 'CIVILIAN',
          unitCount: effectiveUnitCount,
          faction: faction || 'opfor'
        };

        // Add target position if provided
        if (targetPosition && typeof targetPosition.x === 'number' && typeof targetPosition.y === 'number') {
          qrfParams.targetPosition = {
            x: targetPosition.x,
            y: targetPosition.y,
            z: typeof targetPosition.z === 'number' ? targetPosition.z : 0
          };
        }

        // Generate SQF code
        const sqf = sqfTemplates.spawnQRF(qrfParams);

        // Queue the action
        const actionMetadata = {
          type: 'qrf_spawn',
          commandId,
          position: qrfParams.position,
          side: qrfParams.side,
          unitCount: effectiveUnitCount,
          faction: qrfParams.faction,
          targetPosition: qrfParams.targetPosition,
          timestamp: Date.now()
        };

        this.actionQueue.push({
          sqf,
          metadata: actionMetadata
        });

        // Write to INIDBI file for game polling
        this.writeToInidbi(sqf, actionMetadata).catch(err => {
          logger.error('Failed to write command to INIDBI', { error: err, commandId });
        });

        logger.info('QRF spawn queued', {
          commandId,
          side: qrfParams.side,
          unitCount: effectiveUnitCount,
          faction: qrfParams.faction,
          hasTarget: !!qrfParams.targetPosition,
          queueLength: this.actionQueue.length
        });

        res.json({
          queued: true,
          commandId,
          sqf,
          queuePosition: this.actionQueue.length
        });
      } catch (error) {
        logger.error('Error spawning QRF', { error });
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Fire Mission endpoint - Artillery support
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

    this.app.post('/api/fire-mission', (req: Request, res: Response) => {
      try {
        const parseResult = FireMissionRequestSchema.safeParse(req.body);

        if (!parseResult.success) {
          const errors = parseResult.error.errors;
          const warheadError = errors.find(e => e.path.includes('warheadType'));
          if (warheadError) {
            return res.status(400).json({
              error: 'Invalid warhead type',
              validTypes: ['HE', 'Smoke', 'Illum']
            });
          }
          return res.status(400).json({
            error: 'Invalid request parameters',
            details: errors.map(e => e.message)
          });
        }

        const { position, warheadType, rounds } = parseResult.data;
        const ammoClass = AMMO_CLASS_MAP[warheadType];

        // Generate SQF with single quotes per convention
        const sqf = `// Fire Mission - ${warheadType} barrage on target
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

        // Check for magazine capacity warning
        const warning = rounds > 8 ? 'Warning: Rounds exceed typical magazine capacity (8)' : null;

        logger.info('Fire mission generated', {
          warheadType,
          ammoClass,
          rounds,
          position: position.join(',')
        });

        res.json({
          success: true,
          sqf,
          warheadType,
          ammoClass,
          rounds,
          warning
        });
      } catch (error) {
        logger.error('Error generating fire mission', { error });
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Direct command injection endpoint - writes to INIDBI for game polling
    this.app.post('/api/command', async (req: Request, res: Response) => {
      const { sqf } = req.body;
      if (!sqf || typeof sqf !== 'string') {
        return res.status(400).json({ error: 'Missing sqf parameter' });
      }

      const wrappedSqf = `try { ${sqf} } catch { diag_log '[LLMGM] Command error'; };`;
      const commandId = this.generateCommandId();
      const metadata = {
        action: 'direct_command',
        commandId,
        timestamp: Date.now()
      };

      // Add to memory queue
      this.actionQueue.push({ sqf: wrappedSqf, metadata });

      // Write to INIDBI file for game polling
      try {
        await this.writeToInidbi(wrappedSqf, metadata);
        logger.info('Direct command queued and written to INIDBI', { sqfLength: sqf.length, commandId });
      } catch (err) {
        logger.error('Failed to write command to INIDBI', { error: err, commandId });
      }

      res.json({ success: true, queued: true, queuePosition: this.actionQueue.length });
    });

    // ==================== Resource Management Endpoints ====================

    // Get resources for a side
    this.app.get('/api/resources/:side', (req: Request, res: Response) => {
      try {
        const side = req.params.side?.toUpperCase();

        if (side !== 'EAST' && side !== 'WEST') {
          return res.status(400).json({
            error: 'Invalid side parameter',
            validSides: ['EAST', 'WEST']
          });
        }

        const resources = resourceManager.getResources(side);
        const poolStatus = resourceManager.getPoolStatus(side);
        const supportStatus = resourceManager.getSupportAssetStatus(side);

        res.json({
          side,
          tickets: resources.tickets,
          maxTickets: resources.maxTickets,
          ticketRegen: resourceManager.getTicketRegen(side),
          unitPool: poolStatus,
          supportAssets: supportStatus,
          activeUnits: resources.activeUnits,
          maxActiveUnits: resources.maxActiveUnits,
          isOnCooldown: resourceManager.isOnCooldown(side),
          controlledObjectives: resources.controlledObjectives,
          bonusTicketIncome: resources.bonusTicketIncome
        });
      } catch (error) {
        logger.error('Error getting resources', { error });
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Get resources for all sides
    this.app.get('/api/resources', (req: Request, res: Response) => {
      try {
        const allResources = resourceManager.getAllResources();

        res.json({
          EAST: {
            tickets: allResources.EAST.tickets,
            maxTickets: allResources.EAST.maxTickets,
            ticketRegen: resourceManager.getTicketRegen('EAST'),
            poolSummary: resourceManager.getPoolSummary('EAST'),
            supportSummary: resourceManager.getSupportAssetSummary('EAST')
          },
          WEST: {
            tickets: allResources.WEST.tickets,
            maxTickets: allResources.WEST.maxTickets,
            ticketRegen: resourceManager.getTicketRegen('WEST'),
            poolSummary: resourceManager.getPoolSummary('WEST'),
            supportSummary: resourceManager.getSupportAssetSummary('WEST')
          }
        });
      } catch (error) {
        logger.error('Error getting all resources', { error });
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Spend tickets
    this.app.post('/api/resources/spend', (req: Request, res: Response) => {
      try {
        const { side, amount, description } = req.body;

        // Validate side
        const normalizedSide = side?.toUpperCase();
        if (normalizedSide !== 'EAST' && normalizedSide !== 'WEST') {
          return res.status(400).json({
            error: 'Invalid side parameter',
            validSides: ['EAST', 'WEST']
          });
        }

        // Validate amount
        if (typeof amount !== 'number' || amount <= 0) {
          return res.status(400).json({
            error: 'Invalid amount',
            details: 'Amount must be a positive number'
          });
        }

        const result = resourceManager.spendTickets(
          normalizedSide,
          amount,
          description || 'API spend request'
        );

        if (!result.success) {
          return res.status(400).json({
            success: false,
            error: result.error,
            remaining: result.remaining
          });
        }

        logger.info('Tickets spent via API', {
          side: normalizedSide,
          amount,
          remaining: result.remaining
        });

        res.json({
          success: true,
          remaining: result.remaining
        });
      } catch (error) {
        logger.error('Error spending tickets', { error });
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Refund tickets
    this.app.post('/api/resources/refund', (req: Request, res: Response) => {
      try {
        const { side, amount, reason } = req.body;

        // Validate side
        const normalizedSide = side?.toUpperCase();
        if (normalizedSide !== 'EAST' && normalizedSide !== 'WEST') {
          return res.status(400).json({
            error: 'Invalid side parameter',
            validSides: ['EAST', 'WEST']
          });
        }

        // Validate amount
        if (typeof amount !== 'number' || amount <= 0) {
          return res.status(400).json({
            error: 'Invalid amount',
            details: 'Amount must be a positive number'
          });
        }

        const result = resourceManager.refundTickets(
          normalizedSide,
          amount,
          reason || 'API refund request'
        );

        if (!result.success) {
          return res.status(400).json({
            success: false,
            error: result.error,
            newTotal: result.newTotal
          });
        }

        logger.info('Tickets refunded via API', {
          side: normalizedSide,
          amount,
          newTotal: result.newTotal
        });

        res.json({
          success: true,
          newTotal: result.newTotal
        });
      } catch (error) {
        logger.error('Error refunding tickets', { error });
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Validate spawn request
    this.app.post('/api/resources/validate-spawn', (req: Request, res: Response) => {
      try {
        const spawnRequest: SpawnRequest = req.body;

        // Validate side
        const normalizedSide = spawnRequest.side?.toUpperCase();
        if (normalizedSide !== 'EAST' && normalizedSide !== 'WEST') {
          return res.status(400).json({
            error: 'Invalid side parameter',
            validSides: ['EAST', 'WEST']
          });
        }

        const validation = spawnValidator.validateSpawn(resourceManager, {
          ...spawnRequest,
          side: normalizedSide as 'EAST' | 'WEST'
        });

        res.json(validation);
      } catch (error) {
        logger.error('Error validating spawn', { error });
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Reset resources for a side
    this.app.post('/api/resources/reset', (req: Request, res: Response) => {
      try {
        const { side, difficultyLevel } = req.body;

        // Validate side
        const normalizedSide = side?.toUpperCase();
        if (normalizedSide !== 'EAST' && normalizedSide !== 'WEST' && normalizedSide !== 'ALL') {
          return res.status(400).json({
            error: 'Invalid side parameter',
            validSides: ['EAST', 'WEST', 'ALL']
          });
        }

        if (normalizedSide === 'ALL') {
          resourceManager.resetAll(difficultyLevel);
          logger.info('All resources reset via API', { difficultyLevel });
        } else {
          resourceManager.resetSide(normalizedSide, difficultyLevel);
          logger.info('Resources reset via API', { side: normalizedSide, difficultyLevel });
        }

        res.json({
          success: true,
          side: normalizedSide,
          difficultyLevel: difficultyLevel || 'default'
        });
      } catch (error) {
        logger.error('Error resetting resources', { error });
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Get recent transactions
    this.app.get('/api/resources/transactions', (req: Request, res: Response) => {
      try {
        const side = req.query.side?.toString()?.toUpperCase();
        const count = parseInt(req.query.count?.toString() || '20', 10);

        let transactions;
        if (side === 'EAST' || side === 'WEST') {
          transactions = resourceManager.getTransactionsForSide(side, count);
        } else {
          transactions = resourceManager.getRecentTransactions(count);
        }

        res.json({ transactions });
      } catch (error) {
        logger.error('Error getting transactions', { error });
        res.status(500).json({ error: 'Internal server error' });
      }
    });
  }

  /**
   * Process game state for a specific commander side
   * This enables two separate commanders (WEST, EAST) to run independently
   */
  private async processCommanderDecision(
    side: 'WEST' | 'EAST',
    gameState: GameState
  ): Promise<void> {
    if (!this.llmClient || !this.llmClient.isConfigured()) {
      return;
    }

    const config = configManager.getConfig();
    const now = Date.now();

    // Check spawn cooldown for this side
    if (resourceManager.isOnCooldown(side)) {
      logger.debug(`${side} commander on cooldown, skipping`);
      return;
    }

    // Build resource-aware prompt for this commander
    const history = gameStateManager.getHistory();
    const commanderConfig = DEFAULT_COMMANDERS[side];

    const promptContext: CommanderPromptContext = {
      side,
      gameState,
      history,
      config: commanderConfig,
    };

    // Build the system prompt and decision prompt
    const systemPrompt = buildCommanderSystemPrompt(side);
    const decisionPrompt = buildResourceAwarePrompt(promptContext);

    try {
      // Get decision from LLM with resource-aware context
      const decision = await this.llmClient.getDecisionWithPrompt(
        systemPrompt,
        decisionPrompt,
        gameState,
        history
      );

      logger.info(`${side} commander decision received`, {
        action: decision.action,
        reasoning: decision.reasoning
      });

      // If action is 'wait', don't generate SQF
      if (decision.action === 'wait') {
        logger.info(`${side} commander decided to wait`);
        return;
      }

      // Extract SQF from decision
      const sqf = decision.parameters.sqf as string;
      const rawResponse = decision.rawResponse || '';

      if (!sqf) {
        logger.warn(`${side} commander: No SQF code in decision`);
        return;
      }

      // Detect spawn details from SQF and raw response
      const detectedSpawn = detectSpawn(sqf, rawResponse);

      logger.info(`${side} spawn detected`, {
        spawnType: detectedSpawn.spawnType,
        count: detectedSpawn.count,
        confidence: detectedSpawn.confidence,
        classnames: detectedSpawn.classnames.slice(0, 3),
      });

      // If spawn type is unknown and confidence is low, allow but log warning
      if (detectedSpawn.spawnType === 'unknown' && detectedSpawn.confidence < 0.5) {
        logger.warn(`${side}: Low confidence spawn detection, allowing non-spawn action`);
      } else {
        // Validate spawn against resources
        const poolType = spawnTypeToPoolType(detectedSpawn.spawnType);
        const ticketCost = getSpawnTicketCost(detectedSpawn);

        const spawnRequest: SpawnRequest = {
          side,
          spawnType: poolType,
          count: detectedSpawn.count,
        };

        const validation = spawnValidator.validateSpawn(resourceManager, spawnRequest);

        if (!validation.allowed) {
          logger.warn(`${side} spawn REJECTED`, {
            reason: validation.failedChecks.join('; '),
            failedChecks: validation.failedChecks,
            spawnType: detectedSpawn.spawnType,
            ticketCost,
            currentTickets: resourceManager.getTickets(side),
          });

          // Don't execute - resources insufficient
          return;
        }

        // Deduct resources BEFORE queuing
        const spendResult = resourceManager.spendTickets(
          side,
          ticketCost,
          `${detectedSpawn.spawnType} spawn (x${detectedSpawn.count})`
        );

        if (!spendResult.success) {
          logger.error(`${side} failed to spend tickets`, { error: spendResult.error });
          return;
        }

        // Deduct from unit pool
        const poolSuccess = resourceManager.deductFromPool(side, poolType);
        if (!poolSuccess) {
          // Refund tickets if pool deduction failed
          resourceManager.refundTickets(side, ticketCost, 'Pool deduction failed');
          logger.error(`${side} failed to deduct from pool`, { poolType });
          return;
        }

        // Record spawn time (triggers cooldown)
        resourceManager.recordSpawn(side);

        logger.info(`${side} resources deducted`, {
          ticketCost,
          poolType,
          remainingTickets: spendResult.remaining,
          poolRemaining: resourceManager.getResources(side).unitPool[poolType].available,
        });
      }

      // Validate SQF syntax
      const sqfValidation = sqfValidator.validate(sqf);

      if (!sqfValidation.valid) {
        logger.error(`${side}: Invalid SQF code generated`, {
          errors: sqfValidation.errors,
          warnings: sqfValidation.warnings
        });
        return;
      }

      if (sqfValidation.warnings.length > 0) {
        logger.warn(`${side} SQF validation warnings`, { warnings: sqfValidation.warnings });
      }

      // Sanitize and prepare SQF
      const sanitized = sqfSanitizer.sanitize(sqf);
      const withMetadata = sqfSanitizer.addMetadata(sanitized, {
        timestamp: now,
        action: decision.action,
        reasoning: decision.reasoning,
      });

      // Check dry run mode
      if (config.safety.dryRunMode) {
        logger.info(`${side} DRY RUN - Would execute SQF`, { sqf: withMetadata });
        return;
      }

      // Queue action for execution
      const commandId = this.generateCommandId();
      const actionMetadata = {
        commandId,
        type: 'commander_action',
        commander: side,
        action: decision.action,
        reasoning: decision.reasoning,
        spawnType: detectedSpawn.spawnType,
        spawnCount: detectedSpawn.count,
        ticketCost: getSpawnTicketCost(detectedSpawn),
        timestamp: now
      };

      this.actionQueue.push({
        sqf: withMetadata,
        metadata: actionMetadata
      });

      // Write to INIDBI file for game polling
      this.writeToInidbi(withMetadata, actionMetadata).catch(err => {
        logger.error(`Failed to write ${side} command to INIDBI`, { error: err, commandId });
      });

      const sqfTruncated = truncateSQF(withMetadata);
      logger.info(`${side} action queued for execution`, {
        commandId,
        queueLength: this.actionQueue.length,
        action: decision.action,
        sqf: sqfTruncated,
        sqfLength: withMetadata.length
      });

    } catch (error) {
      logger.error(`Error processing ${side} commander decision`, { error });
    }
  }

  private async processGameState(gameState: GameState): Promise<void> {
    if (!this.llmClient || !this.llmClient.isConfigured()) {
      logger.debug('LLM client not configured, skipping AI processing');
      return;
    }

    const config = configManager.getConfig();
    const now = Date.now();

    // Check if we should take action (global rate limit)
    const timeSinceLastAction = (now - this.lastActionTime) / 1000;

    if (timeSinceLastAction < config.gm.minActionInterval) {
      logger.debug('Too soon since last action', { timeSinceLastAction });
      return;
    }

    this.lastActionTime = now;

    // Process both commanders independently
    // Each commander has its own resource pool and cooldowns
    await Promise.all([
      this.processCommanderDecision('WEST', gameState),
      this.processCommanderDecision('EAST', gameState),
    ]);
  }

  private setupWebSocket(): void {
    if (!this.httpServer) return;

    this.wss = new WebSocketServer({ server: this.httpServer });
    
    this.wss.on('connection', (ws: WebSocket) => {
      logger.info('WebSocket client connected');

      ws.on('message', async (message: string) => {
        try {
          const messageStr = message.toString();
          logger.debug('WebSocket message decoded (JSON)', {
            messageSize: messageStr.length
          });
          const data = JSON.parse(messageStr);

          if (data.type === 'state') {
            gameStateManager.updateState(data.payload);
            await this.processGameState(data.payload);
          } else if (data.type === 'event') {
            gameStateManager.addEvent(data.payload);
          }
        } catch (error) {
          logger.error('WebSocket message error', { error });
        }
      });

      ws.on('close', () => {
        logger.info('WebSocket client disconnected');
      });
    });
  }

  start(port?: number, host?: string): void {
    const config = configManager.get('server');
    const serverPort = port || config.port;
    const serverHost = host || config.host;

    this.httpServer = this.app.listen(serverPort, serverHost, () => {
      logger.info(`Bridge server started`, { 
        port: serverPort,
        host: serverHost,
        llm: this.llmClient ? 'enabled' : 'disabled'
      });
    });

    if (config.enableWebSocket) {
      this.setupWebSocket();
      logger.info('WebSocket server enabled');
    }
  }

  stop(): void {
    if (this.wss) {
      this.wss.close();
    }
    if (this.httpServer) {
      this.httpServer.close();
    }
    logger.info('Bridge server stopped');
  }
}
