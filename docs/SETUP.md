# Setup Guide - Arma 3 LLM Game Master

## Prerequisites

### Required
- **Node.js** >= 18.0.0
- **Arma 3** with CBA_A3 installed
- **OpenAI API Key** (or other LLM provider)

### Optional
- TypeScript knowledge for bridge server modifications
- SQF knowledge for addon customization
- C++ compiler for extension development (future)

## Installation

### 1. Clone Repository

```bash
git clone https://github.com/Darcrhorse/alive-warroom.git
cd alive-warroom
```

### 2. Set Up Bridge Server

```bash
cd bridge

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your settings
nano .env  # or your preferred editor
```

**Required environment variables**:
```bash
# Minimum configuration
OPENAI_API_KEY=sk-your-api-key-here
OPENAI_MODEL=gpt-4

# Optional (defaults provided)
SERVER_PORT=3000
GM_UPDATE_INTERVAL=30
SAFETY_DRY_RUN_MODE=false
```

### 3. Build Bridge Server

```bash
# Development mode
npm run dev

# Production mode
npm run build
npm start
```

The server should start on `http://localhost:3000`

### 4. Start the Bridge Server

Before launching Arma 3, ensure the bridge server is running:

```bash
cd bridge

# If not already built, build first
npm run build

# Start the server
node dist/index.js
```

Or use the npm script:
```bash
cd bridge && npm start
```

**Expected Console Output**:
```
[INFO] Bridge server starting...
[INFO] Loading configuration from .env
[INFO] LLM provider: openai
[INFO] Server started on port 3000
[INFO] Ready to accept connections
```

#### Required Arma 3 Mods

The following mods must be loaded in Arma 3 for bridge communication:

| Mod | Description | Notes |
|-----|-------------|-------|
| **@LLMGM** | Main LLM Game Master addon | Contains SQF functions for game state collection and code execution |
| **@ClaudeBridge** | Communication bridge extension | Handles HTTP communication between Arma 3 and the bridge server |
| **@Pythia** | SQF-Python integration | Required dependency for extension functionality |
| **@CBA_A3** | Community Base Addons | Required framework dependency |

**Launch Parameters**:
```
-mod=@LLMGM;@ClaudeBridge;@Pythia;@CBA_A3
```

#### Verification Steps

1. **Check Server Status**:
   ```bash
   curl http://localhost:3000/health
   # Expected: {"status":"ok","timestamp":...}
   ```

2. **Check API Readiness**:
   ```bash
   curl http://localhost:3000/api/status
   # Expected: {"connected":true,"llmStatus":"ready",...}
   ```

3. **Monitor Logs** (in a separate terminal):
   ```bash
   tail -f bridge/logs/combined.log
   ```

4. **In-Game Verification** (after starting Arma 3):
   ```sqf
   // Run in Debug Console
   hint str (LLMGM_bridgeConnected);
   // Should display: true
   ```

#### Common Startup Issues

**Problem**: `dist/index.js not found`
- **Cause**: Bridge server not built
- **Solution**: Run `npm run build` before starting

**Problem**: `EADDRINUSE: Port 3000 already in use`
- **Cause**: Another process using the port
- **Solution**: Either stop the conflicting process or change `SERVER_PORT` in `.env`

**Problem**: `OPENAI_API_KEY not set` or `Missing environment variables`
- **Cause**: `.env` file not configured
- **Solution**: Copy `.env.example` to `.env` and fill in required values

**Problem**: `ECONNREFUSED` when testing health endpoint
- **Cause**: Server not running or wrong port
- **Solution**: Verify server is running and check `SERVER_PORT` setting

### 5. Install Arma 3 Addon

**Option A: Development (Unpacked)**

1. Copy the `addon` folder to your Arma 3 directory:
```bash
cp -r addon "C:/Program Files (x86)/Steam/steamapps/common/Arma 3/@LLMGM/addons/llmgm"
```

2. Create mod folder structure:
```
Arma 3/
  @LLMGM/
    addons/
      llmgm/
        config.cpp
        functions/
        ...
    mod.cpp
```

3. Launch Arma 3 with: `-mod=@LLMGM;@CBA_A3`

**Option B: Production (PBO)**

1. Pack addon to PBO using Arma 3 Tools or:
```powershell
# Windows PowerShell
.\tools\pbo-pack.ps1
```

2. Place `llmgm.pbo` in `@LLMGM/addons/`

3. Launch Arma 3 with mod

### 6. Configure Extension (Future)

The C++ extension will be required for production use. For now, the system runs without it in test mode.

## Testing Installation

### 1. Test Bridge Server

```bash
# Check server status
curl http://localhost:3000/health

# Should return: {"status":"ok","timestamp":...}

# Check API status
curl http://localhost:3000/api/status

# Should return: {"connected":true,"llmStatus":"ready",...}
```

### 2. Test in Arma 3

1. Start Arma 3 with the mod loaded
2. Create a new mission in Eden Editor
3. Place a player unit
4. In mission init.sqf or Eden console:

```sqf
// Check if LLMGM is loaded
if (!isNil "LLMGM_initialized") then {
    hint "LLM Game Master loaded successfully!";
} else {
    hint "ERROR: LLM Game Master not loaded";
};

// Manual test: collect state
private _state = [] call LLMGM_fnc_collectGameState;
systemChat format ["Collected state with %1 players", count (_state get "players")];
```

5. Check RPT log for LLMGM messages:
```
[LLMGM] LLM Game Master initialized successfully
[LLMGM] Update loop started (interval: 30s)
```

### 3. Test Full Loop

1. Start bridge server in dry-run mode:
```bash
# In .env
SAFETY_DRY_RUN_MODE=true
```

2. Start Arma 3 mission
3. Monitor bridge server logs:
```bash
tail -f bridge/logs/combined.log
```

4. You should see:
   - State updates every 30 seconds
   - LLM decisions being made
   - SQF code being generated (but not executed in dry-run mode)

## Configuration

### Bridge Server Settings

Edit `bridge/.env`:

```bash
# ===== LLM Provider =====
LLM_PROVIDER=openai        # openai, claude, ollama, custom
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4         # gpt-4, gpt-3.5-turbo

# ===== Game Master Behavior =====
GM_UPDATE_INTERVAL=30      # How often to check game state (seconds)
GM_MIN_ACTION_INTERVAL=60  # Minimum time between GM actions
GM_MAX_ACTION_INTERVAL=300 # Force action if idle too long
GM_DIFFICULTY_BASE=5       # Base difficulty (1-10)
GM_ADAPTIVE_DIFFICULTY=true
GM_NARRATIVE_MODE=true

# ===== Safety =====
SAFETY_MAX_UNITS_PER_SPAWN=12
SAFETY_MIN_SPAWN_DISTANCE=200
SAFETY_LOG_ALL_EXECUTIONS=true
SAFETY_DRY_RUN_MODE=false  # Set to true for testing

# ===== Server =====
SERVER_PORT=3000
SERVER_HOST=localhost
ENABLE_WEBSOCKET=true
ENABLE_REST=true

# ===== Logging =====
LOG_LEVEL=info             # error, warn, info, debug
```

### In-Game Configuration

In mission init or via CBA settings (future):

```sqf
// Update interval
LLMGM_updateInterval = 45; // seconds

// Enable/disable
LLMGM_enabled = true;

// Event history size
LLMGM_maxHistorySize = 100;
```

## Troubleshooting

### Bridge Server Issues

**Problem**: "OpenAI API key not configured"
- **Solution**: Check `.env` file has `OPENAI_API_KEY` set
- **Solution**: Restart server after editing `.env`

**Problem**: Connection refused
- **Solution**: Check server is running on correct port
- **Solution**: Check firewall allows connections to port 3000

**Problem**: High API costs
- **Solution**: Increase `GM_UPDATE_INTERVAL` to reduce frequency
- **Solution**: Use `gpt-3.5-turbo` instead of `gpt-4`
- **Solution**: Enable `SAFETY_DRY_RUN_MODE` for testing

### Arma 3 Issues

**Problem**: "Extension not loaded" warning
- **Solution**: Extension is optional for Phase 1, system will work without it
- **Future**: Install C++ extension when available

**Problem**: No game state updates
- **Solution**: Check CBA_A3 is loaded
- **Solution**: Check bridge server is running
- **Solution**: Check RPT log for errors

**Problem**: SQF execution errors
- **Solution**: Check bridge logs for validation errors
- **Solution**: Enable dry-run mode to see generated SQF
- **Solution**: Review `fn_executeGenerated.sqf` for blocked commands

### LLM Issues

**Problem**: Poor decision quality
- **Solution**: Adjust system prompt in `prompts/system-prompt.md`
- **Solution**: Increase `GM_MIN_ACTION_INTERVAL` for more context
- **Solution**: Use `gpt-4` instead of `gpt-3.5-turbo`

**Problem**: Invalid SQF generated
- **Solution**: Check `commands-database.json` is loaded
- **Solution**: Review system prompt SQF examples
- **Solution**: Add more examples to prompt

## Development Setup

### Bridge Server Development

```bash
cd bridge

# Install dependencies
npm install

# Run in watch mode
npm run dev

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Lint
npm run lint
```

### Addon Development

1. Edit SQF files in `addon/functions/`
2. Copy to Arma 3 directory
3. Restart Arma 3 or use file patching:
```
-filePatching
```

### Adding Custom Commands

1. Edit `bridge/src/sqf/commands-database.json`
2. Add command with syntax, description, examples
3. Update system prompt if needed
4. Rebuild bridge server

## Next Steps

1. **Create a test mission**: Simple scenario with enemies to test spawning
2. **Monitor logs**: Watch bridge and Arma logs for first GM action
3. **Adjust difficulty**: Tune `GM_DIFFICULTY_BASE` for your preference
4. **Customize prompts**: Edit system prompt for different GM personalities
5. **Share feedback**: Report issues and suggestions

## Support

- GitHub Issues: [https://github.com/Darcrhorse/alive-warroom/issues](https://github.com/Darcrhorse/alive-warroom/issues)
- Arma 3 Forums: [Link to forum thread]
- Discord: [Link to Discord server]

## FAQ

**Q: Does this work in multiplayer?**
A: Yes, but bridge server should run on server machine.

**Q: Can I use local LLMs?**
A: Planned for Phase 3 (Ollama support).

**Q: How much does it cost?**
A: GPT-4 ~$0.03-0.06 per hour, GPT-3.5 ~$0.002-0.004 per hour

**Q: Is this compatible with ALiVE/ACE/other mods?**
A: Should be compatible. Conflicts unlikely but report any issues.

**Q: Can I customize the GM behavior?**
A: Yes! Edit system prompt and configuration settings.

**Q: Is the extension required?**
A: For Phase 1, no. Future phases will need it for performance.
