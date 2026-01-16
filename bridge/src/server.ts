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
import { AnthropicClient } from './llm/anthropic';
import { LLMClient } from './llm/client';
import { configManager } from './config/settings';
import { logger, truncateSQF } from './utils/logger';

export class BridgeServer {
  private app: express.Application;
  private httpServer: HTTPServer | null = null;
  private wss: WebSocketServer | null = null;
  private llmClient: LLMClient | null = null;
  private actionQueue: Array<{ sqf: string; metadata: any }> = [];
  private lastActionTime: number = 0;
  private commandIdCounter: number = 0;

  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupLLMClient();
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

    if (!llmConfig.apiKey) {
      logger.warn('LLM client not configured - running in passive mode');
      return;
    }

    if (llmConfig.provider === 'openai') {
      this.llmClient = new OpenAIClient(
        llmConfig.apiKey,
        llmConfig.model,
        llmConfig.maxTokens,
        llmConfig.temperature
      );
      logger.info('OpenAI client initialized', { model: llmConfig.model });
    } else if (llmConfig.provider === 'claude') {
      this.llmClient = new AnthropicClient(
        llmConfig.apiKey,
        llmConfig.model,
        llmConfig.maxTokens,
        llmConfig.temperature
      );
      logger.info('Anthropic (Claude) client initialized', { model: llmConfig.model });
    } else {
      logger.warn(`Unknown LLM provider: ${llmConfig.provider} - running in passive mode`);
    }
  }

  private generateCommandId(): string {
    this.commandIdCounter++;
    return `cmd_${Date.now()}_${this.commandIdCounter}`;
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
            name: gameState.missionName || 'unknown',
            elapsedTime: gameState.missionTime || 0
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
            active: gameState.objectives?.filter((o: any) => o.status === 'active')?.length || 0,
            completed: gameState.objectives?.filter((o: any) => o.status === 'completed')?.length || 0,
            failed: gameState.objectives?.filter((o: any) => o.status === 'failed')?.length || 0
          },
          environment: {
            timeOfDay: gameState.environment?.timeOfDay || 'unknown',
            weather: gameState.environment?.weather || 'unknown'
          },
          recentEvents: gameState.events?.length || 0
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
        this.actionQueue.push({
          sqf,
          metadata: {
            type: 'qrf_spawn',
            commandId,
            position: qrfParams.position,
            side: qrfParams.side,
            unitCount: effectiveUnitCount,
            faction: qrfParams.faction,
            targetPosition: qrfParams.targetPosition,
            timestamp: Date.now()
          }
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
  }

  private async processGameState(gameState: GameState): Promise<void> {
    if (!this.llmClient || !this.llmClient.isConfigured()) {
      logger.debug('LLM client not configured, skipping AI processing');
      return;
    }

    const config = configManager.getConfig();
    const now = Date.now();
    
    // Check if we should take action
    const timeSinceLastAction = (now - this.lastActionTime) / 1000;
    
    if (timeSinceLastAction < config.gm.minActionInterval) {
      logger.debug('Too soon since last action', { timeSinceLastAction });
      return;
    }

    try {
      // Get decision from LLM
      const history = gameStateManager.getHistory();
      const decision = await this.llmClient.getDecision(gameState, history);
      
      logger.info('LLM decision received', {
        action: decision.action,
        reasoning: decision.reasoning
      });

      // If action is 'wait', don't generate SQF
      if (decision.action === 'wait') {
        logger.info('LLM decided to wait');
        return;
      }

      // Extract SQF from decision
      const sqf = decision.parameters.sqf as string;
      
      if (!sqf) {
        logger.warn('No SQF code in decision');
        return;
      }

      // Validate SQF
      const validation = sqfValidator.validate(sqf);
      
      if (!validation.valid) {
        logger.error('Invalid SQF code generated', {
          errors: validation.errors,
          warnings: validation.warnings
        });
        return;
      }

      if (validation.warnings.length > 0) {
        logger.warn('SQF validation warnings', { warnings: validation.warnings });
      }

      // Sanitize and prepare SQF
      const sanitized = sqfSanitizer.sanitize(sqf);
      const withMetadata = sqfSanitizer.addMetadata(sanitized, {
        timestamp: now,
        action: decision.action,
        reasoning: decision.reasoning
      });

      // Check dry run mode
      if (config.safety.dryRunMode) {
        logger.info('DRY RUN - Would execute SQF', { sqf: withMetadata });
        return;
      }

      // Queue action for execution
      this.actionQueue.push({
        sqf: withMetadata,
        metadata: {
          action: decision.action,
          reasoning: decision.reasoning,
          timestamp: now
        }
      });

      this.lastActionTime = now;
      const sqfTruncated = truncateSQF(withMetadata);
      logger.info('Action queued for execution', {
        queueLength: this.actionQueue.length,
        action: decision.action,
        sqf: sqfTruncated,
        sqfLength: withMetadata.length
      });

    } catch (error) {
      logger.error('Error processing game state with LLM', { error });
    }
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
