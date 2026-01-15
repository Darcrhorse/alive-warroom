/**
 * Claude Agent SDK Client Implementation
 * Uses Claude Max subscription via OAuth token instead of API key
 */

import { query, tool, createSdkMcpServer, SDKMessage, SDKResultMessage } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { LLMClient } from './client';
import { GameState, EventHistory, GMDecision, GMAction, GameContext, SpawnHistory, SpawnRecord, SpawnCategory } from '../game-state/types';
import { sqfParser } from '../sqf/parser';
import { logger } from '../utils/logger';
import { realMCPClient } from '../mcp/real-mcp-client';
import { lookupSQFCommand } from '../mcp/sqf-commands';
import { getMapFactionSummary, getFactionsForMap } from '../mcp/map-factions';
import { getLocationsNear } from '../mcp/map-intelligence';
import { unitTracker } from '../game/unitTracker';
import { ALL_TEMPLATES, getTemplate, listTemplates, LAMBS_TEMPLATES } from '../sqf/tactical-templates';

// Controlled side type for dual AI mode
export type ControlledSide = 'EAST' | 'WEST' | 'BOTH';

/**
 * Claude Agent SDK Client - uses Max subscription authentication
 */
export class ClaudeAgentClient implements LLMClient {
  private model: string;
  private maxTokens: number;
  private systemPrompt: string;
  private spawnHistory: SpawnHistory;
  private lastMapName: string = 'unknown';
  private controlledSide: ControlledSide;
  private mcpServer: ReturnType<typeof createSdkMcpServer>;

  constructor(
    model: string = 'claude-sonnet-4-20250514',
    maxTokens: number = 8192,
    controlledSide: ControlledSide = 'BOTH'
  ) {
    this.model = model;
    this.maxTokens = maxTokens;
    this.controlledSide = controlledSide;
    this.systemPrompt = this.loadSystemPrompt(controlledSide);
    this.spawnHistory = { records: [], maxRecords: 10 };

    // Create in-process MCP server with Arma 3 tools
    this.mcpServer = this.createMCPServer();
  }

  /**
   * Create MCP server with Arma 3 tools using Zod schemas
   */
  private createMCPServer() {
    return createSdkMcpServer({
      name: 'arma3-gamemaster',
      version: '1.0.0',
      tools: [
        // Search Units Tool
        tool(
          'search_units',
          'Search for infantry unit classnames by role or name. Use this to find the correct classname for soldiers like riflemen, medics, snipers, etc.',
          {
            query: z.string().describe('Search query - e.g., "rifleman", "sniper", "medic"'),
            side: z.enum(['EAST', 'WEST']).describe('Side - EAST for OPFOR, WEST for BLUFOR')
          },
          async (args) => {
            try {
              const results = await realMCPClient.searchClassname(args.query, {
                category: 'unit',
                side: args.side,
                limit: 20
              });
              logger.info('MCP search_units result', { query: args.query, resultCount: results.length });
              return { content: [{ type: 'text' as const, text: JSON.stringify(results.slice(0, 10), null, 2) }] };
            } catch (error) {
              return { content: [{ type: 'text' as const, text: JSON.stringify({ error: String(error) }) }] };
            }
          }
        ),

        // Search Vehicles Tool
        tool(
          'search_vehicles',
          'Search for vehicle classnames including ground vehicles, helicopters, and aircraft.',
          {
            vehicle_type: z.enum(['ground', 'air', 'any']).describe('Type of vehicle to search for'),
            side: z.enum(['EAST', 'WEST']).describe('Side - EAST for OPFOR, WEST for BLUFOR'),
            subcategory: z.string().optional().describe('Optional subcategory like "tank", "apc", "attack_heli"')
          },
          async (args) => {
            try {
              // Map 'any' to undefined for the API
              const vehicleType = args.vehicle_type === 'any' ? undefined : args.vehicle_type;
              const results = await realMCPClient.listVehicles({
                vehicle_type: vehicleType as 'ground' | 'air' | undefined,
                side: args.side,
                limit: 20
              });
              const resultArray = Array.isArray(results) ? results : (results?.content ? results.content : []);
              logger.info('MCP search_vehicles result', { type: args.vehicle_type, resultCount: resultArray.length });
              return { content: [{ type: 'text' as const, text: JSON.stringify(resultArray.slice(0, 10), null, 2) }] };
            } catch (error) {
              return { content: [{ type: 'text' as const, text: JSON.stringify({ error: String(error) }) }] };
            }
          }
        ),

        // Search Assets Tool
        tool(
          'search_assets',
          'General search across all asset types (infantry, vehicles, aircraft, static weapons).',
          {
            query: z.string().describe('Search query - e.g., "helicopter", "tank", "mortar"'),
            side: z.enum(['EAST', 'WEST']).optional().describe('Optional side filter')
          },
          async (args) => {
            try {
              const results = await realMCPClient.searchClassname(args.query, {
                side: args.side,
                limit: 20
              });
              logger.info('MCP search_assets result', { query: args.query, resultCount: results.length });
              return { content: [{ type: 'text' as const, text: JSON.stringify(results.slice(0, 15), null, 2) }] };
            } catch (error) {
              return { content: [{ type: 'text' as const, text: JSON.stringify({ error: String(error) }) }] };
            }
          }
        ),

        // Lookup SQF Command Tool
        tool(
          'lookup_sqf_command',
          'Look up SQF command syntax and usage. Use this to verify a command exists and get correct syntax.',
          {
            command: z.string().describe('The SQF command to look up - e.g., "setBehaviour", "addWaypoint"')
          },
          async (args) => {
            try {
              const result = lookupSQFCommand(args.command);
              if (result) {
                return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
              }
              return { content: [{ type: 'text' as const, text: JSON.stringify({ error: `Command "${args.command}" not found` }) }] };
            } catch (error) {
              return { content: [{ type: 'text' as const, text: JSON.stringify({ error: String(error) }) }] };
            }
          }
        ),

        // Get Map Factions Tool
        tool(
          'get_map_factions',
          'Get recommended factions for a specific map.',
          {
            map_name: z.string().describe('Map name - e.g., "Altis", "Takistan", "Chernarus"')
          },
          async (args) => {
            try {
              const factions = getFactionsForMap(args.map_name);
              return { content: [{ type: 'text' as const, text: JSON.stringify(factions, null, 2) }] };
            } catch (error) {
              return { content: [{ type: 'text' as const, text: JSON.stringify({ error: String(error) }) }] };
            }
          }
        ),

        // Get Map Locations Tool
        tool(
          'get_map_locations',
          'Get strategic locations near a position on the map.',
          {
            position: z.array(z.number()).describe('Position as [X, Y] to search near'),
            radius: z.number().optional().default(3000).describe('Search radius in meters')
          },
          async (args) => {
            try {
              const locations = getLocationsNear(this.lastMapName, args.position as [number, number], args.radius);
              return { content: [{ type: 'text' as const, text: JSON.stringify(locations.slice(0, 10), null, 2) }] };
            } catch (error) {
              return { content: [{ type: 'text' as const, text: JSON.stringify({ error: String(error) }) }] };
            }
          }
        ),

        // Get Tactical Template Tool
        tool(
          'get_tactical_template',
          'Get ready-to-use SQF code for tactical operations like helicopter insertions, APC assaults, garrison defense, etc.',
          {
            category: z.enum(['infantry', 'helicopter', 'vehicle', 'logistics', 'garrison', 'lambs', 'tasks', 'existing']).describe('Category of operation'),
            operation: z.string().describe('Specific operation - e.g., "heli_insert_troops", "spawn_apc_with_dismounts"')
          },
          async (args) => {
            try {
              const template = getTemplate(args.category, args.operation);
              if (template) {
                return { content: [{ type: 'text' as const, text: JSON.stringify({
                  name: template.name,
                  description: template.description,
                  parameters: template.parameters,
                  sqf: template.sqf,
                  notes: template.notes
                }, null, 2) }] };
              }
              const categoryTemplates = ALL_TEMPLATES[args.category as keyof typeof ALL_TEMPLATES];
              if (categoryTemplates) {
                return { content: [{ type: 'text' as const, text: JSON.stringify({
                  error: `Template "${args.operation}" not found`,
                  available: Object.keys(categoryTemplates)
                }, null, 2) }] };
              }
              return { content: [{ type: 'text' as const, text: JSON.stringify({ error: `Unknown category: ${args.category}` }) }] };
            } catch (error) {
              return { content: [{ type: 'text' as const, text: JSON.stringify({ error: String(error) }) }] };
            }
          }
        ),

        // Get LAMBS Behavior Tool
        tool(
          'get_lambs_behavior',
          'Get LAMBS Danger AI behavior function syntax for superior AI tactics.',
          {
            behavior: z.enum(['assault', 'garrison', 'hunt', 'cqb', 'patrol', 'creep', 'rush', 'camp']).describe('The LAMBS behavior to look up')
          },
          async (args) => {
            try {
              const lambsKey = `lambs_${args.behavior}`;
              const template = LAMBS_TEMPLATES[lambsKey];
              if (template) {
                return { content: [{ type: 'text' as const, text: JSON.stringify({
                  name: template.name,
                  description: template.description,
                  parameters: template.parameters,
                  sqf: template.sqf,
                  notes: template.notes
                }, null, 2) }] };
              }
              return { content: [{ type: 'text' as const, text: JSON.stringify({
                error: `LAMBS behavior "${args.behavior}" not found`,
                available: Object.keys(LAMBS_TEMPLATES).map(k => k.replace('lambs_', ''))
              }, null, 2) }] };
            } catch (error) {
              return { content: [{ type: 'text' as const, text: JSON.stringify({ error: String(error) }) }] };
            }
          }
        ),

        // List Tactical Templates Tool
        tool(
          'list_tactical_templates',
          'List all available tactical SQF templates by category.',
          {
            category: z.enum(['infantry', 'helicopter', 'vehicle', 'logistics', 'garrison', 'lambs', 'tasks', 'existing', 'all']).describe('Category to list')
          },
          async (args) => {
            try {
              if (args.category === 'all') {
                const allTemplates: Record<string, string[]> = {};
                for (const [cat, templates] of Object.entries(ALL_TEMPLATES)) {
                  allTemplates[cat] = Object.keys(templates);
                }
                return { content: [{ type: 'text' as const, text: JSON.stringify({ categories: allTemplates }, null, 2) }] };
              }
              const categoryTemplates = ALL_TEMPLATES[args.category as keyof typeof ALL_TEMPLATES];
              if (categoryTemplates) {
                const templateList = Object.entries(categoryTemplates).map(([name, tmpl]) => ({
                  name,
                  description: (tmpl as any).description
                }));
                return { content: [{ type: 'text' as const, text: JSON.stringify({ category: args.category, templates: templateList }, null, 2) }] };
              }
              return { content: [{ type: 'text' as const, text: JSON.stringify({ error: `Unknown category: ${args.category}` }) }] };
            } catch (error) {
              return { content: [{ type: 'text' as const, text: JSON.stringify({ error: String(error) }) }] };
            }
          }
        )
      ]
    });
  }

  /**
   * Get the side this client controls
   */
  getControlledSide(): ControlledSide {
    return this.controlledSide;
  }

  /**
   * Categorize a spawn based on unit types used
   */
  private categorizeSpawn(sqf: string): SpawnCategory {
    const sqfLower = sqf.toLowerCase();
    if (sqfLower.includes('heli') || sqfLower.includes('mi24') || sqfLower.includes('mi8') ||
        sqfLower.includes('uh60') || sqfLower.includes('ch47')) {
      return 'helicopter';
    }
    if (sqfLower.includes('tank') || sqfLower.includes('t72') || sqfLower.includes('abrams')) {
      return 'tank';
    }
    if (sqfLower.includes('btr') || sqfLower.includes('stryker') || sqfLower.includes('apc')) {
      return 'apc';
    }
    if (sqfLower.includes('truck') || sqfLower.includes('pickup') || sqfLower.includes('offroad')) {
      return 'light_vehicle';
    }
    return 'infantry';
  }

  /**
   * Record a spawn for anti-repetition tracking
   */
  recordSpawn(sqf: string, reasoning: string): void {
    const category = this.categorizeSpawn(sqf);
    const record: SpawnRecord = {
      timestamp: Date.now(),
      category,
      unitTypes: [],
      count: 1,
      side: sqf.toLowerCase().includes('west') ? 'WEST' : 'EAST',
      reasoning
    };
    this.spawnHistory.records.push(record);
    if (this.spawnHistory.records.length > this.spawnHistory.maxRecords) {
      this.spawnHistory.records.shift();
    }
  }

  /**
   * Get spawn history summary for anti-repetition
   */
  getSpawnHistorySummary(): string {
    if (this.spawnHistory.records.length === 0) {
      return 'No recent spawns.';
    }
    const categoryCounts: Record<string, number> = {};
    for (const record of this.spawnHistory.records) {
      categoryCounts[record.category] = (categoryCounts[record.category] || 0) + 1;
    }
    const summary = Object.entries(categoryCounts)
      .map(([cat, count]) => `${cat}: ${count}`)
      .join(', ');
    return `Recent spawns: ${summary}. AVOID repeating the most common categories!`;
  }

  /**
   * Load system prompt based on controlled side
   */
  private loadSystemPrompt(side: ControlledSide): string {
    // Use a simplified system prompt - the full one is loaded from ClaudeClient
    // This can be expanded or imported from the original
    const sideLabel = side === 'EAST' ? 'OPFOR' : side === 'WEST' ? 'BLUFOR' : 'Game Master';
    return `You are an AI ${sideLabel} Commander in Arma 3. Your role is to command military forces in tactical combat.

CRITICAL RULES:
1. Always spawn units at your FOB (LLMGM_${side.toLowerCase()}FobPos or fob_${side.toLowerCase()}_zone marker)
2. Use the MCP tools to look up correct unit/vehicle classnames
3. Generate valid SQF code in \`\`\`sqf code blocks
4. NEVER spawn empty vehicles - always load troops using assignAsCargo + moveInCargo
5. Use LAMBS functions (lambs_wp_fnc_*) for superior AI behavior
6. Vary your tactics - check spawn history to avoid repetition

Available tools: search_units, search_vehicles, search_assets, get_tactical_template, get_lambs_behavior, list_tactical_templates, get_map_locations, lookup_sqf_command`;
  }

  /**
   * Build decision prompt from game state
   */
  private buildDecisionPrompt(gameState: GameState, history: EventHistory): string {
    const friendlyCount = gameState.unitCounts?.OPFOR ?? gameState.friendlyUnits?.length ?? 0;
    const enemyCount = gameState.unitCounts?.BLUFOR ?? gameState.enemyUnits?.length ?? 0;

    let objectiveInfo = '';
    if (gameState.battleObjective) {
      const obj = gameState.battleObjective;
      // Use distance from our FOB based on which side we control
      const distanceFromFob = this.controlledSide === 'EAST'
        ? obj.distanceFromEastFob
        : obj.distanceFromWestFob;
      objectiveInfo = `
BATTLE OBJECTIVE: ${obj.name}
Position: [${obj.position.x.toFixed(0)}, ${obj.position.y.toFixed(0)}]
Status: ${obj.controlStatus}
Distance from our FOB: ${distanceFromFob?.toFixed(0) || 'unknown'}m
Friendly units nearby: ${this.controlledSide === 'EAST' ? obj.eastUnitsNearby : obj.westUnitsNearby}
Enemy units nearby: ${this.controlledSide === 'EAST' ? obj.westUnitsNearby : obj.eastUnitsNearby}`;
    }

    return `
CURRENT SITUATION:
- Friendly forces: ${friendlyCount}
- Enemy forces: ${enemyCount}
- Map: ${(gameState.missionContext as any)?.worldName || 'unknown'}
${objectiveInfo}

${this.getSpawnHistorySummary()}

Based on this situation, decide your next tactical action:
- spawn: Deploy new units
- observe: Wait and gather intelligence
- reinforce: Send reinforcements to an area

Provide your reasoning, then generate SQF code to execute your decision.
Format: REASONING section, ACTION line, then \`\`\`sqf code block.
`;
  }

  /**
   * Parse decision from LLM response
   */
  private parseDecision(content: string): GMDecision {
    // Extract action type
    const actionMatch = content.match(/ACTION:\s*(spawn|observe|reinforce|attack|defend)/i);
    const action = actionMatch ? actionMatch[1].toLowerCase() : 'observe';

    // Extract reasoning
    const reasoningMatch = content.match(/REASONING[:\s]*(.+?)(?=ACTION:|```|$)/is);
    const reasoning = reasoningMatch ? reasoningMatch[1].trim() : 'No reasoning provided';

    // Extract SQF code
    const sqfMatch = content.match(/```sqf\s*([\s\S]*?)```/);
    const sqf = sqfMatch ? sqfMatch[1].trim() : null;

    return {
      action: (action === 'observe' ? 'wait' : action) as GMDecision['action'],
      reasoning,
      urgency: 'soon' as const,
      parameters: sqf ? { sqf } : {}
    };
  }

  /**
   * Get decision using Agent SDK
   */
  async getDecision(gameState: GameState, history: EventHistory): Promise<GMDecision> {
    this.lastMapName = (gameState.missionContext as any)?.worldName || 'unknown';
    const prompt = this.buildDecisionPrompt(gameState, history);

    logger.info('Requesting decision from Claude Agent SDK', {
      model: this.model,
      map: this.lastMapName,
      useOAuth: !!process.env.CLAUDE_CODE_OAUTH_TOKEN
    });

    try {
      // Use Agent SDK query() function
      const queryResult = query({
        prompt: prompt,
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

      // Collect response from async generator
      let finalResult = '';
      let resultMessage: SDKResultMessage | null = null;

      for await (const message of queryResult) {
        if (message.type === 'result') {
          resultMessage = message as SDKResultMessage;
          if (resultMessage.subtype === 'success') {
            finalResult = resultMessage.result;
          } else {
            logger.error('Agent SDK query failed', { subtype: resultMessage.subtype });
          }
        }
      }

      logger.info('Claude Agent SDK response', {
        resultLength: finalResult.length,
        hasResult: !!finalResult
      });

      const decision = this.parseDecision(finalResult);

      if (decision.parameters?.sqf && (decision.action === 'spawn' || decision.action === 'reinforce')) {
        this.recordSpawn(decision.parameters.sqf, decision.reasoning);
      }

      return decision;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error('Error getting decision from Claude Agent SDK', { error: errMsg });
      throw error;
    }
  }

  /**
   * Generate SQF code for an action
   */
  async generateSQF(action: GMAction, context: GameContext): Promise<string> {
    const prompt = `Generate SQF code for: ${action.type}
Context: ${JSON.stringify(context)}
Provide only valid SQF code in a \`\`\`sqf block.`;

    try {
      const queryResult = query({
        prompt: prompt,
        options: {
          model: this.model,
          systemPrompt: 'Generate valid Arma 3 SQF code. Output only code in ```sqf blocks.',
          mcpServers: {
            'arma3': { type: 'sdk', name: 'arma3-gamemaster', instance: this.mcpServer }
          },
          maxTurns: 5,
          permissionMode: 'bypassPermissions',
          allowDangerouslySkipPermissions: true
        }
      });

      let finalResult = '';
      for await (const message of queryResult) {
        if (message.type === 'result') {
          const resultMsg = message as SDKResultMessage;
          if (resultMsg.subtype === 'success' && 'result' in resultMsg) {
            finalResult = (resultMsg as any).result;
          }
        }
      }

      return this.extractSQF(finalResult) || '';
    } catch (error) {
      logger.error('Error generating SQF', { error });
      throw error;
    }
  }

  /**
   * Extract SQF code from response
   */
  extractSQF(response: string): string | null {
    const match = response.match(/```sqf\s*([\s\S]*?)```/);
    return match ? match[1].trim() : null;
  }

  /**
   * Check if client is configured (has OAuth token or is authenticated)
   */
  isConfigured(): boolean {
    // Agent SDK uses CLI authentication - check for OAuth token or logged-in state
    return !!(process.env.CLAUDE_CODE_OAUTH_TOKEN || process.env.ANTHROPIC_API_KEY);
  }

  /**
   * Process a chat command from a player
   */
  async processChatCommand(
    message: string,
    playerName: string,
    playerPosition: { x: number; y: number; z: number } | null,
    gameState: GameState | null
  ): Promise<{ text: string; sqf: string | null }> {
    const sideLabel = this.controlledSide === 'EAST' ? 'OPFOR Commander' : 'BLUFOR Commander';

    const prompt = `You are the ${sideLabel}. Player "${playerName}" sends: "${message}"
${playerPosition ? `Player at: [${playerPosition.x.toFixed(0)}, ${playerPosition.y.toFixed(0)}]` : ''}
Respond briefly in military style. If action needed, include \`\`\`sqf code block.`;

    try {
      const queryResult = query({
        prompt: prompt,
        options: {
          model: this.model,
          systemPrompt: 'Military AI commander. Brief responses. SQF code in ```sqf blocks when action needed.',
          mcpServers: {
            'arma3': { type: 'sdk', name: 'arma3-gamemaster', instance: this.mcpServer }
          },
          maxTurns: 3,
          permissionMode: 'bypassPermissions',
          allowDangerouslySkipPermissions: true
        }
      });

      let finalResult = '';
      for await (const message of queryResult) {
        if (message.type === 'result') {
          const resultMsg = message as SDKResultMessage;
          if (resultMsg.subtype === 'success' && 'result' in resultMsg) {
            finalResult = (resultMsg as any).result;
          }
        }
      }

      const sqf = this.extractSQF(finalResult);
      const text = finalResult.replace(/```sqf[\s\S]*?```/g, '').trim();

      return { text, sqf };
    } catch (error) {
      logger.error('Error processing chat command', { error });
      return { text: 'Command received. Standing by.', sqf: null };
    }
  }
}
