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
import { CommanderMode } from './game-state/types';
import {
  EastCommander,
  WestCommander,
  createEastCommander,
  createWestCommander
} from './commander';

export class BridgeServer {
  private app: express.Application;
  private httpServer: HTTPServer | null = null;
  private wss: WebSocketServer | null = null;
  private llmClient: OpenAIClient | null = null;
  private actionQueue: Array<{ sqf: string; metadata: any }> = [];
  private lastActionTime: number = 0;

  // Commander system
  private eastCommander: EastCommander | null = null;
  private westCommander: WestCommander | null = null;
  private commanderMode: CommanderMode | null = null;
  private commanderMap: string | null = null;
  private playerSide: 'WEST' | 'EAST' | 'INDEPENDENT' | null = null;

  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupLLMClient();
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

    // Initialize commander system
    this.app.post('/api/commander/init', (req: Request, res: Response) => {
      try {
        const { mode, difficulty, map, playerSide } = req.body;

        // Validate required fields
        if (!mode || difficulty === undefined || !map || !playerSide) {
          return res.status(400).json({
            error: 'Missing required fields',
            required: ['mode', 'difficulty', 'map', 'playerSide']
          });
        }

        // Validate mode
        const validModes: CommanderMode[] = ['dual', 'east_only', 'west_only', 'interactive'];
        if (!validModes.includes(mode)) {
          return res.status(400).json({
            error: 'Invalid mode',
            validModes
          });
        }

        // Validate difficulty
        const difficultyNum = Number(difficulty);
        if (isNaN(difficultyNum) || difficultyNum < 1 || difficultyNum > 10) {
          return res.status(400).json({
            error: 'Invalid difficulty',
            message: 'Difficulty must be a number between 1 and 10'
          });
        }

        // Validate playerSide
        const validSides = ['WEST', 'EAST', 'INDEPENDENT'];
        if (!validSides.includes(playerSide)) {
          return res.status(400).json({
            error: 'Invalid playerSide',
            validSides
          });
        }

        // Dispose existing commanders if any
        if (this.eastCommander) {
          this.eastCommander.dispose();
          this.eastCommander = null;
        }
        if (this.westCommander) {
          this.westCommander.dispose();
          this.westCommander = null;
        }

        // Store commander settings
        this.commanderMode = mode as CommanderMode;
        this.commanderMap = map;
        this.playerSide = playerSide as 'WEST' | 'EAST' | 'INDEPENDENT';

        // Initialize commanders based on mode
        switch (mode) {
          case 'dual':
            // Both commanders active
            this.eastCommander = createEastCommander(mode, difficultyNum);
            this.westCommander = createWestCommander(mode, difficultyNum);
            this.eastCommander.activate();
            this.westCommander.activate();
            break;

          case 'east_only':
            // Only EAST commander (opposing WEST player)
            this.eastCommander = createEastCommander(mode, difficultyNum);
            this.eastCommander.activate();
            break;

          case 'west_only':
            // Only WEST commander (opposing EAST player)
            this.westCommander = createWestCommander(mode, difficultyNum);
            this.westCommander.activate();
            break;

          case 'interactive':
            // Interactive allied commander for player's side
            if (playerSide === 'WEST') {
              this.westCommander = createWestCommander(mode, difficultyNum);
              this.westCommander.activate();
            } else if (playerSide === 'EAST') {
              this.eastCommander = createEastCommander(mode, difficultyNum);
              this.eastCommander.activate();
            }
            break;
        }

        logger.info('Commander system initialized', {
          mode,
          difficulty: difficultyNum,
          map,
          playerSide,
          eastActive: this.eastCommander?.getState().isActive ?? false,
          westActive: this.westCommander?.getState().isActive ?? false
        });

        res.json({
          initialized: true,
          mode,
          difficulty: difficultyNum,
          map,
          playerSide,
          commanders: {
            east: this.eastCommander ? {
              active: this.eastCommander.getState().isActive,
              side: 'EAST'
            } : null,
            west: this.westCommander ? {
              active: this.westCommander.getState().isActive,
              side: 'WEST'
            } : null
          }
        });
      } catch (error) {
        logger.error('Error initializing commander system', { error });
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
