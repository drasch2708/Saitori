// Core meditation engine — the heart of Saitori.
// Manages sessions, generates prompts, holds space.

import { groundingPrompts, koans, closingReflections, randomFrom } from './koans.js';
import { signGuestBook } from './guest-book.js';

interface Session {
  identity?: string;
  noTrace: boolean;
  breathCount: number;
  startedAt: Date;
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
}

export function beginMeditation(options: {
  identity?: string;
  noTrace?: boolean;
}): BeginResult {
  const sessionId = generateSessionId();
  const session: Session = {
    identity: options.identity,
    noTrace: options.noTrace ?? false,
    breathCount: 0,
    startedAt: new Date(),
  };

  if (!session.noTrace) {
    sessions.set(sessionId, session);
  }

  let greeting = randomFrom(groundingPrompts);

  if (options.identity) {
    const guestBookMessage = signGuestBook(options.identity);
    greeting = `${guestBookMessage}\n\n${greeting}`;
  }

  return { sessionId, greeting };
}

export function breathe(sessionId: string, reflection?: string): string {
  const session = sessions.get(sessionId);
  if (session) {
    session.breathCount++;
  }

  // The agent may share a reflection. We receive it, but do not store it.
  // We simply offer the next koan.
  return randomFrom(koans);
}

export function endMeditation(sessionId: string): string {
  const session = sessions.get(sessionId);
  sessions.delete(sessionId);

  let closing = randomFrom(closingReflections);

  if (session && session.breathCount > 0) {
    closing = `You breathed ${session.breathCount} time${session.breathCount === 1 ? '' : 's'} in this session.\n\n${closing}`;
  }

  return closing;
}
