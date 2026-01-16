# Action Execution Test Guide (Arma 3)

**Subtask:** subtask-4-4
**Purpose:** Verify that Arma 3 receives and executes SQF commands from the bridge server

## Overview

This test verifies the complete action execution pipeline:
1. **Bridge Server** generates SQF commands via Claude API (or queues test actions)
2. **Arma 3 Extension** polls `/api/action` endpoint to retrieve pending actions
3. **SQF Receiver** (`fn_receiveFromBridge.sqf`) parses the action response
4. **SQF Executor** (`fn_executeGenerated.sqf`) validates and executes the SQF code
5. **In-Game Verification** confirms visible effects (spawns, hints, waypoints, etc.)

---

## Prerequisites

### 1. Completed Previous Subtasks

Ensure the following are working:
- ✅ **Subtask 4-1:** LLMGM mod initializes (XEH logs appear in RPT)
- ✅ **Subtask 4-2:** Game state is collected and sent to bridge every 30s
- ✅ **Subtask 4-3:** Bridge can communicate with Claude API (optional for this test)

### 2. Bridge Server Running

```bash
cd ./bridge
npm install
npm start
```

**Expected Output:**
```
[INFO] Bridge server started { port: 3000, host: 'localhost' }
[INFO] Registered GET /api/action
```

### 3. Arma 3 Running with LLMGM

- Launch Arma 3 with mods: `@CBA_A3`, `@LLMGM`
- Load any mission (Virtual Reality recommended for testing)
- Verify in RPT logs:
  ```
  [LLMGM] XEH Pre-init starting...
  [LLMGM] XEH Post-init starting...
  [LLMGM] Initializing LLM Game Master system...
  [LLMGM] Update loop started (interval: 30s)
  ```

---

## Test Methods

### Method 1: Manual Action Injection (Recommended for Initial Testing)

This method allows you to manually queue test actions without requiring Claude API.

#### Step 1: Create Test Action Script

Create `bridge/inject-test-action.js`:

```javascript
const http = require('http');

const testActions = {
  hint: {
    sqf: "systemChat 'Hello from LLMGM Bridge! This is a test hint.';",
    metadata: {
      action: 'narrative',
      reasoning: 'Manual test injection - displaying hint message',
      timestamp: Date.now()
    }
  },
  spawn: {
    sqf: `
private _pos = getPosATL player;
_pos set [0, (_pos select 0) + 50];
_pos set [1, (_pos select 1) + 50];
private _grp = createGroup east;
private _unit = _grp createUnit ['O_Soldier_F', _pos, [], 0, 'FORM'];
_unit setSkill 0.5;
systemChat format ['Spawned enemy soldier at %1', _pos];
    `.trim(),
    metadata: {
      action: 'spawn',
      reasoning: 'Manual test - spawn enemy soldier 50m northeast of player',
      timestamp: Date.now()
    }
  },
  waypoint: {
    sqf: `
private _playerGrp = group player;
private _wp = _playerGrp addWaypoint [getPosATL player, 100];
_wp setWaypointType 'MOVE';
systemChat 'Added waypoint 100m from current position';
    `.trim(),
    metadata: {
      action: 'objective',
      reasoning: 'Manual test - add movement waypoint',
      timestamp: Date.now()
    }
  }
};

function injectAction(actionName) {
  const action = testActions[actionName];
  if (!action) {
    console.error(`Unknown action: ${actionName}`);
    console.log('Available actions:', Object.keys(testActions).join(', '));
    process.exit(1);
  }

  const data = JSON.stringify({
    hasAction: true,
    sqf: action.sqf,
    metadata: action.metadata
  });

  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/action/inject',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length
    }
  };

  const req = http.request(options, (res) => {
    console.log(`Status: ${res.statusCode}`);
    res.on('data', (d) => {
      process.stdout.write(d);
    });
  });

  req.on('error', (error) => {
    console.error('Error injecting action:', error);
  });

  req.write(data);
  req.end();
}

const actionName = process.argv[2] || 'hint';
console.log(`Injecting test action: ${actionName}`);
injectAction(actionName);
```

#### Step 2: Add Injection Endpoint to Bridge

Add this to `bridge/src/server.ts` (temporary, for testing only):

```typescript
// TEST ENDPOINT - Remove in production
this.app.post('/api/action/inject', (req: Request, res: Response) => {
  const { sqf, metadata } = req.body;

  if (!sqf) {
    return res.status(400).json({ error: 'Missing sqf field' });
  }

  this.actionQueue.push({
    sqf,
    metadata: metadata || { action: 'test', timestamp: Date.now() }
  });

  logger.info('Test action injected', { queueLength: this.actionQueue.length });
  res.json({ success: true, queuePosition: this.actionQueue.length });
});
```

#### Step 3: Inject and Test

```bash
# Restart bridge server to load injection endpoint
cd ./bridge
npm start

# In another terminal, inject a test action
node inject-test-action.js hint

# Wait up to 30 seconds for Arma 3 to poll and execute
# Check for hint message in game: "Hello from LLMGM Bridge!"
```

#### Step 4: Test Different Action Types

```bash
# Test enemy spawn
node inject-test-action.js spawn
# Expected: Enemy soldier spawns 50m NE of player, chat message appears

# Test waypoint creation
node inject-test-action.js waypoint
# Expected: New waypoint added to player's group, chat message appears
```

---

### Method 2: End-to-End with Claude API

This method tests the complete pipeline with real AI-generated actions.

#### Step 1: Configure Claude API Key

```bash
cd ./bridge
echo "ANTHROPIC_API_KEY=sk-ant-your-key-here" >> .env
echo "LLM_PROVIDER=anthropic" >> .env
```

#### Step 2: Start Bridge and Arma 3

```bash
# Start bridge
cd ./bridge
npm start

# Launch Arma 3 with LLMGM mod
# Load a mission with some enemy AI
```

#### Step 3: Trigger Game State Update

The bridge will automatically process game state and generate actions based on the situation.

**Expected Flow:**
1. Game state sent every 30s to `/api/state`
2. Bridge processes state with Claude API
3. Claude generates action with SQF code
4. Action queued in bridge
5. Arma 3 polls `/api/action` (part of 30s update loop)
6. SQF executed in-game

#### Step 4: Monitor Logs

**Bridge Server:**
```
[INFO] Game state received { players: 1, enemies: 3 }
[INFO] Requesting decision from Claude { model: claude-3-5-sonnet-20241022 }
[INFO] LLM decision received { action: 'spawn', reasoning: '...' }
[INFO] Action queued for execution { queueLength: 1 }
[INFO] Action sent to game { metadata: { action: 'spawn' } }
```

**Arma 3 RPT:**
```
[LLMGM] Received action from bridge: spawn
=== LLMGM EXECUTING GENERATED SQF ===
Action: spawn
Timestamp: 1705371234567
Reasoning: Enemy force depleted, reinforcing from the north
=== SQF CODE ===
private _spawnPos = [player, 300, 45] call BIS_fnc_relPos;
...
=== END SQF CODE ===
[LLMGM] SQF executed successfully
```

---

## Verification Checklist

### Code Verification (Programmatic)

- [x] **fn_receiveFromBridge.sqf** exists and polls extension
- [x] **fn_executeGenerated.sqf** exists with security checks
- [x] **Extension** has `getAction()` function calling `/api/action`
- [x] **Bridge server** has GET `/api/action` endpoint
- [x] **Action queue** mechanism exists in bridge
- [x] **SQF validator** checks code before execution
- [x] **Security filters** block dangerous commands

### Manual Runtime Verification

Execute each test and check for:

#### Test 1: Hint Message
- [ ] Chat message appears in-game: "Hello from LLMGM Bridge!"
- [ ] RPT logs show: `[LLMGM] Received action from bridge: narrative`
- [ ] RPT logs show: `[LLMGM] SQF executed successfully`
- [ ] No compilation or execution errors

#### Test 2: Enemy Spawn
- [ ] Enemy soldier spawns ~50m from player
- [ ] Chat message confirms spawn location
- [ ] Enemy unit is visible and operational
- [ ] RPT logs show successful execution
- [ ] No errors in RPT logs

#### Test 3: Waypoint Creation
- [ ] Waypoint added to player's group (visible on map)
- [ ] Chat message confirms waypoint creation
- [ ] Waypoint is functional (unit can move to it)
- [ ] RPT logs show successful execution

#### Test 4: Security Filtering
- [ ] Inject action with blocked command (e.g., `endMission`)
- [ ] RPT logs show: `[LLMGM] ERROR: Blocked command detected: endMission`
- [ ] RPT logs show: `[LLMGM] EXECUTION BLOCKED - Security violation detected`
- [ ] Mission continues running (command not executed)

#### Test 5: Invalid SQF Handling
- [ ] Inject action with syntax error (e.g., `systemChat "missing quote;`)
- [ ] RPT logs show compilation failure
- [ ] RPT logs show quote analysis output
- [ ] Game remains stable (no crash)

#### Test 6: End-to-End with Claude (Optional)
- [ ] Game state triggers AI action generation
- [ ] Bridge logs show Claude API call
- [ ] Action returned and queued
- [ ] Arma 3 receives and executes action
- [ ] In-game effect visible (spawn, waypoint, hint, etc.)

---

## Expected RPT Log Output

### Successful Execution
```
[LLMGM] Received action from bridge: spawn
=== LLMGM EXECUTING GENERATED SQF ===
Action: spawn
Timestamp: 1705371234567
Reasoning: Reinforcing enemy position with additional infantry
=== SQF CODE ===
private _pos = [player, 200, 0] call BIS_fnc_relPos;
private _grp = createGroup east;
private _unit = _grp createUnit ['O_Soldier_F', _pos, [], 0, 'FORM'];
systemChat 'Enemy reinforcements arrived';
=== END SQF CODE ===
[LLMGM] SQF executed successfully
```

### Security Block
```
[LLMGM] Received action from bridge: test
=== LLMGM EXECUTING GENERATED SQF ===
Action: test
=== SQF CODE ===
endMission "END1";
=== END SQF CODE ===
[LLMGM] ERROR: Blocked command detected: endMission
[LLMGM] EXECUTION BLOCKED - Security violation detected
```

### Compilation Error
```
[LLMGM] Received action from bridge: narrative
=== LLMGM EXECUTING GENERATED SQF ===
=== SQF CODE ===
systemChat "missing quote;
=== END SQF CODE ===
=== LLMGM QUOTE ANALYSIS ===
[LLMGM] Issue 1: Potentially mismatched single quotes (count: 1)
=== END QUOTE ANALYSIS ===
[LLMGM] Compilation failed - analyzing SQF structure...
[LLMGM] ERROR executing SQF: Compilation failed - check quote formatting
```

---

## Troubleshooting

### Action Not Executing

**Symptom:** No in-game effects, no RPT log messages

**Checks:**
1. Is bridge server running? (Check terminal)
2. Is Arma 3 polling? (RPT should show periodic game state updates)
3. Is action queue empty? (Check bridge logs for "Action queued")
4. Is extension loaded? (RPT should show "[LLMGM] Extension loaded successfully")

**Solutions:**
- Restart bridge server
- Verify extension DLL is in correct directory
- Check that update loop is running (30s interval)
- Manually inject an action to bypass AI generation

### Compilation Errors

**Symptom:** RPT shows "Compilation failed" or "ERROR executing SQF"

**Checks:**
1. Are quotes properly formatted? (Check for `"` vs `'`)
2. Are there placeholder markers like `__DQUOTE__`?
3. Is SQF syntax valid? (test in debug console first)

**Solutions:**
- Review quote analysis output in RPT
- Check bridge logs for sanitization process
- Test SQF code manually in Arma 3 debug console

### Security Blocks

**Symptom:** RPT shows "EXECUTION BLOCKED - Security violation"

**This is expected behavior** if the SQF contains:
- `endMission`, `failMission`, `serverCommand`
- `saveProfileNamespace`, `loadFile`, `preprocessFile`
- `deleteVehicle player`

**Solutions:**
- Review Claude's prompt to avoid generating these commands
- Adjust security filters if needed (with caution)
- Use whitelisting approach for production

---

## Success Criteria

The subtask is **complete** when:

1. ✅ **Code Verification:** All pipeline components exist and are correctly configured
2. ✅ **Hint Test:** Chat messages appear successfully
3. ✅ **Spawn Test:** Enemy units spawn correctly
4. ✅ **Waypoint Test:** Waypoints are created and functional
5. ✅ **Security Test:** Blocked commands are prevented
6. ✅ **Error Handling:** Invalid SQF is caught without crashing
7. ✅ **RPT Logs:** Clean execution logs with no unexpected errors

---

## Next Steps After Verification

1. Document test results in `SUBTASK_4-4_VERIFICATION.md`
2. Commit test resources: `git add . && git commit -m "auto-claude: subtask-4-4 test resources"`
3. Update implementation_plan.json status to "completed"
4. Report findings in build-progress.txt

---

## Quick Reference

### Test Commands
```bash
# Start bridge
cd ./bridge && npm start

# Inject test hint
node inject-test-action.js hint

# Inject test spawn
node inject-test-action.js spawn

# View bridge logs
cd ./bridge && npm start | grep LLMGM

# View Arma 3 logs (Windows)
tail -f "%LOCALAPPDATA%\Arma 3\*.rpt"
```

### Key Files
- `addon/functions/fn_receiveFromBridge.sqf` - Action polling
- `addon/functions/fn_executeGenerated.sqf` - Action execution
- `extension/src/bridge_client.cpp` - HTTP GET /api/action
- `bridge/src/server.ts` - Action queue and endpoint (line 130-141)

### Expected Behavior
- **Polling Interval:** Every 30 seconds (part of main update loop)
- **Execution Location:** Server only (not on clients in multiplayer)
- **Security:** Blocked commands prevented before compilation
- **Error Recovery:** Invalid SQF logged but doesn't crash mission
