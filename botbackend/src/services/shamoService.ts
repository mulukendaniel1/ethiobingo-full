import mongoose from 'mongoose';
import { randomBytes } from 'crypto';
import { ShamoRound, IShamoRound } from '../core/database/models/ShamoRound';
import { ShamoClaim } from '../core/database/models/ShamoClaim';
import { User } from '../core/database/models/User';
import { ETBDeposit } from '../core/database/models/ETBDeposit';
import { logger } from '../core/utils/logger';
import { recordLedger } from './ledgerHelper';
import { redisManager } from '../core/database/connections/redis';
import { getSettings } from '../core/utils/settingsCache';

const PRIZE_DEFAULT = 50;
const BUTTONS_DEFAULT = 50;
const DEPOSIT_DAYS_DEFAULT = 7;
const COOLDOWN_HOURS_DEFAULT = 24;

export type ClaimErrorCode =
  | 'NOT_ELIGIBLE' | 'COOLDOWN_ACTIVE' | 'ALREADY_CLAIMED'
  | 'BUTTON_TAKEN' | 'ROUND_NOT_ACTIVE' | 'INTERNAL_ERROR';

export interface ClaimResult {
  success: boolean;
  code?: ClaimErrorCode;
  error?: string;
  buttonIndex?: number;
  prize?: number;
  newBalance?: number;
  claimedCount?: number;
  roundCompleted?: boolean;
}

export class ShamoService {
  // ── Redis key helpers ──────────────────────────────────────
  private claimedKey(roundId: string) { return `shamo:${roundId}:btns`; }
  private usersKey(roundId: string)   { return `shamo:${roundId}:users`; }
  private cdKey(userId: string)       { return `shamo:cd:${userId}`; }
  private eligKey(roundId: string, userId: string) { return `shamo:${roundId}:elig:${userId}`; }

  // ── Queries ────────────────────────────────────────────────
  async getActiveRound(): Promise<IShamoRound | null> {
    return ShamoRound.findOne({ status: 'active' }).sort({ startedAt: -1 });
  }

  async getRound(roundId: string): Promise<IShamoRound | null> {
    return ShamoRound.findOne({ roundId });
  }

  // ── Round lifecycle ────────────────────────────────────────
  async createRound(opts: {
    triggeredBy: 'auto' | 'manual';
    createdBy?: mongoose.Types.ObjectId;
    prizePerButton?: number;
    totalButtons?: number;
    depositDays?: number;
    cooldownHours?: number;
  }): Promise<IShamoRound> {
  const existing = await this.getActiveRound();
  if (existing) throw new Error('An active Shamo round already exists');

  const roundId = `SHAMO-${Date.now()}-${randomBytes(3).toString('hex').toUpperCase()}`;
  try {
    const round = await ShamoRound.create({
      roundId,
      status: 'active',
      startedAt: new Date(),
      totalButtons: opts.totalButtons ?? BUTTONS_DEFAULT,
      prizePerButton: opts.prizePerButton ?? PRIZE_DEFAULT,
      eligibilityDepositDays: opts.depositDays ?? DEPOSIT_DAYS_DEFAULT,
      cooldownHours: opts.cooldownHours ?? COOLDOWN_HOURS_DEFAULT,
      createdBy: opts.createdBy,
      triggeredBy: opts.triggeredBy,
    });
    logger.info(`🎁 Shamo started: ${roundId} (${opts.triggeredBy})`);
    return round;
  } catch (err: any) {
    if (err?.code === 11000) {
      // Lost the race — another round started in the last few ms
      throw new Error('An active Shamo round already exists');
    }
    throw err;
  }
}

  async endRound(opts: {
    roundId: string;
    reason: 'all_claimed' | 'manual' | 'expired' | 'cancelled';
  }): Promise<IShamoRound | null> {
    const status =
      opts.reason === 'cancelled' ? 'cancelled' :
      opts.reason === 'expired'   ? 'expired'   : 'completed';

    const round = await ShamoRound.findOneAndUpdate(
      { roundId: opts.roundId, status: 'active' },
      { $set: { status, endedAt: new Date(), endReason: opts.reason } },
      { new: true }
    );

    if (round) {
      // Clear per-round Redis keys
      const redis = redisManager.getClient();
      await redis.del(this.claimedKey(round.roundId)).catch(() => {});
      await redis.del(this.usersKey(round.roundId)).catch(() => {});
      logger.info(`🎁 Shamo ended: ${opts.roundId} (${opts.reason})`);
    }
    return round;
  }

  // ── Eligibility ────────────────────────────────────────────
  async isEligible(round: IShamoRound, userId: mongoose.Types.ObjectId): Promise<boolean> {
  const settings = getSettings();

  // Master switch — if the admin turned off the deposit gate, everyone is eligible
  if (settings.shamoEligibilityEnabled === false) return true;

  const redis = redisManager.getClient();
  const key = this.eligKey(round.roundId, userId.toString());

  const cached = await redis.get(key);
  if (cached === '1') return true;
  if (cached === '0') return false;

  const since = new Date(Date.now() - round.eligibilityDepositDays * 86_400_000);
  const minAmount = settings.shamoMinDepositAmount || 0;

  let eligible: boolean;

  if (minAmount <= 0) {
    // Any confirmed deposit within the window qualifies (original behavior)
    eligible = !!(await ETBDeposit.exists({
      userId,
      status: 'confirmed',
      confirmedAt: { $gte: since },
    }));
  } else {
    // Sum of confirmed deposits within the window must be >= minAmount
    const agg = await ETBDeposit.aggregate<{ total: number }>([
      {
        $match: {
          userId,
          status: 'confirmed',
          confirmedAt: { $gte: since },
        },
      },
      { $group: { _id: null, total: { $sum: '$amountETB' } } },
    ]);
    eligible = (agg[0]?.total ?? 0) >= minAmount;
  }

  const ttl = eligible ? 3600 : 60;
  await redis.setex(key, ttl, eligible ? '1' : '0');
  return eligible;
}

  // ── Cooldown ──────────────────────────────────────────────
 async isOnCooldown(userId: mongoose.Types.ObjectId, cooldownHours: number): Promise<boolean> {
  const redis = redisManager.getClient();
  const cdKey = this.cdKey(userId.toString());

  if (await redis.exists(cdKey)) return true;

  const cooldownMs = cooldownHours * 3_600_000;
  const recent = await ShamoClaim.findOne({
    userId,
    claimedAt: { $gte: new Date(Date.now() - cooldownMs) },
  }).sort({ claimedAt: -1 }).lean();

  if (recent) {
    const remaining = Math.max(1, Math.floor(
      (recent.claimedAt.getTime() + cooldownMs - Date.now()) / 1000
    ));
    await redis.setex(cdKey, remaining, recent.roundId);
    return true;
  }
  return false;
}

  // ── Atomic claim ──────────────────────────────────────────
  // ── Atomic claim ──────────────────────────────────────────
  async claim(params: {
    roundId: string;
    userId: mongoose.Types.ObjectId;
    buttonIndex: number;
    ipAddress?: string;
    __retried?: boolean;   // ← add this line
  }): Promise<ClaimResult> {
    // 1. Load user once — SOURCE OF TRUTH for telegramId + phoneNumber.
    //    Never trust identifiers coming from the engine over the wire.
    const user = await User.findById(params.userId)
      .select('telegramId phoneNumber isBanned')
      .lean();

    if (!user) {
      return { success: false, code: 'INTERNAL_ERROR', error: 'User not found' };
    }
    if (user.isBanned) {
      return { success: false, code: 'INTERNAL_ERROR', error: 'Account suspended' };
    }

    const telegramId = user.telegramId;
    const phoneNumber = user.phoneNumber || undefined;

    // 2. Load round
    const round = await this.getRound(params.roundId);
    if (!round || round.status !== 'active') {
      return { success: false, code: 'ROUND_NOT_ACTIVE', error: 'Round is not active' };
    }
    if (
      !Number.isInteger(params.buttonIndex) ||
      params.buttonIndex < 0 ||
      params.buttonIndex >= round.totalButtons
    ) {
      return { success: false, code: 'BUTTON_TAKEN', error: 'Invalid button' };
    }

    // 3. Eligibility (7-day deposit check, Redis-cached for 1h)
    if (!(await this.isEligible(round, params.userId))) {
      const minAmount = getSettings().shamoMinDepositAmount || 0;
      const err =
        minAmount > 0
          ? `You need to have deposited at least ${minAmount} ETB in the last ${round.eligibilityDepositDays} days to claim ሻሞ.`
          : `You need a confirmed deposit in the last ${round.eligibilityDepositDays} days to claim ሻሞ.`;
      return { success: false, code: 'NOT_ELIGIBLE', error: err };
    }

    // 4. Cooldown (24h, Redis + DB fallback)
    if (await this.isOnCooldown(params.userId, round.cooldownHours)) {
    return { success: false, code: 'COOLDOWN_ACTIVE', error: 'One Shamo prize every 24 hours.' };
    }

    // 5. Redis Lua — fast pre-reserve to stop obvious races before we hit Mongo
    const redis = redisManager.getClient();
    const luaResult = (await redis.eval(
      `
      local claimed = KEYS[1]
      local users   = KEYS[2]
      local cd      = KEYS[3]
      local bIdx    = ARGV[1]
      local uid     = ARGV[2]
      local cdSecs  = ARGV[3]

      if redis.call('SISMEMBER', claimed, bIdx) == 1 then return {0, 'BUTTON_TAKEN'} end
      if redis.call('SISMEMBER', users,   uid) == 1 then return {0, 'ALREADY_CLAIMED'} end
      if redis.call('EXISTS',    cd)          == 1 then return {0, 'COOLDOWN_ACTIVE'} end

      redis.call('SADD', claimed, bIdx)
      redis.call('SADD', users,   uid)
      redis.call('SET',  cd, '1', 'EX', cdSecs)
      return {1, 'OK'}
      `,
      3,
      this.claimedKey(round.roundId),
      this.usersKey(round.roundId),
      this.cdKey(params.userId.toString()),
      String(params.buttonIndex),
      params.userId.toString(),
      String(round.cooldownHours * 3600)
    )) as any[];

    if (!luaResult || Number(luaResult[0]) !== 1) {
      const code = (luaResult?.[1] || 'INTERNAL_ERROR') as ClaimErrorCode;
      const msg =
        code === 'BUTTON_TAKEN'    ? 'Someone already claimed this button' :
        code === 'ALREADY_CLAIMED' ? 'You already claimed in this round'   :
        code === 'COOLDOWN_ACTIVE' ? 'One Shamo prize every 24 hours'      :
        'Unable to claim';
      return { success: false, code, error: msg };
    }

    // 6. DB transaction — authoritative write. Unique indexes are the real lock.
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      await ShamoClaim.create([{
        roundId: round.roundId,
        userId: params.userId,
        telegramId,                // ← resolved server-side
        buttonIndex: params.buttonIndex,
        prizeAmount: round.prizePerButton,
        claimedAt: new Date(),
        ipAddress: params.ipAddress,
        phoneNumber,               // ← resolved server-side
      }], { session });

      // Re-read user inside the tx so the returned balance is the freshest one.
      const updatedUser = await User.findByIdAndUpdate(
        params.userId,
        {
          $inc: {
            lockedBalance:  round.prizePerButton,
            bonusBalance:   round.prizePerButton,
            ETBCoins:       round.prizePerButton,
            totalETBEarned: round.prizePerButton,
          },
          $push: {
            ETBCoinTransactions: {
              type: 'earned',
              amount: round.prizePerButton,
              reference: `SHAMO-${round.roundId}-${params.buttonIndex}`,
              notes: `Shamo Giveaway prize — button #${params.buttonIndex + 1}`,
              timestamp: new Date(),
            },
          },
        },
        { new: true, session }
      );
      if (!updatedUser) throw new Error('User not found during credit');

    const updatedRound = await ShamoRound.findOneAndUpdate(
    { _id: round._id, status: 'active' },   // ← atomic status check
    { $inc: { claimedCount: 1, totalPayout: round.prizePerButton } },
    { new: true, session }
    );
    if (!updatedRound) {
    throw new Error('Round is no longer active');
    }

      await session.commitTransaction();

      // Ledger (fail-soft — outside tx, best-effort audit trail)
      await recordLedger({
        userId: params.userId,
        type: 'shamo_prize',
        amount: round.prizePerButton,
        balanceAfter: updatedUser.ETBCoins,
        referenceId: `SHAMO-${round.roundId}`,
        notes: `Shamo prize — button #${params.buttonIndex + 1}`,
      });

      // Auto-end when all boxes are gone
      let roundCompleted = false;
      if (updatedRound.claimedCount >= updatedRound.totalButtons) {
        await this.endRound({ roundId: round.roundId, reason: 'all_claimed' });
        roundCompleted = true;
      }

      return {
        success: true,
        buttonIndex: params.buttonIndex,
        prize: round.prizePerButton,
        newBalance: updatedUser.ETBCoins,
        claimedCount: updatedRound.claimedCount,
        roundCompleted,
      };
    } catch (err: any) {
        await session.abortTransaction();

        // Roll back Redis reservation so the user can retry a different button
        await Promise.all([
            redis.srem(this.claimedKey(round.roundId), String(params.buttonIndex)),
            redis.srem(this.usersKey(round.roundId), params.userId.toString()),
            redis.del(this.cdKey(params.userId.toString())),
        ]).catch(e => logger.error('Shamo Redis rollback failed:', e));

        if (err?.code === 11000) {
            // Unique index race — someone else won the DB-level race
            return { success: false, code: 'ALREADY_CLAIMED', error: 'Already claimed' };
        }

        // ← ADD THESE 8 LINES ↓
        const isWriteConflict =
            err?.code === 112 ||
            err?.codeName === 'WriteConflict' ||
            (typeof err?.message === 'string' && err.message.includes('WriteConflict'));

        if (isWriteConflict && !(params as any).__retried) {
            logger.warn(`[Shamo] WriteConflict for user ${params.userId}; retrying once`);
            return this.claim({ ...params, __retried: true })
        }
        // ← END OF ADDED LINES

        logger.error('Shamo claim failed:', err);
        return { success: false, code: 'INTERNAL_ERROR', error: 'Claim failed, please retry' };
        } finally {
      session.endSession();
    }
  }
  // ── State for engine / UI ──────────────────────────────────
async getRoundState(roundId: string) {
  const round = await this.getRound(roundId);
  if (!round) return null;

  const redis = redisManager.getClient();
  let [claimedRaw, usersRaw] = await Promise.all([
    redis.smembers(this.claimedKey(roundId)),
    redis.smembers(this.usersKey(roundId)),
  ]);

  // Self-heal: Redis lost data but the DB still has claims.
  if (claimedRaw.length < round.claimedCount) {
    const dbClaims = await ShamoClaim.find({ roundId })
      .select('buttonIndex userId')
      .lean();
    const dbButtons = dbClaims.map(c => String(c.buttonIndex));
    const dbUsers = dbClaims.map(c => String(c.userId));

    if (dbButtons.length) {
      await redis.sadd(this.claimedKey(roundId), ...dbButtons).catch(() => {});
    }
    if (dbUsers.length) {
      await redis.sadd(this.usersKey(roundId), ...dbUsers).catch(() => {});
    }

    claimedRaw = dbButtons;
    usersRaw = dbUsers;
    logger.warn(`[Shamo] Redis state was stale for ${roundId}; rebuilt from DB (${dbButtons.length} claims).`);
  }

    return {
      roundId: round.roundId,
      status: round.status,
      startedAt: round.startedAt,
      endedAt: round.endedAt,
      totalButtons: round.totalButtons,
      prizePerButton: round.prizePerButton,
      claimedCount: round.claimedCount,
      claimedButtons: claimedRaw.map(Number),
      claimedUsers: usersRaw,
      eligibilityDepositDays: round.eligibilityDepositDays,
      cooldownHours: round.cooldownHours,
    };
  }

  async endActiveRound(reason: 'manual' | 'cancelled'): Promise<IShamoRound | null> {
    const active = await this.getActiveRound();
    if (!active) return null;
    return this.endRound({ roundId: active.roundId, reason });
  }

  // ── Admin: history ─────────────────────────────────────────
  async listRounds(page = 1, limit = 20, status?: string) {
    const q: any = {};
    if (status) q.status = status;
    const [rounds, total] = await Promise.all([
      ShamoRound.find(q).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      ShamoRound.countDocuments(q),
    ]);
    return { rounds, total, page, limit };
  }

  async getRoundClaims(roundId: string, page = 1, limit = 50) {
    const [claims, total] = await Promise.all([
      ShamoClaim.find({ roundId })
        .populate('userId', 'telegramId username firstName phoneNumber')
        .sort({ claimedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      ShamoClaim.countDocuments({ roundId }),
    ]);
    return { claims, total, page, limit };
  }
}

export const shamoService = new ShamoService();