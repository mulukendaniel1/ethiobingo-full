// src/routes/api/admin.ts
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { adminAuth } from '../../middleware/adminAuth';
import * as adminController from '../../controllers/adminController';
import * as unclaimedController from '../../controllers/unclaimedController';
import { getSettings } from '@/core/utils/settingsCache';
import { logger } from '@/core/utils/logger';
import { isMainAdmin } from '../../core/config/mainAdmin';
import { User } from '@/core/database/models/User';
import { PhoneAbuseLog } from '@/core/database/models/PhoneAbuseLog';
import * as bonusCleanupController from '../../controllers/bonusCleanupController';
import { sanitizeInput } from '@/core/utils/security';


const router = Router();

// Rate limiter for login attempts (5 attempts per 15 minutes)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,                   // 5 attempts per IP
  message: { error: 'Too many login attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware to allow only the main admin
const mainAdminOnly = (req: any, res: any, next: any) => {
  if (!req.user?.email || !isMainAdmin(req.user.email)) {
    return res.status(403).json({ error: 'Access denied: main admin only' });
  }
  next();
};

router.post('/login', loginLimiter, adminController.login);
router.post('/logout', adminController.logout);
router.use(adminAuth);
router.get('/me', adminController.getCurrentUser);
router.post('/change-password', adminController.changePassword);
router.get('/stats', adminController.getStats);
router.get('/users', adminController.listUsers);
// GET /admin/users/total-balances – global aggregates
router.get('/users/total-balances', async (req, res) => {
  try {
    const [totals] = await User.aggregate([
      {
        $group: {
          _id: null,
          totalETBCoins: { $sum: '$ETBCoins' },
          totalBalanceMain: { $sum: '$balanceMain' },
          totalLockedBalance: { $sum: '$lockedBalance' }
        }
      }
    ]);
    res.json(totals || {
      totalETBCoins: 0,
      totalBalanceMain: 0,
      totalLockedBalance: 0
    });
  } catch (error) {
    logger.error('Total balances error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
router.get('/users/:id', adminController.getUserDetails);

import shamoAdminRouter from './shamo';
router.use('/shamo', shamoAdminRouter);

// ---- MAIN ADMIN UPGRADE ROUTES ----
router.post('/main/search', mainAdminOnly, adminController.searchUserForUpgrade);
router.post('/main/upgrade', mainAdminOnly, adminController.upgradeUserToAdmin);
router.post('/main/send-credentials', mainAdminOnly, adminController.sendAdminCredentials);
router.get('/main/admins', mainAdminOnly, adminController.listAdmins);
router.post('/main/revoke', mainAdminOnly, adminController.revokeAdmin);

router.post('/users/:id/ban', adminController.banUser);
router.post('/users/:id/unban', adminController.unbanUser);
router.post('/broadcast', adminController.createBroadcast);
router.get('/deposits/pending', adminController.getPendingDeposits);
router.post('/deposits/:requestId/confirm', adminController.confirmDeposit);
router.post('/deposits/:requestId/reject', adminController.rejectDeposit);
router.get('/withdrawals/pending', adminController.getPendingWithdrawals);
router.post('/withdrawals/:requestId/process', adminController.processWithdrawal);
router.post('/withdrawals/:requestId/reject', adminController.rejectWithdrawal);
router.post('/users/:id/adjust-balance', adminController.adjustBalance);
router.get('/users/:id/transactions', adminController.getUserTransactions);
router.get('/settings', adminController.getSettings);
router.post('/settings', adminController.updateSetting);
router.get('/agent-requests/pending', adminController.getPendingAgentRequests);
router.post('/agent-requests/:id/approve', adminController.approveAgentRequest);
router.post('/agent-requests/:id/reject', adminController.rejectAgentRequest);
router.get('/agent-requests/pending/count', adminController.getPendingAgentRequestsCount);
router.get('/deposits/pending/count', adminController.getPendingDepositsCount);
router.get('/withdrawals/pending/count', adminController.getPendingWithdrawalsCount);
router.get('/broadcast/templates', adminController.getBroadcastTemplates);
router.post('/broadcast/templates', adminController.createBroadcastTemplate);
router.put('/broadcast/templates/:id', adminController.updateBroadcastTemplate);
router.delete('/broadcast/templates/:id', adminController.deleteBroadcastTemplate);
router.post('/bot/pause', adminController.pauseBot);
router.post('/bot/resume', adminController.resumeBot);
router.get('/bot/status', adminController.getBotStatus);
router.post('/settings/verify-password', adminController.verifySettingsPassword);
router.get('/stats/advanced', adminController.getAdvancedStats);
router.get('/deposits', adminController.getDeposits);
router.get('/deposits/:requestId/verify', adminController.verifyDeposit);
router.get('/withdrawals', adminController.getWithdrawals);
router.post('/users/convert-locked', adminController.convertLockedETB);
router.get('/users/:id/bet-history', adminController.getUserBetHistory);
router.post('/game/pause', adminController.pauseGame);
router.post('/game/resume', adminController.resumeGame);
router.get('/admin-actions', adminController.getAdminActions);
router.get('/unclaimed-receipts', unclaimedController.getUnclaimedReceipts);
router.post('/unclaimed-receipts/:id/match', unclaimedController.matchUnclaimedReceipt);
router.delete('/unclaimed-receipts/:id', unclaimedController.deleteUnclaimedReceipt);
router.get('/round-winners', adminController.getRoundWinners);
router.delete('/round-winners/:id', adminController.deleteRoundWinner);
router.get('/game/status', async (req, res) => {
  const settings = getSettings();
  res.json({ gamePaused: settings.gamePaused });
});

router.get('/bingo/card/:cardId', async (req, res) => {
  try {
    const data = await engineFetch(`/card/${req.params.cardId}`);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: 'Engine unreachable' });
  }
});

// ---- AGENT MANAGEMENT (available to all admins) ----
router.post('/agents/search', adminController.searchUserForAgent);
router.post('/agents/upgrade', adminController.upgradeUserToAgent);
router.post('/agents/revoke', adminController.revokeAgent);
router.get('/agents/list', adminController.listAgents);
router.get('/agents/:telegramId/details', adminController.getAgentDetails);

// Helper: retry engine call 3 times with 1s backoff
async function engineFetch(path: string, options?: RequestInit): Promise<any> {
  const engineUrl = process.env.ENGINE_URL || 'http://localhost:4000';
  const secret = process.env.INTERNAL_API_SECRET || '';
  const url = `${engineUrl}${path}?secret=${encodeURIComponent(secret)}`;
  
  let lastError: Error | null = null;
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(url, options);
      const data: unknown = await res.json();
      if (!res.ok || (data && typeof data === 'object' && 'error' in data)) {
        const msg = (data as any)?.error || `Engine returned ${res.status}`;
        throw new Error(msg);
      }
      return data as any;
    } catch (err: any) {
      lastError = err;
      if (i < 2) await new Promise(r => setTimeout(r, 1000));
    }
  }
  throw lastError || new Error('Engine unreachable');
}
// ═══════════════════════════════════════════════════════════════
// PHONE-NUMBER ABUSE GUARD  (tracking + flagged users)
// Accessible to any authenticated admin (matches existing
// ethiogames pattern — add `mainAdminOnly` to any of these if
// you want to restrict to main admin only).
// ═══════════════════════════════════════════════════════════════

// GET /api/admin/phone-abuse/stats
router.get('/phone-abuse/stats', async (_req, res) => {
  try {
    const [
      totalAttempts,
      uniquePhones,
      uniqueAttempters,
      uniqueOwners,
      duplicateFlagged,
      fastFlagged,
    ] = await Promise.all([
      PhoneAbuseLog.countDocuments(),
      PhoneAbuseLog.distinct('normalizedPhone').then(a => a.length),
      PhoneAbuseLog.distinct('attemptedByTelegramId').then(a => a.length),
      PhoneAbuseLog.distinct('existingOwnerTelegramId').then(a => a.length),
      User.countDocuments({ riskFlags: 'duplicate_phone_number' }),
      User.countDocuments({ riskFlags: 'fast_contact_share' }),
    ]);

    res.json({
      totalAttempts,
      uniquePhones,
      uniqueAttempters,
      uniqueOwners,
      duplicateFlagged,
      fastFlagged,
    });
  } catch (err) {
    logger.error('Phone-abuse stats error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/phone-abuse/logs?page=&limit=&phone=&attemptedBy=&owner=&from=&to=
router.get('/phone-abuse/logs', async (req, res) => {
  try {
    const { page = 1, limit = 20, phone, attemptedBy, owner, from, to } = req.query;
    const filter: any = {};

    if (phone) {
      filter.normalizedPhone = { $regex: sanitizeInput(String(phone)), $options: 'i' };
    }
    if (attemptedBy && !isNaN(Number(attemptedBy))) {
      filter.attemptedByTelegramId = Number(attemptedBy);
    }
    if (owner && !isNaN(Number(owner))) {
      filter.existingOwnerTelegramId = Number(owner);
    }
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(String(from));
      if (to) filter.createdAt.$lte = new Date(String(to));
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [logs, total] = await Promise.all([
      PhoneAbuseLog.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      PhoneAbuseLog.countDocuments(filter),
    ]);

    const telegramIds = new Set<number>();
    for (const l of logs) {
      telegramIds.add(l.attemptedByTelegramId);
      if (l.existingOwnerTelegramId) telegramIds.add(l.existingOwnerTelegramId);
    }

    const users = telegramIds.size
      ? await User.find({ telegramId: { $in: [...telegramIds] } })
          .select('_id telegramId username firstName lastName riskScore riskLevel riskFlags isBanned')
          .lean()
      : [];
    const byTelegramId = new Map(users.map(u => [u.telegramId, u]));

    const enriched = logs.map(l => ({
      _id: l._id,
      normalizedPhone: l.normalizedPhone,
      attemptedByTelegramId: l.attemptedByTelegramId,
      existingOwnerTelegramId: l.existingOwnerTelegramId ?? null,
      secondsSinceStart: l.secondsSinceStart ?? null,
      createdAt: l.createdAt,
      attacker: byTelegramId.get(l.attemptedByTelegramId) || null,
      owner: l.existingOwnerTelegramId
        ? byTelegramId.get(l.existingOwnerTelegramId) || null
        : null,
    }));

    res.json({ logs: enriched, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    logger.error('Phone-abuse logs error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/phone-abuse/flagged-users?page=&limit=&search=&flag=
router.get('/phone-abuse/flagged-users', async (req, res) => {
  try {
    const { page = 1, limit = 20, search, flag } = req.query;

    const allowedFlags = ['duplicate_phone_number', 'fast_contact_share'];
    const flags =
      flag && allowedFlags.includes(String(flag))
        ? [String(flag)]
        : allowedFlags;

    const filter: any = { riskFlags: { $in: flags } };

    if (search) {
      const s = sanitizeInput(String(search));
      const isNumeric = /^\d+$/.test(s);
      filter.$or = [
        { username: { $regex: s, $options: 'i' } },
        { firstName: { $regex: s, $options: 'i' } },
        { lastName: { $regex: s, $options: 'i' } },
      ];
      if (isNumeric) filter.$or.push({ telegramId: Number(s) });
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [users, total] = await Promise.all([
      User.find(filter)
        .select(
          '_id telegramId username firstName lastName phoneNumber ' +
          'riskScore riskLevel riskFlags isBanned createdAt'
        )
        .sort({ riskScore: -1, createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      User.countDocuments(filter),
    ]);

    res.json({ users, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    logger.error('Phone-abuse flagged users error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Weekly Rewards ──
router.get('/weekly-rewards/status', adminController.getWeeklyRewardStatus);
router.get('/weekly-rewards/top-depositors', adminController.getWeeklyTopDepositors);
router.get('/weekly-rewards/top-referrers', adminController.getWeeklyTopReferrers);
router.get('/weekly-rewards/preview', adminController.previewWeeklyReward);
router.post('/weekly-rewards/pay-now', adminController.payWeeklyRewardNow);
router.get('/weekly-rewards/history', adminController.getWeeklyRewardHistory);
router.post('/weekly-rewards/:id/revert', adminController.revertWeeklyReward);

// ── Bonus Cleanup (non-agent referral/phone) ──
router.post('/bonuses/cleanup-non-agents/preview', bonusCleanupController.previewCleanup);
router.post('/bonuses/cleanup-non-agents/execute', bonusCleanupController.executeCleanup);

export default router;