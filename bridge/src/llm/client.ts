/**
 * LLM Client Interface - Abstraction for different LLM providers
 */

import { GameState, EventHistory, GMDecision, GMAction, GameContext } from '../game-state/types';

export interface LLMClient {
  /**
   * Get a Game Master decision based on current game state
   */
  getDecision(gameState: GameState, history: EventHistory): Promise<GMDecision>;

  /**
   * Generate SQF code for a specific action
   */
  generateSQF(action: GMAction, context: GameContext): Promise<string>;

  /**
   * Extract SQF code from LLM response
   */
  extractSQF(response: string): string | null;

  /**
   * Check if the client is properly configured
   */
  isConfigured(): boolean;
}

export interface LLMResponse {
  content: string;
  reasoning?: string;
  action?: string;
  sqf?: string;
}
