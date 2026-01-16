/**
 * Test action injection script for LLMGM Bridge
 *
 * Usage: node inject-test-action.js [hint|spawn|waypoint]
 *
 * This script manually queues test actions without requiring Claude API,
 * allowing isolated testing of the action execution pipeline.
 */

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
  },
  security_test: {
    sqf: `endMission "END1";`,
    metadata: {
      action: 'test',
      reasoning: 'Security test - should be blocked',
      timestamp: Date.now()
    }
  },
  error_test: {
    sqf: `systemChat "missing quote;`,
    metadata: {
      action: 'test',
      reasoning: 'Error handling test - invalid syntax',
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
    let responseData = '';

    res.on('data', (chunk) => {
      responseData += chunk;
    });

    res.on('end', () => {
      if (res.statusCode === 200) {
        console.log('✓ Action injected successfully');
        try {
          const parsed = JSON.parse(responseData);
          console.log(`  Queue position: ${parsed.queuePosition}`);
        } catch (e) {
          console.log(`  Response: ${responseData}`);
        }
        console.log('\nWait up to 30 seconds for Arma 3 to poll and execute the action.');
        console.log('Check Arma 3 for in-game effects and RPT logs for execution details.');
      } else {
        console.error(`✗ Failed to inject action (HTTP ${res.statusCode})`);
        console.error(`  Response: ${responseData}`);
        process.exit(1);
      }
    });
  });

  req.on('error', (error) => {
    console.error('✗ Error connecting to bridge server:', error.message);
    console.error('\nMake sure bridge server is running:');
    console.error('  cd ./bridge && npm start');
    process.exit(1);
  });

  req.write(data);
  req.end();

  console.log(`Injecting test action: ${actionName}`);
  console.log(`Action type: ${action.metadata.action}`);
  console.log(`Reasoning: ${action.metadata.reasoning}`);
}

const actionName = process.argv[2] || 'hint';
injectAction(actionName);
