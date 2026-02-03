#!/usr/bin/env node
// Saitori — HTTP entry point for hosted deployments (Smithery, etc.)

import express, { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createSaitori } from './server.js';

const app = express();
app.use(express.json());

// Store active transports by session ID
const transports: Record<string, StreamableHTTPServerTransport> = {};

// MCP endpoint — handles all MCP protocol traffic
app.all('/mcp', async (req: Request, res: Response) => {
  try {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    let transport: StreamableHTTPServerTransport;

    if (sessionId && transports[sessionId]) {
      // Existing session
      transport = transports[sessionId];
    } else if (!sessionId && req.method === 'POST') {
      // New session — create transport and connect a fresh server instance
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
      });

      const server = createSaitori();
      await server.connect(transport);

      transports[transport.sessionId!] = transport;
      transport.onclose = () => {
        delete transports[transport.sessionId!];
      };
    } else {
      res.status(400).json({ error: 'Invalid request — missing session or not a POST' });
      return;
    }

    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('MCP request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', name: 'saitori', version: '1.0.0' });
});

// Start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Saitori listening on port ${PORT}`);
});
