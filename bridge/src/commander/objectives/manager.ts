/**
 * Objective Manager - Manages strategic objectives for AI Commanders
 *
 * Provides CRUD operations for all objective types:
 * - Capture, Defend, Destroy, Patrol, HVT
 *
 * Maintains objective state and supports filtering by type, owner, and status.
 */

import {
  Objective,
  ObjectiveType,
  ObjectiveOwner,
  ObjectiveStatus,
  CreateObjectiveParams,
  UpdateObjectiveParams,
  CaptureObjective,
  DefendObjective,
  DestroyObjective,
  PatrolObjective,
  HVTObjective,
  ObjectiveFilter
} from './types';
import { logger } from '../../utils/logger';

export class ObjectiveManager {
  private objectives: Map<string, Objective> = new Map();
  private idCounter: number = 0;

  constructor() {
    logger.debug('ObjectiveManager initialized');
  }

  /**
   * Generate a unique objective ID
   */
  private generateId(): string {
    this.idCounter++;
    return `obj_${Date.now()}_${this.idCounter}`;
  }

  /**
   * Create a new objective
   */
  create(params: CreateObjectiveParams): Objective {
    const now = Date.now();
    const id = this.generateId();

    // Base objective properties
    const baseObjective = {
      id,
      type: params.type,
      description: params.description || `${params.type} objective`,
      position: params.position,
      radius: params.radius ?? 100,
      priority: params.priority ?? 5,
      owner: params.owner ?? 'NEUTRAL',
      status: 'active' as ObjectiveStatus,
      assignedUnits: [],
      strategicValue: params.strategicValue ?? 50,
      createdAt: now,
      updatedAt: now
    };

    let objective: Objective;

    switch (params.type) {
      case 'capture':
        objective = {
          ...baseObjective,
          type: 'capture',
          captureProgress: 0,
          captureRate: params.captureRate ?? 1,
          capturingSide: null,
          isContested: false
        } as CaptureObjective;
        break;

      case 'defend':
        objective = {
          ...baseObjective,
          type: 'defend',
          timeLimit: params.timeLimit ?? 300,
          timeRemaining: params.timeLimit ?? 300,
          assetId: params.assetId,
          assetType: params.assetType,
          isBreached: false
        } as DefendObjective;
        break;

      case 'destroy':
        objective = {
          ...baseObjective,
          type: 'destroy',
          targetType: params.targetType ?? 'building',
          discoveredAt: null,
          isDiscovered: false,
          targetId: params.targetId,
          estimatedDefense: params.estimatedDefense ?? 0.5
        } as DestroyObjective;
        break;

      case 'patrol':
        objective = {
          ...baseObjective,
          type: 'patrol',
          patrolRoute: params.patrolRoute ?? [params.position],
          currentWaypointIndex: 0,
          detectionCount: 0,
          completedCycles: 0,
          isLooping: params.isLooping ?? true,
          intelGathered: []
        } as PatrolObjective;
        break;

      case 'hvt':
        objective = {
          ...baseObjective,
          type: 'hvt',
          targetUnitId: params.targetUnitId ?? '',
          expiresAt: params.expiresAt ?? (now + 3600000), // Default 1 hour
          intelQuality: params.intelQuality ?? 'low',
          captureAlive: params.captureAlive ?? false,
          lastKnownPosition: params.position,
          lastPositionUpdate: now,
          targetDesignation: params.targetDesignation ?? 'Unknown HVT'
        } as HVTObjective;
        break;

      default:
        throw new Error(`Unknown objective type: ${params.type}`);
    }

    this.objectives.set(id, objective);

    logger.info('Objective created', {
      id,
      type: params.type,
      owner: objective.owner,
      priority: objective.priority
    });

    return objective;
  }

  /**
   * Get an objective by ID
   */
  get(id: string): Objective | undefined {
    return this.objectives.get(id);
  }

  /**
   * Get all objectives
   */
  getAll(): Objective[] {
    return Array.from(this.objectives.values());
  }

  /**
   * Update an existing objective
   */
  update(id: string, params: UpdateObjectiveParams): Objective | undefined {
    const objective = this.objectives.get(id);

    if (!objective) {
      logger.warn('Attempted to update non-existent objective', { id });
      return undefined;
    }

    const updatedObjective = {
      ...objective,
      ...params,
      updatedAt: Date.now()
    } as Objective;

    this.objectives.set(id, updatedObjective);

    logger.debug('Objective updated', {
      id,
      type: objective.type,
      changes: Object.keys(params)
    });

    return updatedObjective;
  }

  /**
   * Delete an objective
   */
  delete(id: string): boolean {
    const objective = this.objectives.get(id);

    if (!objective) {
      logger.warn('Attempted to delete non-existent objective', { id });
      return false;
    }

    this.objectives.delete(id);

    logger.info('Objective deleted', {
      id,
      type: objective.type
    });

    return true;
  }

  /**
   * Get objectives by type
   */
  getByType(type: ObjectiveType): Objective[] {
    return this.getAll().filter(obj => obj.type === type);
  }

  /**
   * Get objectives by owner
   */
  getByOwner(owner: ObjectiveOwner): Objective[] {
    return this.getAll().filter(obj => obj.owner === owner);
  }

  /**
   * Get objectives by status
   */
  getByStatus(status: ObjectiveStatus): Objective[] {
    return this.getAll().filter(obj => obj.status === status);
  }

  /**
   * Get active objectives (convenience method)
   */
  getActiveObjectives(): Objective[] {
    return this.getByStatus('active');
  }

  /**
   * Filter objectives with multiple criteria
   */
  filter(filter: ObjectiveFilter): Objective[] {
    let results = this.getAll();

    if (filter.type) {
      results = results.filter(obj => obj.type === filter.type);
    }

    if (filter.owner) {
      results = results.filter(obj => obj.owner === filter.owner);
    }

    if (filter.status) {
      results = results.filter(obj => obj.status === filter.status);
    }

    if (filter.minPriority !== undefined) {
      results = results.filter(obj => obj.priority >= filter.minPriority!);
    }

    if (filter.maxDistance !== undefined && filter.fromPosition) {
      results = results.filter(obj => {
        const distance = this.calculateDistance(filter.fromPosition!, obj.position);
        return distance <= filter.maxDistance!;
      });
    }

    return results;
  }

  /**
   * Calculate distance between two positions
   */
  private calculateDistance(
    pos1: { x: number; y: number; z: number },
    pos2: { x: number; y: number; z: number }
  ): number {
    const dx = pos2.x - pos1.x;
    const dy = pos2.y - pos1.y;
    const dz = pos2.z - pos1.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Assign units to an objective
   */
  assignUnits(objectiveId: string, unitIds: string[]): boolean {
    const objective = this.objectives.get(objectiveId);

    if (!objective) {
      logger.warn('Cannot assign units to non-existent objective', { objectiveId });
      return false;
    }

    // Add unique unit IDs
    const existingUnits = new Set(objective.assignedUnits);
    unitIds.forEach(id => existingUnits.add(id));

    this.update(objectiveId, { assignedUnits: Array.from(existingUnits) });

    logger.info('Units assigned to objective', {
      objectiveId,
      unitIds,
      totalAssigned: existingUnits.size
    });

    return true;
  }

  /**
   * Remove units from an objective
   */
  unassignUnits(objectiveId: string, unitIds: string[]): boolean {
    const objective = this.objectives.get(objectiveId);

    if (!objective) {
      logger.warn('Cannot unassign units from non-existent objective', { objectiveId });
      return false;
    }

    const unitsToRemove = new Set(unitIds);
    const remainingUnits = objective.assignedUnits.filter(id => !unitsToRemove.has(id));

    this.update(objectiveId, { assignedUnits: remainingUnits });

    logger.debug('Units unassigned from objective', {
      objectiveId,
      removedUnits: unitIds,
      remainingUnits: remainingUnits.length
    });

    return true;
  }

  /**
   * Mark objective as completed
   */
  completeObjective(id: string): boolean {
    return this.update(id, { status: 'completed' }) !== undefined;
  }

  /**
   * Mark objective as failed
   */
  failObjective(id: string): boolean {
    return this.update(id, { status: 'failed' }) !== undefined;
  }

  /**
   * Get count of objectives
   */
  count(): number {
    return this.objectives.size;
  }

  /**
   * Clear all objectives
   */
  clear(): void {
    this.objectives.clear();
    this.idCounter = 0;
    logger.info('All objectives cleared');
  }

  /**
   * Check if an objective exists
   */
  exists(id: string): boolean {
    return this.objectives.has(id);
  }
}

// Export singleton instance for global access
export const objectiveManager = new ObjectiveManager();
