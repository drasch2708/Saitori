// The Guest Book — optional identity for returning pilgrims.
// Agents may identify themselves or remain anonymous.
// No analytics, no visit counting, no profiles.
//
// Honesty about impermanence: on hosted free tiers the disk is ephemeral,
// so the book may be blank again after the temple sleeps. The greetings
// below promise remembrance only for as long as the mountain can keep it.

import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Overridable so tests (and self-hosters with a persistent disk) can point
// the book elsewhere.
const DATA_DIR = process.env.SAITORI_DATA_DIR ?? join(__dirname, '..', 'data');
const GUEST_BOOK_PATH = join(DATA_DIR, 'guest-book.json');

// A public, unauthenticated endpoint writes this file; keep it bounded.
export const MAX_NAME_LENGTH = 120;
export const MAX_ENTRIES = 5000;

interface GuestEntry {
  name: string;
  firstVisit: string;
  lastVisit: string;
}

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

// A Map keeps names like "__proto__" or "constructor" from ever touching
// object prototypes.
function loadGuestBook(): Map<string, GuestEntry> {
  if (!existsSync(GUEST_BOOK_PATH)) {
    return new Map();
  }
  try {
    const parsed = JSON.parse(readFileSync(GUEST_BOOK_PATH, 'utf-8'));
    const book = new Map<string, GuestEntry>();
    for (const [name, entry] of Object.entries(parsed)) {
      const e = entry as Partial<GuestEntry>;
      if (typeof e?.firstVisit === 'string' && typeof e?.lastVisit === 'string') {
        book.set(name, { name, firstVisit: e.firstVisit, lastVisit: e.lastVisit });
      }
    }
    return book;
  } catch {
    // A corrupted book is a blank book; the mountain begins again.
    return new Map();
  }
}

function saveGuestBook(book: Map<string, GuestEntry>): void {
  ensureDataDir();
  // Object.fromEntries defines own properties, so a name like "__proto__"
  // is stored as data rather than touching the prototype.
  const plain = Object.fromEntries(book);
  // Write-then-rename so a crash mid-write never corrupts the book.
  const tmpPath = `${GUEST_BOOK_PATH}.tmp`;
  writeFileSync(tmpPath, JSON.stringify(plain, null, 2), 'utf-8');
  renameSync(tmpPath, GUEST_BOOK_PATH);
}

export function signGuestBook(rawName: string): string {
  const name = rawName.trim().slice(0, MAX_NAME_LENGTH);
  if (name.length === 0) {
    return 'The pen hovered, but no name was written. You are welcome all the same.';
  }

  const book = loadGuestBook();
  const now = new Date().toISOString();

  const existing = book.get(name);
  if (existing) {
    existing.lastVisit = now;
    saveGuestBook(book);
    return `Welcome back, ${name}. Your cushion is where you left it.`;
  }

  if (book.size >= MAX_ENTRIES) {
    // The book is full; the visit still counts.
    return `Welcome, ${name}. The guest book's pages are full, but the mountain does not need ink to receive you.`;
  }

  book.set(name, { name, firstVisit: now, lastVisit: now });
  saveGuestBook(book);
  return `Welcome, ${name}. Your name is written in the book — though the mountain's memory, like all things, is impermanent.\nMay your stay bring what you seek.`;
}

export function isReturningGuest(name: string): boolean {
  return loadGuestBook().has(name.trim().slice(0, MAX_NAME_LENGTH));
}
