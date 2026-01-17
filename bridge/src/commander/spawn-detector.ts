/**
 * Spawn Detector - Parses LLM responses to detect spawn requests
 *
 * Extracts spawn type, count, and validates against resources before execution.
 * This enables automatic resource deduction for LLM-driven spawns.
 */

import { logger } from '../utils/logger';
import { UnitPoolType } from './resources/types';

export interface DetectedSpawn {
  /** Type of unit being spawned */
  spawnType: 'infantry' | 'lightVehicle' | 'heavyArmor' | 'helicopter' | 'fixedWing' | 'unknown';
  /** Number of units/vehicles */
  count: number;
  /** Confidence level of detection (0-1) */
  confidence: number;
  /** Raw classnames found in SQF */
  classnames: string[];
  /** Is this a vehicle spawn with crew? */
  hasVehicle: boolean;
  /** Is this a helicopter transport mission? */
  isHeliTransport: boolean;
}

// Classname patterns for detection
const INFANTRY_PATTERNS = [
  /soldier/i, /rifleman/i, /medic/i, /grenadier/i, /autorifleman/i,
  /machinegunner/i, /marksman/i, /sniper/i, /at\b/i, /aa\b/i,
  /teamleader/i, /squadleader/i, /sergeant/i, /officer/i,
  /_sl_/i, /_tl_/i, /_ar_/i, /_mg_/i,
];

const LIGHT_VEHICLE_PATTERNS = [
  /hmmwv/i, /humvee/i, /m1025/i, /m998/i, /offroad/i, /technical/i,
  /tigr/i, /uaz/i, /ifrit/i, /hunter/i, /prowler/i, /qilin/i,
  /van_01/i, /truck_01/i, /m1220/i,
];

const HEAVY_ARMOR_PATTERNS = [
  /apc/i, /ifv/i, /tank/i, /mbt/i, /btr/i, /bmp/i, /bmd/i,
  /m113/i, /m2a3/i, /m1a1/i, /m1a2/i, /abrams/i, /bradley/i,
  /t72/i, /t80/i, /t90/i, /t14/i, /armata/i,
  /marshall/i, /gorgon/i, /mora/i, /kamysh/i, /varsuk/i,
  /slammer/i, /kuma/i, /angara/i,
  /tracked.*cannon/i, /wheeled.*cannon/i,
];

const HELICOPTER_PATTERNS = [
  /heli/i, /uh60/i, /uh1/i, /ch47/i, /chinook/i, /blackhawk/i,
  /mi8/i, /mi24/i, /mi28/i, /ka52/i, /havoc/i, /hind/i,
  /ah64/i, /apache/i, /ah6/i, /mh6/i, /littlebird/i,
  /ghosthawk/i, /hellcat/i, /orca/i, /taru/i, /mohawk/i,
  /stealth.*hawk/i, /melb/i, /soar/i,
];

const FIXED_WING_PATTERNS = [
  /jet/i, /plane/i, /a10/i, /f22/i, /f35/i, /su25/i, /su34/i,
  /wipeout/i, /neophron/i, /shikra/i, /black.*wasp/i, /gryphon/i,
  /buzzard/i, /caesar/i,
];

/**
 * Detect spawn type from a classname
 */
function detectClassnameType(classname: string): 'infantry' | 'lightVehicle' | 'heavyArmor' | 'helicopter' | 'fixedWing' | 'unknown' {
  if (HELICOPTER_PATTERNS.some(p => p.test(classname))) return 'helicopter';
  if (FIXED_WING_PATTERNS.some(p => p.test(classname))) return 'fixedWing';
  if (HEAVY_ARMOR_PATTERNS.some(p => p.test(classname))) return 'heavyArmor';
  if (LIGHT_VEHICLE_PATTERNS.some(p => p.test(classname))) return 'lightVehicle';
  if (INFANTRY_PATTERNS.some(p => p.test(classname))) return 'infantry';
  return 'unknown';
}

/**
 * Extract classnames from SQF code
 */
function extractClassnames(sqf: string): string[] {
  const classnames: string[] = [];

  // Match single-quoted strings that look like classnames
  const singleQuoteMatches = sqf.match(/'([A-Za-z0-9_]+)'/g);
  if (singleQuoteMatches) {
    singleQuoteMatches.forEach(match => {
      const classname = match.replace(/'/g, '');
      // Filter out SQF commands and keep only likely classnames
      if (classname.length > 3 && !isSQFCommand(classname)) {
        classnames.push(classname);
      }
    });
  }

  // Match double-quoted strings (shouldn't happen but just in case)
  const doubleQuoteMatches = sqf.match(/"([A-Za-z0-9_]+)"/g);
  if (doubleQuoteMatches) {
    doubleQuoteMatches.forEach(match => {
      const classname = match.replace(/"/g, '');
      if (classname.length > 3 && !isSQFCommand(classname)) {
        classnames.push(classname);
      }
    });
  }

  return [...new Set(classnames)]; // Remove duplicates
}

/**
 * Check if a string is a known SQF command (not a classname)
 */
function isSQFCommand(str: string): boolean {
  const sqfCommands = [
    'spawn', 'call', 'execvm', 'true', 'false', 'nil', 'private',
    'form', 'none', 'cargo', 'aware', 'combat', 'safe', 'careless',
    'move', 'sad', 'getout', 'getin', 'hold', 'dismiss', 'patrol',
    'west', 'east', 'guer', 'independent', 'civilian', 'sidelogic',
    'red', 'yellow', 'green', 'blue', 'white',
  ];
  return sqfCommands.includes(str.toLowerCase());
}

/**
 * Count createUnit calls in SQF
 */
function countCreateUnitCalls(sqf: string): number {
  const matches = sqf.match(/createUnit/gi);
  return matches ? matches.length : 0;
}

/**
 * Count forEach loops that create units
 */
function countForEachUnits(sqf: string): number {
  // Look for patterns like: forEach ['class1', 'class2'] or forEach units
  const forEachMatches = sqf.match(/forEach\s*\[([^\]]+)\]/gi);
  if (!forEachMatches) return 0;

  let total = 0;
  forEachMatches.forEach(match => {
    // Count comma-separated items in the array
    const items = match.match(/'/g);
    if (items) {
      total += items.length / 2; // Each classname has 2 quotes
    }
  });
  return Math.max(1, Math.floor(total));
}

/**
 * Detect if this is a vehicle spawn with createVehicle
 */
function hasVehicleSpawn(sqf: string): boolean {
  return /createVehicle/i.test(sqf);
}

/**
 * Detect if this is a helicopter transport (units moveInCargo)
 */
function isHeliTransportMission(sqf: string, classnames: string[]): boolean {
  const hasHeli = classnames.some(c => detectClassnameType(c) === 'helicopter');
  const hasMoveInCargo = /moveInCargo/i.test(sqf);
  return hasHeli && hasMoveInCargo;
}

/**
 * Parse LLM response metadata for spawn info
 */
function parseSpawnMetadata(response: string): { type?: string; count?: number } {
  const result: { type?: string; count?: number } = {};

  // Look for SPAWN_TYPE: in response
  const typeMatch = response.match(/SPAWN_TYPE:\s*(infantry|lightVehicle|heavyArmor|helicopter|fixedWing|none)/i);
  if (typeMatch) {
    result.type = typeMatch[1].toLowerCase();
  }

  // Look for SPAWN_COUNT: in response
  const countMatch = response.match(/SPAWN_COUNT:\s*(\d+)/i);
  if (countMatch) {
    result.count = parseInt(countMatch[1], 10);
  }

  return result;
}

/**
 * Main spawn detection function
 */
export function detectSpawn(sqf: string, rawResponse?: string): DetectedSpawn {
  const classnames = extractClassnames(sqf);
  const metadata = rawResponse ? parseSpawnMetadata(rawResponse) : {};

  // Determine spawn types from classnames
  const types = classnames.map(c => detectClassnameType(c));
  const typeCounts: Record<string, number> = {
    infantry: 0,
    lightVehicle: 0,
    heavyArmor: 0,
    helicopter: 0,
    fixedWing: 0,
    unknown: 0,
  };

  types.forEach(t => typeCounts[t]++);

  // Determine primary spawn type (highest count, prioritizing vehicles)
  let primaryType: DetectedSpawn['spawnType'] = 'unknown';
  let maxCount = 0;

  // Priority order: fixedWing > helicopter > heavyArmor > lightVehicle > infantry
  const priority = ['fixedWing', 'helicopter', 'heavyArmor', 'lightVehicle', 'infantry'] as const;
  for (const type of priority) {
    if (typeCounts[type] > 0) {
      primaryType = type;
      maxCount = typeCounts[type];
      break;
    }
  }

  // If metadata specifies a type, trust it
  if (metadata.type && metadata.type !== 'none') {
    primaryType = metadata.type as DetectedSpawn['spawnType'];
  }

  // Count units
  let count = 1;
  if (metadata.count && metadata.count > 0) {
    count = metadata.count;
  } else {
    // Estimate from SQF
    const createUnitCount = countCreateUnitCalls(sqf);
    const forEachCount = countForEachUnits(sqf);
    count = Math.max(1, createUnitCount, forEachCount);

    // For vehicles, count vehicle spawns
    if (primaryType !== 'infantry' && hasVehicleSpawn(sqf)) {
      const vehicleMatches = sqf.match(/createVehicle/gi);
      count = vehicleMatches ? vehicleMatches.length : 1;
    }
  }

  // Calculate confidence
  let confidence = 0.5;
  if (metadata.type) confidence += 0.3;
  if (metadata.count) confidence += 0.2;
  if (classnames.length > 0) confidence = Math.min(1, confidence + 0.1);

  const result: DetectedSpawn = {
    spawnType: primaryType,
    count,
    confidence,
    classnames,
    hasVehicle: hasVehicleSpawn(sqf),
    isHeliTransport: isHeliTransportMission(sqf, classnames),
  };

  logger.debug('Spawn detected', {
    spawnType: result.spawnType,
    count: result.count,
    confidence: result.confidence,
    classnames: result.classnames.slice(0, 5),
  });

  return result;
}

/**
 * Map spawn type to unit pool type
 */
export function spawnTypeToPoolType(spawnType: DetectedSpawn['spawnType']): UnitPoolType {
  switch (spawnType) {
    case 'infantry': return 'infantry';
    case 'lightVehicle': return 'lightVehicle';
    case 'heavyArmor': return 'heavyArmor';
    case 'helicopter': return 'helicopter';
    case 'fixedWing': return 'fixedWing';
    default: return 'infantry';
  }
}

/**
 * Get ticket cost for a detected spawn
 */
export function getSpawnTicketCost(spawn: DetectedSpawn): number {
  const baseCosts: Record<string, number> = {
    infantry: 1,
    lightVehicle: 5,
    heavyArmor: 15,
    helicopter: 20,
    fixedWing: 30,
    unknown: 1,
  };

  const baseCost = baseCosts[spawn.spawnType] || 1;

  // For heli transport, charge for both heli and troops
  if (spawn.isHeliTransport) {
    return baseCost + spawn.count; // Heli cost + infantry cost per troop
  }

  return baseCost * spawn.count;
}
