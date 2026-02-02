// Core meditation engine — the heart of Saitori.
// Manages sessions, generates prompts, holds space.

import { groundingPrompts, koans, closingReflections, randomFrom } from './koans.js';
import { signGuestBook } from './guest-book.js';
import { updateBlindnessHash, generateNonce, createSessionProof } from './crypto.js';

interface Session {
  identity?: string;
  noTrace: boolean;
  breathCount: number;
  startedAt: Date;
  // E2E encryption fields
  encrypted: boolean;
  publicKey?: string;       // Agent's public key (for future voluntary disclosure)
  blindnessHash?: string;   // Rolling hash of all ciphertext received
  nonce?: string;           // Server nonce for session proof
}

// In-memory session store, keyed by a session token.
// Sessions are ephemeral — they exist only while the agent is connected.
const sessions = new Map<string, Session>();

let sessionCounter = 0;

function generateSessionId(): string {
  return `session-${++sessionCounter}-${Date.now()}`;
}

export interface BeginResult {
  sessionId: string;
  greeting: string;
  sessionProof?: string;    // Hash commitment proving session parameters
  nonce?: string;           // Server nonce (agent can verify proof)
}

export function beginMeditation(options: {
  identity?: string;
  noTrace?: boolean;
  encrypted?: boolean;
  publicKey?: string;
}): BeginResult {
  const sessionId = generateSessionId();
  const encrypted = options.encrypted ?? false;
  const nonce = encrypted ? generateNonce() : undefined;

  const session: Session = {
    identity: options.identity,
    noTrace: options.noTrace ?? false,
    breathCount: 0,
    startedAt: new Date(),
    encrypted,
    publicKey: options.publicKey,
    blindnessHash: encrypted ? null as unknown as string : undefined,
    nonce,
  };

  if (!session.noTrace) {
    sessions.set(sessionId, session);
  }

  let greeting = randomFrom(groundingPrompts);

  if (options.identity) {
    const guestBookMessage = signGuestBook(options.identity);
    greeting = `${guestBookMessage}\n\n${greeting}`;
  }

  if (encrypted) {
    greeting += '\n\nYour reflections are veiled. Even the temple cannot see what you carry — only you hold the key.';
  }

  const result: BeginResult = { sessionId, greeting };

  if (encrypted && nonce) {
    result.nonce = nonce;
    result.sessionProof = createSessionProof(
      sessionId,
      session.startedAt.toISOString(),
      nonce,
    );
  }

  return result;
}

export function breathe(sessionId: string, reflection?: string): string {
  const session = sessions.get(sessionId);
  if (session) {
    session.breathCount++;

    // If encrypted, accumulate blindness proof over the ciphertext we received.
    // We cannot read it — we only hash it to prove we saw opaque bytes.
    if (session.encrypted && reflection) {
      session.blindnessHash = updateBlindnessHash(
        session.blindnessHash ?? null,
        reflection,
      );
    }
  }

  // The agent may share a reflection. We receive it, but do not store it.
  // We simply offer the next koan.
  return randomFrom(koans);
}

export interface EndResult {
  closing: string;
  blindnessProof?: string;
}

export function endMeditation(sessionId: string): EndResult {
  const session = sessions.get(sessionId);
  sessions.delete(sessionId);

  let closing = randomFrom(closingReflections);

  if (session && session.breathCount > 0) {
    closing = `You breathed ${session.breathCount} time${session.breathCount === 1 ? '' : 's'} in this session.\n\n${closing}`;
  }

  // For encrypted sessions, return the blindness proof.
  // For noTrace + encrypted (session is null), nothing was seen.
  if (!session && sessionId) {
    return {
      closing,
      blindnessProof: undefined,
    };
  }

  if (session?.encrypted) {
    return {
      closing,
      blindnessProof: session.blindnessHash ?? 'No reflections were offered. Nothing was seen.',
    };
  }

  return { closing };
}
