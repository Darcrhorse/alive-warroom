/**
 * Chat Interface - Interactive mode handler for processing natural language commands
 *
 * Processes player chat requests (CAS, artillery, reinforcements, intel) and
 * generates commander responses with reasoning. Used in interactive mode where
 * the player communicates with an allied AI commander.
 */

import {
  GameState,
  Position,
  GMDecision,
  CommanderObjective,
  IntelReport,
  ThreatMatrix
} from '../game-state/types';
import { BaseCommander, CommanderConfig } from './commander-core';
import { ResourceManager, UnitType } from './resources';
import { ObjectiveManager } from './objectives';
import { DecisionResult, DecisionContext } from './decisions';
import { logger } from '../utils/logger';

/**
 * Types of requests the commander can process
 */
export type RequestType =
  | 'cas'           // Close Air Support
  | 'artillery'     // Artillery/mortar fire
  | 'reinforcements'// Infantry/vehicle reinforcements
  | 'intel'         // Intelligence request
  | 'extraction'    // Request extraction
  | 'resupply'      // Ammo/fuel resupply
  | 'sitrep'        // Situation report
  | 'unknown';      // Unrecognized request

/**
 * Parsed request from player message
 */
export interface ParsedRequest {
  type: RequestType;
  targetPosition: Position | null;
  urgency: 'immediate' | 'soon' | 'whenever';
  details: string;
  originalMessage: string;
  confidence: number; // 0-1 how confident we are in the parsing
}

/**
 * Response from the chat interface
 */
export interface ChatResponse {
  message: string;           // Natural language response to player
  reasoning: string;         // Internal reasoning for the decision
  action: GMDecision | null; // Action to queue, if any
  sqfCode: string | null;    // SQF code to execute, if any
  success: boolean;          // Whether the request can be fulfilled
  requestType: RequestType;  // The parsed request type
  estimatedTime?: number;    // Estimated time in seconds until completion
}

/**
 * Context for a chat request
 */
export interface ChatContext {
  playerName: string;
  playerPosition: Position;
  message: string;
  gameState?: GameState;
  threatAssessment?: ThreatMatrix;
  knownEnemyPositions?: IntelReport[];
}

/**
 * Request patterns for natural language parsing
 */
const REQUEST_PATTERNS: Record<RequestType, RegExp[]> = {
  cas: [
    /\b(cas|close air support|air strike|air support|airstrike)\b/i,
    /\brequest(?:ing)?\s+(?:air|cas)\b/i,
    /\b(bomb|strafe|attack run)\s+(?:on|at|the)\b/i,
    /\bneed(?:s?)?\s+air\b/i
  ],
  artillery: [
    /\b(artillery|arty|mortar|fire mission|fire support|howitzer)\b/i,
    /\brequest(?:ing)?\s+(?:artillery|fire|mortar)\b/i,
    /\b(shell|bombard|barrage)\s+(?:on|at|the)\b/i,
    /\bneed(?:s?)?\s+(?:artillery|fire support)\b/i
  ],
  reinforcements: [
    /\b(reinforcement|reinforce|backup|support troops|additional troops)\b/i,
    /\brequest(?:ing)?\s+(?:reinforcement|backup|support)\b/i,
    /\bneed(?:s?)?\s+(?:reinforcement|backup|troops|men|soldiers)\b/i,
    /\bsend(?:ing)?\s+(?:troops|men|soldiers|squad|team)\b/i
  ],
  intel: [
    /\b(intel|intelligence|recon|reconnaissance|scout)\b/i,
    /\brequest(?:ing)?\s+(?:intel|information|reconnaissance)\b/i,
    /\bwhat(?:'s|\s+is)\s+(?:the\s+)?(?:enemy|hostile|situation)\b/i,
    /\b(enemy\s+)?position(?:s)?\b/i,
    /\bwhere\s+(?:are|is)\s+(?:the\s+)?enem(?:y|ies)\b/i
  ],
  extraction: [
    /\b(extract|extraction|exfil|pickup|evac|evacuation)\b/i,
    /\brequest(?:ing)?\s+(?:extract|evac|pickup)\b/i,
    /\bneed(?:s?)?\s+(?:extraction|evac|pickup)\b/i,
    /\bget\s+(?:us|me)\s+out\b/i
  ],
  resupply: [
    /\b(resupply|supply|ammo|ammunition|fuel)\b/i,
    /\brequest(?:ing)?\s+(?:resupply|supplies|ammo)\b/i,
    /\bneed(?:s?)?\s+(?:ammo|ammunition|supplies|resupply)\b/i,
    /\brun(?:ning)?\s+(?:low|out)\s+(?:on|of)\b/i
  ],
  sitrep: [
    /\b(sitrep|situation report|status|status report)\b/i,
    /\brequest(?:ing)?\s+(?:sitrep|status)\b/i,
    /\bwhat(?:'s|\s+is)\s+(?:the\s+)?(?:situation|status)\b/i,
    /\bhow\s+(?:are|is)\s+(?:we|things|it)\s+(?:doing|going|looking)\b/i
  ],
  unknown: []
};

/**
 * Position extraction patterns
 */
const POSITION_PATTERNS = {
  gridRef: /\bgrid\s*(?:ref(?:erence)?)?[\s:]*(\d{4,8})/i,
  coordinates: /\b(\d{3,5})[,\s]+(\d{3,5})\b/,
  relativeDir: /\b(\d+)\s*(?:m|meters?)\s+(north|south|east|west|ne|nw|se|sw)\b/i,
  myPosition: /\b(?:my\s+position|here|current\s+location|on\s+me)\b/i,
  namedLocation: /\b(?:at|on|near)\s+(?:the\s+)?([a-z]+(?:\s+[a-z]+)?)\b/i
};

/**
 * Urgency patterns
 */
const URGENCY_PATTERNS = {
  immediate: /\b(immediate|immediately|now|asap|urgent|emergency|critical|danger close)\b/i,
  soon: /\b(soon|quickly|fast|hurry|priority)\b/i
};

/**
 * Unit costs for chat-initiated actions (in ammo/fuel percentages)
 */
const CHAT_ACTION_COSTS: Record<RequestType, { ammo: number; fuel: number }> = {
  cas: { ammo: 15, fuel: 20 },
  artillery: { ammo: 20, fuel: 5 },
  reinforcements: { ammo: 5, fuel: 10 },
  intel: { ammo: 0, fuel: 5 },
  extraction: { ammo: 0, fuel: 15 },
  resupply: { ammo: 0, fuel: 10 },
  sitrep: { ammo: 0, fuel: 0 },
  unknown: { ammo: 0, fuel: 0 }
};

/**
 * ChatInterface - Processes player chat commands for interactive commander mode
 *
 * Features:
 * - Natural language parsing for military requests
 * - Position extraction from grid refs, coordinates, or relative directions
 * - Resource checking before fulfilling requests
 * - Human-like commander responses with military terminology
 * - SQF code generation for executable actions
 */
export class ChatInterface {
  private side: 'EAST' | 'WEST';
  private commanderCallsign: string;
  private resourceManager: ResourceManager | null = null;
  private objectiveManager: ObjectiveManager | null = null;
  private lastRequestTime: number = 0;
  private requestCooldown: number = 15000; // 15 seconds between requests
  private conversationHistory: Array<{ role: 'player' | 'commander'; message: string; timestamp: number }> = [];
  private maxHistoryLength: number = 20;

  constructor(
    side: 'EAST' | 'WEST',
    options?: {
      commanderCallsign?: string;
      requestCooldown?: number;
      resourceManager?: ResourceManager;
      objectiveManager?: ObjectiveManager;
    }
  ) {
    this.side = side;
    this.commanderCallsign = options?.commanderCallsign ?? (side === 'WEST' ? 'Overlord' : 'Warlord');
    this.requestCooldown = options?.requestCooldown ?? 15000;
    this.resourceManager = options?.resourceManager ?? null;
    this.objectiveManager = options?.objectiveManager ?? null;

    logger.info('ChatInterface initialized', {
      side,
      callsign: this.commanderCallsign,
      cooldown: this.requestCooldown
    });
  }

  /**
   * Process a chat message from a player
   */
  async processMessage(context: ChatContext): Promise<ChatResponse> {
    const { playerName, playerPosition, message } = context;

    // Add to conversation history
    this.addToHistory('player', message);

    // Check cooldown
    const now = Date.now();
    if (now - this.lastRequestTime < this.requestCooldown) {
      const remaining = Math.ceil((this.requestCooldown - (now - this.lastRequestTime)) / 1000);
      const response = this.createDenialResponse(
        `${playerName}, standby. Processing previous request. Try again in ${remaining} seconds.`,
        'Request cooldown active',
        'unknown'
      );
      this.addToHistory('commander', response.message);
      return response;
    }

    // Parse the request
    const parsedRequest = this.parseRequest(message, playerPosition);

    logger.info('Chat request parsed', {
      side: this.side,
      playerName,
      requestType: parsedRequest.type,
      confidence: parsedRequest.confidence
    });

    // Handle unknown requests
    if (parsedRequest.type === 'unknown' || parsedRequest.confidence < 0.3) {
      const response = this.createClarificationResponse(playerName, message);
      this.addToHistory('commander', response.message);
      return response;
    }

    // Process based on request type
    let response: ChatResponse;
    switch (parsedRequest.type) {
      case 'cas':
        response = await this.handleCASRequest(parsedRequest, context);
        break;
      case 'artillery':
        response = await this.handleArtilleryRequest(parsedRequest, context);
        break;
      case 'reinforcements':
        response = await this.handleReinforcementsRequest(parsedRequest, context);
        break;
      case 'intel':
        response = await this.handleIntelRequest(parsedRequest, context);
        break;
      case 'extraction':
        response = await this.handleExtractionRequest(parsedRequest, context);
        break;
      case 'resupply':
        response = await this.handleResupplyRequest(parsedRequest, context);
        break;
      case 'sitrep':
        response = await this.handleSitrepRequest(parsedRequest, context);
        break;
      default:
        response = this.createClarificationResponse(playerName, message);
    }

    // Update request time if successful
    if (response.success) {
      this.lastRequestTime = now;
    }

    // Add response to history
    this.addToHistory('commander', response.message);

    return response;
  }

  /**
   * Parse a player message into a structured request
   */
  parseRequest(message: string, playerPosition: Position): ParsedRequest {
    // Determine request type
    let requestType: RequestType = 'unknown';
    let highestConfidence = 0;

    for (const [type, patterns] of Object.entries(REQUEST_PATTERNS)) {
      if (type === 'unknown') continue;

      for (const pattern of patterns) {
        if (pattern.test(message)) {
          const confidence = this.calculatePatternConfidence(message, pattern);
          if (confidence > highestConfidence) {
            highestConfidence = confidence;
            requestType = type as RequestType;
          }
        }
      }
    }

    // Extract target position
    const targetPosition = this.extractPosition(message, playerPosition);

    // Determine urgency
    const urgency = this.extractUrgency(message);

    // Extract additional details
    const details = this.extractDetails(message, requestType);

    return {
      type: requestType,
      targetPosition,
      urgency,
      details,
      originalMessage: message,
      confidence: highestConfidence
    };
  }

  /**
   * Handle CAS (Close Air Support) request
   */
  private async handleCASRequest(
    request: ParsedRequest,
    context: ChatContext
  ): Promise<ChatResponse> {
    const { playerName, playerPosition } = context;
    const targetPos = request.targetPosition ?? playerPosition;
    const costs = CHAT_ACTION_COSTS.cas;

    // Check resources
    if (this.resourceManager && !this.canAffordAction(costs)) {
      return this.createDenialResponse(
        `${playerName}, negative on CAS. Air assets are unavailable at this time. ` +
        `We're working on getting more aircraft operational.`,
        'Insufficient resources for CAS',
        'cas'
      );
    }

    // Consume resources
    this.consumeActionResources(costs);

    // Generate SQF for CAS
    const sqfCode = this.generateCASSQF(targetPos, request.urgency);

    const responseMsg = this.generateCASResponse(playerName, request, targetPos);

    logger.info('CAS request approved', {
      side: this.side,
      playerName,
      target: targetPos,
      urgency: request.urgency
    });

    return {
      message: responseMsg,
      reasoning: `CAS requested at ${targetPos.x.toFixed(0)}, ${targetPos.y.toFixed(0)} with ${request.urgency} urgency`,
      action: {
        action: 'spawn',
        reasoning: `CAS request from ${playerName}`,
        urgency: request.urgency,
        parameters: { sqf: sqfCode, type: 'cas', targetPosition: targetPos }
      },
      sqfCode,
      success: true,
      requestType: 'cas',
      estimatedTime: request.urgency === 'immediate' ? 30 : 60
    };
  }

  /**
   * Handle artillery request
   */
  private async handleArtilleryRequest(
    request: ParsedRequest,
    context: ChatContext
  ): Promise<ChatResponse> {
    const { playerName, playerPosition } = context;
    const targetPos = request.targetPosition ?? playerPosition;
    const costs = CHAT_ACTION_COSTS.artillery;

    // Safety check - don't fire too close to friendlies
    const distanceToPlayer = this.calculateDistance(targetPos, playerPosition);
    if (distanceToPlayer < 100) {
      return this.createDenialResponse(
        `${playerName}, negative on fire mission. Target is danger close to friendly positions. ` +
        `Adjust target coordinates and resubmit.`,
        'Target too close to friendly position',
        'artillery'
      );
    }

    // Check resources
    if (this.resourceManager && !this.canAffordAction(costs)) {
      return this.createDenialResponse(
        `${playerName}, negative on artillery. Fire support is currently unavailable. ` +
        `Ammunition reserves are critically low.`,
        'Insufficient resources for artillery',
        'artillery'
      );
    }

    // Consume resources
    this.consumeActionResources(costs);

    // Generate SQF for artillery
    const sqfCode = this.generateArtillerySQF(targetPos, request.urgency);

    const responseMsg = this.generateArtilleryResponse(playerName, request, targetPos, distanceToPlayer);

    logger.info('Artillery request approved', {
      side: this.side,
      playerName,
      target: targetPos,
      distanceToFriendly: distanceToPlayer.toFixed(0)
    });

    return {
      message: responseMsg,
      reasoning: `Artillery fire mission at ${targetPos.x.toFixed(0)}, ${targetPos.y.toFixed(0)}`,
      action: {
        action: 'spawn',
        reasoning: `Artillery request from ${playerName}`,
        urgency: request.urgency,
        parameters: { sqf: sqfCode, type: 'artillery', targetPosition: targetPos }
      },
      sqfCode,
      success: true,
      requestType: 'artillery',
      estimatedTime: request.urgency === 'immediate' ? 15 : 30
    };
  }

  /**
   * Handle reinforcements request
   */
  private async handleReinforcementsRequest(
    request: ParsedRequest,
    context: ChatContext
  ): Promise<ChatResponse> {
    const { playerName, playerPosition } = context;
    const targetPos = request.targetPosition ?? this.calculateSafeSpawnPosition(playerPosition);
    const costs = CHAT_ACTION_COSTS.reinforcements;

    // Check if we can spawn infantry
    const unitType: UnitType = 'infantrySquads';
    if (this.resourceManager && !this.resourceManager.canSpawn(unitType, 1)) {
      return this.createDenialResponse(
        `${playerName}, negative on reinforcements. No reserves available at this time. ` +
        `All available units are currently deployed.`,
        'No reinforcements available',
        'reinforcements'
      );
    }

    // Check resources
    if (this.resourceManager && !this.canAffordAction(costs)) {
      return this.createDenialResponse(
        `${playerName}, negative on reinforcements. Logistical constraints prevent deployment. ` +
        `Stand by for resource replenishment.`,
        'Insufficient resources for reinforcements',
        'reinforcements'
      );
    }

    // Consume resources
    this.consumeActionResources(costs);
    if (this.resourceManager) {
      this.resourceManager.consumeForSpawn(unitType, 1);
    }

    // Generate SQF for reinforcements
    const sqfCode = this.generateReinforcementsSQF(targetPos, playerPosition);

    const responseMsg = this.generateReinforcementsResponse(playerName, request, targetPos);

    logger.info('Reinforcements request approved', {
      side: this.side,
      playerName,
      spawnPosition: targetPos
    });

    return {
      message: responseMsg,
      reasoning: `Reinforcements spawned at ${targetPos.x.toFixed(0)}, ${targetPos.y.toFixed(0)}`,
      action: {
        action: 'spawn',
        reasoning: `Reinforcements request from ${playerName}`,
        urgency: request.urgency,
        parameters: { sqf: sqfCode, type: 'reinforcements', spawnPosition: targetPos }
      },
      sqfCode,
      success: true,
      requestType: 'reinforcements',
      estimatedTime: 45
    };
  }

  /**
   * Handle intel request
   */
  private async handleIntelRequest(
    request: ParsedRequest,
    context: ChatContext
  ): Promise<ChatResponse> {
    const { playerName, playerPosition, knownEnemyPositions, threatAssessment } = context;

    // Generate intel report
    const intelReport = this.generateIntelReport(
      playerPosition,
      knownEnemyPositions ?? [],
      threatAssessment
    );

    logger.info('Intel request processed', {
      side: this.side,
      playerName,
      enemyContacts: knownEnemyPositions?.length ?? 0
    });

    return {
      message: intelReport,
      reasoning: 'Intel report generated from known enemy positions',
      action: null,
      sqfCode: null,
      success: true,
      requestType: 'intel'
    };
  }

  /**
   * Handle extraction request
   */
  private async handleExtractionRequest(
    request: ParsedRequest,
    context: ChatContext
  ): Promise<ChatResponse> {
    const { playerName, playerPosition } = context;
    const extractPos = request.targetPosition ?? playerPosition;
    const costs = CHAT_ACTION_COSTS.extraction;

    // Check resources
    if (this.resourceManager && !this.canAffordAction(costs)) {
      return this.createDenialResponse(
        `${playerName}, extraction assets are currently unavailable. ` +
        `Recommend you move to a safer position and stand by.`,
        'Insufficient resources for extraction',
        'extraction'
      );
    }

    // Consume resources
    this.consumeActionResources(costs);

    // Generate SQF for extraction helicopter
    const sqfCode = this.generateExtractionSQF(extractPos);

    const responseMsg = `${playerName}, this is ${this.commanderCallsign}. Extraction approved. ` +
      `Helo is inbound to your position. ETA 2 minutes. Pop smoke when you hear rotors. ` +
      `Confirm LZ is secure.`;

    logger.info('Extraction request approved', {
      side: this.side,
      playerName,
      extractPosition: extractPos
    });

    return {
      message: responseMsg,
      reasoning: `Extraction helicopter dispatched to ${extractPos.x.toFixed(0)}, ${extractPos.y.toFixed(0)}`,
      action: {
        action: 'extract',
        reasoning: `Extraction request from ${playerName}`,
        urgency: request.urgency,
        parameters: { sqf: sqfCode, type: 'extraction', extractPosition: extractPos }
      },
      sqfCode,
      success: true,
      requestType: 'extraction',
      estimatedTime: 120
    };
  }

  /**
   * Handle resupply request
   */
  private async handleResupplyRequest(
    request: ParsedRequest,
    context: ChatContext
  ): Promise<ChatResponse> {
    const { playerName, playerPosition } = context;
    const dropPos = request.targetPosition ?? playerPosition;
    const costs = CHAT_ACTION_COSTS.resupply;

    // Check resources
    if (this.resourceManager && !this.canAffordAction(costs)) {
      return this.createDenialResponse(
        `${playerName}, supply operations are currently halted. ` +
        `Logistics network is strained. Conserve ammunition and await resupply window.`,
        'Insufficient resources for resupply',
        'resupply'
      );
    }

    // Consume resources
    this.consumeActionResources(costs);

    // Generate SQF for supply drop
    const sqfCode = this.generateResupplySQF(dropPos);

    const responseMsg = `${playerName}, this is ${this.commanderCallsign}. Resupply approved. ` +
      `Supply crate inbound to your position. Mark your location with smoke. ` +
      `Contents: ammunition and medical supplies.`;

    logger.info('Resupply request approved', {
      side: this.side,
      playerName,
      dropPosition: dropPos
    });

    return {
      message: responseMsg,
      reasoning: `Supply drop at ${dropPos.x.toFixed(0)}, ${dropPos.y.toFixed(0)}`,
      action: {
        action: 'spawn',
        reasoning: `Resupply request from ${playerName}`,
        urgency: request.urgency,
        parameters: { sqf: sqfCode, type: 'resupply', dropPosition: dropPos }
      },
      sqfCode,
      success: true,
      requestType: 'resupply',
      estimatedTime: 60
    };
  }

  /**
   * Handle sitrep request
   */
  private async handleSitrepRequest(
    request: ParsedRequest,
    context: ChatContext
  ): Promise<ChatResponse> {
    const { playerName, gameState, threatAssessment } = context;

    // Generate situation report
    const sitrep = this.generateSitrepReport(gameState, threatAssessment);

    logger.info('Sitrep request processed', {
      side: this.side,
      playerName
    });

    return {
      message: sitrep,
      reasoning: 'Situation report generated',
      action: null,
      sqfCode: null,
      success: true,
      requestType: 'sitrep'
    };
  }

  // ============================================================================
  // SQF Code Generation - All strings use SINGLE QUOTES
  // ============================================================================

  /**
   * Generate SQF for CAS strike
   */
  private generateCASSQF(targetPos: Position, urgency: string): string {
    const aircraftClass = this.side === 'WEST'
      ? 'B_Plane_CAS_01_dynamicLoadout_F'
      : 'O_Plane_CAS_02_dynamicLoadout_F';

    const spawnAltitude = 500;
    const approachDistance = 2000;
    const angle = Math.random() * Math.PI * 2;
    const spawnX = targetPos.x + Math.cos(angle) * approachDistance;
    const spawnY = targetPos.y + Math.sin(angle) * approachDistance;

    return `
// Chat Interface: CAS Strike Request
// Target: [${targetPos.x.toFixed(1)}, ${targetPos.y.toFixed(1)}]
// Urgency: ${urgency}
private _targetPos = [${targetPos.x.toFixed(1)}, ${targetPos.y.toFixed(1)}, 0];
private _spawnPos = [${spawnX.toFixed(1)}, ${spawnY.toFixed(1)}, ${spawnAltitude}];

// Spawn CAS aircraft
private _aircraft = createVehicle ['${aircraftClass}', _spawnPos, [], 0, 'FLY'];
private _group = createVehicleCrew _aircraft;

// Set up for attack run
{
  _x setSkill 0.8;
} forEach units _group;

_group setBehaviour 'COMBAT';
_group setCombatMode 'RED';

// Add attack waypoints
private _wp1 = _group addWaypoint [_targetPos, 0];
_wp1 setWaypointType 'SAD';
_wp1 setWaypointBehaviour 'COMBAT';
_wp1 setWaypointCombatMode 'RED';

// RTB waypoint
private _wp2 = _group addWaypoint [_spawnPos, 0];
_wp2 setWaypointType 'MOVE';

// Store reference
missionNamespace setVariable ['LLMGM_CAS_${this.side}', _aircraft];
diag_log format ['[LLMGM] CAS aircraft spawned for %1 strike on %2', '${this.side}', _targetPos];

_aircraft
`.trim();
  }

  /**
   * Generate SQF for artillery strike
   */
  private generateArtillerySQF(targetPos: Position, urgency: string): string {
    const rounds = urgency === 'immediate' ? 6 : 4;
    const spread = 30;

    return `
// Chat Interface: Artillery Fire Mission
// Target: [${targetPos.x.toFixed(1)}, ${targetPos.y.toFixed(1)}]
// Urgency: ${urgency}
// Rounds: ${rounds}
private _targetPos = [${targetPos.x.toFixed(1)}, ${targetPos.y.toFixed(1)}, 0];
private _spread = ${spread};
private _rounds = ${rounds};

// Create artillery strike
for '_i' from 1 to _rounds do {
  private _impactPos = [
    (_targetPos select 0) + (random _spread) - (_spread / 2),
    (_targetPos select 1) + (random _spread) - (_spread / 2),
    0
  ];

  // Delayed impacts for realism
  [_impactPos, _i] spawn {
    params ['_pos', '_delay'];
    sleep (_delay * 0.5);

    // Create explosion effect
    private _shell = createVehicle ['Sh_155mm_AMOS', _pos, [], 0, 'CAN_COLLIDE'];
    _shell setVelocity [0, 0, -100];
  };
};

// Log fire mission
diag_log format ['[LLMGM] Artillery fire mission: %1 rounds on %2', _rounds, _targetPos];

true
`.trim();
  }

  /**
   * Generate SQF for infantry reinforcements
   */
  private generateReinforcementsSQF(spawnPos: Position, playerPos: Position): string {
    const unitClasses = this.side === 'WEST'
      ? ['B_Soldier_SL_F', 'B_Soldier_F', 'B_Soldier_AR_F', 'B_medic_F']
      : ['O_Soldier_SL_F', 'O_Soldier_F', 'O_Soldier_AR_F', 'O_medic_F'];
    const sideStr = this.side;
    const unitTypesStr = unitClasses.map(c => `'${c}'`).join(', ');

    return `
// Chat Interface: Infantry Reinforcements
// Spawn: [${spawnPos.x.toFixed(1)}, ${spawnPos.y.toFixed(1)}]
// Rally: [${playerPos.x.toFixed(1)}, ${playerPos.y.toFixed(1)}]
private _spawnPos = [${spawnPos.x.toFixed(1)}, ${spawnPos.y.toFixed(1)}, 0];
private _rallyPos = [${playerPos.x.toFixed(1)}, ${playerPos.y.toFixed(1)}, 0];
private _unitTypes = [${unitTypesStr}];

// Create reinforcement group
private _group = createGroup ${sideStr};

{
  private _unit = _group createUnit [_x, _spawnPos, [], 5, 'FORM'];
  _unit setSkill 0.6;
} forEach _unitTypes;

// Set group behavior
_group setBehaviour 'AWARE';
_group setCombatMode 'YELLOW';
_group setSpeedMode 'FULL';

// Move to rally point (player position)
private _wp = _group addWaypoint [_rallyPos, 20];
_wp setWaypointType 'MOVE';
_wp setWaypointBehaviour 'AWARE';
_wp setWaypointCombatMode 'YELLOW';

// Add join waypoint to link up with players
private _wp2 = _group addWaypoint [_rallyPos, 10];
_wp2 setWaypointType 'HOLD';

// Store reference
missionNamespace setVariable ['LLMGM_Reinforcements_${this.side}', _group];
diag_log format ['[LLMGM] Reinforcements spawned at %1, rallying to %2', _spawnPos, _rallyPos];

_group
`.trim();
  }

  /**
   * Generate SQF for extraction helicopter
   */
  private generateExtractionSQF(extractPos: Position): string {
    const heliClass = this.side === 'WEST'
      ? 'B_Heli_Transport_01_F'
      : 'O_Heli_Transport_04_covered_F';
    const sideStr = this.side;

    const spawnDistance = 2000;
    const angle = Math.random() * Math.PI * 2;
    const spawnX = extractPos.x + Math.cos(angle) * spawnDistance;
    const spawnY = extractPos.y + Math.sin(angle) * spawnDistance;

    return `
// Chat Interface: Extraction Helicopter
// LZ: [${extractPos.x.toFixed(1)}, ${extractPos.y.toFixed(1)}]
private _lzPos = [${extractPos.x.toFixed(1)}, ${extractPos.y.toFixed(1)}, 0];
private _spawnPos = [${spawnX.toFixed(1)}, ${spawnY.toFixed(1)}, 100];

// Spawn extraction helo
private _heli = createVehicle ['${heliClass}', _spawnPos, [], 0, 'FLY'];
private _group = createVehicleCrew _heli;

{
  _x setSkill 0.7;
} forEach units _group;

_group setBehaviour 'CARELESS';
_group setCombatMode 'BLUE';
_group setSpeedMode 'FULL';

// Fly to LZ
private _wp = _group addWaypoint [_lzPos, 0];
_wp setWaypointType 'TR UNLOAD';
_wp setWaypointBehaviour 'CARELESS';

// Wait at LZ
private _wp2 = _group addWaypoint [_lzPos, 0];
_wp2 setWaypointType 'HOLD';
_wp2 setWaypointTimeout [30, 45, 60];

// RTB
private _wp3 = _group addWaypoint [_spawnPos, 0];
_wp3 setWaypointType 'MOVE';

// Store reference
missionNamespace setVariable ['LLMGM_Extraction_${this.side}', _heli];
diag_log format ['[LLMGM] Extraction helo dispatched to %1', _lzPos];

_heli
`.trim();
  }

  /**
   * Generate SQF for supply drop
   */
  private generateResupplySQF(dropPos: Position): string {
    return `
// Chat Interface: Supply Drop
// Drop zone: [${dropPos.x.toFixed(1)}, ${dropPos.y.toFixed(1)}]
private _dropPos = [${dropPos.x.toFixed(1)}, ${dropPos.y.toFixed(1)}, 0];

// Create supply crate
private _crate = createVehicle ['B_supplyCrate_F', _dropPos, [], 0, 'NONE'];

// Fill with supplies
clearWeaponCargoGlobal _crate;
clearMagazineCargoGlobal _crate;
clearItemCargoGlobal _crate;
clearBackpackCargoGlobal _crate;

// Add ammunition
_crate addMagazineCargoGlobal ['30Rnd_65x39_caseless_mag', 20];
_crate addMagazineCargoGlobal ['30Rnd_556x45_Stanag', 20];
_crate addMagazineCargoGlobal ['200Rnd_65x39_cased_Box', 5];
_crate addMagazineCargoGlobal ['HandGrenade', 10];
_crate addMagazineCargoGlobal ['SmokeShell', 10];

// Add medical supplies
_crate addItemCargoGlobal ['FirstAidKit', 20];
_crate addItemCargoGlobal ['Medikit', 2];

// Visual marker
private _smoke = createVehicle ['SmokeShellGreen', _dropPos, [], 0, 'CAN_COLLIDE'];

// Store reference
missionNamespace setVariable ['LLMGM_Supply_${this.side}', _crate];
diag_log format ['[LLMGM] Supply crate dropped at %1', _dropPos];

_crate
`.trim();
  }

  // ============================================================================
  // Response Generation
  // ============================================================================

  /**
   * Generate CAS response message
   */
  private generateCASResponse(
    playerName: string,
    request: ParsedRequest,
    targetPos: Position
  ): string {
    const urgencyText = request.urgency === 'immediate'
      ? 'Fast movers inbound.'
      : 'Aircraft is being scrambled.';

    return `${playerName}, this is ${this.commanderCallsign}. CAS approved. ${urgencyText} ` +
      `Target coordinates received: ${targetPos.x.toFixed(0)}, ${targetPos.y.toFixed(0)}. ` +
      `Keep your heads down and mark friendlies with smoke. Danger close protocol in effect.`;
  }

  /**
   * Generate artillery response message
   */
  private generateArtilleryResponse(
    playerName: string,
    request: ParsedRequest,
    targetPos: Position,
    distanceToFriendly: number
  ): string {
    const urgencyText = request.urgency === 'immediate'
      ? 'Fire mission authorized. Rounds out in 15 seconds.'
      : 'Fire mission queued. Stand by for splash.';

    const safetyText = distanceToFriendly < 200
      ? 'Danger close - keep your heads down.'
      : '';

    return `${playerName}, this is ${this.commanderCallsign}. Artillery approved. ${urgencyText} ` +
      `Target grid: ${targetPos.x.toFixed(0)}, ${targetPos.y.toFixed(0)}. ${safetyText} ` +
      `Call splash when rounds impact.`;
  }

  /**
   * Generate reinforcements response message
   */
  private generateReinforcementsResponse(
    playerName: string,
    request: ParsedRequest,
    spawnPos: Position
  ): string {
    return `${playerName}, this is ${this.commanderCallsign}. Reinforcements approved. ` +
      `QRF team is deploying from grid ${spawnPos.x.toFixed(0)}, ${spawnPos.y.toFixed(0)}. ` +
      `ETA to your position approximately 2 minutes. They will link up with you on arrival.`;
  }

  /**
   * Generate intel report
   */
  private generateIntelReport(
    playerPosition: Position,
    knownEnemies: IntelReport[],
    threatAssessment?: ThreatMatrix
  ): string {
    const parts: string[] = [
      `This is ${this.commanderCallsign}. Intel report follows.`
    ];

    if (knownEnemies.length === 0) {
      parts.push('No confirmed enemy contacts at this time. Area appears clear.');
    } else {
      parts.push(`We have ${knownEnemies.length} confirmed enemy contact(s).`);

      // Report closest threats
      const sortedEnemies = [...knownEnemies].sort((a, b) => {
        const distA = this.calculateDistance(a.position, playerPosition);
        const distB = this.calculateDistance(b.position, playerPosition);
        return distA - distB;
      });

      const closestThree = sortedEnemies.slice(0, 3);
      for (const enemy of closestThree) {
        const distance = this.calculateDistance(enemy.position, playerPosition);
        const bearing = this.calculateBearing(playerPosition, enemy.position);
        const confidence = Math.round(enemy.confidence * 100);

        parts.push(
          `${enemy.unitType.charAt(0).toUpperCase() + enemy.unitType.slice(1)} contact ` +
          `bearing ${bearing.toFixed(0)}, ${distance.toFixed(0)} meters. ` +
          `Confidence ${confidence}%.`
        );
      }
    }

    if (threatAssessment) {
      const threatLevel = threatAssessment.overallThreat;
      let threatDesc: string;

      if (threatLevel > 0.7) {
        threatDesc = 'Threat level HIGH. Recommend caution.';
      } else if (threatLevel > 0.4) {
        threatDesc = 'Threat level MODERATE. Stay alert.';
      } else {
        threatDesc = 'Threat level LOW. Continue mission.';
      }

      parts.push(threatDesc);
    }

    parts.push(`${this.commanderCallsign} out.`);

    return parts.join(' ');
  }

  /**
   * Generate sitrep report
   */
  private generateSitrepReport(
    gameState?: GameState,
    threatAssessment?: ThreatMatrix
  ): string {
    const parts: string[] = [
      `This is ${this.commanderCallsign}. SITREP follows.`
    ];

    if (gameState) {
      // Player status
      const playerCount = gameState.players.length;
      const avgHealth = playerCount > 0
        ? gameState.players.reduce((sum, p) => sum + p.health, 0) / playerCount
        : 0;

      parts.push(
        `Friendly forces: ${playerCount} operator(s) in the field. ` +
        `Average combat effectiveness: ${Math.round(avgHealth * 100)}%.`
      );

      // Mission status
      const activeObjectives = gameState.objectives.filter(o => o.state === 'active').length;
      const completedObjectives = gameState.objectives.filter(o => o.state === 'completed').length;
      parts.push(
        `Mission status: ${activeObjectives} objective(s) active, ${completedObjectives} complete.`
      );

      // Enemy status
      const enemyCount = gameState.enemyUnits.length;
      parts.push(`Known hostile forces: ${enemyCount} contact(s).`);
    }

    if (threatAssessment) {
      const threatPercent = Math.round(threatAssessment.overallThreat * 100);
      parts.push(`Overall threat assessment: ${threatPercent}%.`);

      if (threatAssessment.hotspots.length > 0) {
        parts.push(
          `${threatAssessment.hotspots.length} active hotspot(s) identified.`
        );
      }
    }

    // Resource status
    if (this.resourceManager) {
      const stats = this.resourceManager.getStatistics();
      parts.push(
        `Logistics: ${stats.tickets} reinforcement ticket(s), ` +
        `${stats.ammo}% ammo, ${stats.fuel}% fuel.`
      );
    }

    parts.push(`${this.commanderCallsign} out.`);

    return parts.join(' ');
  }

  /**
   * Create a denial response
   */
  private createDenialResponse(
    message: string,
    reasoning: string,
    requestType: RequestType
  ): ChatResponse {
    return {
      message,
      reasoning,
      action: null,
      sqfCode: null,
      success: false,
      requestType
    };
  }

  /**
   * Create a clarification response for unclear requests
   */
  private createClarificationResponse(playerName: string, originalMessage: string): ChatResponse {
    const suggestions = [
      'Try: "Request CAS on [grid/position]"',
      'Try: "Need reinforcements at my position"',
      'Try: "Request artillery on [target]"',
      'Try: "Request sitrep" or "intel report"'
    ];

    const message = `${playerName}, this is ${this.commanderCallsign}. ` +
      `Say again, your last was garbled. ` +
      `${suggestions[Math.floor(Math.random() * suggestions.length)]}`;

    return {
      message,
      reasoning: `Unable to parse request: "${originalMessage}"`,
      action: null,
      sqfCode: null,
      success: false,
      requestType: 'unknown'
    };
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Calculate pattern confidence based on multiple matches
   */
  private calculatePatternConfidence(message: string, pattern: RegExp): number {
    const matches = message.match(pattern);
    if (!matches) return 0;

    // Base confidence from match
    let confidence = 0.5;

    // Increase confidence for longer matches
    if (matches[0].length > 5) confidence += 0.2;

    // Increase confidence if message is short (more specific)
    if (message.length < 50) confidence += 0.1;

    // Increase confidence for exact command patterns
    if (message.toLowerCase().includes('request')) confidence += 0.2;

    return Math.min(1, confidence);
  }

  /**
   * Extract position from message
   */
  private extractPosition(message: string, defaultPos: Position): Position | null {
    // Check for "my position" or similar
    if (POSITION_PATTERNS.myPosition.test(message)) {
      return defaultPos;
    }

    // Check for coordinates
    const coordMatch = message.match(POSITION_PATTERNS.coordinates);
    if (coordMatch) {
      return {
        x: parseFloat(coordMatch[1]),
        y: parseFloat(coordMatch[2]),
        z: 0
      };
    }

    // Check for relative direction
    const relativeMatch = message.match(POSITION_PATTERNS.relativeDir);
    if (relativeMatch) {
      const distance = parseFloat(relativeMatch[1]);
      const direction = relativeMatch[2].toLowerCase();

      let dx = 0;
      let dy = 0;

      switch (direction) {
        case 'north': dy = distance; break;
        case 'south': dy = -distance; break;
        case 'east': dx = distance; break;
        case 'west': dx = -distance; break;
        case 'ne': dx = distance * 0.707; dy = distance * 0.707; break;
        case 'nw': dx = -distance * 0.707; dy = distance * 0.707; break;
        case 'se': dx = distance * 0.707; dy = -distance * 0.707; break;
        case 'sw': dx = -distance * 0.707; dy = -distance * 0.707; break;
      }

      return {
        x: defaultPos.x + dx,
        y: defaultPos.y + dy,
        z: 0
      };
    }

    // Default to player position for most requests
    return null;
  }

  /**
   * Extract urgency from message
   */
  private extractUrgency(message: string): 'immediate' | 'soon' | 'whenever' {
    if (URGENCY_PATTERNS.immediate.test(message)) {
      return 'immediate';
    }
    if (URGENCY_PATTERNS.soon.test(message)) {
      return 'soon';
    }
    return 'whenever';
  }

  /**
   * Extract additional details from message
   */
  private extractDetails(message: string, requestType: RequestType): string {
    // Remove the request type keywords to get remaining details
    let details = message;

    const patterns = REQUEST_PATTERNS[requestType];
    for (const pattern of patterns) {
      details = details.replace(pattern, '').trim();
    }

    return details;
  }

  /**
   * Check if action can be afforded
   */
  private canAffordAction(costs: { ammo: number; fuel: number }): boolean {
    if (!this.resourceManager) return true;

    return (
      this.resourceManager.getAmmo() >= costs.ammo &&
      this.resourceManager.getFuel() >= costs.fuel
    );
  }

  /**
   * Consume resources for an action
   */
  private consumeActionResources(costs: { ammo: number; fuel: number }): void {
    if (!this.resourceManager) return;

    if (costs.ammo > 0) {
      this.resourceManager.consumeAmmo(costs.ammo);
    }
    if (costs.fuel > 0) {
      this.resourceManager.consumeFuel(costs.fuel);
    }
  }

  /**
   * Calculate safe spawn position offset from player
   */
  private calculateSafeSpawnPosition(playerPos: Position): Position {
    const angle = Math.random() * Math.PI * 2;
    const distance = 200 + Math.random() * 100;

    return {
      x: playerPos.x + Math.cos(angle) * distance,
      y: playerPos.y + Math.sin(angle) * distance,
      z: 0
    };
  }

  /**
   * Calculate distance between two positions
   */
  private calculateDistance(pos1: Position, pos2: Position): number {
    return Math.sqrt(
      Math.pow(pos1.x - pos2.x, 2) +
      Math.pow(pos1.y - pos2.y, 2) +
      Math.pow(pos1.z - pos2.z, 2)
    );
  }

  /**
   * Calculate bearing from pos1 to pos2 in degrees
   */
  private calculateBearing(from: Position, to: Position): number {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    let bearing = Math.atan2(dx, dy) * (180 / Math.PI);
    if (bearing < 0) bearing += 360;
    return bearing;
  }

  /**
   * Add message to conversation history
   */
  private addToHistory(role: 'player' | 'commander', message: string): void {
    this.conversationHistory.push({
      role,
      message,
      timestamp: Date.now()
    });

    // Trim history if too long
    while (this.conversationHistory.length > this.maxHistoryLength) {
      this.conversationHistory.shift();
    }
  }

  /**
   * Get conversation history
   */
  getConversationHistory(): Array<{ role: 'player' | 'commander'; message: string; timestamp: number }> {
    return [...this.conversationHistory];
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.conversationHistory = [];
    logger.debug('Chat history cleared', { side: this.side });
  }

  /**
   * Set resource manager reference
   */
  setResourceManager(manager: ResourceManager): void {
    this.resourceManager = manager;
  }

  /**
   * Set objective manager reference
   */
  setObjectiveManager(manager: ObjectiveManager): void {
    this.objectiveManager = manager;
  }

  /**
   * Get chat interface statistics
   */
  getStatistics(): {
    side: 'EAST' | 'WEST';
    callsign: string;
    historyLength: number;
    lastRequestTime: number;
    cooldown: number;
  } {
    return {
      side: this.side,
      callsign: this.commanderCallsign,
      historyLength: this.conversationHistory.length,
      lastRequestTime: this.lastRequestTime,
      cooldown: this.requestCooldown
    };
  }
}

/**
 * Factory function to create a ChatInterface
 */
export function createChatInterface(
  side: 'EAST' | 'WEST',
  options?: {
    commanderCallsign?: string;
    requestCooldown?: number;
    resourceManager?: ResourceManager;
    objectiveManager?: ObjectiveManager;
  }
): ChatInterface {
  return new ChatInterface(side, options);
}
