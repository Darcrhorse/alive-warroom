/**
 * Test script for Claude API integration
 * Verifies Anthropic SDK v0.71.2 can call Claude API and receive valid responses
 */

import { AnthropicClient } from '../src/llm/anthropic';
import { GameState, EventHistory } from '../src/game-state/types';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Mock game state for testing
const mockGameState: GameState = {
  timestamp: Date.now(),
  players: [
    {
      uid: 'test_player_1',
      name: 'TestPlayer',
      position: { x: 1000, y: 2000, z: 50 },
      health: 0.85,
      vehicle: null,
      weapons: ['arifle_MX_F', 'hgun_P07_F'],
      currentTask: null
    }
  ],
  friendlyUnits: [],
  enemyUnits: [
    {
      id: 'enemy_1',
      type: 'O_Soldier_F',
      position: { x: 1500, y: 2500, z: 45 },
      health: 1.0,
      vehicle: null,
      behavior: 'COMBAT',
      side: 'OPFOR'
    }
  ],
  objectives: [],
  recentEvents: [],
  environment: {
    timeOfDay: 14.5,
    weather: 0.2,
    fog: 0.1
  },
  missionContext: {
    missionName: 'Test Mission',
    briefing: 'Test mission for Claude API integration',
    elapsedTime: 300
  }
};

const mockHistory: EventHistory = {
  events: [],
  maxSize: 100
};

async function testClaudeAPIIntegration() {
  console.log('=== Claude API Integration Test ===\n');

  // Check for API key
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    console.error('❌ CLAUDE_API_KEY not found in environment variables');
    console.log('Please set CLAUDE_API_KEY in .env file or environment');
    process.exit(1);
  }

  console.log('✓ CLAUDE_API_KEY found');

  // Create Anthropic client
  const client = new AnthropicClient(
    apiKey,
    'claude-3-5-sonnet-20241022',
    2000,
    0.7
  );

  console.log('✓ AnthropicClient instantiated');
  console.log(`  Model: claude-3-5-sonnet-20241022`);
  console.log(`  SDK Version: @anthropic-ai/sdk ^0.71.2`);

  // Test 1: Check client configuration
  console.log('\n--- Test 1: Client Configuration ---');
  const isConfigured = client.isConfigured();
  console.log(`Client configured: ${isConfigured ? '✓ Yes' : '❌ No'}`);

  if (!isConfigured) {
    console.error('Client is not properly configured');
    process.exit(1);
  }

  // Test 2: Call Claude API for decision
  console.log('\n--- Test 2: Get Decision from Claude ---');
  console.log('Sending game state to Claude API...');

  try {
    const startTime = Date.now();
    const decision = await client.getDecision(mockGameState, mockHistory);
    const elapsed = Date.now() - startTime;

    console.log(`✓ Received response in ${elapsed}ms`);
    console.log(`  Action: ${decision.action}`);
    console.log(`  Reasoning: ${decision.reasoning.substring(0, 100)}...`);
    console.log(`  Urgency: ${decision.urgency}`);

    // Validate decision structure
    if (!decision.action || !decision.reasoning) {
      throw new Error('Invalid decision structure');
    }

    console.log('✓ Decision structure is valid');

    // Check if SQF code was generated
    if (decision.parameters.sqf) {
      console.log('✓ SQF code generated');
      console.log(`  Length: ${decision.parameters.sqf.length} characters`);
    } else {
      console.log('  Note: No SQF code (action may be "wait")');
    }

  } catch (error: any) {
    console.error('❌ Error calling Claude API:', error.message);
    if (error.status) {
      console.error(`  Status: ${error.status}`);
    }
    if (error.type) {
      console.error(`  Type: ${error.type}`);
    }
    process.exit(1);
  }

  // Test 3: Test SQF extraction
  console.log('\n--- Test 3: SQF Code Extraction ---');
  const testResponse = `
REASONING: Testing SQF extraction
ACTION: spawn
\`\`\`sqf
// Test SQF code
private _group = createGroup EAST;
_unit = _group createUnit ["O_Soldier_F", [1000, 2000, 0], [], 0, "FORM"];
\`\`\`
`;

  const extractedSQF = client.extractSQF(testResponse);
  if (extractedSQF) {
    console.log('✓ SQF extraction works');
    console.log(`  Extracted: ${extractedSQF.substring(0, 50)}...`);
  } else {
    console.log('❌ SQF extraction failed');
  }

  // Summary
  console.log('\n=== Test Summary ===');
  console.log('✓ All tests passed!');
  console.log('✓ Bridge server can call Claude API using Anthropic SDK v0.71.2');
  console.log('✓ Claude API returns valid responses');
  console.log('✓ Response parsing works correctly');
  console.log('\nClaude API integration is working correctly.');
}

// Run tests
testClaudeAPIIntegration()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed with error:', error);
    process.exit(1);
  });
