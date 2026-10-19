// src/services/referralService.ts
import { User } from '../core/database/models/User';
import { env } from '../core/config/env';
import { logger } from '../core/utils/logger';
import mongoose from 'mongoose';
import { sanitizeInput } from '../core/utils/security';
import { SystemSettings } from '../core/database/models/SystemSettings';
import { getSettings } from '@/core/utils/settingsCache';
import { recordLedger } from './ledgerHelper';
import { NotificationService } from './notificationService';

export class ReferralService {
    private notificationService: NotificationService;

  constructor() {
    this.notificationService = new NotificationService();
  }
  async registerWithReferralCode(
    newUserId: mongoose.Types.ObjectId,
    referralCode?: string
  ): Promise<{ success: boolean; referrer?: any; bonusAmount?: number }> {
   const settings = getSettings();
  if (!referralCode || !settings.referralEnabled) {  // ← change here
    return { success: true };
  }

    const safeCode = sanitizeInput(referralCode);
    const referrer = await User.findOne({ referralCode: safeCode });
    if (!referrer) return { success: false };

    const newUser = await User.findById(newUserId);
    if (!newUser) return { success: false };
    if (newUser.referredBy) {
      logger.info(`User ${newUserId} already has referrer, skipping referral bonus`);
      return { success: true };
    }

    // Set referrer
    await User.findByIdAndUpdate(newUserId, { referredBy: referrer._id });

    const settingsDoc = await SystemSettings.findOne({ key: 'referral_bonus_amount' });
    const bonusAmount = settingsDoc?.value ?? 10;

    if (bonusAmount > 0) {
         // Atomic update: add to lockedBalance (non-withdrawable) and ETBCoins
    const shouldRearm = (referrer.totalConfirmedDepositsETB || 0) < 200;

    const update: any = {
      $inc: {
        lockedBalance: bonusAmount,
        bonusBalance: bonusAmount,
        ETBCoins: bonusAmount,
        referralEarnings: bonusAmount,
        totalCommissionPaid: bonusAmount,
        referralCount: 1
      },
      $push: {
        referrals: {
          userId: newUserId,
          level: 1,
          joinedAt: new Date(),
          firstDepositBonusGiven: false
        },
        ETBCoinTransactions: {
          type: 'earned',
          amount: bonusAmount,
          reference: `REFERRAL-${newUserId}`,
          notes: `Referral bonus for inviting new user`,
          timestamp: new Date()
        }
      }
    };

    if (shouldRearm) {
      update.$set = { isAbuser: true };
    }

    const referrerAfter = await User.findByIdAndUpdate(referrer._id, update, {
      new: true,
      runValidators: true
    });

    if (!referrerAfter) {
      logger.error(`Failed to update referrer after bonus: ${referrer._id}`);
      return { success: false };
    }

    await recordLedger({
      userId: referrerAfter._id,
      type: 'referral_bonus',
      amount: bonusAmount,
      balanceAfter: referrerAfter.ETBCoins,
      referenceId: `REF-${newUserId}`,
      notes: `Referral bonus for inviting new user`,
    });

    logger.info(`Referrer ${referrer.telegramId} earned ${bonusAmount} ETB (locked) for inviting ${newUserId}`);
    }

    return { success: true, referrer, bonusAmount };
  }

  async getUserReferralStats(userId: mongoose.Types.ObjectId) {
    const user = await User.findById(userId)
      .populate('referrals.userId', 'telegramId username firstName');
    if (!user) return null;
    return {
      referralCode: user.referralCode,
      referralCount: user.referralCount,
      referralEarnings: user.referralEarnings,
      referrals: user.referrals,
    };
  }

    async registerReferralWithoutBonus(
    newUserId: mongoose.Types.ObjectId,
    referralCode: string
  ): Promise<{ success: boolean; referrer?: any }> {
    const settings = getSettings();
    if (!referralCode || !settings.referralEnabled) return { success: true };

    const referrer = await User.findOne({ referralCode: sanitizeInput(referralCode) });
    if (!referrer) return { success: false };

    const newUser = await User.findById(newUserId);
    if (!newUser || newUser.referredBy) return { success: true };

    // Set referrer and push referral entry, no bonus yet
    await User.findByIdAndUpdate(newUserId, { referredBy: referrer._id });
    await User.findByIdAndUpdate(referrer._id, {
      $inc: { referralCount: 1 },
      $push: {
        referrals: {
          userId: newUserId,
          level: 1,
          joinedAt: new Date(),
          firstDepositBonusGiven: false,
          referralSignupBonusGiven: false,  // explicitly false
        },
      },
    });

    return { success: true, referrer };
  }

    async awardReferralBonusAfterPhoneVerification(
    newUserId: mongoose.Types.ObjectId,
    referralCode: string
  ): Promise<void> {
    const referrer = await User.findOne({ referralCode: sanitizeInput(referralCode) });
    if (!referrer) return;

    const alreadyAwarded = referrer.referrals.some(
      (r) => r.userId.toString() === newUserId.toString() && r.referralSignupBonusGiven
    );
    if (alreadyAwarded) return;

    const settingsDoc = await SystemSettings.findOne({ key: 'referral_bonus_amount' });
    const bonusAmount = settingsDoc?.value ?? 10;

    if (bonusAmount > 0) {
      const shouldRearm = (referrer.totalConfirmedDepositsETB || 0) < 200;

      const update: any = {
        $inc: {
          lockedBalance: bonusAmount,
          bonusBalance: bonusAmount,
          ETBCoins: bonusAmount,
          referralEarnings: bonusAmount,
          totalCommissionPaid: bonusAmount,
        },
        $set: { 'referrals.$[elem].referralSignupBonusGiven': true },
        $push: {
          ETBCoinTransactions: {
            type: 'earned',
            amount: bonusAmount,
            reference: `REFERRAL-${newUserId}`,
            notes: 'Referral bonus (phone verified)',
            timestamp: new Date(),
          },
        },
      };

      if (shouldRearm) {
        update.$set.isAbuser = true;
      }

      await User.updateOne(
        { _id: referrer._id, 'referrals.userId': newUserId },
        update,
        { arrayFilters: [{ 'elem.userId': newUserId }] }
      );

      // Record ledger
      await recordLedger({
        userId: referrer._id,
        type: 'referral_bonus',
        amount: bonusAmount,
        balanceAfter: referrer.ETBCoins + bonusAmount, // approximate; better fetch updated user
        referenceId: `REF-${newUserId}`,
        notes: 'Referral bonus (phone verified)',
      });

      // Send notification
      this.notificationService.sendReferralBonus(
        referrer.telegramId,
        bonusAmount,
        newUserId.toString(),
        referrer.language || 'en'
      ).catch(err => logger.error('Failed to send referral bonus notification:', err));

      logger.info(`Referrer ${referrer.telegramId} earned ${bonusAmount} ETB for verified referral ${newUserId}`);
    }
  }
}

export const referralService = new ReferralService();