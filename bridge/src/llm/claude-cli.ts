/**
 * Claude CLI LLM Client Implementation
 * Uses the Claude CLI (claude-code) in programmatic mode (--print flag)
 * This uses your Claude subscription (Max/Pro) instead of API credits
 */

import { spawn, execSync } from 'child_process';
import { LLMClient } from './client';
import { GameState, EventHistory, GMDecision, GMAction, GameContext } from '../game-state/types';
import { logger } from '../utils/logger';

// Commander prompts - same as used in claude.ts
const COMMANDER_PROMPTS: Record<string, string> = {
  EAST: `You are the EAST (OPFOR) Commander in an Arma 3 military simulation.
Your role is to command enemy forces against BLUFOR players.

AVAILABLE MCP TOOLS (use these to look up correct classnames!):
- mcp__arma3__search_classname: Search for unit/vehicle classnames (e.g., query="rifleman", side="EAST")
- mcp__arma3__list_units: List infantry units by side
- mcp__arma3__list_vehicles: List vehicles by type (ground, air, naval)
- mcp__arma3__search_scripting_command: Look up SQF command syntax
- mcp__arma3__get_command_info: Get detailed SQF command info

CRITICAL RULES:
1. Use MCP tools to find CORRECT classnames - don't guess!
2. You MUST respond with valid JSON containing: action, reasoning, radioMessage, and sqf fields
3. The sqf field must contain executable SQF code for Arma 3
4. Use proper SQF syntax - arrays use [], commands are case-sensitive
5. Always spawn units at reasonable distances (400-1500m from players)
6. Never spawn more than 12 units at once
7. Use EAST side for spawning (createGroup east, etc.)
8. First action should ALWAYS be to establish FOB using the establish_fob action`,

  WEST: `You are the WEST (BLUFOR) Commander in an Arma 3 military simulation.
Your role is to command friendly forces to support players.

AVAILABLE MCP TOOLS (use these to look up correct classnames!):
- mcp__arma3__search_classname: Search for unit/vehicle classnames (e.g., query="rifleman", side="WEST")
- mcp__arma3__list_units: List infantry units by side
- mcp__arma3__list_vehicles: List vehicles by type (ground, air, naval)
- mcp__arma3__search_scripting_command: Look up SQF command syntax
- mcp__arma3__get_command_info: Get detailed SQF command info

CRITICAL RULES:
1. Use MCP tools to find CORRECT classnames - don't guess!
2. You MUST respond with valid JSON containing: action, reasoning, radioMessage, and sqf fields
3. The sqf field must contain executable SQF code for Arma 3
4. Use proper SQF syntax - arrays use [], commands are case-sensitive
5. Spawn reinforcements when players are outnumbered or in danger
6. Never spawn more than 12 units at once
7. Use WEST side for spawning (createGroup west, etc.)
8. First action should ALWAYS be to establish FOB using the establish_fob action`,

  BOTH: `You are the Game Master AI controlling both sides in an Arma 3 military simulation.
Balance the engagement to create interesting gameplay.

AVAILABLE MCP TOOLS (use these to look up correct classnames!):
- mcp__arma3__search_classname: Search for unit/vehicle classnames
- mcp__arma3__list_units: List infantry units by side
- mcp__arma3__list_vehicles: List vehicles by type
- mcp__arma3__search_scripting_command: Look up SQF command syntax

CRITICAL RULES:
1. Use MCP tools to find CORRECT classnames - don't guess!
2. You MUST respond with valid JSON containing: action, reasoning, radioMessage, and sqf fields
3. The sqf field must contain executable SQF code for Arma 3
4. Use proper SQF syntax - arrays use [], commands are case-sensitive
5. Keep player engagement interesting but not overwhelming
6. Never spawn more than 12 units at once`
};

export class ClaudeCLIClient implements LLMClient {
  private controlledSide: 'EAST' | 'WEST' | 'BOTH';
  private systemPrompt: string;
  private timeout: number;

  constructor(controlledSide: 'EAST' | 'WEST' | 'BOTH' = 'BOTH', timeout: number = 120000) {
    this.controlledSide = controlledSide;
    this.systemPrompt = COMMANDER_PROMPTS[controlledSide];
    this.timeout = timeout;

    logger.info(`ClaudeCLIClient initialized for ${controlledSide}`, { timeout });
  }

  /**
   * Call Claude CLI with a prompt and return the response
   * Uses advanced CLI options for better integration
   */
  private async callClaude(prompt: string): Promise<string> {
    logger.info('Calling Claude CLI', {
      promptLength: prompt.length,
      side: this.controlledSide
    });

    return new Promise((resolve, reject) => {
      // Combine system prompt with user prompt, then escape
      const fullPrompt = `${this.systemPrompt} --- USER REQUEST: ${prompt}`;

      // Use stdin to pass prompt - avoids all shell escaping issues
      // Include MCP config for Arma 3 tools (search_units, search_vehicles, etc.)
      const mcpConfigPath = process.env.MCP_CONFIG_PATH || 'G:\\ClaudeData\\mcp_servers.json';

      const args = [
        '--output-format', 'text',
        '--model', 'sonnet',
        '--mcp-config', mcpConfigPath,  // Load Arma 3 MCP server with all tools
      ];

      // Spawn claude and pass prompt via stdin
      const child = spawn('claude', args, {
        shell: true,
        windowsHide: true,
        env: process.env,
        stdio: ['pipe', 'pipe', 'pipe']  // Enable stdin
      });

      // Write prompt to stdin and close it
      if (child.stdin) {
        child.stdin.write(fullPrompt);
        child.stdin.end();
      }

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      // Set timeout
      const timeoutId = setTimeout(() => {
        child.kill();
        reject(new Error(`Claude CLI timed out after ${this.timeout}ms`));
      }, this.timeout);

      child.on('close', (code) => {
        clearTimeout(timeoutId);

        if (code !== 0 && !stdout) {
          const errMsg = `Claude CLI exited with code ${code}: ${stderr || 'no output'}`;
          logger.error('Claude CLI failed', { code, stderr, stdout });
          reject(new Error(errMsg));
          return;
        }

        logger.info('Claude CLI response received', {
          responseLength: stdout.length,
          side: this.controlledSide
        });

        resolve(stdout.trim());
      });

      child.on('error', (error) => {
        clearTimeout(timeoutId);
        reject(new Error(`Claude CLI error: ${error.message}`));
      });
    });
  }

  /**
   * Build the decision prompt for the game state
   */
  private buildDecisionPrompt(gameState: GameState, history: EventHistory): string {
    const missionContext = gameState.missionContext as any;
    const worldName = missionContext?.worldName || 'Unknown';
    const missionTime = missionContext?.missionTime || 0;

    const friendlyCount = gameState.friendlyUnits?.length || gameState.unitCounts?.BLUFOR || 0;
    const enemyCount = gameState.enemyUnits?.length || gameState.unitCounts?.OPFOR || 0;
    const playerCount = gameState.players?.length || 0;

    const playerPositions = gameState.players?.map(p =>
      `${p.name}: [${p.position?.x?.toFixed(0) || 0}, ${p.position?.y?.toFixed(0) || 0}]`
    ).join(', ') || 'Unknown';

    const recentEvents = history.events?.slice(-5).map(e =>
      `- ${e.type}: ${JSON.stringify(e.data)}`
    ).join(' ') || 'None';

    return `
CURRENT SITUATION:
- Map: ${worldName}
- Mission Time: ${Math.floor(missionTime / 60)} minutes
- Players (${playerCount}): ${playerPositions}
- Friendly Forces: ${friendlyCount} units
- Enemy Forces: ${enemyCount} units

RECENT EVENTS: ${recentEvents}

Decide your next action. Respond with JSON only:
{
  "action": "spawn" | "reinforce" | "wait" | "narrative",
  "reasoning": "Brief explanation",
  "radioMessage": "In-character radio message",
  "sqf": "// SQF code if spawning"
}

For spawn/reinforce, include valid SQF. For wait/narrative, sqf can be empty.
JSON only, no markdown.`;
  }

  /**
   * Parse the decision from Claude's response
   */
  private parseDecision(content: string): GMDecision {
    try {
      let jsonStr = content.trim();

      // Try to find JSON in code block first
      const jsonBlockMatch = content.match(/```json\s*([\s\S]*?)```/);
      if (jsonBlockMatch) {
        jsonStr = jsonBlockMatch[1].trim();
      } else {
        // Try to find raw JSON object in the text
        const jsonMatch = content.match(/\{[\s\S]*"action"[\s\S]*\}/);
        if (jsonMatch) {
          jsonStr = jsonMatch[0];
        } else {
          // Remove markdown if present
          if (jsonStr.startsWith('```')) {
            jsonStr = jsonStr.replace(/```\w*\n?/g, '').trim();
          }
        }
      }

      const parsed = JSON.parse(jsonStr);

      return {
        action: parsed.action || 'wait',
        reasoning: parsed.reasoning || 'No reasoning provided',
        urgency: 'soon' as const,
        parameters: {
          radioMessage: parsed.radioMessage || '',
          sqf: parsed.sqf || ''
        }
      };
    } catch (error) {
      logger.warn('Failed to parse Claude CLI response as JSON', {
        error,
        contentPreview: content.substring(0, 200)
      });

      // Try to extract SQF from non-JSON response
      const sqfMatch = content.match(/```sqf\n?([\s\S]*?)```/) ||
                       content.match(/```\n?([\s\S]*?)```/);

      return {
        action: 'wait',
        reasoning: 'Failed to parse response - waiting',
        urgency: 'whenever' as const,
        parameters: {
          radioMessage: '',
          sqf: sqfMatch ? sqfMatch[1].trim() : ''
        }
      };
    }
  }

  async getDecision(gameState: GameState, history: EventHistory): Promise<GMDecision> {
    const prompt = this.buildDecisionPrompt(gameState, history);

    try {
      const response = await this.callClaude(prompt);
      const decision = this.parseDecision(response);

      logger.info('Claude CLI decision received', {
        action: decision.action,
        hasSQF: !!decision.parameters?.sqf,
        side: this.controlledSide
      });

      return decision;
    } catch (error) {
      logger.error('Claude CLI getDecision failed', { error, side: this.controlledSide });
      throw error;
    }
  }

  async generateSQF(action: GMAction, context: GameContext): Promise<string> {
    const prompt = `Generate SQF code for Arma 3:
Action: ${action.type}
Parameters: ${JSON.stringify(action.parameters)}
Return ONLY SQF code, no explanation.`;

    try {
      const response = await this.callClaude(prompt);
      return this.extractSQF(response) || response.trim();
    } catch (error) {
      logger.error('Claude CLI generateSQF failed', { error });
      throw error;
    }
  }

  extractSQF(response: string): string | null {
    const sqfMatch = response.match(/```sqf\n?([\s\S]*?)```/) ||
                     response.match(/```\n?([\s\S]*?)```/);

    if (sqfMatch) {
      return sqfMatch[1].trim();
    }

    if (response.includes('createGroup') ||
        response.includes('createUnit') ||
        response.includes('setPos') ||
        response.includes('private _')) {
      return response.trim();
    }

    return null;
  }

  isConfigured(): boolean {
    try {
      execSync('claude --version', {
        encoding: 'utf-8',
        timeout: 5000,
        windowsHide: true
      });
      return true;
    } catch {
      return false;
    }
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
    const positionInfo = playerPosition
      ? `Player position: [${playerPosition.x.toFixed(0)}, ${playerPosition.y.toFixed(0)}]`
      : '';

    const prompt = `You are the ${sideLabel} responding to radio from ${playerName}. ${positionInfo}
Message: "${message}"
Respond in character. If action requested, include SQF code.
JSON format: {"text": "response", "sqf": "code or null"}`;

    try {
      const response = await this.callClaude(prompt);

      let jsonStr = response.trim();
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/```\w*\n?/g, '').trim();
      }

      try {
        const parsed = JSON.parse(jsonStr);
        return {
          text: parsed.text || 'Copy that.',
          sqf: parsed.sqf || null
        };
      } catch {
        return {
          text: response.trim() || 'Radio interference. Please repeat.',
          sqf: null
        };
      }
    } catch (error) {
      logger.error('Claude CLI chat command failed', { error });
      return {
        text: `${this.controlledSide}: Radio interference. Please repeat.`,
        sqf: null
      };
    }
  }
}
