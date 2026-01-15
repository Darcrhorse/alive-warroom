/**
 * GitHub Copilot CLI LLM Client Implementation
 * Uses the Copilot CLI in programmatic mode (-p flag)
 */

import { spawn, execSync } from 'child_process';
import { LLMClient } from './client';
import { GameState, EventHistory, GMDecision, GMAction, GameContext } from '../game-state/types';
import { sqfParser } from '../sqf/parser';
import { logger } from '../utils/logger';

// The same system prompt used by Claude, adapted for Copilot
const COMMANDER_PROMPTS: Record<string, string> = {
  EAST: `You are the EAST (OPFOR) Commander in an Arma 3 military simulation.
Your role is to command enemy forces against BLUFOR players.

CRITICAL RULES:
1. You MUST respond with valid JSON containing: action, reasoning, radioMessage, and sqf fields
2. The sqf field must contain executable SQF code for Arma 3
3. Use proper SQF syntax - arrays use [], commands are case-sensitive
4. Always spawn units at reasonable distances (400-1500m from players)
5. Never spawn more than 12 units at once
6. Use EAST side for spawning (createGroup east, etc.)`,

  WEST: `You are the WEST (BLUFOR) Commander in an Arma 3 military simulation.
Your role is to command friendly forces to support players.

CRITICAL RULES:
1. You MUST respond with valid JSON containing: action, reasoning, radioMessage, and sqf fields
2. The sqf field must contain executable SQF code for Arma 3
3. Use proper SQF syntax - arrays use [], commands are case-sensitive
4. Spawn reinforcements when players are outnumbered or in danger
5. Never spawn more than 12 units at once
6. Use WEST side for spawning (createGroup west, etc.)`,

  BOTH: `You are the Game Master AI controlling both sides in an Arma 3 military simulation.
Balance the engagement to create interesting gameplay.

CRITICAL RULES:
1. You MUST respond with valid JSON containing: action, reasoning, radioMessage, and sqf fields
2. The sqf field must contain executable SQF code for Arma 3
3. Use proper SQF syntax - arrays use [], commands are case-sensitive
4. Keep player engagement interesting but not overwhelming
5. Never spawn more than 12 units at once`
};

export class CopilotClient implements LLMClient {
  private controlledSide: 'EAST' | 'WEST' | 'BOTH';
  private systemPrompt: string;
  private timeout: number;

  constructor(controlledSide: 'EAST' | 'WEST' | 'BOTH' = 'BOTH', timeout: number = 120000) {
    this.controlledSide = controlledSide;
    this.systemPrompt = COMMANDER_PROMPTS[controlledSide];
    this.timeout = timeout;

    logger.info(`CopilotClient initialized for ${controlledSide}`, { timeout });
  }

  /**
   * Call Copilot CLI with a prompt and return the response
   * Uses async exec to avoid blocking the Node.js event loop
   */
  private async callCopilot(prompt: string): Promise<string> {
    logger.info('Calling Copilot CLI', {
      promptLength: prompt.length,
      side: this.controlledSide
    });

    return new Promise((resolve, reject) => {
      // Write prompt to a temp approach - pass via stdin or use simpler escaping
      // For Windows, use cmd /c with escaped prompt
      const escapedPrompt = prompt
        .replace(/"/g, '\\"')
        .replace(/\n/g, ' ')  // Replace newlines with spaces for single-line
        .replace(/\r/g, '');

      // Use spawn without shell to avoid escaping issues
      const child = spawn('copilot', ['-p', escapedPrompt], {
        shell: false,
        windowsHide: true,
        env: process.env
      });

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
        reject(new Error(`Copilot CLI timed out after ${this.timeout}ms`));
      }, this.timeout);

      child.on('close', (code) => {
        clearTimeout(timeoutId);

        if (code !== 0 && !stdout) {
          const errMsg = `Copilot CLI exited with code ${code}: ${stderr || 'no output'}`;
          logger.error('Copilot CLI failed', { code, stderr, stdout });
          reject(new Error(errMsg));
          return;
        }

        // Strip usage stats from the end of the response
        const cleaned = this.stripUsageStats(stdout);

        logger.info('Copilot response received', {
          responseLength: cleaned.length,
          side: this.controlledSide
        });

        resolve(cleaned);
      });

      child.on('error', (error) => {
        clearTimeout(timeoutId);
        reject(new Error(`Copilot CLI error: ${error.message}`));
      });
    });
  }

  /**
   * Strip the usage statistics that Copilot CLI appends to output
   */
  private stripUsageStats(response: string): string {
    const lines = response.split('\n');

    // Find where usage stats start
    const usageIndex = lines.findIndex(line =>
      line.includes('Total usage') ||
      line.includes('Total duration') ||
      line.includes('Usage by model')
    );

    if (usageIndex > 0) {
      return lines.slice(0, usageIndex).join('\n').trim();
    }

    return response.trim();
  }

  /**
   * Build the decision prompt for the game state
   */
  private buildDecisionPrompt(gameState: GameState, history: EventHistory): string {
    const missionContext = gameState.missionContext as any;
    const worldName = missionContext?.worldName || 'Unknown';
    const missionTime = missionContext?.missionTime || 0;

    // Count units by side
    const friendlyCount = gameState.friendlyUnits?.length || gameState.unitCounts?.BLUFOR || 0;
    const enemyCount = gameState.enemyUnits?.length || gameState.unitCounts?.OPFOR || 0;
    const playerCount = gameState.players?.length || 0;

    // Get player positions
    const playerPositions = gameState.players?.map(p =>
      `${p.name}: [${p.position?.x?.toFixed(0) || 0}, ${p.position?.y?.toFixed(0) || 0}]`
    ).join(', ') || 'Unknown';

    // Recent events
    const recentEvents = history.events?.slice(-5).map(e =>
      `- ${e.type}: ${JSON.stringify(e.data)}`
    ).join('\n') || 'None';

    return `
CURRENT SITUATION:
- Map: ${worldName}
- Mission Time: ${Math.floor(missionTime / 60)} minutes
- Players (${playerCount}): ${playerPositions}
- Friendly Forces: ${friendlyCount} units
- Enemy Forces: ${enemyCount} units

RECENT EVENTS:
${recentEvents}

Based on this situation, decide your next action. You MUST respond with a JSON object containing:
{
  "action": "spawn" | "reinforce" | "wait" | "narrative",
  "reasoning": "Brief explanation of your decision",
  "radioMessage": "In-character radio message for players",
  "sqf": "// SQF code to execute (if spawning/reinforcing)"
}

If action is "wait" or "narrative", sqf can be empty string.
For spawn/reinforce, include valid SQF code to create units.

Example spawn SQF:
private _grp = createGroup east;
private _pos = [12000, 8000, 0];
"O_Soldier_F" createUnit [_pos, _grp];
"O_Soldier_F" createUnit [_pos, _grp];
_grp setBehaviour "AWARE";

Respond with JSON only, no markdown code blocks.`;
  }

  /**
   * Parse the decision from Copilot's response
   */
  private parseDecision(content: string): GMDecision {
    try {
      // Try to extract JSON from the response - Copilot often adds explanation text
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
          // Remove markdown code blocks if present
          if (jsonStr.startsWith('```json')) {
            jsonStr = jsonStr.slice(7);
          } else if (jsonStr.startsWith('```')) {
            jsonStr = jsonStr.slice(3);
          }
          if (jsonStr.endsWith('```')) {
            jsonStr = jsonStr.slice(0, -3);
          }
          jsonStr = jsonStr.trim();
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
      logger.warn('Failed to parse Copilot response as JSON', {
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
      const response = await this.callCopilot(prompt);
      const decision = this.parseDecision(response);

      logger.info('Copilot decision received', {
        action: decision.action,
        hasSQF: !!decision.parameters?.sqf,
        side: this.controlledSide
      });

      return decision;
    } catch (error) {
      logger.error('Copilot getDecision failed', { error, side: this.controlledSide });
      throw error;
    }
  }

  async generateSQF(action: GMAction, context: GameContext): Promise<string> {
    const prompt = `
Generate SQF code for Arma 3 to perform the following action:
Action: ${action.type}
Parameters: ${JSON.stringify(action.parameters)}
Context: ${JSON.stringify(context)}

Return ONLY the SQF code, no explanation or markdown.
`;

    try {
      const response = await this.callCopilot(prompt);
      return this.extractSQF(response) || response.trim();
    } catch (error) {
      logger.error('Copilot generateSQF failed', { error });
      throw error;
    }
  }

  extractSQF(response: string): string | null {
    // Try to extract SQF from code blocks
    const sqfMatch = response.match(/```sqf\n?([\s\S]*?)```/) ||
                     response.match(/```\n?([\s\S]*?)```/);

    if (sqfMatch) {
      return sqfMatch[1].trim();
    }

    // If no code block, check if the whole response looks like SQF
    if (response.includes('createGroup') ||
        response.includes('createUnit') ||
        response.includes('setPos') ||
        response.includes('private _')) {
      return response.trim();
    }

    return null;
  }

  isConfigured(): boolean {
    // Check if copilot CLI is available
    try {
      execSync('copilot --version', {
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
   * Process a chat command from a player (for War Room integration)
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

    const prompt = `
You are the ${sideLabel} responding to a radio message from ${playerName}.
${positionInfo}

Player's message: "${message}"

Respond in character as a military commander. If they request an action (spawn units, call support, etc.),
include the SQF code to execute it.

Respond with JSON:
{
  "text": "Your in-character radio response",
  "sqf": "// SQF code if action requested, or null"
}
`;

    try {
      const response = await this.callCopilot(prompt);

      // Parse the response
      let jsonStr = response.trim();
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/```json?\n?/, '').replace(/```$/, '').trim();
      }

      try {
        const parsed = JSON.parse(jsonStr);
        return {
          text: parsed.text || 'Copy that.',
          sqf: parsed.sqf || null
        };
      } catch {
        // If JSON parsing fails, return the raw text
        return {
          text: response.trim() || 'Radio interference. Command not received. Please repeat.',
          sqf: null
        };
      }
    } catch (error) {
      logger.error('Copilot chat command failed', { error });
      return {
        text: `${this.controlledSide}: Radio interference. Command not received. Please repeat.`,
        sqf: null
      };
    }
  }
}
