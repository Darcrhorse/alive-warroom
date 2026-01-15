/**
 * Strategic Objective System - Module Exports
 *
 * This module provides the strategic objective system for AI Commanders,
 * including types, management, scoring, and SQF code generation.
 *
 * @module commander/objectives
 */

// Export all types
export {
  ObjectiveOwner,
  ObjectiveStatus,
  ObjectiveType,
  IntelQuality,
  BaseObjective,
  CaptureObjective,
  DefendObjective,
  DestroyObjective,
  PatrolObjective,
  HVTObjective,
  Objective,
  CreateObjectiveParams,
  UpdateObjectiveParams,
  ObjectiveScoringContext,
  ObjectiveScore,
  ObjectiveFilter
} from './types';

// Export manager class and singleton
export { ObjectiveManager, objectiveManager } from './manager';

// Export scorer class and singleton
export { ObjectiveScorer, objectiveScorer } from './scorer';

// Export SQF generator class, singleton, and related interfaces
export {
  ObjectiveSQFGenerator,
  objectiveSQFGenerator,
  MarkerParams,
  CaptureTriggerParams,
  DefendTriggerParams,
  DestroyTriggerParams,
  PatrolRouteParams,
  HVTTriggerParams,
  StatusReportParams
} from './sqf-generator';
