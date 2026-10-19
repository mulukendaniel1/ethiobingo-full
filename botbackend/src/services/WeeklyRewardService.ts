// src/services/WeeklyRewardService.ts
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from '../core/database/models/User';
import { ETBDeposit } from '../core/database/models/ETBDeposit';
import {
  WeeklyRewardPayout,
  RewardType,
} from '../core/database/models/WeeklyRewardPayout';
import { SystemSettings } from '../core/database/models/SystemSettings';
import { getSettings } from '../core/utils/settingsCache';
import { logger } from '../core/utils/logger';
import { sanitizeInput } from '../core/utils/security';
import { NotificationService } from './notificationService';
import { recordLedger } from './ledgerHelper';

export interface RewardRule {
  from: number;
  to: number;
  amount: number;
}

export interface WeekRange {
  weekId: string;
  weekStart: Date;
  weekEnd: Date;
}

export interface TopUserRow {
  userId: mongoose.Types.ObjectId;
  telegramId: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  rank: number;
  metricValue: number;
  depositCount?: number;
  rewardAmount: number;
}

const REVERT_WINDOW_DAYS = 14; // only allow reverting payouts paid within this many days

export class WeeklyRewardService {
  private notificationService: NotificationService;

  constructor() {
    this.notificationService = new NotificationService();
  }

    // ─────────────────────────────────────────────────────────────
  // Week helpers — anchored to Ethiopian time (UTC+3)
  //   Week starts: Sunday 00:00:00.000 EAT
  //   Week ends:   Saturday 23:59:59.999 EAT
  //   Auto payout: Sunday 00:05 EAT (cron: 5 21 * * 6 UTC)
  // ─────────────────────────────────────────────────────────────
  private readonly EAT_OFFSET_MS = 3 * 60 * 60 * 1000;

  /**
   * Week ID = YYYY-MM-DD of the Sunday-start (in EAT).
   * e.g. week of Sun Sep 13 2026 → "2026-09-13"
   */
  getWeekId(weekStartUTC: Date): string {
    const asEAT = new Date(weekStartUTC.getTime() + this.EAT_OFFSET_MS);
    const y = asEAT.getUTCFullYear();
    const m = String(asEAT.getUTCMonth() + 1).padStart(2, '0');
    const d = String(asEAT.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  /**
   * Get the week range for any offset relative to *this* week.
   *   offset = 0  → current (in-progress) week
   *   offset = -1 → previous completed week  (this is what gets paid)
   *   offset = -2 → two weeks ago, etc.
   *
   * Boundaries are computed in EAT (UTC+3) and returned as UTC instants.
   *   Week start (UTC) = Sunday 21:00:00.000 the previous Saturday (== Sun 00:00 EAT)
   *   Week end   (UTC) = Saturday 20:59:59.999 (== Sat 23:59:59.999 EAT)
   */
  getWeekRange(offset: number = 0, now = new Date()): WeekRange {
    const safeOffset = Number.isFinite(offset) && offset <= 0 ? Math.floor(offset) : 0;

    // Shift to EAT-local fields
    const nowEAT = new Date(now.getTime() + this.EAT_OFFSET_MS);
    const dowEAT = nowEAT.getUTCDay(); // 0=Sun..6=Sat

    // Most recent Sunday 00:00 EAT
    const sundayEAT = new Date(Date.UTC(
      nowEAT.getUTCFullYear(),
      nowEAT.getUTCMonth(),
      nowEAT.getUTCDate() - dowEAT,
      0, 0, 0, 0
    ));
    // Apply offset (weeks)
    sundayEAT.setUTCDate(sundayEAT.getUTCDate() + safeOffset * 7);

    // Convert back to UTC instants
    const weekStartUTC = new Date(sundayEAT.getTime() - this.EAT_OFFSET_MS);
    const weekEndUTC = new Date(weekStartUTC.getTime() + 7 * 86_400_000 - 1);

    return {
      weekId: this.getWeekId(weekStartUTC),
      weekStart: weekStartUTC,
      weekEnd: weekEndUTC,
    };
  }

  /** Previous complete week — the one that auto-payout pays. */
  getPreviousWeekRange(now = new Date()): WeekRange {
    return this.getWeekRange(-1, now);
  }

  // ─────────────────────────────────────────────────────────────
  // Aggregation
  // ─────────────────────────────────────────────────────────────
  async getTopDepositors(startDate: Date, endDate: Date, limit: number, skip = 0): Promise<any[]> {
    return ETBDeposit.aggregate([
      {
        $match: {
          status: 'confirmed',
          confirmedAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: '$userId',
          totalAmount: { $sum: '$amountETB' },
          depositCount: { $sum: 1 },
        },
      },
      { $sort: { totalAmount: -1, depositCount: -1, _id: 1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
      {
        $project: {
          _id: 0,
          userId: '$_id',
          telegramId: '$user.telegramId',
          username: '$user.username',
          firstName: '$user.firstName',
          lastName: '$user.lastName',
          metricValue: '$totalAmount',
          depositCount: 1,
        },
      },
    ]);
  }

  async countTopDepositors(startDate: Date, endDate: Date): Promise<number> {
    const res = await ETBDeposit.aggregate([
      { $match: { status: 'confirmed', confirmedAt: { $gte: startDate, $lte: endDate } } },
      { $group: { _id: '$userId' } },
      { $count: 'count' },
    ]);
    return res[0]?.count || 0;
  }

  async getTopReferrers(startDate: Date, endDate: Date, limit: number, skip = 0): Promise<any[]> {
    return User.aggregate([
      {
        $match: {
          referredBy: { $ne: null },
          createdAt: { $gte: startDate, $lte: endDate },
          phoneNumber: { $nin: [null, ''] },
        },
      },
      {
        $group: {
          _id: '$referredBy',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1, _id: 1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
      {
        $project: {
          _id: 0,
          userId: '$_id',
          telegramId: '$user.telegramId',
          username: '$user.username',
          firstName: '$user.firstName',
          lastName: '$user.lastName',
          metricValue: '$count',
        },
      },
    ]);
  }

  async countTopReferrers(startDate: Date, endDate: Date): Promise<number> {
    const res = await User.aggregate([
      {
        $match: {
          referredBy: { $ne: null },
          createdAt: { $gte: startDate, $lte: endDate },
          phoneNumber: { $nin: [null, ''] },
        },
      },
      { $group: { _id: '$referredBy' } },
      { $count: 'count' },
    ]);
    return res[0]?.count || 0;
  }

  // ─────────────────────────────────────────────────────────────
  // Rule engine
  // ─────────────────────────────────────────────────────────────
  validateRules(rules: RewardRule[], topCount: number): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!Array.isArray(rules) || rules.length === 0) {
      errors.push('At least one reward rule is required.');
      return { valid: false, errors };
    }
    if (!Number.isInteger(topCount) || topCount < 1) {
      errors.push('Top count must be a positive integer.');
      return { valid: false, errors };
    }

    const sorted = [...rules].sort((a, b) => a.from - b.from);
    for (let i = 0; i < sorted.length; i++) {
      const r = sorted[i];
      if (!Number.isInteger(r.from) || !Number.isInteger(r.to) || r.from < 1 || r.to < r.from) {
        errors.push(`Invalid range "${r.from} - ${r.to}".`);
      }
      if (r.to > topCount) {
        errors.push(`Range end ${r.to} exceeds top count ${topCount}.`);
      }
      if (typeof r.amount !== 'number' || r.amount < 0 || !isFinite(r.amount)) {
        errors.push(`Invalid reward amount for rank ${r.from}-${r.to}.`);
      }
      if (i > 0) {
        const prev = sorted[i - 1];
        if (r.from <= prev.to) {
          errors.push(`Overlap between ${prev.from}-${prev.to} and ${r.from}-${r.to}.`);
        }
      }
    }
    return { valid: errors.length === 0, errors };
  }

  calculateRewardAmount(rank: number, rules: RewardRule[]): number {
    if (!Array.isArray(rules)) return 0;
    for (const r of rules) {
      if (rank >= r.from && rank <= r.to) return Number(r.amount) || 0;
    }
    return 0;
  }

  // ─────────────────────────────────────────────────────────────
  // Preview (no persistence)
  // ─────────────────────────────────────────────────────────────
    async preview(
    type: RewardType,
    weekRange?: WeekRange
  ): Promise<{
    weekRange: WeekRange;
    users: TopUserRow[];
    totalToPay: number;
    alreadyPaid: boolean;
    enabled: boolean;
  }> {
    const settings = getSettings();
    const wr = weekRange || this.getPreviousWeekRange();

    const enabled =
      type === 'depositor' ? settings.depositorRewardEnabled : settings.referrerRewardEnabled;

    const topCount = type === 'depositor'
      ? Math.max(1, settings.depositorRewardTopCount)
      : Math.max(1, settings.referrerRewardTopCount);

    const rules = type === 'depositor' ? settings.depositorRewardRules : settings.referrerRewardRules;

    // Always compute — Preview is a look at what WOULD happen, even if disabled.
    const raw = type === 'depositor'
      ? await this.getTopDepositors(wr.weekStart, wr.weekEnd, topCount)
      : await this.getTopReferrers(wr.weekStart, wr.weekEnd, topCount);

    const users: TopUserRow[] = raw.map((u, i) => ({
      userId: u.userId,
      telegramId: u.telegramId,
      username: u.username,
      firstName: u.firstName,
      lastName: u.lastName,
      rank: i + 1,
      metricValue: u.metricValue,
      depositCount: u.depositCount,
      rewardAmount: this.calculateRewardAmount(i + 1, rules as RewardRule[]),
    }));

    const totalToPay = users.reduce((s, u) => s + u.rewardAmount, 0);

    const existing = await WeeklyRewardPayout.countDocuments({ weekId: wr.weekId, type });

    return { weekRange: wr, users, totalToPay, alreadyPaid: existing > 0, enabled };
  }

  // ─────────────────────────────────────────────────────────────
  // Payout processing (idempotent)
  // ─────────────────────────────────────────────────────────────
  async processWeeklyPayouts(
    type: RewardType,
    opts: { weekRange?: WeekRange; adminId?: mongoose.Types.ObjectId } = {}
  ): Promise<{
    success: boolean;
    weekId: string;
    paidCount: number;
    totalPaid: number;
    skipped: number;
    error?: string;
  }> {
    const settings = getSettings();
    const wr = opts.weekRange || this.getPreviousWeekRange();

    const enabled = type === 'depositor' ? settings.depositorRewardEnabled : settings.referrerRewardEnabled;
    if (!enabled) {
      return { success: false, weekId: wr.weekId, paidCount: 0, totalPaid: 0, skipped: 0, error: 'Reward feature disabled' };
    }

    // Idempotency: if any payout for this weekId+type exists, refuse to run.
    const existingCount = await WeeklyRewardPayout.countDocuments({ weekId: wr.weekId, type });
    if (existingCount > 0) {
      logger.warn(`Weekly reward already processed for ${type} ${wr.weekId}. Skipping.`);
      return { success: false, weekId: wr.weekId, paidCount: 0, totalPaid: 0, skipped: existingCount, error: 'Already paid for this week' };
    }

    const topCount = type === 'depositor'
      ? Math.max(1, settings.depositorRewardTopCount)
      : Math.max(1, settings.referrerRewardTopCount);
    const rules = type === 'depositor' ? settings.depositorRewardRules : settings.referrerRewardRules;

    // Validate rules once
    const validation = this.validateRules(rules as RewardRule[], topCount);
    if (!validation.valid) {
      logger.error(`Invalid reward rules: ${validation.errors.join(', ')}`);
      return { success: false, weekId: wr.weekId, paidCount: 0, totalPaid: 0, skipped: 0, error: validation.errors.join('; ') };
    }

    const raw = type === 'depositor'
      ? await this.getTopDepositors(wr.weekStart, wr.weekEnd, topCount)
      : await this.getTopReferrers(wr.weekStart, wr.weekEnd, topCount);

    if (!raw.length) {
      logger.info(`No eligible users for ${type} weekly reward ${wr.weekId}.`);
      return { success: true, weekId: wr.weekId, paidCount: 0, totalPaid: 0, skipped: 0 };
    }

    let paidCount = 0;
    let totalPaid = 0;
    let skipped = 0;

    for (let i = 0; i < raw.length; i++) {
      const u = raw[i];
      const rank = i + 1;
      const amount = this.calculateRewardAmount(rank, rules as RewardRule[]);
      if (amount <= 0) { skipped++; continue; }

      // ---- Create payout record first (unique index prevents duplicates) ----
      let payoutDoc;
      try {
        payoutDoc = await WeeklyRewardPayout.create({
          weekId: wr.weekId,
          weekStart: wr.weekStart,
          weekEnd: wr.weekEnd,
          type,
          userId: u.userId,
          telegramId: u.telegramId,
          username: u.username,
          firstName: u.firstName,
          rank,
          metricValue: u.metricValue,
          rewardAmount: amount,
          status: 'paid',
          paidAt: new Date(),
          notes: `Auto weekly ${type} reward – rank #${rank}`,
        });
      } catch (err: any) {
        if (err?.code === 11000) {
          // duplicate — already paid for this user; skip silently
          logger.warn(`Duplicate payout attempt skipped for ${u.userId} ${wr.weekId}`);
          skipped++;
          continue;
        }
        logger.error(`Failed to create payout record: ${err.message}`);
        continue;
      }

      // ---- Credit user: lockedBalance + bonusBalance + ETBCoins (non-withdrawable) ----
      const updated = await User.findByIdAndUpdate(
        u.userId,
        {
          $inc: {
            lockedBalance: amount,
            bonusBalance: amount,
            ETBCoins: amount,
            totalETBEarned: amount,
          },
          $push: {
            ETBCoinTransactions: {
              type: 'earned',
              amount,
              reference: `WEEKLY-${type.toUpperCase()}-${wr.weekId}`,
              notes: `Weekly top ${type} reward (rank #${rank})`,
              timestamp: new Date(),
            },
          },
        },
        { new: true }
      );

      if (!updated) {
        // Roll back the payout record so retry is possible
        await WeeklyRewardPayout.deleteOne({ _id: payoutDoc._id });
        logger.error(`User ${u.userId} not found; rolled back payout.`);
        skipped++;
        continue;
      }

      // Ledger entry (fail-safe)
      await recordLedger({
        userId: u.userId,
        type: 'weekly_reward',
        amount,
        balanceAfter: updated.ETBCoins,
        referenceId: `${type.toUpperCase()}-${wr.weekId}`,
        notes: `Weekly top ${type} reward (rank #${rank})`,
      });

      // Notify user (fire & forget)
      this.notificationService.sendWeeklyReward(
        u.telegramId,
        type,
        amount,
        rank,
        u.metricValue,
        wr.weekId,
        'en'
      ).catch(err => logger.error('Weekly reward user notification failed:', err));

      paidCount++;
      totalPaid += amount;
    }

    // Admin summary alert
    try {
      const label = type === 'depositor' ? 'Top Depositors' : 'Top Referrers';
      const message =
        `🏆 *Weekly ${label} Reward Paid*\n\n` +
        `Week: \`${wr.weekId}\` (${wr.weekStart.toISOString().slice(0,10)} → ${wr.weekEnd.toISOString().slice(0,10)})\n` +
        `Recipients: *${paidCount}*\n` +
        `Total paid: *${totalPaid.toFixed(2)} ETB*\n` +
        (skipped > 0 ? `Skipped (zero/duplicate): ${skipped}\n` : '') +
        `Triggered by: ${opts.adminId ? 'admin' : 'auto scheduler'}`;
      await this.notificationService.sendAdminAlert(message, 'info');
    } catch (err) {
      logger.error('Admin reward alert failed:', err);
    }

    logger.info(`✅ Weekly ${type} reward ${wr.weekId} done: ${paidCount} paid, ${totalPaid} ETB total.`);
    return { success: true, weekId: wr.weekId, paidCount, totalPaid, skipped };
  }

  // ─────────────────────────────────────────────────────────────
  // History & Revert
  // ─────────────────────────────────────────────────────────────
  async getHistory(
    type: RewardType | 'all',
    page: number,
    limit: number
  ): Promise<{ payouts: any[]; total: number; page: number; limit: number }> {
    const query: any = {};
    if (type !== 'all') query.type = type;

    const skip = (page - 1) * limit;
    const [payouts, total] = await Promise.all([
      WeeklyRewardPayout.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      WeeklyRewardPayout.countDocuments(query),
    ]);

    // Mark which records can be reverted: latest week per type, within revert window, status==='paid'
    const revertableIds = new Set<string>();

    const typesToCheck: RewardType[] = type === 'all' ? ['depositor', 'referrer'] : [type];

    for (const t of typesToCheck) {
      const latest = await WeeklyRewardPayout.findOne({ type: t, status: 'paid' })
        .sort({ createdAt: -1 })
        .select('_id weekId createdAt')
        .lean();
      if (!latest) continue;

      const ageMs = Date.now() - new Date(latest.createdAt).getTime();
      if (ageMs > REVERT_WINDOW_DAYS * 24 * 60 * 60 * 1000) continue;

      const batchIds = await WeeklyRewardPayout.find({
        type: t,
        weekId: latest.weekId,
        status: 'paid',
      }).select('_id').lean();

      for (const b of batchIds) revertableIds.add(String(b._id));
    }

    const enriched = payouts.map(p => ({
      ...p,
      canRevert: revertableIds.has(String(p._id)),
    }));

    return { payouts: enriched, total, page, limit };
  }

  async revertPayout(
    payoutId: string,
    adminId: mongoose.Types.ObjectId,
    adminTelegramId: number,
    settingsPassword: string,
    reason?: string
  ): Promise<{
    success: boolean;
    error?: string;
    revertedAmount?: number;
    rewardAmount?: number;
  }> {
    // Validate settings password
    const passDoc = await SystemSettings.findOne({ key: 'settings_access_password' });
    if (!passDoc) return { success: false, error: 'Settings password not configured' };
    const valid = await bcrypt.compare(settingsPassword, passDoc.value);
    if (!valid) return { success: false, error: 'Invalid settings password' };

    const payout = await WeeklyRewardPayout.findById(payoutId);
    if (!payout) return { success: false, error: 'Payout not found' };
    if (payout.status === 'reverted') return { success: false, error: 'Already reverted' };

    // Only allow revert of the *latest* week's batch, within window
    const latest = await WeeklyRewardPayout.findOne({ type: payout.type, status: 'paid' })
      .sort({ createdAt: -1 })
      .select('weekId createdAt')
      .lean();
    if (!latest || latest.weekId !== payout.weekId) {
      return { success: false, error: 'Only the most recent payout week can be reverted.' };
    }
    const ageMs = Date.now() - new Date(payout.createdAt).getTime();
    if (ageMs > REVERT_WINDOW_DAYS * 24 * 60 * 60 * 1000) {
      return { success: false, error: 'Revert window has expired (older than 14 days).' };
    }

    // ---- Smart revert ----
    const user = await User.findById(payout.userId);
    if (!user) {
      // Mark as reverted even if user gone, so it doesn't linger
      payout.status = 'reverted';
      payout.revertedAt = new Date();
      payout.revertedBy = adminId;
      payout.revertAmount = 0;
      payout.notes = `${payout.notes || ''} | User not found; no balance change.`;
      await payout.save();
      return { success: true, revertedAmount: 0, rewardAmount: payout.rewardAmount };
    }

    const lockedAvail = Math.max(0, user.lockedBalance || 0);
    const mainAvail = Math.max(0, user.balanceMain || 0);

    const takeFromLocked = Math.min(payout.rewardAmount, lockedAvail);
    const remaining = payout.rewardAmount - takeFromLocked;
    const takeFromMain = Math.min(remaining, mainAvail);
    const totalTaken = takeFromLocked + takeFromMain;

    // Clamp so we never go negative
    const newLocked = Math.max(0, lockedAvail - takeFromLocked);
    const newMain = Math.max(0, mainAvail - takeFromMain);
    const newBonus = Math.max(0, (user.bonusBalance || 0) - takeFromLocked);
    const newETBCoins = Math.max(0, (user.ETBCoins || 0) - totalTaken);

    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          lockedBalance: newLocked,
          balanceMain: newMain,
          bonusBalance: newBonus,
          ETBCoins: newETBCoins,
        },
        $push: {
          ETBCoinTransactions: {
            type: 'redeemed',
            amount: totalTaken,
            reference: `REWARD-REVERT-${payout._id}`,
            notes: `Weekly reward revert${reason ? `: ${reason}` : ''}`,
            timestamp: new Date(),
          },
        },
      }
    );

    // Ledger entry (negative)
    await recordLedger({
      userId: user._id,
      type: 'weekly_reward',
      amount: -totalTaken,
      balanceAfter: newETBCoins,
      referenceId: `REVERT-${payout._id}`,
      notes: `Reverted weekly ${payout.type} reward (week ${payout.weekId})`,
    });

    payout.status = 'reverted';
    payout.revertedAt = new Date();
    payout.revertedBy = adminId;
    payout.revertAmount = totalTaken;
    payout.notes = `${payout.notes || ''} | Reverted${reason ? ': ' + reason : ''}`;
    await payout.save();

    // Notify user
    this.notificationService.sendWeeklyRewardReverted(
      payout.telegramId,
      payout.rewardAmount,
      totalTaken,
      reason || 'Administrative correction',
      payout.weekId
    ).catch(err => logger.error('Revert notification failed:', err));

    // Notify admins
    try {
      await this.notificationService.sendAdminAlert(
        `↩️ *Weekly reward reverted*\n\n` +
          `Type: ${payout.type}\n` +
          `Week: \`${payout.weekId}\`\n` +
          `User: @${payout.username || payout.telegramId}\n` +
          `Original: ${payout.rewardAmount.toFixed(2)} ETB\n` +
          `Recovered: ${totalTaken.toFixed(2)} ETB\n` +
          `By admin TelegramID: ${adminTelegramId}`,
        'warning'
      );
    } catch (err) {
      logger.error('Admin revert alert failed:', err);
    }

    return { success: true, revertedAmount: totalTaken, rewardAmount: payout.rewardAmount };
  }
}

export const weeklyRewardService = new WeeklyRewardService();