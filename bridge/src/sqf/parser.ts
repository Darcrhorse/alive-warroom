/**
 * SQF Parser - Extracts SQF code from LLM responses
 */

export class SQFParser {
  /**
   * Extract SQF code from LLM response
   * Looks for code blocks wrapped in ```sqf or ```
   * Also handles truncated responses without closing ```
   */
  extractSQF(response: string): string | null {
    let code: string | null = null;

    // Try to find complete SQF code block first
    const sqfBlockMatch = response.match(/```sqf\s*([\s\S]*?)```/i);
    if (sqfBlockMatch) {
      code = sqfBlockMatch[1].trim();
    }

    // Try generic complete code block
    if (!code) {
      const codeBlockMatch = response.match(/```\s*([\s\S]*?)```/);
      if (codeBlockMatch) {
        code = codeBlockMatch[1].trim();
      }
    }

    // Handle truncated responses - code block started but not closed
    // SAFETY: Do NOT execute truncated code - it's likely incomplete and dangerous!
    if (!code) {
      const truncatedSqfMatch = response.match(/```sqf\s*([\s\S]+)$/i);
      if (truncatedSqfMatch) {
        const truncCode = truncatedSqfMatch[1].trim();
        // Check for signs of truncation (incomplete code)
        const hasOpenBraces = (truncCode.match(/{/g) || []).length;
        const hasCloseBraces = (truncCode.match(/}/g) || []).length;
        const hasOpenBrackets = (truncCode.match(/\[/g) || []).length;
        const hasCloseBrackets = (truncCode.match(/\]/g) || []).length;
        const isBalanced = hasOpenBraces === hasCloseBraces && hasOpenBrackets === hasCloseBrackets;
        const endsWithSemicolon = truncCode.endsWith(';') || truncCode.endsWith('};');

        // Only use truncated code if it appears complete
        if (truncCode.includes(';') && truncCode.length > 50 && isBalanced && endsWithSemicolon) {
          console.log('[SQF Parser] Recovered truncated but complete SQF code');
          code = truncCode;
        } else {
          console.warn('[SQF Parser] REJECTED truncated/incomplete SQF code - response was cut off');
          console.warn(`[SQF Parser] Truncated code stats: braces ${hasOpenBraces}/${hasCloseBraces}, brackets ${hasOpenBrackets}/${hasCloseBrackets}, ends with semicolon: ${endsWithSemicolon}`);
          return null; // Reject incomplete code
        }
      }
    }

    // No code block found
    if (!code) {
      return null;
    }

    // CRITICAL FIX: Wrap code in spawn block to keep private variables in scope
    // This prevents "_fobPos undefined" errors when code is split during execution
    // Only wrap if not already in a spawn block
    if (!code.trim().startsWith('[] spawn') && !code.trim().startsWith('0 spawn')) {
      code = `[] spawn {\n${code}\n};`;
    }

    return code;
  }

  /**
   * Force FOB code to use predefined markers with comprehensive validation
   * - Checks if marker exists, falls back to safe position
   * - Validates position is not on water
   * - Ensures 2000m distance from enemy FOB
   */
  forceMarkerUsage(code: string, side: 'EAST' | 'WEST'): string {
    const markerName = side === 'EAST' ? 'fob_east_zone' : 'fob_west_zone';
    const enemyFobVar = side === 'EAST' ? 'LLMGM_westFobPos' : 'LLMGM_eastFobPos';
    // EAST gets NE quadrant (0.7, 0.3), WEST gets SW quadrant (0.3, 0.7)
    const quadrantX = side === 'EAST' ? '0.7' : '0.3';
    const quadrantY = side === 'EAST' ? '0.3' : '0.7';

    // Generate SIMPLIFIED FOB position validation (reduced to prevent stack overflow)
    const fobValidationCode = `
// === FOB VALIDATION (simplified) ===
private _fobPos = [];
private _quadrantCenter = [worldSize * ${quadrantX}, worldSize * ${quadrantY}, 0];

// Try marker first, then fallback
// BIS_fnc_findSafePos: [center, minDist, maxDist, objDist, waterMode, maxGrad, shoreMode]
// waterMode 1 = LAND ONLY (no water spawns!)
if (getMarkerType "${markerName}" != "") then {
    _fobPos = getMarkerPos "${markerName}";
    if (_fobPos distance2D [0,0,0] < 100 || surfaceIsWater _fobPos) then {
        _fobPos = [_quadrantCenter, 100, 2000, 10, 1, 0.5, 0] call BIS_fnc_findSafePos;
    };
} else {
    _fobPos = [_quadrantCenter, 100, 2000, 10, 1, 0.5, 0] call BIS_fnc_findSafePos;
};

// Water check (aggressive retry with land-only constraint)
if (surfaceIsWater _fobPos) then {
    _fobPos = [[worldSize/2, worldSize/2, 0], 500, 5000, 10, 1, 0.3, 0] call BIS_fnc_findSafePos;
};
// Last resort - if STILL on water, move inland
if (surfaceIsWater _fobPos) then {
    _fobPos = [[worldSize * 0.5, worldSize * 0.5, 0], 1000, worldSize * 0.4, 5, 1, 0.2, 0] call BIS_fnc_findSafePos;
};

// Create marker if needed
if (getMarkerType "${markerName}" == "") then {
    createMarker ["${markerName}", _fobPos];
    "${markerName}" setMarkerType "mil_flag";
    "${markerName}" setMarkerColor "${side === 'EAST' ? 'colorOPFOR' : 'colorBLUFOR'}";
};

systemChat format ["${side} FOB at %1", _fobPos];
// === END FOB VALIDATION ===
`;

    // Check if code already has our validation block
    if (code.includes('FOB POSITION VALIDATION')) {
      return code;
    }

    // Find and remove existing _fobPos assignments (we'll replace with validation block)
    // Using string-based patterns to avoid regex lastIndex issues
    const patterns = [
      // getMarkerPos: _fobPos = getMarkerPos "..."
      /(private\s+)?_fobPos\s*=\s*getMarkerPos\s*"[^"]+"\s*;?/i,
      // Direct hardcoded: _fobPos = [8100, 8000, 0]
      /(private\s+)?_fobPos\s*=\s*\[[0-9., ]+\]\s*;?/i,
      // BIS_fnc_findSafePos: _fobPos = [...] call BIS_fnc_findSafePos
      /(private\s+)?_fobPos\s*=\s*\[[^\]]+\]\s*call\s*BIS_fnc_findSafePos\s*;?/i,
      // Intermediate variables like _botanaPos
      /(private\s+)?_botanaPos\s*=\s*\[[0-9., ]+\]\s*;?/i,
    ];

    let modified = false;

    for (const pattern of patterns) {
      const match = code.match(pattern);
      if (match) {
        console.log(`[SQF Parser] ${side}: Found FOB pattern: "${match[0].substring(0, 50)}..."`);
        if (!modified) {
          // Replace first match with our validation block
          code = code.replace(pattern, fobValidationCode);
          modified = true;
          console.log(`[SQF Parser] ${side}: Injected FOB validation block`);
        } else {
          // Remove subsequent matches (they're now redundant)
          code = code.replace(pattern, '// (position handled by FOB validation above)');
        }
      }
    }

    if (modified) {
      console.log(`[SQF Parser] ${side}: Comprehensive FOB validation applied`);
    } else {
      // No patterns found - prepend validation block anyway to ensure FOB is set correctly
      console.log(`[SQF Parser] ${side}: No FOB position patterns found - prepending validation block`);
      // Insert after the spawn block opening if present
      if (code.includes('[] spawn {')) {
        code = code.replace('[] spawn {', '[] spawn {\n' + fobValidationCode);
        modified = true;
      }
    }

    return code;
  }

  /**
   * Spread out spawn positions to prevent unit stacking
   * Replaces direct position usage in createUnit/createVehicle with offset positions
   */
  spreadSpawnPositions(code: string): string {
    // Add spawn counter and position spreading at the start
    const spreadHelper = `
// === SPAWN POSITION SPREADING (with water safety) ===
private _spawnIndex = 0;
private _fnc_getSpreadPos = {
    params ["_basePos", ["_radius", 25]];
    _spawnIndex = _spawnIndex + 1;
    private _angle = (_spawnIndex * 45) + (random 30);
    private _dist = 5 + (_spawnIndex * 4) + (random 5);
    private _spreadPos = _basePos getPos [_dist min _radius, _angle];
    // WATER SAFETY: Ensure position is on land
    if (surfaceIsWater _spreadPos) then {
        // BIS_fnc_findSafePos params: [center, minDist, maxDist, objDist, waterMode, maxGrad, shoreMode]
        // waterMode 1 = LAND ONLY (no water!)
        _spreadPos = [_basePos, 5, _radius, 3, 1, 0.5, 0] call BIS_fnc_findSafePos;
        // If still on water (shouldn't happen), use base position
        if (surfaceIsWater _spreadPos) then { _spreadPos = _basePos; };
    };
    _spreadPos
};
// Safe vehicle spawn wrapper - ALWAYS checks for water
private _fnc_safeCreateVehicle = {
    params ["_class", "_pos"];
    private _safePos = _pos;
    if (surfaceIsWater _pos) then {
        _safePos = [_pos, 10, 100, 5, 1, 0.5, 0] call BIS_fnc_findSafePos;
        if (surfaceIsWater _safePos) then {
            _safePos = [_pos, 50, 300, 5, 1, 0.3, 0] call BIS_fnc_findSafePos;
        };
    };
    createVehicle [_class, _safePos, [], 0, "NONE"]
};
// === END SPAWN SPREADING ===
`;

    // Only add if there are spawn commands and we haven't already added it
    if ((code.includes('createUnit') || code.includes('createVehicle')) &&
        !code.includes('SPAWN POSITION SPREADING')) {

      // Insert after the spawn block opening
      if (code.includes('[] spawn {')) {
        code = code.replace('[] spawn {', '[] spawn {' + spreadHelper);
      }

      // Replace common patterns where units spawn at _fobPos directly
      // Pattern: createUnit ["Class", _fobPos, ...] -> createUnit ["Class", [_fobPos, 25] call _fnc_getSpreadPos, ...]
      code = code.replace(
        /createUnit\s*\[\s*"([^"]+)"\s*,\s*_fobPos\s*,/gi,
        'createUnit ["$1", ([_fobPos, 30] call _fnc_getSpreadPos),'
      );

      // Pattern: createVehicle ["Class", _fobPos, ...] -> use spread position for vehicles (larger radius)
      code = code.replace(
        /createVehicle\s*\[\s*"([^"]+)"\s*,\s*_fobPos\s*,/gi,
        'createVehicle ["$1", ([_fobPos, 50] call _fnc_getSpreadPos),'
      );

      // Also handle LLMGM_eastFobPos and LLMGM_westFobPos
      code = code.replace(
        /createUnit\s*\[\s*"([^"]+)"\s*,\s*LLMGM_(east|west)FobPos\s*,/gi,
        'createUnit ["$1", ([LLMGM_$2FobPos, 30] call _fnc_getSpreadPos),'
      );

      code = code.replace(
        /createVehicle\s*\[\s*"([^"]+)"\s*,\s*LLMGM_(east|west)FobPos\s*,/gi,
        'createVehicle ["$1", ([LLMGM_$2FobPos, 50] call _fnc_getSpreadPos),'
      );

      console.log('[SQF Parser] Spawn position spreading applied');
    }

    return code;
  }

  /**
   * Inject combat tracking for spawned groups
   * Adds event handlers to report casualties, contacts, etc back to bridge
   */
  injectCombatTracking(code: string, side: 'EAST' | 'WEST', groupId: number): string {
    // Add tracking code after group creation
    const trackingCode = `
// === COMBAT TRACKING ===
if (!isNil "_grp" && {!isNull _grp}) then {
    [_grp, ${groupId}, "${side}"] call LLMGM_fnc_addCombatTracking;
};
// === END COMBAT TRACKING ===
`;

    // Find group variable assignments and add tracking after
    const groupPatterns = [
      /(_grp)\s*=\s*createGroup/i,
      /(_group)\s*=\s*createGroup/i,
      /(private\s+_grp)\s*=\s*createGroup/i,
      /(private\s+_group)\s*=\s*createGroup/i,
    ];

    let hasGroup = false;
    for (const pattern of groupPatterns) {
      if (pattern.test(code)) {
        hasGroup = true;
        break;
      }
    }

    if (hasGroup && !code.includes('COMBAT TRACKING')) {
      // Add tracking code before the closing };
      if (code.includes('};')) {
        const lastBrace = code.lastIndexOf('};');
        code = code.substring(0, lastBrace) + trackingCode + code.substring(lastBrace);
        console.log(`[SQF Parser] Injected combat tracking for ${side} group ${groupId}`);
      }
    }

    return code;
  }

  /**
   * Validate and enforce FOB-based spawning
   * Injects runtime validation that moves spawns to FOB if they're too far away
   * This catches hardcoded positions that bypass _fobPos variable
   */
  enforceSpawnAtFOB(code: string, side: 'EAST' | 'WEST'): string {
    const fobVar = side === 'EAST' ? 'LLMGM_eastFobPos' : 'LLMGM_westFobPos';
    const maxDistance = 300; // Units must spawn within 300m of FOB

    // Validation function to inject - moves spawn to FOB if too far
    const validationCode = `
// === FOB SPAWN ENFORCEMENT ===
private _fnc_enforceFobSpawn = {
    params ["_pos"];
    private _fobPos = if (!isNil "${fobVar}") then {${fobVar}} else {[worldSize/2, worldSize/2, 0]};
    private _dist = _pos distance2D _fobPos;
    if (_dist > ${maxDistance}) then {
        systemChat format ["[${side}] ⚠️ SPAWN MOVED: Position %1m from FOB - relocating to base!", round _dist];
        diag_log format ["[LLMGM] ${side} spawn position violation: %1m from FOB, moving to FOB", round _dist];
        // Return position near FOB with spread
        private _angle = random 360;
        private _spreadPos = _fobPos getPos [30 + random 50, _angle];
        // Ensure on land
        if (surfaceIsWater _spreadPos) then {
            _spreadPos = [_fobPos, 10, 100, 3, 1, 0.5, 0] call BIS_fnc_findSafePos;
        };
        _spreadPos
    } else {
        _pos // Position is OK, return as-is
    };
};
// === END FOB SPAWN ENFORCEMENT ===
`;

    // Only add if there are spawn commands and we haven't already added it
    if ((code.includes('createUnit') || code.includes('createVehicle')) &&
        !code.includes('FOB SPAWN ENFORCEMENT')) {

      // Insert after the spawn block opening
      if (code.includes('[] spawn {')) {
        code = code.replace('[] spawn {', '[] spawn {' + validationCode);
      }

      // Wrap ALL position arrays in createUnit calls with the enforcement function
      // Pattern: createUnit ["class", [X, Y, Z], ...] -> createUnit ["class", ([[X, Y, Z]] call _fnc_enforceFobSpawn), ...]
      // This catches hardcoded positions that don't use _fobPos
      code = code.replace(
        /createUnit\s*\[\s*"([^"]+)"\s*,\s*\[([0-9.,\s]+)\]\s*,/gi,
        (match, className, coords) => {
          console.log(`[SQF Parser] ${side}: Wrapping hardcoded spawn position [${coords.substring(0, 30)}...]`);
          return `createUnit ["${className}", ([[${coords}]] call _fnc_enforceFobSpawn),`;
        }
      );

      // Also wrap createVehicle hardcoded positions
      code = code.replace(
        /createVehicle\s*\[\s*"([^"]+)"\s*,\s*\[([0-9.,\s]+)\]\s*,/gi,
        (match, className, coords) => {
          console.log(`[SQF Parser] ${side}: Wrapping hardcoded vehicle spawn [${coords.substring(0, 30)}...]`);
          return `createVehicle ["${className}", ([[${coords}]] call _fnc_enforceFobSpawn),`;
        }
      );

      console.log(`[SQF Parser] ${side}: FOB spawn enforcement applied`);
    }

    return code;
  }

  /**
   * Check if code has transport for long-distance operations
   * Returns warning if troops are sent far without vehicles
   */
  checkTransportUsage(code: string, side: 'EAST' | 'WEST'): string | null {
    const sqfLower = code.toLowerCase();

    // Check for infantry spawn without transport
    const hasInfantrySpawn = sqfLower.includes('createunit') || sqfLower.includes('creategroup');
    const hasVehicleTransport = sqfLower.includes('moveincargo') ||
                                 sqfLower.includes('moveindriver') ||
                                 sqfLower.includes('getin') ||
                                 sqfLower.includes('land_') ||  // Helicopter landing
                                 sqfLower.includes('tr unload'); // Unload waypoint

    // Check for waypoints indicating long-distance movement
    const hasLongDistanceWaypoint = sqfLower.includes('addwaypoint') &&
                                     !sqfLower.includes('_fobpos'); // Waypoint NOT at FOB

    if (hasInfantrySpawn && hasLongDistanceWaypoint && !hasVehicleTransport) {
      return `⚠️ ${side} deploying infantry on foot mission - consider using vehicle transport for efficiency`;
    }

    return null;
  }

  /**
   * Extract reasoning from LLM response
   */
  extractReasoning(response: string): string | null {
    const reasoningMatch = response.match(/REASONING:\s*(.*?)(?=ACTION:|```|$)/is);
    if (reasoningMatch) {
      return reasoningMatch[1].trim();
    }
    return null;
  }

  /**
   * Extract action type from LLM response
   */
  extractAction(response: string): string | null {
    const actionMatch = response.match(/ACTION:\s*(\w+)/i);
    if (actionMatch) {
      return actionMatch[1].trim();
    }

    // If no explicit ACTION tag, try to infer from SQF content
    const sqf = this.extractSQF(response);
    if (sqf) {
      // Check for spawn indicators
      if (sqf.includes('createGroup') || sqf.includes('createUnit') || sqf.includes('createVehicle')) {
        return 'spawn';
      }
      // Check for objective/task indicators
      if (sqf.includes('createSimpleTask') || sqf.includes('setSimpleTaskDescription')) {
        return 'objective';
      }
      // Check for command indicators
      if (sqf.includes('addWaypoint') && !sqf.includes('createUnit')) {
        return 'command';
      }
      // Default to spawn if there's SQF code
      return 'spawn';
    }

    return null;
  }

  /**
   * Parse complete LLM response
   */
  parseResponse(response: string): {
    reasoning: string | null;
    action: string | null;
    sqf: string | null;
  } {
    return {
      reasoning: this.extractReasoning(response),
      action: this.extractAction(response),
      sqf: this.extractSQF(response)
    };
  }

  /**
   * CRITICAL: Ensure transport helicopters have troops loaded!
   * Detects transport heli spawns without moveInCargo and injects troop loading
   */
  ensureTransportHeliHasTroops(code: string, side: 'EAST' | 'WEST'): string {
    // Transport helicopter classnames (NOT attack helis)
    const transportHelis = [
      'RHS_Mi8', 'Mi8', 'UH60', 'RHS_UH60', 'CH47', 'CH_47', 'Chinook',
      'Heli_Transport', 'B_Heli_Transport', 'O_Heli_Transport', 'I_Heli_Transport',
      'RHS_Mi24', // Mi-24 can carry troops too
    ];

    // Attack helis that should NOT have troops injected
    const attackHelis = [
      'AH64', 'AH_64', 'Apache', 'Ka52', 'Mi28', 'AH1Z', 'Comanche',
      'Heli_Attack', 'B_Heli_Attack', 'O_Heli_Attack'
    ];

    const sqfLower = code.toLowerCase();

    // Check if there's a transport helicopter spawn
    let hasTransportHeli = false;
    let heliVarMatch: string | null = null;

    for (const heliType of transportHelis) {
      if (sqfLower.includes(heliType.toLowerCase())) {
        // Make sure it's not an attack heli
        let isAttack = false;
        for (const attackType of attackHelis) {
          if (sqfLower.includes(attackType.toLowerCase())) {
            isAttack = true;
            break;
          }
        }
        if (!isAttack) {
          hasTransportHeli = true;
          // Try to find the heli variable name
          const heliVarPattern = /private\s+(_\w+)\s*=\s*createVehicle\s*\[\s*"[^"]*(?:mi8|uh60|ch47|transport)/i;
          const match = code.match(heliVarPattern);
          if (match) {
            heliVarMatch = match[1];
          }
          break;
        }
      }
    }

    // If transport heli exists but no moveInCargo, inject troop loading
    if (hasTransportHeli && !sqfLower.includes('moveincargo')) {
      console.log(`[SQF Parser] ${side}: ⚠️ Transport heli detected WITHOUT troop loading!`);

      const sideEnum = side === 'EAST' ? 'EAST' : 'WEST';
      const classes = side === 'EAST'
        ? '["rhs_vdv_rifleman", "rhs_vdv_rifleman", "rhs_vdv_grenadier", "rhs_vdv_machinegunner", "rhs_vdv_medic", "rhs_vdv_at"]'
        : '["rhsusf_army_ucp_rifleman", "rhsusf_army_ucp_rifleman", "rhsusf_army_ucp_grenadier", "rhsusf_army_ucp_autorifleman", "rhsusf_army_ucp_medic", "rhsusf_army_ucp_javelin"]';

      const heliVar = heliVarMatch || '_heli';

      // Find where helicopter is created and inject troop loading after
      const troopLoadingCode = `
// === AUTO-INJECTED TROOP LOADING ===
// Transport heli detected - spawning and loading troops!
private _autoSquad = [];
if (!isNull ${heliVar} && {alive ${heliVar}}) then {
    private _heliPos = getPosATL ${heliVar};
    _autoSquad = [_heliPos, ${sideEnum}, ${classes}] call BIS_fnc_spawnGroup;
    // CRITICAL: BOTH assignAsCargo AND moveInCargo needed for proper unload!
    {
      _x assignAsCargo ${heliVar};
      _x moveInCargo ${heliVar};
    } forEach units _autoSquad;
    systemChat format ["${side} ACTUAL: %1 troops LOADED into transport!", count units _autoSquad];
};
// === END AUTO-INJECTED TROOP LOADING ===
`;

      // Find createVehicleCrew for the heli and inject after it
      if (code.includes('createVehicleCrew')) {
        code = code.replace(
          /(createVehicleCrew\s+[^;]+;)/i,
          '$1\n' + troopLoadingCode
        );
        console.log(`[SQF Parser] ${side}: ✅ Injected automatic troop loading for transport helicopter`);
      } else {
        // If no createVehicleCrew, inject before the first waypoint
        if (code.includes('addWaypoint')) {
          code = code.replace(
            /(addWaypoint)/i,
            troopLoadingCode + '\n$1'
          );
          console.log(`[SQF Parser] ${side}: ✅ Injected automatic troop loading before waypoints`);
        }
      }
    }

    return code;
  }
}

export const sqfParser = new SQFParser();
