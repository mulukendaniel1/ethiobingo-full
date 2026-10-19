// apps/bingo-game-engine/src/engine/BotModeCrypto.ts

import { createHmac } from 'node:crypto';
import { logger } from '../utils/logger';

export type CardNumbers = number[];

export interface GenerateRiggedInput {
  rigSeed: string;
  nonce: number;
  botCards: Map<string, CardNumbers>;
  humanCards: Map<string, CardNumbers>;
}

export class BotModeCrypto {
  private static readonly MAX_CANDIDATES = 100;
  private static readonly MIN_WIN_DRAW = 17;
  private static readonly MAX_WIN_DRAW = 28;

  static generateRiggedSequence(input: GenerateRiggedInput): number[] {
    const { rigSeed, nonce, botCards, humanCards } = input;

    if (botCards.size === 0) {
      return this.generateFairSequence(rigSeed, nonce);
    }

    const botEntries = Array.from(botCards.entries());
    const humanEntries = Array.from(humanCards.entries());
    const allNumbers = Array.from({ length: 75 }, (_, i) => i + 1);

    for (let candidate = 0; candidate < this.MAX_CANDIDATES; candidate++) {
      const candidateSeed = this.domainSeed(rigSeed, nonce, `candidate:${candidate}`);
      const rng = this.createRNG(candidateSeed);

      // Deterministic but shuffled order of bots and patterns
      const botOrder = this.shuffleNumbers(botEntries.map((_, i) => i), rng);
      for (const botIndex of botOrder) {
        const [botId, botCard] = botEntries[botIndex];
        const botPatterns = this.getAllWinningPatterns(botCard);
        const patternOrder = this.shuffleNumbers(botPatterns.map((_, i) => i), rng);

        for (const patternIndex of patternOrder) {
          const targetPattern = botPatterns[patternIndex];
          if (targetPattern.length === 0) continue;
          const targetSet = new Set(targetPattern);

          // Protect all human cards, all other bot cards, and all other patterns
          // of the same bot from winning before the target draw.
          const protectedCards: CardNumbers[] = [
            ...humanEntries.map(([, card]) => card),
            ...botEntries.filter((_, i) => i !== botIndex).map(([, card]) => card),
          ];

          const blockingPatterns: number[][] = [
            ...protectedCards.flatMap(card => this.getAllWinningPatterns(card)),
            ...botPatterns.filter((_, i) => i !== patternIndex),
          ];

          // For each protected pattern, choose at least one number that can be
          // placed after the target draw and is not part of the target pattern.
          const candidateSets = blockingPatterns.map(pattern =>
            pattern.filter(n => n !== 0 && !targetSet.has(n))
          );
          if (candidateSets.some(set => set.length === 0)) continue;

          const lateSet = this.minimumHittingSet(
            candidateSets,
            this.domainSeed(candidateSeed, 0, `hitting:${botId}:${patternIndex}`)
          );
          if (!lateSet) continue;

          // Ensure target pattern numbers are never late.
          for (const n of targetSet) lateSet.delete(n);
          lateSet.delete(0);

          // Pick a target draw in the desired window.
          const targetDraw = this.pickTargetDraw(candidateSeed, botId, patternIndex);
          const prefixLength = targetDraw - 1;

          const botWinNumber = targetPattern[targetPattern.length - 1];
          const botPreWin = targetPattern.filter(n => n !== botWinNumber);

          if (prefixLength < botPreWin.length) continue;
          if (botPreWin.some(n => lateSet.has(n))) continue;

          const earlyNumbers = allNumbers.filter(n => !lateSet.has(n) && n !== botWinNumber);
          if (earlyNumbers.length < prefixLength) continue;

          // Build a natural prefix: distribute pre-win numbers throughout.
          const prefix = this.buildNaturalPrefix(
            earlyNumbers,
            botPreWin,
            prefixLength,
            this.domainSeed(candidateSeed, 0, `prefix:${botId}:${patternIndex}`)
          );
          if (!prefix) continue;

          const used = new Set<number>([...prefix, botWinNumber]);
          const tailNumbers = allNumbers.filter(n => !used.has(n));
          const tail = this.shuffleNumbers(tailNumbers, this.createRNG(this.domainSeed(candidateSeed, 0, `tail:${botId}:${patternIndex}`)));

          const sequence = [...prefix, botWinNumber, ...tail];
          if (!this.isPermutation75(sequence)) continue;

          // Final validation: no human or bot wins before targetDraw,
          // target bot wins at targetDraw, no human wins at targetDraw.
          const validation = this.validateSequence(
            sequence,
            botEntries,
            humanEntries,
            botIndex,
            targetPattern,
            targetDraw
          );
          if (!validation.ok) continue;

          logger.info(`[BotMode] SAFE sequence built targetBot=${botId} targetDraw=${targetDraw} candidate=${candidate + 1}`);
          return sequence;
        }
      }
    }

    throw new Error(`[BotMode] Could not construct a safe rigged sequence after ${this.MAX_CANDIDATES} candidates`);
  }

  // ============================================================
  // FAIR MODE
  // ============================================================
  static generateFairSequence(seed: string, nonce: number): number[] {
    const rng = this.createRNG(this.domainSeed(seed, nonce, 'fair'));
    return this.shuffleNumbers(Array.from({ length: 75 }, (_, i) => i + 1), rng);
  }

  // ============================================================
  // PATTERN ENGINE
  // ============================================================
  /**
   * Returns every valid winning pattern, with 0 (free space) removed.
   * The free space is considered automatically marked.
   */
  private static getAllWinningPatterns(card: number[]): number[][] {
    const grid = this.toGrid(card);
    const patterns: number[][] = [];

    // Rows
    for (let r = 0; r < 5; r++) patterns.push(grid[r].filter(n => n !== 0));

    // Columns
    for (let c = 0; c < 5; c++) patterns.push(grid.map(row => row[c]).filter(n => n !== 0));

    // Main diagonal
    patterns.push([0,1,2,3,4].map(i => grid[i][i]).filter(n => n !== 0));
    // Anti diagonal
    patterns.push([0,1,2,3,4].map(i => grid[i][4 - i]).filter(n => n !== 0));
    // Corners
    patterns.push([grid[0][0], grid[0][4], grid[4][0], grid[4][4]].filter(n => n !== 0));
    // Middle column (no centre)
    patterns.push([grid[0][2], grid[1][2], grid[3][2], grid[4][2]].filter(n => n !== 0));

    // Deduplicate
    const unique = new Map<string, number[]>();
    for (const p of patterns) {
      const normalized = [...new Set(p)];
      if (normalized.length === 0) continue;
      const key = normalized.sort((a,b) => a-b).join(',');
      unique.set(key, normalized);
    }
    return Array.from(unique.values());
  }

  /**
   * Authoritative winner check.
   * The free space (0) is already removed from required numbers, so we simply
   * check that all numbers in any winning pattern have been drawn.
   */
  static isWinningCard(card: number[], drawn: Set<number>): boolean {
    return this.getAllWinningPatterns(card).some(pattern =>
      pattern.every(n => drawn.has(n))
    );
  }

  // ============================================================
  // FINAL VALIDATOR
  // ============================================================
  private static validateSequence(
    sequence: number[],
    botEntries: Array<[string, number[]]>,
    humanEntries: Array<[string, number[]]>,
    targetBotIndex: number,
    targetPattern: number[],
    targetDraw: number
  ): { ok: true } | { ok: false; reason: string } {
    const drawn = new Set<number>();
    const targetCard = botEntries[targetBotIndex][1];

    for (let i = 0; i < sequence.length; i++) {
      drawn.add(sequence[i]);
      const drawNumber = i + 1;

      if (drawNumber < targetDraw) {
        // No human may win
        for (const [id, card] of humanEntries) {
          if (this.isWinningCard(card, drawn)) {
            return { ok: false, reason: `human:${id}@${drawNumber}` };
          }
        }
        // No bot may win (including target bot, other bots, all patterns)
        for (const [id, card] of botEntries) {
          if (this.isWinningCard(card, drawn)) {
            return { ok: false, reason: `bot:${id}@${drawNumber}` };
          }
        }
      }

      if (drawNumber === targetDraw) {
        // Target pattern must complete
        if (!targetPattern.every(n => drawn.has(n))) {
          return { ok: false, reason: 'target-pattern-not-complete' };
        }
        // Target card must be a winner
        if (!this.isWinningCard(targetCard, drawn)) {
          return { ok: false, reason: 'target-card-not-winning' };
        }
        // No human may win on target draw
        for (const [id, card] of humanEntries) {
          if (this.isWinningCard(card, drawn)) {
            return { ok: false, reason: `human-at-target:${id}` };
          }
        }
        return { ok: true };
      }
    }
    return { ok: false, reason: 'target-draw-not-reached' };
  }

  // ============================================================
  // NATURAL PREFIX
  // ============================================================
  private static buildNaturalPrefix(
    pool: number[],
    preWinNumbers: number[],
    prefixLength: number,
    seed: string
  ): number[] | null {
    const preWinSet = new Set(preWinNumbers);
    if (preWinSet.size !== preWinNumbers.length) return null;
    if (preWinNumbers.some(n => !pool.includes(n))) return null;

    const normalBalls = this.shuffleNumbers(
      pool.filter(n => !preWinSet.has(n)),
      this.createRNG(this.domainSeed(seed, 0, 'normal-pool'))
    );
    const normalCount = prefixLength - preWinNumbers.length;
    if (normalBalls.length < normalCount) return null;

    const normalPrefix = normalBalls.slice(0, normalCount);
    const positions = this.spreadPositions(prefixLength, preWinNumbers.length, this.createRNG(this.domainSeed(seed, 0, 'positions')));
    if (positions.length !== preWinNumbers.length) return null;

    const shuffledPreWin = this.shuffleNumbers(preWinNumbers, this.createRNG(this.domainSeed(seed, 0, 'prewin-order')));

    const result = new Array<number>(prefixLength);
    const posSet = new Set(positions);
    let normalIdx = 0;
    let preWinIdx = 0;
    for (let i = 0; i < prefixLength; i++) {
      if (posSet.has(i)) {
        result[i] = shuffledPreWin[preWinIdx++];
      } else {
        result[i] = normalPrefix[normalIdx++];
      }
    }

    if (preWinIdx !== shuffledPreWin.length || normalIdx !== normalPrefix.length) return null;
    return result;
  }

  /**
   * Spread pre-win numbers evenly across the prefix, avoiding the first
   * few positions (no more than 4 to prevent obvious bot progression).
   */
  private static spreadPositions(prefixLength: number, count: number, rng: () => number): number[] {
    if (count === 0) return [];
    if (prefixLength < count) return [];
    const minPos = Math.min(4, Math.max(0, prefixLength - count));
    const maxPos = prefixLength - 1;
    const positions: number[] = [];

    for (let i = 0; i < count; i++) {
      const ideal = Math.floor(((i + 1) * prefixLength) / (count + 1));
      let position = Math.max(minPos, Math.min(maxPos, ideal + Math.floor(rng() * 3) - 1));
      if (positions.includes(position)) {
        let found = -1;
        for (let dist = 1; dist < prefixLength; dist++) {
          const left = position - dist;
          const right = position + dist;
          if (left >= minPos && !positions.includes(left)) { found = left; break; }
          if (right <= maxPos && !positions.includes(right)) { found = right; break; }
        }
        if (found === -1) return [];
        position = found;
      }
      positions.push(position);
    }
    return positions.sort((a,b) => a-b);
  }

  // ============================================================
  // HITTING SET
  // ============================================================
  private static minimumHittingSet(candidateSets: number[][], seed: string): Set<number> | null {
    const normalized = candidateSets.map(s => [...new Set(s.filter(n => n >= 1 && n <= 75))]);
    if (normalized.some(s => s.length === 0)) return null;

    const rng = this.createRNG(seed);
    let best: Set<number> | null = null;

    for (let restart = 0; restart < 12; restart++) {
      const unresolved = normalized.map(s => new Set(s));
      const selected = new Set<number>();
      while (unresolved.length > 0) {
        const freq = new Map<number, number>();
        for (const set of unresolved) {
          for (const n of set) freq.set(n, (freq.get(n) || 0) + 1);
        }
        let bestNum = -1, bestFreq = -1, bestTie = Infinity;
        for (const [n, count] of freq) {
          const tie = rng();
          if (count > bestFreq || (count === bestFreq && tie < bestTie)) {
            bestFreq = count;
            bestNum = n;
            bestTie = tie;
          }
        }
        if (bestNum < 1) return null;
        selected.add(bestNum);
        for (let i = unresolved.length - 1; i >= 0; i--) {
          if (unresolved[i].has(bestNum)) unresolved.splice(i, 1);
        }
      }
      if (!best || selected.size < best.size) best = selected;
    }
    return best;
  }

  // ============================================================
  // UTILITIES
  // ============================================================
  private static pickTargetDraw(seed: string, botId: string, patternIndex: number): number {
    const hash = createHmac('sha256', `${seed}:target-draw:${botId}:${patternIndex}`).digest('hex').slice(0, 8);
    const range = this.MAX_WIN_DRAW - this.MIN_WIN_DRAW + 1;
    return this.MIN_WIN_DRAW + (parseInt(hash, 16) % range);
  }

  private static domainSeed(seed: string, nonce: number, domain: string): string {
    return createHmac('sha256', seed).update(`${nonce}:${domain}`).digest('hex');
  }

  private static createRNG(seed: string): () => number {
    let state = createHmac('sha256', seed).digest();
    return () => {
      state = createHmac('sha256', state).digest();
      return state.readUInt32BE(0) / 0x100000000;
    };
  }

  private static shuffleNumbers<T>(arr: T[], rng: () => number): T[] {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  private static isPermutation75(seq: number[]): boolean {
    if (seq.length !== 75) return false;
    const set = new Set(seq);
    if (set.size !== 75) return false;
    for (let i = 1; i <= 75; i++) if (!set.has(i)) return false;
    return true;
  }

  private static toGrid(card: number[]): number[][] {
    const grid: number[][] = [];
    for (let row = 0; row < 5; row++) {
      grid.push(card.slice(row * 5, row * 5 + 5));
    }
    return grid;
  }
}