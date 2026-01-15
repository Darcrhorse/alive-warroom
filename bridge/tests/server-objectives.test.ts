/**
 * Tests for /api/objectives/status endpoint
 */

import { BridgeServer } from '../src/server';
import { configManager } from '../src/config/settings';

describe('BridgeServer - /api/objectives/status', () => {
  let server: BridgeServer;
  let baseUrl: string;

  beforeAll(() => {
    // Initialize configuration with minimal settings
    configManager.updateConfig({
      server: {
        port: 3001,
        host: 'localhost',
        enableWebSocket: false,
        enableREST: true,
        corsOrigins: ['*']
      },
      llm: {
        provider: 'openai',
        model: 'gpt-4',
        maxTokens: 1000,
        temperature: 0.7
      }
    });

    server = new BridgeServer();
    server.start(3001, 'localhost');
    baseUrl = 'http://localhost:3001';
  });

  afterAll(() => {
    server.stop();
  });

  it('should accept valid objective status update with all fields', async () => {
    const response = await fetch(`${baseUrl}/api/objectives/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        objectiveId: 'obj_001',
        status: 'COMPLETE',
        progress: 100,
        data: { completedBy: 'player1' }
      })
    });

    expect(response.status).toBe(200);
    const result = await response.json() as { received: boolean; objectiveId: string; status: string; timestamp: number };
    expect(result.received).toBe(true);
    expect(result.objectiveId).toBe('obj_001');
    expect(result.status).toBe('COMPLETE');
    expect(result.timestamp).toBeDefined();
  });

  it('should accept valid objective status update with minimal fields', async () => {
    const response = await fetch(`${baseUrl}/api/objectives/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        objectiveId: 'obj_002',
        status: 'ACTIVE'
      })
    });

    expect(response.status).toBe(200);
    const result = await response.json() as { received: boolean; objectiveId: string; status: string };
    expect(result.received).toBe(true);
    expect(result.objectiveId).toBe('obj_002');
    expect(result.status).toBe('ACTIVE');
  });

  it('should reject request without objectiveId', async () => {
    const response = await fetch(`${baseUrl}/api/objectives/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        status: 'COMPLETE'
      })
    });

    expect(response.status).toBe(400);
    const result = await response.json() as { error: string };
    expect(result.error).toBe('Missing required fields');
  });

  it('should reject request without status', async () => {
    const response = await fetch(`${baseUrl}/api/objectives/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        objectiveId: 'obj_003'
      })
    });

    expect(response.status).toBe(400);
    const result = await response.json() as { error: string };
    expect(result.error).toBe('Missing required fields');
  });

  it('should reject invalid status value', async () => {
    const response = await fetch(`${baseUrl}/api/objectives/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        objectiveId: 'obj_004',
        status: 'INVALID_STATUS'
      })
    });

    expect(response.status).toBe(400);
    const result = await response.json() as { error: string; message: string };
    expect(result.error).toBe('Invalid status');
    expect(result.message).toContain('ACTIVE');
    expect(result.message).toContain('COMPLETE');
    expect(result.message).toContain('FAILED');
    expect(result.message).toContain('EXPIRED');
    expect(result.message).toContain('PROGRESS');
  });

  it('should accept all valid status values', async () => {
    const validStatuses = ['ACTIVE', 'COMPLETE', 'FAILED', 'EXPIRED', 'PROGRESS'];
    
    for (const status of validStatuses) {
      const response = await fetch(`${baseUrl}/api/objectives/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          objectiveId: `obj_${status}`,
          status
        })
      });

      expect(response.status).toBe(200);
      const result = await response.json() as { status: string };
      expect(result.status).toBe(status);
    }
  });

  it('should accept progress field', async () => {
    const response = await fetch(`${baseUrl}/api/objectives/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        objectiveId: 'obj_005',
        status: 'PROGRESS',
        progress: 75
      })
    });

    expect(response.status).toBe(200);
    const result = await response.json() as { received: boolean };
    expect(result.received).toBe(true);
  });

  it('should accept data field with custom information', async () => {
    const response = await fetch(`${baseUrl}/api/objectives/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        objectiveId: 'obj_006',
        status: 'FAILED',
        data: {
          reason: 'Time expired',
          remainingUnits: 3
        }
      })
    });

    expect(response.status).toBe(200);
    const result = await response.json() as { received: boolean };
    expect(result.received).toBe(true);
  });
});
