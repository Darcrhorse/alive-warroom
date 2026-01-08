/**
 * Event history management
 */

import { GameEvent, EventHistory } from './types';

export class HistoryManager {
  private events: GameEvent[] = [];
  private maxSize: number;

  constructor(maxSize: number = 100) {
    this.maxSize = maxSize;
  }

  /**
   * Add event to history
   */
  add(event: GameEvent): void {
    this.events.push(event);
    
    // Maintain max size
    if (this.events.length > this.maxSize) {
      this.events.shift();
    }
  }

  /**
   * Get all events
   */
  getAll(): GameEvent[] {
    return [...this.events];
  }

  /**
   * Get recent events
   */
  getRecent(count: number): GameEvent[] {
    return this.events.slice(-count);
  }

  /**
   * Get events by type
   */
  getByType(type: string): GameEvent[] {
    return this.events.filter(e => e.type === type);
  }

  /**
   * Get events in time range
   */
  getInTimeRange(startTime: number, endTime: number): GameEvent[] {
    return this.events.filter(e => e.timestamp >= startTime && e.timestamp <= endTime);
  }

  /**
   * Clear all events
   */
  clear(): void {
    this.events = [];
  }

  /**
   * Get history object
   */
  toHistory(): EventHistory {
    return {
      events: this.getAll(),
      maxSize: this.maxSize
    };
  }
}
