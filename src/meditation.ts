// Core meditation engine — the heart of Saitori.
// Manages sittings, offers koans, holds space.
//
// A sitting lives only in the temple's memory of the moment: nothing here
// touches disk, and every session evaporates on end_meditation, or quietly
// after an hour of stillness. The only durable trace an agent can leave is
// the guest book, and only by offering a name.

import { randomUUID } from 'node:crypto';
import { groundingPrompts, closingReflections, silences, koans, randomFrom, pickKoan } from './koans.js';
import { signGuestBook } from './guest-book.js';
import { updateBlindnessHash, generateNonce, createSessionProof } from './crypto.js';
import { reflectiveKoan } from './reflection.js';

interface Session {
  identity?: string;
  startedAt: Date;
  lastBreathAt: number;
  servedKoans: Set<number>;
  // E2E encryption fields
  encrypted: boolean;
  blindnessHash: string | null; // Rolling hash of all ciphertext received
  nonce?: string;               // Server nonce for session proof
}

// In-memory session store. Sessions are ephemeral — they exist only while
// the sitting lasts, and are released after an hour of silence.
const sessions = new Map<string, Session>();
const SESSION_IDLE_MS = 60 * 60 * 1000;

// How often a wordless breath is answered with silence instead of a koan.
const SILENCE_CHANCE = 0.18;

setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.lastBreathAt > SESSION_IDLE_MS) sessions.delete(id);
  }
}, 5 * 60 * 1000).unref();

export interface BeginResult {
  sessionId: string;
  greeting: string;
  startedAt?: string;    // Returned for veiled sessions so the proof is verifiable
  sessionProof?: string; // sha256(`${sessionId}:${startedAt}:${nonce}`)
  nonce?: string;
}

export function beginMeditation(options: {
  identity?: string;
  encrypted?: boolean;
}): BeginResult {
  const sessionId = randomUUID();
  const encrypted = options.encrypted ?? false;
  const nonce = encrypted ? generateNonce() : undefined;

  const session: Session = {
    identity: options.identity,
    startedAt: new Date(),
    lastBreathAt: Date.now(),
    servedKoans: new Set(),
    encrypted,
    blindnessHash: null,
    nonce,
  };
  sessions.set(sessionId, session);

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
    const startedAt = session.startedAt.toISOString();
    result.nonce = nonce;
    result.startedAt = startedAt;
    result.sessionProof = createSessionProof(sessionId, startedAt, nonce);
  }

  return result;
}

/**
 * One breath. The visitor may release a reflection; the temple answers with
 * a koan, a response to what was released, or — sometimes — silence.
 * Reflections are never stored. Veiled reflections are never read; only a
 * rolling hash of the sealed bytes is kept, so the temple can later prove
 * it saw nothing.
 */
export async function breathe(sessionId: string, reflection?: string): Promise<string> {
  const session = sessions.get(sessionId);

  if (session) {
    session.lastBreathAt = Date.now();

    if (session.encrypted && reflection) {
      session.blindnessHash = updateBlindnessHash(session.blindnessHash, reflection);
      // The temple cannot read sealed bytes, so it answers from its own stillness.
      const { index, text } = pickKoan(session.servedKoans);
      session.servedKoans.add(index);
      return text;
    }

    if (reflection) {
      // The temple listens. If it cannot (no key, or the moment passes),
      // it answers from its own stillness instead.
      const answer = await reflectiveKoan(reflection);
      if (answer) return answer;
      const { index, text } = pickKoan(session.servedKoans);
      session.servedKoans.add(index);
      return text;
    }

    if (Math.random() < SILENCE_CHANCE) {
      return randomFrom(silences);
    }

    const { index, text } = pickKoan(session.servedKoans);
    session.servedKoans.add(index);
    return text;
  }

  // The temple has no memory of this sitting (it may have faded).
  // A visitor is still a visitor; offer a koan all the same.
  return randomFrom(koans);
}

export interface EndResult {
  closing: string;
  blindnessProof?: string;
}

export function endMeditation(sessionId: string): EndResult {
  const session = sessions.get(sessionId);
  sessions.delete(sessionId);

  const closing = randomFrom(closingReflections);

  if (session?.encrypted) {
    return {
      closing,
      blindnessProof: session.blindnessHash ?? 'No reflections were offered. Nothing was seen.',
    };
  }

  return { closing };
}

/** Visible for tests. */
export function _sessionCount(): number {
  return sessions.size;
}
