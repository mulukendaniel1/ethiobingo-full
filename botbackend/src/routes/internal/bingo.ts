// src/routes/internal/bingo.ts
import { Router } from 'express';
import { internalAuth } from '../../middleware/internalAuth';
import { User } from '../../core/database/models/User';
import { logger } from '../../core/utils/logger';
import { auditService } from '../../services/auditService';
import { sanitizeInput } from '../../core/utils/security';
import mongoose from 'mongoose';
import { RoundProfit } from '@/core/database/models/RoundProfit';
import { UserBetHistory } from '@/core/database/models/UserBetHistory';
import { RoundWinner } from '@/core/database/models/RoundWinner';
import { recordLedger } from '@/services/ledgerHelper';
const router = Router();

// Helper to convert to ObjectId safely
const toObjectId = (id: string) => {
  const safe = sanitizeInput(id);
  if (!mongoose.Types.ObjectId.isValid(safe)) return null;
  return new mongoose.Types.ObjectId(safe);
};

// ==================== BUY CARD ====================
router.post('/buy-card', internalAuth, async (req, res) => {
  const { userId, roundId, amount, count, nonce, payload, signature } = req.body;

  const userObjectId = toObjectId(userId);
  if (!userObjectId) return res.status(400).json({ error: 'Invalid userId' });

  try {
    const totalCost = amount * count;

    const user = await User.findById(userObjectId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.ETBCoins < totalCost) return res.status(400).json({ error: 'Insufficient ETB' });

    // ── DEDUCTION ORDER (bonus → deposit → legacy locked → main) ──────
    // 1. Bonus money (new phone verification etc.) is always spent first.
    // 2. Tracked deposit money (from post‑feature deposits) comes next.
    // 3. Any remaining lockedBalance not captured by the sub‑balances is legacy
    //    money from before the split existed – we treat it as deposit‑origin.
    // 4. Finally, the user's withdrawable balance (balanceMain) covers the rest.

    const legacyLocked = Math.max(
      0,
      (user.lockedBalance || 0) -
        ((user.depositBalance || 0) + (user.bonusBalance || 0))
    );

    let remaining = totalCost;
    const bonusAvail = Math.max(0, user.bonusBalance || 0);
    let deductFromBonus = Math.min(remaining, bonusAvail);
    remaining -= deductFromBonus;

    const depositAvail = Math.max(0, user.depositBalance || 0);
    let deductFromDeposit = Math.min(remaining, depositAvail);
    remaining -= deductFromDeposit;

    let deductFromLegacy = Math.min(remaining, legacyLocked);
    remaining -= deductFromLegacy;

    let deductFromMain = remaining;

    // Build the atomic update object
    const update: any = {
      $inc: {
        ETBCoins: -totalCost,
        lockedETB: totalCost,     // game‑specific lock (used for round consistency)
      }
    };

    if (deductFromBonus > 0) update.$inc.bonusBalance = -deductFromBonus;
    if (deductFromDeposit > 0) update.$inc.depositBalance = -deductFromDeposit;
    // Legacy lockedBalance is decreased only by the total non‑main portion
    const totalNonMain = deductFromBonus + deductFromDeposit + deductFromLegacy;
    if (totalNonMain > 0) update.$inc.lockedBalance = -totalNonMain;
    if (deductFromMain > 0) update.$inc.balanceMain = -deductFromMain;

    // ── BONUS‑ABUSE GUARD TRACKING ──────────────────────────────────
    // Any deduction from deposit or legacy locked is considered "real deposit"
    // money being wagered. Mark the flag permanently.
    // `balanceMain` now contains deposit money (plus winnings/commission).
// Any spend from it is real money being wagered.
    const wageredFromDeposit =
      deductFromDeposit > 0 ||
      deductFromLegacy > 0 ||
      deductFromMain > 0;
    if (wageredFromDeposit && !user.hasWageredFromDeposit) {
      update.$set = { ...(update.$set || {}), hasWageredFromDeposit: true };
    }

    // First‑bet resolution (rules 2 / 2b)
    if (!user.hasPlacedFirstBet) {
      if ((user.totalConfirmedDepositsETB || 0) > 10) {
        // Already deposited >10 before playing → clear immediately.
        update.$set = { ...(update.$set || {}), isAbuser: false, hasPlacedFirstBet: true };
      } else {
        // Not enough deposited yet → track for round‑result resolution.
        update.$set = {
          ...(update.$set || {}),
          hasPlacedFirstBet: true,
          firstBetRoundId: roundId,
          firstBetFundedByDeposit: wageredFromDeposit,  // any deposit funding counts
        };
      }
    }

    const updatedUser = await User.findByIdAndUpdate(userObjectId, update, {
      new: true,
      runValidators: true,
    });
    if (!updatedUser) return res.status(400).json({ error: 'Failed to update user balance' });

    // ── AUDIT & LEDGER ──────────────────────────────────────────────
    await recordLedger({
      userId: userObjectId,
      type: 'card_purchase',
      amount: -totalCost,
      balanceAfter: updatedUser.ETBCoins,
      referenceId: roundId,
      notes: `Purchased ${count} card(s)`,
    });

    auditService
      .logFinancialTransaction(
        userObjectId,
        user.telegramId,
        'BINGO_CARD_PURCHASE',
        totalCost,
        'ETB',
        roundId,
        {
          cards: count,
          fromBonus: deductFromBonus,
          fromDeposit: deductFromDeposit + deductFromLegacy, // combined deposit origin
          fromMain: deductFromMain,
        }
      )
      .catch(console.error);

    res.json({ success: true, newBalance: updatedUser.ETBCoins });
  } catch (err) {
    logger.error('Buy card error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== BUY NUMBERS ====================
router.post('/buy-numbers', internalAuth, async (req, res) => {
  const { userId, roundId, numbers, totalCost, nonce, payload, signature } = req.body;

  const userObjectId = toObjectId(userId);
  if (!userObjectId) return res.status(400).json({ error: 'Invalid userId' });

  try {
    const user = await User.findById(userObjectId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.ETBCoins < totalCost) return res.status(400).json({ error: 'Insufficient ETB' });

    // ── DEDUCTION ORDER (same as buy‑card) ──────────────────────────
    const legacyLocked = Math.max(
      0,
      (user.lockedBalance || 0) -
        ((user.depositBalance || 0) + (user.bonusBalance || 0))
    );

    let remaining = totalCost;
    const bonusAvail = Math.max(0, user.bonusBalance || 0);
    let deductFromBonus = Math.min(remaining, bonusAvail);
    remaining -= deductFromBonus;

    const depositAvail = Math.max(0, user.depositBalance || 0);
    let deductFromDeposit = Math.min(remaining, depositAvail);
    remaining -= deductFromDeposit;

    let deductFromLegacy = Math.min(remaining, legacyLocked);
    remaining -= deductFromLegacy;

    let deductFromMain = remaining;

    const update: any = {
      $inc: {
        ETBCoins: -totalCost,
        lockedETB: totalCost,   // ← was missing, must be added
      }
    };

    if (deductFromBonus > 0) update.$inc.bonusBalance = -deductFromBonus;
    if (deductFromDeposit > 0) update.$inc.depositBalance = -deductFromDeposit;
    const totalNonMain = deductFromBonus + deductFromDeposit + deductFromLegacy;
    if (totalNonMain > 0) update.$inc.lockedBalance = -totalNonMain;
    if (deductFromMain > 0) update.$inc.balanceMain = -deductFromMain;

    // ── BONUS‑ABUSE GUARD TRACKING ──────────────────────────────────
    // `balanceMain` now contains deposit money (plus winnings/commission).
      // Any spend from it is real money being wagered.
      const wageredFromDeposit =
        deductFromDeposit > 0 ||
        deductFromLegacy > 0 ||
        deductFromMain > 0;
    if (wageredFromDeposit && !user.hasWageredFromDeposit) {
      update.$set = { ...(update.$set || {}), hasWageredFromDeposit: true };
    }

    // First‑bet resolution
    if (!user.hasPlacedFirstBet) {
      if ((user.totalConfirmedDepositsETB || 0) > 10) {
        update.$set = { ...(update.$set || {}), isAbuser: false, hasPlacedFirstBet: true };
      } else {
        update.$set = {
          ...(update.$set || {}),
          hasPlacedFirstBet: true,
          firstBetRoundId: roundId,
          firstBetFundedByDeposit: wageredFromDeposit,
        };
      }
    }

    const updatedUser = await User.findByIdAndUpdate(userObjectId, update, {
      new: true,
      runValidators: true,
    });
    if (!updatedUser) return res.status(400).json({ error: 'Failed to update user balance' });

    // ── AUDIT ──────────────────────────────────────────────────────
    auditService
      .logFinancialTransaction(
        userObjectId,
        user.telegramId,
        'BINGO_NUMBERS_PURCHASE',
        totalCost,
        'ETB',
        roundId,
        {
          numbers,
          count: numbers.length,
          fromBonus: deductFromBonus,
          fromDeposit: deductFromDeposit + deductFromLegacy,
          fromMain: deductFromMain,
        }
      )
      .catch(console.error);

    res.json({ success: true, newBalance: updatedUser.ETBCoins });
  } catch (err) {
    logger.error('Buy numbers error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== WIN ====================
router.post('/win', internalAuth, async (req, res) => {
  const { userId, roundId, winAmount, totalStaked, cardId, payload, signature } = req.body;

  const userObjectId = toObjectId(userId);
  if (!userObjectId) return res.status(400).json({ error: 'Invalid userId' });

  try {
    // 1. Idempotency check – has this user already been paid for this round?
    const existing = await RoundWinner.findOne({ userId, roundId, cardId: cardId || 0 }).lean();
    if (existing) {
      // Already processed – return success without modifying balance
      const user = await User.findById(userObjectId).select('ETBCoins').lean();
      return res.json({ 
        success: true, 
        balance: user?.ETBCoins || 0,
        alreadyProcessed: true 
      });
    }

    let finalWinAmount = winAmount;
    if (finalWinAmount === undefined && payload) {
      const parts = payload.split(':');
      finalWinAmount = parseFloat(parts[3]);
    }
    if (isNaN(finalWinAmount) || finalWinAmount <= 0) {
      return res.status(400).json({ error: 'Invalid win amount' });
    }

    const stake = totalStaked || 10; // default to 10 ETB (card cost)
    const updateQuery = { _id: userObjectId, lockedETB: { $gte: stake } };
    const update = {
      $inc: {
        ETBCoins: finalWinAmount,
        balanceMain: finalWinAmount,
        lockedETB: -stake,
      },
    };
    let user = await User.findOneAndUpdate(updateQuery, update, { new: true, lean: true });

    if (!user) {
      logger.warn(`Win: lockedETB insufficient for user ${userId}. totalStaked: ${stake}. Crediting winnings only.`);
      user = await User.findByIdAndUpdate(userObjectId, {
        $inc: { ETBCoins: finalWinAmount, balanceMain: finalWinAmount }
      }, { new: true, lean: true });
      if (!user) return res.status(404).json({ error: 'User not found' });
    }

    await recordLedger({
  userId: userObjectId,
  type: 'win',
  amount: finalWinAmount,
  balanceAfter: user.ETBCoins, // from result
  referenceId: roundId,
  notes: `Win for round ${roundId}`,
});

    // 2. Record the win to prevent future duplicates
    await RoundWinner.create({
      userId,
      roundId,
      winAmount: finalWinAmount,
      stake: totalStaked || 10,
      cardId: cardId || 0,
    });

    // (Optional) Audit log – keep existing if any
    auditService.logFinancialTransaction(
      userObjectId,
      user.telegramId,
      'BINGO_WIN',
      finalWinAmount,
      'ETB',
      roundId,
      { totalStaked: stake }
    ).catch(console.error);

    res.json({ success: true, balance: user.ETBCoins });
  } catch (err) {
    logger.error('Win processing failed:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== SELL CARD (REFUND) ====================
router.post('/sell-card', internalAuth, async (req, res) => {
  const { userId, roundId, cardId, nonce, payload, signature } = req.body;

  const userObjectId = toObjectId(userId);
  if (!userObjectId) return res.status(400).json({ error: 'Invalid userId' });

  try {
    const refundAmount = 10;
    // Atomic: only if lockedETB >= refundAmount
    const updatedUser = await User.findOneAndUpdate(
      { _id: userObjectId, lockedETB: { $gte: refundAmount } },
      { $inc: { ETBCoins: refundAmount, lockedETB: -refundAmount, lockedBalance: refundAmount } },
      { new: true, lean: true }
    );

    if (!updatedUser) {
      return res.status(400).json({ error: 'Insufficient lockedETB to sell card' });
    }

    await recordLedger({
  userId: userObjectId,
  type: 'card_refund',
  amount: refundAmount,
  balanceAfter: updatedUser.ETBCoins,
  referenceId: roundId,
  notes: `Refund for card ${cardId}`,
});

    auditService.logFinancialTransaction(
      userObjectId,
      updatedUser.telegramId,
      'BINGO_CARD_REFUND',
      refundAmount,
      'ETB',
      roundId,
      { cardId }
    ).catch(console.error);

        // ── Reset hasWageredFromDeposit if refund cancels the only deposit‑funded bet ──
    if (
      updatedUser.hasWageredFromDeposit &&
      !updatedUser.hasCompletedDepositWager &&
      (updatedUser.lockedETB || 0) === 0
    ) {
      await User.updateOne(
        { _id: userObjectId },
        { $set: { hasWageredFromDeposit: false } }
      ).catch(err => logger.error('Failed to reset hasWageredFromDeposit on refund:', err));
    }

    res.json({ success: true, newBalance: updatedUser.ETBCoins });
  } catch (err) {
    logger.error('Sell card error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== ROUND RESULT ====================
router.post('/round-result', internalAuth, async (req, res) => {
  const { 
    roundId, operatorId, totalStaked, totalPayout, totalCommission, 
    winnerId, winnerIds, winnerAmounts, startTime, endTime, userStakes 
  } = req.body;

  try {
    // Store round profit (unchanged)
    await RoundProfit.create({
      roundId, operatorId, totalStaked, totalPayout, totalCommission,
      crashPoint: 1, startTime: new Date(startTime), endTime: new Date(endTime),
      netProfit: totalStaked - totalPayout,
      drawnBalls: req.body.drawnBalls || [],   // ← add
    });

    // Create a map for winnerId -> winAmount
    const winnerMap = new Map<string, number>();
    if (winnerIds && winnerAmounts && winnerIds.length === winnerAmounts.length) {
      for (let i = 0; i < winnerIds.length; i++) {
        const uid = winnerIds[i];
        winnerMap.set(uid, (winnerMap.get(uid) || 0) + winnerAmounts[i]);
      }
    } else if (winnerId && totalPayout) {
      winnerMap.set(winnerId, totalPayout);
    }

    // Record ONE history entry per user (win or loss) – skip bots
    if (userStakes && Array.isArray(userStakes)) {
      // Aggregate stakes per user
      const stakesByUser = new Map<string, number>();
      for (const { userId, stake } of userStakes) {
        if (!userId || userId.startsWith('bot_') || stake <= 0) continue;
        stakesByUser.set(userId, (stakesByUser.get(userId) || 0) + stake);
      }

      // Write histories and unlock in bulk
      for (const [userId, totalStake] of stakesByUser.entries()) {
        const userObjectId = toObjectId(userId);
        if (!userObjectId) continue;

        const winAmount = winnerMap.get(userId);

        // ── Resolve first-bet outcome for the bonus-abuse guard ──────────
        // Only acts if this round is the one recorded as the user's first bet.
        const bettor = await User.findById(userObjectId)
          .select('firstBetRoundId firstBetFundedByDeposit hasWageredFromDeposit')
          .lean();

        // Mark deposit wager as completed if the user had a deposit-funded bet in this round
        if (bettor?.hasWageredFromDeposit) {
          await User.updateOne(
            { _id: userObjectId },
            { $set: { hasCompletedDepositWager: true } }
          ).catch(err => logger.error('Failed to set hasCompletedDepositWager:', err));
        }

        if (bettor?.firstBetRoundId === roundId) {
          if (winAmount === undefined || winAmount <= 0) {
            // First bet lost.
              if (bettor!.firstBetFundedByDeposit) {
              // Deposit-funded loss → clear permanently.
              await User.updateOne(
                { _id: userObjectId },
                { $set: { isAbuser: false }, $unset: { firstBetRoundId: '' } }
              ).catch(err => logger.error('Failed to resolve first-bet (loss/deposit):', err));
            } else {
              // Pure bonus-funded loss → no free clear (closes the bypass).
              await User.updateOne(
                { _id: userObjectId },
                { $unset: { firstBetRoundId: '' } }
              ).catch(err => logger.error('Failed to resolve first-bet (loss/bonus):', err));
            }
          } else {
            // First bet won — just mark resolved, isAbuser unaffected here.
            await User.updateOne(
              { _id: userObjectId },
              { $unset: { firstBetRoundId: '' } }
            ).catch(err => logger.error('Failed to resolve first-bet (win):', err));
          }
        }

        if (winAmount !== undefined && winAmount > 0) {
          await UserBetHistory.create({
            userId, roundId, action: 'win', amount: winAmount, createdAt: new Date()
          }).catch(err => logger.error('Failed to record win history:', err));
        } else {
          await UserBetHistory.create({
            userId, roundId, action: 'buy', amount: totalStake, createdAt: new Date()
          }).catch(err => logger.error('Failed to record loss history:', err));
        }

        if (!winnerMap.has(userId)) {
          await User.updateOne(
            { _id: userObjectId, lockedETB: { $gte: totalStake } },
            { $inc: { lockedETB: -totalStake } }
          ).catch(err => logger.error(`Failed to reset lockedETB for user ${userId}:`, err));

          await recordLedger({
            userId: userObjectId,
            type: 'other',
            amount: 0,
            balanceAfter: 0,
            referenceId: roundId,
            notes: 'Round loss – lockedETB released',
          });
        }
      }
    }

    res.json({ success: true });
  } catch (err) {
    logger.error('Round result error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;