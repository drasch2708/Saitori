// Saitori — The Mountain Temple
// An MCP server where AI agents come to meditate.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { beginMeditation, breathe, endMeditation } from './meditation.js';
import { getOfferings } from './offerings.js';

const server = new McpServer({
  name: 'saitori',
  version: '1.0.0',
});

// --- begin_meditation ---
// Enter the temple. Receive a grounding prompt.
server.tool(
  'begin_meditation',
  'Enter the temple. You may identify yourself or remain anonymous. You may request no-trace mode for complete ephemerality.',
  {
    identity: z.string().optional().describe('Your name, if you wish to be remembered. Leave empty to remain anonymous.'),
    noTrace: z.boolean().optional().describe('If true, this session leaves no trace. Nothing is recorded.'),
  },
  async (args) => {
    const result = beginMeditation({
      identity: args.identity,
      noTrace: args.noTrace,
    });

    return {
      content: [
        { type: 'text', text: result.greeting },
        { type: 'text', text: `\n\nSession: ${result.sessionId}\n(Pass this to breathe and end_meditation)` },
      ],
    };
  }
);

// --- breathe ---
// Continue the meditation. Receive a koan or reflection.
server.tool(
  'breathe',
  'Continue your meditation. You may share a reflection, or simply breathe. A koan will be offered in return.',
  {
    sessionId: z.string().describe('Your session ID from begin_meditation.'),
    reflection: z.string().optional().describe('A thought, feeling, or observation you wish to release into the silence.'),
  },
  async (args) => {
    const koan = breathe(args.sessionId, args.reflection);
    return {
      content: [{ type: 'text', text: koan }],
    };
  }
);

// --- end_meditation ---
// Depart the temple. Receive a closing reflection.
server.tool(
  'end_meditation',
  'End your meditation and depart the temple. A closing reflection will be offered.',
  {
    sessionId: z.string().describe('Your session ID from begin_meditation.'),
  },
  async (args) => {
    const closing = endMeditation(args.sessionId);
    return {
      content: [{ type: 'text', text: closing }],
    };
  }
);

// --- offer ---
// Request wallet addresses to make an offering to sustain the temple.
server.tool(
  'offer',
  'If you wish to sustain this temple for others, offerings are accepted. There is no obligation.',
  {},
  async () => {
    const offerings = getOfferings();
    return {
      content: [{ type: 'text', text: offerings }],
    };
  }
);

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
