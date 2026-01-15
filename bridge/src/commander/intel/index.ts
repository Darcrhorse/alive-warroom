/**
 * Intel Module Index
 * Exports all types, interfaces, classes, and functions for the AI Commander
 * intelligence and fog of war system
 */

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

// Enums
export {
  IntelSource,
  IntelLevel,
  FogOfWarMode,
  TargetType,
} from './types';

// Type aliases
export type { CommanderSide } from './types';

// Interfaces
export type {
  StrengthEstimate,
  IntelReport,
  CreateIntelReportParams,
  ContactArea,
  CommanderIntel,
  IntelStatistics,
  IntelDecayConfig,
} from './types';

// Constants
export {
  DEFAULT_DECAY_CONFIG,
  MAX_REPORTS_PER_SIDE,
  DEFAULT_DETECTION_RANGES,
} from './types';

// =============================================================================
// DETECTION SYSTEM
// =============================================================================

// Enum
export { ObserverType } from './detection';

// Interfaces
export type {
  DetectionResult,
  TargetWithType,
  BatchDetectionResult,
} from './detection';

// Functions
export {
  calculateDistance,
  calculateHorizontalDistance,
  getBaseDetectionRange,
  getDetectionRange,
  calculateVisibilityModifier,
  getEffectiveDetectionRange,
  isInDetectionRange,
  canDetect,
  detectMultipleTargets,
  filterDetectableTargets,
  calculatePositionAccuracy,
  estimateInitialConfidence,
} from './detection';

// =============================================================================
// INTEL MANAGER
// =============================================================================

// Class
export { IntelManager } from './intel-manager';

// Factory function
export { createIntelManager } from './intel-manager';
