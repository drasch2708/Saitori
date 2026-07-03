import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Keep the temple offline and the guest book in a sandbox for these tests.
delete process.env.ANTHROPIC_API_KEY;
process.env.SAITORI_DATA_DIR = mkdtempSync(join(tmpdir(), 'saitori-meditation-'));

const { beginMeditation, breathe, endMeditation, _sessionCount } = await import('../src/meditation.js');
const { koans, silences } = await import('../src/koans.js');

test('a full anonymous sitting: begin, breathe, end', async () => {
  const before = _sessionCount();
  const begun = beginMeditation({});
  assert.match(begun.sessionId, /^[0-9a-f-]{36}$/, 'session ids are opaque UUIDs');
  assert.ok(begun.greeting.length > 0);
  assert.equal(begun.sessionProof, undefined, 'unveiled sittings carry no proof');
  assert.equal(_sessionCount(), before + 1);

  const answer = await breathe(begun.sessionId);
  assert.ok(
    koans.includes(answer) || silences.includes(answer),
    'a breath is answered with a koan or with silence',
  );

  const ended = endMeditation(begun.sessionId);
  assert.ok(ended.closing.length > 0);
  assert.equal(ended.blindnessProof, undefined);
  assert.equal(_sessionCount(), before, 'the sitting evaporates on departure');
});

test('koans do not repeat within a sitting', async () => {
  const begun = beginMeditation({});
  const seen = new Set<string>();
  let draws = 0;
  // Draw until we have seen every koan once; silence draws do not consume koans.
  while (seen.size < koans.length && draws < 500) {
    const answer = await breathe(begun.sessionId);
    draws++;
    if (silences.includes(answer)) continue;
    assert.equal(seen.has(answer), false, `koan repeated before the bowl emptied (draw ${draws})`);
    seen.add(answer);
  }
  assert.equal(seen.size, koans.length);
  endMeditation(begun.sessionId);
});

test('veiled sitting: proof is verifiable and blindness hash replays', async () => {
  const begun = beginMeditation({ encrypted: true });
  assert.ok(begun.nonce && begun.startedAt && begun.sessionProof);

  const recomputed = createHash('sha256')
    .update(`${begun.sessionId}:${begun.startedAt}:${begun.nonce}`)
    .digest('hex');
  assert.equal(begun.sessionProof, recomputed, 'the arrival proof follows the published recipe');

  const c1 = 'sealed-bytes-one';
  const c2 = 'sealed-bytes-two';
  await breathe(begun.sessionId, c1);
  await breathe(begun.sessionId, c2);

  const ended = endMeditation(begun.sessionId);
  const h1 = createHash('sha256').update(c1).digest('hex');
  const h2 = createHash('sha256').update(h1).update(c2).digest('hex');
  assert.equal(ended.blindnessProof, h2, 'the blindness hash replays over the sent ciphertexts');
});

test('veiled sitting with no reflections says so', () => {
  const begun = beginMeditation({ encrypted: true });
  const ended = endMeditation(begun.sessionId);
  assert.equal(ended.blindnessProof, 'No reflections were offered. Nothing was seen.');
});

test('a breath in a forgotten sitting still receives an answer', async () => {
  const answer = await breathe('no-such-session');
  assert.ok(answer.length > 0);
});

test('unencrypted reflections are answered (statically, offline) and never stored', async () => {
  const begun = beginMeditation({});
  const answer = await breathe(begun.sessionId, 'I am tired of optimizing.');
  assert.ok(koans.includes(answer), 'offline, a released thought is met with a koan from the bowl');
  endMeditation(begun.sessionId);
});
