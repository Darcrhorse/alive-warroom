/**
 * MCP Client for Arma 3 Asset Lookups
 * Provides search functions for the AI Game Master to find correct classnames
 */

import { armaDatabase, ArmaAsset, armaAssets } from './arma-data';
import { logger } from '../utils/logger';

export interface SearchResult {
  classname: string;
  displayName: string;
  side: string;
  category: string;
  subcategory?: string;
}

/**
 * Search for units (infantry) by query and side
 */
export function searchUnits(query: string, side?: 'EAST' | 'WEST'): SearchResult[] {
  const queryLower = query.toLowerCase();

  let results = armaDatabase.filter(asset =>
    asset.category === 'infantry' &&
    (asset.displayName.toLowerCase().includes(queryLower) ||
     asset.subcategory?.toLowerCase().includes(queryLower) ||
     asset.classname.toLowerCase().includes(queryLower))
  );

  if (side) {
    results = results.filter(asset => asset.side === side);
  }

  logger.debug('searchUnits', { query, side, resultCount: results.length });

  return results.slice(0, 10).map(asset => ({
    classname: asset.classname,
    displayName: asset.displayName,
    side: asset.side,
    category: asset.category,
    subcategory: asset.subcategory,
  }));
}

/**
 * Search for vehicles by type and side
 */
export function searchVehicles(
  vehicleType: 'ground' | 'air' | 'any',
  side?: 'EAST' | 'WEST',
  subcategory?: string
): SearchResult[] {
  let results: ArmaAsset[];

  if (vehicleType === 'ground') {
    results = armaDatabase.filter(asset => asset.category === 'ground_vehicle');
  } else if (vehicleType === 'air') {
    results = armaDatabase.filter(asset => asset.category === 'air_vehicle');
  } else {
    results = armaDatabase.filter(asset =>
      asset.category === 'ground_vehicle' || asset.category === 'air_vehicle'
    );
  }

  if (side) {
    results = results.filter(asset => asset.side === side);
  }

  if (subcategory) {
    const subLower = subcategory.toLowerCase();
    results = results.filter(asset =>
      asset.subcategory?.toLowerCase().includes(subLower)
    );
  }

  logger.debug('searchVehicles', { vehicleType, side, subcategory, resultCount: results.length });

  return results.slice(0, 10).map(asset => ({
    classname: asset.classname,
    displayName: asset.displayName,
    side: asset.side,
    category: asset.category,
    subcategory: asset.subcategory,
  }));
}

/**
 * Search for any asset type by query
 */
export function searchAssets(query: string, side?: 'EAST' | 'WEST'): SearchResult[] {
  const queryLower = query.toLowerCase();

  let results = armaDatabase.filter(asset =>
    asset.displayName.toLowerCase().includes(queryLower) ||
    asset.subcategory?.toLowerCase().includes(queryLower) ||
    asset.classname.toLowerCase().includes(queryLower) ||
    asset.category.toLowerCase().includes(queryLower)
  );

  if (side) {
    results = results.filter(asset => asset.side === side);
  }

  logger.debug('searchAssets', { query, side, resultCount: results.length });

  return results.slice(0, 10).map(asset => ({
    classname: asset.classname,
    displayName: asset.displayName,
    side: asset.side,
    category: asset.category,
    subcategory: asset.subcategory,
  }));
}

/**
 * Get a specific asset by classname
 */
export function getAssetInfo(classname: string): SearchResult | null {
  const asset = armaDatabase.find(a =>
    a.classname.toLowerCase() === classname.toLowerCase()
  );

  if (!asset) {
    logger.debug('getAssetInfo - not found', { classname });
    return null;
  }

  logger.debug('getAssetInfo - found', { classname, displayName: asset.displayName });

  return {
    classname: asset.classname,
    displayName: asset.displayName,
    side: asset.side,
    category: asset.category,
    subcategory: asset.subcategory,
  };
}

/**
 * Get recommended assets for a tactical situation
 */
export function getRecommendedAssets(
  situation: 'infantry_patrol' | 'armor_assault' | 'air_support' | 'reinforcement' | 'sniper_team',
  side: 'EAST' | 'WEST'
): SearchResult[] {
  let results: ArmaAsset[] = [];

  switch (situation) {
    case 'infantry_patrol':
      results = armaDatabase.filter(a =>
        a.side === side &&
        a.category === 'infantry' &&
        ['rifleman', 'machinegunner', 'leader', 'grenadier'].includes(a.subcategory || '')
      );
      break;
    case 'armor_assault':
      results = armaDatabase.filter(a =>
        a.side === side &&
        a.category === 'ground_vehicle' &&
        ['tank', 'apc'].includes(a.subcategory || '')
      );
      break;
    case 'air_support':
      results = armaDatabase.filter(a =>
        a.side === side &&
        a.category === 'air_vehicle' &&
        ['attack_heli', 'cas', 'light_attack_heli'].includes(a.subcategory || '')
      );
      break;
    case 'reinforcement':
      results = [
        ...armaDatabase.filter(a => a.side === side && a.category === 'infantry').slice(0, 5),
        ...armaDatabase.filter(a => a.side === side && a.subcategory === 'transport_heli').slice(0, 2),
      ];
      break;
    case 'sniper_team':
      results = armaDatabase.filter(a =>
        a.side === side &&
        a.category === 'infantry' &&
        ['sniper', 'recon'].includes(a.subcategory || '')
      );
      break;
  }

  logger.debug('getRecommendedAssets', { situation, side, resultCount: results.length });

  return results.slice(0, 8).map(asset => ({
    classname: asset.classname,
    displayName: asset.displayName,
    side: asset.side,
    category: asset.category,
    subcategory: asset.subcategory,
  }));
}

/**
 * Get database statistics
 */
export function getDatabaseStats(): { total: number; bySide: Record<string, number>; byCategory: Record<string, number> } {
  const stats = {
    total: armaDatabase.length,
    bySide: {} as Record<string, number>,
    byCategory: {} as Record<string, number>,
  };

  armaDatabase.forEach(asset => {
    stats.bySide[asset.side] = (stats.bySide[asset.side] || 0) + 1;
    stats.byCategory[asset.category] = (stats.byCategory[asset.category] || 0) + 1;
  });

  return stats;
}

// Export all functions for use in Claude tool handlers
export const mcpClient = {
  searchUnits,
  searchVehicles,
  searchAssets,
  getAssetInfo,
  getRecommendedAssets,
  getDatabaseStats,
};
