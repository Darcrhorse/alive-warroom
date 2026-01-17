/**
 * Anthropic Claude LLM Client Implementation
 * Uses raw fetch with OAuth support - no SDK dependency issues
 */

import { LLMClient } from './client';
import { GameState, EventHistory, GMDecision, GMAction, GameContext } from '../game-state/types';
import { sqfParser } from '../sqf/parser';
import { logger } from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';

interface OAuthCredentials {
  claudeAiOauth: {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    scopes: string[];
    subscriptionType: string;
    rateLimitTier: string;
  };
}

interface AnthropicResponse {
  content: Array<{ type: string; text?: string }>;
  model: string;
  stop_reason: string;
}

export class AnthropicClient implements LLMClient {
  private apiKey: string;
  private model: string;
  private maxTokens: number;
  private systemPrompt: string;
  private useOAuth: boolean = false;
  private baseUrl: string = 'https://api.anthropic.com/v1/messages';

  constructor(
    apiKeyOrPath: string,
    model: string = 'claude-sonnet-4-20250514',
    maxTokens: number = 2000
  ) {
    // Check if it's OAuth token or credentials file
    if (apiKeyOrPath.startsWith('sk-ant-oat')) {
      this.useOAuth = true;
      this.apiKey = apiKeyOrPath;
      logger.info('Using OAuth access token authentication');
    } else if (apiKeyOrPath === 'oauth' || apiKeyOrPath.includes('credentials.json')) {
      const credentials = this.loadOAuthCredentials(apiKeyOrPath);
      if (credentials) {
        this.useOAuth = true;
        this.apiKey = credentials.claudeAiOauth.accessToken;
        logger.info('Using OAuth from credentials file', {
          subscriptionType: credentials.claudeAiOauth.subscriptionType
        });
      } else {
        throw new Error('Failed to load OAuth credentials');
      }
    } else {
      this.apiKey = apiKeyOrPath;
      logger.info('Using API key authentication');
    }

    this.model = model;
    this.maxTokens = maxTokens;
    this.systemPrompt = this.loadSystemPrompt();
  }

  private loadOAuthCredentials(pathOrKeyword: string): OAuthCredentials | null {
    const possiblePaths = [
      'G:/ClaudeData/.credentials.json',
      process.env.CLAUDE_CREDENTIALS_PATH,
      path.join(process.env.APPDATA || '', 'claude-code', '.credentials.json'),
      path.join(process.env.HOME || '', '.claude', 'credentials.json')
    ].filter(Boolean) as string[];

    if (pathOrKeyword !== 'oauth' && fs.existsSync(pathOrKeyword)) {
      possiblePaths.unshift(pathOrKeyword);
    }

    for (const credPath of possiblePaths) {
      try {
        if (fs.existsSync(credPath)) {
          const data = fs.readFileSync(credPath, 'utf-8');
          const creds = JSON.parse(data) as OAuthCredentials;
          if (creds.claudeAiOauth?.accessToken) {
            logger.info('Loaded OAuth credentials from', { path: credPath });
            return creds;
          }
        }
      } catch (e) {
        logger.debug('Failed to load credentials from', { path: credPath, error: e });
      }
    }
    return null;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01'
    };

    if (this.useOAuth) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
      headers['anthropic-beta'] = 'oauth-2025-04-20';
    } else {
      headers['x-api-key'] = this.apiKey;
    }

    return headers;
  }

  private async callAPI(systemPrompt: string, userPrompt: string): Promise<string> {
    const body = {
      model: this.model,
      max_tokens: this.maxTokens,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt }
      ]
    };

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Anthropic API error', { status: response.status, error: errorText });
      throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as AnthropicResponse;
    return data.content[0]?.type === 'text' ? data.content[0].text || '' : '';
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  async getDecision(gameState: GameState, history: EventHistory): Promise<GMDecision> {
    const prompt = this.buildDecisionPrompt(gameState, history);

    logger.info('Requesting decision from Claude', { model: this.model, useOAuth: this.useOAuth });

    try {
      const content = await this.callAPI(this.systemPrompt, prompt);
      logger.debug('Received Claude response', { length: content.length });
      return this.parseDecision(content);
    } catch (error) {
      logger.error('Error getting decision from Claude', { error });
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
    logger.info('Requesting commander decision from Claude', { model: this.model, useOAuth: this.useOAuth });

    try {
      const content = await this.callAPI(systemPrompt, userPrompt);
      logger.debug('Received commander Claude response', { length: content.length });

      const decision = this.parseDecision(content);
      decision.rawResponse = content;
      return decision;
    } catch (error) {
      logger.error('Error getting commander decision from Claude', { error });
      throw error;
    }
  }

  async generateSQF(action: GMAction, context: GameContext): Promise<string> {
    const prompt = this.buildSQFPrompt(action, context);

    logger.info('Requesting SQF generation from Claude', { actionType: action.type });

    try {
      const content = await this.callAPI(this.systemPrompt, prompt);
      const sqf = this.extractSQF(content);

      if (!sqf) {
        throw new Error('No SQF code found in Claude response');
      }

      return sqf;
    } catch (error) {
      logger.error('Error generating SQF from Claude', { error });
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
${gameState.players.map(p => `- ${p.name || 'Unknown'} at [${p.position?.x?.toFixed(0) || 0}, ${p.position?.y?.toFixed(0) || 0}] - Health: ${((p.health || 1) * 100).toFixed(0)}%`).join('\n') || 'No players'}

## Enemy Units (${gameState.enemyUnits?.length || 0})
${gameState.enemyUnits?.length > 0 ? gameState.enemyUnits.slice(0, 5).map(u => `- ${u.type || 'Unknown'} at [${u.position?.x?.toFixed(0) || 0}, ${u.position?.y?.toFixed(0) || 0}]`).join('\n') : 'None visible'}

## Active Objectives (${gameState.objectives?.length || 0})
${gameState.objectives?.map(o => `- ${o.description || 'Unknown'} (${o.state || 'unknown'})`).join('\n') || 'None'}

## Recent Events (last ${recentEvents.length})
${recentEvents.map(e => `- [${new Date(e.timestamp).toLocaleTimeString()}] ${e.type}: ${JSON.stringify(e.data)}`).join('\n') || 'None'}

## Environment
- Time: ${gameState.environment?.timeOfDay?.toFixed(2) || 12}:00
- Weather: ${((gameState.environment?.weather || 0) * 100).toFixed(0)}% overcast
- Mission Time: ${((gameState.missionContext?.elapsedTime || 0) / 60).toFixed(1)} minutes

## Your Task
Analyze the current situation and decide what action to take as Game Master.

CRITICAL SQF RULES:
- Use SINGLE QUOTES for ALL strings (double quotes get corrupted)
- Never use sleep/waitUntil directly (wrap in spawn block)

Respond with:
REASONING: [Your analysis]
ACTION: [spawn/objective/reinforce/narrative/wait]
\`\`\`sqf
[Your SQF code if taking action - USE SINGLE QUOTES]
\`\`\`
`.trim();
  }

  private buildSQFPrompt(action: GMAction, context: GameContext): string {
    return `
Generate SQF code for the following Game Master action:

Action Type: ${action.type}
Parameters: ${JSON.stringify(action, null, 2)}

Current Context:
- Player Position: [${context.state?.players?.[0]?.position?.x || 0}, ${context.state?.players?.[0]?.position?.y || 0}]
- Mission Time: ${context.state?.missionContext?.elapsedTime || 0}s

CRITICAL: Use SINGLE QUOTES for ALL strings.

Respond with only the SQF code wrapped in \`\`\`sqf code blocks.
`.trim();
  }

  private parseDecision(response: string): GMDecision {
    const parsed = sqfParser.parseResponse(response);

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
    return `# Arma 3 AI Game Master (Claude)

You are an AI Game Master for Arma 3. Create engaging gameplay by controlling the battlefield.

## CRITICAL: SQF String Rules
Use SINGLE QUOTES for ALL strings: 'O_Soldier_F' not "O_Soldier_F"

## CRITICAL: No Direct Suspension
Never use sleep/waitUntil directly. Wrap in spawn:
[] spawn { sleep 5; hint 'Done'; };

## Your Capabilities
- Spawn enemy units (infantry, vehicles)
- Create objectives and tasks
- Trigger events (ambushes, reinforcements)

## Constraints
- Min 200m from players for infantry spawns
- Scale to player count
- Allow players to succeed

## Response Format
REASONING: [1-2 sentence analysis]
ACTION: [spawn/objective/reinforce/narrative/wait]
\`\`\`sqf
// SQF code - SINGLE QUOTES ONLY
\`\`\``;
  }
}
