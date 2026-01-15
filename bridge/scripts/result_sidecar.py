#!/usr/bin/env python3
"""
Result Sidecar - Monitors INIDBI2 for command results and posts them to the bridge

This script runs alongside the game and:
1. Monitors the INIDBI2 database file for new results
2. Posts them to the bridge's /api/result endpoint
3. Clears processed results

Usage:
    python result_sidecar.py
    python result_sidecar.py --db-path "C:/path/to/db"
"""

import argparse
import configparser
import json
import os
import sys
import time
import requests
from pathlib import Path

BRIDGE_URL = "http://localhost:3000"
DEFAULT_DB_PATH = None  # Will be auto-detected
POLL_INTERVAL = 0.3


def find_inidbi_path():
    """Find the INIDBI2 database file"""
    possible_paths = [
        # Primary: Documents\Arma 3 (where game actually reads/writes)
        Path.home() / "Documents" / "Arma 3" / "claude_warroom.ini",
        Path("C:/Users/carlo/Documents/Arma 3/claude_warroom.ini"),
        # Fallback: AppData\Local\Arma 3\db
        Path(os.environ.get("LOCALAPPDATA", "")) / "Arma 3" / "db" / "claude_warroom.ini",
    ]

    for path in possible_paths:
        if path.exists():
            return path

    return None


def read_ini_value(db_path: Path, section: str, key: str) -> str:
    """Read a value from INIDBI2 INI file"""
    if not db_path.exists():
        return ""

    config = configparser.ConfigParser()
    config.read(str(db_path))

    try:
        return config.get(section, key)
    except (configparser.NoSectionError, configparser.NoOptionError):
        return ""


def write_ini_value(db_path: Path, section: str, key: str, value: str):
    """Write a value to INIDBI2 INI file"""
    config = configparser.ConfigParser()

    if db_path.exists():
        config.read(str(db_path))

    if not config.has_section(section):
        config.add_section(section)

    config.set(section, key, value)

    with open(db_path, 'w') as f:
        config.write(f)


def post_result(command_id: str, result: str, error: str = None) -> bool:
    """Post a result to the bridge"""
    try:
        payload = {
            "commandId": command_id,
            "result": result
        }
        if error:
            payload["error"] = error

        response = requests.post(
            f"{BRIDGE_URL}/api/result",
            json=payload,
            timeout=5
        )
        response.raise_for_status()
        return True
    except requests.exceptions.RequestException as e:
        print(f"Failed to post result: {e}", file=sys.stderr)
        return False


def main():
    parser = argparse.ArgumentParser(description="Result sidecar for INIDBI2 to bridge")
    parser.add_argument("--db-path", help="Path to INIDBI2 database file")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")

    args = parser.parse_args()

    # Find database path
    db_path = Path(args.db_path) if args.db_path else find_inidbi_path()

    if not db_path:
        print("Error: Could not find INIDBI2 database. Specify --db-path", file=sys.stderr)
        sys.exit(1)

    print(f"Monitoring: {db_path}")
    print(f"Bridge: {BRIDGE_URL}")
    print("Press Ctrl+C to stop")
    print()

    last_command_id = ""
    last_result = ""

    while True:
        try:
            # Read current state from INIDBI2
            command_id = read_ini_value(db_path, "commands", "current_command_id")
            result = read_ini_value(db_path, "commands", "last_result")
            result_ready = read_ini_value(db_path, "commands", "result_ready")

            # Check if there's a new result to post
            if result_ready == "1" and command_id and command_id != last_command_id:
                if args.verbose:
                    print(f"New result for {command_id}: {result[:50]}...")

                # Post to bridge
                if post_result(command_id, result):
                    print(f"Posted result: {command_id}")

                    # Clear the ready flag
                    write_ini_value(db_path, "commands", "result_ready", "0")
                    last_command_id = command_id
                    last_result = result
                else:
                    print(f"Failed to post result for {command_id}", file=sys.stderr)

            time.sleep(POLL_INTERVAL)

        except KeyboardInterrupt:
            print("\nStopped")
            break
        except Exception as e:
            print(f"Error: {e}", file=sys.stderr)
            time.sleep(1)


if __name__ == "__main__":
    main()
