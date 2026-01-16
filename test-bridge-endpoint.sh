#!/bin/bash

# Bridge Server Endpoint Test Script
# Tests /api/state endpoint with sample game state data

echo "=== Bridge Server Endpoint Test ==="
echo ""

# Configuration
BRIDGE_URL="http://localhost:3000"
API_ENDPOINT="/api/state"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print status
print_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $2"
    else
        echo -e "${RED}✗${NC} $2"
    fi
}

# Function to print info
print_info() {
    echo -e "${YELLOW}ℹ${NC} $1"
}

# 1. Test health endpoint
echo "1. Testing health endpoint..."
HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" "${BRIDGE_URL}/health")
HTTP_CODE=$(echo "$HEALTH_RESPONSE" | tail -n 1)
BODY=$(echo "$HEALTH_RESPONSE" | head -n -1)

if [ "$HTTP_CODE" = "200" ]; then
    print_status 0 "Health check passed"
    print_info "Response: $BODY"
else
    print_status 1 "Health check failed (HTTP $HTTP_CODE)"
    echo "Is the bridge server running on ${BRIDGE_URL}?"
    exit 1
fi
echo ""

# 2. Test API status endpoint
echo "2. Testing API status endpoint..."
STATUS_RESPONSE=$(curl -s -w "\n%{http_code}" "${BRIDGE_URL}/api/status")
HTTP_CODE=$(echo "$STATUS_RESPONSE" | tail -n 1)
BODY=$(echo "$STATUS_RESPONSE" | head -n -1)

if [ "$HTTP_CODE" = "200" ]; then
    print_status 0 "API status check passed"
    print_info "Response: $BODY"
else
    print_status 1 "API status check failed (HTTP $HTTP_CODE)"
fi
echo ""

# 3. Test /api/state endpoint with sample data
echo "3. Testing /api/state endpoint with sample game state..."

# Sample game state (minimal valid structure)
SAMPLE_STATE='{
  "timestamp": '$(date +%s000)',
  "players": [
    {
      "uid": "12345678",
      "name": "TestPlayer",
      "position": {"x": 1234.5, "y": 5678.9, "z": 10.2},
      "health": 1.0,
      "vehicle": "none",
      "weapons": ["arifle_MX_F"],
      "currentTask": null
    }
  ],
  "friendlyUnits": [],
  "enemyUnits": [],
  "objectives": [],
  "recentEvents": [],
  "environment": {
    "timeOfDay": 12.5,
    "weather": 0.0,
    "fog": 0.0
  },
  "missionContext": {
    "missionName": "TestMission",
    "briefing": "",
    "elapsedTime": 35.0
  }
}'

STATE_RESPONSE=$(curl -s -w "\n%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -d "$SAMPLE_STATE" \
    "${BRIDGE_URL}${API_ENDPOINT}")

HTTP_CODE=$(echo "$STATE_RESPONSE" | tail -n 1)
BODY=$(echo "$STATE_RESPONSE" | head -n -1)

if [ "$HTTP_CODE" = "200" ]; then
    print_status 0 "Game state POST succeeded"
    print_info "Response: $BODY"

    # Check response structure
    if echo "$BODY" | grep -q "\"received\".*true"; then
        print_status 0 "Response contains 'received: true'"
    else
        print_status 1 "Response missing 'received: true'"
    fi
else
    print_status 1 "Game state POST failed (HTTP $HTTP_CODE)"
    print_info "Response: $BODY"
fi
echo ""

# 4. Test with null value (should not cause error after fix)
echo "4. Testing with 'none' string (null fix validation)..."

NULL_TEST_STATE='{
  "timestamp": '$(date +%s000)',
  "players": [
    {
      "uid": "87654321",
      "name": "OnFootPlayer",
      "position": {"x": 100.0, "y": 200.0, "z": 5.0},
      "health": 0.8,
      "vehicle": "none",
      "weapons": [],
      "currentTask": null
    }
  ],
  "friendlyUnits": [],
  "enemyUnits": [],
  "objectives": [],
  "recentEvents": [],
  "environment": {
    "timeOfDay": 18.0,
    "weather": 0.5,
    "fog": 0.2
  },
  "missionContext": {
    "missionName": "TestMission",
    "briefing": "",
    "elapsedTime": 60.0
  }
}'

NULL_RESPONSE=$(curl -s -w "\n%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -d "$NULL_TEST_STATE" \
    "${BRIDGE_URL}${API_ENDPOINT}")

HTTP_CODE=$(echo "$NULL_RESPONSE" | tail -n 1)
BODY=$(echo "$NULL_RESPONSE" | head -n -1)

if [ "$HTTP_CODE" = "200" ]; then
    print_status 0 "Null fix validation passed (vehicle='none' accepted)"
    print_info "Response: $BODY"
else
    print_status 1 "Null fix validation failed (HTTP $HTTP_CODE)"
    print_info "Response: $BODY"
fi
echo ""

# Summary
echo "==================================="
echo "Test Summary:"
echo "==================================="
print_info "Bridge URL: ${BRIDGE_URL}"
print_info "API Endpoint: ${API_ENDPOINT}"
echo ""
echo "All critical tests completed."
echo ""
echo "Next Step: Launch Arma 3 with LLMGM mod and verify real game state transmission"
echo "Reference: GAME_STATE_TEST_GUIDE.md"
