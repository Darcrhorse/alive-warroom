# Game State Collection and Transmission Test Guide

**Subtask:** subtask-4-2
**Purpose:** Verify game state collection and transmission from Arma 3 to Bridge Server

## Overview

This test verifies the complete data flow:
1. **Arma 3 LLMGM** collects game state every 30 seconds
2. **C++ Extension** serializes and sends HTTP POST to bridge
3. **Bridge Server** receives POST at `/api/state` endpoint
4. **No JSON serialization errors** occur during the process

---

## Prerequisites

### 1. Bridge Server Setup

```bash
# Navigate to bridge directory
cd ./bridge

# Install dependencies (if not already done)
npm install

# Verify Anthropic SDK version (should be 0.71.2+)
grep "@anthropic-ai/sdk" package.json

# Create .env file if it doesn't exist
# (Optional - not required for this test, but good to have)
echo "ANTHROPIC_API_KEY=your_key_here" > .env
echo "PORT=3000" >> .env
echo "LOG_LEVEL=debug" >> .env

# Start the bridge server
npm start
```

**Expected Bridge Output:**
```
[INFO] Bridge server started { port: 3000, host: 'localhost', llm: 'enabled/disabled' }
[INFO] OpenAI client initialized { model: 'gpt-4' } (if API key configured)
```

### 2. Arma 3 Mission Setup

1. Launch Arma 3 with the LLMGM mod:
   - Use Arma 3 Launcher
   - Enable mods: `@CBA_A3`, `@LLMGM`
   - Or command line: `arma3.exe -mod=@CBA_A3;@LLMGM`

2. Load any mission (even the Virtual Reality environment works)

3. Verify extension is loaded (check RPT logs)

### 3. Extension Configuration

The extension needs to know the bridge server URL. Check:
- Default: `http://localhost:3000`
- Configuration location: (check extension documentation)

---

## Test Procedure

### Step 1: Start Bridge Server

```bash
cd ./bridge
npm start
```

**Check:**
- ✅ Server starts on port 3000 (or configured port)
- ✅ No startup errors
- ✅ `/api/state` endpoint is registered

### Step 2: Launch Arma 3 with LLMGM

1. Start Arma 3 with mods enabled
2. Load a mission (any mission)
3. Wait for mission to fully initialize

**Check RPT Logs** (`%LOCALAPPDATA%\Arma 3\arma3_x64_*.rpt`):
```
[LLMGM] XEH Pre-init starting...
[LLMGM] XEH Pre-init complete
[LLMGM] XEH Post-init starting...
[LLMGM] Initializing LLM Game Master system...
[LLMGM] Extension loaded successfully
[LLMGM] Update loop started (interval: 30s)
[LLMGM] LLM Game Master initialized successfully
[LLMGM] XEH Post-init complete
```

### Step 3: Wait 30 Seconds

The system collects and sends game state every 30 seconds.

**Timeline:**
- 0s: Mission loads, XEH initializes
- 5s: Main update loop starts (5 second initial delay)
- 35s: First game state collection and transmission

### Step 4: Verify Game State Transmission

#### A. Check Arma 3 RPT Logs

**Expected (Success):**
```
[LLMGM] Game state sent successfully
```

**Troubleshooting (Failure):**
```
[LLMGM] Error sending game state: <error message>
```

#### B. Check Bridge Server Console

**Expected Output:**
```json
[INFO] Game state received {
  players: 1,
  enemies: 0,
  timestamp: 1234567890
}
```

**What to Look For:**
- ✅ POST request received at `/api/state`
- ✅ Game state contains valid data:
  - `timestamp` field present
  - `players` array present
  - `friendlyUnits` array present
  - `enemyUnits` array present
  - `objectives` array present
  - `recentEvents` array present
  - `environment` object present
  - `missionContext` object present
- ✅ No JSON parse errors
- ✅ Response: `{ received: true, queuePosition: <number> }`

---

## Critical Validations

### 1. No Null Serialization Errors

**What We Fixed:**
Changed `objNull` to `"none"` string in `fn_collectGameState.sqf` (lines 28, 53, 87)

**Check:**
- Vehicle field shows `"none"` when player not in vehicle
- No `null` values in JSON
- No serialization errors in logs

### 2. JSON Structure Validation

**Expected Structure:**
```json
{
  "timestamp": 123456789,
  "players": [
    {
      "uid": "12345678",
      "name": "PlayerName",
      "position": { "x": 1234.5, "y": 5678.9, "z": 10.2 },
      "health": 1.0,
      "vehicle": "none",
      "weapons": ["weapon1", "weapon2"],
      "currentTask": null
    }
  ],
  "friendlyUnits": [...],
  "enemyUnits": [...],
  "objectives": [...],
  "recentEvents": [...],
  "environment": {
    "timeOfDay": 12.5,
    "weather": 0.0,
    "fog": 0.0
  },
  "missionContext": {
    "missionName": "VR Training",
    "briefing": "",
    "elapsedTime": 35.123
  }
}
```

### 3. Endpoint Correctness

**Verify:**
- ✅ Extension POSTs to `/api/state` (not `/api/game_state`)
- ✅ Bridge server has `/api/state` endpoint
- ✅ Content-Type header: `application/json`
- ✅ HTTP status: 200 OK

---

## Debugging Tips

### Bridge Server Not Receiving Data

1. **Check Bridge Server is Running:**
   ```bash
   curl http://localhost:3000/health
   # Expected: {"status":"ok","timestamp":123456789}
   ```

2. **Check Extension Connection:**
   - Look for "Extension loaded successfully" in RPT logs
   - If "Extension not loaded", check extension DLL placement

3. **Check Network/Firewall:**
   - Ensure port 3000 is not blocked
   - Try changing port in bridge configuration

### JSON Parse Errors

1. **Check for Null Values:**
   ```bash
   # Search RPT logs for serialization errors
   grep -i "json\|parse\|null" arma3_x64_*.rpt
   ```

2. **Enable Debug Logging:**
   - Bridge: Set `LOG_LEVEL=debug` in `.env`
   - Arma 3: Enable verbose logging

3. **Inspect Raw Data:**
   - Add logging to `fn_sendToBridge.sqf` to see JSON string
   - Add logging to bridge server to see raw POST body

### Extension Errors

1. **Check DLL Location:**
   - Windows: `@LLMGM\llmgm.dll` or `@LLMGM\llmgm_x64.dll`
   - Must be in correct Arma 3 directory structure

2. **Check Extension Signature:**
   - Extension must be properly signed for Arma 3 to load it
   - Check Arma 3 launch parameters for signature verification settings

---

## Test Completion Checklist

- [ ] Bridge server starts without errors
- [ ] Bridge server logs show `/api/state` endpoint registered
- [ ] Arma 3 launches with LLMGM mod enabled
- [ ] XEH Pre-init and Post-init execute (check RPT logs)
- [ ] Extension loads successfully (check RPT logs)
- [ ] Update loop starts with 30-second interval
- [ ] After 35 seconds, first game state is sent
- [ ] RPT logs show "Game state sent successfully"
- [ ] Bridge console shows "Game state received"
- [ ] No JSON parse errors in bridge logs
- [ ] No null serialization errors
- [ ] Response contains `{ received: true, queuePosition: 0 }`
- [ ] Game state contains all required fields
- [ ] Vehicle field shows "none" (not null) when applicable
- [ ] Timestamp is valid and recent
- [ ] Player data is accurate

---

## Expected Test Results

### ✅ Success Criteria

1. **Arma 3 RPT Log:**
   ```
   [LLMGM] Game state sent successfully
   ```

2. **Bridge Server Console:**
   ```
   [INFO] Game state received { players: 1, enemies: 0, timestamp: 1234567890 }
   ```

3. **No Errors:**
   - No JSON parse errors
   - No null serialization errors
   - No HTTP errors (400, 500)

### ❌ Failure Indicators

1. **Null Serialization Error:**
   ```
   Error: Cannot serialize objNull
   ```
   → **Fix:** Verify lines 28, 53, 87 in `fn_collectGameState.sqf` use `"none"`

2. **Endpoint Not Found (404):**
   ```
   Error: POST /api/game_state 404 Not Found
   ```
   → **Fix:** Verify extension uses `/api/state` endpoint

3. **Extension Not Loaded:**
   ```
   [LLMGM] Warning: Extension not loaded
   ```
   → **Fix:** Check DLL location and Arma 3 configuration

4. **Connection Refused:**
   ```
   Error sending game state: Connection refused
   ```
   → **Fix:** Start bridge server first

---

## Test Log Template

Copy this template to document your test results:

```
=== GAME STATE TRANSMISSION TEST ===
Date: YYYY-MM-DD
Tester: [Your Name]
Spec: 013-multiple-fixes-required-for-working-llmgm-bridge-c
Subtask: subtask-4-2

ENVIRONMENT:
- Bridge Server Version: [check package.json]
- Arma 3 Version: [check launcher]
- LLMGM Mod Version: [check config.cpp]
- CBA Version: [check in-game]

SETUP:
[ ] Bridge server started on port: _____
[ ] Arma 3 launched with mods: @CBA_A3, @LLMGM
[ ] Mission loaded: _____
[ ] Extension status: _____

TEST EXECUTION:
Time: _____
[ ] XEH Pre-init logged
[ ] XEH Post-init logged
[ ] Extension loaded successfully
[ ] Update loop started (30s interval)
[ ] First transmission at 35s: [ PASS / FAIL ]

BRIDGE SERVER LOGS:
- POST /api/state received: [ YES / NO ]
- Players count: _____
- Enemies count: _____
- Timestamp: _____
- JSON parse errors: [ YES / NO ]
- Response code: _____

ARMA 3 RPT LOGS:
- "Game state sent successfully": [ YES / NO ]
- Errors: _____

VALIDATION:
[ ] No null values in game state
[ ] Vehicle field uses "none" string
[ ] All required fields present
[ ] Correct endpoint (/api/state)
[ ] No JSON errors

RESULT: [ PASS / FAIL ]

NOTES:
_____________________
_____________________
_____________________
```

---

## Next Steps After Test

1. **If Test Passes:**
   - Mark subtask-4-2 as completed
   - Commit changes with message: `auto-claude: subtask-4-2 - Test game state collection and transmission`
   - Update implementation_plan.json status to "completed"
   - Proceed to subtask-4-3 (Test Claude API integration)

2. **If Test Fails:**
   - Document failure in build-progress.txt
   - Identify root cause using debugging tips
   - Fix issues in relevant files
   - Re-run test until passing
   - Then commit and proceed

---

## Related Files

- **SQF:** `./addon/functions/fn_collectGameState.sqf`
- **SQF:** `./addon/functions/fn_sendToBridge.sqf`
- **SQF:** `./addon/functions/fn_initGameMaster.sqf`
- **C++:** `./extension/src/bridge_client.cpp`
- **TypeScript:** `./bridge/src/server.ts`
- **Config:** `./addon/config.cpp`
- **XEH:** `./addon/XEH_preInit.sqf`, `./addon/XEH_postInit.sqf`

---

**Manual Testing Required:** This test requires launching Arma 3 and cannot be fully automated.
**Estimated Time:** 5-10 minutes
**Risk Level:** Low (non-destructive test)
