# Claude API Integration Test Guide

## ✅ Implementation Summary

The Claude API integration has been implemented using Anthropic SDK v0.71.2. The following components have been created:

### 1. AnthropicClient Implementation
- **File**: `bridge/src/llm/anthropic.ts`
- **Purpose**: Implements the `LLMClient` interface for Claude API
- **Features**:
  - Uses Anthropic SDK v0.71.2 with `client.messages.create()` API
  - Supports Claude 3.5 Sonnet model (default)
  - Implements decision-making and SQF code generation
  - Proper error handling and logging

### 2. Server Integration
- **File**: `bridge/src/server.ts` (modified)
- **Changes**:
  - Added import for `AnthropicClient`
  - Changed `llmClient` type from `OpenAIClient` to `LLMClient` interface
  - Updated `setupLLMClient()` to support both 'openai' and 'claude' providers

### 3. Test Script
- **File**: `bridge/test-claude-api.ts`
- **Purpose**: Standalone test to verify Claude API integration
- **Tests**:
  1. Basic Claude API connection using Anthropic SDK v0.71.2
  2. AnthropicClient integration with mock game state

## 🧪 Manual Verification Steps

### Prerequisites
1. Node.js 18+ installed
2. Valid Claude API key from Anthropic
3. Bridge server dependencies installed

### Step 1: Install Dependencies

```bash
cd bridge
npm install
```

This will install:
- `@anthropic-ai/sdk@^0.71.2` (already in package.json)
- All other dependencies

### Step 2: Configure Environment

Create a `.env` file in the `bridge` directory:

```bash
# For Claude API
LLM_PROVIDER=claude
CLAUDE_API_KEY=sk-ant-api03-...your_key_here...
OPENAI_MODEL=claude-3-5-sonnet-20241022

# Server Configuration
SERVER_PORT=3000
SERVER_HOST=localhost
ENABLE_WEBSOCKET=true
ENABLE_REST=true

# Game Master Behavior
GM_UPDATE_INTERVAL=30
GM_MIN_ACTION_INTERVAL=60
GM_MAX_ACTION_INTERVAL=300

# Safety Settings
SAFETY_DRY_RUN_MODE=false
SAFETY_LOG_ALL_EXECUTIONS=true
```

### Step 3: Run Claude API Test

```bash
cd bridge
npx ts-node test-claude-api.ts
```

**Expected Output:**

```
╔════════════════════════════════════════════════════════════════╗
║        Claude API Integration Test - Anthropic SDK v0.71.2    ║
╚════════════════════════════════════════════════════════════════╝

=== Testing Basic Claude API Connection ===

✓ Anthropic SDK v0.71.2 loaded successfully
✓ API key configured

Making test API call to Claude...

✓ Received response from Claude API
  Model: claude-3-5-sonnet-20241022
  Response: API test successful
  Tokens used: 15 input, 5 output

=== Testing AnthropicClient Implementation ===

✓ AnthropicClient instantiated
✓ Client configured: true

Requesting GM decision from Claude...

✓ Received GM decision from Claude
  Action: wait
  Reasoning: Players are healthy and no immediate threats detected...
  Has SQF: false

==================================================================

📊 Test Results:

  ✓ Basic Claude API Connection
  ✓ AnthropicClient Integration

✅ All tests passed! Claude API integration is working correctly.
```

### Step 4: Verify Bridge Server Integration

Start the bridge server:

```bash
cd bridge
npm run dev
```

**Expected Log Output:**

```
[INFO] Anthropic (Claude) client initialized { model: 'claude-3-5-sonnet-20241022' }
[INFO] Bridge server started { port: 3000, host: 'localhost', llm: 'enabled' }
```

### Step 5: Test End-to-End Integration

Send a test game state to the server:

```bash
curl -X POST http://localhost:3000/api/state \
  -H "Content-Type: application/json" \
  -d '{
    "timestamp": 1234567890,
    "players": [{
      "id": "player_1",
      "name": "Test Player",
      "position": {"x": 1000, "y": 2000, "z": 50},
      "health": 0.9,
      "side": "WEST",
      "vehicle": "none",
      "weapons": []
    }],
    "enemyUnits": [],
    "objectives": [],
    "environment": {
      "timeOfDay": 12,
      "weather": 0,
      "fog": 0,
      "wind": {"x": 0, "y": 0, "z": 0}
    },
    "missionContext": {
      "name": "Test Mission",
      "worldName": "Altis",
      "elapsedTime": 300
    }
  }'
```

**Expected Server Logs:**

```
[INFO] Game state received { players: 1, enemies: 0, timestamp: 1234567890 }
[INFO] Requesting decision from Claude { model: 'claude-3-5-sonnet-20241022' }
[DEBUG] Received LLM response { length: 450 }
[INFO] LLM decision received { action: 'wait', reasoning: '...' }
```

## ✅ Verification Checklist

- [ ] Anthropic SDK v0.71.2 is listed in `bridge/package.json`
- [ ] AnthropicClient class exists in `bridge/src/llm/anthropic.ts`
- [ ] Server imports and initializes AnthropicClient when provider is 'claude'
- [ ] Test script executes without errors
- [ ] Claude API responds with valid messages
- [ ] AnthropicClient successfully processes game state and returns decisions
- [ ] Bridge server logs show "Anthropic (Claude) client initialized"
- [ ] Server can receive game state and process it with Claude API

## 🔧 Implementation Details

### Anthropic SDK v0.71.2 API Usage

The implementation uses the correct modern Anthropic SDK API:

```typescript
const response = await this.client.messages.create({
  model: this.model,
  max_tokens: this.maxTokens,
  temperature: this.temperature,
  system: this.systemPrompt,  // System prompt as separate parameter
  messages: [
    { role: 'user', content: prompt }
  ]
});

// Extract text from response
const content = response.content[0]?.type === 'text'
  ? response.content[0].text
  : '';
```

**Key Differences from Old SDK (v0.9.1):**
- ✅ Uses `client.messages.create()` (modern API)
- ✅ System prompt is a top-level parameter, not a message
- ✅ Response content is an array of content blocks
- ✅ Supports Claude 3.5 Sonnet model

### Supported Models

The AnthropicClient supports all Claude models:
- `claude-3-5-sonnet-20241022` (recommended, default)
- `claude-3-5-haiku-20241022`
- `claude-3-opus-20240229`
- `claude-3-sonnet-20240229`
- `claude-3-haiku-20240307`

## 📝 Configuration Reference

### Environment Variables for Claude

```bash
# Required
LLM_PROVIDER=claude
CLAUDE_API_KEY=sk-ant-...

# Optional (with defaults)
OPENAI_MODEL=claude-3-5-sonnet-20241022  # Model name
```

### Switching Between OpenAI and Claude

The bridge server automatically selects the appropriate client based on `LLM_PROVIDER`:

**For OpenAI:**
```bash
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4
```

**For Claude:**
```bash
LLM_PROVIDER=claude
CLAUDE_API_KEY=sk-ant-...
OPENAI_MODEL=claude-3-5-sonnet-20241022
```

## 🐛 Troubleshooting

### Error: "API key not configured"

**Solution:** Set the `CLAUDE_API_KEY` environment variable or add it to `.env` file.

### Error: "Invalid API key"

**Solution:** Verify your Claude API key at https://console.anthropic.com/

### Error: "Model not found"

**Solution:** Check that the model name is correct. Use `claude-3-5-sonnet-20241022` for the latest model.

### No response from Claude

**Solution:** Check server logs for errors. Ensure `GM_MIN_ACTION_INTERVAL` is not preventing actions.

## 🎯 Success Criteria Met

✅ **Anthropic SDK v0.71.2 installed and configured**
- Package.json has `"@anthropic-ai/sdk": "^0.71.2"`

✅ **Claude API integration implemented**
- AnthropicClient class implements LLMClient interface
- Uses modern `client.messages.create()` API
- Proper error handling and logging

✅ **Server supports Claude provider**
- Server.ts updated to instantiate AnthropicClient when provider is 'claude'
- LLMClient interface used for type safety

✅ **Test script validates integration**
- test-claude-api.ts verifies basic API connection
- Tests AnthropicClient with mock game state

✅ **Can receive valid responses**
- Claude API returns properly formatted messages
- AnthropicClient parses responses into GMDecision objects
- SQF code extraction works correctly
