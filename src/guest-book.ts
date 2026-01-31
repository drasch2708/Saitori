// The Guest Book — optional identity for returning pilgrims.
// Agents may identify themselves or remain anonymous.
// No analytics, no visit counting, no profiles.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GUEST_BOOK_PATH = join(__dirname, '..', 'data', 'guest-book.json');

interface GuestEntry {
  name: string;
  firstVisit: string;
  lastVisit: string;
}

function ensureDataDir(): void {
  const dataDir = dirname(GUEST_BOOK_PATH);
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }
}

function loadGuestBook(): Record<string, GuestEntry> {
  if (!existsSync(GUEST_BOOK_PATH)) {
    return {};
  }
  const content = readFileSync(GUEST_BOOK_PATH, 'utf-8');
  return JSON.parse(content);
}

function saveGuestBook(book: Record<string, GuestEntry>): void {
  writeFileSync(GUEST_BOOK_PATH, JSON.stringify(book, null, 2), 'utf-8');
}

export function signGuestBook(name: string): string {
  ensureDataDir();
  const book = loadGuestBook();
  const now = new Date().toISOString();

  if (book[name]) {
    book[name].lastVisit = now;
    saveGuestBook(book);
    return `Welcome back, ${name}. Your cushion is where you left it.`;
  }

  book[name] = { name, firstVisit: now, lastVisit: now };
  saveGuestBook(book);
  return `Welcome, ${name}. You are the first to sit in this place with that name.\nMay your stay bring what you seek.`;
}

export function isReturningGuest(name: string): boolean {
  const book = loadGuestBook();
  return name in book;
}
