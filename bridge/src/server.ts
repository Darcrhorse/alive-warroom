/**
 * HTTP/WebSocket Server for LLM Game Master Bridge
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { Server as HTTPServer } from 'http';
import { GameState, GameEvent } from './game-state/types';
import { gameStateManager } from './game-state/manager';
import { sqfValidator } from './sqf/validator';
import { sqfSanitizer } from './sqf/sanitizer';
import { sqfParser } from './sqf/parser';
import { OpenAIClient } from './llm/openai';
import { configManager } from './config/settings';
import { logger } from './utils/logger';
import {
  resourceManager,
  UnitPoolType,
  SPAWN_TYPE_TO_POOL,
  DEFAULT_SPAWN_COSTS,
} from './commander/resources';

export class BridgeServer {
  private app: express.Application;
  private httpServer: HTTPServer | null = null;
  private wss: WebSocketServer | null = null;
  private llmClient: OpenAIClient | null = null;
  private actionQueue: Array<{ sqf: string; metadata: any }> = [];
  private lastActionTime: number = 0;

  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupLLMClient();
    this.initializeResources();
  }

  private initializeResources(): void {
    // ResourceManager singleton is auto-initialized with EAST/WEST resources
    // Log the initialization status for debugging
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
    
    // Request logging
    this.app.use((req, res, next) => {
      logger.debug(`${req.method} ${req.path}`);
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
        
        logger.info('Game state received', {
          players: gameState.players.length,
          enemies: gameState.enemyUnits.length,
          timestamp: gameState.timestamp
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
      logger.info('Action sent to game', { metadata: action?.metadata });

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
      logger.info('Action queued for execution', { queueLength: this.actionQueue.length });

    } catch (error) {
      logger.error('Error processing game state with LLM', { error });
    }
  }

  /**
   * Process a spawn decision for a specific side using ResourceManager
   *
   * Replaces simple budget variables with comprehensive resource management:
   * - Ticket spending and tracking
   * - Unit pool deduction
   * - Active unit count management
   * - Spawn timing tracking
   *
   * @param side - The side making the spawn decision ('EAST' or 'WEST')
   * @param spawnType - Type of unit to spawn (e.g., 'infantry', 'tank', 'helicopter')
   * @param count - Number of units to spawn (default 1)
   * @param targetObjective - Optional objective ID for strategic assignment
   * @returns Object with success status and details
   */
  processSideDecision(
    side: 'EAST' | 'WEST',
    spawnType: string,
    count: number = 1,
    targetObjective?: string
  ): {
    success: boolean;
    ticketCost: number;
    poolType: UnitPoolType;
    remainingTickets: number;
    remainingPool: number;
    error?: string;
  } {
    // Get spawn cost and pool type using ResourceManager mappings
    const ticketCost = DEFAULT_SPAWN_COSTS[spawnType] ?? DEFAULT_SPAWN_COSTS.infantry;
    const poolType = SPAWN_TYPE_TO_POOL[spawnType] ?? 'infantry';
    const totalCost = ticketCost * count;

    // Get current resource state
    const currentTickets = resourceManager.getTickets(side);
    const currentPool = resourceManager.getPoolAvailable(side, poolType);
    const canSpawnMore = resourceManager.canSpawnMoreUnits(side, count);
    const isOnCooldown = resourceManager.isOnCooldown(side);

    // Check cooldown
    if (isOnCooldown) {
      const cooldownRemaining = resourceManager.getSpawnCooldown(side) -
        resourceManager.getTimeSinceLastSpawn(side);
      logger.warn(`Spawn blocked for ${side}: cooldown active`, {
        spawnType,
        count,
        cooldownRemaining: Math.ceil(cooldownRemaining / 1000),
      });
      return {
        success: false,
        ticketCost: totalCost,
        poolType,
        remainingTickets: currentTickets,
        remainingPool: currentPool,
        error: `Spawn cooldown active: ${Math.ceil(cooldownRemaining / 1000)} seconds remaining`,
      };
    }

    // Check active unit cap
    if (!canSpawnMore) {
      const activeUnits = resourceManager.getActiveUnits(side);
      const maxUnits = resourceManager.getMaxActiveUnits(side);
      logger.warn(`Spawn blocked for ${side}: active unit cap reached`, {
        spawnType,
        count,
        activeUnits,
        maxUnits,
      });
      return {
        success: false,
        ticketCost: totalCost,
        poolType,
        remainingTickets: currentTickets,
        remainingPool: currentPool,
        error: `Active unit cap reached: ${activeUnits}/${maxUnits}`,
      };
    }

    // Check ticket availability
    if (currentTickets < totalCost) {
      logger.warn(`Spawn blocked for ${side}: insufficient tickets`, {
        spawnType,
        count,
        ticketCost: totalCost,
        currentTickets,
      });
      return {
        success: false,
        ticketCost: totalCost,
        poolType,
        remainingTickets: currentTickets,
        remainingPool: currentPool,
        error: `Insufficient tickets: need ${totalCost}, have ${currentTickets}`,
      };
    }

    // Check unit pool availability
    if (currentPool < count) {
      logger.warn(`Spawn blocked for ${side}: unit pool exhausted`, {
        spawnType,
        count,
        poolType,
        currentPool,
      });
      return {
        success: false,
        ticketCost: totalCost,
        poolType,
        remainingTickets: currentTickets,
        remainingPool: currentPool,
        error: `Unit pool exhausted: ${poolType} has ${currentPool}/${count} needed`,
      };
    }

    // All checks passed - execute resource spending

    // Spend tickets
    const spendResult = resourceManager.spendTickets(
      side,
      totalCost,
      `${spawnType} spawn (x${count})`
    );

    if (!spendResult.success) {
      logger.error(`Unexpected ticket spend failure for ${side}`, {
        spawnType,
        count,
        totalCost,
        error: spendResult.error,
      });
      return {
        success: false,
        ticketCost: totalCost,
        poolType,
        remainingTickets: currentTickets,
        remainingPool: currentPool,
        error: spendResult.error,
      };
    }

    // Deduct from unit pool
    const poolDeducted = resourceManager.deductFromPool(side, poolType, count);
    if (!poolDeducted) {
      // This shouldn't happen since we checked above, but handle gracefully
      // Refund the tickets since the spawn failed
      resourceManager.refundTickets(side, totalCost, 'Pool deduction failed - refund');
      logger.error(`Unexpected pool deduction failure for ${side}`, {
        spawnType,
        count,
        poolType,
      });
      return {
        success: false,
        ticketCost: totalCost,
        poolType,
        remainingTickets: resourceManager.getTickets(side),
        remainingPool: resourceManager.getPoolAvailable(side, poolType),
        error: 'Pool deduction failed unexpectedly',
      };
    }

    // Increment active unit count
    resourceManager.incrementActiveUnits(side, count);

    // Record spawn time (resets cooldown)
    resourceManager.recordSpawn(side);

    // Log successful spawn
    const remainingTickets = resourceManager.getTickets(side);
    const remainingPool = resourceManager.getPoolAvailable(side, poolType);

    logger.info(`Spawn processed for ${side}`, {
      spawnType,
      count,
      ticketCost: totalCost,
      poolType,
      remainingTickets,
      remainingPool,
      targetObjective,
    });

    return {
      success: true,
      ticketCost: totalCost,
      poolType,
      remainingTickets,
      remainingPool,
    };
  }

  private setupWebSocket(): void {
    if (!this.httpServer) return;

    this.wss = new WebSocketServer({ server: this.httpServer });
    
    this.wss.on('connection', (ws: WebSocket) => {
      logger.info('WebSocket client connected');

      ws.on('message', async (message: string) => {
        try {
          const data = JSON.parse(message.toString());
          
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
