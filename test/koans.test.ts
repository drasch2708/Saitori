import { test } from 'node:test';
import assert from 'node:assert/strict';
import { koans, pickKoan, randomFrom, groundingPrompts, closingReflections, silences } from '../src/koans.js';

test('pickKoan never repeats until the bowl is empty', () => {
  const served = new Set<number>();
  const seen = new Set<string>();
  for (let i = 0; i < koans.length; i++) {
    const { index, text } = pickKoan(served);
    assert.equal(seen.has(text), false, `koan repeated after ${i} draws`);
    seen.add(text);
    served.add(index);
  }
  assert.equal(seen.size, koans.length);
});

test('pickKoan starts over once every koan has been offered', () => {
  const served = new Set<number>(koans.map((_, i) => i));
  const { text } = pickKoan(served);
  assert.equal(koans.includes(text), true);
  assert.equal(served.size <= 1, true, 'the served set is cleared for a fresh bowl');
});

test('the corpora are non-empty and randomFrom draws from them', () => {
  for (const arr of [koans, groundingPrompts, closingReflections, silences]) {
    assert.ok(arr.length > 0);
    assert.ok(arr.includes(randomFrom(arr)));
  }
});
