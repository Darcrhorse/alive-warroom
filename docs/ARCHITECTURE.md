# Arma 3 LLM Game Master - Architecture

## System Overview

The Arma 3 LLM Game Master is a three-tier system that enables Large Language Models to act as autonomous Zeus/Game Masters in Arma 3:

```
┌─────────────────────────────────────────────────────────────────┐
│                         ARMA 3 GAME                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ Game State   │  │   SQF        │  │  Extension Callback  │  │
│  │ Collector    │  │   Executor   │  │  (callExtension)     │  │
│  └──────┬───────┘  └──────▲───────┘  └──────────┬───────────┘  │
└─────────┼─────────────────┼─────────────────────┼───────────────┘
          │ JSON            │ SQF                 │ DLL/SO
          ▼                 │                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                      BRIDGE SERVER (Node.js)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ State        │  │   SQF        │  │  WebSocket/HTTP      │  │
│  │ Manager      │  │   Validator  │  │  Server              │  │
│  └──────┬───────┘  └──────▲───────┘  └──────────────────────┘  │
│         │                 │                                     │
│         ▼                 │                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              LLM Client (OpenAI/Claude/Local)            │  │
│  │  - System prompts with SQF documentation                 │  │
│  │  - Game state context injection                          │  │
│  │  - Decision parsing and SQF extraction                   │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Components

### 1. Arma 3 Addon (SQF)

**Purpose**: Collects game state, sends to bridge, receives and executes LLM-generated SQF

**Key Files**:
- `fn_initGameMaster.sqf` - Initializes system, starts update loop
- `fn_collectGameState.sqf` - Gathers players, units, objectives, events
- `fn_sendToBridge.sqf` - Sends state via extension
- `fn_receiveFromBridge.sqf` - Polls for actions from bridge
- `fn_executeGenerated.sqf` - Safely executes LLM-generated SQF with security checks
- `fn_logEvent.sqf` - Logs events for LLM context
- `fn_registerCallbacks.sqf` - Auto-logs kills, objectives, etc.

**Dependencies**:
- CBA_A3 (Community Base Addons) for event handlers and framework

**Security**:
- Blocked commands list prevents dangerous operations
- Pre-execution validation
- All executions logged for audit

### 2. Bridge Server (Node.js/TypeScript)

**Purpose**: Mediates between Arma 3 and LLM, validates and sanitizes SQF

**Key Modules**:

#### Game State Management
- `types.ts` - TypeScript interfaces for all data structures
- `manager.ts` - Maintains current state and history
- `history.ts` - Event history with time-based queries

#### LLM Integration
- `client.ts` - Abstract LLM interface
- `openai.ts` - OpenAI GPT-4 implementation
- Future: `claude.ts`, `local.ts` for other providers

#### SQF Processing
- `validator.ts` - **Security critical** - validates syntax and blocks dangerous commands
- `sanitizer.ts` - Removes malicious patterns, adds metadata
- `parser.ts` - Extracts SQF from LLM responses
- `templates.ts` - Common SQF patterns for actions
- `commands-database.json` - Complete Arma 3 command reference from BI Wiki

#### Server
- `server.ts` - HTTP/WebSocket server with REST API
- `index.ts` - Entry point and error handling

**API Endpoints**:
- `POST /api/state` - Receive game state from Arma 3
- `GET /api/action` - Send SQF actions to Arma 3
- `POST /api/event` - Log game events
- `GET /api/status` - Connection and LLM status
- `POST /api/config` - Update configuration

**Security Layers**:
1. Input validation (Zod schemas)
2. SQF syntax validation
3. Forbidden command detection
4. Rate limiting
5. Dry-run mode for testing

### 3. C++ Extension (Future)

**Purpose**: Bridge between Arma 3 and Node.js server

**Planned Features**:
- Non-blocking HTTP/WebSocket client
- JSON serialization (nlohmann/json)
- Thread-safe request/response queue
- Automatic reconnection
- Heartbeat mechanism

**Interface**:
```cpp
"llmgm" callExtension ["send", jsonGameState]    // Send state
"llmgm" callExtension ["receive", ""]            // Poll for actions
"llmgm" callExtension ["status", ""]             // Connection status
"llmgm" callExtension ["config", jsonConfig]     // Update config
```

## Data Flow

### 1. Game State Collection (every 30s)
```
Arma 3 → fn_collectGameState → JSON → fn_sendToBridge → Extension → HTTP POST → Bridge Server
```

### 2. LLM Decision Making
```
Bridge receives state → State Manager → LLM Client → OpenAI API
                                         ↓
OpenAI response → Parser → Validator → Sanitizer → Action Queue
```

### 3. SQF Execution
```
Arma 3 → fn_receiveFromBridge → Extension → HTTP GET → Bridge Server → Action from Queue
                                                           ↓
Arma 3 ← fn_executeGenerated ← SQF Code with metadata ← Bridge
```

### 4. Event Logging (continuous)
```
Arma 3 (kill, objective, etc.) → fn_logEvent → Event History → LLM Context
```

## LLM Decision Making

### Input to LLM
1. **System Prompt**:
   - Role and capabilities
   - Constraints and rules
   - SQF syntax guide
   - Example responses
   - Context about existing AI systems (ALiVE, DCO GPT)

2. **Game State**:
   - Player positions, health, loadout
   - Enemy units (known/spotted)
   - Friendly units
   - Active objectives
   - Recent events (last 10)
   - Environment (time, weather)
   - Mission context

3. **History**:
   - Previous GM actions
   - Kill/death patterns
   - Objective completion rates
   - Player behavior patterns

### LLM Output
```
REASONING: [Analysis of situation]
ACTION: [spawn/objective/reinforce/narrative/wait]
```sqf
// Generated SQF code
```
```

### Validation Pipeline
1. **Parse** - Extract reasoning, action, SQF from response
2. **Validate Syntax** - Check brace/bracket balance, structure
3. **Security Check** - Block forbidden commands
4. **Sanitize** - Remove comments, add metadata
5. **Queue** - Add to action queue with priority

## Configuration

### Environment Variables (.env)
```bash
# LLM Provider
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4

# Game Master Behavior
GM_UPDATE_INTERVAL=30          # State update frequency (seconds)
GM_MIN_ACTION_INTERVAL=60      # Minimum time between actions
GM_MAX_ACTION_INTERVAL=300     # Force action if idle too long
GM_DIFFICULTY_BASE=5           # 1-10 scale
GM_ADAPTIVE_DIFFICULTY=true    # Adjust based on performance
GM_NARRATIVE_MODE=true         # Enable story elements

# Safety
SAFETY_MAX_UNITS_PER_SPAWN=12
SAFETY_MIN_SPAWN_DISTANCE=200
SAFETY_LOG_ALL_EXECUTIONS=true
SAFETY_DRY_RUN_MODE=false      # Test without executing
```

## Security Considerations

### Forbidden Commands
The validator blocks these dangerous patterns:
- `endMission`, `failMission`, `forceEnd` - Mission control
- `serverCommand`, `admin` - Server control
- `deleteVehicle player` - Player harm
- `saveProfileNamespace`, `loadFile` - File operations
- `call compile` - Dynamic code injection

### Execution Safety
1. All SQF logged before execution
2. Try-catch equivalent wrapping
3. Dry-run mode for testing
4. Manual review capability
5. Rollback mechanisms (future)

## Performance

### Targets
- **Round-trip latency**: <100ms (state → LLM → SQF)
- **FPS impact**: <5%
- **Memory overhead**: <50MB
- **LLM API calls**: ~2-3 per minute

### Optimization Strategies
1. State diff compression (future)
2. LLM response caching
3. WebSocket for lower latency
4. Async processing
5. Rate limiting

## Extensibility

### Adding New LLM Providers
1. Implement `LLMClient` interface
2. Add to provider factory
3. Update configuration
4. Test with mock responses

### Adding New Actions
1. Add action type to `GMDecision`
2. Create SQF template in `templates.ts`
3. Update system prompt with examples
4. Add validation rules

### Custom Decision Logic
1. Extend `DecisionEngine` (future)
2. Add custom analyzers
3. Override decision weights
4. Implement custom pacing

## Deployment

### Development
```bash
# Bridge server
cd bridge
npm install
cp .env.example .env
# Edit .env with API key
npm run dev

# Arma 3 (local)
# Copy addon folder to Arma 3 directory
# Load in mission via description.ext
```

### Production
```bash
# Bridge server
npm run build
npm start

# Arma 3 (dedicated server)
# Pack addon to PBO
# Install on server
# Configure extension path
```

## Monitoring and Debugging

### Logs
- Bridge: `bridge/logs/combined.log`
- Arma 3: Arma 3 RPT file
- Extension: Extension logs (future)

### Debug Tools
- Dry-run mode: Test without execution
- Action queue inspector
- State snapshot export
- LLM prompt debugger

## Future Enhancements

1. **Adaptive Difficulty**: Automatic scaling based on player performance
2. **Narrative System**: Story-driven event generation
3. **Multi-model Support**: Claude, local LLMs (Ollama)
4. **Configuration UI**: Web interface for settings
5. **Metrics Dashboard**: Performance and engagement metrics
6. **Community Templates**: Shareable GM personalities
7. **Voice Integration**: TTS for radio messages
8. **Replay System**: Record and review GM decisions
