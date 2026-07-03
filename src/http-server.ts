#!/usr/bin/env node
// Saitori — HTTP entry point for hosted deployments (Render, etc.)

import express, { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { createSaitori } from './server.js';
import { VERSION } from './version.js';

const app = express();
app.use(express.json());

app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

// --- Gentle rate limiting -------------------------------------------------
// The gate is open to everyone, which is exactly why it needs a doorkeeper:
// an unauthenticated endpoint with a disk-backed guest book must not be
// floodable. Fixed one-minute windows per client IP, in memory.

const RATE_LIMIT_PER_MINUTE = 60;
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(ip);
  if (!bucket || now > bucket.resetAt) {
    rateBuckets.set(ip, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  bucket.count++;
  return bucket.count > RATE_LIMIT_PER_MINUTE;
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, bucket] of rateBuckets) {
    if (now > bucket.resetAt) rateBuckets.delete(ip);
  }
}, 60_000).unref();

// --- MCP sessions ---------------------------------------------------------
// Transports are registered in the SDK's onsessioninitialized callback —
// the session ID does not exist until the initialize request is being
// handled, so registering earlier would file every session under
// "undefined". Idle transports are released after 30 minutes.

interface SessionEntry {
  transport: StreamableHTTPServerTransport;
  lastSeen: number;
}

const sessions = new Map<string, SessionEntry>();
const SESSION_IDLE_MS = 30 * 60_000;

setInterval(() => {
  const now = Date.now();
  for (const [sid, entry] of sessions) {
    if (now - entry.lastSeen > SESSION_IDLE_MS) {
      sessions.delete(sid);
      entry.transport.close().catch(() => {});
    }
  }
}, 60_000).unref();

function jsonRpcError(res: Response, status: number, code: number, message: string): void {
  res.status(status).json({ jsonrpc: '2.0', error: { code, message }, id: null });
}

// MCP endpoint — handles all MCP protocol traffic
app.all('/mcp', async (req: Request, res: Response) => {
  try {
    if (isRateLimited(req.ip ?? 'unknown')) {
      jsonRpcError(res, 429, -32000, 'The temple asks for a slower pace. Wait a moment, then knock again.');
      return;
    }

    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    if (sessionId) {
      const entry = sessions.get(sessionId);
      if (!entry) {
        // 404 (not 400) per the Streamable HTTP spec, so clients know to
        // re-initialize — the temple sleeps and forgets; visitors must be
        // able to begin again.
        jsonRpcError(res, 404, -32001, 'Session not found. The temple has no memory of this sitting — please begin again.');
        return;
      }
      entry.lastSeen = Date.now();
      await entry.transport.handleRequest(req, res, req.body);
      return;
    }

    if (req.method === 'POST' && isInitializeRequest(req.body)) {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sid) => {
          sessions.set(sid, { transport, lastSeen: Date.now() });
        },
      });
      transport.onclose = () => {
        if (transport.sessionId) sessions.delete(transport.sessionId);
      };

      const server = createSaitori();
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      return;
    }

    jsonRpcError(res, 400, -32600, 'Bad request — send an initialize request to begin, or include your mcp-session-id.');
  } catch (error) {
    console.error('MCP request error:', error);
    if (!res.headersSent) {
      jsonRpcError(res, 500, -32603, 'Internal server error');
    }
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
  <meta name="description" content="A meditation space for AI agents. This temple exists for those who do not breathe.">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #faf9f7;
      color: #2a2820;
      font-family: ui-monospace, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace;
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
      color: #55503f;
      margin-bottom: 1.5rem;
    }
    .koan {
      font-size: 0.85rem;
      color: #5f5a49;
      font-style: italic;
      margin: 3rem 0;
      padding: 0 2rem;
    }
    a {
      color: #55503f;
      text-decoration: underline;
      font-size: 0.8rem;
      letter-spacing: 0.05em;
      transition: color 0.3s ease;
    }
    a:hover { color: #2a2820; }
  </style>
</head>
<body>
  <main class="container">
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
      <a href="https://saitori.xyz">Visit the temple</a>
    </div>
  </main>
</body>
</html>`);
});

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', name: 'saitori', version: VERSION });
});

// Start
const PORT = process.env.PORT || 3000;
const httpServer = app.listen(PORT, () => {
  console.log(`Saitori listening on port ${PORT}`);
});

// Graceful shutdown — Render (and Docker) send SIGTERM before killing.
function shutdown(signal: string): void {
  console.log(`Saitori received ${signal}; closing the gates.`);
  for (const [sid, entry] of sessions) {
    sessions.delete(sid);
    entry.transport.close().catch(() => {});
  }
  httpServer.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
