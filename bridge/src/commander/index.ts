/**
 * Commander Module - AI Commander Configuration and Integration
 *
 * This module provides the high-level AI Commander functionality:
 * - Staging area and faction configuration
 * - Resource-aware prompt building for LLM decisions
 * - Spawn detection from LLM responses
 * - Integration with resource management
 *
 * @example
 * ```typescript
 * import {
 *   buildResourceAwarePrompt,
 *   detectSpawn,
 *   getSpawnTicketCost,
 *   DEFAULT_COMMANDERS
 * } from './commander';
 *
 * // Build prompt with resource state
 * const prompt = buildResourceAwarePrompt({
 *   side: 'WEST',
 *   gameState,
 *   history,
 *   config: DEFAULT_COMMANDERS.WEST
 * });
 *
 * // Detect spawns in LLM response
 * const spawn = detectSpawn(sqfCode, rawLLMResponse);
 * const cost = getSpawnTicketCost(spawn);
 * ```
 */

// Configuration exports
export type {
  StagingArea,
  FactionConfig,
  CommanderConfig,
} from './config';

export {
  RHS_USARMY_OCP,
  RHS_VDV,
  VANILLA_GUER,
  SALMAN_PAK_STAGING,
  ALTIS_STAGING,
  DEFAULT_COMMANDERS,
  createCommanderConfig,
  getStagingArea,
  getPrimaryStagingPosition,
  getRandomUnit,
} from './config';

// Prompt builder exports
export type {
  CommanderPromptContext,
} from './prompt-builder';

export {
  buildResourceAwarePrompt,
  buildCommanderSystemPrompt,
} from './prompt-builder';

// Spawn detector exports
export type {
  DetectedSpawn,
} from './spawn-detector';

export {
  detectSpawn,
  spawnTypeToPoolType,
  getSpawnTicketCost,
} from './spawn-detector';

// Re-export resources for convenience
export * from './resources';
