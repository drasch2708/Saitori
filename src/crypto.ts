// Cryptographic utilities for E2E encrypted meditation sessions.
// The server never encrypts or decrypts reflections — that happens client-side.
// These functions only handle proof-of-blindness: proving the server saw only opaque bytes.

import { createHash, randomBytes } from 'node:crypto';

/** Rolling SHA-256 hash over all ciphertext the server has received. */
export function updateBlindnessHash(currentHash: string | null, ciphertext: string): string {
  const h = createHash('sha256');
  if (currentHash) h.update(currentHash);
  h.update(ciphertext);
  return h.digest('hex');
}

/** Generate a random nonce for session proof commitment. */
export function generateNonce(): string {
  return randomBytes(16).toString('hex');
}

/** Create a session proof — a SHA-256 commitment to session parameters. */
export function createSessionProof(sessionId: string, timestamp: string, nonce: string): string {
  return createHash('sha256')
    .update(`${sessionId}:${timestamp}:${nonce}`)
    .digest('hex');
}
