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
  IntelManager,
  createIntelManager,
  IntelSource,
  IntelLevel,
  TargetType,
  CommanderSide,
  FogOfWarMode,
  CreateIntelReportParams,
  CommanderIntel,
  IntelReport,
} from './commander/intel';

export class BridgeServer {
  private app: express.Application;
  private httpServer: HTTPServer | null = null;
  private wss: WebSocketServer | null = null;
  private llmClient: OpenAIClient | null = null;
  private actionQueue: Array<{ sqf: string; metadata: any }> = [];
  private lastActionTime: number = 0;
  private eastIntelManager: IntelManager;
  private westIntelManager: IntelManager;

  constructor() {
    this.app = express();
    this.eastIntelManager = createIntelManager('EAST');
    this.westIntelManager = createIntelManager('WEST');
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

  /**
   * Gets the IntelManager for a specific side
   * @param side Commander side (EAST or WEST)
   * @returns IntelManager for the specified side, or null if invalid
   */
  private getIntelManager(side: string): IntelManager | null {
    const normalizedSide = side.toUpperCase();
    if (normalizedSide === 'EAST') {
      return this.eastIntelManager;
    } else if (normalizedSide === 'WEST') {
      return this.westIntelManager;
    }
    return null;
  }

  /**
   * Validates the side parameter from request
   * @param side Side string from request params
   * @returns Normalized side string or null if invalid
   */
  private validateSide(side: string): CommanderSide | null {
    const normalizedSide = side?.toUpperCase();
    if (normalizedSide === 'EAST' || normalizedSide === 'WEST') {
      return normalizedSide as CommanderSide;
    }
    return null;
  }

  /**
   * Validates intel source from request
   * @param source Source string from request
   * @returns IntelSource enum value or null if invalid
   */
  private validateIntelSource(source: string): IntelSource | null {
    const validSources = Object.values(IntelSource);
    if (validSources.includes(source as IntelSource)) {
      return source as IntelSource;
    }
    return null;
  }

  /**
   * Validates target type from request
   * @param targetType Target type string from request
   * @returns TargetType enum value or null if invalid
   */
  private validateTargetType(targetType: string): TargetType | null {
    const validTypes = Object.values(TargetType);
    if (validTypes.includes(targetType as TargetType)) {
      return targetType as TargetType;
    }
    return null;
  }

  /**
   * Gets the complete intel picture for a commander side
   * @param side Commander side (EAST or WEST)
   * @param fogMode Fog of war mode to apply
   * @returns CommanderIntel object with filtered/processed intel
   */
  getIntelPicture(side: CommanderSide, fogMode: FogOfWarMode = FogOfWarMode.FULL): CommanderIntel {
    const intelManager = this.getIntelManager(side);
    if (!intelManager) {
      return {
        side,
        knownEnemies: [],
        lastContactAreas: [],
        suspectedPositions: [],
        confirmedTargets: [],
        fogOfWarMode: fogMode,
        lastUpdateTime: Date.now(),
      };
    }

    const allReports = intelManager.getAllReports();

    // Filter reports based on fog of war mode
    let filteredReports: IntelReport[];
    switch (fogMode) {
      case FogOfWarMode.NONE:
        // Debug mode - show all intel without restrictions
        filteredReports = allReports;
        break;
      case FogOfWarMode.PARTIAL:
        // Show active and confirmed, hide very stale reports
        filteredReports = allReports.filter(
          r => r.level !== IntelLevel.NO_INTEL && r.confidence >= 0.2
        );
        break;
      case FogOfWarMode.FULL:
      default:
        // Realistic - only show reports with reasonable confidence
        filteredReports = allReports.filter(
          r => r.level !== IntelLevel.NO_INTEL && r.confidence >= 0.3
        );
        break;
    }

    // Categorize reports
    const confirmedTargets = filteredReports.filter(r => r.level === IntelLevel.CONFIRMED);
    const activeReports = filteredReports.filter(r => r.level === IntelLevel.ACTIVE);
    const suspectedPositions = filteredReports.filter(
      r => r.level === IntelLevel.STALE || r.confidence < 0.5
    );

    return {
      side,
      knownEnemies: filteredReports,
      lastContactAreas: [], // Contact areas computed separately if needed
      suspectedPositions,
      confirmedTargets,
      fogOfWarMode: fogMode,
      lastUpdateTime: Date.now(),
    };
  }

  /**
   * Applies fog of war to a position based on intel accuracy
   * Returns a fuzzed position with uncertainty based on report accuracy
   * @param position Original position
   * @param accuracy Position accuracy in meters (higher = less accurate)
   * @returns Fuzzed position with uncertainty applied
   */
  applyPositionFuzzing(
    position: { x: number; y: number; z: number },
    accuracy: number
  ): { x: number; y: number; z: number } {
    if (accuracy <= 0) {
      return { ...position };
    }

    // Apply random offset within accuracy radius
    const angle = Math.random() * 2 * Math.PI;
    const distance = Math.random() * accuracy;

    return {
      x: position.x + Math.cos(angle) * distance,
      y: position.y + Math.sin(angle) * distance,
      z: position.z,
    };
  }

  /**
   * Gets enemy positions filtered by fog of war for a commander side
   * This integrates intel with game state for decision making
   * @param side Commander side requesting intel
   * @param fogMode Fog of war mode to apply
   * @returns Array of positions with uncertainty applied based on intel quality
   */
  getFilteredEnemyPositions(
    side: CommanderSide,
    fogMode: FogOfWarMode = FogOfWarMode.FULL
  ): Array<{ position: { x: number; y: number; z: number }; confidence: number; level: IntelLevel }> {
    const intel = this.getIntelPicture(side, fogMode);

    return intel.knownEnemies.map(report => {
      // Apply position fuzzing based on accuracy and confidence
      const effectiveAccuracy = report.positionAccuracy * (2 - report.confidence);
      const fuzzedPosition = this.applyPositionFuzzing(report.position, effectiveAccuracy);

      return {
        position: fuzzedPosition,
        confidence: report.confidence,
        level: report.level,
      };
    });
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

    // =========================================================================
    // Intel API Endpoints
    // =========================================================================

    // Get intel for a side
    this.app.get('/api/intel/:side', (req: Request, res: Response) => {
      try {
        const { side } = req.params;
        const validSide = this.validateSide(side);

        if (!validSide) {
          return res.status(400).json({
            error: 'Invalid side parameter',
            message: 'Side must be EAST or WEST',
          });
        }

        const intelManager = this.getIntelManager(validSide);
        if (!intelManager) {
          return res.status(500).json({ error: 'Intel manager not found' });
        }

        const reports = intelManager.getAllReports();
        const statistics = intelManager.getStatistics();

        logger.info('Intel retrieved', {
          side: validSide,
          reportCount: reports.length,
        });

        res.json({
          side: validSide,
          reports,
          statistics,
          timestamp: Date.now(),
        });
      } catch (error) {
        logger.error('Error getting intel', { error });
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Submit new intel report
    this.app.post('/api/intel/report', (req: Request, res: Response) => {
      try {
        const { side, source, targetType, position, positionAccuracy, heading, speed, strength, confidence, notes } = req.body;

        // Validate required fields
        if (!side) {
          return res.status(400).json({
            error: 'Missing required field',
            message: 'side is required',
          });
        }

        const validSide = this.validateSide(side);
        if (!validSide) {
          return res.status(400).json({
            error: 'Invalid side parameter',
            message: 'Side must be EAST or WEST',
          });
        }

        if (!source) {
          return res.status(400).json({
            error: 'Missing required field',
            message: 'source is required',
          });
        }

        const validSource = this.validateIntelSource(source);
        if (!validSource) {
          return res.status(400).json({
            error: 'Invalid source parameter',
            message: `Source must be one of: ${Object.values(IntelSource).join(', ')}`,
          });
        }

        if (!targetType) {
          return res.status(400).json({
            error: 'Missing required field',
            message: 'targetType is required',
          });
        }

        const validTargetType = this.validateTargetType(targetType);
        if (!validTargetType) {
          return res.status(400).json({
            error: 'Invalid targetType parameter',
            message: `targetType must be one of: ${Object.values(TargetType).join(', ')}`,
          });
        }

        if (!position || typeof position.x !== 'number' || typeof position.y !== 'number' || typeof position.z !== 'number') {
          return res.status(400).json({
            error: 'Invalid position parameter',
            message: 'position must be an object with x, y, z number properties',
          });
        }

        const intelManager = this.getIntelManager(validSide);
        if (!intelManager) {
          return res.status(500).json({ error: 'Intel manager not found' });
        }

        // Build report parameters
        const reportParams: CreateIntelReportParams = {
          source: validSource,
          targetType: validTargetType,
          position: {
            x: position.x,
            y: position.y,
            z: position.z,
          },
          positionAccuracy: typeof positionAccuracy === 'number' ? positionAccuracy : undefined,
          heading: typeof heading === 'number' ? heading : undefined,
          speed: typeof speed === 'number' ? speed : undefined,
          strength: strength ?? undefined,
          confidence: typeof confidence === 'number' ? Math.max(0, Math.min(1, confidence)) : undefined,
          notes: typeof notes === 'string' ? notes : undefined,
        };

        // Process report (handles duplicates via merging)
        const report = intelManager.processReport(reportParams);

        if (!report) {
          return res.status(400).json({
            error: 'Failed to create report',
            message: 'Invalid report data or position',
          });
        }

        logger.info('Intel report created', {
          side: validSide,
          id: report.id,
          source: report.source,
          targetType: report.targetType,
        });

        res.status(201).json({
          created: true,
          report,
        });
      } catch (error) {
        logger.error('Error creating intel report', { error });
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Delete intel report
    this.app.delete('/api/intel/:id', (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        const { side } = req.query;

        if (!id) {
          return res.status(400).json({
            error: 'Missing required parameter',
            message: 'Report ID is required',
          });
        }

        // If side is provided, only check that manager
        // Otherwise, try both managers
        let deleted = false;
        let deletedFrom: CommanderSide | null = null;

        if (side) {
          const validSide = this.validateSide(side as string);
          if (!validSide) {
            return res.status(400).json({
              error: 'Invalid side parameter',
              message: 'Side must be EAST or WEST',
            });
          }

          const intelManager = this.getIntelManager(validSide);
          if (intelManager && intelManager.removeReport(id)) {
            deleted = true;
            deletedFrom = validSide;
          }
        } else {
          // Try both managers
          if (this.eastIntelManager.removeReport(id)) {
            deleted = true;
            deletedFrom = 'EAST';
          } else if (this.westIntelManager.removeReport(id)) {
            deleted = true;
            deletedFrom = 'WEST';
          }
        }

        if (!deleted) {
          return res.status(404).json({
            error: 'Report not found',
            message: `No report found with ID: ${id}`,
          });
        }

        logger.info('Intel report deleted', { id, side: deletedFrom });

        res.json({
          deleted: true,
          id,
          side: deletedFrom,
        });
      } catch (error) {
        logger.error('Error deleting intel report', { error });
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Get fog of war filtered intel picture for a side
    this.app.get('/api/intel/:side/picture', (req: Request, res: Response) => {
      try {
        const { side } = req.params;
        const { fogMode } = req.query;

        const validSide = this.validateSide(side);
        if (!validSide) {
          return res.status(400).json({
            error: 'Invalid side parameter',
            message: 'Side must be EAST or WEST',
          });
        }

        // Validate fog mode if provided
        let validFogMode: FogOfWarMode = FogOfWarMode.FULL;
        if (fogMode) {
          const modeStr = (fogMode as string).toLowerCase();
          if (modeStr === 'full') {
            validFogMode = FogOfWarMode.FULL;
          } else if (modeStr === 'partial') {
            validFogMode = FogOfWarMode.PARTIAL;
          } else if (modeStr === 'none') {
            validFogMode = FogOfWarMode.NONE;
          } else {
            return res.status(400).json({
              error: 'Invalid fogMode parameter',
              message: 'fogMode must be one of: full, partial, none',
            });
          }
        }

        const intelPicture = this.getIntelPicture(validSide, validFogMode);
        const filteredPositions = this.getFilteredEnemyPositions(validSide, validFogMode);

        logger.info('Intel picture retrieved', {
          side: validSide,
          fogMode: validFogMode,
          knownEnemies: intelPicture.knownEnemies.length,
          confirmedTargets: intelPicture.confirmedTargets.length,
        });

        res.json({
          ...intelPicture,
          filteredPositions,
          statistics: this.getIntelManager(validSide)?.getStatistics() ?? null,
        });
      } catch (error) {
        logger.error('Error getting intel picture', { error });
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

    // Start intel decay intervals for both sides
    this.eastIntelManager.startDecay();
    this.westIntelManager.startDecay();
    logger.info('Intel decay intervals started');

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
    // Stop intel decay intervals and clean up resources
    this.eastIntelManager.dispose();
    this.westIntelManager.dispose();
    logger.info('Intel managers disposed');

    if (this.wss) {
      this.wss.close();
    }
    if (this.httpServer) {
      this.httpServer.close();
    }
    logger.info('Bridge server stopped');
  }
}
