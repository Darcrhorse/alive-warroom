/**
 * HTTP/WebSocket Server for LLM Game Master Bridge
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { Server as HTTPServer } from 'http';
import { GameState, GameEvent } from './game-state/types';
import { gameStateManager } from './game-state/manager';
import { sqfValidator } from './sqf/validator';
import { sqfSanitizer } from './sqf/sanitizer';
import { sqfParser } from './sqf/parser';
import { OpenAIClient } from './llm/openai';
import { ClaudeClient, ControlledSide } from './llm/claude';
import { createAgentClient, canUseAgentSDK } from './llm/agent-loader';
import { CopilotClient } from './llm/copilot';
import { ClaudeCLIClient } from './llm/claude-cli';
import { LLMClient } from './llm/client';
import { configManager } from './config/settings';
import { logger } from './utils/logger';
import { AIMode } from './game-state/types';
import { unitTracker, CombatReport } from './game/unitTracker';
import { inidbiWriter } from './inidbi-writer';

export class BridgeServer {
  private app: express.Application;
  private httpServer: HTTPServer | null = null;
  private wss: WebSocketServer | null = null;

  // Single mode - one AI controls both sides
  private llmClient: LLMClient | null = null;

  // Dual mode - two AIs, each controls one side
  private eastClient: ClaudeClient | null = null;
  private westClient: ClaudeClient | null = null;

  // AI mode: 'single' or 'dual'
  private aiMode: AIMode = 'single';

  // Action queues - single mode uses actionQueue, dual mode uses both
  private actionQueue: Array<{ sqf: string; metadata: any; commandId?: string }> = [];
  private eastActionQueue: Array<{ sqf: string; metadata: any; commandId?: string }> = [];
  private westActionQueue: Array<{ sqf: string; metadata: any; commandId?: string }> = [];

  // SQF Result tracking - stores execution results with command IDs
  private sqfResults: Map<string, {
    result: any;
    timestamp: number;
    status: 'pending' | 'complete' | 'error';
    error?: string;
  }> = new Map();
  private readonly RESULT_TTL_MS = 60000; // Results expire after 60 seconds
  private commandIdCounter: number = 0;

  // Timing for each side
  private lastActionTime: number = 0;
  private lastEastActionTime: number = 0;
  private lastWestActionTime: number = 0;
  private lastActionSide: 'EAST' | 'WEST' = 'EAST';

  // FOB Tracking - MUST establish FOB before any other spawns!
  private eastFobEstablished: boolean = false;
  private westFobEstablished: boolean = false;

  // Connection state tracking for auto-recovery
  private lastStateReceivedTime: number = 0;
  private connectionState: 'idle' | 'connected' | 'stale' | 'lost' = 'idle';
  private connectionCheckInterval: NodeJS.Timeout | null = null;
  private readonly STATE_STALE_TIMEOUT_MS = 45000;  // 45 seconds = stale
  private readonly STATE_LOST_TIMEOUT_MS = 90000;   // 90 seconds = lost

  // Combat event tracking for dashboard
  private recentCombatEvents: Array<{
    timestamp: number;
    type: string;
    side: string;
    message: string;
    position?: { x: number; y: number };
  }> = [];
  private readonly MAX_COMBAT_EVENTS = 50;

  // Resource Limits - spawn budgets per side
  private eastSpawnBudget: number = 100;  // Reset each mission
  private westSpawnBudget: number = 100;
  private lastBudgetRegenTime: number = Date.now();
  private readonly BUDGET_REGEN_INTERVAL = 120000; // 2 minutes
  private readonly BUDGET_REGEN_AMOUNT = 5;
  private readonly SPAWN_COSTS: Record<string, number> = {
    infantry: 1,      // Per soldier
    light_vehicle: 5, // Technical, truck
    apc: 10,          // BTR, Stryker
    tank: 20,         // T-72, Abrams
    helicopter: 25,   // Transport heli
    attack_heli: 35,  // Apache, Hind
    jet: 40,          // Fixed-wing
    paradrop: 30,     // Full paradrop squad
  };
  private readonly KILL_REWARDS: Record<string, number> = {
    infantry: 1,
    car: 2,
    truck: 3,
    apc: 5,
    tank: 8,
    helicopter: 10,
    plane: 12,
  };
  private readonly RTB_REFUND_PERCENT = 0.3; // 30% refund if SQF includes RTB
  private readonly FOB_ACTIVE_BONUS = 2; // +2 per cycle if FOB exists
  private readonly MAX_BUDGET = 150; // Cap budget

  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    // Async LLM setup - starts immediately
    this.setupLLMClient().catch(err => {
      logger.error('Failed to setup LLM client', { error: err.message });
    });
    // Clean up old results periodically
    setInterval(() => this.cleanupOldResults(), 30000);
  }

  /**
   * Generate a unique command ID for result tracking
   */
  private generateCommandId(): string {
    this.commandIdCounter++;
    return `cmd_${Date.now()}_${this.commandIdCounter}`;
  }

  /**
   * Clean up expired SQF results
   */
  private cleanupOldResults(): void {
    const now = Date.now();
    for (const [id, data] of this.sqfResults.entries()) {
      if (now - data.timestamp > this.RESULT_TTL_MS) {
        this.sqfResults.delete(id);
      }
    }
  }

  // SSE clients for live dashboard updates
  private sseClients: Set<Response> = new Set();

  private setupMiddleware(): void {
    this.app.use(cors({ origin: configManager.get('server').corsOrigins }));
    this.app.use(express.json({ limit: '10mb' }));

    // Serve static files from public directory (War Room Dashboard)
    this.app.use(express.static(path.join(__dirname, '../public')));

    // Request logging
    this.app.use((req, res, next) => {
      logger.debug(`${req.method} ${req.path}`);
      next();
    });
  }

  // Broadcast event to all SSE clients
  private broadcastSSE(eventData: any): void {
    const message = `data: ${JSON.stringify(eventData)}\n\n`;
    this.sseClients.forEach(client => {
      try {
        client.write(message);
      } catch (e) {
        this.sseClients.delete(client);
      }
    });
  }

  private async setupLLMClient(): Promise<void> {
    const llmConfig = configManager.get('llm');
    this.aiMode = llmConfig.mode || 'single';

    // Check for OAuth token (Max subscription - no API costs!)
    const hasOAuthToken = !!process.env.CLAUDE_CODE_OAUTH_TOKEN;

    if (this.aiMode === 'disabled') {
      // DISABLED MODE: No AI decisions, only manual commands via MCP
      logger.info('AI Mode: DISABLED - No autonomous AI decisions, MCP commands only');
      return; // Skip all LLM client initialization
    }

    if (this.aiMode === 'dual') {
      // DUAL MODE: Two separate AI commanders
      logger.info('AI Mode: DUAL - Initializing EAST and WEST commanders');

      if (llmConfig.provider === 'copilot') {
        // Use Copilot CLI for both commanders
        this.eastClient = new CopilotClient('EAST') as any;
        logger.info('EAST Commander (OPFOR) initialized with Copilot CLI');

        this.westClient = new CopilotClient('WEST') as any;
        logger.info('WEST Commander (BLUFOR) initialized with Copilot CLI');
      } else if (llmConfig.provider === 'claude-cli') {
        // Use Claude CLI for both commanders (uses subscription, not API credits)
        this.eastClient = new ClaudeCLIClient('EAST') as any;
        logger.info('EAST Commander (OPFOR) initialized with Claude CLI');

        this.westClient = new ClaudeCLIClient('WEST') as any;
        logger.info('WEST Commander (BLUFOR) initialized with Claude CLI');
      } else if (hasOAuthToken) {
        // Use Agent SDK with Max subscription (full tools support!)
        logger.info('🔐 Using Claude Max subscription with Agent SDK (full tools!)');
        const eastModel = llmConfig.east?.model || llmConfig.model || 'claude-sonnet-4-20250514';
        const westModel = llmConfig.west?.model || llmConfig.model || 'claude-sonnet-4-20250514';

        const [eastClient, westClient] = await Promise.all([
          createAgentClient(eastModel, llmConfig.maxTokens, 'EAST'),
          createAgentClient(westModel, llmConfig.maxTokens, 'WEST')
        ]);

        if (eastClient) {
          this.eastClient = eastClient as any;
          logger.info('EAST Commander (OPFOR) initialized with Agent SDK', { model: eastModel });
        }
        if (westClient) {
          this.westClient = westClient as any;
          logger.info('WEST Commander (BLUFOR) initialized with Agent SDK', { model: westModel });
        }
      } else {
        // Use Claude API key
        const eastApiKey = llmConfig.east?.apiKey || llmConfig.apiKey;
        const westApiKey = llmConfig.west?.apiKey || llmConfig.apiKey;
        const eastModel = llmConfig.east?.model || llmConfig.model || 'claude-sonnet-4-20250514';
        const westModel = llmConfig.west?.model || llmConfig.model || 'claude-sonnet-4-20250514';

        if (eastApiKey || westApiKey) {
          logger.info('💳 Using Claude API key');

          if (eastApiKey) {
            this.eastClient = new ClaudeClient(eastApiKey, eastModel, llmConfig.maxTokens, 'EAST');
            logger.info('EAST Commander (OPFOR) initialized', { model: eastModel });
          }
          if (westApiKey) {
            this.westClient = new ClaudeClient(westApiKey, westModel, llmConfig.maxTokens, 'WEST');
            logger.info('WEST Commander (BLUFOR) initialized', { model: westModel });
          }
        }
      }

      if (!this.eastClient && !this.westClient) {
        logger.warn('No API keys configured for dual mode - running in passive mode');
      }

    } else {
      // SINGLE MODE: One AI controls both sides (original behavior)
      logger.info('AI Mode: SINGLE - One AI controls both sides');

      if (llmConfig.provider === 'openai' && llmConfig.apiKey) {
        this.llmClient = new OpenAIClient(
          llmConfig.apiKey,
          llmConfig.model,
          llmConfig.maxTokens,
          llmConfig.temperature
        );
        logger.info('OpenAI client initialized', { model: llmConfig.model });
      } else if (llmConfig.provider === 'claude') {
        const model = llmConfig.model || 'claude-sonnet-4-20250514';

        if (hasOAuthToken) {
          // Use Agent SDK with Max subscription (full tools!)
          logger.info('🔐 Using Claude Max subscription with Agent SDK');
          const client = await createAgentClient(model, llmConfig.maxTokens, 'BOTH');
          if (client) {
            this.llmClient = client;
            logger.info('Claude Agent SDK initialized', { model });
          }
        } else if (llmConfig.apiKey) {
          // Fallback to API key
          this.llmClient = new ClaudeClient(
            llmConfig.apiKey,
            model,
            llmConfig.maxTokens,
            'BOTH'
          );
          logger.info('Claude client initialized (API key)', { model });
        }
      } else if (llmConfig.provider === 'copilot') {
        this.llmClient = new CopilotClient('BOTH');
        logger.info('Copilot CLI client initialized');
      } else if (llmConfig.provider === 'claude-cli') {
        this.llmClient = new ClaudeCLIClient('BOTH');
        logger.info('Claude CLI client initialized (uses subscription)');
      } else {
        logger.warn('LLM client not configured - running in passive mode');
      }
    }
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({ status: 'ok', timestamp: Date.now() });
    });

    // Get status - includes connection health for auto-recovery
    this.app.get('/api/status', (req: Request, res: Response) => {
      const timeSinceLastUpdate = this.lastStateReceivedTime > 0
        ? Date.now() - this.lastStateReceivedTime
        : -1;

      res.json({
        connected: this.connectionState === 'connected',
        connectionState: this.connectionState,
        timeSinceLastUpdate,
        timeSinceLastUpdateSec: timeSinceLastUpdate > 0 ? Math.round(timeSinceLastUpdate / 1000) : -1,
        warning: this.connectionState !== 'connected' && this.connectionState !== 'idle'
          ? `Game connection ${this.connectionState} - AI decisions paused`
          : null,
        llmStatus: this.aiMode === 'dual'
          ? { east: this.eastClient?.isConfigured() ? 'ready' : 'not configured',
              west: this.westClient?.isConfigured() ? 'ready' : 'not configured' }
          : this.llmClient?.isConfigured() ? 'ready' : 'not configured',
        aiMode: this.aiMode,
        queueLength: this.actionQueue.length,
        eastQueueLength: this.eastActionQueue.length,
        westQueueLength: this.westActionQueue.length,
        lastActionTime: this.lastActionTime,
        budgets: this.aiMode === 'dual' ? { east: this.eastSpawnBudget, west: this.westSpawnBudget } : null,
        gameState: gameStateManager.getState(),
        combatEvents: this.recentCombatEvents.slice(0, 20)
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

        // Track connection freshness - CRITICAL for auto-recovery
        const wasDisconnected = this.connectionState !== 'connected';
        this.lastStateReceivedTime = Date.now();
        this.connectionState = 'connected';

        if (wasDisconnected && this.connectionState === 'connected') {
          logger.info('🔌 Game connection RESTORED - resuming AI decisions');
        }

        // Update state
        gameStateManager.updateState(gameState);
        
        // Handle both new format (allUnits/unitCounts) and legacy format (friendlyUnits/enemyUnits)
        const enemyCount = gameState.unitCounts?.OPFOR ?? gameState.enemyUnits?.length ?? 0;
        const friendlyCount = gameState.unitCounts?.BLUFOR ?? gameState.friendlyUnits?.length ?? 0;

        logger.info('Game state received', {
          players: gameState.players.length,
          enemies: enemyCount,
          friendlies: friendlyCount,
          timestamp: gameState.timestamp
        });

        // Process state asynchronously
        this.processGameState(gameState).catch(err => {
          const errMsg = err instanceof Error ? err.message : String(err);
          const errStack = err instanceof Error ? err.stack : undefined;
          logger.error('Error processing game state', { message: errMsg, stack: errStack });
        });

        res.json({ received: true, queuePosition: this.actionQueue.length });
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        const errStack = error instanceof Error ? error.stack : undefined;
        logger.error('Error handling state update', { message: errMsg, stack: errStack });
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Receive combat reports from game
    this.app.post('/api/combat_report', (req: Request, res: Response) => {
      try {
        const data = req.body;
        const reports = data.reports || [];

        for (const report of reports) {
          const combatReport: CombatReport = {
            timestamp: Date.now(),
            type: report.type || 'unknown',
            position: report.position || [0, 0, 0],
            details: this.formatCombatReportDetails(report)
          };

          const groupId = report.groupId || -1;
          const side = report.side as 'EAST' | 'WEST';

          // Push to combat events for dashboard
          const eventMessage = this.formatCombatEventMessage(report, groupId);
          this.recentCombatEvents.unshift({
            timestamp: Date.now(),
            type: report.type || 'unknown',
            side: side,
            message: eventMessage,
            position: report.position ? { x: report.position[0], y: report.position[1] } : undefined
          });
          // Keep only recent events
          if (this.recentCombatEvents.length > this.MAX_COMBAT_EVENTS) {
            this.recentCombatEvents.pop();
          }

          if (report.type === 'casualty') {
            unitTracker.reportCasualty(groupId, report.unitId || 'unknown', report.position);
            logger.info(`Combat: ${side} Group ${groupId} casualty`, {
              alive: report.aliveInGroup,
              total: report.totalInGroup
            });
          } else {
            unitTracker.reportCombat(groupId, combatReport);
            logger.info(`Combat: ${side} Group ${groupId} ${report.type}`, { details: combatReport.details });
          }
        }

        res.json({ received: true, count: reports.length });
      } catch (error) {
        logger.error('Error handling combat report', { error });
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Get pending action - handles both single and dual mode
    this.app.get('/api/action', (req: Request, res: Response) => {
      let action: { sqf: string; metadata: any; commandId?: string } | undefined;

      if (this.aiMode === 'dual') {
        // DUAL MODE: Alternate between EAST and WEST queues for fairness
        action = this.getNextDualModeAction();
      } else {
        // SINGLE MODE: Use main queue
        if (this.actionQueue.length === 0) {
          return res.json({ hasAction: false });
        }
        action = this.actionQueue.shift();
      }

      if (!action) {
        return res.json({ hasAction: false });
      }

      logger.info('Action sent to game', {
        metadata: action.metadata,
        commandId: action.commandId
      });

      // Broadcast to dashboard
      this.broadcastSSE({
        type: 'action_executed',
        side: action.metadata?.side || 'UNKNOWN',
        action: action.metadata?.action || 'command',
        reasoning: action.metadata?.reasoning || '',
        commandId: action.commandId,
        timestamp: Date.now()
      });

      // Base64 encode SQF to avoid quote escaping issues with Pythia
      const sqfBase64 = action.sqf ? Buffer.from(action.sqf).toString('base64') : '';

      res.json({
        hasAction: true,
        sqf: sqfBase64,
        sqfEncoding: 'base64',
        commandId: action.commandId, // Include so game can post results back
        metadata: action.metadata
      });
    });

    // Log event
    this.app.post('/api/event', (req: Request, res: Response) => {
      try {
        const event: GameEvent = req.body;
        gameStateManager.addEvent(event);
        logger.info('Event logged', { type: event.type });

        // Process kill rewards in dual mode
        if (this.aiMode === 'dual') {
          this.processKillReward(event);
        }

        res.json({ logged: true });
      } catch (error) {
        logger.error('Error logging event', { error });
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Direct command injection - allows external tools to push SQF to game
    // Returns a commandId that can be used to retrieve execution results
    this.app.post('/api/command', (req: Request, res: Response) => {
      try {
        const { sqf, description, waitForResult } = req.body;
        if (!sqf) {
          return res.status(400).json({ error: 'Missing sqf field' });
        }

        // Generate unique command ID for result tracking
        const commandId = this.generateCommandId();

        // Initialize result tracking (pending state)
        this.sqfResults.set(commandId, {
          result: null,
          timestamp: Date.now(),
          status: 'pending'
        });

        this.actionQueue.push({
          sqf: sqf,
          commandId: commandId,
          metadata: {
            action: 'direct_command',
            reasoning: description || 'Direct command from Claude Code',
            timestamp: Date.now(),
            commandId: commandId // Include in metadata for game
          }
        });

        // Also write to INIDBI2 for game polling
        try {
          inidbiWriter.writeCommand(sqf, commandId);
        } catch (e) {
          logger.warn('Failed to write to INIDBI2', { error: e });
        }

        logger.info('Direct command queued', {
          commandId,
          sqfLength: sqf.length,
          description: description || 'none',
          queueLength: this.actionQueue.length
        });

        res.json({
          queued: true,
          commandId: commandId,
          queuePosition: this.actionQueue.length,
          resultEndpoint: `/api/result/${commandId}`
        });
      } catch (error) {
        logger.error('Error queuing command', { error });
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // POST /api/result - Game posts execution results here
    this.app.post('/api/result', (req: Request, res: Response) => {
      try {
        const { commandId, result, error } = req.body;
        if (!commandId) {
          return res.status(400).json({ error: 'Missing commandId field' });
        }

        // Check if we're tracking this command
        if (!this.sqfResults.has(commandId)) {
          logger.warn('Result received for unknown commandId', { commandId });
          // Still accept it - might be from an old command
        }

        // Store the result
        this.sqfResults.set(commandId, {
          result: result,
          timestamp: Date.now(),
          status: error ? 'error' : 'complete',
          error: error
        });

        logger.info('SQF result received', {
          commandId,
          hasResult: result !== null && result !== undefined,
          hasError: !!error,
          resultPreview: typeof result === 'string' ? result.substring(0, 100) : JSON.stringify(result).substring(0, 100)
        });

        // Broadcast to SSE clients for dashboard visibility
        this.broadcastSSE({
          type: 'sqf_result',
          commandId,
          result: result,
          error: error,
          timestamp: Date.now()
        });

        res.json({ received: true, commandId });
      } catch (error) {
        logger.error('Error receiving result', { error });
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // GET /api/result/:id - Poll for execution result
    this.app.get('/api/result/:id', (req: Request, res: Response) => {
      try {
        const commandId = req.params.id;
        const data = this.sqfResults.get(commandId);

        if (!data) {
          return res.status(404).json({
            error: 'Command not found or expired',
            commandId,
            hint: 'Results expire after 60 seconds'
          });
        }

        res.json({
          commandId,
          status: data.status,
          result: data.result,
          error: data.error,
          age: Date.now() - data.timestamp
        });
      } catch (error) {
        logger.error('Error retrieving result', { error });
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Player chat interface - send natural language commands to AI commanders
    this.app.post('/api/chat', async (req: Request, res: Response) => {
      try {
        const { message, side, playerName, playerPosition } = req.body;

        if (!message) {
          return res.status(400).json({ error: 'Missing message field' });
        }

        if (!side || !['EAST', 'WEST'].includes(side.toUpperCase())) {
          return res.status(400).json({ error: 'Invalid side - must be EAST or WEST' });
        }

        const targetSide = side.toUpperCase() as 'EAST' | 'WEST';
        logger.info(`Chat from ${playerName || 'Player'} to ${targetSide}: ${message}`);

        // Get the appropriate AI commander
        const client = targetSide === 'EAST' ? this.eastClient : this.westClient;

        if (!client || !client.isConfigured()) {
          return res.status(503).json({
            error: `${targetSide} Commander not available`,
            response: `${targetSide} Commander is offline.`
          });
        }

        // Get current game state for context
        const gameState = gameStateManager.getState();

        // Process chat command through AI
        const response = await client.processChatCommand(
          message,
          playerName || 'Commander',
          playerPosition || null,
          gameState
        );

        // If AI generated SQF, queue it
        if (response.sqf) {
          const queue = targetSide === 'EAST' ? this.eastActionQueue : this.westActionQueue;
          queue.push({
            sqf: response.sqf,
            metadata: {
              action: 'player_command',
              reasoning: `Player command: ${message}`,
              side: targetSide,
              playerName: playerName || 'Commander',
              timestamp: Date.now()
            }
          });

          logger.info(`${targetSide} chat command queued`, {
            message: message.substring(0, 50),
            hasSQF: true,
            queueLength: queue.length
          });
        }

        // Broadcast to dashboard clients
        this.broadcastSSE({
          type: 'chat_response',
          side: targetSide,
          playerName: playerName || 'Commander',
          message: message,
          response: response.text,
          actionQueued: !!response.sqf,
          timestamp: Date.now()
        });

        res.json({
          success: true,
          side: targetSide,
          response: response.text,
          actionQueued: !!response.sqf
        });

      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        logger.error('Error processing chat command', { error: errMsg });
        res.status(500).json({
          error: 'Failed to process command',
          response: 'Command processing failed. Please try again.'
        });
      }
    });

    // Server-Sent Events for live dashboard updates
    this.app.get('/api/events', (req: Request, res: Response) => {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      // Send initial ping
      res.write('data: {"type":"connected"}\n\n');

      // Add to SSE clients
      this.sseClients.add(res);
      logger.info('Dashboard client connected', { totalClients: this.sseClients.size });

      // Remove on disconnect
      req.on('close', () => {
        this.sseClients.delete(res);
        logger.info('Dashboard client disconnected', { totalClients: this.sseClients.size });
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

    // MCP Database Export - receives game data export for MCP database
    this.app.post('/api/mcp_export', async (req: Request, res: Response) => {
      try {
        const exportData = req.body.data || req.body;
        const fs = await import('fs');
        const path = await import('path');

        // Save to data directory
        const dataDir = path.join(__dirname, '..', 'data');
        if (!fs.existsSync(dataDir)) {
          fs.mkdirSync(dataDir, { recursive: true });
        }

        const exportPath = path.join(dataDir, 'game_export.json');
        fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2));

        // Log stats
        const stats = {
          units: Array.isArray(exportData.units) ? exportData.units.length : 0,
          vehicles: Array.isArray(exportData.vehicles) ? exportData.vehicles.length : 0,
          weapons: Array.isArray(exportData.weapons) ? exportData.weapons.length : 0,
          factions: Array.isArray(exportData.factions) ? exportData.factions.length : 0,
          groups: Array.isArray(exportData.groups) ? exportData.groups.length : 0,
          sqfCommands: Array.isArray(exportData.sqfCommands) ? exportData.sqfCommands.length : 0
        };

        logger.info('MCP export received', stats);

        res.json({
          success: true,
          path: exportPath,
          stats
        });
      } catch (error) {
        logger.error('MCP export error', { error });
        res.status(500).json({ error: 'Failed to save export' });
      }
    });
  }

  /**
   * DUAL MODE: Get next action, alternating between EAST and WEST for fairness
   */
  private getNextDualModeAction(): { sqf: string; metadata: any; commandId?: string } | undefined {
    // Priority 1: Direct commands from actionQueue (from /api/command)
    if (this.actionQueue.length > 0) {
      return this.actionQueue.shift();
    }

    // Priority 2: Alternate between EAST and WEST for fairness
    if (this.lastActionSide === 'EAST' && this.westActionQueue.length > 0) {
      this.lastActionSide = 'WEST';
      return this.westActionQueue.shift();
    } else if (this.eastActionQueue.length > 0) {
      this.lastActionSide = 'EAST';
      return this.eastActionQueue.shift();
    } else if (this.westActionQueue.length > 0) {
      this.lastActionSide = 'WEST';
      return this.westActionQueue.shift();
    }
    return undefined;
  }

  /**
   * FOG OF WAR: Filter game state so each commander only sees their own forces
   * EAST sees: OPFOR units, does NOT see exact BLUFOR positions (only count estimate)
   * WEST sees: BLUFOR units + players, does NOT see exact OPFOR positions (only count estimate)
   */
  private applyFogOfWar(gameState: GameState, side: 'EAST' | 'WEST'): GameState {
    const filtered = JSON.parse(JSON.stringify(gameState)) as GameState;

    if (side === 'EAST') {
      // EAST Commander: Sees OPFOR, hides exact BLUFOR positions
      // Show own units as "friendlyUnits", enemy as vague "enemyUnits"
      const opforUnits = filtered.enemyUnits || [];
      const bluforUnits = filtered.friendlyUnits || [];

      // EAST sees OPFOR as friendlies
      filtered.friendlyUnits = opforUnits;

      // EAST gets vague intel on BLUFOR - knows count but not exact positions
      filtered.enemyUnits = bluforUnits.map(u => ({
        ...u,
        position: {
          x: u.position.x + (Math.random() - 0.5) * 200, // Fuzzy positions
          y: u.position.y + (Math.random() - 0.5) * 200,
          z: u.position.z
        }
      }));

      // Update unit counts for EAST perspective
      if (filtered.unitCounts) {
        filtered.unitCounts = {
          OPFOR: filtered.unitCounts.OPFOR,
          BLUFOR: Math.floor(filtered.unitCounts.BLUFOR * (0.8 + Math.random() * 0.4)), // Estimate
          INDEPENDENT: filtered.unitCounts.INDEPENDENT || 0,
          CIVILIAN: filtered.unitCounts.CIVILIAN || 0
        };
      }

      // Add resource budget info
      (filtered as any).spawnBudget = this.eastSpawnBudget;
      (filtered as any).commanderSide = 'EAST';

    } else {
      // WEST Commander: Sees BLUFOR + players, hides exact OPFOR positions
      const opforUnits = filtered.enemyUnits || [];
      const bluforUnits = filtered.friendlyUnits || [];

      // WEST keeps BLUFOR as friendlies (already correct)
      filtered.friendlyUnits = bluforUnits;

      // WEST gets vague intel on OPFOR
      filtered.enemyUnits = opforUnits.map(u => ({
        ...u,
        position: {
          x: u.position.x + (Math.random() - 0.5) * 200,
          y: u.position.y + (Math.random() - 0.5) * 200,
          z: u.position.z
        }
      }));

      // Update unit counts for WEST perspective
      if (filtered.unitCounts) {
        filtered.unitCounts = {
          OPFOR: Math.floor(filtered.unitCounts.OPFOR * (0.8 + Math.random() * 0.4)), // Estimate
          BLUFOR: filtered.unitCounts.BLUFOR,
          INDEPENDENT: filtered.unitCounts.INDEPENDENT || 0,
          CIVILIAN: filtered.unitCounts.CIVILIAN || 0
        };
      }

      // Add resource budget info
      (filtered as any).spawnBudget = this.westSpawnBudget;
      (filtered as any).commanderSide = 'WEST';
    }

    return filtered;
  }

  /**
   * BUDGET REGENERATION - Called on each game state update
   */
  private processBudgetRegeneration(gameState: GameState): void {
    const now = Date.now();

    // Time-based regeneration
    if (now - this.lastBudgetRegenTime >= this.BUDGET_REGEN_INTERVAL) {
      const oldEast = this.eastSpawnBudget;
      const oldWest = this.westSpawnBudget;

      this.eastSpawnBudget = Math.min(this.MAX_BUDGET, this.eastSpawnBudget + this.BUDGET_REGEN_AMOUNT);
      this.westSpawnBudget = Math.min(this.MAX_BUDGET, this.westSpawnBudget + this.BUDGET_REGEN_AMOUNT);
      this.lastBudgetRegenTime = now;

      logger.info('Budget regeneration', {
        east: `${oldEast} → ${this.eastSpawnBudget}`,
        west: `${oldWest} → ${this.westSpawnBudget}`
      });
    }

    // FOB Active Bonus - check if FOB positions are set (means FOB was established)
    // This is a simple check - could be enhanced with game-side verification
    const gmSpawnedGroups = (gameState as any).gmSpawnedGroups || [];
    const hasFobActivity = gmSpawnedGroups.length > 0;

    if (hasFobActivity && now - this.lastBudgetRegenTime < this.BUDGET_REGEN_INTERVAL / 2) {
      // Small bonus for active operations
      // (Only applies if we're mid-cycle to avoid double-dipping with time regen)
    }
  }

  /**
   * KILL REWARDS - Process unit death events for budget rewards
   */
  processKillReward(event: GameEvent): void {
    // Use 'kill' event type (or 'custom' with kill data)
    if (event.type !== 'kill' && event.type !== 'custom') return;
    if (event.type === 'custom' && !event.data?.killType) return;

    const data = event.data as any;
    const killedSide = data.side || data.killedSide;
    const killerSide = data.killerSide;
    const unitType = (data.type || data.vehicleType || '').toLowerCase();

    // Determine reward amount based on unit type
    let reward = this.KILL_REWARDS.infantry; // Default
    if (unitType.includes('tank') || unitType.includes('t72') || unitType.includes('t80') || unitType.includes('abrams')) {
      reward = this.KILL_REWARDS.tank;
    } else if (unitType.includes('btr') || unitType.includes('bmp') || unitType.includes('stryker') || unitType.includes('apc')) {
      reward = this.KILL_REWARDS.apc;
    } else if (unitType.includes('heli') || unitType.includes('mi24') || unitType.includes('uh60') || unitType.includes('apache')) {
      reward = this.KILL_REWARDS.helicopter;
    } else if (unitType.includes('truck') || unitType.includes('ural') || unitType.includes('fmtv')) {
      reward = this.KILL_REWARDS.truck;
    } else if (unitType.includes('car') || unitType.includes('mrap') || unitType.includes('technical')) {
      reward = this.KILL_REWARDS.car;
    }

    // Award to the side that got the kill (opposite of killed side)
    if (killedSide === 'EAST' || killedSide === 'OPFOR') {
      // WEST killed an EAST unit
      this.westSpawnBudget = Math.min(this.MAX_BUDGET, this.westSpawnBudget + reward);
      logger.info('WEST earned kill reward', { reward, newBudget: this.westSpawnBudget, killedType: unitType });
    } else if (killedSide === 'WEST' || killedSide === 'BLUFOR') {
      // EAST killed a WEST unit
      this.eastSpawnBudget = Math.min(this.MAX_BUDGET, this.eastSpawnBudget + reward);
      logger.info('EAST earned kill reward', { reward, newBudget: this.eastSpawnBudget, killedType: unitType });
    }
  }

  /**
   * Check if SQF includes RTB pattern for partial refund
   */
  private hasRTBPattern(sqf: string): boolean {
    const sqfLower = sqf.toLowerCase();
    // Look for RTB patterns: waypoint back to base/airfield, land commands, etc.
    const rtbPatterns = [
      'wprth',           // RTB waypoint
      'land \'land\'',   // Land command
      'land \'get out\'',
      'landat',          // Land at helipad
      '_fobpos',         // Reference to FOB position (returning)
      '_airfieldpos',    // Reference to airfield (returning)
      'rtb',             // Explicit RTB reference
      'return to base',
    ];
    return rtbPatterns.some(pattern => sqfLower.includes(pattern));
  }

  /**
   * Check if SQF establishes FOB (sets LLMGM_eastFobPos or LLMGM_westFobPos)
   */
  private isFobEstablishment(sqf: string, side: 'EAST' | 'WEST'): boolean {
    const sqfLower = sqf.toLowerCase();
    const fobVarName = side === 'EAST' ? 'llmgm_eastfobpos' : 'llmgm_westfobpos';
    const fobZoneMarker = side === 'EAST' ? 'fob_east_zone' : 'fob_west_zone';

    // Check for FOB variable assignment
    const hasFobVar = sqfLower.includes(fobVarName);

    // Check for marker creation OR using predefined marker
    const hasMarker = sqfLower.includes('createmarker');
    const usesPredefinedMarker = sqfLower.includes(fobZoneMarker) ||
                                  sqfLower.includes('getmarkerpos');

    // Also accept FOB names/patterns
    const hasFobName = sqfLower.includes('fob crimson') ||
                       sqfLower.includes('fob liberty') ||
                       sqfLower.includes('fob_east') ||
                       sqfLower.includes('fob_west') ||
                       sqfLower.includes('fob established');

    // Has _fobPos variable (common pattern)
    const hasFobPosVar = sqfLower.includes('_fobpos');

    // Has FOB infrastructure (barracks, HQ, flag)
    const hasFobInfra = sqfLower.includes('land_cargo_hq') ||
                        sqfLower.includes('land_barracks') ||
                        sqfLower.includes('flag_') ||
                        sqfLower.includes('hbarrier');

    // LENIENT: Accept as FOB if:
    // 1. Uses predefined marker (fob_east_zone/fob_west_zone) OR
    // 2. Has the FOB variable (LLMGM_eastFobPos) OR
    // 3. Has FOB name in systemChat AND _fobPos variable AND infrastructure
    const isPredefinedMarkerFob = usesPredefinedMarker && (hasFobPosVar || hasFobVar);
    const isTraditionalFob = hasFobVar && (hasMarker || hasFobName);
    const isInfraBasedFob = hasFobName && hasFobPosVar && hasFobInfra;

    const isFob = isPredefinedMarkerFob || isTraditionalFob || isInfraBasedFob;

    if (isFob) {
      logger.info(`${side} FOB detection: marker=${usesPredefinedMarker}, var=${hasFobVar}, name=${hasFobName}, infra=${hasFobInfra}`);
    }

    return isFob;
  }

  /**
   * Mark FOB as established for a side
   */
  private markFobEstablished(side: 'EAST' | 'WEST'): void {
    if (side === 'EAST') {
      this.eastFobEstablished = true;
      logger.info('🏰 EAST FOB ESTABLISHED - OPFOR base is now operational!');
    } else {
      this.westFobEstablished = true;
      logger.info('🏰 WEST FOB ESTABLISHED - BLUFOR base is now operational!');
    }
  }

  /**
   * Check if side has established FOB
   */
  private hasFob(side: 'EAST' | 'WEST'): boolean {
    return side === 'EAST' ? this.eastFobEstablished : this.westFobEstablished;
  }

  /**
   * Extract group name from AI reasoning
   */
  private extractGroupName(reasoning: string): string | null {
    // Look for common patterns in AI reasoning
    const patterns = [
      /deploying?\s+(?:a\s+)?([^.!,]+(?:squad|team|patrol|group|platoon|section))/i,
      /spawn(?:ing)?\s+(?:a\s+)?([^.!,]+(?:squad|team|patrol|group|platoon|section))/i,
      /send(?:ing)?\s+(?:a\s+)?([^.!,]+(?:squad|team|patrol|group|platoon|section))/i,
      /([^.!,]+(?:squad|team|patrol|group))\s+to/i,
      /(\w+\s+(?:infantry|armor|recon|assault|fire))\s+/i,
    ];

    for (const pattern of patterns) {
      const match = reasoning.match(pattern);
      if (match) {
        return match[1].trim().substring(0, 30);
      }
    }

    return null;
  }

  /**
   * Format combat report details into human-readable string
   */
  private formatCombatReportDetails(report: any): string {
    switch (report.type) {
      case 'casualty':
        const killer = report.killerType ? ` by ${report.killerType}` : '';
        return `${report.unitType || 'Unit'} KIA${killer}. ${report.aliveInGroup}/${report.totalInGroup} remaining.`;
      case 'under_fire':
        return `Taking fire from ${report.enemyType || 'enemy'} at grid ${Math.round(report.enemyPos?.[0] || 0)}-${Math.round(report.enemyPos?.[1] || 0)}`;
      case 'contact':
        return `Enemy contact: ${report.enemyType || 'unknown'} spotted`;
      case 'objective_reached':
        return `Reached objective at grid ${Math.round(report.position?.[0] || 0)}-${Math.round(report.position?.[1] || 0)}`;
      default:
        return report.details || 'Unknown event';
    }
  }

  private formatCombatEventMessage(report: any, groupId: number): string {
    const side = report.side || 'UNKNOWN';
    switch (report.type) {
      case 'casualty':
        return `${side} casualty - ${report.unitType || 'soldier'} KIA`;
      case 'under_fire':
        return `${side} group ${groupId} under fire`;
      case 'contact':
        return `${side} contact - ${report.enemyType || 'enemy'} spotted`;
      case 'vehicle_destroyed':
        return `${side} vehicle destroyed - ${report.vehicleType || 'vehicle'}`;
      case 'objective_reached':
        return `${side} reached objective`;
      case 'spawn':
        return `${side} reinforcements deployed`;
      case 'rtb':
        return `${side} unit returning to base`;
      default:
        return `${side}: ${report.type || 'event'}`;
    }
  }

  /**
   * Estimate spawn cost from SQF code
   */
  private estimateSpawnCost(sqf: string): number {
    const sqfLower = sqf.toLowerCase();
    let cost = 0;

    // Count unit spawns
    const unitMatches = sqf.match(/createUnit/gi);
    if (unitMatches) cost += unitMatches.length * this.SPAWN_COSTS.infantry;

    // Check for vehicles
    if (sqfLower.includes('tank') || sqfLower.includes('t72') || sqfLower.includes('t80') || sqfLower.includes('abrams')) {
      cost += this.SPAWN_COSTS.tank;
    }
    if (sqfLower.includes('btr') || sqfLower.includes('bmp') || sqfLower.includes('stryker') || sqfLower.includes('bradley')) {
      cost += this.SPAWN_COSTS.apc;
    }
    if (sqfLower.includes('mi24') || sqfLower.includes('apache') || sqfLower.includes('ah64') || sqfLower.includes('hind')) {
      cost += this.SPAWN_COSTS.attack_heli;
    }
    if (sqfLower.includes('uh60') || sqfLower.includes('mi8') || sqfLower.includes('ch47')) {
      cost += this.SPAWN_COSTS.helicopter;
    }
    if (sqfLower.includes('c130') || sqfLower.includes('il76') || sqfLower.includes('paradrop') || sqfLower.includes('moveout')) {
      cost += this.SPAWN_COSTS.paradrop;
    }
    if (sqfLower.includes('technical') || sqfLower.includes('truck') || sqfLower.includes('mrap') || sqfLower.includes('m1025')) {
      cost += this.SPAWN_COSTS.light_vehicle;
    }

    return Math.max(cost, 5); // Minimum cost of 5
  }

  private async processGameState(gameState: GameState): Promise<void> {
    // DISABLED MODE: Skip all AI decisions, only process manual MCP commands
    if (this.aiMode === 'disabled') {
      return;
    }

    // AUTO-RECOVERY: Pause AI if game connection is stale/lost
    if (this.connectionState !== 'connected' && this.connectionState !== 'idle') {
      logger.debug(`AI paused - connection ${this.connectionState}, waiting for game state`);
      return;
    }

    // Process budget regeneration on each state update
    if (this.aiMode === 'dual') {
      this.processBudgetRegeneration(gameState);
    }

    if (this.aiMode === 'dual') {
      // DUAL MODE: Both commanders decide in parallel
      await this.processDualModeDecisions(gameState);
    } else {
      // SINGLE MODE: Original behavior
      await this.processSingleModeDecision(gameState);
    }
  }

  /**
   * DUAL MODE: Process decisions from both EAST and WEST commanders in parallel
   */
  private async processDualModeDecisions(gameState: GameState): Promise<void> {
    const config = configManager.getConfig();
    const now = Date.now();
    const history = gameStateManager.getHistory();

    const promises: Promise<void>[] = [];

    // EAST Commander decision
    if (this.eastClient?.isConfigured()) {
      const timeSinceEast = (now - this.lastEastActionTime) / 1000;
      if (timeSinceEast >= config.gm.minActionInterval) {
        promises.push(this.processSideDecision(this.eastClient, gameState, history, 'EAST', config));
      }
    }

    // WEST Commander decision
    if (this.westClient?.isConfigured()) {
      const timeSinceWest = (now - this.lastWestActionTime) / 1000;
      if (timeSinceWest >= config.gm.minActionInterval) {
        promises.push(this.processSideDecision(this.westClient, gameState, history, 'WEST', config));
      }
    }

    // Process both in parallel
    const results = await Promise.allSettled(promises);
    results.forEach((result, i) => {
      if (result.status === 'rejected') {
        logger.error('Commander decision failed', { error: result.reason });
      }
    });
  }

  /**
   * Process decision for a specific side (EAST or WEST)
   * Now with FOG OF WAR and RESOURCE LIMITS
   */
  private async processSideDecision(
    client: LLMClient,
    gameState: GameState,
    history: any,
    side: 'EAST' | 'WEST',
    config: any
  ): Promise<void> {
    try {
      // Apply Fog of War - each commander only sees their own forces clearly
      const filteredState = this.applyFogOfWar(gameState, side);

      // Check spawn budget
      const currentBudget = side === 'EAST' ? this.eastSpawnBudget : this.westSpawnBudget;
      if (currentBudget <= 0) {
        logger.warn(`${side} Commander: OUT OF RESOURCES! Budget depleted.`);
        // Could still allow narrative/command actions, but not spawns
      }

      // Add budget info to state for AI awareness
      (filteredState as any).spawnBudget = currentBudget;
      (filteredState as any).budgetWarning = currentBudget < 20 ? 'LOW RESOURCES - conserve forces!' : '';

      // Add FOB status - CRITICAL for AI to know it must establish FOB first!
      const fobEstablished = this.hasFob(side);
      (filteredState as any).fobEstablished = fobEstablished;
      (filteredState as any).fobWarning = !fobEstablished
        ? '⛔ FOB NOT ESTABLISHED! You MUST establish your FOB FIRST before any other actions!'
        : '✅ FOB operational - all units deploy from base';

      const decision = await client.getDecision(filteredState, history);

      logger.info(`${side} Commander decision received`, {
        action: decision.action,
        reasoning: decision.reasoning,
        budget: currentBudget
      });

      if (decision.action === 'wait') {
        logger.info(`${side} Commander decided to wait`);
        return;
      }

      let sqf = decision.parameters.sqf as string;
      if (!sqf) {
        logger.warn(`${side} Commander: No SQF code in decision`);
        return;
      }

      // ========== FOB ENFORCEMENT ==========
      // Force marker usage for FOB establishment (AI sometimes ignores instructions)
      sqf = sqfParser.forceMarkerUsage(sqf, side);

      // Spread out spawn positions to prevent unit stacking
      sqf = sqfParser.spreadSpawnPositions(sqf);

      // CRITICAL: Enforce all spawns happen at FOB - catches hardcoded positions
      sqf = sqfParser.enforceSpawnAtFOB(sqf, side);

      // CRITICAL: Ensure transport helicopters have troops loaded!
      sqf = sqfParser.ensureTransportHeliHasTroops(sqf, side);

      // Check transport usage and log warnings
      const transportWarning = sqfParser.checkTransportUsage(sqf, side);
      if (transportWarning) {
        logger.warn(transportWarning);
      }

      // Register group with unit tracker and inject combat tracking
      if (sqf.includes('createGroup') || sqf.includes('createUnit')) {
        const groupName = this.extractGroupName(decision.reasoning || '') || `${side} Squad`;
        const groupId = unitTracker.registerGroup(side, groupName, [], decision.action || 'spawn');
        // sqf = sqfParser.injectCombatTracking(sqf, side, groupId);
      }

      // Check if this is FOB establishment
      const isFobAction = this.isFobEstablishment(sqf, side);

      if (isFobAction) {
        // Mark FOB as established
        this.markFobEstablished(side);
        logger.info(`${side} FOB will use marker: fob_${side.toLowerCase()}_zone`);
      } else if (!this.hasFob(side)) {
        // FOB NOT ESTABLISHED - REJECT ALL NON-FOB ACTIONS!
        logger.warn(`⛔ ${side} Commander REJECTED: Must establish FOB first!`, {
          action: decision.action,
          reasoning: decision.reasoning
        });
        logger.warn(`${side} Commander tried to ${decision.action} without FOB - action blocked`);
        return; // HARD BLOCK - no spawning without FOB!
      }
      // =====================================

      // Estimate spawn cost
      const spawnCost = this.estimateSpawnCost(sqf);

      // Check if within budget (allow if budget is still positive)
      if (currentBudget > 0 && spawnCost > currentBudget) {
        logger.warn(`${side} Commander: Spawn cost ${spawnCost} exceeds budget ${currentBudget}`);
        // Still allow but deplete budget fully
      }

      // Try to validate, and auto-repair if needed
      let finalSqf = sqf;
      let validation = sqfValidator.validate(finalSqf);

      if (!validation.valid) {
        // Attempt auto-repair
        const repair = sqfValidator.repairSQF(finalSqf);
        if (repair.fixes.length > 0) {
          logger.info(`${side} Commander: Auto-repairing SQF`, { fixes: repair.fixes });
          finalSqf = repair.repaired;
          validation = sqfValidator.validate(finalSqf);
        }

        if (!validation.valid) {
          logger.error(`${side} Commander: Invalid SQF (even after repair)`, { errors: validation.errors });
          return;
        }
      }

      if (validation.warnings.length > 0) {
        logger.warn(`${side} Commander: SQF warnings`, { warnings: validation.warnings });
      }

      if (config.safety.dryRunMode) {
        logger.info(`DRY RUN - ${side} Commander would execute`, { sqf: finalSqf });
        return;
      }

      // Check for RTB pattern - gives partial refund for good logistics
      const hasRTB = this.hasRTBPattern(finalSqf);
      const rtbRefund = hasRTB ? Math.floor(spawnCost * this.RTB_REFUND_PERCENT) : 0;
      const netCost = spawnCost - rtbRefund;

      // Deduct from budget (net of RTB refund)
      if (side === 'EAST') {
        this.eastSpawnBudget = Math.max(0, this.eastSpawnBudget - netCost);
        logger.info(`EAST budget: ${this.eastSpawnBudget} remaining (spent ${netCost}, RTB refund: ${rtbRefund})`);
      } else {
        this.westSpawnBudget = Math.max(0, this.westSpawnBudget - netCost);
        logger.info(`WEST budget: ${this.westSpawnBudget} remaining (spent ${netCost}, RTB refund: ${rtbRefund})`);
      }

      // Queue to appropriate side's queue
      const actionData = {
        sqf: finalSqf,
        metadata: {
          action: decision.action,
          reasoning: decision.reasoning,
          side,
          spawnCost,
          budgetRemaining: side === 'EAST' ? this.eastSpawnBudget : this.westSpawnBudget,
          timestamp: Date.now()
        }
      };

      if (side === 'EAST') {
        this.eastActionQueue.push(actionData);
        this.lastEastActionTime = Date.now();
        logger.info('EAST action queued', { queueLength: this.eastActionQueue.length, budget: this.eastSpawnBudget });
      } else {
        this.westActionQueue.push(actionData);
        this.lastWestActionTime = Date.now();
        logger.info('WEST action queued', { queueLength: this.westActionQueue.length, budget: this.westSpawnBudget });
      }

    } catch (error) {
      logger.error(`${side} Commander error`, { error });
    }
  }

  /**
   * SINGLE MODE: Original single-AI behavior
   */
  private async processSingleModeDecision(gameState: GameState): Promise<void> {
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

      // Validate SQF with auto-repair
      let finalSqf = sqf;
      let validation = sqfValidator.validate(finalSqf);

      if (!validation.valid) {
        // Attempt auto-repair
        const repair = sqfValidator.repairSQF(finalSqf);
        if (repair.fixes.length > 0) {
          logger.info('Auto-repairing SQF', { fixes: repair.fixes });
          finalSqf = repair.repaired;
          validation = sqfValidator.validate(finalSqf);
        }

        if (!validation.valid) {
          logger.error('Invalid SQF code generated (even after repair)', {
            errors: validation.errors,
            warnings: validation.warnings
          });
          return;
        }
      }

      if (validation.warnings.length > 0) {
        logger.warn('SQF validation warnings', { warnings: validation.warnings });
      }

      // Check dry run mode
      if (config.safety.dryRunMode) {
        logger.info('DRY RUN - Would execute SQF', { sqf: finalSqf });
        return;
      }

      // Queue action for execution
      this.actionQueue.push({
        sqf: finalSqf,
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
   * Connection Health Monitor - detects game disconnection and pauses AI
   * Runs every 15 seconds to check if game state is still being received
   */
  private startConnectionMonitor(): void {
    this.connectionCheckInterval = setInterval(() => {
      if (this.lastStateReceivedTime === 0) {
        // No state ever received - still in idle
        return;
      }

      const timeSinceLastState = Date.now() - this.lastStateReceivedTime;
      const prevState = this.connectionState;

      if (timeSinceLastState >= this.STATE_LOST_TIMEOUT_MS) {
        this.connectionState = 'lost';
        if (prevState !== 'lost') {
          logger.error(`🔴 Game connection LOST (${Math.round(timeSinceLastState / 1000)}s) - AI PAUSED`);
          logger.warn('Game may have crashed or closed. Waiting for reconnection...');
        }
      } else if (timeSinceLastState >= this.STATE_STALE_TIMEOUT_MS) {
        this.connectionState = 'stale';
        if (prevState === 'connected') {
          logger.warn(`🟡 Game connection STALE (${Math.round(timeSinceLastState / 1000)}s) - AI paused until state received`);
        }
      }
      // 'connected' state is set in POST /api/state handler when state is received

    }, 15000); // Check every 15 seconds
  }

  private stopConnectionMonitor(): void {
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
      this.connectionCheckInterval = null;
    }
  }

  private setupWebSocket(): void {
    if (!this.httpServer) return;

    this.wss = new WebSocketServer({ server: this.httpServer });

    // Heartbeat interval - ping all clients every 30 seconds
    const heartbeatInterval = setInterval(() => {
      this.wss?.clients.forEach((ws) => {
        if ((ws as any).isAlive === false) {
          logger.warn('WebSocket client not responding to ping, terminating');
          return ws.terminate();
        }
        (ws as any).isAlive = false;
        ws.ping();
      });
    }, 30000);

    this.wss.on('close', () => {
      clearInterval(heartbeatInterval);
    });

    this.wss.on('connection', (ws: WebSocket) => {
      logger.info('WebSocket client connected');

      // Set up heartbeat tracking
      (ws as any).isAlive = true;
      ws.on('pong', () => {
        (ws as any).isAlive = true;
      });

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

      // Handle WebSocket errors to prevent crashes
      ws.on('error', (error) => {
        logger.error('WebSocket error occurred', { error: error.message });
        try {
          ws.terminate();
        } catch (e) {
          // Already closed, ignore
        }
      });
    });

    // Handle WebSocket server-level errors
    this.wss.on('error', (error) => {
      logger.error('WebSocket server error', { error: error.message });
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

    // Start connection health monitor for auto-recovery
    this.startConnectionMonitor();
  }

  stop(): void {
    this.stopConnectionMonitor();
    if (this.wss) {
      this.wss.close();
    }
    if (this.httpServer) {
      this.httpServer.close();
    }
    logger.info('Bridge server stopped');
  }
}
