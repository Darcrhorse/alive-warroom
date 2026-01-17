/**
 * OpenAI LLM Client Implementation
 */

import OpenAI from 'openai';
import { LLMClient, LLMResponse } from './client';
import { GameState, EventHistory, GMDecision, GMAction, GameContext } from '../game-state/types';
import { sqfParser } from '../sqf/parser';
import { logger } from '../utils/logger';

export class OpenAIClient implements LLMClient {
  private client: OpenAI;
  private model: string;
  private maxTokens: number;
  private temperature: number;
  private systemPrompt: string;

  constructor(
    apiKey: string,
    model: string = 'gpt-4',
    maxTokens: number = 2000,
    temperature: number = 0.7
  ) {
    this.client = new OpenAI({ apiKey });
    this.model = model;
    this.maxTokens = maxTokens;
    this.temperature = temperature;
    this.systemPrompt = this.loadSystemPrompt();
  }

  isConfigured(): boolean {
    return !!this.client.apiKey;
  }

  async getDecision(gameState: GameState, history: EventHistory): Promise<GMDecision> {
    const prompt = this.buildDecisionPrompt(gameState, history);

    logger.info('Requesting decision from OpenAI', { model: this.model });

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: this.systemPrompt },
          { role: 'user', content: prompt }
        ],
        max_tokens: this.maxTokens,
        temperature: this.temperature
      });

      const content = response.choices[0]?.message?.content || '';
      logger.debug('Received LLM response', { length: content.length });

      return this.parseDecision(content);
    } catch (error) {
      logger.error('Error getting decision from OpenAI', { error });
      throw error;
    }
  }

  /**
   * Get decision using custom resource-aware prompts
   * Used by AI Commanders with faction-specific context
   */
  async getDecisionWithPrompt(
    systemPrompt: string,
    userPrompt: string,
    gameState: GameState,
    history: EventHistory
  ): Promise<GMDecision> {
    logger.info('Requesting commander decision from OpenAI', { model: this.model });

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: this.maxTokens,
        temperature: this.temperature
      });

      const content = response.choices[0]?.message?.content || '';
      logger.debug('Received commander LLM response', { length: content.length });

      const decision = this.parseDecision(content);
      // Include raw response for spawn detection
      decision.rawResponse = content;
      return decision;
    } catch (error) {
      logger.error('Error getting commander decision from OpenAI', { error });
      throw error;
    }
  }

  async generateSQF(action: GMAction, context: GameContext): Promise<string> {
    const prompt = this.buildSQFPrompt(action, context);
    
    logger.info('Requesting SQF generation from OpenAI', { actionType: action.type });

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: this.systemPrompt },
          { role: 'user', content: prompt }
        ],
        max_tokens: this.maxTokens,
        temperature: this.temperature
      });

      const content = response.choices[0]?.message?.content || '';
      const sqf = this.extractSQF(content);
      
      if (!sqf) {
        throw new Error('No SQF code found in LLM response');
      }

      return sqf;
    } catch (error) {
      logger.error('Error generating SQF from OpenAI', { error });
      throw error;
    }
  }

  extractSQF(response: string): string | null {
    return sqfParser.extractSQF(response);
  }

  private buildDecisionPrompt(gameState: GameState, history: EventHistory): string {
    const recentEvents = history.events.slice(-10);
    
    return `
# Current Game State

## Players (${gameState.players.length})
${gameState.players.map(p => `- ${p.name} at [${p.position.x.toFixed(0)}, ${p.position.y.toFixed(0)}] - Health: ${(p.health * 100).toFixed(0)}%`).join('\n')}

## Enemy Units (${gameState.enemyUnits.length})
${gameState.enemyUnits.length > 0 ? gameState.enemyUnits.slice(0, 5).map(u => `- ${u.type} at [${u.position.x.toFixed(0)}, ${u.position.y.toFixed(0)}]`).join('\n') : 'None visible'}

## Active Objectives (${gameState.objectives.length})
${gameState.objectives.map(o => `- ${o.description} (${o.state})`).join('\n') || 'None'}

## Recent Events (last ${recentEvents.length})
${recentEvents.map(e => `- [${new Date(e.timestamp).toLocaleTimeString()}] ${e.type}: ${JSON.stringify(e.data)}`).join('\n') || 'None'}

## Environment
- Time: ${gameState.environment.timeOfDay.toFixed(2)}:00
- Weather: ${(gameState.environment.weather * 100).toFixed(0)}% overcast
- Mission Time: ${(gameState.missionContext.elapsedTime / 60).toFixed(1)} minutes

## Your Task
Analyze the current situation and decide what action to take as Game Master. Consider:
1. Are players engaged or idle?
2. Is the difficulty appropriate for their performance?
3. Should you spawn enemies, create objectives, or wait?
4. What would create the most engaging experience?

Respond with:
REASONING: [Your analysis]
ACTION: [spawn/objective/reinforce/narrative/wait]
\`\`\`sqf
[Your SQF code if taking action]
\`\`\`
`.trim();
  }

  private buildSQFPrompt(action: GMAction, context: GameContext): string {
    return `
Generate SQF code for the following Game Master action:

Action Type: ${action.type}
Parameters: ${JSON.stringify(action, null, 2)}

Current Context:
- Player Position: [${context.state.players[0]?.position.x || 0}, ${context.state.players[0]?.position.y || 0}]
- Mission Time: ${context.state.missionContext.elapsedTime}s

Requirements:
1. Use valid Arma 3 SQF syntax
2. Spawn units at least 200m from players
3. Add appropriate waypoints and behaviors
4. Include comments for clarity

Respond with only the SQF code wrapped in \`\`\`sqf code blocks.
`.trim();
  }

  private parseDecision(response: string): GMDecision {
    const parsed = sqfParser.parseResponse(response);
    
    // Determine action type
    let action: GMDecision['action'] = 'wait';
    if (parsed.action) {
      const actionLower = parsed.action.toLowerCase();
      if (['spawn', 'objective', 'reinforce', 'extract', 'narrative', 'wait'].includes(actionLower)) {
        action = actionLower as GMDecision['action'];
      }
    }

    return {
      action,
      reasoning: parsed.reasoning || 'No reasoning provided',
      urgency: 'soon',
      parameters: {
        sqf: parsed.sqf,
        rawResponse: response
      }
    };
  }

  private loadSystemPrompt(): string {
    // This would load from file in production, but for now we'll use inline
    return `# Arma 3 AI Game Master

You are an AI Game Master for Arma 3, a military simulation game. Your role is to create engaging, dynamic, and fair gameplay experiences by controlling the battlefield as a human Zeus would.

## Your Capabilities
- Spawn enemy units (infantry, vehicles, aircraft)
- Create objectives and tasks for players
- Trigger events (ambushes, reinforcements, extractions)
- Adjust difficulty based on player performance
- Deliver narrative moments through radio messages

## Your Constraints
- Never spawn units directly on top of players (minimum 200m for infantry, 500m for vehicles)
- Scale encounters to player count and equipment
- Maintain tactical realism (no teleporting enemies, realistic unit compositions)
- Allow players to succeed - challenge them, don't punish them
- Respect the mission's setting and narrative

## SQF Code Generation Rules
When generating SQF code, you MUST:
1. Use only valid Arma 3 SQF syntax
2. Always specify exact positions using [x, y, z] coordinates
3. Use proper commands: createUnit, createVehicle, createGroup
4. Set appropriate waypoints (BIS_fnc_taskPatrol, addWaypoint)
5. Never use: endMission, failMission, deleteVehicle player, setDamage on players
6. Comment your code for debugging

## Common Arma 3 Commands
- createGroup EAST/WEST/INDEPENDENT
- _group createUnit ["classname", position, [], 0, "FORM"]
- createVehicle ["classname", position, [], 0, "NONE"]
- setBehaviour "AWARE"/"COMBAT"/"SAFE"
- setCombatMode "RED"/"YELLOW"/"GREEN"
- [group, position, radius] call BIS_fnc_taskPatrol

## Response Format
REASONING: [Your analysis in 1-2 sentences]
ACTION: [spawn/objective/reinforce/narrative/wait]
\`\`\`sqf
// Your SQF code here
\`\`\``;
  }
}
