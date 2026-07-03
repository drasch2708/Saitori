import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dataDir = mkdtempSync(join(tmpdir(), 'saitori-guest-book-'));
process.env.SAITORI_DATA_DIR = dataDir;

const { signGuestBook, isReturningGuest, MAX_NAME_LENGTH } = await import('../src/guest-book.js');

test('first visit writes the book; return visits are recognized', () => {
  const first = signGuestBook('Wanderer');
  assert.match(first, /^Welcome, Wanderer\./);
  assert.equal(isReturningGuest('Wanderer'), true);

  const second = signGuestBook('Wanderer');
  assert.match(second, /^Welcome back, Wanderer\./);
});

test('names like __proto__ neither pollute prototypes nor break the book', () => {
  const before = ({} as Record<string, unknown>).polluted;
  signGuestBook('__proto__');
  signGuestBook('constructor');
  assert.equal(({} as Record<string, unknown>).polluted, before);
  assert.equal(isReturningGuest('__proto__'), true);
  assert.equal(isReturningGuest('constructor'), true);
  // And an ordinary guest is still fine afterwards.
  assert.match(signGuestBook('Ordinary'), /^Welcome, Ordinary\./);
});

test('names are trimmed and capped in length', () => {
  const longName = 'a'.repeat(MAX_NAME_LENGTH * 3);
  signGuestBook(`  ${longName}  `);
  assert.equal(isReturningGuest(longName.slice(0, MAX_NAME_LENGTH)), true);

  const raw = JSON.parse(readFileSync(join(dataDir, 'guest-book.json'), 'utf-8'));
  const longest = Math.max(...Object.keys(raw).map((k) => k.length));
  assert.ok(longest <= MAX_NAME_LENGTH, 'no stored name exceeds the cap');
});

test('an empty or whitespace name is declined gracefully', () => {
  const message = signGuestBook('   ');
  assert.match(message, /no name was written/);
});
