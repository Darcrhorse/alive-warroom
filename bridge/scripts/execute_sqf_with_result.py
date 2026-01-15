#!/usr/bin/env python3
"""
Execute SQF with Result Feedback

This script:
1. Queues an SQF command to the bridge
2. Polls for the execution result
3. Returns the result

Usage:
    python execute_sqf_with_result.py "hint 'hello'; 42"
    python execute_sqf_with_result.py --file script.sqf
    python execute_sqf_with_result.py --timeout 30 "some sqf code"
"""

import argparse
import json
import sys
import time
import requests

BRIDGE_URL = "http://localhost:3000"
DEFAULT_TIMEOUT = 15  # seconds
POLL_INTERVAL = 0.5   # seconds


def queue_command(sqf: str, description: str = None) -> dict:
    """Queue an SQF command and get the command ID"""
    try:
        response = requests.post(
            f"{BRIDGE_URL}/api/command",
            json={
                "sqf": sqf,
                "description": description or "Execute SQF with result"
            },
            timeout=5
        )
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        return {"error": f"Failed to queue command: {e}"}


def poll_result(command_id: str, timeout: float = DEFAULT_TIMEOUT) -> dict:
    """Poll for command result until complete or timeout"""
    start_time = time.time()

    while time.time() - start_time < timeout:
        try:
            response = requests.get(
                f"{BRIDGE_URL}/api/result/{command_id}",
                timeout=5
            )

            if response.status_code == 404:
                return {"error": "Command not found or expired", "status": "not_found"}

            response.raise_for_status()
            data = response.json()

            if data.get("status") == "complete":
                return {
                    "success": True,
                    "result": data.get("result"),
                    "command_id": command_id,
                    "elapsed": time.time() - start_time
                }
            elif data.get("status") == "error":
                return {
                    "success": False,
                    "error": data.get("error"),
                    "command_id": command_id,
                    "elapsed": time.time() - start_time
                }

            # Still pending, wait and poll again
            time.sleep(POLL_INTERVAL)

        except requests.exceptions.RequestException as e:
            return {"error": f"Failed to poll result: {e}"}

    return {
        "error": "Timeout waiting for result",
        "status": "timeout",
        "command_id": command_id,
        "elapsed": timeout
    }


def execute_sqf(sqf: str, description: str = None, timeout: float = DEFAULT_TIMEOUT) -> dict:
    """Execute SQF and wait for result"""
    # Step 1: Queue the command
    queue_result = queue_command(sqf, description)

    if "error" in queue_result:
        return queue_result

    command_id = queue_result.get("commandId")
    if not command_id:
        return {"error": "No command ID returned from bridge"}

    print(f"Command queued: {command_id}", file=sys.stderr)

    # Step 2: Poll for result
    return poll_result(command_id, timeout)


def main():
    parser = argparse.ArgumentParser(description="Execute SQF with result feedback")
    parser.add_argument("sqf", nargs="?", help="SQF code to execute")
    parser.add_argument("--file", "-f", help="Read SQF from file")
    parser.add_argument("--timeout", "-t", type=float, default=DEFAULT_TIMEOUT,
                       help=f"Timeout in seconds (default: {DEFAULT_TIMEOUT})")
    parser.add_argument("--description", "-d", help="Description of the command")
    parser.add_argument("--json", "-j", action="store_true", help="Output raw JSON")

    args = parser.parse_args()

    # Get SQF code
    if args.file:
        with open(args.file, 'r') as f:
            sqf = f.read()
    elif args.sqf:
        sqf = args.sqf
    else:
        # Read from stdin
        sqf = sys.stdin.read()

    if not sqf.strip():
        print("Error: No SQF code provided", file=sys.stderr)
        sys.exit(1)

    # Execute
    result = execute_sqf(sqf, args.description, args.timeout)

    if args.json:
        print(json.dumps(result, indent=2))
    else:
        if result.get("success"):
            print(f"Result: {result.get('result')}")
        elif result.get("error"):
            print(f"Error: {result.get('error')}", file=sys.stderr)
            sys.exit(1)
        else:
            print(json.dumps(result, indent=2))

    sys.exit(0 if result.get("success") else 1)


if __name__ == "__main__":
    main()
