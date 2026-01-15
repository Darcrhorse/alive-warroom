/**
 * Detection system for AI Commander intelligence
 * Handles range calculations, visibility checks, and environmental modifiers
 */

import { Position, Environment } from '../../game-state/types';
import { TargetType, DEFAULT_DETECTION_RANGES } from './types';
import { logger } from '../../utils/logger';

/**
 * Observer type classification affecting detection capabilities
 */
export enum ObserverType {
  INFANTRY = 'infantry',
  VEHICLE = 'vehicle',
  AIRCRAFT = 'aircraft',
  SENSOR = 'sensor',
}

/**
 * Detection range modifiers by observer type
 */
const OBSERVER_MODIFIERS: Record<ObserverType, number> = {
  [ObserverType.INFANTRY]: 1.0,    // Base detection range
  [ObserverType.VEHICLE]: 1.2,    // 20% better due to optics
  [ObserverType.AIRCRAFT]: 2.0,   // Double range from elevation
  [ObserverType.SENSOR]: 1.5,     // 50% better electronic detection
};

/**
 * Calculates 3D Euclidean distance between two positions
 * @param pos1 First position
 * @param pos2 Second position
 * @returns Distance in meters
 */
export function calculateDistance(pos1: Position, pos2: Position): number {
  if (!pos1 || !pos2) {
    logger.warn('calculateDistance called with invalid position', { pos1, pos2 });
    return Infinity;
  }

  const dx = pos2.x - pos1.x;
  const dy = pos2.y - pos1.y;
  const dz = pos2.z - pos1.z;

  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Calculates 2D horizontal distance between two positions (ignoring elevation)
 * @param pos1 First position
 * @param pos2 Second position
 * @returns Horizontal distance in meters
 */
export function calculateHorizontalDistance(pos1: Position, pos2: Position): number {
  if (!pos1 || !pos2) {
    logger.warn('calculateHorizontalDistance called with invalid position', { pos1, pos2 });
    return Infinity;
  }

  const dx = pos2.x - pos1.x;
  const dy = pos2.y - pos1.y;

  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Gets base detection range for a target type
 * @param targetType Type of target being detected
 * @returns Base detection range in meters
 */
export function getBaseDetectionRange(targetType: TargetType): number {
  return DEFAULT_DETECTION_RANGES[targetType] || DEFAULT_DETECTION_RANGES[TargetType.UNKNOWN];
}

/**
 * Gets detection range based on observer and target types
 * @param observerType Type of observing unit
 * @param targetType Type of target
 * @returns Detection range in meters
 */
export function getDetectionRange(
  observerType: ObserverType,
  targetType: TargetType
): number {
  const baseRange = getBaseDetectionRange(targetType);
  const observerModifier = OBSERVER_MODIFIERS[observerType] || 1.0;

  return baseRange * observerModifier;
}

/**
 * Calculates visibility modifier based on environmental conditions
 * @param environment Current environment state
 * @returns Visibility modifier (0-1, where 1 is perfect visibility)
 */
export function calculateVisibilityModifier(environment: Environment | null): number {
  if (!environment) {
    return 1.0; // Default to perfect visibility if no environment data
  }

  let modifier = 1.0;

  // Time of day modifier (0-24 hours)
  // Night (22:00-05:00) reduces visibility significantly
  const hour = environment.timeOfDay;
  if (hour >= 22 || hour < 5) {
    // Night time - 40% visibility
    modifier *= 0.4;
  } else if (hour >= 20 || hour < 7) {
    // Dusk/dawn - 70% visibility
    modifier *= 0.7;
  }
  // Daytime (07:00-20:00) - full visibility

  // Weather/overcast modifier (0-1)
  // Heavy overcast reduces visibility
  const overcast = environment.weather;
  if (overcast > 0.7) {
    // Heavy overcast - up to 30% reduction
    modifier *= (1 - (overcast - 0.7) * 1.0);
  }

  // Fog modifier (0-1)
  // Fog significantly reduces visibility
  const fog = environment.fog;
  if (fog > 0) {
    // Fog reduces visibility exponentially
    modifier *= Math.max(0.1, 1 - fog * 0.9);
  }

  // Clamp modifier between 0.1 and 1.0
  return Math.max(0.1, Math.min(1.0, modifier));
}

/**
 * Gets effective detection range considering environmental conditions
 * @param observerType Type of observing unit
 * @param targetType Type of target
 * @param environment Current environmental conditions
 * @returns Effective detection range in meters
 */
export function getEffectiveDetectionRange(
  observerType: ObserverType,
  targetType: TargetType,
  environment: Environment | null
): number {
  const baseRange = getDetectionRange(observerType, targetType);
  const visibilityModifier = calculateVisibilityModifier(environment);

  return baseRange * visibilityModifier;
}

/**
 * Checks if a target is within detection range
 * @param observerPos Observer position
 * @param targetPos Target position
 * @param detectionRange Detection range in meters
 * @returns True if target is within range
 */
export function isInDetectionRange(
  observerPos: Position,
  targetPos: Position,
  detectionRange: number
): boolean {
  const distance = calculateDistance(observerPos, targetPos);
  return distance <= detectionRange;
}

/**
 * Full detection check combining all factors
 * @param observerPos Position of the observing unit
 * @param observerType Type of observing unit
 * @param targetPos Position of the target
 * @param targetType Type of target
 * @param environment Current environmental conditions
 * @returns Detection result with details
 */
export interface DetectionResult {
  detected: boolean;
  distance: number;
  effectiveRange: number;
  visibilityModifier: number;
  margin: number; // Positive = detected with margin, negative = out of range by this much
}

export function canDetect(
  observerPos: Position,
  observerType: ObserverType,
  targetPos: Position,
  targetType: TargetType,
  environment: Environment | null
): DetectionResult {
  const distance = calculateDistance(observerPos, targetPos);
  const visibilityModifier = calculateVisibilityModifier(environment);
  const effectiveRange = getEffectiveDetectionRange(observerType, targetType, environment);
  const detected = distance <= effectiveRange;
  const margin = effectiveRange - distance;

  return {
    detected,
    distance,
    effectiveRange,
    visibilityModifier,
    margin,
  };
}

/**
 * Batch detection check for multiple targets
 * @param observerPos Position of the observing unit
 * @param observerType Type of observing unit
 * @param targets Array of targets with position and type
 * @param environment Current environmental conditions
 * @returns Array of detection results with target index
 */
export interface TargetWithType {
  position: Position;
  targetType: TargetType;
  id?: string;
}

export interface BatchDetectionResult extends DetectionResult {
  targetIndex: number;
  targetId?: string;
}

export function detectMultipleTargets(
  observerPos: Position,
  observerType: ObserverType,
  targets: TargetWithType[],
  environment: Environment | null
): BatchDetectionResult[] {
  return targets.map((target, index) => {
    const result = canDetect(
      observerPos,
      observerType,
      target.position,
      target.targetType,
      environment
    );

    return {
      ...result,
      targetIndex: index,
      targetId: target.id,
    };
  });
}

/**
 * Filters targets to only those that can be detected
 * @param observerPos Position of the observing unit
 * @param observerType Type of observing unit
 * @param targets Array of targets with position and type
 * @param environment Current environmental conditions
 * @returns Array of detected targets with their detection results
 */
export function filterDetectableTargets(
  observerPos: Position,
  observerType: ObserverType,
  targets: TargetWithType[],
  environment: Environment | null
): BatchDetectionResult[] {
  const allResults = detectMultipleTargets(observerPos, observerType, targets, environment);
  return allResults.filter(result => result.detected);
}

/**
 * Calculates position accuracy based on distance and observer type
 * Farther targets have less accurate position estimates
 * @param distance Distance to target in meters
 * @param observerType Type of observer
 * @returns Position accuracy in meters (higher = less accurate)
 */
export function calculatePositionAccuracy(
  distance: number,
  observerType: ObserverType
): number {
  // Base accuracy increases with distance
  // At 100m: ~5m accuracy, at 500m: ~25m accuracy
  const baseAccuracy = distance * 0.05;

  // Observer type modifiers
  const accuracyModifiers: Record<ObserverType, number> = {
    [ObserverType.INFANTRY]: 1.0,     // Base accuracy
    [ObserverType.VEHICLE]: 0.7,      // 30% better due to optics
    [ObserverType.AIRCRAFT]: 1.5,     // 50% worse due to distance/angle
    [ObserverType.SENSOR]: 0.5,       // 50% better due to precision
  };

  const modifier = accuracyModifiers[observerType] || 1.0;

  // Minimum accuracy of 5 meters, maximum of 200 meters
  return Math.max(5, Math.min(200, baseAccuracy * modifier));
}

/**
 * Estimates confidence level based on detection conditions
 * @param detectionResult Result from canDetect
 * @param observerType Type of observer
 * @returns Confidence level 0-1
 */
export function estimateInitialConfidence(
  detectionResult: DetectionResult,
  observerType: ObserverType
): number {
  if (!detectionResult.detected) {
    return 0;
  }

  // Base confidence from margin (how clearly in range)
  // Detected at edge of range = lower confidence
  // Detected well within range = higher confidence
  const marginRatio = detectionResult.margin / detectionResult.effectiveRange;
  const baseConfidence = 0.5 + (marginRatio * 0.4); // 0.5-0.9 based on margin

  // Visibility modifier affects confidence
  const visibilityFactor = 0.3 + (detectionResult.visibilityModifier * 0.7);

  // Observer type bonus
  const observerBonus: Record<ObserverType, number> = {
    [ObserverType.INFANTRY]: 0,
    [ObserverType.VEHICLE]: 0.05,
    [ObserverType.AIRCRAFT]: -0.05,
    [ObserverType.SENSOR]: 0.1,
  };

  const confidence = baseConfidence * visibilityFactor + (observerBonus[observerType] || 0);

  // Clamp between 0.2 and 1.0
  return Math.max(0.2, Math.min(1.0, confidence));
}
