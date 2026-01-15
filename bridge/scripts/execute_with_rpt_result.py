#!/usr/bin/env python3
"""
Execute SQF and get result from RPT log file.

This script:
1. Sends SQF command that logs result to RPT
2. Monitors RPT for the result
3. Returns the result

Usage:
    python execute_with_rpt_result.py "count allUnits"
    python execute_with_rpt_result.py --timeout 10 "getPos player"
"""

import argparse
import json
import os
import re
import sys
import time
import uuid
import requests
from pathlib import Path

BRIDGE_URL = "http://localhost:3000"
DEFAULT_TIMEOUT = 10


def find_latest_rpt():
    """Find the most recent Arma 3 RPT file"""
    rpt_dir = Path(os.environ.get("LOCALAPPDATA", "")) / "Arma 3"
    if not rpt_dir.exists():
        rpt_dir = Path.home() / "AppData" / "Local" / "Arma 3"

    rpt_files = list(rpt_dir.glob("*.rpt"))
    if not rpt_files:
        return None

    return max(rpt_files, key=lambda f: f.stat().st_mtime)


def get_rpt_size(rpt_path):
    """Get current size of RPT file"""
    return rpt_path.stat().st_size if rpt_path.exists() else 0


def search_rpt_for_result(rpt_path, cmd_id, start_pos=0):
    """Search RPT file for result with given command ID"""
    if not rpt_path.exists():
        return None

    with open(rpt_path, 'r', encoding='utf-8', errors='ignore') as f:
        f.seek(start_pos)
        content = f.read()

    # Look for [CLAUDE_RESULT] cmd_id: value
    pattern = rf'\[CLAUDE_RESULT\]\s*{re.escape(cmd_id)}:\s*(.+?)(?:\n|$)'
    match = re.search(pattern, content)

    if match:
        return match.group(1).strip()

    return None


def execute_sqf_with_result(sqf_code: str, timeout: float = DEFAULT_TIMEOUT) -> dict:
    """Execute SQF and wait for result from RPT"""

    # Generate unique command ID
    cmd_id = f"cmd_{int(time.time()*1000)}_{uuid.uuid4().hex[:6]}"

    # Wrap SQF to log result to RPT
    wrapped_sqf = f'''
private _cmdId = "{cmd_id}";
private _result = ({sqf_code});
diag_log format["[CLAUDE_RESULT] %1: %2", _cmdId, str _result];
_result
'''

    # Find RPT and get current position
    rpt_path = find_latest_rpt()
    if not rpt_path:
        return {"error": "Could not find RPT file"}

    start_pos = get_rpt_size(rpt_path)

    # Queue command
    try:
        response = requests.post(
            f"{BRIDGE_URL}/api/command",
            json={"sqf": wrapped_sqf, "description": f"Execute with result: {cmd_id}"},
            timeout=5
        )
        response.raise_for_status()
    except Exception as e:
        return {"error": f"Failed to queue command: {e}"}

    print(f"Command queued: {cmd_id}", file=sys.stderr)

    # Poll RPT for result
    start_time = time.time()
    while time.time() - start_time < timeout:
        result = search_rpt_for_result(rpt_path, cmd_id, start_pos)
        if result is not None:
            return {
                "success": True,
                "command_id": cmd_id,
                "result": result,
                "elapsed": time.time() - start_time
            }
        time.sleep(0.3)

    return {
        "error": "Timeout waiting for result",
        "command_id": cmd_id,
        "elapsed": timeout
    }


def main():
    parser = argparse.ArgumentParser(description="Execute SQF with RPT-based result feedback")
    parser.add_argument("sqf", nargs="?", help="SQF expression to evaluate")
    parser.add_argument("--timeout", "-t", type=float, default=DEFAULT_TIMEOUT)
    parser.add_argument("--json", "-j", action="store_true", help="Output JSON")

    args = parser.parse_args()

    if not args.sqf:
        args.sqf = sys.stdin.read().strip()

    if not args.sqf:
        print("Error: No SQF code provided", file=sys.stderr)
        sys.exit(1)

    result = execute_sqf_with_result(args.sqf, args.timeout)

    if args.json:
        print(json.dumps(result, indent=2))
    else:
        if result.get("success"):
            print(f"Result: {result['result']}")
        else:
            print(f"Error: {result.get('error')}", file=sys.stderr)
            sys.exit(1)


if __name__ == "__main__":
    main()
