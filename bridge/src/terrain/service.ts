/**
 * Terrain Context Service - Simplified version
 */

export interface TerrainContext {
  mapName: string;
  centerLocation: any;
  validInfantrySpawns: any[];
  validVehicleSpawns: any[];
}

export function formatTerrainForLLM(terrain: TerrainContext): string {
  return `Terrain: ${terrain.mapName}`;
}
