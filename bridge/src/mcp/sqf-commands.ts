/**
 * Common SQF Commands Reference
 * For AI Game Master to verify command syntax
 */

export interface SQFCommand {
  name: string;
  syntax: string;
  description: string;
  example?: string;
}

export const sqfCommands: Record<string, SQFCommand> = {
  // Group Creation & Management
  'createGroup': {
    name: 'createGroup',
    syntax: 'createGroup side',
    description: 'Creates a new group on the given side. Returns GROUP.',
    example: 'private _group = createGroup EAST;'
  },
  'createUnit': {
    name: 'createUnit',
    syntax: 'group createUnit [type, position, markers, placement, special]',
    description: 'Creates a unit of given type and joins it to the group.',
    example: '_group createUnit ["O_Soldier_F", _pos, [], 0, "FORM"];'
  },
  'createVehicle': {
    name: 'createVehicle',
    syntax: 'createVehicle [type, position, markers, placement, special]',
    description: 'Creates a vehicle at the given position.',
    example: 'private _heli = createVehicle ["O_Heli_Attack_02_F", _pos, [], 0, "FLY"];'
  },
  'deleteVehicle': {
    name: 'deleteVehicle',
    syntax: 'deleteVehicle object',
    description: 'Deletes the given object. Use carefully.',
    example: 'deleteVehicle _unit;'
  },
  'joinSilent': {
    name: 'joinSilent',
    syntax: 'unitsArray joinSilent group',
    description: 'Moves units to another group without radio messages.',
    example: '(crew _vehicle) joinSilent _group;'
  },

  // Behavior & Combat
  'setBehaviour': {
    name: 'setBehaviour',
    syntax: 'group setBehaviour behaviour',
    description: 'Sets group behaviour. Values: "CARELESS", "SAFE", "AWARE", "COMBAT", "STEALTH"',
    example: '_group setBehaviour "COMBAT";'
  },
  'setCombatMode': {
    name: 'setCombatMode',
    syntax: 'group setCombatMode mode',
    description: 'Sets group combat mode. Values: "BLUE" (never fire), "GREEN" (hold fire), "WHITE" (hold fire, engage at will), "YELLOW" (fire at will), "RED" (fire at will, engage at will)',
    example: '_group setCombatMode "RED";'
  },
  'setSpeedMode': {
    name: 'setSpeedMode',
    syntax: 'group setSpeedMode mode',
    description: 'Sets group speed. Values: "LIMITED", "NORMAL", "FULL"',
    example: '_group setSpeedMode "FULL";'
  },
  'setFormation': {
    name: 'setFormation',
    syntax: 'group setFormation formation',
    description: 'Sets group formation. Values: "COLUMN", "STAG COLUMN", "WEDGE", "ECH LEFT", "ECH RIGHT", "VEE", "LINE", "FILE", "DIAMOND"',
    example: '_group setFormation "WEDGE";'
  },

  // Waypoints
  'addWaypoint': {
    name: 'addWaypoint',
    syntax: 'group addWaypoint [position, radius, index, name]',
    description: 'Adds a waypoint to the group. Returns waypoint array [group, index].',
    example: 'private _wp = _group addWaypoint [getPos player, 50];'
  },
  'setWaypointType': {
    name: 'setWaypointType',
    syntax: 'waypoint setWaypointType type',
    description: 'Sets waypoint type. Values: "MOVE", "SAD" (seek and destroy), "GUARD", "CYCLE", "GETOUT", "HOLD", "DISMISS", "LOITER", "LAND", "SCRIPTED", "SUPPORT", "GETIN"',
    example: '_wp setWaypointType "SAD";'
  },
  'setWaypointSpeed': {
    name: 'setWaypointSpeed',
    syntax: 'waypoint setWaypointSpeed speed',
    description: 'Sets waypoint speed. Values: "UNCHANGED", "LIMITED", "NORMAL", "FULL"',
    example: '_wp setWaypointSpeed "FULL";'
  },
  'setWaypointBehaviour': {
    name: 'setWaypointBehaviour',
    syntax: 'waypoint setWaypointBehaviour behaviour',
    description: 'Sets behaviour at waypoint.',
    example: '_wp setWaypointBehaviour "COMBAT";'
  },
  'setWaypointCombatMode': {
    name: 'setWaypointCombatMode',
    syntax: 'waypoint setWaypointCombatMode mode',
    description: 'Sets combat mode at waypoint.',
    example: '_wp setWaypointCombatMode "RED";'
  },

  // Position
  'getPos': {
    name: 'getPos',
    syntax: 'getPos object',
    description: 'Returns position [x, y, z] of object.',
    example: 'private _pos = getPos player;'
  },
  'getPosATL': {
    name: 'getPosATL',
    syntax: 'getPosATL object',
    description: 'Returns position Above Terrain Level.',
    example: 'private _pos = getPosATL player;'
  },
  'setPos': {
    name: 'setPos',
    syntax: 'object setPos position',
    description: 'Teleports object to position. Use carefully.',
    example: '_unit setPos [5000, 6000, 0];'
  },

  // Communication
  'systemChat': {
    name: 'systemChat',
    syntax: 'systemChat message',
    description: 'Shows a system message to all players.',
    example: 'systemChat "Enemy patrol spotted!";'
  },
  'hint': {
    name: 'hint',
    syntax: 'hint message',
    description: 'Shows a hint box on screen.',
    example: 'hint "Objective updated";'
  },
  'sideChat': {
    name: 'sideChat',
    syntax: 'unit sideChat message',
    description: 'Sends a radio message from the unit.',
    example: 'player sideChat "Contact, 200 meters!";'
  },

  // Unit Info
  'leader': {
    name: 'leader',
    syntax: 'leader group',
    description: 'Returns the leader of the group.',
    example: 'private _ldr = leader _group;'
  },
  'units': {
    name: 'units',
    syntax: 'units group',
    description: 'Returns array of all units in the group.',
    example: 'private _allUnits = units _group;'
  },
  'group': {
    name: 'group',
    syntax: 'group unit',
    description: 'Returns the group the unit belongs to.',
    example: 'private _grp = group player;'
  },
  'side': {
    name: 'side',
    syntax: 'side object',
    description: 'Returns the side of the object (EAST, WEST, GUER, CIV).',
    example: 'if (side _unit == EAST) then {...};'
  },
  'alive': {
    name: 'alive',
    syntax: 'alive object',
    description: 'Returns true if the object is alive.',
    example: 'if (alive _unit) then {...};'
  },

  // Variables
  'setVariable': {
    name: 'setVariable',
    syntax: 'object setVariable [name, value, public]',
    description: 'Sets a variable on an object. Optional public broadcast.',
    example: '_group setVariable ["LLMGM_groupId", 5];'
  },
  'getVariable': {
    name: 'getVariable',
    syntax: 'object getVariable [name, default]',
    description: 'Gets a variable from an object with optional default.',
    example: 'private _id = _group getVariable ["LLMGM_groupId", -1];'
  },

  // BIS Functions
  'BIS_fnc_taskPatrol': {
    name: 'BIS_fnc_taskPatrol',
    syntax: '[group, position, radius] call BIS_fnc_taskPatrol',
    description: 'Makes a group patrol around a position.',
    example: '[_group, getPos player, 300] call BIS_fnc_taskPatrol;'
  },
  'BIS_fnc_taskAttack': {
    name: 'BIS_fnc_taskAttack',
    syntax: '[group, position] call BIS_fnc_taskAttack',
    description: 'Makes a group attack a position.',
    example: '[_group, getPos player] call BIS_fnc_taskAttack;'
  },
  'BIS_fnc_taskDefend': {
    name: 'BIS_fnc_taskDefend',
    syntax: '[group, position, radius] call BIS_fnc_taskDefend',
    description: 'Makes a group defend a position.',
    example: '[_group, _pos, 100] call BIS_fnc_taskDefend;'
  },

  // CBA Functions
  'CBA_fnc_clearWaypoints': {
    name: 'CBA_fnc_clearWaypoints',
    syntax: '[group] call CBA_fnc_clearWaypoints',
    description: 'Clears all waypoints from a group.',
    example: '[_group] call CBA_fnc_clearWaypoints;'
  },

  // Misc
  'player': {
    name: 'player',
    syntax: 'player',
    description: 'Returns the player object.',
    example: 'private _pos = getPos player;'
  },
  'allPlayers': {
    name: 'allPlayers',
    syntax: 'allPlayers',
    description: 'Returns array of all player objects.',
    example: '{hint "Hello"} forEach allPlayers;'
  },
  'allUnits': {
    name: 'allUnits',
    syntax: 'allUnits',
    description: 'Returns array of all units on the map.',
    example: '{if (side _x == EAST) then {...}} forEach allUnits;'
  },
  'count': {
    name: 'count',
    syntax: 'count array',
    description: 'Returns the number of elements in the array.',
    example: 'private _num = count units _group;'
  },
  'select': {
    name: 'select',
    syntax: 'array select index',
    description: 'Returns element at index from array.',
    example: 'private _first = _array select 0;'
  },
  'pushBack': {
    name: 'pushBack',
    syntax: 'array pushBack element',
    description: 'Adds element to end of array. Returns new array length.',
    example: 'LLMGM_spawnedGroups pushBack _group;'
  },
  'isNull': {
    name: 'isNull',
    syntax: 'isNull object',
    description: 'Returns true if the object is null.',
    example: 'if (!isNull _group) then {...};'
  }
};

export function lookupSQFCommand(commandName: string): SQFCommand | null {
  const lower = commandName.toLowerCase();
  for (const [key, cmd] of Object.entries(sqfCommands)) {
    if (key.toLowerCase() === lower) {
      return cmd;
    }
  }
  return null;
}

export function searchSQFCommands(query: string): SQFCommand[] {
  const lower = query.toLowerCase();
  return Object.values(sqfCommands).filter(cmd =>
    cmd.name.toLowerCase().includes(lower) ||
    cmd.description.toLowerCase().includes(lower)
  );
}
