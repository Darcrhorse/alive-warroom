/**
 * Type definitions for AI Commander intelligence and fog of war system
 */

import { Position } from '../../game-state/types';

/**
 * Source of intelligence report
 */
export enum IntelSource {
  VISUAL = 'visual',       // Direct visual contact by units
  RECON = 'recon',         // Reconnaissance patrol reports
  REPORT = 'report',       // Radio/communication reports
  PLAYER = 'player',       // Player-submitted intel
  SENSOR = 'sensor',       // Electronic/sensor detection
}

/**
 * 4-tier intelligence classification level
 */
export enum IntelLevel {
  NO_INTEL = 'no_intel',   // Unknown - no information available
  STALE = 'stale',         // Outdated - >5min since last contact
  ACTIVE = 'active',       // Real-time - recent contact
  CONFIRMED = 'confirmed', // Multi-source verified intel
}

/**
 * Fog of war operating mode
 */
export enum FogOfWarMode {
  FULL = 'full',           // Units-only visibility (realistic)
  PARTIAL = 'partial',     // Occasional updates/hints
  NONE = 'none',           // Full visibility (debug mode)
}

/**
 * Target type classification for intel reports
 */
export enum TargetType {
  INFANTRY = 'infantry',
  VEHICLE = 'vehicle',
  ARMOR = 'armor',
  AIRCRAFT = 'aircraft',
  INSTALLATION = 'installation', // Static targets (no decay)
  UNKNOWN = 'unknown',
}

/**
 * Commander side affiliation
 */
export type CommanderSide = 'EAST' | 'WEST';

/**
 * Estimated strength of enemy formation
 */
export interface StrengthEstimate {
  min: number;             // Minimum estimated count
  max: number;             // Maximum estimated count
  confidence: number;      // 0-1 confidence in estimate
  composition: {
    infantry: number;
    vehicles: number;
    armor: number;
    aircraft: number;
  };
}

/**
 * Individual intelligence report on enemy activity
 */
export interface IntelReport {
  id: string;              // Unique ID prefixed by source (e.g., visual_123, recon_456)
  source: IntelSource;     // How intel was gathered
  sourceCount: number;     // Number of confirming sources
  targetType: TargetType;  // Classification of target
  position: Position;      // Last known position
  positionAccuracy: number; // Accuracy in meters (higher = less accurate)
  heading: number | null;  // Direction of movement (0-360) or null if unknown
  speed: number | null;    // Movement speed (m/s) or null if unknown
  strength: StrengthEstimate; // Estimated enemy strength
  timestamp: number;       // When intel was gathered (epoch ms)
  lastUpdated: number;     // When report was last updated (epoch ms)
  confidence: number;      // 0-1 confidence level (decays over time)
  stale: boolean;          // True if intel is outdated (>5min)
  level: IntelLevel;       // Current classification level
  notes: string;           // Additional context or observations
}

/**
 * Parameters for creating a new intel report
 */
export interface CreateIntelReportParams {
  source: IntelSource;
  targetType: TargetType;
  position: Position;
  positionAccuracy?: number;
  heading?: number | null;
  speed?: number | null;
  strength?: Partial<StrengthEstimate>;
  confidence?: number;
  notes?: string;
}

/**
 * Contact area where enemy activity was detected
 */
export interface ContactArea {
  id: string;
  center: Position;
  radius: number;          // Area of uncertainty in meters
  lastContact: number;     // Timestamp of last contact
  reportIds: string[];     // Related intel report IDs
  threatLevel: number;     // 0-1 assessed threat level
}

/**
 * Complete intelligence picture for a commander
 */
export interface CommanderIntel {
  side: CommanderSide;
  knownEnemies: IntelReport[];           // All known enemy reports
  lastContactAreas: ContactArea[];       // Areas with recent enemy activity
  suspectedPositions: IntelReport[];     // Low confidence/stale reports
  confirmedTargets: IntelReport[];       // Multi-source verified targets
  fogOfWarMode: FogOfWarMode;            // Current fog of war setting
  lastUpdateTime: number;                // When intel picture was last updated
}

/**
 * Intel statistics for debugging and monitoring
 */
export interface IntelStatistics {
  totalReports: number;
  byLevel: Record<IntelLevel, number>;
  bySource: Record<IntelSource, number>;
  byTargetType: Record<TargetType, number>;
  averageConfidence: number;
  staleCount: number;
  activeCount: number;
  confirmedCount: number;
  oldestReport: number | null;           // Timestamp of oldest report
  newestReport: number | null;           // Timestamp of newest report
}

/**
 * Configuration for intel decay behavior
 */
export interface IntelDecayConfig {
  decayRatePerMinute: number;            // Confidence loss per minute (default 0.1 = 10%)
  staleThresholdMinutes: number;         // Minutes until report becomes stale (default 5)
  purgeThresholdMinutes: number;         // Minutes until mobile targets are purged (default 15)
  confidenceFloor: number;               // Minimum confidence (default 0.1 = 10%)
  decayIntervalMs: number;               // How often to run decay (default 60000 = 1 min)
}

/**
 * Default decay configuration values
 */
export const DEFAULT_DECAY_CONFIG: IntelDecayConfig = {
  decayRatePerMinute: 0.1,               // 10% per minute
  staleThresholdMinutes: 5,              // Stale after 5 minutes
  purgeThresholdMinutes: 15,             // Purge after 15 minutes
  confidenceFloor: 0.1,                  // Never below 10%
  decayIntervalMs: 60000,                // Check every minute
};

/**
 * Maximum reports per side to prevent memory issues
 */
export const MAX_REPORTS_PER_SIDE = 100;

/**
 * Detection range defaults by unit type (in meters)
 */
export const DEFAULT_DETECTION_RANGES: Record<TargetType, number> = {
  [TargetType.INFANTRY]: 300,
  [TargetType.VEHICLE]: 500,
  [TargetType.ARMOR]: 600,
  [TargetType.AIRCRAFT]: 1000,
  [TargetType.INSTALLATION]: 800,
  [TargetType.UNKNOWN]: 400,
};
