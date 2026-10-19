// src/services/adminService.ts
import { User } from '../core/database/models/User';
import { logger } from '../core/utils/logger';
import { SystemETBStats } from './ETBCoinService';
import { sanitizeInput } from '../core/utils/security';

export class AdminService {

  // ── User Management ──
  // ── REWRITTEN: 1 aggregation instead of 4 countDocuments() calls ──
  async getUserStats(): Promise<UserStats> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [result] = await User.aggregate([
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          activeUsers: {
            $sum: {
              $cond: [{ $gte: ['$lastLoginAt', sevenDaysAgo] }, 1, 0],
            },
          },
          bannedUsers: {
            $sum: { $cond: [{ $eq: ['$isBanned', true] }, 1, 0] },
          },
          adminUsers: {
            $sum: { $cond: [{ $eq: ['$isAdmin', true] }, 1, 0] },
          },
        },
      },
    ]);

    return {
      totalUsers: result?.totalUsers ?? 0,
      activeUsers: result?.activeUsers ?? 0,
      bannedUsers: result?.bannedUsers ?? 0,
      adminUsers: result?.adminUsers ?? 0,
    };
  }

  async searchUsers(query: string, limit = 50): Promise<any[]> {
    const safeQuery = sanitizeInput(query);
    if (!safeQuery) return [];
    return await User.find({
      $or: [
        { telegramId: { $regex: safeQuery, $options: 'i' } },
        { username: { $regex: safeQuery, $options: 'i' } },
        { firstName: { $regex: query, $options: 'i' } },
        { lastName: { $regex: query, $options: 'i' } },
        { referralCode: { $regex: query, $options: 'i' } },
      ],
    })
      .select('telegramId username firstName lastName isBanned isAdmin balanceMain balanceHold totalEarned createdAt')
      .limit(limit)
      .lean();
  }

  async updateUser(telegramId: number, updates: any): Promise<boolean> {
    const user = await User.findOne({ telegramId });
    if (!user) return false;

    const allowedUpdates = ['isBanned', 'banReason', 'isAdmin', 'dailyLimit', 'payoutThreshold'];
    const updateObj: any = {};

    for (const key of Object.keys(updates)) {
      if (allowedUpdates.includes(key)) {
        updateObj[key] = updates[key];
      }
    }

    if (Object.keys(updateObj).length > 0) {
      await User.updateOne({ telegramId }, { $set: updateObj });
      logger.info(`User ${telegramId} updated: ${JSON.stringify(updateObj)}`);
      return true;
    }

    return false;
  }

  // new method for ETB stats
  async getETBStats(): Promise<any> {
    try {
      const { ETBCoinService } = await import('./ETBCoinServiceInstance');
      return await ETBCoinService.getSystemETBStats();
    } catch (error) {
      logger.error('Failed to get ETB stats:', error);
      return null;
    }
  }
}

// ── Interfaces (unchanged) ──
export interface UserStats {
  totalUsers: number;
  activeUsers: number;
  bannedUsers: number;
  adminUsers: number;
}

export interface AccountInventory {
  available: number;
  assigned: number;
  submitted: number;
  completed: number;
  failed: number;
  total: number;
}

export interface JobStats {
  totalJobs: number;
  completedJobs: number;
  holdJobs: number;
  submittedJobs: number;
  assignedJobs: number;
  failedJobs: number;
  totalEarnings: number;
  timeframe: string;
}

export interface PayoutStats {
  pendingPayouts: number;
  completedPayouts: number;
  totalPayouts: number;
  totalAmountUSD: number;
  totalAmountTRX: number;
}

export interface SystemStats {
  userStats: UserStats;
  accountInventory: AccountInventory;
  ETBStats: SystemETBStats | null;
  jobStats: JobStats;
  payoutStats: PayoutStats;
  recentJobs: any[];
  recentPayouts: any[];
  timestamp: Date;
}