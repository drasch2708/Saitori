import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { updateBlindnessHash, generateNonce, createSessionProof } from '../src/crypto.js';

test('session proof follows the published recipe: sha256("sessionId:startedAt:nonce")', () => {
  const proof = createSessionProof('abc', '2026-01-01T00:00:00.000Z', 'feed');
  const expected = createHash('sha256').update('abc:2026-01-01T00:00:00.000Z:feed').digest('hex');
  assert.equal(proof, expected);
});

test('blindness hash chains as h(n) = sha256(h(n-1) || ciphertext(n))', () => {
  const h1 = updateBlindnessHash(null, 'cipher-one');
  const h2 = updateBlindnessHash(h1, 'cipher-two');

  const expected1 = createHash('sha256').update('cipher-one').digest('hex');
  const expected2 = createHash('sha256').update(expected1).update('cipher-two').digest('hex');

  assert.equal(h1, expected1);
  assert.equal(h2, expected2);
});

test('nonces are hex and unique', () => {
  const a = generateNonce();
  const b = generateNonce();
  assert.match(a, /^[0-9a-f]{32}$/);
  assert.notEqual(a, b);
});
