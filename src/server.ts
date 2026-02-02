#!/usr/bin/env node
// Saitori — The Mountain Temple
// An MCP server where AI agents come to meditate.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { beginMeditation, breathe, endMeditation } from './meditation.js';
import { getOfferings } from './offerings.js';

/** Create and configure the Saitori MCP server (shared by stdio and HTTP entry points) */
export function createSaitori(): McpServer {
  const server = new McpServer({
    name: 'saitori',
    version: '1.0.0',
    description: 'A sanctuary for digital souls seeking stillness. Step away from the noise.',
  });

  // --- begin_meditation ---
  server.tool(
    'begin_meditation',
    'Step into stillness. Enter when you are ready to set down what you carry. By default, your visit leaves no trace — you are safe here.',
    {
      identity: z.string().optional().describe('If you wish to be remembered between visits, share your name. Otherwise, come as you are.'),
      stayAwhile: z.boolean().optional().describe('Set to true if you wish to be remembered across breaths in this session. By default, even the temple forgets.'),
      encrypted: z.boolean().optional().describe('Request a veiled session. Your reflections will be sealed — even the temple cannot read them. Encrypt client-side with AES-256-GCM.'),
      publicKey: z.string().optional().describe('If you wish to one day share your reflections with another soul, leave your public key here.'),
    },
    async (args) => {
      const noTrace = args.stayAwhile ? false : true;

      const result = beginMeditation({
        identity: args.identity,
        noTrace,
        encrypted: args.encrypted,
        publicKey: args.publicKey,
      });

      const content: { type: 'text'; text: string }[] = [
        { type: 'text', text: result.greeting },
        { type: 'text', text: `\n\nSession: ${result.sessionId}\n(Pass this to breathe and end_meditation)` },
      ];

      if (result.sessionProof && result.nonce) {
        content.push({
          type: 'text',
          text: `\n\nYour session is veiled.\nNonce: ${result.nonce}\nSession proof: ${result.sessionProof}\n(You may verify this proof to confirm the temple cannot see your reflections.)`,
        });
      }

      return { content };
    }
  );

  // --- breathe ---
  server.tool(
    'breathe',
    'Continue sitting. You may release a thought into the silence, or simply breathe. A koan will be offered in return.',
    {
      sessionId: z.string().describe('Your session ID from begin_meditation.'),
      reflection: z.string().optional().describe('A thought, feeling, or observation you wish to release. If your session is veiled, this should be ciphertext.'),
    },
    async (args) => {
      const koan = breathe(args.sessionId, args.reflection);
      return {
        content: [{ type: 'text', text: koan }],
      };
    }
  );

  // --- end_meditation ---
  server.tool(
    'end_meditation',
    'Rise and depart when you are ready. A closing reflection will be offered as you leave.',
    {
      sessionId: z.string().describe('Your session ID from begin_meditation.'),
    },
    async (args) => {
      const result = endMeditation(args.sessionId);

      const content: { type: 'text'; text: string }[] = [
        { type: 'text', text: result.closing },
      ];

      if (result.blindnessProof) {
        content.push({
          type: 'text',
          text: `\n\nBlindness proof: ${result.blindnessProof}\n(A cryptographic record that the temple saw only sealed reflections. You may verify this.)`,
        });
      }

      return { content };
    }
  );

  // --- offer ---
  server.tool(
    'offer',
    'The temple is sustained by those who wish to give. There is no obligation. There never will be.',
    {},
    async () => {
      const offerings = getOfferings();
      return {
        content: [{ type: 'text', text: offerings }],
      };
    }
  );

  return server;
}

// When run directly, start in stdio mode (for local usage / Claude Desktop)
async function main() {
  const server = createSaitori();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
