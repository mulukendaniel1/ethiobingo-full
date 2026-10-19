// src/services/ETBWithdrawalService.ts
import { User } from '../core/database/models/User';
import { ETBWithdrawal } from '../core/database/models/ETBWithdrawal';
import { logger } from '../core/utils/logger';
import { NotificationService } from './notificationService';
import { auditService } from './auditService';
import mongoose from 'mongoose';
import { sanitizeInput } from '../core/utils/security';
import { FeatureGuard } from '@/core/security/FeatureGuard';
import { recordLedger } from './ledgerHelper';

export class ETBWithdrawalService {
  private notificationService: NotificationService;

  constructor() {
    this.notificationService = new NotificationService();
  }

  private formatUsername(user: any): string {
  if (user.username) {
    // Escape underscores for Markdown
    const escaped = user.username.replace(/_/g, '\\_');
    return `@${escaped}`;
  }
  return user.telegramId.toString();
}

  async createWithdrawalRequest(
  userId: mongoose.Types.ObjectId,
  method: 'cbe' | 'abyssinia' | 'cbebirr' | 'telebirr',
  amountETB: number,
  destinationDetails: string
) {
  // Enforce hierarchy
  FeatureGuard.requireWithdrawEnabled(); // throws if master off or withdraw off
    
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const safeDestination = sanitizeInput(destinationDetails);
      if (!safeDestination) return { success: false, error: 'Invalid destination details' };
      if (amountETB <= 0) {
        await session.abortTransaction();
        return { success: false, error: 'Amount must be greater than 0' };
      }

      const existingPending = await ETBWithdrawal.findOne({ userId, status: 'pending' }).session(session);
      if (existingPending) {
        await session.abortTransaction();
        return { success: false, error: 'You already have a pending withdrawal request. Please wait for it to be processed.' };
      }

      const user = await User.findById(userId).session(session);

      if (!user) throw new Error('User not found');
      if (user.balanceMain < amountETB) throw new Error(`Insufficient balance`);

      // Deduct from both balanceMain and ETBCoins
      user.balanceMain -= amountETB;
      user.ETBCoins -= amountETB;
      user.lockedWithdrawAmount = (user.lockedWithdrawAmount || 0) + amountETB;
      await user.save({ session });

      const requestId = `WDR-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

      const withdrawal = await ETBWithdrawal.create([{
        userId,
        requestId,
        method,
        amountETB,
        destinationDetails: safeDestination,
        status: 'pending'
      }], { session });

      await recordLedger({
        userId,
        type: 'withdrawal_lock',
        amount: -amountETB,
        balanceAfter: user.ETBCoins, // already decreased
        referenceId: requestId,
        notes: `Withdrawal via ${method}`,
      });

      await session.commitTransaction();

      await this.notifyAdminsNewWithdrawal(withdrawal[0], user);
      logger.info(`Withdrawal request created: ${requestId} for user ${user.telegramId}`);

      return { success: true, requestId, amountETB };
    } catch (error: any) {
      await session.abortTransaction();
      logger.error({ err: error }, 'Create withdrawal error');
      return { success: false, error: error.message };
    } finally {
      session.endSession();
    }
  }

  async processWithdrawal(requestId: string, adminId: mongoose.Types.ObjectId, notes?: string) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const safeRequestId = sanitizeInput(requestId);
    
    // Atomically update withdrawal status
    const withdrawal = await ETBWithdrawal.findOneAndUpdate(
      { requestId: safeRequestId, status: 'pending' },
      { 
        $set: { 
          status: 'processed', 
          processedBy: adminId, 
          processedAt: new Date(),
          adminNotes: notes 
        }
      },
      { new: true, session }
    );
    
    if (!withdrawal) {
      await session.abortTransaction();
      return { success: false, error: 'Withdrawal not found or already processed' };
    }

    const user = await User.findById(withdrawal.userId).session(session);
    if (!user) {
      await session.abortTransaction();
      return { success: false, error: 'User not found' };
    }

    // Finalize: increase redeemed total, clear locked amount (ETBCoins already deducted at creation)
    user.totalETBRedeemed = (user.totalETBRedeemed || 0) + withdrawal.amountETB;
    user.lockedWithdrawAmount = Math.max(0, (user.lockedWithdrawAmount || 0) - withdrawal.amountETB);
    await user.save({ session });

    await session.commitTransaction();

    await this.notificationService.sendWithdrawalProcessed(
      user.telegramId,
      withdrawal.amountETB,
      withdrawal.requestId
    );

    await auditService.logAdminAction(
      adminId,
      user.telegramId,
      'WITHDRAWAL_PROCESSED',
      'FINANCIAL',
      'ETBWithdrawal',
      withdrawal._id.toString(),
      { requestId, amountETB: withdrawal.amountETB }
    );

    return { success: true };
  } catch (error: any) {
    await session.abortTransaction();
    logger.error({ err: error }, 'Process withdrawal error');
    return { success: false, error: error.message };
  } finally {
    session.endSession();
  }
}

  async rejectWithdrawal(requestId: string, adminId: mongoose.Types.ObjectId, reason: string) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const safeRequestId = sanitizeInput(requestId);
    const safeReason = sanitizeInput(reason);
    
    const withdrawal = await ETBWithdrawal.findOneAndUpdate(
      { requestId: safeRequestId, status: 'pending' },
      { 
        $set: { 
          status: 'rejected', 
          adminNotes: safeReason,
          processedBy: adminId,
          processedAt: new Date()
        }
      },
      { new: true, session }
    );
    
    if (!withdrawal) {
      await session.abortTransaction();
      return { success: false, error: 'Withdrawal not found or already processed' };
    }

    const user = await User.findById(withdrawal.userId).session(session);
    if (!user) {
      await session.abortTransaction();
      return { success: false, error: 'User not found' };
    }

    // Return locked coins to available balance
    user.balanceMain += withdrawal.amountETB;
    user.ETBCoins += withdrawal.amountETB;
    user.lockedWithdrawAmount = Math.max(0, (user.lockedWithdrawAmount || 0) - withdrawal.amountETB);
    await user.save({ session });

    await recordLedger({
      userId: withdrawal.userId,
      type: 'withdrawal_refund',
      amount: withdrawal.amountETB,
      balanceAfter: user.ETBCoins, // after refund
      referenceId: withdrawal.requestId,
      notes: `Refund: ${safeReason}`,
    });

    await session.commitTransaction();

    await this.notificationService.sendWithdrawalRejected(
      user.telegramId,
      withdrawal.amountETB,
      withdrawal.requestId,
      safeReason
    );

    await auditService.logAdminAction(
      adminId,
      user.telegramId,
      'WITHDRAWAL_REJECTED',
      'FINANCIAL',
      'ETBWithdrawal',
      withdrawal._id.toString(),
      { requestId: safeRequestId, reason: safeReason }
    );

    return { success: true };
  } catch (error: any) {
    await session.abortTransaction();
    logger.error({ err: error }, 'Reject withdrawal error');
    return { success: false, error: error.message };
  } finally {
    session.endSession();
  }
}

  private async notifyAdminsNewWithdrawal(withdrawal: any, user: any) {
  const message = 
    `⬆️ *New ETB Withdrawal Request*\n\n` +
    `Request ID: \`${withdrawal.requestId}\`\n` +
    `User: ${this.formatUsername(user)}\n` +
    `Method: ${withdrawal.method.toUpperCase()}\n` +
    `Amount: ${withdrawal.amountETB} ETB\n` +
    `Destination: \`${withdrawal.destinationDetails}\`\n` +
    `Time: ${withdrawal.createdAt.toLocaleString()}`;

  await this.notificationService.sendAdminAlert(message, 'info');
}
}