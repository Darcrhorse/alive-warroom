#!/bin/bash

# Test Claude API Integration
# Verifies Anthropic SDK v0.71.2 can call Claude API and receive valid responses

set -e

echo "=== Claude API Integration Test Runner ==="
echo ""

# Check if we're in the bridge directory
if [ ! -f "package.json" ]; then
  echo "Error: Must run from bridge/ directory"
  exit 1
fi

# Check for .env file
if [ ! -f ".env" ]; then
  echo "Warning: .env file not found"
  echo "Please create .env with CLAUDE_API_KEY=your_key_here"
  echo ""
  read -p "Do you want to continue anyway? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# Check for CLAUDE_API_KEY
if [ -z "$CLAUDE_API_KEY" ]; then
  echo "CLAUDE_API_KEY not set in environment"
  if [ -f ".env" ]; then
    echo "Loading from .env file..."
    export $(cat .env | grep CLAUDE_API_KEY | xargs)
  fi
fi

if [ -z "$CLAUDE_API_KEY" ]; then
  echo "❌ CLAUDE_API_KEY is required"
  echo "Set it in .env file or environment: export CLAUDE_API_KEY=your_key_here"
  exit 1
fi

echo "✓ CLAUDE_API_KEY found"
echo ""

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

# Run the test
echo "Running Claude API integration test..."
echo ""
npx ts-node tests/test-claude-api.ts

echo ""
echo "Test complete!"
