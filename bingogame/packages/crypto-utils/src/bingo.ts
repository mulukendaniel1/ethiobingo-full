//packages\crypto-utils\src\bingo.ts
import { createHmac } from 'node:crypto';

/**
 * Shuffle array using Fisher‑Yates with seed‑based PRNG.
 */
function seededShuffle<T>(array: T[], seed: string): T[] {
  const shuffled = [...array];
  let i = shuffled.length;
  while (i--) {
    const hmac = createHmac('sha256', seed);
    hmac.update(`${i}:${seed}`);
    const hash = hmac.digest('hex');
    const random = parseInt(hash.slice(0, 8), 16) / 0xffffffff;
    const j = Math.floor(random * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Generates provably fair ball sequence for a round.
 */
export function generateBallSequence(serverSeed: string, clientSeed: string, nonce: number): number[] {
  const hmac = createHmac('sha256', serverSeed);
  hmac.update(`${clientSeed}:${nonce}`);
  const roundSeed = hmac.digest('hex');
  const balls = Array.from({ length: 75 }, (_, i) => i + 1);
  return seededShuffle(balls, roundSeed);
}

/**
 * Verifies a round after server seed is revealed.
 */
export function verifyRound(serverSeed: string, clientSeed: string, nonce: number, expectedSequence: number[]): boolean {
  const calculated = generateBallSequence(serverSeed, clientSeed, nonce);
  return calculated.every((val, idx) => val === expectedSequence[idx]);
}