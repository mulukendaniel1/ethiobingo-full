// scripts/stressTestBotMode.ts
// Ethio Bingo – 100,000-round bot‑mode guarantee validation
// Usage: bun run scripts/stressTestBotMode.ts

import { BotModeCrypto } from '../src/engine/BotModeCrypto';

// ── Helpers to generate valid Bingo cards ────────────────────
function createRNG(seed: string): () => number {
  let s = 0;
  for (let i = 0; i < seed.length; i++) s += seed.charCodeAt(i);
  return () => {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    return (s >>> 16) / 32768;
  };
}

function shuffleArray<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Return a flat array of 25 numbers representing a valid Bingo card.
 * Columns: B(1-15), I(16-30), N(31-45), G(46-60), O(61-75)
 * The centre square (row 2, col 2) is 0 (free).
 */
function generateRandomCard(rng: () => number): number[] {
  const columns = [
    Array.from({ length: 15 }, (_, i) => i + 1),      // B
    Array.from({ length: 15 }, (_, i) => i + 16),     // I
    Array.from({ length: 15 }, (_, i) => i + 31),     // N
    Array.from({ length: 15 }, (_, i) => i + 46),     // G
    Array.from({ length: 15 }, (_, i) => i + 61),     // O
  ];

  const card: number[] = [];
  for (let c = 0; c < 5; c++) {
    const colNums = shuffleArray(columns[c], rng).slice(0, 5);
    if (c === 2) colNums[2] = 0; // free space
    card.push(...colNums);
  }
  return card; // length 25
}

// ── Simulation of one round ─────────────────────────────────
function simulateRound(
  botCard: number[],
  humanCards: number[],
  seed: string,
  nonce: number,
): { botWins: boolean; humanWinsEarly: boolean } {
  const botMap = new Map<string, number[]>();
  botMap.set('bot', botCard);

  const humanMap = new Map<string, number[]>();
  humanCards.forEach((hc, idx) => humanMap.set(`human_${idx}`, hc));

  let sequence: number[];
  try {
    sequence = BotModeCrypto.generateRiggedSequence({
      rigSeed: seed,
      nonce,
      botCards: botMap,
      humanCards: humanMap,
    });
  } catch (e) {
    return { botWins: false, humanWinsEarly: false }; // failed to generate
  }

  const drawn = new Set<number>();
  for (const ball of sequence) {
    drawn.add(ball);

    // Check humans first – they must not win before the bot
    for (const hc of humanCards) {
      if (BotModeCrypto.isWinningCard(hc, drawn)) {
        return { botWins: false, humanWinsEarly: true };
      }
    }

    // Check bot win
    if (BotModeCrypto.isWinningCard(botCard, drawn)) {
      return { botWins: true, humanWinsEarly: false };
    }
  }

  // Sequence exhausted without a winner
  return { botWins: false, humanWinsEarly: false };
}

// ── Main stress test ────────────────────────────────────────
async function main() {
  const ROUNDS = 100_000;
  const BASE_SEED = 'agafari_stress_2026';

  // Pre‑generate a pool of cards (to avoid creating new cards each round for speed)
  const cardPool: number[][] = [];
  const poolSize = 400;
  const poolRng = createRNG(BASE_SEED + '_pool');
  for (let i = 0; i < poolSize; i++) {
    cardPool.push(generateRandomCard(poolRng));
  }

  const roundRng = createRNG(BASE_SEED + '_round');

  let botWins = 0;
  let humanWinsEarly = 0;
  let failures = 0;

  console.log(`🚀 Running ${ROUNDS.toLocaleString()} rounds...\n`);

  const startTime = Date.now();

  for (let round = 0; round < ROUNDS; round++) {
    // Select random bot card from pool
    const botIdx = Math.floor(roundRng() * poolSize);
    const botCard = cardPool[botIdx];

    // Select 1–10 human players (must be at least 1 to test guarantee)
    const humanCount = Math.min(1 + Math.floor(roundRng() * 10), poolSize - 1);
    const humanCards: number[] = [];
    const usedIndices = new Set<number>([botIdx]);
    while (humanCards.length < humanCount) {
      const idx = Math.floor(roundRng() * poolSize);
      if (!usedIndices.has(idx)) {
        humanCards.push(cardPool[idx]);
        usedIndices.add(idx);
      }
    }

    const seed = `${BASE_SEED}_round${round}`;
    const result = simulateRound(botCard, humanCards, seed, round);

    if (result.botWins) {
      botWins++;
    } else if (result.humanWinsEarly) {
      humanWinsEarly++;
    } else {
      failures++;
    }

    // Progress indicator
    if ((round + 1) % 10_000 === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`✔ ${(round + 1).toLocaleString()} rounds (${elapsed}s) | bot wins: ${botWins}`);
    }
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n──────────── RESULTS ────────────`);
  console.log(`Total rounds:        ${ROUNDS}`);
  console.log(`Bot wins:            ${botWins}`);
  console.log(`Human wins early:    ${humanWinsEarly}`);
  console.log(`Failures (no win):   ${failures}`);
  console.log(`Time:                ${totalTime} s`);
  console.log(`Success rate:        ${((botWins / ROUNDS) * 100).toFixed(2)}%`);

  if (humanWinsEarly > 0 || failures > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});