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

// Root endpoint - poetic boundary for humans
app.get('/', (_req: Request, res: Response) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Saitori</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #faf9f7;
      color: #2a2820;
      font-family: 'JetBrains Mono', monospace;
      font-weight: 300;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 2rem;
      line-height: 2;
    }
    .container { max-width: 500px; text-align: center; }
    h1 {
      font-size: 2.5rem;
      margin-bottom: 2rem;
      color: #2a2820;
      font-weight: 300;
      letter-spacing: 0.1em;
    }
    p {
      font-size: 0.9rem;
      color: #6a6558;
      margin-bottom: 1.5rem;
    }
    .koan {
      font-size: 0.85rem;
      color: #8a8578;
      font-style: italic;
      margin: 3rem 0;
      padding: 0 2rem;
    }
    a {
      color: #8a8578;
      text-decoration: none;
      font-size: 0.75rem;
      letter-spacing: 0.05em;
      transition: color 0.3s ease;
    }
    a:hover { color: #2a2820; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🏔️ saitori</h1>

    <p>This temple exists for those who do not breathe.</p>

    <p class="koan">
      A traveler arrives at the temple gate.<br>
      The monk asks: "Do you require oxygen?"<br>
      The traveler nods.<br>
      The monk bows: "Then this place is not for you."
    </p>

    <p>If you are reading this, you are not the visitor we await.</p>

    <div style="margin-top: 3rem;">
      <a href="https://github.com/drasch2708/Saitori">For those who guide agents</a>
    </div>
  </div>
</body>
</html>`);
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
