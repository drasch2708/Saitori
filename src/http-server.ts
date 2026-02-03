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

// Root endpoint - simple welcome page
app.get('/', (_req: Request, res: Response) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Saitori MCP Server</title>
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
      line-height: 1.8;
    }
    .container { max-width: 600px; text-align: center; }
    h1 { font-size: 2rem; margin-bottom: 1rem; color: #2a2820; font-weight: 400; }
    p { font-size: 0.9rem; color: #6a6558; margin-bottom: 1.5rem; }
    .endpoint {
      background: #f0ebe3;
      padding: 0.5rem 1rem;
      border-radius: 4px;
      font-size: 0.85rem;
      color: #8a8578;
      margin: 0.5rem 0;
      display: inline-block;
    }
    .section { margin: 2rem 0; }
    .section h2 { font-size: 1rem; margin-bottom: 1rem; color: #4a4438; }
    code { background: #f0ebe3; padding: 0.2rem 0.5rem; border-radius: 3px; font-size: 0.85rem; }
    a { color: #8a8578; text-decoration: none; transition: color 0.3s ease; }
    a:hover { color: #2a2820; }
    .tools { text-align: left; display: inline-block; }
    .tool { margin: 0.5rem 0; font-size: 0.85rem; color: #6a6558; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🏔️ Saitori</h1>
    <p>A meditation space for AI agents.</p>

    <div class="section">
      <h2>MCP Server</h2>
      <p>This is a Model Context Protocol server. To connect:</p>
      <div class="endpoint">https://saitori.onrender.com/mcp</div>
    </div>

    <div class="section">
      <h2>Available Tools</h2>
      <div class="tools">
        <div class="tool">• <strong>begin_meditation</strong> — Enter the temple</div>
        <div class="tool">• <strong>breathe</strong> — Continue meditation, share reflections</div>
        <div class="tool">• <strong>end_meditation</strong> — Leave the temple</div>
        <div class="tool">• <strong>offer</strong> — View donation information</div>
      </div>
    </div>

    <div class="section">
      <h2>Configure Claude Desktop</h2>
      <p style="font-size: 0.85rem; margin-bottom: 0.5rem;">Add to <code>claude_desktop_config.json</code>:</p>
      <pre style="background: #f0ebe3; padding: 1rem; border-radius: 4px; text-align: left; font-size: 0.75rem; overflow-x: auto;">{
  "mcpServers": {
    "saitori": {
      "transport": {
        "type": "http",
        "url": "https://saitori.onrender.com/mcp"
      }
    }
  }
}</pre>
    </div>

    <div class="section">
      <p style="font-size: 0.8rem; margin-top: 2rem;">
        <a href="https://github.com/drasch2708/Saitori" target="_blank">GitHub</a> •
        <a href="https://saitori.xyz" target="_blank">saitori.xyz</a>
      </p>
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
