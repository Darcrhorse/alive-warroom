/**
 * Common SQF code templates for various GM actions
 * Based on Arma 3 Community Wiki documentation
 */

import { Position } from '../game-state/types';

export interface SpawnInfantryParams {
  position: Position;
  side: 'EAST' | 'WEST' | 'INDEPENDENT' | 'CIVILIAN';
  unitTypes: string[];
  skill?: number;
  behavior?: string;
  combatMode?: string;
  patrolRadius?: number;
}

export interface SpawnVehicleParams {
  position: Position;
  vehicleType: string;
  side: 'EAST' | 'WEST' | 'INDEPENDENT' | 'CIVILIAN';
  crew?: boolean;
  crewSkill?: number;
}

export interface CreateObjectiveParams {
  position: Position;
  title: string;
  description: string;
  type: 'ATTACK' | 'DEFEND' | 'MOVE' | 'DESTROY' | 'SEARCH';
  assignTo?: string[];
}

export class SQFTemplates {
  /**
   * Generate SQF to spawn infantry group
   */
  spawnInfantry(params: SpawnInfantryParams): string {
    const {
      position,
      side,
      unitTypes,
      skill = 0.5,
      behavior = 'AWARE',
      combatMode = 'YELLOW',
      patrolRadius = 150
    } = params;

    return `
// Spawn infantry group
private _spawnPos = [${position.x}, ${position.y}, ${position.z}];
private _unitTypes = ${JSON.stringify(unitTypes)};
private _group = createGroup ${side};

{
  private _unit = _group createUnit [_x, _spawnPos, [], 0, "FORM"];
  _unit setSkill ${skill};
} forEach _unitTypes;

// Set group behavior
_group setBehaviour "${behavior}";
_group setCombatMode "${combatMode}";

// Add patrol waypoints
[_group, _spawnPos, ${patrolRadius}] call BIS_fnc_taskPatrol;

// Store group reference for tracking
missionNamespace setVariable ["LLMGM_lastSpawnedGroup", _group];
_group
`.trim();
  }

  /**
   * Generate SQF to spawn vehicle
   */
  spawnVehicle(params: SpawnVehicleParams): string {
    const {
      position,
      vehicleType,
      side,
      crew = true,
      crewSkill = 0.5
    } = params;

    return `
// Spawn vehicle
private _spawnPos = [${position.x}, ${position.y}, ${position.z}];
private _vehicle = createVehicle ["${vehicleType}", _spawnPos, [], 0, "NONE"];

${crew ? `
// Add crew
private _group = createVehicleCrew _vehicle;
_group setBehaviour "AWARE";
_group setCombatMode "YELLOW";
{
  _x setSkill ${crewSkill};
} forEach units _group;
` : ''}

// Store vehicle reference
missionNamespace setVariable ["LLMGM_lastSpawnedVehicle", _vehicle];
_vehicle
`.trim();
  }

  /**
   * Generate SQF to create task/objective
   */
  createObjective(params: CreateObjectiveParams): string {
    const {
      position,
      title,
      description,
      type,
      assignTo = []
    } = params;

    const taskId = `LLMGM_task_${Date.now()}`;
    const assignToStr = assignTo.length > 0 ? JSON.stringify(assignTo) : 'true'; // true = all players

    return `
// Create task/objective
private _taskId = "${taskId}";
private _taskTitle = "${title}";
private _taskDescription = "${description}";
private _taskPos = [${position.x}, ${position.y}, ${position.z}];
private _taskType = "${type}";

[
  ${assignToStr},
  _taskId,
  [_taskDescription, _taskTitle, ""],
  _taskPos,
  "CREATED",
  1,
  true,
  _taskType
] call BIS_fnc_taskCreate;

// Store task reference
missionNamespace setVariable ["LLMGM_lastCreatedTask", _taskId];
_taskId
`.trim();
  }

  /**
   * Generate SQF to send radio message
   */
  sendRadioMessage(message: string, sender: string = 'HQ'): string {
    return `
// Send radio message
[${sender}, "${message}"] remoteExec ["sideChat", 0];
`.trim();
  }

  /**
   * Generate SQF to spawn reinforcements near position
   */
  spawnReinforcements(position: Position, side: string, strength: 'light' | 'medium' | 'heavy'): string {
    const unitConfigs = {
      light: ['O_Soldier_TL_F', 'O_Soldier_F', 'O_Soldier_F', 'O_Soldier_AR_F'],
      medium: ['O_Soldier_TL_F', 'O_Soldier_F', 'O_Soldier_F', 'O_Soldier_AR_F', 'O_medic_F', 'O_Soldier_AT_F'],
      heavy: ['O_Soldier_SL_F', 'O_Soldier_TL_F', 'O_Soldier_F', 'O_Soldier_F', 'O_Soldier_AR_F', 'O_HeavyGunner_F', 'O_medic_F', 'O_Soldier_AT_F']
    };

    return this.spawnInfantry({
      position,
      side: side as any,
      unitTypes: unitConfigs[strength],
      skill: strength === 'heavy' ? 0.7 : strength === 'medium' ? 0.5 : 0.3
    });
  }

  /**
   * Generate SQF to adjust difficulty dynamically
   */
  adjustDifficulty(skillModifier: number): string {
    return `
// Adjust AI difficulty
{
  _x setSkill ${Math.max(0, Math.min(1, skillModifier))};
} forEach allUnits select {side _x == EAST};
`.trim();
  }
}

export const sqfTemplates = new SQFTemplates();
