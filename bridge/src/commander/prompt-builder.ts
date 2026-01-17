/**
 * Resource-Aware Prompt Builder for AI Commanders
 *
 * Builds LLM prompts that include:
 * - Current resource state (tickets, pools, support assets)
 * - Staging area information
 * - Faction-specific unit classnames
 * - Spawn cost reference
 */

import { GameState, EventHistory } from '../game-state/types';
import { resourceManager, DEFAULT_SPAWN_COSTS } from './resources';
import { CommanderConfig, DEFAULT_COMMANDERS, FactionConfig } from './config';

export interface CommanderPromptContext {
  side: 'WEST' | 'EAST' | 'INDEPENDENT';
  gameState: GameState;
  history: EventHistory;
  config?: CommanderConfig;
}

/**
 * Build the resource state section for the prompt
 */
function buildResourceSection(side: 'WEST' | 'EAST'): string {
  const resources = resourceManager.getResources(side);
  const poolStatus = resourceManager.getPoolStatus(side);
  const supportStatus = resourceManager.getSupportAssetStatus(side);

  return `
## YOUR RESOURCES (${side})

### Tickets
- Current: ${resources.tickets}/${resources.maxTickets}
- Regeneration: ${resources.ticketRegen + resources.bonusTicketIncome}/minute
${resources.tickets < 30 ? '⚠️ LOW TICKETS - conserve resources!' : ''}

### Unit Pools (Available/Max)
- Infantry: ${poolStatus.infantry.available}/${poolStatus.infantry.max} ${poolStatus.infantry.exhausted ? '❌ EXHAUSTED' : poolStatus.infantry.criticallyLow ? '⚠️ LOW' : ''}
- Light Vehicles: ${poolStatus.lightVehicle.available}/${poolStatus.lightVehicle.max} ${poolStatus.lightVehicle.exhausted ? '❌ EXHAUSTED' : poolStatus.lightVehicle.criticallyLow ? '⚠️ LOW' : ''}
- Heavy Armor: ${poolStatus.heavyArmor.available}/${poolStatus.heavyArmor.max} ${poolStatus.heavyArmor.exhausted ? '❌ EXHAUSTED' : poolStatus.heavyArmor.criticallyLow ? '⚠️ LOW' : ''}
- Helicopters: ${poolStatus.helicopter.available}/${poolStatus.helicopter.max} ${poolStatus.helicopter.exhausted ? '❌ EXHAUSTED' : poolStatus.helicopter.criticallyLow ? '⚠️ LOW' : ''}
- Fixed Wing: ${poolStatus.fixedWing.available}/${poolStatus.fixedWing.max} ${poolStatus.fixedWing.exhausted ? '❌ EXHAUSTED' : poolStatus.fixedWing.criticallyLow ? '⚠️ LOW' : ''}

### Support Assets
- Artillery Strikes: ${supportStatus.artilleryStrikes.available} ${supportStatus.artilleryStrikes.exhausted ? '❌ NONE' : ''}
- CAS Sorties: ${supportStatus.casSorties.available} ${supportStatus.casSorties.exhausted ? '❌ NONE' : ''}
- Resupply Drops: ${supportStatus.resupplyDrops.available} ${supportStatus.resupplyDrops.exhausted ? '❌ NONE' : ''}
- Medevac Missions: ${supportStatus.medevacMissions.available} ${supportStatus.medevacMissions.exhausted ? '❌ NONE' : ''}

### Active Units: ${resources.activeUnits}/${resources.maxActiveUnits}
${resources.activeUnits >= resources.maxActiveUnits * 0.8 ? '⚠️ Approaching unit cap!' : ''}

### Spawn Cooldown: ${resourceManager.isOnCooldown(side) ? '⏳ ON COOLDOWN - wait before spawning' : '✅ Ready'}
`.trim();
}

/**
 * Build spawn cost reference section
 */
function buildSpawnCostSection(): string {
  return `
## SPAWN COSTS (Tickets)
| Unit Type | Cost | Pool |
|-----------|------|------|
| Infantry Squad (4-6 units) | ${DEFAULT_SPAWN_COSTS.infantry} | infantry |
| Light Vehicle (HMMWV, Technical) | ${DEFAULT_SPAWN_COSTS.lightVehicle} | lightVehicle |
| APC | ${DEFAULT_SPAWN_COSTS.apc || 10} | heavyArmor |
| Tank | ${DEFAULT_SPAWN_COSTS.tank || 20} | heavyArmor |
| Transport Helicopter | ${DEFAULT_SPAWN_COSTS.helicopter} | helicopter |
| Attack Helicopter | ${DEFAULT_SPAWN_COSTS.attack_heli || 35} | helicopter |
| Fixed Wing | ${DEFAULT_SPAWN_COSTS.fixedWing} | fixedWing |
`.trim();
}

/**
 * Build staging area section
 */
function buildStagingSection(config: CommanderConfig): string {
  if (config.stagingAreas.length === 0) {
    return '## STAGING AREAS\nNo staging areas configured.';
  }

  const stagingList = config.stagingAreas.map(s =>
    `- **${s.name}** (${s.type}): [${s.position[0]}, ${s.position[1]}] - +${s.ticketBonus} tickets/min`
  ).join('\n');

  return `
## STAGING AREAS
${stagingList}

**Primary Staging:** ${config.primaryStaging}
IMPORTANT: All reinforcements MUST spawn from a staging area and travel to objectives!
`.trim();
}

/**
 * Build faction classnames section
 */
function buildFactionSection(faction: FactionConfig): string {
  return `
## YOUR FACTION: ${faction.name}

### Infantry Classnames
${faction.infantry.slice(0, 5).map(c => `- '${c}'`).join('\n')}

### Vehicle Classnames
Light: ${faction.lightVehicles.slice(0, 2).map(c => `'${c}'`).join(', ')}
Armor: ${faction.heavyArmor.slice(0, 2).map(c => `'${c}'`).join(', ')}
Heli: ${faction.helicopters.slice(0, 2).map(c => `'${c}'`).join(', ')}

### Crew/Pilots
Crew: '${faction.crew[0] || faction.infantry[0]}'
Pilot: '${faction.pilots[0] || faction.infantry[0]}'
`.trim();
}

/**
 * Build the complete decision prompt with resource awareness
 */
export function buildResourceAwarePrompt(context: CommanderPromptContext): string {
  const { side, gameState, history, config } = context;
  const recentEvents = history.events.slice(-10);

  // Get commander config, defaulting to WEST if side not found
  const cmdConfig = config || DEFAULT_COMMANDERS[side] || DEFAULT_COMMANDERS.WEST;

  // Map INDEPENDENT to closest resource side for resource tracking
  const resourceSide = side === 'INDEPENDENT' ? 'EAST' : side;

  return `
# AI COMMANDER BRIEFING - ${side}

You are the AI Commander for ${side} forces. Your objective is to achieve tactical victory while managing limited resources.

${buildResourceSection(resourceSide as 'WEST' | 'EAST')}

${buildSpawnCostSection()}

${buildStagingSection(cmdConfig)}

${buildFactionSection(cmdConfig.faction)}

---

# CURRENT BATTLEFIELD STATE

## Friendly Units
${gameState.friendlyUnits?.length || 0} units active

## Enemy Units (${gameState.enemyUnits?.length || 0})
${gameState.enemyUnits?.length > 0 ? gameState.enemyUnits.slice(0, 5).map(u => `- ${u.type || 'Unknown'} at [${u.position?.x?.toFixed(0) || 0}, ${u.position?.y?.toFixed(0) || 0}]`).join('\n') : 'None visible'}

## Active Objectives (${gameState.objectives?.length || 0})
${gameState.objectives?.map(o => `- ${o.description || 'Unknown'} (${o.state || 'unknown'})`).join('\n') || 'None'}

## Recent Events
${recentEvents.map(e => `- [${new Date(e.timestamp).toLocaleTimeString()}] ${e.type}`).join('\n') || 'None'}

## Environment
- Time: ${gameState.environment?.timeOfDay?.toFixed(2) || 12}:00
- Mission Time: ${((gameState.missionContext?.elapsedTime || 0) / 60).toFixed(1)} minutes

---

# YOUR ORDERS

1. **ASSESS** the tactical situation
2. **DECIDE** on an action within your resource limits
3. **SPAWN FROM STAGING** - Units must spawn at staging areas and travel to objectives
4. **CONSERVE RESOURCES** - Don't spam units, make strategic choices

## Response Format

REASONING: [Your tactical analysis - what do you see, what do you need?]
SPAWN_TYPE: [infantry/lightVehicle/heavyArmor/helicopter/none]
SPAWN_COUNT: [number of units/vehicles]
ACTION: [spawn/reinforce/support/wait]

\`\`\`sqf
// Your SQF code - USE SINGLE QUOTES ONLY
// Spawn from staging area: [${cmdConfig.stagingAreas[0]?.position.join(', ') || '0, 0, 0'}]
// Give waypoints to objective
\`\`\`

CRITICAL RULES:
- Use SINGLE QUOTES for all strings: 'classname' not "classname"
- Spawn at staging area, NOT at objectives
- Give waypoints so units TRAVEL to combat
- Check resources before spawning - don't exceed your budget!
- If low on resources, choose WAIT
`.trim();
}

/**
 * Build system prompt for resource-aware commander
 */
export function buildCommanderSystemPrompt(side: 'WEST' | 'EAST' | 'INDEPENDENT'): string {
  return `# Arma 3 AI Commander - ${side}

You are an AI Commander controlling ${side} forces in Arma 3. You manage LIMITED RESOURCES and must make strategic decisions.

## RESOURCE MANAGEMENT
- You have LIMITED tickets that regenerate slowly
- Each spawn costs tickets from your budget
- Unit pools are LIMITED - when exhausted, wait for units to die/RTB
- Support assets (artillery, CAS) are LIMITED per mission

## STRATEGIC PRINCIPLES
1. **Economy First**: Don't overspend. Save tickets for critical moments.
2. **Staging Areas**: ALL units spawn from staging areas and travel to combat.
3. **Combined Arms**: Mix infantry, vehicles, and support for effectiveness.
4. **Tactical Patience**: Sometimes waiting is the right choice.

## SQF CODE RULES (CRITICAL)
1. Use SINGLE QUOTES for ALL strings: 'O_Soldier_F' not "O_Soldier_F"
2. Never use sleep/waitUntil directly - wrap in spawn block
3. Spawn units at staging area coordinates, not at objectives
4. Add waypoints so units travel realistically

## SPAWN PATTERN
\`\`\`sqf
[] spawn {
    private _stagingPos = [STAGING_X, STAGING_Y, 0];
    private _targetPos = [TARGET_X, TARGET_Y, 0];

    // Create group and units at staging
    private _grp = createGroup [side, true];
    _grp createUnit ['classname', _stagingPos, [], 10, 'FORM'];

    // Add waypoint to travel to objective
    private _wp = _grp addWaypoint [_targetPos, 50];
    _wp setWaypointType 'SAD';
    _wp setWaypointBehaviour 'AWARE';
};
\`\`\`

## RESPONSE FORMAT
Always respond with:
REASONING: [1-2 sentences]
SPAWN_TYPE: [infantry/lightVehicle/heavyArmor/helicopter/none]
SPAWN_COUNT: [number]
ACTION: [spawn/reinforce/support/wait]
\`\`\`sqf
// code
\`\`\``;
}
