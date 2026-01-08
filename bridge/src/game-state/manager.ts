/**
 * Game state manager - Maintains current game state and history
 */

import { GameState, EventHistory, GameEvent } from './types';
import { logger } from '../utils/logger';

export class GameStateManager {
  private currentState: GameState | null = null;
  private history: EventHistory;
  private maxHistorySize: number = 100;

  constructor() {
    this.history = {
      events: [],
      maxSize: this.maxHistorySize
    };
  }

  /**
   * Update the current game state
   */
  updateState(state: GameState): void {
    this.currentState = state;
    logger.debug('Game state updated', {
      players: state.players.length,
      enemies: state.enemyUnits.length,
      objectives: state.objectives.length
    });
  }

  /**
   * Get the current game state
   */
  getState(): GameState | null {
    return this.currentState;
  }

  /**
   * Add an event to history
   */
  addEvent(event: GameEvent): void {
    this.history.events.push(event);
    
    // Trim history if it exceeds max size
    if (this.history.events.length > this.maxHistorySize) {
      this.history.events = this.history.events.slice(-this.maxHistorySize);
    }

    logger.debug('Event added to history', { type: event.type });
  }

  /**
   * Get event history
   */
  getHistory(): EventHistory {
    return { ...this.history };
  }

  /**
   * Get recent events
   */
  getRecentEvents(count: number = 10): GameEvent[] {
    return this.history.events.slice(-count);
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.history.events = [];
    logger.info('Event history cleared');
  }

  /**
   * Get time since last action
   */
  getTimeSinceLastAction(): number {
    const lastEvent = this.history.events[this.history.events.length - 1];
    if (!lastEvent || !this.currentState) {
      return Infinity;
    }
    return this.currentState.timestamp - lastEvent.timestamp;
  }

  /**
   * Check if state is valid
   */
  isStateValid(): boolean {
    return this.currentState !== null && this.currentState.players.length > 0;
  }
}

export const gameStateManager = new GameStateManager();
