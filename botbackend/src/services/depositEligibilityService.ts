//src/services/depositEligibilityService.ts
import mongoose from 'mongoose';
import { ETBDeposit } from '../core/database/models/ETBDeposit';
import { User } from '../core/database/models/User';

const BONUS_CLEAR_THRESHOLD = 10; // ETB

export interface DepositEligibility {
  totalConfirmedDepositsETB: number;
  canWithdraw: boolean;
  hasWageredFromDeposit: boolean;
  maxWithdrawableNow: number;
  hasPlacedFirstBet: boolean;
  lockedBalance: number;
  bonusCleared: boolean;
  bonusClearThreshold: number;
  isAgent: boolean;            // ← NEW
}

export async function checkWithdrawalEligibility(
  userId: mongoose.Types.ObjectId,
  requestedAmount?: number
): Promise<DepositEligibility> {
  const result = await ETBDeposit.aggregate([
    { $match: { userId, status: 'confirmed' } },
    { $group: { _id: null, total: { $sum: '$amountETB' } } },
  ]);

  const totalConfirmedDepositsETB = result[0]?.total || 0;

const user = await User.findById(userId)
  .select('hasWageredFromDeposit hasPlacedFirstBet lockedBalance isAgent')
  .lean();

const hasWageredFromDeposit = user?.hasWageredFromDeposit === true;
const hasPlacedFirstBet = user?.hasPlacedFirstBet === true;
const lockedBalance = user?.lockedBalance ?? 0;
const isAgent = user?.isAgent === true;                                  // ← NEW
const bonusCleared = lockedBalance < BONUS_CLEAR_THRESHOLD;

  const fullyUnlocked =
    totalConfirmedDepositsETB >= 200 ||
    (hasWageredFromDeposit && totalConfirmedDepositsETB > 10);

  const maxWithdrawableNow = fullyUnlocked
    ? Number.POSITIVE_INFINITY
    : hasPlacedFirstBet
      ? totalConfirmedDepositsETB
      : 0;

  // Both gates must pass: bonus cleared AND Option-C rules satisfied
const effectiveBonusCleared = bonusCleared || isAgent;

const canWithdraw =
  effectiveBonusCleared &&
  (typeof requestedAmount === 'number' && requestedAmount > 0
    ? requestedAmount <= maxWithdrawableNow
    : maxWithdrawableNow > 0);

  return {
    totalConfirmedDepositsETB,
    canWithdraw,
    hasWageredFromDeposit,
    maxWithdrawableNow,
    hasPlacedFirstBet,
    lockedBalance,
    bonusCleared,           // kept honest — still false for agents with locked bonus
    bonusClearThreshold: BONUS_CLEAR_THRESHOLD,
    isAgent,                // ← NEW
  };
}