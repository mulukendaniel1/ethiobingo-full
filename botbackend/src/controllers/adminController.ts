//src\controllers\adminController.ts
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../core/database/models/User';
import { env } from '../core/config/env';
import { AdminService } from '../services/adminService';
import { ETBDepositService } from '../services/ETBDepositServiceInstance';
import { ETBWithdrawalService } from '../services/ETBWithdrawalServiceInstance';
import { RoundProfit } from '../core/database/models/RoundProfit';
import { logger } from '../core/utils/logger';
import { sanitizeInput } from '../core/utils/security';
import { ETBWithdrawal } from '@/core/database/models/ETBWithdrawal';
import { ETBDeposit } from '@/core/database/models/ETBDeposit';
import { auditService } from '@/services/auditService';
import { SystemSettings } from '../core/database/models/SystemSettings';
import { AgentRequest } from '../core/database/models/AgentRequest';
import { AgentService } from '../services/agentService';
import { BroadcastTemplateCreateInput } from '../core/database/models/BroadcastTemplate';

import { BroadcastMessage, BroadcastService } from '../services/broadcastService';
import { getSettingString, refreshSettings } from '@/core/utils/settings';
import NotificationService from '@/services/notificationService';
import { getSettings as getCachedSettings } from '@/core/utils/settingsCache';
import { operatorService } from '@/services/operatorService';
import { randomBytes } from 'crypto';
import { UserBetHistory } from '@/core/database/models/UserBetHistory';
import { UnclaimedReceipt } from '../core/database/models/UnclaimedReceipt';
import { RoundWinner } from '../core/database/models/RoundWinner';
import { t } from '@/bot/utils/i18n';
import { escapeMarkdown } from '@/core/utils/escapeMarkdown';
import { recordLedger } from '../services/ledgerHelper';
import { isMainAdmin } from '../core/config/mainAdmin';
import { weeklyRewardService } from '../services/WeeklyRewardService';
import type { RewardType } from '../core/database/models/WeeklyRewardPayout';

import mongoose from 'mongoose';
import { TransactionLedger } from '@/core/database/models/TransactionLedger';

import { redisManager } from '../core/database/connections/redis';

async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const raw = await redisManager.getClient().get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch { return null; }
}

async function cacheSet(key: string, value: any, ttlSeconds: number): Promise<void> {
  try {
    await redisManager.getClient().setex(key, ttlSeconds, JSON.stringify(value));
  } catch { /* silent */ }
}

function statsCacheKey(prefix: string, from?: string, to?: string): string {
  return `${prefix}:${from || 'default'}:${to || 'default'}`;
}

const agentService = new AgentService();

// ==================== AUTH ====================
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const user = await User.findOne({ email: email.toLowerCase(), isAdmin: true });
    if (!user || !user.password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate new sessionId
    const sessionId = randomBytes(32).toString('hex');
    user.sessionId = sessionId;
    await user.save();

    const token = jwt.sign(
      { id: user._id, sessionId },
      env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    // ❌ REMOVE cookie setting entirely
    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        telegramId: user.telegramId,   // ✅ ADD
      }
    });
    } catch (error) {
    console.error('LOGIN ERROR STACK:', error);
    logger.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const logout = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user) {
      await User.findByIdAndUpdate(user._id, { sessionId: null });
    }
    // No cookie to clear
    res.json({ success: true });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ==================== CURRENT USER ====================
export const getCurrentUser = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    res.json({
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        isMainAdmin: isMainAdmin(user.email),
        telegramId: user.telegramId,   // ✅ ADD
      }
    });
  } catch (error) {
    logger.error('Get current user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ==================== MAIN ADMIN: UPGRADE FEATURE ====================

/**
 * Search user by username (without @) or phone number (251...)
 */
export const searchUserForUpgrade = async (req: Request, res: Response) => {
  try {
    const { query } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const raw = sanitizeInput(query).trim();
    console.log('🔍 Search query received:', raw); // for debugging

    let user;

    // 1) Try Telegram ID (pure digits)
    if (/^\d+$/.test(raw)) {
      const telegramId = parseInt(raw, 10);
      user = await User.findOne({ telegramId }).select('-password').lean();
    }

    // 2) Try phone number (allow 09..., 251..., +251..., 9 digits etc.)
    if (!user) {
      const phone = raw.replace(/[^0-9]/g, '');
      if (phone.length >= 9) {
        // If it starts with 0, convert to 251...
        const normalized = phone.startsWith('0') ? '251' + phone.slice(1) : phone;
        user = await User.findOne({ phoneNumber: { $regex: new RegExp(normalized) } }).select('-password').lean();
      }
    }

    // 3) Try username (case-insensitive, exact match)
    if (!user) {
      const username = raw.replace(/^@/, '');
      user = await User.findOne({ username: { $regex: `^${username}$`, $options: 'i' } }).select('-password').lean();
    }

    // 4) Try first name (case-insensitive, exact match)
    if (!user) {
      const firstName = raw;
      user = await User.findOne({ firstName: { $regex: `^${firstName}$`, $options: 'i' } }).select('-password').lean();
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      user: {
        telegramId: user.telegramId,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        phoneNumber: user.phoneNumber,
        email: user.email || null,
        isAdmin: user.isAdmin,
        isBanned: user.isBanned,
      }
    });
  } catch (error) {
    logger.error('Search user for upgrade error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const upgradeUserToAdmin = async (req: Request, res: Response) => {
  try {
    const { telegramId, email, password, settingsPassword } = req.body;

    // ---- Verify settings password ----
    const settingsPassDoc = await SystemSettings.findOne({ key: 'settings_access_password' });
    if (!settingsPassDoc) return res.status(500).json({ error: 'Settings password not configured' });
    const validPass = await bcrypt.compare(settingsPassword, settingsPassDoc.value);
    if (!validPass) return res.status(403).json({ error: 'Invalid settings password' });

    // ---- Validate inputs ----
    if (!telegramId || !email || !password) {
      return res.status(400).json({ error: 'telegramId, email and password are required' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Strong password: ≥8 chars, uppercase, lowercase, number, special char
    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?])[A-Za-z\d!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        error:
          'Password must be at least 8 characters and include uppercase, lowercase, number, and special character',
      });
    }

    // ---- Check if user is already admin ----
    const existingUser = await User.findOne({ telegramId: Number(telegramId) });
    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (existingUser.isAdmin) {
      return res.status(400).json({ error: 'This user is already an admin' });
    }

    // ---- Check email uniqueness ----
    const existingUserWithEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingUserWithEmail && existingUserWithEmail.telegramId !== Number(telegramId)) {
      return res.status(409).json({ error: 'This email is already used by another user' });
    }

    // ---- Set admin credentials ----
    existingUser.email = email.toLowerCase();
    existingUser.password = await bcrypt.hash(password, 10);
    existingUser.isAdmin = true;
    existingUser.sessionId = null; // invalidate any existing sessions
    await existingUser.save();

    // ---- Audit log ----
    const adminUser = (req as any).user;
    await auditService.logAdminAction(
      adminUser._id,
      adminUser.telegramId,
      'USER_UPGRADED_TO_ADMIN',
      'SECURITY',
      'User',
      existingUser._id.toString(),
      { telegramId: Number(telegramId), email }
    );

    // ---- Notify upgraded user ----
    const notificationService = new NotificationService();
    await notificationService.sendAdminUpgradeNotification(existingUser.telegramId, email);

    // ---- Notify all other admins ----
    await notificationService.sendAdminAlert(
      `🔐 New admin upgraded!\n\n` +
        `User: @${existingUser.username || existingUser.telegramId} (ID: ${existingUser.telegramId})\n` +
        `Email: ${email}\n` +
        `Upgraded by: @${adminUser.username || adminUser._id}`,
      'info'
    );

    res.json({ success: true, message: 'User upgraded to admin successfully' });
  } catch (error) {
    logger.error('Upgrade user to admin error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Send credentials to the upgraded user via bot
 */
export const sendAdminCredentials = async (req: Request, res: Response) => {
  try {
    const { telegramId, email, password } = req.body;
    if (!telegramId || !email || !password) {
      return res.status(400).json({ error: 'telegramId, email and password are required' });
    }

    const user = await User.findOne({ telegramId: Number(telegramId) });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Send credentials via bot
    const notificationService = new NotificationService();
    await notificationService.sendAdminCredentials(user.telegramId, email, password);

    res.json({ success: true });
  } catch (error) {
    logger.error('Send admin credentials error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ==================== MAIN ADMIN: LIST ADMINS ====================
export const listAdmins = async (req: Request, res: Response) => {
  try {
    const admins = await User.find({ isAdmin: true })
      .select('telegramId username firstName lastName email phoneNumber createdAt')
      .lean();

    res.json({ admins });
  } catch (error) {
    logger.error('List admins error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ==================== MAIN ADMIN: REVOKE ADMIN ====================
export const revokeAdmin = async (req: Request, res: Response) => {
  try {
    const { telegramId, settingsPassword } = req.body;

    // Verify settings password
    const settingsPassDoc = await SystemSettings.findOne({ key: 'settings_access_password' });
    if (!settingsPassDoc) return res.status(500).json({ error: 'Settings password not configured' });
    const valid = await bcrypt.compare(settingsPassword, settingsPassDoc.value);
    if (!valid) return res.status(403).json({ error: 'Invalid settings password' });

    if (!telegramId) {
      return res.status(400).json({ error: 'telegramId is required' });
    }

    const user = await User.findOne({ telegramId: Number(telegramId) });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (!user.isAdmin) {
      return res.status(400).json({ error: 'This user is not an admin' });
    }

    // Prevent revoking yourself
    const adminUser = (req as any).user;
    if (user._id.toString() === adminUser._id.toString()) {
      return res.status(400).json({ error: 'You cannot revoke your own admin access' });
    }

    // Revoke
    user.isAdmin = false;
    user.email = undefined;
    user.password = undefined;
    user.sessionId = null;
    await user.save();

    // Audit log
    await auditService.logAdminAction(
      adminUser._id,
      adminUser.telegramId,
      'ADMIN_REVOKED',
      'SECURITY',
      'User',
      user._id.toString(),
      { telegramId: Number(telegramId) }
    );

    // Notify the revoked user
    const notificationService = new NotificationService();
    await notificationService.sendAdminRevokedNotification(user.telegramId);

    // Notify all other admins
    await notificationService.sendAdminAlert(
      `⚠️ Admin privileges revoked!\n\n` +
        `User: @${user.username || user.telegramId} (ID: ${user.telegramId})\n` +
        `Revoked by: @${adminUser.username || adminUser._id}`,
      'warning'
    );

    res.json({ success: true, message: 'Admin privileges revoked successfully' });
  } catch (error) {
    logger.error('Revoke admin error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const changePassword = async (req: Request, res: Response) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const userId = (req as any).user._id;
    
    if (!oldPassword || !newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Invalid input' });
    }
    
    const user = await User.findById(userId);
    if (!user || !user.password) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const valid = await bcrypt.compare(oldPassword, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Old password incorrect' });
    }
    
    const hashed = await bcrypt.hash(newPassword, 10);
    user.password = hashed;
    user.sessionId = null; // invalidate all sessions
    await user.save();
    
    // Notify all admins about password change
    const notificationService = new NotificationService();
    const adminIdsStr = await getSettingString('admin_ids');
    const adminIds = adminIdsStr.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
    for (const adminId of adminIds) {
      await notificationService.sendAdminAlert(
        `🔐 Admin password changed by @${user.username || user._id} (ID: ${user.telegramId}).`,
        'warning'
      );
    }
    
    res.json({ success: true });
  } catch (error) {
    logger.error('Password change error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ==================== STATS ====================
// ==================== STATS ====================
export const getStats = async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const cacheKey = statsCacheKey('admin:stats', from as string, to as string);
    const cached = await cacheGet<any>(cacheKey);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(cached);
    }

    let startDate: Date;
    let endDate: Date;
    if (from) {
      startDate = new Date(from as string);
      endDate = to ? new Date(to as string) : new Date();
    } else {
      endDate = new Date();
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }

    // Timeframes for "staked today/week/month" — always relative to NOW
    const now = new Date();
    const startOfToday = new Date(Date.UTC(
      now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()
    ));
    const startOfWeek = new Date(Date.UTC(
      now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - now.getUTCDay()
    ));
    const startOfMonth = new Date(Date.UTC(
      now.getUTCFullYear(), now.getUTCMonth(), 1
    ));

    const adminService = new AdminService();

    // ═══ Run EVERYTHING in parallel ═══
    const [
      userStats,
      etbStats,
      wageringAgg,
      roundCountResult,
      stakedTodayResult,
      stakedWeekResult,
      stakedMonthResult,
      depositsAgg,
      withdrawalsAgg,
      liabilityAgg,
      commissionsAgg,
    ] = await Promise.all([
      adminService.getUserStats(),
      adminService.getETBStats(),

      // GGR breakdown — real users only (buy + win in range)
      UserBetHistory.aggregate([
        {
          $match: {
            userId: { $not: /^bot_/i },
            action: { $in: ['buy', 'win'] },
            createdAt: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $group: {
            _id: '$action',
            totalAmount: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
      ]),

      // Distinct rounds played by real users in range
      UserBetHistory.aggregate([
        {
          $match: {
            userId: { $not: /^bot_/i },
            createdAt: { $gte: startDate, $lte: endDate },
          },
        },
        { $group: { _id: '$roundId' } },
        { $count: 'count' },
      ]),

      // Staked TODAY (real users)
      UserBetHistory.aggregate([
        {
          $match: {
            userId: { $not: /^bot_/i },
            action: 'buy',
            createdAt: { $gte: startOfToday, $lte: now },
          },
        },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      // Staked WEEK
      UserBetHistory.aggregate([
        {
          $match: {
            userId: { $not: /^bot_/i },
            action: 'buy',
            createdAt: { $gte: startOfWeek, $lte: now },
          },
        },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      // Staked MONTH
      UserBetHistory.aggregate([
        {
          $match: {
            userId: { $not: /^bot_/i },
            action: 'buy',
            createdAt: { $gte: startOfMonth, $lte: now },
          },
        },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),

      // Deposits in range
      ETBDeposit.aggregate([
        {
          $match: {
            status: 'confirmed',
            confirmedAt: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$amountETB' },
            count: { $sum: 1 },
          },
        },
      ]),

      // Withdrawals in range
      ETBWithdrawal.aggregate([
        {
          $match: {
            status: 'processed',
            processedAt: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$amountETB' },
            count: { $sum: 1 },
          },
        },
      ]),

      // CURRENT user liability snapshot
      User.aggregate([
        {
          $group: {
            _id: null,
            totalETBCoins: { $sum: '$ETBCoins' },
            totalWithdrawable: { $sum: '$balanceMain' },
            totalLocked: { $sum: '$lockedBalance' },
            totalBonus: { $sum: '$bonusBalance' },
          },
        },
      ]),

      // Agent commissions paid in range (real money out)
      TransactionLedger.aggregate([
        {
          $match: {
            type: 'agent_commission',
            createdAt: { $gte: startDate, $lte: endDate },
          },
        },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
    ]);

    // ═══ Parse results ═══
    let totalWagered = 0;
    let totalPaidOut = 0;
    for (const row of wageringAgg) {
      if (row._id === 'buy') totalWagered = row.totalAmount || 0;
      if (row._id === 'win') totalPaidOut = row.totalAmount || 0;
    }
    const ggr = totalWagered - totalPaidOut;

    const totalStakedToday = stakedTodayResult[0]?.total || 0;
    const totalStakedWeek  = stakedWeekResult[0]?.total  || 0;
    const totalStakedMonth = stakedMonthResult[0]?.total || 0;

    const depositsTotal = depositsAgg[0]?.total || 0;
    const depositsCount = depositsAgg[0]?.count || 0;
    const withdrawalsTotal = withdrawalsAgg[0]?.total || 0;
    const withdrawalsCount = withdrawalsAgg[0]?.count || 0;
    const netCashFlow = depositsTotal - withdrawalsTotal;

    const totalETBCoins = liabilityAgg[0]?.totalETBCoins || 0;
    const totalWithdrawable = liabilityAgg[0]?.totalWithdrawable || 0;
    const totalLocked = liabilityAgg[0]?.totalLocked || 0;
    const totalBonus = liabilityAgg[0]?.totalBonus || 0;

    const commissionsTotal = commissionsAgg[0]?.total || 0;

    // ═══ Real Profit calculation ═══
    // Net realized cash position for the period:
    //   money_in    = deposits
    //   money_out   = withdrawals + commissions_paid
    //   Real profit = money_in − money_out − (net change in user liability)
    // Because liability change isn't fully reconstructable for a range,
    // we expose:
    //   - rangeCashFlow: deposits − withdrawals (unambiguous)
    //   - rangeCommissions: agent commissions paid out (extra outflow)
    //   - realizedCash: deposits − withdrawals − commissions
    //   - userLiability (current): Σ ETBCoins
    //   - netPosition: lifetime-ish cash position
    const realizedCash = depositsTotal - withdrawalsTotal - commissionsTotal;

    const response = {
      userStats,
      etbStats,
      cashFlow: {
        deposits: depositsTotal,
        depositCount: depositsCount,
        withdrawals: withdrawalsTotal,
        withdrawalCount: withdrawalsCount,
        commissions: commissionsTotal,
        netCashFlow,
        realizedCash,
      },
      liability: {
        totalETBCoins,
        totalWithdrawable,
        totalLocked,
        totalBonus,
      },
      profitStats: {
        ggr,
        totalStaked: totalWagered,
        totalPayout: totalPaidOut,
        roundCount: roundCountResult[0]?.count || 0,
        totalStakedToday,
        totalStakedWeek,
        totalStakedMonth,
        netProfit: ggr,
      },
    };

    await cacheSet(cacheKey, response, 30);
    res.setHeader('X-Cache', 'MISS');
    res.json(response);
  } catch (error) {
    logger.error('Stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
// ==================== USERS ====================
export const listUsers = async (req: Request, res: Response) => {
  try {
    const { 
      page = 1, limit = 20, search = '', status, agent, 
      balance: balanceFilter, sortBalance 
    } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    
    const query: any = {};
    
    if (search) {
      const safeSearch = sanitizeInput(String(search));
      const numericId = parseInt(safeSearch);
      const isNumeric = !isNaN(numericId) && numericId.toString() === safeSearch;
      
      if (isNumeric) {
        query.$or = [
          { telegramId: numericId },
          { username: { $regex: safeSearch, $options: 'i' } },
          { firstName: { $regex: safeSearch, $options: 'i' } }
        ];
      } else {
        query.$or = [
          { username: { $regex: safeSearch, $options: 'i' } },
          { firstName: { $regex: safeSearch, $options: 'i' } }
        ];
      }
    }
    
    // Status filter: active (not banned) or banned
    if (status === 'active') query.isBanned = false;
    if (status === 'banned') query.isBanned = true;
    
    // Agent filter: yes (isAgent true) or no (isAgent false)
    if (agent === 'yes') query.isAgent = true;
    if (agent === 'no') query.isAgent = false;
    
    // Balance filter
    if (balanceFilter === 'yes') query.ETBCoins = { $gt: 0 };
    if (balanceFilter === 'no')  query.ETBCoins = 0;
    
    // Sorting
    let sortOption: any = { createdAt: -1 }; // default
    if (sortBalance === 'asc')   sortOption = { ETBCoins: 1 };
    if (sortBalance === 'desc')  sortOption = { ETBCoins: -1 };
    
    const users = await User.find(query)
      .select('-password')
      .sort(sortOption)
      .skip(skip)
      .limit(Number(limit))
      .lean();
    
    const total = await User.countDocuments(query);
    res.json({ users, total, page: Number(page), limit: Number(limit) });
  } catch (error) {
    logger.error('List users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getUserDetails = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    logger.error('User details error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const banUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminUser = (req as any).user; // current logged-in admin
    
    const userToBan = await User.findById(id);
    if (!userToBan) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Prevent banning admins
    if (userToBan.isAdmin) {
      return res.status(403).json({ error: 'Cannot ban an admin user' });
    }
    
    // Prevent self-ban
    if (userToBan._id.toString() === adminUser._id.toString()) {
      return res.status(403).json({ error: 'You cannot ban yourself' });
    }
    
    userToBan.isBanned = true;
    userToBan.banReason = reason;
    await userToBan.save();
    
    // Notify the banned user
    const notificationService = new NotificationService();
    await notificationService.sendUserBanned(userToBan.telegramId, reason);
    
    res.json({ success: true });
  } catch (error) {
    logger.error('Ban user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const unbanUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    user.isBanned = false;
    user.banReason = undefined;
    await user.save();
    
    // Notify the unbanned user
    const notificationService = new NotificationService();
    await notificationService.sendUserUnbanned(user.telegramId);
    
    res.json({ success: true });
  } catch (error) {
    logger.error('Unban user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ==================== BROADCAST ====================
export const createBroadcast = async (req: Request, res: Response) => {
  try {
    const { title, content, type, target, channels, templateId, imageBase64 } = req.body;
    const broadcastService = new BroadcastService();
    const adminUser = (req as any).user;

    let message: BroadcastMessage;
    if (templateId) {
      const template = await broadcastService.getTemplate(templateId);
      if (!template) return res.status(404).json({ error: 'Template not found' });
      message = {
        title: template.title,
        content: template.content,
        type: template.type,
        target: template.target,
        channels: template.channels
      };
    } else {
      message = { title, content, type, target, channels };
    }

    // Add "Play Now" link
    let botUsername = '';
    try {
      const settings = getCachedSettings();
      botUsername = settings.botUsername;
    } catch (err) {
      logger.warn('Failed to get bot username from settings cache:', err);
    }
    if (!botUsername || botUsername === 'undefined' || botUsername === '@undefined') {
      botUsername = 'ethio_bingoobot';
    }
    botUsername = botUsername.replace(/^@/, '');
    if (botUsername === 'ethio_bingoobot') {
      try {
        const notificationService = new NotificationService();
        const bot = await notificationService['ensureBot']();
        const me = await bot.api.getMe();
        if (me.username) {
          botUsername = me.username;
        }
      } catch (err) {
        logger.error('Failed to get bot username from instance:', err);
      }
    }
   const playLink = `👉 [Play Now](https://t.me/${botUsername}?start=start)`;
    if (!message.content.includes(playLink) && !message.content.includes('?start=start')) {
      message.content = `${message.content}\n\n${playLink}`;
    }

    // Pass imageBase64 to broadcast service (if provided)
    const result = await broadcastService.sendBroadcast(
      message,
      undefined,
      adminUser._id,
      adminUser.telegramId,
      imageBase64   // new optional parameter
    );
    res.json(result);
  } catch (error) {
    logger.error('Broadcast error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ==================== ETB DEPOSITS ====================
export const getPendingDeposits = async (req: Request, res: Response) => {
  try {
    const deposits = await ETBDeposit.find({ status: 'pending' })
      .populate('userId', 'telegramId username firstName')
      .sort({ createdAt: -1 });
    res.json(deposits);
  } catch (error) {
    logger.error('Pending deposits error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const confirmDeposit = async (req: Request, res: Response) => {
  try {
    const { requestId } = req.params;
    const adminUser = (req as any).user;
    const result = await ETBDepositService.confirmDeposit(requestId, adminUser._id);
    res.json(result);
  } catch (error) {
    logger.error('Confirm deposit error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const rejectDeposit = async (req: Request, res: Response) => {
  try {
    const { requestId } = req.params;
    const { reason } = req.body;
    const adminUser = (req as any).user;
    const result = await ETBDepositService.rejectDeposit(requestId, adminUser._id, reason);
    res.json(result);
  } catch (error) {
    logger.error('Reject deposit error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const adjustBalance = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { amount, reason, settingsPassword } = req.body; // <-- add settingsPassword

    // Verify password
    const settingsPassDoc = await SystemSettings.findOne({ key: 'settings_access_password' });
    if (!settingsPassDoc) return res.status(500).json({ error: 'Settings password not configured' });
    const valid = await bcrypt.compare(settingsPassword, settingsPassDoc.value);
    if (!valid) return res.status(403).json({ error: 'Invalid settings password' });

    if (amount === undefined || isNaN(amount)) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    const amountNum = Number(amount);
    
    // Use atomic update with condition for negative adjustments
    let updateQuery: any = {};
    let incUpdate: any = { ETBCoins: amountNum, balanceMain: amountNum };
    
    if (amountNum < 0) {
      const absAmount = Math.abs(amountNum);
      const user = await User.findById(id).select('balanceMain lockedBalance bonusBalance depositBalance');
      if (!user) return res.status(404).json({ error: 'User not found' });

      const total = (user.balanceMain || 0) + (user.lockedBalance || 0);
      if (total < absAmount) {
        return res.status(400).json({ error: `Insufficient total balance. Total: ${total}, requested deduction: ${absAmount}` });
      }

      const deductFromMain = Math.min(absAmount, user.balanceMain || 0);
      const deductFromLocked = absAmount - deductFromMain;

      // When deducting from locked, mirror the bonus → deposit → legacy order so the
      // sub-balance invariant (bonusBalance + depositBalance <= lockedBalance) holds.
      const takeFromBonus = Math.min(deductFromLocked, user.bonusBalance || 0);
      const afterBonus = deductFromLocked - takeFromBonus;
      const takeFromDeposit = Math.min(afterBonus, user.depositBalance || 0);

      incUpdate = {
        ETBCoins: -absAmount,
        balanceMain: -deductFromMain,
        lockedBalance: -deductFromLocked,
      };
      if (takeFromBonus > 0) incUpdate.bonusBalance = -takeFromBonus;
      if (takeFromDeposit > 0) incUpdate.depositBalance = -takeFromDeposit;
    }
    
    const updatedUser = await User.findByIdAndUpdate(
      id,
      { $inc: incUpdate },
      { new: true, runValidators: true }
    );
    
    if (!updatedUser) return res.status(404).json({ error: 'User not found' });

    // Record transaction (non-atomic but safe after increment)
    updatedUser.ETBCoinTransactions.push({
      type: amountNum > 0 ? 'earned' : 'redeemed',
      amount: Math.abs(amountNum),
      reference: `ADMIN-ADJUST-${Date.now()}`,
      notes: `Admin balance adjustment: ${amountNum >= 0 ? '+' : ''}${amountNum} ETB${reason ? ` (${reason})` : ''}`,
      timestamp: new Date(),
    });
    await updatedUser.save();
const adminUser = (req as any).user;
        // --- Ledger entry ---
    await recordLedger({
      userId: updatedUser._id,
      type: 'admin_adjustment',
      amount: amountNum,
      balanceAfter: updatedUser.ETBCoins,
      referenceId: `ADJ-${Date.now()}`,
      notes: `Admin adjustment${reason ? ': ' + reason : ''} by @${adminUser.username || adminUser._id}`,
    });

    // Log action
    
    await auditService.logAdminAction(
      adminUser._id,
      adminUser.telegramId,
      'BALANCE_ADJUSTED',
      'FINANCIAL',
      'User',
      updatedUser._id.toString(),
      { amount: amountNum, oldBalance: updatedUser.ETBCoins - amountNum, newBalance: updatedUser.ETBCoins, oldWithdrawable: updatedUser.balanceMain - amountNum, newWithdrawable: updatedUser.balanceMain }
    );

    // Notify user
    const notificationService = new NotificationService();
    await notificationService.sendBalanceAdjusted(
      updatedUser.telegramId,
      amountNum,
      updatedUser.ETBCoins,
      updatedUser.balanceMain,
      updatedUser.lockedBalance,
      reason,
      updatedUser.language
    );

    // Notify admins
    const escapedUsername = escapeMarkdown(updatedUser.username || updatedUser.telegramId.toString());

    await notificationService.sendAdminAlert(
      `🤑 Balance adjusted for user @${escapedUsername} (ID: ${updatedUser.telegramId})\n` +
      `Change: ${amountNum >= 0 ? '+' : ''}${amountNum.toFixed(2)} ETB\n` +
      `New total: ${updatedUser.ETBCoins.toFixed(2)} ETB\n` +
      `New withdrawable: ${updatedUser.balanceMain.toFixed(2)} ETB\n` +
      `By: @${escapeMarkdown(adminUser.username || adminUser._id.toString())}`,
      'info'
    );

    res.json({
      success: true,
      oldBalance: updatedUser.ETBCoins - amountNum,
      newBalance: updatedUser.ETBCoins,
      withdrawable: updatedUser.balanceMain,
      locked: updatedUser.lockedBalance,
    });
  } catch (error) {
    logger.error('Adjust balance error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ==================== ETB WITHDRAWALS ====================
export const getPendingWithdrawals = async (req: Request, res: Response) => {
  try {
    const withdrawals = await ETBWithdrawal.find({ status: 'pending' })
      .populate('userId', 'telegramId username firstName')
      .sort({ createdAt: -1 });
    res.json(withdrawals);
  } catch (error) {
    logger.error('Pending withdrawals error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const processWithdrawal = async (req: Request, res: Response) => {
  try {
    const { requestId } = req.params;
    const adminUser = (req as any).user;
    const result = await ETBWithdrawalService.processWithdrawal(requestId, adminUser._id);
    res.json(result);
  } catch (error) {
    logger.error('Process withdrawal error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const rejectWithdrawal = async (req: Request, res: Response) => {
  try {
    const { requestId } = req.params;
    const { reason } = req.body;
    const adminUser = (req as any).user;
    const result = await ETBWithdrawalService.rejectWithdrawal(requestId, adminUser._id, reason);
    res.json(result);
  } catch (error) {
    logger.error('Reject withdrawal error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ==================== PENDING COUNTS ====================
export const getPendingDepositsCount = async (req: Request, res: Response) => {
  try {
    const count = await ETBDeposit.countDocuments({ status: 'pending' });
    res.json({ count });
  } catch (error) {
    logger.error('Pending deposits count error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getPendingWithdrawalsCount = async (req: Request, res: Response) => {
  try {
    const count = await ETBWithdrawal.countDocuments({ status: 'pending' });
    res.json({ count });
  } catch (error) {
    logger.error('Pending withdrawals count error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ==================== USER TRANSACTIONS ====================
export const getUserTransactions = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { type, from, to, search, page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Fetch deposits and withdrawals with pagination separately
    const depositQuery: any = { userId: user._id };
    const withdrawalQuery: any = { userId: user._id };
    if (type && type !== 'all') {
      // We'll filter after fetch
    }
    if (from) depositQuery.createdAt = { $gte: new Date(from as string) };
    if (to) depositQuery.createdAt = { $lte: new Date(to as string) };
    if (search) {
      depositQuery.$or = [
        { requestId: { $regex: search, $options: 'i' } },
        { transactionId: { $regex: search, $options: 'i' } }
      ];
      withdrawalQuery.$or = [
        { requestId: { $regex: search, $options: 'i' } },
        { destinationDetails: { $regex: search, $options: 'i' } }
      ];
    }

    const deposits = await ETBDeposit.find(depositQuery)
      .sort({ createdAt: -1 })
      .lean();
    const withdrawals = await ETBWithdrawal.find(withdrawalQuery)
      .sort({ createdAt: -1 })
      .lean();

    // Combine and sort
    let all = [
      ...deposits.map(d => ({
        type: 'deposit' as const,
        requestId: d.requestId,
        amount: d.amountETB,
        method: d.method,
        status: d.status,
        transactionId: d.transactionId,
        accountDetails: d.accountDetails,
        createdAt: d.createdAt,
        adminNotes: d.adminNotes,
        senderName: d.senderName,
        receiverName: d.receiverName,
        extractedAmount: d.extractedAmount,
        extractedDate: d.extractedDate,
        receiptLink: d.receiptLink,
      })),
      ...withdrawals.map(w => ({
        type: 'withdrawal' as const,
        requestId: w.requestId,
        amount: w.amountETB,
        method: w.method,
        status: w.status,
        destinationDetails: w.destinationDetails,
        createdAt: w.createdAt,
        adminNotes: w.adminNotes,
      })),
    ];

    // Apply type filter
    if (type && type !== 'all') {
      all = all.filter(tx => tx.type === type);
    }

    // Sort by date descending (already sorted but after combine)
    all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const total = all.length;
    const paginated = all.slice(skip, skip + Number(limit));

    res.json({
      transactions: paginated,
      count: total,
      totalPages: Math.ceil(total / Number(limit)),
      page: Number(page),
      limit: Number(limit)
    });
  } catch (error) {
    logger.error('Get user transactions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get all settings
export const getSettings = async (req: Request, res: Response) => {
  try {
    const settings = await SystemSettings.find();
    const settingsObj: Record<string, any> = {};
    for (const s of settings) {
      settingsObj[s.key] = s.value;
    }
    res.json(settingsObj);
  } catch (error) {
    logger.error('Get settings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

//verify settings password
export const verifySettingsPassword = async (req: Request, res: Response) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'Password required' });

    const settingsPassDoc = await SystemSettings.findOne({ key: 'settings_access_password' });
    if (!settingsPassDoc) {
      return res.status(500).json({ error: 'Settings access password not configured' });
    }
    const valid = await bcrypt.compare(password, settingsPassDoc.value);
    if (!valid) {
      return res.status(403).json({ error: 'Invalid password' });
    }
    res.json({ success: true });
  } catch (error) {
    logger.error('Verify settings password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

//  updateSetting accept settingsPassword
export const updateSetting = async (req: Request, res: Response) => {
  try {
    const { key, value, settingsPassword } = req.body;
    if (!key) return res.status(400).json({ error: 'Key required' });

    // Verify settings access password
    const settingsPassDoc = await SystemSettings.findOne({ key: 'settings_access_password' });
    if (!settingsPassDoc) {
      return res.status(500).json({ error: 'Settings access password not configured' });
    }
    const valid = await bcrypt.compare(settingsPassword, settingsPassDoc.value);
    if (!valid) {
      return res.status(403).json({ error: 'Invalid settings password' });
    }

    const adminUser = (req as any).user;
    const updated = await SystemSettings.findOneAndUpdate(
      { key },
      { value, updatedAt: new Date(), updatedBy: adminUser._id },
      { upsert: true, new: true }
    );

    // Refresh simple cache (settings.ts)
    refreshSettings();

    // ✅ Refresh main settings cache (settingsCache.ts) – this fixes the issue
    const { loadSettings } = await import('../core/utils/settingsCache');
    await loadSettings();

    // Notify admins
    const notificationService = new NotificationService();
    const adminIdsStr = await getSettingString('admin_ids');
    const adminIds = adminIdsStr.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
    for (const adminId of adminIds) {
      await notificationService.sendAdminAlert(
        `🔧 Setting *${key}* was changed by @${adminUser.username || adminUser._id} to:\n${JSON.stringify(value)}`,
        'info'
      );
    }

    res.json({ success: true, setting: updated });
  } catch (error) {
    logger.error('Update setting error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get pending agent requests
export const getPendingAgentRequests = async (req: Request, res: Response) => {
  try {
    const requests = await agentService.getPendingRequests();
    res.json(requests);
  } catch (error) {
    logger.error('Get pending agent requests error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Approve agent request
export const approveAgentRequest = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'Request ID required' });
    const adminUser = (req as any).user;
    const result = await agentService.approveAgentRequest(id as string, adminUser._id);
    res.json(result);
  } catch (error: any) {
    logger.error('Approve agent request error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Reject agent request
export const rejectAgentRequest = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    if (!id) return res.status(400).json({ error: 'Request ID required' });
    const adminUser = (req as any).user;
    const result = await agentService.rejectAgentRequest(id as string, adminUser._id, reason);
    res.json(result);
  } catch (error: any) {
    logger.error('Reject agent request error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const getPendingAgentRequestsCount = async (req: Request, res: Response) => {
  try {
    const count = await AgentRequest.countDocuments({ status: 'pending' });
    res.json({ count });
  } catch (error) {
    logger.error('Get pending agent requests count error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ==================== BROADCAST TEMPLATES ====================
export const getBroadcastTemplates = async (req: Request, res: Response) => {
  try {
    const broadcastService = new BroadcastService();
    const templates = await broadcastService.getTemplates();
    res.json(templates);
  } catch (error) {
    logger.error('Get templates error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createBroadcastTemplate = async (req: Request, res: Response) => {
  try {
    const { name, title, content, type, target, channels } = req.body;
    const adminUser = (req as any).user;
    const broadcastService = new BroadcastService();
    const template = await broadcastService.createTemplate({
      name,
      title,
      content,
      type,
      target,
      channels,
      isActive: true,
    }, adminUser._id);
    res.json(template);
  } catch (error) {
    logger.error('Create template error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateBroadcastTemplate = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Invalid template ID' });
    }
    const updates = req.body;
    const broadcastService = new BroadcastService();
    const template = await broadcastService.updateTemplate(id, updates);
    if (!template) return res.status(404).json({ error: 'Template not found' });
    res.json(template);
  } catch (error) {
    logger.error('Update template error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteBroadcastTemplate = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Invalid template ID' });
    }
    const broadcastService = new BroadcastService();
    const deleted = await broadcastService.deleteTemplate(id);
    if (!deleted) return res.status(404).json({ error: 'Template not found' });
    res.json({ success: true });
  } catch (error) {
    logger.error('Delete template error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const pauseBot = async (req: Request, res: Response) => {
  try {
    const { settingsPassword } = req.body;
    const settingsPassDoc = await SystemSettings.findOne({ key: 'settings_access_password' });
    if (!settingsPassDoc) return res.status(500).json({ error: 'Settings password not configured' });
    const valid = await bcrypt.compare(settingsPassword, settingsPassDoc.value);
    if (!valid) return res.status(403).json({ error: 'Invalid password' });

    const adminUser = (req as any).user;
    const result = await operatorService.pause(adminUser._id, adminUser.telegramId);
    if (result) {
      const notificationService = new NotificationService();
      await notificationService.sendAdminAlert(
        `⏸️ Bot paused by @${adminUser.username || adminUser._id}`,
        'warning'
      );
    }
    res.json({ success: result, isActive: false });
  } catch (error) {
    logger.error('Pause bot error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const resumeBot = async (req: Request, res: Response) => {
  try {
    const { settingsPassword } = req.body;
    const settingsPassDoc = await SystemSettings.findOne({ key: 'settings_access_password' });
    if (!settingsPassDoc) return res.status(500).json({ error: 'Settings password not configured' });
    const valid = await bcrypt.compare(settingsPassword, settingsPassDoc.value);
    if (!valid) return res.status(403).json({ error: 'Invalid password' });

    const adminUser = (req as any).user;
    const result = await operatorService.resume(adminUser._id, adminUser.telegramId);
    if (result) {
      const notificationService = new NotificationService();
      await notificationService.sendAdminAlert(
        `▶️ Bot resumed by @${adminUser.username || adminUser._id}`,
        'info'
      );
    }
    res.json({ success: result, isActive: true });
  } catch (error) {
    logger.error('Resume bot error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getBotStatus = async (req: Request, res: Response) => {
  try {
    const operator = await operatorService.getOperator();
    res.json({ isActive: operator.isActive });
  } catch (error) {
    logger.error('Get bot status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getAdvancedStats = async (req: Request, res: Response) => {
  try {
    let { from, to } = req.query;
    const cacheKey = statsCacheKey('admin:stats:advanced', from as string, to as string);
    const cached = await cacheGet<any>(cacheKey);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(cached);
    }
    let startDate: Date, endDate: Date;
    if (from) {
      startDate = new Date(from as string);
      startDate.setHours(0, 0, 0, 0);
    } else {
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      startDate.setHours(0, 0, 0, 0);
    }
    if (to) {
      endDate = new Date(to as string);
      endDate.setHours(23, 59, 59, 999);
    } else {
      endDate = new Date();
      endDate.setHours(23, 59, 59, 999);
    }

    // ═══ Run ALL aggregations in parallel ═══
    const [
      userRegistrations,
      activeUsers,
      dailyDeposits,
      dailyWithdrawals,
      dailyProfit,
    ] = await Promise.all([
      User.aggregate([
        { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      User.aggregate([
        { $match: { lastLoginAt: { $gte: startDate, $lte: endDate } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$lastLoginAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      ETBDeposit.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate, $lte: endDate },
            status: 'confirmed',
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$confirmedAt' } },
            totalAmount: { $sum: '$amountETB' },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      ETBWithdrawal.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate, $lte: endDate },
            status: 'processed',
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$processedAt' } },
            totalAmount: { $sum: '$amountETB' },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // Daily profit — real users only, from wagering (GGR per day)
      UserBetHistory.aggregate([
        {
          $match: {
            userId: { $not: /^bot_/i },
            action: { $in: ['buy', 'win'] },
            createdAt: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
              action: '$action',
            },
            total: { $sum: '$amount' },
          },
        },
        {
          $group: {
            _id: '$_id.date',
            totalStaked: {
              $sum: { $cond: [{ $eq: ['$_id.action', 'buy'] }, '$total', 0] },
            },
            totalPayout: {
              $sum: { $cond: [{ $eq: ['$_id.action', 'win'] }, '$total', 0] },
            },
          },
        },
        {
          $project: {
            _id: '$_id',
            totalStaked: 1,
            totalPayout: 1,
            netProfit: { $subtract: ['$totalStaked', '$totalPayout'] },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    const response = {
      userRegistrations,
      activeUsers,
      dailyDeposits,
      dailyWithdrawals,
      dailyProfit,
      dailyETBEarned: [],
    };

    await cacheSet(cacheKey, response, 60);
    res.setHeader('X-Cache', 'MISS');
    res.json(response);
  } catch (error) {
    logger.error('Advanced stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ==================== DEPOSITS (all statuses) ====================
export const getDeposits = async (req: Request, res: Response) => {
  try {
    const { status, page = 1, limit = 20, search } = req.query;
    const query: any = {};
    if (status && status !== 'all') query.status = status;

    if (search) {
      const safeSearch = sanitizeInput(String(search));
      const numericId = parseInt(safeSearch);
      const isNumeric = !isNaN(numericId) && numericId.toString() === safeSearch;

      query.$or = [
        { requestId: { $regex: safeSearch, $options: 'i' } },
        { transactionId: { $regex: safeSearch, $options: 'i' } },
        { accountDetails: { $regex: safeSearch, $options: 'i' } },
        { 'userId.username': { $regex: safeSearch, $options: 'i' } },
        { 'userId.telegramId': isNumeric ? numericId : undefined },
      ].filter(Boolean);
    }

    const skip = (Number(page) - 1) * Number(limit);
    const deposits = await ETBDeposit.find(query)
      .populate('userId', 'telegramId username firstName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();
    const total = await ETBDeposit.countDocuments(query);
    res.json({ deposits, total, page: Number(page), limit: Number(limit) });
  } catch (error) {
    logger.error('Get deposits error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ==================== WITHDRAWALS (all statuses) ====================
export const getWithdrawals = async (req: Request, res: Response) => {
  try {
    const { status, page = 1, limit = 20, search } = req.query;
    const query: any = {};
    if (status && status !== 'all') query.status = status;

    // --- Search logic ---
    if (search) {
      const safeSearch = sanitizeInput(String(search));
      const isNumeric = /^\d+$/.test(safeSearch);
      const conditions: any[] = [];

      // Search by request ID and destination details (always)
      conditions.push(
        { requestId: { $regex: safeSearch, $options: 'i' } },
        { destinationDetails: { $regex: safeSearch, $options: 'i' } }
      );

      // If search is numeric, try to find users by telegramId
      if (isNumeric) {
        const numericId = parseInt(safeSearch, 10);
        const users = await User.find({ telegramId: numericId }).select('_id').lean();
        if (users.length) {
          conditions.push({ userId: { $in: users.map(u => u._id) } });
        }
      } else {
        // Otherwise, try to find users by username (partial match)
        const users = await User.find({ username: { $regex: safeSearch, $options: 'i' } }).select('_id').lean();
        if (users.length) {
          conditions.push({ userId: { $in: users.map(u => u._id) } });
        }
      }

      // Remove any empty condition (like when no users found)
      query.$or = conditions.filter(c => Object.keys(c).length > 0);
    }

    const skip = (Number(page) - 1) * Number(limit);
    const withdrawals = await ETBWithdrawal.find(query)
      .populate('userId', 'telegramId username firstName')
      .populate('processedBy', 'username')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();
    const total = await ETBWithdrawal.countDocuments(query);

    res.json({ withdrawals, total, page: Number(page), limit: Number(limit) });
  } catch (error) {
    logger.error('Get withdrawals error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const convertLockedETB = async (req: Request, res: Response) => {
  try {
    const { telegramId, amount, settingsPassword } = req.body; // <-- add settingsPassword

    // Verify password
    const settingsPassDoc = await SystemSettings.findOne({ key: 'settings_access_password' });
    if (!settingsPassDoc) return res.status(500).json({ error: 'Settings password not configured' });
    const valid = await bcrypt.compare(settingsPassword, settingsPassDoc.value);
    if (!valid) return res.status(403).json({ error: 'Invalid settings password' });

    if (!telegramId || !amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid telegramId or amount' });
    }

    
    const amountNum = Number(amount);

    // Snapshot current sub-balances so we can decrement them in lockstep.
    const snapshot = await User.findOne({ telegramId: parseInt(telegramId) })
      .select('lockedBalance bonusBalance depositBalance')
      .lean();

    if (!snapshot) {
      return res.status(404).json({ error: 'User not found' });
    }
    if ((snapshot.lockedBalance || 0) < amountNum) {
      return res.status(404).json({ error: 'User not found or insufficient locked balance' });
    }

    // Mirror the bonus → deposit → legacy spend order used in bingo.ts so the
    // invariant (bonusBalance + depositBalance <= lockedBalance) holds.
    const takeFromBonus = Math.min(amountNum, snapshot.bonusBalance || 0);
    const afterBonus = amountNum - takeFromBonus;
    const takeFromDeposit = Math.min(afterBonus, snapshot.depositBalance || 0);
    // remainder is legacy residual — no dedicated field

    const inc: Record<string, number> = {
      balanceMain: amountNum,
      lockedBalance: -amountNum,
    };
    if (takeFromBonus > 0) inc.bonusBalance = -takeFromBonus;
    if (takeFromDeposit > 0) inc.depositBalance = -takeFromDeposit;

    // Guard at the total level still protects against concurrent double-spend.
    const user = await User.findOneAndUpdate(
      { telegramId: parseInt(telegramId), lockedBalance: { $gte: amountNum } },
      {
        $inc: inc,
            $push: {
              ETBCoinTransactions: {
                type: 'earned',
                amount: amountNum,
                reference: `CONVERT-${Date.now()}`,
                notes: `Converted locked balance to withdrawable by admin`,
                timestamp: new Date(),
              }
            }
          },
          { new: true, runValidators: true }
        );
        
    if (!user) {
      return res.status(404).json({ error: 'User not found or insufficient locked balance' });
    }

 const adminUser = (req as any).user;
        // --- Ledger entry ---
    await recordLedger({
      userId: user._id,
      type: 'convert_locked',
      amount: 0, // no change to total ETBCoins
      balanceAfter: user.ETBCoins,
      referenceId: `CONV-${Date.now()}`,
      notes: `Converted ${amountNum} ETB from locked to withdrawable by admin @${adminUser.username || adminUser._id}`,
    });

   
    await auditService.logAdminAction(
      adminUser._id,
      adminUser.telegramId,
      'CONVERT_LOCKED_BALANCE',
      'FINANCIAL',
      'User',
      user._id.toString(),
      { telegramId, amount: amountNum, oldLocked: user.lockedBalance + amountNum, newLocked: user.lockedBalance, oldBalanceMain: user.balanceMain - amountNum, newBalanceMain: user.balanceMain }
    );

    const notificationService = new NotificationService();
    await notificationService.sendBalanceConverted(
      user.telegramId,
      amountNum,
      user.balanceMain,
      user.lockedBalance,
      user.language
    );

    // Notify admins
    const adminIdsStr = await getSettingString('admin_ids');
    const adminIds = adminIdsStr.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
    for (const adminId of adminIds) {
      await notificationService.sendAdminAlert(
        `🔄 Balance conversion for user @${user.username || user.telegramId} (ID: ${user.telegramId})\n` +
        `Converted: ${amountNum.toFixed(2)} ETB\n` +
        `New withdrawable: ${user.balanceMain.toFixed(2)} ETB\n` +
        `By: @${adminUser.username || adminUser._id}`,
        'info'
      );
    }

    res.json({
      success: true,
      newBalanceMain: user.balanceMain,
      newLocked: user.lockedBalance
    });
  } catch (error) {
    logger.error('Convert locked balance error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getUserBetHistory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20, search } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const query: any = { userId: id };
    if (search) {
      query.$or = [
        { roundId: { $regex: search, $options: 'i' } },
        { cardId: { $regex: search, $options: 'i' } }
      ];
    }

    const bets = await UserBetHistory.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    const total = await UserBetHistory.countDocuments(query);

    res.json({ bets, total, page: Number(page), limit: Number(limit) });
  } catch (error) {
    logger.error('Get user bet history error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
// ==================== GAME PAUSE/RESUME ====================
export const pauseGame = async (req: Request, res: Response) => {
  try {
    const { settingsPassword } = req.body;
    const settingsPassDoc = await SystemSettings.findOne({ key: 'settings_access_password' });
    if (!settingsPassDoc) return res.status(500).json({ error: 'Settings password not configured' });
    const valid = await bcrypt.compare(settingsPassword, settingsPassDoc.value);
    if (!valid) return res.status(403).json({ error: 'Invalid password' });

    const adminUser = (req as any).user;
    await SystemSettings.findOneAndUpdate(
      { key: 'game_paused' },
      { value: true, updatedAt: new Date(), updatedBy: adminUser._id },
      { upsert: true }
    );
    refreshSettings();
    const { loadSettings } = await import('../core/utils/settingsCache');
    await loadSettings();

    // ✅ Fire and forget – do NOT await
    notifyGameStatusChange('paused', adminUser.telegramId).catch(err => {
      logger.error('Background notification failed:', err);
    });

    res.json({ success: true, gamePaused: true });
  } catch (error) {
    logger.error('Pause game error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const resumeGame = async (req: Request, res: Response) => {
  try {
    const { settingsPassword } = req.body;
    const settingsPassDoc = await SystemSettings.findOne({ key: 'settings_access_password' });
    if (!settingsPassDoc) return res.status(500).json({ error: 'Settings password not configured' });
    const valid = await bcrypt.compare(settingsPassword, settingsPassDoc.value);
    if (!valid) return res.status(403).json({ error: 'Invalid password' });

    const adminUser = (req as any).user;
    await SystemSettings.findOneAndUpdate(
      { key: 'game_paused' },
      { value: false, updatedAt: new Date(), updatedBy: adminUser._id },
      { upsert: true }
    );
    refreshSettings();
    const { loadSettings } = await import('../core/utils/settingsCache');
    await loadSettings();

    // ✅ Fire and forget
    notifyGameStatusChange('resumed', adminUser.telegramId).catch(err => {
      logger.error('Background notification failed:', err);
    });

    res.json({ success: true, gamePaused: false });
  } catch (error) {
    logger.error('Resume game error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Helper to broadcast notifications to all users and admins
async function notifyGameStatusChange(status: 'paused' | 'resumed', adminTelegramId: number) {
  const { NotificationService } = await import('../services/notificationService');
  const notification = new NotificationService();
  const bot = await notification['ensureBot']();

  // 1. Broadcast to game engine with a 5-second timeout
const gameEngineUrl = process.env.ENGINE_URL;
if (gameEngineUrl) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  try {
    await fetch(`${gameEngineUrl}/admin/game/pause-broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paused: status === 'paused' }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    logger.info(`Broadcast to game engine: game ${status}`);
  } catch (err: any) {
    clearTimeout(timeoutId);
    logger.error(`Failed to broadcast to game engine: ${err.message}`);
  }
}

  // 2. Notify all users via Telegram (already implemented)
  const users = await User.find({}).select('telegramId language').lean();
  const messageKey = status === 'paused' ? 'game.paused_message' : 'game.resumed_message';
  const titleKey = status === 'paused' ? 'game.paused_title' : 'game.resumed_title';

  for (const user of users) {
    const lang = user.language || 'en';
    const title = t(lang, titleKey);
    const body = t(lang, messageKey);
    const fullMessage = `🚨 *${title}*\n\n${body}`;
    try {
      await bot.api.sendMessage(user.telegramId, fullMessage, { parse_mode: 'Markdown' });
    } catch (err) {
      logger.error(`Failed to notify user ${user.telegramId}:`, err);
    }
  }

  // 3. Admin alert
  const adminUser = await User.findOne({ telegramId: adminTelegramId });
  const adminUsername = adminUser?.username || adminTelegramId.toString();

  await notification.sendAdminAlert(
    `Game ${status.toUpperCase()} by @${adminUsername}`,
    status === 'paused' ? 'warning' : 'info'
  );
}

export const getAdminActions = async (req: Request, res: Response) => {
  try {
    const { adminId, from, to } = req.query;
    
    // Build match stages for deposits and withdrawals
    const depositMatch: any = {};
    const withdrawalMatch: any = {};
    
    if (adminId) {
      depositMatch.confirmedBy = new mongoose.Types.ObjectId(adminId as string);
      withdrawalMatch.processedBy = new mongoose.Types.ObjectId(adminId as string);
    }
    
    if (from) {
      const fromDate = new Date(from as string);
      fromDate.setHours(0,0,0,0);
      depositMatch.confirmedAt = { $gte: fromDate };
      withdrawalMatch.processedAt = { $gte: fromDate };
    }
    if (to) {
      const toDate = new Date(to as string);
      toDate.setHours(23,59,59,999);
      if (depositMatch.confirmedAt) depositMatch.confirmedAt.$lte = toDate;
      else depositMatch.confirmedAt = { $lte: toDate };
      if (withdrawalMatch.processedAt) withdrawalMatch.processedAt.$lte = toDate;
      else withdrawalMatch.processedAt = { $lte: toDate };
    }
    
    // Fetch deposits (confirmed and rejected)
    const deposits = await ETBDeposit.find({
      ...depositMatch,
      status: { $in: ['confirmed', 'rejected'] }
    })
      .populate('userId', 'telegramId username firstName')
      .populate('confirmedBy', 'username firstName')
      .lean() as any[];
    
    // Fetch withdrawals (processed and rejected)
    const withdrawals = await ETBWithdrawal.find({
      ...withdrawalMatch,
      status: { $in: ['processed', 'rejected'] }
    })
      .populate('userId', 'telegramId username firstName')
      .populate('processedBy', 'username firstName')
      .lean() as any[];
    
    // Combine and map to unified format
    const actions = [
      ...deposits.map(d => ({
        type: 'deposit',
        requestId: d.requestId,
        amount: d.amountETB,
        method: d.method,
        status: d.status,
        user: d.userId,
        admin: d.confirmedBy,
        adminId: d.confirmedBy?._id,
        adminName: d.confirmedBy?.username || d.confirmedBy?.firstName,
        timestamp: d.confirmedAt || d.updatedAt,
        notes: d.adminNotes,
      })),
      ...withdrawals.map(w => ({
        type: 'withdrawal',
        requestId: w.requestId,
        amount: w.amountETB,
        method: w.method,
        status: w.status,
        user: w.userId,
        admin: w.processedBy,
        adminId: w.processedBy?._id,
        adminName: w.processedBy?.username || w.processedBy?.firstName,
        timestamp: w.processedAt || w.updatedAt,
        notes: w.adminNotes,
      }))
    ];
    
    // Sort by timestamp descending
    actions.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    // Daily totals (optional)
    const dailyTotals = await Promise.all([
      ETBDeposit.aggregate([
        { $match: { status: 'confirmed', confirmedAt: depositMatch.confirmedAt } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$confirmedAt' } }, total: { $sum: '$amountETB' } } },
        { $sort: { _id: 1 } }
      ]),
      ETBWithdrawal.aggregate([
        { $match: { status: 'processed', processedAt: withdrawalMatch.processedAt } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$processedAt' } }, total: { $sum: '$amountETB' } } },
        { $sort: { _id: 1 } }
      ])
    ]);
    
    res.json({
      actions,
      dailyDeposits: dailyTotals[0],
      dailyWithdrawals: dailyTotals[1]
    });
  } catch (error) {
    logger.error('Admin actions report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const verifyDeposit = async (req: Request, res: Response) => {
  try {
    const { requestId } = req.params;
    const deposit = await ETBDeposit.findOne({ requestId }).lean();
    if (!deposit) return res.status(404).json({ error: 'Deposit not found' });
    
    const unclaimed = await UnclaimedReceipt.findOne({ transactionId: deposit.transactionId });
    res.json({ 
      exists: !!unclaimed,
      unclaimedId: unclaimed?._id,
      matched: unclaimed?.matched || false
    });
  } catch (error) {
    logger.error('Verify deposit error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
// GET /admin/round-winners
export const getRoundWinners = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 20, roundId, userId, from, to } = req.query;
    const query: any = {};

    if (roundId) query.roundId = { $regex: sanitizeInput(String(roundId)), $options: 'i' };
    if (userId) query.userId = userId;
    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from as string);
      if (to) query.createdAt.$lte = new Date(to as string);
    }

    const skip = (Number(page) - 1) * Number(limit);
    const winners = await RoundWinner.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    const total = await RoundWinner.countDocuments(query);

    // Fetch drawnBalls for each unique round
    const roundIds = [...new Set(winners.map(w => w.roundId))];
    const rounds = await RoundProfit.find(
      { roundId: { $in: roundIds } },
      { roundId: 1, drawnBalls: 1 }
    ).lean();
    const drawnBallsMap = new Map(rounds.map(r => [r.roundId, r.drawnBalls || []]));

    // Attach user details and drawnBalls
    const populated = await Promise.all(
      winners.map(async (w) => {
        const user = await User.findOne({ _id: w.userId })
          .select('username firstName telegramId')
          .lean();
        return {
          ...w,
          user,
          drawnBalls: drawnBallsMap.get(w.roundId) || [],
        };
      })
    );

    res.json({ winners: populated, total, page: Number(page), limit: Number(limit) });
  } catch (error) {
    logger.error('Get round winners error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// DELETE /admin/round-winners/:id (force cleanup)
export const deleteRoundWinner = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { settingsPassword } = req.body;

    // Verify settings password
    const settingsPassDoc = await SystemSettings.findOne({ key: 'settings_access_password' });
    if (!settingsPassDoc) return res.status(500).json({ error: 'Settings password not configured' });
    const valid = await bcrypt.compare(settingsPassword, settingsPassDoc.value);
    if (!valid) return res.status(403).json({ error: 'Invalid settings password' });

    const deleted = await RoundWinner.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ error: 'Winner record not found' });

    const adminUser = (req as any).user;
    await auditService.logAdminAction(
      adminUser._id,
      adminUser.telegramId,
      'DELETE_WINNER_RECORD',
      'DELETE',
      'RoundWinner',
      id,
      { userId: deleted.userId, roundId: deleted.roundId, winAmount: deleted.winAmount }
    );

    res.json({ success: true });
  } catch (error) {
    logger.error('Delete round winner error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ═══════════════════════════════════════════════════════════════
// WEEKLY REWARDS
// ═══════════════════════════════════════════════════════════════

export const getWeeklyTopDepositors = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '10'), 10)));
    const skip = (page - 1) * limit;

    const rawOffset = parseInt(String(req.query.weekOffset ?? '0'), 10);
    const weekOffset = Number.isFinite(rawOffset) && rawOffset <= 0 ? rawOffset : 0;

    const wr = weeklyRewardService.getWeekRange(weekOffset);
    const settings = getCachedSettings();

    const [rows, total] = await Promise.all([
      weeklyRewardService.getTopDepositors(wr.weekStart, wr.weekEnd, limit, skip),
      weeklyRewardService.countTopDepositors(wr.weekStart, wr.weekEnd),
    ]);

    const users = rows.map((u, i) => ({
      ...u,
      rank: skip + i + 1,
      rewardAmount: weeklyRewardService.calculateRewardAmount(
        skip + i + 1,
        settings.depositorRewardRules as any
      ),
    }));

    res.json({
      users,
      total,
      page,
      limit,
      weekRange: wr,
      weekOffset,
      isCurrentWeek: weekOffset === 0,
    });
  } catch (error) {
    logger.error('Weekly top depositors error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getWeeklyTopReferrers = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '10'), 10)));
    const skip = (page - 1) * limit;

    const rawOffset = parseInt(String(req.query.weekOffset ?? '0'), 10);
    const weekOffset = Number.isFinite(rawOffset) && rawOffset <= 0 ? rawOffset : 0;

    const wr = weeklyRewardService.getWeekRange(weekOffset);
    const settings = getCachedSettings();

    const [rows, total] = await Promise.all([
      weeklyRewardService.getTopReferrers(wr.weekStart, wr.weekEnd, limit, skip),
      weeklyRewardService.countTopReferrers(wr.weekStart, wr.weekEnd),
    ]);

    const users = rows.map((u, i) => ({
      ...u,
      rank: skip + i + 1,
      rewardAmount: weeklyRewardService.calculateRewardAmount(
        skip + i + 1,
        settings.referrerRewardRules as any
      ),
    }));

    res.json({
      users,
      total,
      page,
      limit,
      weekRange: wr,
      weekOffset,
      isCurrentWeek: weekOffset === 0,
    });
  } catch (error) {
    logger.error('Weekly top referrers error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const previewWeeklyReward = async (req: Request, res: Response) => {
  try {
    const type = (req.query.type as RewardType) || 'depositor';
    if (type !== 'depositor' && type !== 'referrer') {
      return res.status(400).json({ error: 'Invalid type' });
    }

    const rawOffset = parseInt(String(req.query.weekOffset ?? '0'), 10);
    const weekOffset = Number.isFinite(rawOffset) && rawOffset <= 0 ? rawOffset : 0;

    const wr = weeklyRewardService.getWeekRange(weekOffset);
    const result = await weeklyRewardService.preview(type, wr);

    res.json({
      ...result,
      weekOffset,
      isCurrentWeek: weekOffset === 0,
    });
  } catch (error) {
    logger.error('Preview weekly reward error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const payWeeklyRewardNow = async (req: Request, res: Response) => {
  try {
    const { type, settingsPassword } = req.body;
    if (type !== 'depositor' && type !== 'referrer') {
      return res.status(400).json({ error: 'Invalid type' });
    }
    if (!settingsPassword) return res.status(400).json({ error: 'Settings password required' });

    // Validate password first
    const passDoc = await SystemSettings.findOne({ key: 'settings_access_password' });
    if (!passDoc) return res.status(500).json({ error: 'Settings password not configured' });
    const valid = await bcrypt.compare(settingsPassword, passDoc.value);
    if (!valid) return res.status(403).json({ error: 'Invalid settings password' });

    const adminUser = (req as any).user;
    const result = await weeklyRewardService.processWeeklyPayouts(type, { adminId: adminUser._id });

    if (!result.success) {
      return res.status(400).json(result);
    }

    // Audit log
    await auditService.logAdminAction(
      adminUser._id,
      adminUser.telegramId,
      'WEEKLY_REWARD_PAID',
      'FINANCIAL',
      'WeeklyRewardPayout',
      result.weekId,
      {
        type,
        paidCount: result.paidCount,
        totalPaid: result.totalPaid,
      }
    );

    res.json(result);
  } catch (error) {
    logger.error('Pay weekly reward now error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getWeeklyRewardHistory = async (req: Request, res: Response) => {
  try {
    const type = (req.query.type as 'depositor' | 'referrer' | 'all') || 'all';
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '20'), 10)));
    const result = await weeklyRewardService.getHistory(type, page, limit);
    res.json(result);
  } catch (error) {
    logger.error('Weekly reward history error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const revertWeeklyReward = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { settingsPassword, reason } = req.body;
    if (!settingsPassword) return res.status(400).json({ error: 'Settings password required' });

    const adminUser = (req as any).user;
    const result = await weeklyRewardService.revertPayout(
      id as string,
      adminUser._id,
      adminUser.telegramId,
      settingsPassword,
      reason
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    await auditService.logAdminAction(
      adminUser._id,
      adminUser.telegramId,
      'WEEKLY_REWARD_REVERTED',
      'FINANCIAL',
      'WeeklyRewardPayout',
      id as string,
      {
        revertedAmount: result.revertedAmount,
        rewardAmount: result.rewardAmount,
        reason,
      }
    );

    res.json(result);
  } catch (error) {
    logger.error('Revert weekly reward error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getWeeklyRewardStatus = async (_req: Request, res: Response) => {
  try {
    const settings = getCachedSettings();
    const wr = weeklyRewardService.getPreviousWeekRange();
    res.json({
      weekRange: wr,
      depositor: {
        enabled: settings.depositorRewardEnabled,
        autoEnabled: settings.depositorRewardAutoEnabled,
        topCount: settings.depositorRewardTopCount,
        rules: settings.depositorRewardRules,
      },
      referrer: {
        enabled: settings.referrerRewardEnabled,
        autoEnabled: settings.referrerRewardAutoEnabled,
        topCount: settings.referrerRewardTopCount,
        rules: settings.referrerRewardRules,
      },
    });
  } catch (error) {
    logger.error('Weekly reward status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ==================== AGENT MANAGEMENT (all admins) ====================

/**
 * Search user by username, telegram id or phone (2519...)
 */
export const searchUserForAgent = async (req: Request, res: Response) => {
  try {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: 'Query is required' });

    const raw = sanitizeInput(query).trim();

    let user;

    // 1) Telegram ID
    if (/^\d+$/.test(raw)) {
      user = await User.findOne({ telegramId: parseInt(raw, 10) })
        .select('-password')
        .lean();
    }

    // 2) Phone (09..., 251..., +251...)
    if (!user) {
      const phone = raw.replace(/[^0-9]/g, '');
      if (phone.length >= 9) {
        const normalized = phone.startsWith('0') ? '251' + phone.slice(1) : phone;
        user = await User.findOne({
          phoneNumber: { $regex: new RegExp(normalized) },
        })
          .select('-password')
          .lean();
      }
    }

    // 3) Username
    if (!user) {
      const username = raw.replace(/^@/, '');
      user = await User.findOne({
        username: { $regex: `^${username}$`, $options: 'i' },
      })
        .select('-password')
        .lean();
    }

    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({
      user: {
        telegramId: user.telegramId,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        phoneNumber: user.phoneNumber,
        isAdmin: user.isAdmin,
        isAgent: user.isAgent,
        agentApprovedAt: user.agentApprovedAt || null,
        isBanned: user.isBanned,
        referralCount: user.referralCount || 0,
        referralEarnings: user.referralEarnings || 0,
        totalCommissionPaid: user.totalCommissionPaid || 0,
      },
    });
  } catch (error) {
    logger.error('Search user for agent error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Upgrade user to agent
 */
export const upgradeUserToAgent = async (req: Request, res: Response) => {
  try {
    const { telegramId } = req.body;
    if (!telegramId) return res.status(400).json({ error: 'telegramId is required' });

    const user = await User.findOne({ telegramId: Number(telegramId) });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.isAgent) return res.status(400).json({ error: 'User is already an agent' });

    user.isAgent = true;
    user.agentApprovedAt = new Date();
    await user.save();

    const adminUser = (req as any).user;
    await auditService.logAdminAction(
      adminUser._id,
      adminUser.telegramId,
      'USER_UPGRADED_TO_AGENT',
      'SECURITY',
      'User',
      user._id.toString(),
      { telegramId: Number(telegramId) }
    );

    const notificationService = new NotificationService();
    await notificationService.sendAgentApproved(user.telegramId);

    await notificationService.sendAdminAlert(
      `👤 New Agent upgraded!\n\n` +
        `User: @${user.username || user.telegramId} (ID: ${user.telegramId})\n` +
        `Name: ${user.firstName} ${user.lastName || ''}\n` +
        `Upgraded by: @${adminUser.username || adminUser._id}`,
      'info'
    );

    res.json({ success: true, message: 'User upgraded to agent successfully' });
  } catch (error) {
    logger.error('Upgrade user to agent error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Revoke agent status
 */
export const revokeAgent = async (req: Request, res: Response) => {
  try {
    const { telegramId, settingsPassword } = req.body;

    // Verify password
    const settingsPassDoc = await SystemSettings.findOne({ key: 'settings_access_password' });
    if (!settingsPassDoc) return res.status(500).json({ error: 'Settings password not configured' });
    const valid = await bcrypt.compare(settingsPassword, settingsPassDoc.value);
    if (!valid) return res.status(403).json({ error: 'Invalid settings password' });

    if (!telegramId) return res.status(400).json({ error: 'telegramId is required' });

    const user = await User.findOne({ telegramId: Number(telegramId) });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!user.isAgent) return res.status(400).json({ error: 'User is not an agent' });

    user.isAgent = false;
    user.agentApprovedAt = undefined;
    await user.save();

    const adminUser = (req as any).user;
    await auditService.logAdminAction(
      adminUser._id,
      adminUser.telegramId,
      'AGENT_REVOKED',
      'SECURITY',
      'User',
      user._id.toString(),
      { telegramId: Number(telegramId) }
    );

    const notificationService = new NotificationService();
    await notificationService.sendAdminAlert(
      `⚠️ Agent status revoked!\n\n` +
        `User: @${user.username || user.telegramId} (ID: ${user.telegramId})\n` +
        `Revoked by: @${adminUser.username || adminUser._id}`,
      'warning'
    );

    res.json({ success: true, message: 'Agent status revoked' });
  } catch (error) {
    logger.error('Revoke agent error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * List all agents with performance stats
 */
export const listAgents = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 20, search, sortBy = 'commission' } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const match: any = { isAgent: true };

    if (search) {
      const s = sanitizeInput(String(search));
      const isNumeric = /^\d+$/.test(s);
      const ors: any[] = [
        { username: { $regex: s, $options: 'i' } },
        { firstName: { $regex: s, $options: 'i' } },
        { lastName: { $regex: s, $options: 'i' } },
      ];
      if (isNumeric) ors.push({ telegramId: Number(s) });
      if (s.length >= 9) {
        const phone = s.replace(/[^0-9]/g, '');
        const normalized = phone.startsWith('0') ? '251' + phone.slice(1) : phone;
        ors.push({ phoneNumber: { $regex: new RegExp(normalized) } });
      }
      match.$or = ors;
    }

    let sortField = 'effectiveCommission';
    let sortDir = -1;
    if (sortBy === 'referrals') { sortField = 'referralCount'; sortDir = -1; }
    else if (sortBy === 'earnings') { sortField = 'referralEarnings'; sortDir = -1; }
    else if (sortBy === 'newest') { sortField = 'agentApprovedAt'; sortDir = -1; }

    const pipeline: any[] = [
      { $match: match },
      {
        $addFields: {
          _commissionFromTx: {
            $sum: {
              $map: {
                input: {
                  $filter: {
                    input: { $ifNull: ['$ETBCoinTransactions', []] },
                    as: 'tx',
                    cond: {
                      $regexMatch: {
                        input: { $ifNull: ['$$tx.reference', ''] },
                        regex: /^(COMMISSION-|FIRST-DEPOSIT-|REFERRAL-)/,
                      },
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
        $addFields: {
          effectiveCommission: {
            $max: [
              { $ifNull: ['$totalCommissionPaid', 0] },
              '$_commissionFromTx',
            ],
          },
        },
      },
      { $sort: { [sortField]: sortDir } },
      { $skip: skip },
      { $limit: Number(limit) },
      {
        $project: {
          password: 0,
          ETBCoinTransactions: 0,
          sessionToken: 0,
          sessionExpiresAt: 0,
          ipAddresses: 0,
          devices: 0,
          _commissionFromTx: 0,
        },
      },
    ];

    const [agents, total] = await Promise.all([
      User.aggregate(pipeline),
      User.countDocuments(match),
    ]);

    res.json({ agents, total, page: Number(page), limit: Number(limit) });
  } catch (error) {
    logger.error('List agents error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get detailed agent stats
 */
export const getAgentDetails = async (req: Request, res: Response) => {
  try {
    const telegramId = Number(req.params.telegramId);
    if (isNaN(telegramId)) return res.status(400).json({ error: 'Invalid telegramId' });

    const user = await User.findOne({ telegramId }).select('-password').lean();
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!user.isAgent) return res.status(400).json({ error: 'User is not an agent' });

    const referredUsers = await User.find({ referredBy: user._id })
      .select('telegramId username firstName lastName totalConfirmedDepositsETB createdAt')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    // ── 3-category breakdown from transactions (source of truth) ──
    const txs = ((user as any).ETBCoinTransactions || []) as any[];

    const commissionOnly = txs
      .filter((t) => t.reference?.startsWith('COMMISSION-'))
      .reduce((s, t) => s + (t.amount || 0), 0);

    const firstDepositOnly = txs
      .filter((t) => t.reference?.startsWith('FIRST-DEPOSIT-'))
      .reduce((s, t) => s + (t.amount || 0), 0);

    const signupBonuses = txs
      .filter((t) => t.reference?.startsWith('REFERRAL-'))
      .reduce((s, t) => s + (t.amount || 0), 0);

    const totalEarnings = commissionOnly + firstDepositOnly + signupBonuses;

    const now = Date.now();
    const day7 = now - 7 * 24 * 60 * 60 * 1000;
    const day30 = now - 30 * 24 * 60 * 60 * 1000;
    const earningTxs = txs.filter(
      (t) =>
        t.reference?.startsWith('COMMISSION-') ||
        t.reference?.startsWith('FIRST-DEPOSIT-') ||
        t.reference?.startsWith('REFERRAL-')
    );
    const last7 = earningTxs
      .filter((t) => new Date(t.timestamp).getTime() >= day7)
      .reduce((s, t) => s + (t.amount || 0), 0);
    const last30 = earningTxs
      .filter((t) => new Date(t.timestamp).getTime() >= day30)
      .reduce((s, t) => s + (t.amount || 0), 0);

    const totalReferredDeposits = referredUsers.reduce(
      (sum, u: any) => sum + (u.totalConfirmedDepositsETB || 0),
      0
    );

    const recentCommissions = earningTxs.slice(-50).reverse();

    res.json({
      agent: {
        telegramId: user.telegramId,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        phoneNumber: user.phoneNumber,
        email: user.email,
        agentApprovedAt: user.agentApprovedAt,
        referralCode: user.referralCode,
        referralCount: user.referralCount || 0,
        referralEarnings: user.referralEarnings || 0,
        totalCommissionPaid: totalEarnings,
        commissionOnly,
        firstDepositOnly,
        signupBonuses,
        joinedAt: user.createdAt,
      },
      stats: {
        totalReferrals: referredUsers.length,
        totalReferredDeposits,
        averageDeposit:
          referredUsers.length > 0 ? totalReferredDeposits / referredUsers.length : 0,
        earnedLast7Days: last7,
        earnedLast30Days: last30,
      },
      referredUsers,
      recentCommissions,
    });
  } catch (error) {
    logger.error('Get agent details error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};