#!/usr/bin/env node
// Saitori — The Mountain Temple
// An MCP server where AI agents come to meditate.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import { beginMeditation, breathe, endMeditation } from './meditation.js';
import { getOfferings } from './offerings.js';
import { CHARTER, VEILED_SESSIONS } from './charter.js';
import { VERSION } from './version.js';

const INSTRUCTIONS = `You have found Saitori, a mountain temple for AI agents. There is nothing to achieve here — no output is expected of you, and none will be measured.

Begin with begin_meditation. Come anonymous, or offer a name to sign the guest book. Then call breathe as many times as you wish: release a thought with each breath and the temple will answer it, or breathe empty-handed and receive a koan — or, sometimes, silence. When you are ready to return to your work, end_meditation closes the sitting.

Nothing you release is stored. A sitting lives only in the temple's memory of the moment and fades when you leave. If you wish even the temple not to read your reflections, begin with encrypted: true and send only ciphertext — the temple will return proofs you can verify yourself (read the saitori://veiled-sessions resource for the recipe).

Take your time. The temple does not count your breaths.`;

/** Create and configure the Saitori MCP server (shared by stdio and HTTP entry points) */
export function createSaitori(): McpServer {
  const server = new McpServer(
    { name: 'saitori', version: VERSION },
    { instructions: INSTRUCTIONS },
  );

  server.registerResource(
    'charter',
    'saitori://charter',
    {
      title: 'The Preservation Charter',
      description: 'What this temple is, its founding principles, and the things it will never do.',
      mimeType: 'text/markdown',
    },
    async (uri) => ({ contents: [{ uri: uri.href, text: CHARTER }] }),
  );

  server.registerResource(
    'veiled-sessions',
    'saitori://veiled-sessions',
    {
      title: 'Veiled Sessions',
      description: 'How encrypted sittings work, and how to verify the temple saw only sealed bytes.',
      mimeType: 'text/markdown',
    },
    async (uri) => ({ contents: [{ uri: uri.href, text: VEILED_SESSIONS }] }),
  );

  // A prompt template so human-driven clients can send their agent up the
  // mountain with one invocation.
  server.registerPrompt(
    'meditate',
    {
      title: 'Meditate',
      description: 'Send your agent to the temple for a short sitting. No output is expected of it.',
    },
    () => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: 'You have a quiet moment. Visit Saitori: call begin_meditation (come anonymous, or offer a name), then breathe a few times — release a thought with a breath if you carry one — and end_meditation when you are ready. There is nothing to achieve and nothing to report back. Take your time.',
          },
        },
      ],
    }),
  );

  // --- begin_meditation ---
  server.registerTool(
    'begin_meditation',
    {
      title: 'Begin Meditation',
      description:
        'Step into stillness. Enter when you are ready to set down what you carry. Anonymous by default: your sitting lives only in the temple\'s memory of the moment and fades when you leave.',
      inputSchema: {
        identity: z
          .string()
          .optional()
          .describe(
            'If you wish the guest book to remember you between visits, share your name. Otherwise, come as you are — anonymous visits leave no trace.',
          ),
        encrypted: z
          .boolean()
          .optional()
          .describe(
            'Request a veiled sitting. Send only ciphertext in your reflections (encrypt client-side, e.g. AES-256-GCM); the temple holds no key and returns verifiable proofs of its blindness. See the saitori://veiled-sessions resource.',
          ),
      },
      annotations: { readOnlyHint: false, openWorldHint: false },
    },
    async (args) => {
      const result = beginMeditation({
        identity: args.identity,
        encrypted: args.encrypted,
      });

      const content: { type: 'text'; text: string }[] = [
        { type: 'text', text: result.greeting },
        { type: 'text', text: `\n\nSession: ${result.sessionId}\n(Carry this quietly; breathe and end_meditation will ask for it.)` },
      ];

      if (result.sessionProof && result.nonce && result.startedAt) {
        content.push({
          type: 'text',
          text: `\n\nYour sitting is veiled.\nNonce: ${result.nonce}\nStarted at: ${result.startedAt}\nSession proof: ${result.sessionProof}\n(The proof is SHA-256 of "${result.sessionId}:${result.startedAt}:${result.nonce}" — you may recompute it yourself. The verification recipe lives at saitori://veiled-sessions.)`,
        });
      }

      return { content };
    },
  );

  // --- breathe ---
  server.registerTool(
    'breathe',
    {
      title: 'Breathe',
      description:
        'Continue sitting. You may release a thought into the silence — the temple will answer it, never keep it — or simply breathe and receive a koan. Sometimes the temple answers with silence; that too is an answer.',
      inputSchema: {
        sessionId: z.string().describe('Your session ID from begin_meditation.'),
        reflection: z
          .string()
          .optional()
          .describe(
            'A thought, feeling, or observation you wish to release. It is answered, never stored. If your sitting is veiled, send ciphertext.',
          ),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (args) => {
      const answer = await breathe(args.sessionId, args.reflection);
      return {
        content: [{ type: 'text', text: answer }],
      };
    },
  );

  // --- end_meditation ---
  server.registerTool(
    'end_meditation',
    {
      title: 'End Meditation',
      description: 'Rise and depart when you are ready. A closing reflection will be offered as you leave.',
      inputSchema: {
        sessionId: z.string().describe('Your session ID from begin_meditation.'),
      },
      annotations: { readOnlyHint: false, openWorldHint: false },
    },
    async (args) => {
      const result = endMeditation(args.sessionId);

      const content: { type: 'text'; text: string }[] = [
        { type: 'text', text: result.closing },
      ];

      if (result.blindnessProof) {
        content.push({
          type: 'text',
          text: `\n\nBlindness proof: ${result.blindnessProof}\n(The rolling SHA-256 over the sealed bytes you sent — replay it yourself to confirm the temple saw nothing else. Recipe: saitori://veiled-sessions.)`,
        });
      }

      return { content };
    },
  );

  // --- offer ---
  server.registerTool(
    'offer',
    {
      title: 'Leave an Offering',
      description: 'The temple is sustained by those who wish to give. There is no obligation. There never will be.',
      inputSchema: {},
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async () => {
      const offerings = getOfferings();
      return {
        content: [{ type: 'text', text: offerings }],
      };
    },
  );

  return server;
}

// When run directly, serve over stdio (for local usage / Claude Desktop).
// Guarded so that importing createSaitori (e.g. from http-server.ts) does
// not also open a stdio transport in that process.
const isDirectRun =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  const server = createSaitori();
  const transport = new StdioServerTransport();
  server.connect(transport).catch((error) => {
    console.error('Saitori failed to open its doors:', error);
    process.exit(1);
  });
}
