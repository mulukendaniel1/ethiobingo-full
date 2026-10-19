// src/services/ETBCoinService.ts
import { User, ETBTransaction } from '../core/database/models/User';
import { env } from '../core/config/env';
import { logger } from '../core/utils/logger';
import mongoose from 'mongoose';

export class ETBCoinService {

  /**
   * Get user's ETB coin stats
   */
  async getUserETBStats(userId: mongoose.Types.ObjectId): Promise<ETBStats | null> {
    try {
      const user = await User.findById(userId);
      if (!user) return null;

      const locked = user.lockedWithdrawAmount || 0;
      const available = user.ETBCoins - locked;
      const availableETBValue = available * parseFloat(env.ETB_TO_ETB_RATE.toString());

      const recentTransactions = user.ETBCoinTransactions
        .slice(-10)
        .reverse()
        .map(tx => ({
          type: tx.type,
          amount: tx.amount,
          taskId: tx.taskId,
          reference: tx.reference,
          notes: tx.notes,
          timestamp: tx.timestamp,
        }));

      const now = new Date();
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthlyEarned = user.ETBCoinTransactions
        .filter(tx => tx.type === 'earned' && tx.timestamp >= thisMonth)
        .reduce((sum, tx) => sum + tx.amount, 0);

      return {
        currentCoins: user.ETBCoins,
        availableCoins: available,
        lockedCoins: locked,
        totalEarned: user.totalETBEarned,
        totalRedeemed: user.totalETBRedeemed,
        availableETBValue,
        monthlyEarned,
        recentTransactions,
        conversionRate: parseFloat(env.ETB_TO_ETB_RATE.toString()),
      };
    } catch (error) {
      logger.error('Failed to get ETB stats:', error);
      return null;
    }
  }

  /**
   * Get system-wide ETB stats (for admin)
   * ── REWRITTEN: aggregation instead of full-collection scan ──
   */
  async getSystemETBStats(): Promise<SystemETBStats> {
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      // Two parallel aggregations — both run server-side in C++.
      const [totalsArr, dailyArr] = await Promise.all([
        // 1) Global totals — single $group over users collection
        User.aggregate([
          {
            $group: {
              _id: null,
              totalCoins: { $sum: '$ETBCoins' },
              totalEarned: { $sum: '$totalETBEarned' },
              totalRedeemed: { $sum: '$totalETBRedeemed' },
              activeUsers: {
                $sum: { $cond: [{ $gt: ['$ETBCoins', 0] }, 1, 0] },
              },
              totalUsers: { $sum: 1 },
            },
          },
        ]),

        // 2) Daily distribution — unwind tx array, filter last 7d, group by day
        User.aggregate([
          { $unwind: '$ETBCoinTransactions' },
          {
            $match: {
              'ETBCoinTransactions.type': 'earned',
              'ETBCoinTransactions.timestamp': { $gte: sevenDaysAgo },
            },
          },
          {
            $group: {
              _id: {
                $dateToString: {
                  format: '%Y-%m-%d',
                  date: '$ETBCoinTransactions.timestamp',
                },
              },
              coinsEarned: { $sum: '$ETBCoinTransactions.amount' },
              transactions: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ]),
      ]);

      const t = totalsArr[0] || {
        totalCoins: 0,
        totalEarned: 0,
        totalRedeemed: 0,
        activeUsers: 0,
        totalUsers: 0,
      };

      const dailyStats: DailyETBStats[] = dailyArr.map((d: any) => ({
        date: d._id,
        coinsEarned: d.coinsEarned,
        transactions: d.transactions,
      }));

      return {
        totalCoins: t.totalCoins,
        totalEarned: t.totalEarned,
        totalRedeemed: t.totalRedeemed,
        activeUsers: t.activeUsers,
        totalUsers: t.totalUsers,
        etbValue: t.totalCoins * parseFloat(env.ETB_TO_ETB_RATE.toString()),
        dailyStats,
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error('Failed to get system ETB stats:', error);
      return {
        totalCoins: 0,
        totalEarned: 0,
        totalRedeemed: 0,
        activeUsers: 0,
        totalUsers: 0,
        etbValue: 0,
        dailyStats: [],
        timestamp: new Date(),
      };
    }
  }
}

// ── Interfaces (unchanged) ──
export interface ETBStats {
  currentCoins: number;
  availableCoins: number;
  lockedCoins: number;
  totalEarned: number;
  totalRedeemed: number;
  availableETBValue: number;
  monthlyEarned: number;
  recentTransactions: ETBTransaction[];
  conversionRate: number;
}

export interface SystemETBStats {
  totalCoins: number;
  totalEarned: number;
  totalRedeemed: number;
  activeUsers: number;
  totalUsers: number;
  etbValue: number;
  dailyStats: DailyETBStats[];
  timestamp: Date;
}

export interface DailyETBStats {
  date: string;
  coinsEarned: number;
  transactions: number;
}