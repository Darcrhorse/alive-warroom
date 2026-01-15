/**
 * Objectives System - Strategic goal tracking, priority scoring, and lifecycle management
 */

import { CommanderObjective, Position } from '../game-state/types';
import { logger } from '../utils/logger';

/**
 * Parameters for creating a new objective
 */
export interface CreateObjectiveParams {
  type: CommanderObjective['type'];
  position: Position;
  priority?: number;
  strategicValue?: number;
  description?: string;
  timeLimit?: number;
}

/**
 * Objective scoring factors for priority calculation
 */
export interface ObjectiveScoringFactors {
  distanceToFriendlyUnits: number; // 0-1 (closer = higher)
  distanceToEnemyUnits: number; // 0-1 (closer = higher threat)
  strategicImportance: number; // 0-1 (based on map position)
  resourceAvailability: number; // 0-1 (can we afford to pursue this?)
  timeUrgency: number; // 0-1 (time-sensitive objectives)
}

/**
 * Result of objective evaluation
 */
export interface ObjectiveEvaluation {
  objective: CommanderObjective;
  score: number;
  reasoning: string;
  recommendedUnits: number;
}

/**
 * ObjectiveManager - Manages strategic objectives for a commander
 *
 * Handles objective creation, priority scoring, lifecycle management,
 * and unit assignment tracking.
 */
export class ObjectiveManager {
  private objectives: Map<string, CommanderObjective> = new Map();
  private objectiveCounter: number = 0;
  private side: 'EAST' | 'WEST';

  constructor(side: 'EAST' | 'WEST') {
    this.side = side;
    logger.info('ObjectiveManager initialized', { side });
  }

  /**
   * Create a new objective
   */
  createObjective(params: CreateObjectiveParams): CommanderObjective {
    const id = `${this.side.toLowerCase()}_obj_${++this.objectiveCounter}`;

    const objective: CommanderObjective = {
      id,
      type: params.type,
      position: params.position,
      priority: params.priority ?? 5,
      assignedUnits: [],
      status: 'pending',
      strategicValue: params.strategicValue ?? this.calculateDefaultStrategicValue(params.type),
      description: params.description,
      timeLimit: params.timeLimit
    };

    this.objectives.set(id, objective);

    logger.info('Objective created', {
      side: this.side,
      id,
      type: objective.type,
      priority: objective.priority
    });

    return objective;
  }

  /**
   * Get an objective by ID
   */
  getObjective(id: string): CommanderObjective | undefined {
    return this.objectives.get(id);
  }

  /**
   * Get all objectives
   */
  getAllObjectives(): CommanderObjective[] {
    return Array.from(this.objectives.values());
  }

  /**
   * Get objectives filtered by status
   */
  getObjectivesByStatus(status: CommanderObjective['status']): CommanderObjective[] {
    return this.getAllObjectives().filter(obj => obj.status === status);
  }

  /**
   * Get objectives filtered by type
   */
  getObjectivesByType(type: CommanderObjective['type']): CommanderObjective[] {
    return this.getAllObjectives().filter(obj => obj.type === type);
  }

  /**
   * Get the highest priority objective that is active or pending
   */
  getHighestPriorityObjective(): CommanderObjective | null {
    const actionableObjectives = this.getAllObjectives()
      .filter(obj => obj.status === 'pending' || obj.status === 'active')
      .sort((a, b) => {
        // Sort by priority descending, then by strategic value descending
        if (b.priority !== a.priority) {
          return b.priority - a.priority;
        }
        return b.strategicValue - a.strategicValue;
      });

    return actionableObjectives[0] || null;
  }

  /**
   * Update objective status
   */
  updateStatus(id: string, status: CommanderObjective['status']): boolean {
    const objective = this.objectives.get(id);
    if (!objective) {
      logger.warn('Objective not found for status update', { id });
      return false;
    }

    const previousStatus = objective.status;
    objective.status = status;

    logger.info('Objective status updated', {
      side: this.side,
      id,
      type: objective.type,
      previousStatus,
      newStatus: status
    });

    return true;
  }

  /**
   * Update objective priority
   */
  updatePriority(id: string, priority: number): boolean {
    const objective = this.objectives.get(id);
    if (!objective) {
      logger.warn('Objective not found for priority update', { id });
      return false;
    }

    // Clamp priority between 1 and 10
    const clampedPriority = Math.max(1, Math.min(10, priority));
    const previousPriority = objective.priority;
    objective.priority = clampedPriority;

    logger.debug('Objective priority updated', {
      id,
      previousPriority,
      newPriority: clampedPriority
    });

    return true;
  }

  /**
   * Assign a unit to an objective
   */
  assignUnit(objectiveId: string, unitId: string): boolean {
    const objective = this.objectives.get(objectiveId);
    if (!objective) {
      logger.warn('Objective not found for unit assignment', { objectiveId });
      return false;
    }

    if (!objective.assignedUnits.includes(unitId)) {
      objective.assignedUnits.push(unitId);

      // Auto-activate pending objectives when units are assigned
      if (objective.status === 'pending') {
        objective.status = 'active';
        logger.info('Objective activated on unit assignment', { objectiveId });
      }

      logger.debug('Unit assigned to objective', {
        objectiveId,
        unitId,
        totalAssigned: objective.assignedUnits.length
      });
    }

    return true;
  }

  /**
   * Remove a unit from an objective
   */
  unassignUnit(objectiveId: string, unitId: string): boolean {
    const objective = this.objectives.get(objectiveId);
    if (!objective) {
      logger.warn('Objective not found for unit unassignment', { objectiveId });
      return false;
    }

    const index = objective.assignedUnits.indexOf(unitId);
    if (index > -1) {
      objective.assignedUnits.splice(index, 1);
      logger.debug('Unit unassigned from objective', {
        objectiveId,
        unitId,
        remainingAssigned: objective.assignedUnits.length
      });
    }

    return true;
  }

  /**
   * Remove a unit from all objectives (useful when unit is destroyed)
   */
  unassignUnitFromAll(unitId: string): void {
    for (const objective of this.objectives.values()) {
      const index = objective.assignedUnits.indexOf(unitId);
      if (index > -1) {
        objective.assignedUnits.splice(index, 1);
        logger.debug('Unit removed from objective due to destruction', {
          objectiveId: objective.id,
          unitId
        });
      }
    }
  }

  /**
   * Calculate priority score for an objective based on multiple factors
   */
  calculatePriorityScore(
    objective: CommanderObjective,
    factors: ObjectiveScoringFactors
  ): number {
    // Base score from static priority
    let score = objective.priority * 10;

    // Adjust based on strategic value (0-30 points)
    score += objective.strategicValue * 3;

    // Adjust based on scoring factors
    score += factors.distanceToFriendlyUnits * 15; // Closer to friendlies = easier to reinforce
    score += factors.distanceToEnemyUnits * 10; // Enemy proximity indicates urgency
    score += factors.strategicImportance * 20; // Map position importance
    score += factors.resourceAvailability * 10; // Can we pursue this?
    score += factors.timeUrgency * 25; // Time-sensitive objectives get priority

    // Penalty for objectives with many failed attempts (implicit in status)
    if (objective.status === 'active' && objective.assignedUnits.length === 0) {
      score -= 20; // Active but no units = problem
    }

    // Ensure score is positive
    return Math.max(0, score);
  }

  /**
   * Evaluate all pending/active objectives and return sorted by score
   */
  evaluateObjectives(factors: ObjectiveScoringFactors): ObjectiveEvaluation[] {
    const actionableObjectives = this.getAllObjectives()
      .filter(obj => obj.status === 'pending' || obj.status === 'active');

    const evaluations: ObjectiveEvaluation[] = actionableObjectives.map(objective => {
      const score = this.calculatePriorityScore(objective, factors);

      return {
        objective,
        score,
        reasoning: this.generateEvaluationReasoning(objective, factors, score),
        recommendedUnits: this.calculateRecommendedUnits(objective)
      };
    });

    // Sort by score descending
    evaluations.sort((a, b) => b.score - a.score);

    logger.debug('Objectives evaluated', {
      side: this.side,
      totalEvaluated: evaluations.length,
      topObjective: evaluations[0]?.objective.id
    });

    return evaluations;
  }

  /**
   * Mark an objective as completed
   */
  completeObjective(id: string): boolean {
    return this.updateStatus(id, 'completed');
  }

  /**
   * Mark an objective as failed
   */
  failObjective(id: string): boolean {
    const objective = this.objectives.get(id);
    if (!objective) {
      return false;
    }

    // Unassign all units from failed objective
    objective.assignedUnits = [];

    return this.updateStatus(id, 'failed');
  }

  /**
   * Remove an objective entirely
   */
  removeObjective(id: string): boolean {
    if (!this.objectives.has(id)) {
      logger.warn('Objective not found for removal', { id });
      return false;
    }

    this.objectives.delete(id);
    logger.info('Objective removed', { side: this.side, id });
    return true;
  }

  /**
   * Clear all completed and failed objectives
   */
  clearInactiveObjectives(): number {
    let cleared = 0;
    for (const [id, objective] of this.objectives.entries()) {
      if (objective.status === 'completed' || objective.status === 'failed') {
        this.objectives.delete(id);
        cleared++;
      }
    }

    if (cleared > 0) {
      logger.info('Inactive objectives cleared', { side: this.side, count: cleared });
    }

    return cleared;
  }

  /**
   * Clear all objectives (reset)
   */
  clearAll(): void {
    this.objectives.clear();
    logger.info('All objectives cleared', { side: this.side });
  }

  /**
   * Get statistics about objectives
   */
  getStatistics(): {
    total: number;
    pending: number;
    active: number;
    completed: number;
    failed: number;
    unassigned: number;
  } {
    const objectives = this.getAllObjectives();

    return {
      total: objectives.length,
      pending: objectives.filter(o => o.status === 'pending').length,
      active: objectives.filter(o => o.status === 'active').length,
      completed: objectives.filter(o => o.status === 'completed').length,
      failed: objectives.filter(o => o.status === 'failed').length,
      unassigned: objectives.filter(o =>
        (o.status === 'pending' || o.status === 'active') &&
        o.assignedUnits.length === 0
      ).length
    };
  }

  /**
   * Check if there are any objectives without assigned units
   */
  hasUnassignedObjectives(): boolean {
    return this.getAllObjectives().some(obj =>
      (obj.status === 'pending' || obj.status === 'active') &&
      obj.assignedUnits.length === 0
    );
  }

  /**
   * Get the next objective that needs units assigned
   */
  getNextUnassignedObjective(): CommanderObjective | null {
    const unassigned = this.getAllObjectives()
      .filter(obj =>
        (obj.status === 'pending' || obj.status === 'active') &&
        obj.assignedUnits.length === 0
      )
      .sort((a, b) => b.priority - a.priority);

    return unassigned[0] || null;
  }

  /**
   * Calculate default strategic value based on objective type
   */
  private calculateDefaultStrategicValue(type: CommanderObjective['type']): number {
    const baseValues: Record<CommanderObjective['type'], number> = {
      capture: 8,
      defend: 7,
      destroy: 9,
      patrol: 3,
      reinforce: 5
    };

    return baseValues[type] ?? 5;
  }

  /**
   * Generate human-readable reasoning for objective evaluation
   */
  private generateEvaluationReasoning(
    objective: CommanderObjective,
    factors: ObjectiveScoringFactors,
    score: number
  ): string {
    const reasons: string[] = [];

    if (objective.priority >= 8) {
      reasons.push('High priority objective');
    }

    if (factors.timeUrgency > 0.7) {
      reasons.push('Time-critical');
    }

    if (factors.distanceToEnemyUnits > 0.6) {
      reasons.push('Enemy presence detected nearby');
    }

    if (factors.strategicImportance > 0.7) {
      reasons.push('High strategic value location');
    }

    if (factors.resourceAvailability < 0.3) {
      reasons.push('Limited resources available');
    }

    if (objective.assignedUnits.length === 0) {
      reasons.push('Requires unit assignment');
    }

    return reasons.length > 0
      ? reasons.join('. ') + `. Score: ${score.toFixed(1)}`
      : `Standard priority. Score: ${score.toFixed(1)}`;
  }

  /**
   * Calculate recommended number of units for an objective
   */
  private calculateRecommendedUnits(objective: CommanderObjective): number {
    const baseUnits: Record<CommanderObjective['type'], number> = {
      capture: 3,
      defend: 2,
      destroy: 2,
      patrol: 1,
      reinforce: 2
    };

    let recommended = baseUnits[objective.type] ?? 2;

    // Scale based on strategic value
    if (objective.strategicValue >= 8) {
      recommended += 1;
    }

    // Scale based on priority
    if (objective.priority >= 8) {
      recommended += 1;
    }

    return recommended;
  }
}

/**
 * Factory function to create an ObjectiveManager for a specific side
 */
export function createObjectiveManager(side: 'EAST' | 'WEST'): ObjectiveManager {
  return new ObjectiveManager(side);
}
