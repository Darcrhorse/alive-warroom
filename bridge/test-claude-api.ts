/**
 * Test script to verify Claude API integration
 *
 * Usage:
 *   CLAUDE_API_KEY=sk-ant-... npx ts-node test-claude-api.ts
 */

import Anthropic from '@anthropic-ai/sdk';
import { AnthropicClient } from './src/llm/anthropic';
import { GameState, EventHistory } from './src/game-state/types';

const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;

async function testBasicClaudeAPI() {
  console.log('\n=== Testing Basic Claude API Connection ===\n');

  if (!CLAUDE_API_KEY) {
    console.error('❌ CLAUDE_API_KEY environment variable not set');
    console.log('\nPlease set CLAUDE_API_KEY or ANTHROPIC_API_KEY environment variable:');
    console.log('  export CLAUDE_API_KEY=sk-ant-...');
    console.log('  npx ts-node test-claude-api.ts');
    process.exit(1);
  }

  try {
    const client = new Anthropic({ apiKey: CLAUDE_API_KEY });

    console.log('✓ Anthropic SDK v0.71.2 loaded successfully');
    console.log('✓ API key configured\n');

    console.log('Making test API call to Claude...\n');

    const response = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 100,
      messages: [
        { role: 'user', content: 'Say "API test successful" if you can read this.' }
      ]
    });

    const content = response.content[0]?.type === 'text' ? response.content[0].text : '';

    console.log('✓ Received response from Claude API');
    console.log('  Model:', response.model);
    console.log('  Response:', content);
    console.log('  Tokens used:', response.usage.input_tokens, 'input,', response.usage.output_tokens, 'output\n');

    return true;
  } catch (error: any) {
    console.error('❌ Claude API test failed:');
    console.error('  Error:', error.message);
    if (error.status) {
      console.error('  Status:', error.status);
    }
    return false;
  }
}

async function testAnthropicClientIntegration() {
  console.log('\n=== Testing AnthropicClient Implementation ===\n');

  if (!CLAUDE_API_KEY) {
    console.error('❌ Skipping (no API key)');
    return false;
  }

  try {
    const client = new AnthropicClient(CLAUDE_API_KEY, 'claude-3-5-sonnet-20241022', 500, 0.7);

    console.log('✓ AnthropicClient instantiated');
    console.log('✓ Client configured:', client.isConfigured());

    // Create mock game state
    const mockGameState: GameState = {
      timestamp: Date.now(),
      players: [
        {
          id: 'test_player_1',
          name: 'Test Player',
          position: { x: 1000, y: 2000, z: 50 },
          health: 0.9,
          side: 'WEST',
          vehicle: 'none',
          weapons: []
        }
      ],
      enemyUnits: [],
      objectives: [],
      environment: {
        timeOfDay: 12,
        weather: 0,
        fog: 0,
        wind: { x: 0, y: 0, z: 0 }
      },
      missionContext: {
        name: 'Test Mission',
        worldName: 'Altis',
        elapsedTime: 300
      }
    };

    const mockHistory: EventHistory = {
      events: [],
      startTime: Date.now()
    };

    console.log('\nRequesting GM decision from Claude...\n');

    const decision = await client.getDecision(mockGameState, mockHistory);

    console.log('✓ Received GM decision from Claude');
    console.log('  Action:', decision.action);
    console.log('  Reasoning:', decision.reasoning);
    console.log('  Has SQF:', !!decision.parameters.sqf);

    if (decision.parameters.sqf) {
      console.log('\n  Generated SQF code:');
      console.log('  ' + (decision.parameters.sqf as string).split('\n').join('\n  '));
    }

    return true;
  } catch (error: any) {
    console.error('❌ AnthropicClient test failed:');
    console.error('  Error:', error.message);
    return false;
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║        Claude API Integration Test - Anthropic SDK v0.71.2    ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');

  const test1Success = await testBasicClaudeAPI();
  const test2Success = await testAnthropicClientIntegration();

  console.log('\n' + '='.repeat(66));
  console.log('\n📊 Test Results:\n');
  console.log(`  ${test1Success ? '✓' : '❌'} Basic Claude API Connection`);
  console.log(`  ${test2Success ? '✓' : '❌'} AnthropicClient Integration`);
  console.log();

  if (test1Success && test2Success) {
    console.log('✅ All tests passed! Claude API integration is working correctly.');
    console.log('\n💡 Next steps:');
    console.log('   1. Create a .env file in the bridge directory');
    console.log('   2. Add: LLM_PROVIDER=claude');
    console.log('   3. Add: CLAUDE_API_KEY=your_api_key_here');
    console.log('   4. Add: OPENAI_MODEL=claude-3-5-sonnet-20241022');
    console.log('   5. Start the bridge server: npm run dev');
    process.exit(0);
  } else {
    console.log('❌ Some tests failed. Please check the errors above.');
    process.exit(1);
  }
}

main();
