/**
 * Objective Scorer - AI Commander objective prioritization logic
 *
 * Evaluates objectives by strategic value, distance, enemy strength,
 * available units, and risk/reward to help AI commanders make tactical decisions.
 *
 * Score formula:
 *   score = strategicValueScore + priorityScore + distanceScore + riskScore + timeScore
 *
 * Each component is weighted and the final score is normalized to 0-100.
 */

import {
  Objective,
  ObjectiveScoringContext,
  ObjectiveScore,
  CaptureObjective,
  DefendObjective,
  DestroyObjective,
  HVTObjective
} from './types';
import { Position } from '../../game-state/types';
import { logger } from '../../utils/logger';

/**
 * Weight configuration for scoring components
 */
interface ScoringWeights {
  strategicValue: number;
  priority: number;
  distance: number;
  risk: number;
  time: number;
}

/**
 * Default scoring weights (sum should be approximately 1.0 for normalization)
 */
const DEFAULT_WEIGHTS: ScoringWeights = {
  strategicValue: 0.30,
  priority: 0.25,
  distance: 0.20,
  risk: 0.15,
  time: 0.10
};

/**
 * Maximum distance in meters for scoring calculations
 * Beyond this distance, objectives receive minimum distance score
 */
const MAX_SCORING_DISTANCE = 5000;

export class ObjectiveScorer {
  private weights: ScoringWeights;

  constructor(weights?: Partial<ScoringWeights>) {
    this.weights = { ...DEFAULT_WEIGHTS, ...weights };
    logger.debug('ObjectiveScorer initialized', { weights: this.weights });
  }

  /**
   * Calculate the priority score for a single objective
   *
   * @param objective - The objective to score
   * @param context - Scoring context with commander state
   * @returns ObjectiveScore with score breakdown and reasoning
   */
  score(objective: Objective, context: ObjectiveScoringContext): ObjectiveScore {
    // Calculate individual score components
    const strategicValueScore = this.calculateStrategicValueScore(objective);
    const priorityScore = this.calculatePriorityScore(objective);
    const distanceScore = this.calculateDistanceScore(objective, context.commanderPosition);
    const riskScore = this.calculateRiskScore(objective, context);
    const timeScore = this.calculateTimeScore(objective, context);

    // Weighted sum
    const rawScore =
      strategicValueScore * this.weights.strategicValue +
      priorityScore * this.weights.priority +
      distanceScore * this.weights.distance +
      riskScore * this.weights.risk +
      timeScore * this.weights.time;

    // Normalize to 0-100
    const normalizedScore = Math.min(100, Math.max(0, Math.round(rawScore)));

    // Generate reasoning string
    const reasoning = this.generateReasoning(
      objective,
      normalizedScore,
      { strategicValueScore, distanceScore, priorityScore, riskScore, timeScore }
    );

    logger.debug('Objective scored', {
      objectiveId: objective.id,
      score: normalizedScore,
      type: objective.type
    });

    return {
      objectiveId: objective.id,
      score: normalizedScore,
      breakdown: {
        strategicValueScore: Math.round(strategicValueScore),
        distanceScore: Math.round(distanceScore),
        priorityScore: Math.round(priorityScore),
        riskScore: Math.round(riskScore),
        timeScore: Math.round(timeScore)
      },
      reasoning
    };
  }

  /**
   * Score multiple objectives and return sorted by priority (highest first)
   *
   * @param objectives - Array of objectives to score
   * @param context - Scoring context with commander state
   * @returns Array of ObjectiveScore sorted by score descending
   */
  getPrioritizedObjectives(
    objectives: Objective[],
    context: ObjectiveScoringContext
  ): ObjectiveScore[] {
    if (objectives.length === 0) {
      logger.debug('No objectives to prioritize');
      return [];
    }

    const scores = objectives
      .filter(obj => obj.status === 'active' || obj.status === 'contested')
      .map(obj => this.score(obj, context))
      .sort((a, b) => b.score - a.score);

    logger.info('Objectives prioritized', {
      totalObjectives: objectives.length,
      activeObjectives: scores.length,
      topObjective: scores[0]?.objectiveId,
      topScore: scores[0]?.score
    });

    return scores;
  }

  /**
   * Get the highest priority objective from a list
   *
   * @param objectives - Array of objectives to evaluate
   * @param context - Scoring context
   * @returns The highest scoring objective, or undefined if none
   */
  getTopObjective(
    objectives: Objective[],
    context: ObjectiveScoringContext
  ): { objective: Objective; score: ObjectiveScore } | undefined {
    const prioritized = this.getPrioritizedObjectives(objectives, context);

    if (prioritized.length === 0) {
      return undefined;
    }

    const topScore = prioritized[0];
    const objective = objectives.find(obj => obj.id === topScore.objectiveId);

    if (!objective) {
      return undefined;
    }

    return { objective, score: topScore };
  }

  /**
   * Calculate strategic value score (0-100)
   * Based on the objective's strategicValue field
   */
  private calculateStrategicValueScore(objective: Objective): number {
    // Strategic value is already 0-100
    return objective.strategicValue;
  }

  /**
   * Calculate priority score (0-100)
   * Based on priority level (1-10) scaled to 0-100
   */
  private calculatePriorityScore(objective: Objective): number {
    // Priority is 1-10, scale to 0-100
    return (objective.priority / 10) * 100;
  }

  /**
   * Calculate distance score (0-100)
   * Closer objectives score higher
   */
  private calculateDistanceScore(
    objective: Objective,
    commanderPosition: Position
  ): number {
    const distance = this.calculateDistance(commanderPosition, objective.position);

    // Invert so closer = higher score
    // At distance 0, score = 100
    // At MAX_SCORING_DISTANCE or beyond, score = 0
    if (distance >= MAX_SCORING_DISTANCE) {
      return 0;
    }

    return ((MAX_SCORING_DISTANCE - distance) / MAX_SCORING_DISTANCE) * 100;
  }

  /**
   * Calculate risk/reward score (0-100)
   * Considers enemy strength, available units, and objective type risk profile
   */
  private calculateRiskScore(
    objective: Objective,
    context: ObjectiveScoringContext
  ): number {
    // Base risk from enemy strength (higher enemy = lower score)
    const enemyPenalty = context.enemyStrength * 50;

    // Unit availability bonus (more units = can take more risk = higher score)
    const unitBonus = Math.min(context.availableUnits * 5, 30);

    // Type-specific risk modifiers
    let typeModifier = 0;

    switch (objective.type) {
      case 'capture':
        // Capture risk based on contested status
        const captureObj = objective as CaptureObjective;
        typeModifier = captureObj.isContested ? -20 : 10;
        // Higher progress = lower risk, worth pushing
        typeModifier += captureObj.captureProgress * 0.2;
        break;

      case 'defend':
        // Defend risk based on breach status and time remaining
        const defendObj = objective as DefendObjective;
        typeModifier = defendObj.isBreached ? -30 : 20;
        // Less time remaining = more urgent = higher priority
        const timeRatio = defendObj.timeRemaining / defendObj.timeLimit;
        typeModifier += (1 - timeRatio) * 20;
        break;

      case 'destroy':
        // Destroy risk based on estimated defense
        const destroyObj = objective as DestroyObjective;
        typeModifier = destroyObj.isDiscovered ? 10 : -10;
        typeModifier -= destroyObj.estimatedDefense * 30;
        break;

      case 'patrol':
        // Patrol is generally low risk
        typeModifier = 20;
        break;

      case 'hvt':
        // HVT risk based on intel quality
        const hvtObj = objective as HVTObjective;
        const intelBonus: Record<string, number> = {
          confirmed: 30,
          high: 20,
          medium: 10,
          low: 0
        };
        typeModifier = intelBonus[hvtObj.intelQuality] || 0;
        // Capture alive is riskier than eliminate
        if (hvtObj.captureAlive) {
          typeModifier -= 15;
        }
        break;
    }

    // Calculate final risk score
    // Base score of 50, then add/subtract modifiers
    const baseScore = 50;
    const score = baseScore - enemyPenalty + unitBonus + typeModifier;

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Calculate time-sensitivity score (0-100)
   * Time-critical objectives score higher
   */
  private calculateTimeScore(
    objective: Objective,
    context: ObjectiveScoringContext
  ): number {
    const now = Date.now();
    let timeScore = 50; // Default neutral score

    // Mission phase modifier
    const phaseMultiplier: Record<string, number> = {
      early: 0.8, // Less time pressure early
      mid: 1.0,   // Normal time pressure
      late: 1.3   // More urgent late game
    };
    const phaseModifier = phaseMultiplier[context.missionPhase] || 1.0;

    // Type-specific time calculations
    switch (objective.type) {
      case 'defend':
        // Defend urgency based on remaining time
        const defendObj = objective as DefendObjective;
        const defendUrgency = 1 - (defendObj.timeRemaining / defendObj.timeLimit);
        timeScore = 30 + (defendUrgency * 70);
        break;

      case 'hvt':
        // HVT urgency based on expiration
        const hvtObj = objective as HVTObjective;
        const msRemaining = hvtObj.expiresAt - now;
        const hoursRemaining = msRemaining / (1000 * 60 * 60);

        if (msRemaining <= 0) {
          // Already expired
          timeScore = 0;
        } else if (hoursRemaining < 0.5) {
          // Very urgent (<30 min)
          timeScore = 100;
        } else if (hoursRemaining < 1) {
          // Urgent (<1 hour)
          timeScore = 80;
        } else if (hoursRemaining < 2) {
          // Moderate urgency
          timeScore = 60;
        } else {
          // Low time pressure
          timeScore = 40;
        }
        break;

      case 'capture':
        // Capture time based on progress and contest status
        const captureObj = objective as CaptureObjective;
        if (captureObj.isContested) {
          // Contested = more urgent
          timeScore = 70;
        } else if (captureObj.captureProgress > 50) {
          // High progress = push to complete
          timeScore = 60 + (captureObj.captureProgress - 50);
        }
        break;

      case 'patrol':
        // Patrols are generally not time-sensitive
        timeScore = 30;
        break;

      case 'destroy':
        // Destroy is time-sensitive if target is discovered
        const destroyObj = objective as DestroyObjective;
        timeScore = destroyObj.isDiscovered ? 60 : 40;
        break;
    }

    // Apply general time pressure from context
    timeScore = timeScore * (0.7 + context.timePressure * 0.6);

    // Apply mission phase modifier
    timeScore = timeScore * phaseModifier;

    return Math.min(100, Math.max(0, timeScore));
  }

  /**
   * Calculate Euclidean distance between two positions
   */
  private calculateDistance(pos1: Position, pos2: Position): number {
    const dx = pos2.x - pos1.x;
    const dy = pos2.y - pos1.y;
    const dz = pos2.z - pos1.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Generate human-readable reasoning for the score
   */
  private generateReasoning(
    objective: Objective,
    score: number,
    breakdown: {
      strategicValueScore: number;
      distanceScore: number;
      priorityScore: number;
      riskScore: number;
      timeScore: number;
    }
  ): string {
    const parts: string[] = [];

    // Overall assessment
    if (score >= 80) {
      parts.push('High priority target.');
    } else if (score >= 60) {
      parts.push('Moderate priority.');
    } else if (score >= 40) {
      parts.push('Low priority.');
    } else {
      parts.push('Minimal priority.');
    }

    // Strategic value assessment
    if (breakdown.strategicValueScore >= 70) {
      parts.push('High strategic value.');
    } else if (breakdown.strategicValueScore <= 30) {
      parts.push('Low strategic significance.');
    }

    // Distance assessment
    if (breakdown.distanceScore >= 80) {
      parts.push('Very close to current position.');
    } else if (breakdown.distanceScore <= 20) {
      parts.push('Significant distance away.');
    }

    // Risk assessment
    if (breakdown.riskScore >= 70) {
      parts.push('Favorable risk profile.');
    } else if (breakdown.riskScore <= 30) {
      parts.push('High risk engagement.');
    }

    // Time assessment
    if (breakdown.timeScore >= 80) {
      parts.push('Time-critical.');
    } else if (breakdown.timeScore <= 30) {
      parts.push('No immediate time pressure.');
    }

    // Type-specific notes
    switch (objective.type) {
      case 'capture':
        const captureObj = objective as CaptureObjective;
        if (captureObj.isContested) {
          parts.push('Currently contested.');
        }
        if (captureObj.captureProgress > 0) {
          parts.push(`${captureObj.captureProgress}% captured.`);
        }
        break;

      case 'defend':
        const defendObj = objective as DefendObjective;
        parts.push(`${Math.round(defendObj.timeRemaining / 60)}min remaining.`);
        if (defendObj.isBreached) {
          parts.push('Defense breached!');
        }
        break;

      case 'hvt':
        const hvtObj = objective as HVTObjective;
        parts.push(`Intel: ${hvtObj.intelQuality}.`);
        if (hvtObj.captureAlive) {
          parts.push('Capture alive required.');
        }
        break;

      case 'destroy':
        const destroyObj = objective as DestroyObjective;
        if (!destroyObj.isDiscovered) {
          parts.push('Target not yet located.');
        }
        break;
    }

    return parts.join(' ');
  }

  /**
   * Update scoring weights dynamically
   */
  setWeights(weights: Partial<ScoringWeights>): void {
    this.weights = { ...this.weights, ...weights };
    logger.debug('Scoring weights updated', { weights: this.weights });
  }

  /**
   * Get current scoring weights
   */
  getWeights(): ScoringWeights {
    return { ...this.weights };
  }
}

// Export singleton instance for global access
export const objectiveScorer = new ObjectiveScorer();
