/**
 * Intel Manager - Handles intelligence report storage, CRUD operations, and tracking
 * for AI Commander fog of war system
 */

import { logger } from '../../utils/logger';
import {
  IntelReport,
  CreateIntelReportParams,
  CommanderSide,
  IntelSource,
  IntelLevel,
  TargetType,
  StrengthEstimate,
  MAX_REPORTS_PER_SIDE,
} from './types';

/**
 * Manages intelligence reports for a specific commander side
 * Handles CRUD operations, storage limits, and ID generation
 */
export class IntelManager {
  private reports: Map<string, IntelReport> = new Map();
  private reportCounter: number = 0;
  private side: CommanderSide;

  /**
   * Creates a new IntelManager for a specific side
   * @param side Commander side (EAST or WEST)
   */
  constructor(side: CommanderSide) {
    this.side = side;
    logger.info('IntelManager initialized', { side });
  }

  /**
   * Gets the commander side this manager serves
   */
  getSide(): CommanderSide {
    return this.side;
  }

  /**
   * Generates a unique report ID prefixed by source
   * @param source Intel source type
   * @returns Unique ID string (e.g., visual_123, recon_456)
   */
  private generateReportId(source: IntelSource): string {
    this.reportCounter++;
    return `${source}_${this.reportCounter}`;
  }

  /**
   * Creates default strength estimate
   */
  private createDefaultStrength(partial?: Partial<StrengthEstimate>): StrengthEstimate {
    return {
      min: partial?.min ?? 1,
      max: partial?.max ?? 5,
      confidence: partial?.confidence ?? 0.5,
      composition: {
        infantry: partial?.composition?.infantry ?? 0,
        vehicles: partial?.composition?.vehicles ?? 0,
        armor: partial?.composition?.armor ?? 0,
        aircraft: partial?.composition?.aircraft ?? 0,
      },
    };
  }

  /**
   * Validates position data
   * @param position Position to validate
   * @returns True if position is valid
   */
  private isValidPosition(position: { x?: number; y?: number; z?: number } | null | undefined): boolean {
    if (!position) return false;
    return typeof position.x === 'number' &&
           typeof position.y === 'number' &&
           typeof position.z === 'number' &&
           isFinite(position.x) &&
           isFinite(position.y) &&
           isFinite(position.z);
  }

  /**
   * Adds a new intel report
   * @param params Report creation parameters
   * @returns The created report, or null if invalid
   */
  addReport(params: CreateIntelReportParams): IntelReport | null {
    // Validate position data
    if (!this.isValidPosition(params.position)) {
      logger.warn('addReport: Invalid position data', { side: this.side, position: params.position });
      return null;
    }

    // Enforce report limit - remove oldest if at capacity
    if (this.reports.size >= MAX_REPORTS_PER_SIDE) {
      this.removeOldestReport();
    }

    const now = Date.now();
    const id = this.generateReportId(params.source);

    const report: IntelReport = {
      id,
      source: params.source,
      sourceCount: 1,
      targetType: params.targetType,
      position: { ...params.position },
      positionAccuracy: params.positionAccuracy ?? 50,
      heading: params.heading ?? null,
      speed: params.speed ?? null,
      strength: this.createDefaultStrength(params.strength),
      timestamp: now,
      lastUpdated: now,
      confidence: Math.max(0, Math.min(1, params.confidence ?? 0.8)),
      stale: false,
      level: IntelLevel.ACTIVE,
      notes: params.notes ?? '',
    };

    this.reports.set(id, report);
    logger.debug('Intel report added', {
      side: this.side,
      id,
      source: params.source,
      targetType: params.targetType,
    });

    return report;
  }

  /**
   * Removes the oldest report to make room for new ones
   */
  private removeOldestReport(): void {
    let oldestId: string | null = null;
    let oldestTime = Infinity;

    for (const [id, report] of this.reports) {
      if (report.timestamp < oldestTime) {
        oldestTime = report.timestamp;
        oldestId = id;
      }
    }

    if (oldestId) {
      this.reports.delete(oldestId);
      logger.debug('Oldest report removed due to capacity', {
        side: this.side,
        removedId: oldestId,
      });
    }
  }

  /**
   * Gets a report by ID
   * @param id Report ID
   * @returns The report or undefined if not found
   */
  getReport(id: string): IntelReport | undefined {
    return this.reports.get(id);
  }

  /**
   * Gets all reports
   * @returns Array of all reports
   */
  getAllReports(): IntelReport[] {
    return Array.from(this.reports.values());
  }

  /**
   * Gets reports filtered by intel level
   * @param level Intel level to filter by
   * @returns Array of matching reports
   */
  getReportsByLevel(level: IntelLevel): IntelReport[] {
    return this.getAllReports().filter(report => report.level === level);
  }

  /**
   * Gets reports filtered by source
   * @param source Intel source to filter by
   * @returns Array of matching reports
   */
  getReportsBySource(source: IntelSource): IntelReport[] {
    return this.getAllReports().filter(report => report.source === source);
  }

  /**
   * Gets reports filtered by target type
   * @param targetType Target type to filter by
   * @returns Array of matching reports
   */
  getReportsByTargetType(targetType: TargetType): IntelReport[] {
    return this.getAllReports().filter(report => report.targetType === targetType);
  }

  /**
   * Gets active (non-stale) reports
   * @returns Array of active reports
   */
  getActiveReports(): IntelReport[] {
    return this.getAllReports().filter(report => !report.stale);
  }

  /**
   * Gets stale reports
   * @returns Array of stale reports
   */
  getStaleReports(): IntelReport[] {
    return this.getAllReports().filter(report => report.stale);
  }

  /**
   * Gets confirmed (multi-source) reports
   * @returns Array of confirmed reports
   */
  getConfirmedReports(): IntelReport[] {
    return this.getAllReports().filter(report => report.level === IntelLevel.CONFIRMED);
  }

  /**
   * Updates an existing report
   * @param id Report ID
   * @param updates Partial report data to update
   * @returns Updated report or undefined if not found
   */
  updateReport(id: string, updates: Partial<Omit<IntelReport, 'id'>>): IntelReport | undefined {
    const existing = this.reports.get(id);
    if (!existing) {
      logger.warn('updateReport: Report not found', { side: this.side, id });
      return undefined;
    }

    // Validate position if being updated
    if (updates.position && !this.isValidPosition(updates.position)) {
      logger.warn('updateReport: Invalid position data', { side: this.side, id, position: updates.position });
      return undefined;
    }

    const updated: IntelReport = {
      ...existing,
      ...updates,
      id: existing.id, // Ensure ID cannot be changed
      lastUpdated: Date.now(),
    };

    // Clamp confidence to valid range
    updated.confidence = Math.max(0, Math.min(1, updated.confidence));

    this.reports.set(id, updated);
    logger.debug('Intel report updated', { side: this.side, id });

    return updated;
  }

  /**
   * Removes a report by ID
   * @param id Report ID
   * @returns True if removed, false if not found
   */
  removeReport(id: string): boolean {
    const existed = this.reports.has(id);
    if (existed) {
      this.reports.delete(id);
      logger.debug('Intel report removed', { side: this.side, id });
    }
    return existed;
  }

  /**
   * Removes all stale reports
   * @returns Number of reports removed
   */
  removeAllStale(): number {
    const staleIds: string[] = [];
    for (const [id, report] of this.reports) {
      if (report.stale) {
        staleIds.push(id);
      }
    }

    for (const id of staleIds) {
      this.reports.delete(id);
    }

    if (staleIds.length > 0) {
      logger.debug('Stale reports removed', { side: this.side, count: staleIds.length });
    }

    return staleIds.length;
  }

  /**
   * Clears all reports
   */
  clearAllReports(): void {
    const count = this.reports.size;
    this.reports.clear();
    logger.info('All intel reports cleared', { side: this.side, clearedCount: count });
  }

  /**
   * Gets the number of reports
   * @returns Total report count
   */
  getReportCount(): number {
    return this.reports.size;
  }

  /**
   * Checks if the manager has any reports
   * @returns True if there are reports
   */
  hasReports(): boolean {
    return this.reports.size > 0;
  }

  /**
   * Checks if at capacity
   * @returns True if at or above max reports
   */
  isAtCapacity(): boolean {
    return this.reports.size >= MAX_REPORTS_PER_SIDE;
  }
}

/**
 * Factory function to create an IntelManager for a specific side
 * @param side Commander side (EAST or WEST)
 * @returns New IntelManager instance
 */
export function createIntelManager(side: CommanderSide): IntelManager {
  return new IntelManager(side);
}
