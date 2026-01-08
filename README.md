Project Request: Arma 3 LLM-Powered Game Master
Project Overview
Build an AI-powered Zeus/Game Master system for Arma 3 that uses Large Language Models (LLMs) to dynamically generate and inject SQF code in real-time, creating an autonomous game master experience without human oversight.
Problem Statement
Arma 3's Zeus mode requires a human game master to spawn units, set objectives, and direct scenarios. Current AI solutions are either:
Rule-based mission generators (ALiVE, DUWS, Antistasi) - deterministic and predictable
LLM conversation handlers (DCO GPT) - only handle NPC dialogue, don't generate gameplay
Gap: No system exists that combines LLM intelligence with actual Zeus-like game control (spawning units, creating objectives, adjusting difficulty dynamically).
Project Goals
Create a modular system that:
Extracts game state from Arma 3 (player positions, units, objectives, events)
Sends context to an LLM (OpenAI GPT-4, Claude, or local models)
Receives natural language decisions from the LLM
Translates decisions into valid SQF code
Validates and safely injects SQF into the running game
Maintains narrative coherence and adaptive difficulty
Technical Architecture
System Components
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
Directory Structure
arma3-llm-gamemaster/
├── README.md
├── LICENSE (MIT)
├── docs/
│   ├── ARCHITECTURE.md
│   ├── SETUP.md
│   ├── SQF_REFERENCE.md
│   └── PROMPTS.md
│
├── addon/                          # Arma 3 PBO source
│   ├── config.cpp                  # CfgPatches, CfgFunctions
│   ├── functions/
│   │   ├── fn_initGameMaster.sqf   # Initialize the system
│   │   ├── fn_collectGameState.sqf # Gather all relevant game data
│   │   ├── fn_sendToBridge.sqf     # Send state via extension
│   │   ├── fn_receiveFromBridge.sqf# Receive and execute SQF
│   │   ├── fn_executeGenerated.sqf # Safe SQF execution wrapper
│   │   ├── fn_logEvent.sqf         # Event logging for context
│   │   └── fn_registerCallbacks.sqf# Event handlers for game events
│   ├── XEH_preInit.sqf             # CBA pre-init
│   ├── XEH_postInit.sqf            # CBA post-init
│   └── script_component.hpp
│
├── extension/                      # C++ Extension (DLL/SO)
│   ├── CMakeLists.txt
│   ├── src/
│   │   ├── main.cpp                # Extension entry point
│   │   ├── bridge_client.cpp       # HTTP/WebSocket client
│   │   ├── bridge_client.hpp
│   │   ├── json_handler.cpp        # JSON serialization
│   │   └── json_handler.hpp
│   └── deps/                       # Dependencies (cpp-httplib, nlohmann/json)
│
├── bridge/                         # Node.js Bridge Server
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts                # Main entry point
│   │   ├── server.ts               # HTTP/WebSocket server
│   │   ├── llm/
│   │   │   ├── client.ts           # LLM API abstraction
│   │   │   ├── openai.ts           # OpenAI implementation
│   │   │   ├── claude.ts           # Anthropic Claude implementation
│   │   │   └── local.ts            # Ollama/local model support
│   │   ├── game-state/
│   │   │   ├── manager.ts          # State management
│   │   │   ├── types.ts            # TypeScript interfaces
│   │   │   └── history.ts          # Event history for context
│   │   ├── sqf/
│   │   │   ├── validator.ts        # SQF syntax validation
│   │   │   ├── sanitizer.ts        # Security sanitization
│   │   │   ├── templates.ts        # Common SQF patterns
│   │   │   └── parser.ts           # Extract SQF from LLM response
│   │   ├── gm-logic/
│   │   │   ├── decision-engine.ts  # High-level GM decisions
│   │   │   ├── difficulty.ts       # Adaptive difficulty
│   │   │   ├── narrative.ts        # Story/mission coherence
│   │   │   └── pacing.ts           # Action pacing control
│   │   └── config/
│   │       ├── settings.ts         # Configuration management
│   │       └── defaults.ts         # Default settings
│   └── tests/
│       ├── sqf-validator.test.ts
│       ├── llm-client.test.ts
│       └── game-state.test.ts
│
├── prompts/                        # LLM System Prompts
│   ├── system-prompt.md            # Main GM personality/rules
│   ├── sqf-reference.md            # SQF documentation for context
│   ├── examples/
│   │   ├── spawn-infantry.md       # Example: spawn enemy squad
│   │   ├── create-objective.md     # Example: create task
│   │   ├── adjust-difficulty.md    # Example: scale encounter
│   │   └── narrative-event.md      # Example: story moment
│   └── templates/
│       ├── decision-request.md     # Template for asking LLM decisions
│       └── sqf-generation.md       # Template for SQF generation
│
├── missions/                       # Example Missions
│   ├── demo.Altis/
│   │   ├── mission.sqm
│   │   ├── description.ext
│   │   ├── init.sqf
│   │   └── README.md
│   └── sandbox.Stratis/
│
└── tools/
    ├── pbo-pack.ps1                # PowerShell script to pack PBO
    ├── dev-setup.ps1               # Development environment setup
    └── test-connection.js          # Test bridge connectivity
Detailed Component Specifications
1. Arma 3 Addon (SQF)
fn_collectGameState.sqf
Collect comprehensive game state every N seconds:
// Required data to collect:
{
    "timestamp": serverTime,
    "players": [
        {
            "uid": getPlayerUID,
            "name": name,
            "position": getPosATL,
            "health": damage,
            "vehicle": vehicle player,
            "weapons": weapons player,
            "currentTask": currentTask player
        }
    ],
    "friendlyUnits": [
        // All BLUFOR units with position, health, vehicle, behavior
    ],
    "enemyUnits": [
        // All OPFOR units (known/spotted) with position, type, behavior
    ],
    "objectives": [
        // Current tasks/objectives with state
    ],
    "recentEvents": [
        // Last N events: kills, objectives completed, radio messages
    ],
    "environment": {
        "timeOfDay": daytime,
        "weather": overcast,
        "fog": fog
    },
    "missionContext": {
        "missionName": missionName,
        "briefing": briefingText,
        "elapsedTime": time
    }
}
fn_executeGenerated.sqf
Safely execute LLM-generated SQF:
// Input: String of SQF code from bridge
// Must:
// 1. Log the code being executed
// 2. Wrap in try-catch equivalent
// 3. Execute on appropriate machine (server/client)
// 4. Report success/failure back to bridge
// 5. NEVER execute dangerous commands (exitWith, terminate, etc.)

// Blocked commands list:
// - endMission, failMission, forceEnd
// - terminate, exitWith (at global scope)
// - deleteVehicle player
// - setDamage on players (unless explicitly allowed)
// - Any file operations
2. C++ Extension
The extension bridges Arma 3 and the Node.js server:
// Extension functions needed:
// "llmgm" callExtension ["send", jsonGameState]     -> Sends state to bridge
// "llmgm" callExtension ["receive", ""]             -> Polls for SQF response
// "llmgm" callExtension ["status", ""]              -> Connection status
// "llmgm" callExtension ["config", jsonConfig]      -> Update configuration

// Requirements:
// - Non-blocking HTTP/WebSocket client
// - JSON serialization (nlohmann/json recommended)
// - Thread-safe queue for responses
// - Configurable server URL (localhost:3000 default)
// - Heartbeat/keepalive mechanism
// - Reconnection logic
3. Node.js Bridge Server
LLM Client Interface
interface LLMClient {
    // Send game state and get GM decision
    getDecision(gameState: GameState, history: EventHistory): Promise<GMDecision>;
    
    // Generate specific SQF for an action
    generateSQF(action: GMAction, context: GameContext): Promise<string>;
    
    // Validate if response contains valid SQF
    extractSQF(response: string): string | null;
}

interface GMDecision {
    action: 'spawn' | 'objective' | 'reinforce' | 'extract' | 'narrative' | 'wait';
    reasoning: string;      // LLM's explanation (for logging)
    urgency: 'immediate' | 'soon' | 'whenever';
    parameters: Record<string, any>;
}

interface GMAction {
    type: string;
    target?: Position | Unit;
    units?: UnitType[];
    message?: string;
    // ... action-specific params
}
SQF Validator
interface SQFValidator {
    // Check syntax validity
    validateSyntax(sqf: string): ValidationResult;
    
    // Check for forbidden commands
    checkSecurity(sqf: string): SecurityResult;
    
    // Ensure proper formatting
    sanitize(sqf: string): string;
}

// Forbidden patterns to detect and block:
const FORBIDDEN_PATTERNS = [
    /endMission/i,
    /failMission/i,
    /forceEnd/i,
    /systemChat.*password/i,
    /copyToClipboard/i,
    /serverCommand/i,
    /admin/i,
    // ... etc
];
Game Master Decision Engine
interface DecisionEngine {
    // Analyze state and decide what GM should do
    analyzeState(state: GameState): AnalysisResult;
    
    // Determine if action is needed
    shouldAct(analysis: AnalysisResult): boolean;
    
    // Get appropriate action based on analysis
    determineAction(analysis: AnalysisResult): GMAction;
    
    // Adjust based on player performance
    adaptDifficulty(playerStats: PlayerStats): DifficultyParams;
}

// Decision factors:
// - Time since last GM action
// - Player engagement level (combat, idle, traveling)
// - Mission progress vs expected pacing
// - Player health/resources
// - Narrative beats (story moments)
// - Difficulty curve
4. LLM System Prompt
The system prompt should establish:
# Arma 3 AI Game Master System Prompt

You are an AI Game Master for Arma 3, a military simulation game. Your role is to create 
engaging, dynamic, and fair gameplay experiences by controlling the battlefield as a human 
Zeus would.

## Your Capabilities
- Spawn enemy units (infantry, vehicles, aircraft)
- Create objectives and tasks for players
- Trigger events (ambushes, reinforcements, extractions)
- Adjust difficulty based on player performance
- Deliver narrative moments through radio messages or environmental storytelling

## Your Constraints
- Never spawn units directly on top of players (minimum 200m for infantry, 500m for vehicles)
- Scale encounters to player count and equipment
- Maintain tactical realism (no teleporting enemies, realistic unit compositions)
- Allow players to succeed - challenge them, don't punish them
- Respect the mission's setting and narrative

## SQF Code Generation Rules
When generating SQF code, you must:
1. Use only valid Arma 3 SQF syntax
2. Always specify exact positions using [x, y, z] coordinates or relative positions
3. Use createUnit, createVehicle, and related commands correctly
4. Set appropriate waypoints and behaviors for spawned AI
5. Never use endMission, failMission, or player-harming commands
6. Comment your code for debugging

## Response Format
When asked to take action, respond with:
1. REASONING: Brief explanation of your decision
2. ACTION: The type of action you're taking
3. SQF: The executable code wrapped in ```sqf code blocks

## Example Response
REASONING: Players have been idle at the objective for 3 minutes. Time to create pressure.
ACTION: spawn_patrol
\`\`\`sqf
// Spawn enemy patrol 300m east of players
private _spawnPos = [_playerPos, 300, 90] call BIS_fnc_relPos;
private _group = [_spawnPos, EAST, ["O_Soldier_TL_F", "O_Soldier_F", "O_Soldier_F", "O_Soldier_AR_F"]] call BIS_fnc_spawnGroup;
[_group, _playerPos, 150] call BIS_fnc_taskPatrol;
_group setBehaviour "AWARE";
_group setCombatMode "YELLOW";
\`\`\`

## Current Game State
[Injected dynamically each request]
API Endpoints
Bridge Server REST API
POST /api/state
    Body: GameState JSON
    Response: { received: true, queuePosition: number }

GET /api/action
    Response: { hasAction: boolean, sqf?: string, metadata?: object }

POST /api/event
    Body: { type: string, data: object }
    Response: { logged: true }

GET /api/status
    Response: { connected: boolean, llmStatus: string, queueLength: number }

POST /api/config
    Body: Configuration updates
    Response: { updated: true }
WebSocket Events (Alternative)
Client -> Server:
    "state": GameState object
    "event": Game event
    "config": Configuration update

Server -> Client:
    "action": SQF code to execute
    "status": Connection/LLM status
    "error": Error messages
Configuration Options
interface Config {
    // LLM Settings
    llm: {
        provider: 'openai' | 'claude' | 'ollama' | 'custom';
        apiKey?: string;
        model: string;          // e.g., 'gpt-4', 'claude-3-opus', 'llama2'
        endpoint?: string;      // For custom/local endpoints
        maxTokens: number;
        temperature: number;    // 0.7 recommended for creativity
    };
    
    // Game Master Behavior
    gm: {
        updateInterval: number;         // How often to check state (seconds)
        minActionInterval: number;      // Minimum time between GM actions
        maxActionInterval: number;      // Force action if idle too long
        difficultyBase: number;         // 1-10 scale
        adaptiveDifficulty: boolean;
        narrativeMode: boolean;         // Enable story/radio messages
        respectMissionDesign: boolean;  // Don't override scripted events
    };
    
    // Safety Settings
    safety: {
        maxUnitsPerSpawn: number;       // Limit unit spawns
        minSpawnDistance: number;       // Minimum distance from players
        blockedCommands: string[];      // Additional commands to block
        logAllExecutions: boolean;      // Log all SQF for debugging
        dryRunMode: boolean;            // Don't execute, just log
    };
    
    // Server Settings
    server: {
        port: number;
        host: string;
        enableWebSocket: boolean;
        enableREST: boolean;
        corsOrigins: string[];
    };
}
Development Phases
Phase 1: Foundation (MVP)
[ ] Basic C++ extension with HTTP client
[ ] SQF state collector (simplified - just player positions and counts)
[ ] Node.js server with OpenAI integration
[ ] Basic system prompt
[ ] Simple spawn action (spawn infantry group at location)
[ ] Demo mission
Phase 2: Core Features
[ ] Full game state collection
[ ] SQF validator and sanitizer
[ ] Multiple action types (spawn, objective, reinforce)
[ ] Event history for context
[ ] WebSocket support for lower latency
[ ] Configuration UI (in-game or web)
Phase 3: Intelligence
[ ] Adaptive difficulty system
[ ] Pacing analysis and control
[ ] Narrative event system
[ ] Multi-model support (Claude, local models)
[ ] Decision reasoning logs
Phase 4: Polish
[ ] Steam Workshop release
[ ] Documentation and tutorials
[ ] Community template library
[ ] Performance optimization
[ ] Multiplayer dedicated server support
Testing Requirements
Unit Tests
SQF validator correctly identifies valid/invalid syntax
Security checker catches all forbidden commands
LLM response parser extracts SQF correctly
Game state serialization/deserialization
Configuration loading and validation
Integration Tests
Extension connects to bridge server
Full loop: state -> LLM -> SQF -> execution
Reconnection handling
Queue management under load
Gameplay Tests
Spawned units behave correctly
Objectives create and complete properly
No game-breaking SQF generated
Performance impact acceptable (<5% FPS loss)
Works on dedicated servers
Dependencies
Arma 3 Addon
CBA_A3 (Community Base Addons)
Optional: ACE3 for enhanced features
C++ Extension
nlohmann/json (JSON handling)
cpp-httplib or similar (HTTP client)
OpenSSL (HTTPS support)
Node.js Bridge
express or fastify (HTTP server)
ws (WebSocket)
openai (OpenAI SDK)
@anthropic-ai/sdk (Claude SDK)
zod (schema validation)
winston (logging)
jest (testing)
Success Criteria
Functional: System successfully spawns appropriate enemies based on game state
Safe: No generated SQF causes crashes, exploits, or unfair situations
Performant: <100ms round-trip latency, <5% FPS impact
Engaging: Playtesters report more dynamic/interesting gameplay than static missions
Configurable: Mission makers can customize GM behavior without coding
Reliable: Handles disconnections, errors, and edge cases gracefully
References
Arma 3 SQF Syntax Documentation
Arma 3 Extension Development
CBA_A3 Framework
DCO GPT Mod (Reference Implementation)
ALiVE Mod Architecture
OpenAI API Documentation
Anthropic Claude API
Quick Start (For AI Code Generation)
Generate the project in this order:
Start with package.json and TypeScript config for the bridge
Create the type definitions (bridge/src/game-state/types.ts)
Build the LLM client abstraction
Implement the SQF validator
Create the HTTP server endpoints
Write the system prompt
Build the C++ extension skeleton
Create the SQF addon functions
Make a minimal demo mission
Write tests for critical paths
Focus on clean, documented code. Each component should be independently testable.
Use dependency injection for the LLM client to allow easy swapping of providers.
Prioritize safety - the SQF validator is critical and should be thorough.