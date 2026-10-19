// src/services/bonusCleanupService.ts
import mongoose from 'mongoose';
import { User } from '../core/database/models/User';
import { TransactionLedger } from '../core/database/models/TransactionLedger';
import { logger } from '../core/utils/logger';

const CLEANUP_REF = /^(PHONE-BONUS-|REFERRAL-)/i;
const OTHER_BONUS_REF = /^(DEPOSIT-BONUS-|WEEKLY-|SHAMO-|FIRST-DEPOSIT-)/i;

export interface CleanupCandidate {
  userId: string;
  telegramId: number;
  username?: string;
  firstName: string;
  bonusBalance: number;
  depositBalance: number;
  lockedBalance: number;
  ETBCoins: number;
  lockedETB: number;
  isAbuser: boolean;
  totalConfirmedDepositsETB: number;
  phoneRefGranted: number;
  otherBonusGranted: number;
  toRemove: number;
}

export interface CleanupPreview {
  affectedUsers: number;
  totalToRemove: number;
  totalETBCoinsAfter: number;
  breakdown: {
    fromBonus: number;
    fromLocked: number;
    fromETBCoins: number;
  };
  preview: CleanupCandidate[];
  skipped: {
    pendingWithdrawal: number;
    mixedBonuses: number;
    nothingToClean: number;
  };
}

export interface CleanupResult {
  success: boolean;
  batchId: string;
  processed: number;
  totalRemoved: number;
  failed: Array<{ userId: string; telegramId: number; reason: string }>;
}

/**
 * Find all non-agent users with cleanable phone/referral bonuses.
 * Uses a single aggregation to compute per-user granted amounts.
 */
async function findCandidates(
  scopeUserIds?: mongoose.Types.ObjectId[]
): Promise<{ candidates: CleanupCandidate[]; skipped: CleanupPreview['skipped'] }> {
  const match: any = {
    isAgent: false,
    bonusBalance: { $gt: 0 },
  };
  if (scopeUserIds && scopeUserIds.length > 0) {
    match._id = { $in: scopeUserIds };
  }

  // Users with pending withdrawal — need to skip to avoid save() race
  const pendingWithdrawalIds: mongoose.Types.ObjectId[] = await User.aggregate([
    { $match: { ...match, lockedWithdrawAmount: { $gt: 0 } } },
    { $project: { _id: 1 } },
  ]).then((rows: any[]) => rows.map(r => r._id));

  const agg = await User.aggregate([
    {
      $match: {
        ...match,
        $or: [
          { lockedWithdrawAmount: 0 },
          { lockedWithdrawAmount: { $exists: false } },
        ],
      },
    },
    {
      $addFields: {
        phoneRefGranted: {
          $sum: {
            $map: {
              input: {
                $filter: {
                  input: { $ifNull: ['$ETBCoinTransactions', []] },
                  as: 'tx',
                  cond: {
                    $and: [
                      { $eq: ['$$tx.type', 'earned'] },
                      { $regexMatch: { input: { $ifNull: ['$$tx.reference', ''] }, regex: CLEANUP_REF } },
                    ],
                  },
                },
              },
              as: 'tx',
              in: '$$tx.amount',
            },
          },
        },
        otherBonusGranted: {
          $sum: {
            $map: {
              input: {
                $filter: {
                  input: { $ifNull: ['$ETBCoinTransactions', []] },
                  as: 'tx',
                  cond: {
                    $and: [
                      { $eq: ['$$tx.type', 'earned'] },
                      { $regexMatch: { input: { $ifNull: ['$$tx.reference', ''] }, regex: OTHER_BONUS_REF } },
                    ],
                  },
                },
              },
              as: 'tx',
              in: '$$tx.amount',
            },
          },
        },
      },
    },
    {
      $project: {
        telegramId: 1,
        username: 1,
        firstName: 1,
        bonusBalance: 1,
        depositBalance: 1,
        lockedBalance: 1,
        ETBCoins: 1,
        lockedETB: 1,
        isAbuser: 1,
        totalConfirmedDepositsETB: 1,
        phoneRefGranted: 1,
        otherBonusGranted: 1,
      },
    },
  ]);

  const skipped = {
    pendingWithdrawal: pendingWithdrawalIds.length,
    mixedBonuses: 0,
    nothingToClean: 0,
  };

  const candidates: CleanupCandidate[] = [];
  for (const u of agg as any[]) {
    const bonusBalance = u.bonusBalance || 0;
    const phoneRefGranted = u.phoneRefGranted || 0;
    const otherBonusGranted = u.otherBonusGranted || 0;

    if (phoneRefGranted <= 0) { skipped.nothingToClean++; continue; }
    if (otherBonusGranted > 0) { skipped.mixedBonuses++; continue; }

    const toRemove = Math.min(phoneRefGranted, bonusBalance);
    if (toRemove <= 0) { skipped.nothingToClean++; continue; }

    candidates.push({
      userId: u._id.toString(),
      telegramId: u.telegramId,
      username: u.username,
      firstName: u.firstName,
      bonusBalance,
      depositBalance: u.depositBalance || 0,
      lockedBalance: u.lockedBalance || 0,
      ETBCoins: u.ETBCoins || 0,
      lockedETB: u.lockedETB || 0,
      isAbuser: !!u.isAbuser,
      totalConfirmedDepositsETB: u.totalConfirmedDepositsETB || 0,
      phoneRefGranted,
      otherBonusGranted,
      toRemove,
    });
  }

  return { candidates, skipped };
}

export class BonusCleanupService {
  async preview(scopeUserIds?: mongoose.Types.ObjectId[]): Promise<CleanupPreview> {
    const { candidates, skipped } = await findCandidates(scopeUserIds);

    const totalToRemove = candidates.reduce((s, c) => s + c.toRemove, 0);
    const totalETBCoinsBefore = candidates.reduce((s, c) => s + c.ETBCoins, 0);

    // Sort by amount desc, top 100 for display
    const preview = [...candidates]
      .sort((a, b) => b.toRemove - a.toRemove)
      .slice(0, 100);

    return {
      affectedUsers: candidates.length,
      totalToRemove: Math.round(totalToRemove * 100) / 100,
      totalETBCoinsAfter: Math.round((totalETBCoinsBefore - totalToRemove) * 100) / 100,
      breakdown: {
        fromBonus: Math.round(totalToRemove * 100) / 100,
        fromLocked: Math.round(totalToRemove * 100) / 100,
        fromETBCoins: Math.round(totalToRemove * 100) / 100,
      },
      preview,
      skipped,
    };
  }

  async execute(
    adminId: mongoose.Types.ObjectId,
    scopeUserIds?: mongoose.Types.ObjectId[]
  ): Promise<CleanupResult> {
    const batchId = `CLEANUP-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const { candidates } = await findCandidates(scopeUserIds);

    if (candidates.length === 0) {
      return { success: true, batchId, processed: 0, totalRemoved: 0, failed: [] };
    }

const ops = candidates.map(c => ({
  updateOne: {
    filter: {
      _id: new mongoose.Types.ObjectId(c.userId),
      bonusBalance: { $gte: c.toRemove },
      lockedBalance: { $gte: c.toRemove },
      ETBCoins: { $gte: c.toRemove },
      lockedWithdrawAmount: 0,
    },
    update: {
      $inc: {
        bonusBalance: -c.toRemove,
        lockedBalance: -c.toRemove,
        ETBCoins: -c.toRemove,
      },
      $push: {
        ETBCoinTransactions: {
          type: 'redeemed' as const,   // 👈 this is the fix
          amount: c.toRemove,
          reference: `${batchId}-${c.telegramId}`,
          notes: 'Admin cleanup — non-agent referral/phone bonus removed',
          timestamp: new Date(),
        },
      },
    },
  },
}));

   const result = await User.bulkWrite(ops, { ordered: false });

// Mongoose BulkWriteResult — getWriteErrors() is the reliable accessor
const writeErrors: any[] =
  typeof (result as any).getWriteErrors === 'function'
    ? (result as any).getWriteErrors()
    : ((result as any).writeErrors ?? (result as any).result?.writeErrors ?? []);

const failedIdx = new Set<number>(writeErrors.map((e: any) => e.index));

const failed: CleanupResult['failed'] = [];
let totalRemoved = 0;
const ledgerEntries: any[] = [];

for (let i = 0; i < candidates.length; i++) {
  const c = candidates[i];
  if (failedIdx.has(i)) {
    failed.push({ userId: c.userId, telegramId: c.telegramId, reason: 'guard_failed' });
    continue;
  }
  totalRemoved += c.toRemove;
  ledgerEntries.push({
    userId: new mongoose.Types.ObjectId(c.userId),
    type: 'admin_adjustment',
    amount: -c.toRemove,
    balanceAfter: c.ETBCoins - c.toRemove,
    referenceId: batchId,
    notes: `Bonus cleanup (non-agent) — ${c.telegramId}`,
  });
}

if (ledgerEntries.length > 0) {
  try {
    await TransactionLedger.insertMany(ledgerEntries, { ordered: false });
  } catch (err) {
    logger.error('Bonus cleanup: ledger insertMany partial failure:', err);
  }
}

const processed = candidates.length - failed.length;

logger.info(
  `✅ Bonus cleanup ${batchId}: ${processed} users, ${totalRemoved.toFixed(2)} ETB removed, ${failed.length} guard-rejected.`
);

return {
  success: true,
  batchId,
  processed,
  totalRemoved: Math.round(totalRemoved * 100) / 100,
  failed,
};
  }
}

export const bonusCleanupService = new BonusCleanupService();