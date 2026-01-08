# Testing Guide - Arma 3 LLM Game Master System

Complete step-by-step guide for testing the LLM-powered Game Master system from development environment through full in-game deployment.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Testing Phase 1: Validate Components Independently](#testing-phase-1-validate-components-independently)
3. [Testing Phase 2: Bridge Server Integration](#testing-phase-2-bridge-server-integration)
4. [Testing Phase 3: C++ Extension Build and Test](#testing-phase-3-c-extension-build-and-test)
5. [Testing Phase 4: Full System Integration](#testing-phase-4-full-system-integration)
6. [Testing Phase 5: In-Game Validation](#testing-phase-5-in-game-validation)
7. [Configuration Options](#configuration-options)
8. [Troubleshooting](#troubleshooting)
9. [Performance Benchmarks](#performance-benchmarks)

---

## Prerequisites

### Software Requirements

**All Platforms:**
- Git (for cloning repository)
- Node.js 18+ and npm
- Python 3.8+ (for SQF testing)
- OpenAI API key (get from https://platform.openai.com/api-keys)

**Windows (for extension build):**
- Visual Studio 2019+ with C++ Desktop Development workload
- CMake 3.15+ (can be installed via Visual Studio installer)
- PowerShell 5.1+ (included in Windows 10/11)

**Linux (for extension build):**
- GCC 9+ or Clang 10+
- CMake 3.15+
- Build essentials: `sudo apt-get install build-essential cmake`

**For In-Game Testing:**
- Arma 3 (Steam version recommended)
- CBA_A3 mod (Steam Workshop or https://github.com/CBATeam/CBA_A3)

### Initial Setup

```bash
# Clone repository
git clone https://github.com/Darcrhorse/alive-warroom.git
cd alive-warroom

# Checkout the branch
git checkout copilot/create-ai-game-master-system
```

---

## Testing Phase 1: Validate Components Independently

This phase tests each component without requiring Arma 3 or the full system integration.

### Step 1.1: Validate SQF Code Generation

**Purpose**: Ensure all generated SQF code is syntactically correct.

```bash
# Install Python dependencies
pip3 install sqflint

# Run comprehensive SQF validation tests
cd tools
python3 comprehensive_sqf_tests.py
```

**Expected Output:**
```
Testing SQF Validation...
========================================
Category: Unit Spawning
✓ Test 1/17 passed: basic_infantry_spawn
✓ Test 2/17 passed: squad_with_roles
...
Overall: 103/104 tests passing (99.0%)
Results saved to: /tmp/comprehensive_sqf_test_results.json
```

**Success Criteria**: ≥99% tests passing (103/104+).

### Step 1.2: Validate E2E LLM Integration Scenarios

**Purpose**: Test game state → LLM decision → SQF generation pipeline.

```bash
# Run end-to-end LLM integration tests
python3 e2e_llm_tests.py
```

**Expected Output:**
```
Testing E2E LLM Integration...
========================================
Scenario Type: Enemy Approach
✓ Scenario 1/25 passed: Players near objective (idle)
✓ Scenario 2/25 passed: Players engaged in combat
...
Overall: 141/141 scenarios passing (100.0%)
Results saved to: /tmp/e2e_llm_test_results.json
```

**Success Criteria**: 100% scenarios passing (141/141).

### Step 1.3: Validate Function Definitions

**Purpose**: Ensure all SQF functions match official BI Wiki specifications.

```bash
# Run function validation
python3 validate_functions.py
```

**Expected Output:**
```
Validating against BI Wiki specifications...
✓ createGroup: Correct signature
✓ createUnit: All 5 parameters validated
✓ BIS_fnc_spawnGroup: 11 parameters validated
...
Overall: 100% compliance (15/15 functions)
```

**Success Criteria**: 100% function compliance.

---

## Testing Phase 2: Bridge Server Integration

This phase tests the Node.js bridge server that mediates between Arma 3 and LLM providers.

### Step 2.1: Install Bridge Dependencies

```bash
cd bridge
npm install
```

**Expected Output:**
```
added 245 packages in 15s
```

### Step 2.2: Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your settings
nano .env  # or use any text editor
```

**Required Configuration:**
```env
# LLM Provider Settings
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-your-key-here
OPENAI_MODEL=gpt-4
OPENAI_MAX_TOKENS=2000
OPENAI_TEMPERATURE=0.7

# Server Settings
PORT=3000
HOST=localhost
ENABLE_WEBSOCKET=true

# Game Master Behavior
GM_UPDATE_INTERVAL=30
GM_MIN_ACTION_INTERVAL=120
GM_MAX_ACTION_INTERVAL=600
GM_DIFFICULTY_BASE=5
GM_ADAPTIVE_DIFFICULTY=true

# Safety Settings
SAFETY_MAX_UNITS_PER_SPAWN=12
SAFETY_MIN_SPAWN_DISTANCE=200
SAFETY_LOG_ALL_EXECUTIONS=true
SAFETY_DRY_RUN_MODE=false
```

### Step 2.3: Build Bridge Server

```bash
npm run build
```

**Expected Output:**
```
> bridge@1.0.0 build
> tsc

Successfully compiled TypeScript
```

### Step 2.4: Run Bridge Server Tests

```bash
npm test
```

**Expected Output:**
```
 PASS  tests/sqf-validator.test.ts
  SQF Validator
    ✓ should pass valid infantry spawn (5 ms)
    ✓ should pass valid vehicle spawn (2 ms)
    ✓ should reject endMission command (3 ms)
    ✓ should reject serverCommand (2 ms)
    ...
Tests: 12 passed, 12 total
```

**Success Criteria**: All tests passing.

### Step 2.5: Start Bridge Server

```bash
npm start
```

**Expected Output:**
```
[2026-01-08 10:00:00] [INFO] Bridge Server starting...
[2026-01-08 10:00:00] [INFO] OpenAI client initialized (model: gpt-4)
[2026-01-08 10:00:00] [INFO] HTTP server listening on http://localhost:3000
[2026-01-08 10:00:00] [INFO] WebSocket server ready
[2026-01-08 10:00:00] [INFO] Bridge Server ready for connections
```

**Keep this terminal open** - the server needs to run for subsequent tests.

### Step 2.6: Test Bridge API Endpoints

Open a **new terminal** and test the REST API:

```bash
# Test status endpoint
curl http://localhost:3000/api/status

# Expected response:
# {"connected":true,"llmStatus":"ready","queueLength":0}

# Test state submission (mock game state)
curl -X POST http://localhost:3000/api/state \
  -H "Content-Type: application/json" \
  -d '{
    "timestamp": 1234567890,
    "players": [{"name":"TestPlayer","position":[15000,20000,0],"health":1.0}],
    "friendlyUnits": [],
    "enemyUnits": [],
    "objectives": [],
    "recentEvents": [],
    "environment": {"timeOfDay":12,"weather":0,"fog":0},
    "missionContext": {"missionName":"Test","elapsedTime":300}
  }'

# Expected response:
# {"received":true,"queuePosition":1}

# Wait 2-3 seconds for LLM to process, then check for action
curl http://localhost:3000/api/action

# Expected response (may vary):
# {"hasAction":true,"sqf":"private _spawnPos = ...","metadata":{...}}
```

**Success Criteria**: 
- Status endpoint returns `connected: true`
- State submission accepted
- Action retrieved with valid SQF code

---

## Testing Phase 3: C++ Extension Build and Test

This phase builds the native extension that enables Arma 3 to communicate with the bridge server.

### Step 3.1: Build Extension (Windows)

```powershell
cd extension
.\build-windows.ps1
```

**Expected Output:**
```
=== Arma 3 LLM Game Master Extension - Windows Build ===

Checking prerequisites...
✓ CMake found: 3.28.0
✓ Visual Studio found

Creating build directory...
Running CMake configuration...
-- Fetching nlohmann/json v3.11.3...
-- Fetching cpp-httplib v0.15.3...
-- Configuring done
-- Generating done

Building extension (Release)...
[ 20%] Building CXX object CMakeFiles/llmgm.dir/src/main.cpp.obj
[ 40%] Building CXX object CMakeFiles/llmgm.dir/src/bridge_client.cpp.obj
[ 60%] Building CXX object CMakeFiles/llmgm.dir/src/json_handler.cpp.obj
[ 80%] Linking CXX shared library llmgm_x64.dll
[100%] Built target llmgm

Build successful!
Extension: build\Release\llmgm_x64.dll
Size: ~800 KB
```

**Success Criteria**: `llmgm_x64.dll` created in `build\Release\`

### Step 3.1 (Alternative): Build Extension (Linux)

```bash
cd extension
chmod +x build-linux.sh
./build-linux.sh
```

**Expected Output:**
```
=== Arma 3 LLM Game Master Extension - Linux Build ===

Checking prerequisites...
✓ CMake found: 3.22.0
✓ GCC found: 11.3.0

Creating build directory...
Running CMake configuration...
-- Fetching nlohmann/json v3.11.3...
-- Fetching cpp-httplib v0.15.3...
-- Build files have been written to: build

Building extension (Release)...
[ 20%] Building CXX object CMakeFiles/llmgm.dir/src/main.cpp.o
[ 40%] Building CXX object CMakeFiles/llmgm.dir/src/bridge_client.cpp.o
[ 60%] Building CXX object CMakeFiles/llmgm.dir/src/json_handler.cpp.o
[ 80%] Linking CXX shared library llmgm_x64.so
[100%] Built target llmgm

Build successful!
Extension: build/llmgm_x64.so
Size: ~1.2 MB
```

**Success Criteria**: `llmgm_x64.so` created in `build/`

### Step 3.2: Verify Extension Exports (Windows)

```powershell
# Use dumpbin to verify exports
"C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Tools\MSVC\*\bin\Hostx64\x64\dumpbin.exe" /EXPORTS build\Release\llmgm_x64.dll | Select-String "RVExtension"
```

**Expected Output:**
```
    1    0 00001000 RVExtension
    2    1 00001200 RVExtensionArgs
    3    2 00001100 RVExtensionVersion
```

**Success Criteria**: All 3 functions exported.

### Step 3.2 (Alternative): Verify Extension Exports (Linux)

```bash
nm -D build/llmgm_x64.so | grep RVExtension
```

**Expected Output:**
```
00000000000012a0 T RVExtension
0000000000001450 T RVExtensionArgs
00000000000011f0 T RVExtensionVersion
```

**Success Criteria**: All 3 functions present with 'T' (text/code).

---

## Testing Phase 4: Full System Integration

This phase tests the complete pipeline: Arma 3 → Extension → Bridge → LLM → Back to Arma 3.

### Step 4.1: Prepare Addon Files

```bash
# Create a test directory structure
mkdir -p /tmp/llmgm_test
cd /home/runner/work/alive-warroom/alive-warroom

# Copy addon files (no PBO packing yet, for testing)
cp -r addon/* /tmp/llmgm_test/
cp mod.cpp /tmp/llmgm_test/
```

### Step 4.2: Install Extension to Arma 3

**Windows:**
```powershell
# Find Arma 3 directory (typical location)
$arma3Dir = "C:\Program Files (x86)\Steam\steamapps\common\Arma 3"

# Copy extension DLL
Copy-Item extension\build\Release\llmgm_x64.dll -Destination $arma3Dir
```

**Linux (Dedicated Server):**
```bash
# Adjust path to your server installation
ARMA3_SERVER="/opt/arma3server"
cp extension/build/llmgm_x64.so $ARMA3_SERVER/
```

### Step 4.3: Configure SQF to Use Extension

The addon is already configured to use the extension. Verify the configuration:

```bash
cat addon/functions/fn_sendToBridge.sqf | grep callExtension
```

**Expected Output:**
```sqf
private _result = "llmgm" callExtension ["send", [_jsonState]];
```

### Step 4.4: Test Extension from Command Line (Optional)

Before launching Arma 3, you can create a simple test program:

**Windows (test_extension.cpp):**
```cpp
#include <windows.h>
#include <iostream>

typedef void (*RVExtensionVersion_t)(char*, int);
typedef int (*RVExtensionArgs_t)(char*, int, const char*, const char**, int);

int main() {
    HMODULE dll = LoadLibrary("llmgm_x64.dll");
    if (!dll) {
        std::cerr << "Failed to load DLL\n";
        return 1;
    }
    
    auto version = (RVExtensionVersion_t)GetProcAddress(dll, "RVExtensionVersion");
    char buffer[32];
    version(buffer, 32);
    std::cout << "Extension Version: " << buffer << "\n";
    
    auto args = (RVExtensionArgs_t)GetProcAddress(dll, "RVExtensionArgs");
    char output[10240];
    const char* argv[] = {""};
    int result = args(output, 10240, "status", argv, 1);
    std::cout << "Status: " << output << "\n";
    
    FreeLibrary(dll);
    return 0;
}
```

Compile and run:
```powershell
cl test_extension.cpp
.\test_extension.exe
```

**Expected Output:**
```
Extension Version: 0.1.0
Status: {"connected":true,"serverUrl":"http://localhost:3000"}
```

---

## Testing Phase 5: In-Game Validation

This phase tests the complete system inside Arma 3.

### Step 5.1: Prepare Test Mission

**Create mission folder:**
```
Documents\Arma 3 - Other Profiles\<YourProfile>\missions\test_llmgm.Altis\
```

**Create `mission.sqm`:**
```sqf
version=54;
class EditorData
{
    moveGridStep=1;
    angleGridStep=0.2617994;
    scaleGridStep=1;
};
class Mission
{
    class Intel
    {
        briefingName="LLM Game Master Test";
        startWeather=0.3;
        forecastWeather=0.3;
    };
    class Entities
    {
        items=1;
        class Item0
        {
            dataType="Group";
            side="West";
            class Entities
            {
                items=1;
                class Item0
                {
                    dataType="Object";
                    class PositionInfo
                    {
                        position[]={14500,0,20000};
                    };
                    side="West";
                    flags=7;
                    class Attributes
                    {
                        isPlayer=1;
                    };
                    id=0;
                    type="B_Soldier_F";
                };
            };
            class Attributes{};
            id=1;
        };
    };
};
```

**Create `init.sqf`:**
```sqf
// Initialize LLM Game Master
[] call LLMGM_fnc_initGameMaster;

// Log to confirm initialization
systemChat "LLM Game Master initializing...";

// Wait a few seconds and check status
[{
    private _status = "llmgm" callExtension ["status", [""]];
    systemChat format["Extension Status: %1", _status];
}, [], 5] call CBA_fnc_waitAndExecute;
```

**Create `description.ext`:**
```cpp
class Header
{
    gameType = Coop;
    minPlayers = 1;
    maxPlayers = 10;
};

enableDebugConsole = 1;
```

### Step 5.2: Launch Arma 3 with Mod

**Windows (Steam):**
1. Open Steam
2. Right-click Arma 3 → Properties
3. Set Launch Options:
   ```
   -mod=@CBA_A3;X:\path\to\alive-warroom\addon
   ```
   Replace path with your actual repository location

**Alternative: Use Arma 3 Launcher**
1. Launch Arma 3 Launcher
2. Go to Mods tab
3. Add local mod: Browse to `alive-warroom\addon`
4. Enable CBA_A3 (from Steam Workshop)
5. Launch game

### Step 5.3: Load Test Mission

1. In Arma 3 main menu, click **PLAY**
2. Select **EDITOR**
3. Select **ALTIS** map
4. Click **LOAD** and find `test_llmgm.Altis`
5. Click **PREVIEW** to start mission

### Step 5.4: Verify Extension Loading

Once in-game, open **Debug Console** (ESC → Debug Console):

```sqf
// Test 1: Check extension version
systemChat ("llmgm" callExtension ["version", [""]]);
// Expected: "0.1.0"

// Test 2: Check connection status
private _status = "llmgm" callExtension ["status", [""]];
systemChat _status;
// Expected: {"connected":true,"serverUrl":"http://localhost:3000"}

// Test 3: Manually trigger state collection
[] call LLMGM_fnc_collectGameState;
// Check bridge server logs for received state

// Test 4: Check if GM loop is running
systemChat format["GM Active: %1", missionNamespace getVariable ["LLMGM_gmActive", false]];
// Expected: "GM Active: true"
```

### Step 5.5: Monitor Bridge Server

In your bridge server terminal, you should see:

```
[2026-01-08 10:15:32] [INFO] Received game state from Arma 3
[2026-01-08 10:15:32] [INFO] Players: 1, Enemies: 0, Objectives: 0
[2026-01-08 10:15:33] [INFO] Sending state to LLM for analysis...
[2026-01-08 10:15:35] [INFO] LLM decision: spawn (reasoning: "Players have been idle...")
[2026-01-08 10:15:35] [INFO] Generated SQF validated successfully
[2026-01-08 10:15:35] [INFO] Action queued for retrieval
```

### Step 5.6: Watch for LLM Actions

After 30-120 seconds, you should see enemy units spawning near your position. Check debug console:

```sqf
// See what the GM decided to spawn
{
    systemChat format["Enemy: %1 at %2", typeOf _x, getPosATL _x];
} forEach allUnits select {side _x == EAST};
```

### Step 5.7: Test Terrain Awareness

Move your player to different terrain types and verify spawns make sense:

1. **Open field**: Enemies should spawn with concealment (forests, buildings)
2. **Forest area**: Enemies may spawn closer in concealed areas
3. **Urban area**: Enemies spawn in buildings or on roads
4. **Near water**: Enemies spawn on land (not in water)
5. **Hills**: Enemies spawn on accessible slopes (not cliffs)

**Manual terrain check:**
```sqf
// In debug console
private _terrain = [getPosATL player, 500] call LLMGM_fnc_collectTerrainContext;
systemChat str (_terrain get "validInfantrySpawns" select 0);
// Should show pre-validated spawn position
```

---

## Configuration Options

### Bridge Server Configuration (`.env`)

```env
# LLM Provider Settings
LLM_PROVIDER=openai              # openai, claude (future), ollama (future)
OPENAI_API_KEY=sk-xxx            # Your OpenAI API key
OPENAI_MODEL=gpt-4               # gpt-4, gpt-3.5-turbo
OPENAI_MAX_TOKENS=2000           # Max response tokens
OPENAI_TEMPERATURE=0.7           # Creativity (0.0-1.0)

# Server Settings
PORT=3000                        # Bridge server port
HOST=localhost                   # Bridge server host
ENABLE_WEBSOCKET=true            # Enable WebSocket (lower latency)

# Game Master Behavior
GM_UPDATE_INTERVAL=30            # How often to check state (seconds)
GM_MIN_ACTION_INTERVAL=120       # Min time between GM actions (seconds)
GM_MAX_ACTION_INTERVAL=600       # Force action if idle too long (seconds)
GM_DIFFICULTY_BASE=5             # Base difficulty (1-10 scale)
GM_ADAPTIVE_DIFFICULTY=true      # Adjust based on player performance
GM_NARRATIVE_MODE=true           # Enable story/radio messages
GM_RESPECT_MISSION_DESIGN=true   # Don't override scripted events

# Safety Settings
SAFETY_MAX_UNITS_PER_SPAWN=12    # Limit spawned units
SAFETY_MIN_SPAWN_DISTANCE=200    # Min distance from players (infantry)
SAFETY_LOG_ALL_EXECUTIONS=true   # Log every SQF execution
SAFETY_DRY_RUN_MODE=false        # Don't execute, just log (testing)

# Debug Settings
LOG_LEVEL=info                   # error, warn, info, debug
LOG_TO_FILE=true                 # Save logs to file
LOG_FILE_PATH=./logs/bridge.log  # Log file location
```

### Extension Configuration (from SQF)

```sqf
// Update bridge server URL (if not localhost)
"llmgm" callExtension ["config", ['{"serverUrl":"http://192.168.1.100:3000"}']];

// Verify configuration
systemChat ("llmgm" callExtension ["status", [""]]);
```

### In-Game Configuration (CBA Settings)

Future enhancement: Configure via CBA settings menu.

---

## Troubleshooting

### Issue: Bridge server won't start

**Symptoms:**
```
Error: Cannot find module 'express'
```

**Solution:**
```bash
cd bridge
rm -rf node_modules package-lock.json
npm install
npm start
```

---

### Issue: Extension not loading in Arma 3

**Symptoms:**
- Error: "Extension llmgm not found"
- Debug console shows: `""`

**Solution:**

1. **Check extension location:**
   - Windows: `C:\Program Files (x86)\Steam\steamapps\common\Arma 3\llmgm_x64.dll`
   - Linux: `/opt/arma3server/llmgm_x64.so`

2. **Check RPT log:**
   - Windows: `%LOCALAPPDATA%\Arma 3\Arma3_x64_*.rpt`
   - Linux: Server console output
   
   Look for:
   ```
   CallExtension 'llmgm' could not be found
   ```

3. **Verify DLL dependencies (Windows):**
   ```powershell
   # Use Dependency Walker or run:
   dumpbin /dependents llmgm_x64.dll
   ```
   Should only show system DLLs (KERNEL32.dll, etc.)

4. **Permissions (Linux):**
   ```bash
   chmod +x llmgm_x64.so
   ```

---

### Issue: No LLM responses

**Symptoms:**
- Bridge server receives state
- No actions generated
- LLM decision shows "wait"

**Possible Causes:**

1. **Invalid API key:**
   ```
   [ERROR] OpenAI API error: Incorrect API key
   ```
   **Solution**: Check `.env` file for correct `OPENAI_API_KEY`

2. **Rate limiting:**
   ```
   [ERROR] OpenAI rate limit exceeded
   ```
   **Solution**: Wait or upgrade OpenAI plan

3. **LLM decides to wait:**
   ```
   [INFO] LLM decision: wait (reasoning: "No action needed yet")
   ```
   **Solution**: Normal behavior. Wait longer or adjust `GM_MAX_ACTION_INTERVAL`

---

### Issue: Invalid SQF generated

**Symptoms:**
- Actions generated but rejected by validator
- Error: "Forbidden command detected"

**Solution:**

1. **Check validator logs:**
   ```
   [WARN] SQF validation failed: Forbidden command 'endMission' detected
   ```

2. **Review LLM prompt:**
   - Ensure `prompts/system-prompt.md` is being used
   - LLM should never generate forbidden commands

3. **Report to developer:**
   - Save the generated SQF
   - File an issue with the problematic code

---

### Issue: Units spawning in invalid locations

**Symptoms:**
- Tanks on roofs
- Infantry in water
- Vehicles in forests

**Solution:**

1. **Verify terrain awareness is enabled:**
   ```sqf
   // In debug console
   private _terrain = [getPosATL player, 500] call LLMGM_fnc_collectTerrainContext;
   systemChat format["Spawn zones: %1", count (_terrain get "validInfantrySpawns")];
   ```
   Should show 8 spawn zones

2. **Check LLM is using pre-validated zones:**
   - Bridge server logs should show terrain data in LLM prompt
   - LLM should reference spawn zone positions from terrain data

3. **Temporarily enable dry-run mode:**
   ```env
   SAFETY_DRY_RUN_MODE=true
   ```
   This logs SQF without executing. Review logs for issues.

---

### Issue: Performance problems / FPS drops

**Symptoms:**
- Game stutters when GM takes action
- High CPU usage

**Solutions:**

1. **Reduce spawn frequency:**
   ```env
   GM_UPDATE_INTERVAL=60
   GM_MIN_ACTION_INTERVAL=300
   ```

2. **Limit unit counts:**
   ```env
   SAFETY_MAX_UNITS_PER_SPAWN=8
   ```

3. **Disable adaptive difficulty:**
   ```env
   GM_ADAPTIVE_DIFFICULTY=false
   ```

4. **Check extension performance:**
   ```sqf
   // Measure callExtension performance
   private _start = diag_tickTime;
   "llmgm" callExtension ["status", [""]];
   private _elapsed = (diag_tickTime - _start) * 1000;
   systemChat format["Extension latency: %1ms", _elapsed];
   // Should be <10ms
   ```

---

## Performance Benchmarks

### Expected Performance Metrics

| Component | Metric | Expected Value |
|-----------|--------|----------------|
| Extension callExtension | Latency | <10ms |
| Bridge HTTP request | Latency | 30-50ms (localhost) |
| LLM response time | Duration | 2-5 seconds (GPT-4) |
| SQF validation | Duration | <1ms per check |
| Full GM loop | Duration | 30-120 seconds |
| FPS impact | Drop | <5% (0-2 FPS) |
| Memory usage (extension) | RAM | ~2-5 MB |
| Memory usage (bridge) | RAM | ~50-100 MB |

### Benchmark Test

Run this in debug console to measure performance:

```sqf
// Benchmark extension performance
private _iterations = 100;
private _start = diag_tickTime;

for "_i" from 1 to _iterations do {
    "llmgm" callExtension ["status", [""]];
};

private _elapsed = diag_tickTime - _start;
private _avgMs = (_elapsed / _iterations) * 1000;

systemChat format["Average callExtension time: %1ms (%2 iterations)", _avgMs, _iterations];

// Expected: <10ms average
```

---

## Success Criteria Summary

✅ **Phase 1 Complete**: All validation tests passing (99%+)
✅ **Phase 2 Complete**: Bridge server running and API responding
✅ **Phase 3 Complete**: Extension built with proper exports
✅ **Phase 4 Complete**: Bridge receiving game state from extension
✅ **Phase 5 Complete**: In-game LLM spawning units with terrain awareness

**System is production-ready when all phases pass.**

---

## Next Steps After Testing

1. **Create PBO**: Package addon for distribution
2. **Write mission**: Create example missions showcasing system
3. **Community testing**: Share with beta testers
4. **Performance tuning**: Optimize based on real-world usage
5. **BattleEye whitelist**: Apply for multiplayer approval (if needed)

---

## Support

If you encounter issues not covered in this guide:

1. Check `docs/SETUP.md` for additional configuration details
2. Review `extension/BUILD_GUIDE.md` for build-specific issues
3. Check Arma 3 RPT logs for in-game errors
4. Review bridge server logs for API issues
5. File an issue on GitHub with:
   - Error messages
   - RPT log excerpts
   - Bridge server logs
   - Steps to reproduce

---

**Last Updated**: 2026-01-08
**Version**: 1.0.0
**Status**: Production-Ready Testing Guide
