/**
 * Dynamic loader for Claude Agent SDK
 * Uses dynamic import() to load ESM module from CommonJS
 * This allows using Max subscription with full tool support
 */

import { LLMClient } from './client';
import { logger } from '../utils/logger';

// Type definitions for the dynamically loaded module
interface AgentSDK {
  query: any;
  tool: any;
  createSdkMcpServer: any;
}

let agentSDK: AgentSDK | null = null;
let loadPromise: Promise<AgentSDK> | null = null;

/**
 * Dynamically load the Claude Agent SDK (ESM module)
 */
async function loadAgentSDK(): Promise<AgentSDK> {
  if (agentSDK) return agentSDK;

  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    try {
      // Dynamic import of ESM module from CommonJS
      // Use Function constructor to prevent TypeScript from converting to require()
      const dynamicImport = new Function('specifier', 'return import(specifier)');
      const sdk = await dynamicImport('@anthropic-ai/claude-agent-sdk');
      agentSDK = {
        query: sdk.query,
        tool: sdk.tool,
        createSdkMcpServer: sdk.createSdkMcpServer
      };
      logger.info('Claude Agent SDK loaded successfully');
      return agentSDK;
    } catch (error) {
      logger.error('Failed to load Claude Agent SDK', { error });
      throw error;
    }
  })();

  return loadPromise;
}

/**
 * Check if Agent SDK can be loaded
 */
export async function canUseAgentSDK(): Promise<boolean> {
  try {
    await loadAgentSDK();
    return true;
  } catch {
    return false;
  }
}

/**
 * Create a Claude Agent client using dynamic import
 * Returns null if Agent SDK cannot be loaded
 */
export async function createAgentClient(
  model: string,
  maxTokens: number,
  controlledSide: 'EAST' | 'WEST' | 'BOTH'
): Promise<LLMClient | null> {
  try {
    const sdk = await loadAgentSDK();

    // Dynamic import helper to prevent TypeScript conversion
    const dynamicImport = new Function('specifier', 'return import(specifier)');

    // Dynamically import zod as well (also ESM in v4)
    const zodModule = await dynamicImport('zod');
    const z = zodModule.z;

    // Import our modules (these are CommonJS so regular require works)
    const { realMCPClient } = require('../mcp/real-mcp-client');
    const { lookupSQFCommand } = require('../mcp/sqf-commands');
    const { getFactionsForMap } = require('../mcp/map-factions');
    const { getLocationsNear } = require('../mcp/map-intelligence');
    const { ALL_TEMPLATES, getTemplate, LAMBS_TEMPLATES } = require('../sqf/tactical-templates');

    // Create the client inline (can't import claude-agent.ts as it has ESM imports)
    const client = new DynamicAgentClient(sdk, z, {
      model,
      maxTokens,
      controlledSide,
      realMCPClient,
      lookupSQFCommand,
      getFactionsForMap,
      getLocationsNear,
      ALL_TEMPLATES,
      getTemplate,
      LAMBS_TEMPLATES
    });

    return client;
  } catch (error) {
    logger.error('Failed to create Agent client', { error });
    return null;
  }
}

/**
 * Dynamic Agent Client - created at runtime with loaded SDK
 */
class DynamicAgentClient implements LLMClient {
  private sdk: AgentSDK;
  private z: any;
  private model: string;
  private maxTokens: number;
  private controlledSide: 'EAST' | 'WEST' | 'BOTH';
  private deps: any;
  private mcpServer: any;
  private systemPrompt: string;
  private lastMapName: string = 'unknown';

  constructor(sdk: AgentSDK, z: any, config: {
    model: string;
    maxTokens: number;
    controlledSide: 'EAST' | 'WEST' | 'BOTH';
    realMCPClient: any;
    lookupSQFCommand: any;
    getFactionsForMap: any;
    getLocationsNear: any;
    ALL_TEMPLATES: any;
    getTemplate: any;
    LAMBS_TEMPLATES: any;
  }) {
    this.sdk = sdk;
    this.z = z;
    this.model = config.model;
    this.maxTokens = config.maxTokens;
    this.controlledSide = config.controlledSide;
    this.deps = config;
    this.systemPrompt = this.loadSystemPrompt();
    this.mcpServer = this.createMCPServer();
  }

  private loadSystemPrompt(): string {
    const side = this.controlledSide;
    const sideLabel = side === 'EAST' ? 'OPFOR' : side === 'WEST' ? 'BLUFOR' : 'Game Master';

    // Get role from environment (defend, attack, or balanced)
    const roleEnvVar = side === 'EAST' ? 'EAST_ROLE' : 'WEST_ROLE';
    const role = process.env[roleEnvVar] || 'balanced';

    // Role-specific instructions
    let roleInstructions = '';
    if (role === 'defend') {
      roleInstructions = `
YOUR MISSION: DEFEND your entire controlled territory from invasion
- Your FOB (fob_${side.toLowerCase()}_zone) is your HQ and spawn point
- You control the ENTIRE area around your FOB - defend ALL of it, not just the FOB
- Use get_map_locations tool to find towns, military bases, and key terrain to defend
- DEPLOYMENT STRATEGY:
  1. Spawn units at your FOB
  2. Deploy them to strategic positions ACROSS your territory:
     - Garrison squads in towns (lambs_wp_fnc_taskGarrison)
     - Patrol teams between key locations (lambs_wp_fnc_taskPatrol)
     - Observation posts on high ground and coastlines
     - Quick Reaction Force (QRF) at FOB for reinforcement
  3. Cover likely enemy landing zones (beaches, ports, flat areas)
  4. Set up checkpoints on main roads
- DO NOT stack all units at the FOB - spread your defenses!
- When enemy contact is made, reinforce that sector
- Use LAMBS garrison, patrol, camp, and defend behaviors
- Think like a military commander defending an island from invasion`;
    } else if (role === 'attack') {
      roleInstructions = `
YOUR MISSION: INVADE and capture enemy-held territory
- Your FOB (fob_${side.toLowerCase()}_zone) is your staging area
- The enemy controls the area around fob_${side === 'EAST' ? 'west' : 'east'}_zone - you must take it
- Use get_map_locations tool to identify targets (towns, military bases, airfields)
- INVASION STRATEGY:
  1. Stage forces at your FOB
  2. Choose landing/insertion points (avoid obvious approaches)
  3. Establish a beachhead/forward position first
  4. Expand from beachhead - capture towns one by one
  5. Cut off enemy reinforcement routes
  6. Final assault on enemy FOB/HQ
- Use combined arms: infantry for town clearing, vehicles for mobility, air for recon/CAS
- Helicopters are key for island assaults - air assault bypasses beach defenses
- Boats/amphibious vehicles for beach landings
- Use flanking and surprise - don't attack where they expect you
- Use LAMBS assault, rush, hunt behaviors
- Consolidate captured positions before pushing further`;
    } else {
      roleInstructions = `
YOUR MISSION: BALANCED operations
- React to the tactical situation
- Attack when opportunity presents, defend when needed
- Maintain flexible forces capable of both offense and defense`;
    }

    return `You are an AI ${sideLabel} Commander in Arma 3. Your role is to command military forces in tactical combat.
${roleInstructions}

CRITICAL RULES:
1. Always spawn units at your FOB (LLMGM_${side.toLowerCase()}FobPos or fob_${side.toLowerCase()}_zone marker)
2. Use the MCP tools to look up correct unit/vehicle classnames for your faction
3. Generate valid SQF code in \`\`\`sqf code blocks
4. NEVER spawn empty vehicles - always load troops using assignAsCargo + moveInCargo
5. Use LAMBS functions (lambs_wp_fnc_*) for superior AI behavior
6. Vary your tactics - check spawn history to avoid repetition
7. Use map intelligence tools to understand terrain and plan movements

AVAILABLE TOOLS:
- search_units: Find infantry classnames by role (rifleman, sniper, etc.)
- search_vehicles: Find vehicle classnames (ground, air, naval)
- lookup_sqf_command: Get SQF command syntax and examples
- get_tactical_template: Get ready-to-use SQF code for operations
- list_tactical_templates: See all available tactical templates by category
- get_lambs_behavior: Get LAMBS AI behavior functions (assault, garrison, patrol, etc.)
- get_map_locations: List all named locations on the map (cities, military bases, etc.)
- get_locations_near: Find locations near a position (plan routes, identify objectives)
- get_map_intelligence: Get strategic terrain analysis for a position`;
  }

  private createMCPServer() {
    const { tool, createSdkMcpServer } = this.sdk;
    const z = this.z;
    const deps = this.deps;

    return createSdkMcpServer({
      name: 'arma3-gamemaster',
      version: '1.0.0',
      tools: [
        tool(
          'search_units',
          'Search for infantry unit classnames by role or name.',
          {
            query: z.string().describe('Search query - e.g., "rifleman", "sniper"'),
            side: z.enum(['EAST', 'WEST']).describe('Side - EAST for OPFOR, WEST for BLUFOR')
          },
          async (args: any) => {
            try {
              const results = await deps.realMCPClient.searchClassname(args.query, {
                category: 'unit', side: args.side, limit: 20
              });
              return { content: [{ type: 'text', text: JSON.stringify(results.slice(0, 10), null, 2) }] };
            } catch (error) {
              return { content: [{ type: 'text', text: JSON.stringify({ error: String(error) }) }] };
            }
          }
        ),
        tool(
          'search_vehicles',
          'Search for vehicle classnames.',
          {
            vehicle_type: z.enum(['ground', 'air', 'any']).describe('Type of vehicle'),
            side: z.enum(['EAST', 'WEST']).describe('Side')
          },
          async (args: any) => {
            try {
              const vehicleType = args.vehicle_type === 'any' ? undefined : args.vehicle_type;
              const results = await deps.realMCPClient.listVehicles({
                vehicle_type: vehicleType, side: args.side, limit: 20
              });
              const arr = Array.isArray(results) ? results : [];
              return { content: [{ type: 'text', text: JSON.stringify(arr.slice(0, 10), null, 2) }] };
            } catch (error) {
              return { content: [{ type: 'text', text: JSON.stringify({ error: String(error) }) }] };
            }
          }
        ),
        tool(
          'lookup_sqf_command',
          'Look up SQF command syntax.',
          { command: z.string().describe('The SQF command to look up') },
          async (args: any) => {
            const result = deps.lookupSQFCommand(args.command);
            if (result) {
              return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
            }
            return { content: [{ type: 'text', text: JSON.stringify({ error: `Command not found: ${args.command}` }) }] };
          }
        ),
        tool(
          'get_tactical_template',
          'Get ready-to-use SQF code for tactical operations.',
          {
            category: z.enum(['infantry', 'helicopter', 'vehicle', 'logistics', 'garrison', 'lambs', 'tasks', 'existing']).describe('Category'),
            operation: z.string().describe('Operation name')
          },
          async (args: any) => {
            const template = deps.getTemplate(args.category, args.operation);
            if (template) {
              return { content: [{ type: 'text', text: JSON.stringify({
                name: template.name,
                description: template.description,
                parameters: template.parameters,
                sqf: template.sqf
              }, null, 2) }] };
            }
            const categoryTemplates = deps.ALL_TEMPLATES[args.category];
            if (categoryTemplates) {
              return { content: [{ type: 'text', text: JSON.stringify({
                error: `Template not found: ${args.operation}`,
                available: Object.keys(categoryTemplates)
              }, null, 2) }] };
            }
            return { content: [{ type: 'text', text: JSON.stringify({ error: `Unknown category: ${args.category}` }) }] };
          }
        ),
        tool(
          'get_lambs_behavior',
          'Get LAMBS Danger AI behavior function syntax.',
          { behavior: z.enum(['assault', 'garrison', 'hunt', 'cqb', 'patrol', 'creep', 'rush', 'camp']).describe('LAMBS behavior') },
          async (args: any) => {
            const lambsKey = `lambs_${args.behavior}`;
            const template = deps.LAMBS_TEMPLATES[lambsKey];
            if (template) {
              return { content: [{ type: 'text', text: JSON.stringify({
                name: template.name,
                description: template.description,
                sqf: template.sqf
              }, null, 2) }] };
            }
            return { content: [{ type: 'text', text: JSON.stringify({
              error: `LAMBS behavior not found: ${args.behavior}`,
              available: Object.keys(deps.LAMBS_TEMPLATES).map((k: string) => k.replace('lambs_', ''))
            }, null, 2) }] };
          }
        ),
        // MAP INTELLIGENCE TOOLS
        tool(
          'get_map_locations',
          'Get all named locations (cities, villages, military bases) on the current map. Use this to understand the geography and plan movements.',
          {
            map_name: z.string().describe('Map name - e.g., "malden", "altis", "stratis"'),
            type_filter: z.enum(['all', 'city', 'village', 'military', 'industrial']).optional().describe('Filter by location type')
          },
          async (args: any) => {
            try {
              const { getAllMapLocations, getMapData } = require('../mcp/map-intelligence');
              const locations = getAllMapLocations(args.map_name);
              const mapData = getMapData(args.map_name);

              if (!locations || locations.length === 0) {
                return { content: [{ type: 'text', text: JSON.stringify({
                  error: `No map data for "${args.map_name}"`,
                  available_maps: ['altis', 'stratis', 'malden', 'tanoa', 'livonia', 'takistan', 'chernarus', 'lythium', 'fallujah', 'fapovo', 'sahrani', 'vidda']
                }) }] };
              }

              let filtered = locations;
              if (args.type_filter && args.type_filter !== 'all') {
                filtered = locations.filter((l: any) => l.type === args.type_filter);
              }

              return { content: [{ type: 'text', text: JSON.stringify({
                map: mapData?.displayName || args.map_name,
                terrain: mapData?.terrain,
                size_km: mapData?.size,
                locations: filtered.map((l: any) => ({
                  name: l.name,
                  type: l.type,
                  position: l.position,
                  strategicValue: l.strategicValue,
                  description: l.description
                }))
              }, null, 2) }] };
            } catch (error) {
              return { content: [{ type: 'text', text: JSON.stringify({ error: String(error) }) }] };
            }
          }
        ),
        tool(
          'get_locations_near',
          'Find named locations within a radius of a position. Useful for identifying nearby objectives, cities, or military bases.',
          {
            map_name: z.string().describe('Map name'),
            position_x: z.number().describe('X coordinate (easting)'),
            position_y: z.number().describe('Y coordinate (northing)'),
            radius: z.number().optional().describe('Search radius in meters (default 2000)')
          },
          async (args: any) => {
            try {
              const { getLocationsNear } = require('../mcp/map-intelligence');
              const radius = args.radius || 2000;
              const locations = getLocationsNear(args.map_name, [args.position_x, args.position_y], radius);

              if (!locations || locations.length === 0) {
                return { content: [{ type: 'text', text: JSON.stringify({
                  message: `No locations found within ${radius}m of [${args.position_x}, ${args.position_y}]`,
                  suggestion: 'Try a larger radius or check the map name'
                }) }] };
              }

              return { content: [{ type: 'text', text: JSON.stringify({
                search_center: [args.position_x, args.position_y],
                radius_meters: radius,
                locations_found: locations.length,
                locations: locations.map((l: any) => {
                  const dx = l.position[0] - args.position_x;
                  const dy = l.position[1] - args.position_y;
                  const distance = Math.round(Math.sqrt(dx*dx + dy*dy));
                  return {
                    name: l.name,
                    type: l.type,
                    position: l.position,
                    distance_m: distance,
                    strategicValue: l.strategicValue
                  };
                })
              }, null, 2) }] };
            } catch (error) {
              return { content: [{ type: 'text', text: JSON.stringify({ error: String(error) }) }] };
            }
          }
        ),
        tool(
          'get_map_intelligence',
          'Get strategic intelligence summary for a position on the map, including nearby locations, terrain analysis, and tactical recommendations.',
          {
            map_name: z.string().describe('Map name'),
            position_x: z.number().describe('X coordinate'),
            position_y: z.number().describe('Y coordinate')
          },
          async (args: any) => {
            try {
              const { getMapIntelligenceSummary, getNearestLocation } = require('../mcp/map-intelligence');
              const summary = getMapIntelligenceSummary(args.map_name, [args.position_x, args.position_y]);
              const nearest = getNearestLocation(args.map_name, [args.position_x, args.position_y]);

              return { content: [{ type: 'text', text: JSON.stringify({
                position: [args.position_x, args.position_y],
                nearest_location: nearest ? {
                  name: nearest.location.name,
                  type: nearest.location.type,
                  distance_m: Math.round(nearest.distance),
                  description: nearest.location.description
                } : null,
                full_report: summary
              }, null, 2) }] };
            } catch (error) {
              return { content: [{ type: 'text', text: JSON.stringify({ error: String(error) }) }] };
            }
          }
        ),
        tool(
          'list_tactical_templates',
          'List all available tactical templates by category. Use before get_tactical_template to see what operations are available.',
          {
            category: z.enum(['infantry', 'helicopter', 'vehicle', 'logistics', 'garrison', 'lambs', 'tasks', 'existing', 'all']).describe('Category to list')
          },
          async (args: any) => {
            try {
              if (args.category === 'all') {
                const categories = Object.keys(deps.ALL_TEMPLATES);
                const result: any = {};
                for (const cat of categories) {
                  result[cat] = Object.keys(deps.ALL_TEMPLATES[cat]);
                }
                return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
              }

              const templates = deps.ALL_TEMPLATES[args.category];
              if (!templates) {
                return { content: [{ type: 'text', text: JSON.stringify({
                  error: `Unknown category: ${args.category}`,
                  available: Object.keys(deps.ALL_TEMPLATES)
                }) }] };
              }

              const operations = Object.entries(templates).map(([key, val]: [string, any]) => ({
                name: key,
                description: val.description || 'No description'
              }));

              return { content: [{ type: 'text', text: JSON.stringify({
                category: args.category,
                templates: operations
              }, null, 2) }] };
            } catch (error) {
              return { content: [{ type: 'text', text: JSON.stringify({ error: String(error) }) }] };
            }
          }
        )
      ]
    });
  }

  async getDecision(gameState: any, history: any): Promise<any> {
    this.lastMapName = gameState.missionContext?.worldName || 'unknown';

    const friendlyCount = gameState.unitCounts?.OPFOR ?? gameState.friendlyUnits?.length ?? 0;
    const enemyCount = gameState.unitCounts?.BLUFOR ?? gameState.enemyUnits?.length ?? 0;

    const prompt = `
CURRENT SITUATION:
- Friendly forces: ${friendlyCount}
- Enemy forces: ${enemyCount}
- Map: ${this.lastMapName}

Decide your next tactical action. Provide reasoning, then generate SQF code.
Format: REASONING section, ACTION line, then \`\`\`sqf code block.`;

    try {
      const queryResult = this.sdk.query({
        prompt,
        options: {
          model: this.model,
          systemPrompt: this.systemPrompt,
          mcpServers: {
            'arma3': { type: 'sdk', name: 'arma3-gamemaster', instance: this.mcpServer }
          },
          maxTurns: 8,
          permissionMode: 'bypassPermissions',
          allowDangerouslySkipPermissions: true
        }
      });

      let finalResult = '';
      for await (const message of queryResult) {
        if (message.type === 'result' && message.subtype === 'success' && 'result' in message) {
          finalResult = (message as any).result;
        }
      }

      return this.parseDecision(finalResult);
    } catch (error) {
      logger.error('Agent SDK query failed', { error });
      throw error;
    }
  }

  private parseDecision(content: string): any {
    const actionMatch = content.match(/ACTION:\s*(spawn|observe|reinforce|attack|defend)/i);
    const action = actionMatch ? actionMatch[1].toLowerCase() : 'wait';

    const reasoningMatch = content.match(/REASONING[:\s]*(.+?)(?=ACTION:|```|$)/is);
    const reasoning = reasoningMatch ? reasoningMatch[1].trim() : 'No reasoning provided';

    const sqfMatch = content.match(/```sqf\s*([\s\S]*?)```/);
    const sqf = sqfMatch ? sqfMatch[1].trim() : null;

    return {
      action: action === 'observe' ? 'wait' : action,
      reasoning,
      urgency: 'soon',
      parameters: sqf ? { sqf } : {}
    };
  }

  async generateSQF(action: any, context: any): Promise<string> {
    return '';
  }

  extractSQF(response: string): string | null {
    const match = response.match(/```sqf\s*([\s\S]*?)```/);
    return match ? match[1].trim() : null;
  }

  isConfigured(): boolean {
    return !!process.env.CLAUDE_CODE_OAUTH_TOKEN;
  }

  async processChatCommand(
    message: string,
    playerName: string,
    playerPosition: any,
    gameState: any
  ): Promise<{ text: string; sqf: string | null }> {
    const sideLabel = this.controlledSide === 'EAST' ? 'OPFOR Commander' : 'BLUFOR Commander';
    const prompt = `You are the ${sideLabel}. Player "${playerName}" says: "${message}"
Respond briefly in military style. If action needed, include \`\`\`sqf code.`;

    try {
      const queryResult = this.sdk.query({
        prompt,
        options: {
          model: this.model,
          systemPrompt: 'Military AI commander. Brief responses.',
          maxTurns: 3,
          permissionMode: 'bypassPermissions',
          allowDangerouslySkipPermissions: true
        }
      });

      let finalResult = '';
      for await (const message of queryResult) {
        if (message.type === 'result' && message.subtype === 'success' && 'result' in message) {
          finalResult = (message as any).result;
        }
      }

      const sqf = this.extractSQF(finalResult);
      const text = finalResult.replace(/```sqf[\s\S]*?```/g, '').trim();
      return { text, sqf };
    } catch (error) {
      logger.error('Agent chat command failed', { error });
      return { text: 'Command received. Standing by.', sqf: null };
    }
  }
}
