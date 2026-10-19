//src\routes\api\user.ts
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../../core/database/models/User';
import { sanitizeInput } from '../../core/utils/security';
import { referralService } from '../../services/referralServiceInstance';
import { UserBetHistory } from '@/core/database/models/UserBetHistory';
import { ETBDepositService } from '../../services/ETBDepositServiceInstance';
import { ETBWithdrawalService } from '../../services/ETBWithdrawalServiceInstance';
import { ETBDeposit } from '../../core/database/models/ETBDeposit';
import { ETBWithdrawal } from '../../core/database/models/ETBWithdrawal';
import { FeatureGuard } from '../../core/security/FeatureGuard';
import { getSettings } from '@/core/utils/settingsCache';
import { checkWithdrawalEligibility } from '@/services/depositEligibilityService';
import mongoose from 'mongoose';

const router = Router();

// GET /api/user/me
router.get('/me', async (req, res) => {
  const token = req.query.token as string;
  if (!token) return res.status(401).json({ error: 'No token' });

  try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { uid: string };
    const user = await User.findById(decoded.uid)
  .select('telegramId username firstName ETBCoins lockedETB isBanned language balanceMain isAgent phoneNumber referralCode lockedBalance bonusBalance');
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({
      _id: user._id,
      telegramId: user.telegramId,
      username: user.username,
      firstName: user.firstName,
      ETBCoins: user.ETBCoins,
      balanceMain: user.balanceMain || 0,
      lockedBalance: user.lockedBalance || 0,       // ← NEW
      bonusBalance: user.bonusBalance || 0,         // ← NEW
      lockedETB: user.lockedETB,
      isBanned: user.isBanned,
      isAgent: user.isAgent || false,
      language: user.language || 'en',
    });
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// GET /api/user/referral
router.get('/referral', async (req, res) => {
  const token = req.query.token as string;
  if (!token) return res.status(401).json({ error: 'No token' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { uid: string };
    const user = await User.findById(decoded.uid);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const stats = await referralService.getUserReferralStats(user._id);
    if (!stats) return res.status(500).json({ error: 'Failed to load stats' });

    res.json({
      referralCode: stats.referralCode,
      referralCount: stats.referralCount,
      referralEarnings: stats.referralEarnings,
      referrals: stats.referrals.slice(0, 5), // limit to 5
    });
  } catch (err) {
    console.error('Referral API error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/user/language
router.post('/language', async (req, res) => {
  const { token, language } = req.body;
  if (!token) return res.status(401).json({ error: 'No token' });
  if (!language || !['en', 'am', 'ti', 'om', 'so'].includes(language)) {
    return res.status(400).json({ error: 'Invalid language' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { uid: string };
    const user = await User.findById(decoded.uid);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.language = language;
    await user.save();

    res.json({ success: true, language });
  } catch (err) {
    console.error('Language update error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/user/history
router.get('/history', async (req, res) => {
  const token = req.query.token as string;
  if (!token) return res.status(401).json({ error: 'No token' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { uid: string };
    const userId = decoded.uid;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const [bets, totalItems, distinctRounds] = await Promise.all([
      UserBetHistory.find({ userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      UserBetHistory.countDocuments({ userId }),
      UserBetHistory.distinct('roundId', { userId }),
    ]);

    res.json({
      history: bets.map(bet => ({
        roundId: bet.roundId,
        action: bet.action,
        amount: bet.amount,
        createdAt: bet.createdAt,
      })),
      total: totalItems,
      totalPages: Math.ceil(totalItems / limit),
      totalRounds: distinctRounds.length,  // ✅ distinct rounds count
      page,
      limit,
    });
  } catch (err) {
    console.error('History error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/user/deposit
router.post('/deposit', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.body.token;
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { uid: string };
    const userId = decoded.uid;
    FeatureGuard.requireDepositEnabled();
    const { method, receiptText } = req.body;
    if (!method || !receiptText) return res.status(400).json({ success: false, error: 'Method and receipt text are required.' });
    if (method !== 'telebirr' && method !== 'cbebirr')
      return res.status(400).json({ success: false, error: 'Supported methods: telebirr, cbebirr.' });

    let parsed;
    if (method === 'telebirr') {
      parsed = ETBDepositService.parseTelebirrReceipt(receiptText);
    } else {
      parsed = ETBDepositService.parseCbeBirrReceipt(receiptText);
    }

    if (!parsed) return res.status(400).json({ success: false, error: 'Could not parse receipt.' });

    const settings = getSettings();
    const expectedReceiver = method === 'telebirr'
      ? settings.telebirrAccountName
      : settings.cbeBirrAccountName;
    if (!expectedReceiver || parsed.receiverName.toLowerCase() !== expectedReceiver.toLowerCase())
      return res.status(400).json({ success: false, error: 'Receiver mismatch.' });

    const minAmount = 10;
    if (parsed.amount < minAmount)
      return res.status(400).json({ success: false, error: `Minimum deposit is ${minAmount} ETB.` });

    const existing = await ETBDeposit.findOne({ transactionId: parsed.transactionId });
    if (existing) return res.status(400).json({ success: false, error: 'Duplicate transaction.' });

    const result = await ETBDepositService.finalizeDepositRequest(userId, method, parsed.amount, parsed);
    if (result.success) {
      res.json({ success: true, requestId: result.requestId, amount: parsed.amount, autoConfirmed: result.autoConfirmed });
    } else {
      res.status(400).json({ success: false, error: result.error || 'Deposit failed.' });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Internal server error' });
  }
});

// POST /api/user/withdraw
router.post('/withdraw', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.body.token;
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { uid: string };
    const userIdString = decoded.uid;
    if (!mongoose.Types.ObjectId.isValid(userIdString)) {
      return res.status(400).json({ success: false, error: 'Invalid user ID' });
    }
    const userId = new mongoose.Types.ObjectId(userIdString);

FeatureGuard.requireWithdrawEnabled();

const { method, amountETB, destination } = req.body;
if (!method || !amountETB || !destination) {
  return res.status(400).json({ success: false, error: 'Method, amount, destination required.' });
}
if (method !== 'telebirr' && method !== 'cbebirr') {
  return res.status(400).json({ success: false, error: 'Only Telebirr and CBE Birr supported.' });
}

const amount = parseFloat(amountETB);
if (isNaN(amount) || amount < 50) {
  return res.status(400).json({ success: false, error: 'Minimum withdrawal is 50 ETB.' });
}

const phone = destination.replace(/\D/g, '');
if (phone.length !== 10 || !phone.startsWith('09')) {
  return res.status(400).json({ success: false, error: 'Invalid phone number.' });
}

// –– Gate 1: bonus-clear gate ––
// User must spend their locked bonus down below the threshold before
// they can withdraw ANY amount. Every bingo card spends bonus first.
const eligibility = await checkWithdrawalEligibility(userId, amount);

// –– Gate 1: bonus-clear gate –– (agents are exempt)
if (!eligibility.isAgent && !eligibility.bonusCleared) {
  const remaining = (eligibility.lockedBalance - eligibility.bonusClearThreshold).toFixed(2);
  return res.status(400).json({
    success: false,
    error:
      `You still have ${eligibility.lockedBalance.toFixed(2)} ETB in locked bonus. ` +
      `Play games until your bonus drops below ${eligibility.bonusClearThreshold} ETB ` +
      `(about ${remaining} ETB to spend) before you can withdraw.`,
  });
}

// –– Gate 2: Option C ––
if (!eligibility.canWithdraw) {
  const errMsg =
    eligibility.maxWithdrawableNow > 0
      ? `You can withdraw up to ${eligibility.maxWithdrawableNow.toFixed(2)} ETB right now. ` +
        `To unlock higher amounts, deposit 200 ETB total, or deposit 10+ ETB and wager from it. ` +
        `You've deposited ${eligibility.totalConfirmedDepositsETB.toFixed(2)} ETB so far.`
      : `You need to place at least one bet before you can withdraw. ` +
        `To unlock withdrawals immediately, deposit 200 ETB total, ` +
        `or deposit 10+ ETB and wager from it. ` +
        `You've deposited ${eligibility.totalConfirmedDepositsETB.toFixed(2)} ETB so far.`;

  return res.status(400).json({ success: false, error: errMsg });
}

const result = await ETBWithdrawalService.createWithdrawalRequest(userId, method, amount, phone);
    if (result.success) {
      res.json({ success: true, requestId: result.requestId, amountETB: amount, destination: phone });
    } else {
      res.status(400).json({ success: false, error: result.error || 'Withdrawal failed.' });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Internal server error' });
  }
});

// GET /api/user/deposit-info
router.get('/deposit-info', async (req, res) => {
  try {
    const settings = getSettings();
    res.json({
      telebirr: {
        accountName: settings.telebirrAccountName,
        phone: settings.telebirrPhone,
      },
      cbebirr: {
        accountName: settings.cbeBirrAccountName,
        phone: settings.cbeBirrPhone,
      },
    });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/user/pending-transaction
router.get('/pending-transaction', async (req, res) => {
  const token = req.query.token as string;
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { uid: string };
    const userId = decoded.uid;
    const pendingDep = await ETBDeposit.findOne({ userId, status: 'pending' }).sort({ createdAt: -1 }).lean();
    if (pendingDep) {
      return res.json({
        pending: {
          type: 'deposit',
          requestId: pendingDep.requestId,
          amount: pendingDep.amountETB,
          status: 'pending',
          createdAt: pendingDep.createdAt,
        },
      });
    }
    const pendingWdr = await ETBWithdrawal.findOne({ userId, status: 'pending' }).sort({ createdAt: -1 }).lean();
    if (pendingWdr) {
      return res.json({
        pending: {
          type: 'withdraw',
          requestId: pendingWdr.requestId,
          amount: pendingWdr.amountETB,
          status: 'pending',
          destination: pendingWdr.destinationDetails,
          createdAt: pendingWdr.createdAt,
        },
      });
    }
    res.json({ pending: null });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/user/agent-dashboard
router.get('/agent-dashboard', async (req, res) => {
  const token = req.query.token as string;
  if (!token) return res.status(401).json({ error: 'No token' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { uid: string };
    const user = await User.findById(decoded.uid);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!user.isAgent) return res.status(403).json({ error: 'Not an agent' });

    const referredUsers = await User.find({ referredBy: user._id })
      .select('telegramId username firstName lastName totalConfirmedDepositsETB createdAt')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const totalReferredDeposits = referredUsers.reduce(
      (sum, u: any) => sum + (u.totalConfirmedDepositsETB || 0),
      0
    );

    // ── 3-category breakdown (source of truth) ──
    const txs = (user.ETBCoinTransactions || []) as any[];

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

    const recentCommissions = earningTxs
      .slice(-25)
      .reverse()
      .map((t: any) => {
        let type: 'commission' | 'first_deposit' | 'signup' = 'commission';
        if (t.reference.startsWith('FIRST-DEPOSIT-')) type = 'first_deposit';
        else if (t.reference.startsWith('REFERRAL-')) type = 'signup';
        return {
          amount: t.amount,
          type,
          notes: t.notes || '',
          reference: t.reference,
          timestamp: t.timestamp,
        };
      });

    res.json({
      isAgent: true,
      agentApprovedAt: user.agentApprovedAt || null,
      referralCode: user.referralCode,
      referralCount: user.referralCount || 0,
      referralEarnings: user.referralEarnings || 0,
      totalCommissionPaid: totalEarnings,
      commissionOnly,
      firstDepositOnly,
      signupBonuses,
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
  } catch (err) {
    console.error('Agent dashboard error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/user/withdrawal-eligibility
router.get('/withdrawal-eligibility', async (req, res) => {
  const token = (req.query.token as string)
    || req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { uid: string };
    const userIdString = decoded.uid;
    if (!mongoose.Types.ObjectId.isValid(userIdString)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }
    const userId = new mongoose.Types.ObjectId(userIdString);

    const eligibility = await checkWithdrawalEligibility(userId);

    res.json({
      canWithdraw: eligibility.canWithdraw,
      maxWithdrawableNow: Number.isFinite(eligibility.maxWithdrawableNow)
        ? eligibility.maxWithdrawableNow
        : null,
      totalConfirmedDepositsETB: eligibility.totalConfirmedDepositsETB,
      hasPlacedFirstBet: eligibility.hasPlacedFirstBet,
      // ── NEW: bonus-clear info for the frontend progress bar ──
      lockedBalance: eligibility.lockedBalance,
      bonusCleared: eligibility.bonusCleared,
      bonusClearThreshold: eligibility.bonusClearThreshold,
    });
  } catch (err) {
    console.error('Withdrawal eligibility error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
// GET /api/user/shamo-info  (public — no token needed)
router.get('/shamo-info', async (_req, res) => {
  try {
    const { shamoService } = await import('../../services/shamoService');
    const settings = getSettings();

    const active = await shamoService.getActiveRound();
    let activeState: Awaited<ReturnType<typeof shamoService.getRoundState>> = null;
    if (active) {
      activeState = await shamoService.getRoundState(active.roundId);
    }

    // Compute next start time if auto is enabled and no active round
    let nextStartAt: string | null = null;
    if (!active && settings.shamoAutoEnabled) {
      const [hh, mm] = settings.shamoDailyTime.split(':').map(Number);
      // Ethiopian local = UTC+3. Convert to UTC instant for today.
      const nowUtc = new Date();
      // Build "today at HH:MM EAT" in UTC = today at (HH-3):MM UTC
      const candidate = new Date(Date.UTC(
        nowUtc.getUTCFullYear(),
        nowUtc.getUTCMonth(),
        nowUtc.getUTCDate(),
        hh - 3,
        mm,
        0,
        0
      ));
      if (candidate.getTime() <= nowUtc.getTime()) {
        candidate.setUTCDate(candidate.getUTCDate() + 1);
      }
      nextStartAt = candidate.toISOString();
    }

    res.json({
      active: activeState,
      nextStartAt,
      prizePerButton: settings.shamoPrizePerButton,
      totalButtons: settings.shamoTotalButtons,
      badgeEnabled: settings.shamoBadgeEnabled,
    });
  } catch (err) {
    console.error('shamo-info error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
export default router;