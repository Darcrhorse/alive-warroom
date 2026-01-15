/**
 * Commander Module - AI Commander System for LLM Game Master
 *
 * This module provides a complete AI commander system with support for
 * multiple opposing factions (EAST/WEST), strategic objective management,
 * resource tracking, decision-making, and interactive chat interface.
 *
 * @module commander
 */

// =============================================================================
// Objectives System - Strategic goal tracking and priority scoring
// =============================================================================

export {
  CreateObjectiveParams,
  ObjectiveScoringFactors,
  ObjectiveEvaluation,
  ObjectiveManager,
  createObjectiveManager
} from './objectives';

// =============================================================================
// Resources System - Unit pools, tickets, ammo/fuel tracking
// =============================================================================

export {
  UnitType,
  RegenerationConfig,
  UnitCost,
  ConsumptionResult,
  ResourceSnapshot,
  ResourceManager,
  createResourceManager
} from './resources';

// =============================================================================
// Decision Engine - Core decision-making with rate limiting
// =============================================================================

export {
  DecisionEngineConfig,
  DecisionResult,
  DecisionContext,
  DecisionEngine,
  createDecisionEngine
} from './decisions';

// =============================================================================
// Commander Core - Base commander abstract class
// =============================================================================

export {
  CommanderConfig,
  ProcessingResult,
  FogOfWarConfig,
  BaseCommander,
  isValidCommanderConfig
} from './commander-core';

// =============================================================================
// Faction Commanders - EAST (OPFOR) and WEST (BLUFOR) implementations
// =============================================================================

export {
  EastCommander,
  createEastCommander
} from './east-commander';

export {
  WestCommander,
  createWestCommander
} from './west-commander';

// =============================================================================
// Chat Interface - Interactive mode for natural language commands
// =============================================================================

export {
  RequestType,
  ParsedRequest,
  ChatResponse,
  ChatContext,
  ChatInterface,
  createChatInterface
} from './chat-interface';
