// src/services/notificationService.ts
import { getSettings } from '@/core/utils/settingsCache';
import { User } from '../core/database/models/User';
import { logger } from '../core/utils/logger';
import { MessageFormatter } from '../core/utils/messageFormatter';
import { UrlFormatter } from '../core/utils/urlFormatter';
import { t } from '@/bot/utils/i18n';

export class NotificationService {
  private bot: any = null;

  constructor(bot?: any) {
    if (bot) {
      this.bot = bot;
    } else {
      // Lazy load to avoid circular dependencies
      import('../bot/framework').then(module => {
        this.bot = module.getBotInstance();
      }).catch(error => {
        logger.error('Failed to load bot instance:', error);
      });
    }
  }

  private async ensureBot(): Promise<any> {
    if (this.bot) return this.bot;
    
    try {
      const { getBotInstance } = await import('../bot/framework');
      this.bot = getBotInstance();
      return this.bot;
    } catch (error) {
      logger.error('Failed to get bot instance:', error);
      throw new Error('Bot instance not available');
    }
  }

  async sendAdminAlert(message: string, level: 'info' | 'warning' | 'error' = 'info'): Promise<void> {
    try {
      const bot = await this.ensureBot();
      
      // Fetch admin IDs from database settings
      const adminIdsStr = getSettings().adminIds;
      if (!adminIdsStr || adminIdsStr.trim() === '') {
        logger.warn('No admin IDs configured in settings. Admin alerts will not be sent.');
        return;
      }
      
      const adminIds = adminIdsStr.split(',')
        .map(id => parseInt(id.trim()))
        .filter(id => !isNaN(id));
      
      if (adminIds.length === 0) {
        logger.warn('No valid admin IDs found after parsing.');
        return;
      }
      
      const prefix = level === 'error' ? '🚨' : level === 'warning' ? '⚠️' : 'ℹ️';
      const formattedMessage = `${prefix} ${message}`;
      
      logger.debug(`Sending admin alert to ${adminIds.length} admins: ${formattedMessage.substring(0, 100)}...`);
      
      for (const adminId of adminIds) {
        try {
          await bot.api.sendMessage(adminId, formattedMessage, {
            parse_mode: 'Markdown'
          });
          logger.debug(`Admin alert sent to ${adminId}`);
        } catch (error) {
          logger.error(`Failed to send admin alert to ${adminId}:`, error);
        }
      }
    } catch (error) {
      logger.error('Failed to send admin alert:', error);
    }
  }

  async broadcastToUsers(message: string, filters?: { minBalance?: number }): Promise<number> {
    try {
      const { botInstance } = await import('../bot/framework');
      if (!botInstance) {
        logger.warn('Bot instance not available for broadcast');
        return 0;
      }
      
      const query: any = {};
      if (filters?.minBalance) {
        query.balanceMain = { $gte: filters.minBalance };
      }
      
      const users = await User.find(query).select('telegramId').lean();
      let sentCount = 0;
      
      logger.info(`Starting broadcast to ${users.length} users...`);
      
      for (const user of users) {
        try {
          await botInstance.api.sendMessage(user.telegramId, message, {
            parse_mode: 'HTML' as const
          });
          sentCount++;
          await new Promise(resolve => setTimeout(resolve, 50));
        } catch (error: any) {
          if (!error.message.includes('bot was blocked') && 
              !error.message.includes('chat not found')) {
            logger.error(`Failed to send broadcast to user ${user.telegramId}:`, error.message);
          }
        }
      }
      
      logger.info(`✅ Broadcast completed: ${sentCount}/${users.length} users`);
      return sentCount;
    } catch (error) {
      logger.error(`Broadcast failed:`, error);
      return 0;
    }
  }

  /**
   * Notify a user that they have been upgraded to admin
   */
  async sendAdminUpgradeNotification(telegramId: number, email: string): Promise<void> {
    const bot = await this.ensureBot();
    const message = `🔐 *You have been granted admin access!*\n\n` +
      `Your administrator login email is: *${email}*\n` +
      `Please contact the main administrator to receive your password.\n\n` +
      `Use the admin panel to manage the bot.`;
    try {
      await bot.api.sendMessage(telegramId, message, { parse_mode: 'Markdown' });
    } catch (error) {
      logger.error(`Failed to send admin upgrade notification to ${telegramId}:`, error);
    }
  }

  /**
   * Send the admin credentials (email + password) to a user
   */
  async sendAdminCredentials(telegramId: number, email: string, password: string): Promise<void> {
    const bot = await this.ensureBot();
    const message = `🔑 *Your Admin Credentials*\n\n` +
      `Email: \`${email}\`\n` +
      `Password: \`${password}\`\n\n` +
      `⚠️ Please store them securely and change your password after first login.`;
    try {
      await bot.api.sendMessage(telegramId, message, { parse_mode: 'Markdown' });
    } catch (error) {
      logger.error(`Failed to send admin credentials to ${telegramId}:`, error);
    }
  }

  async sendAdminRevokedNotification(telegramId: number): Promise<void> {
  const bot = await this.ensureBot();
  const message = `⚠️ *Admin privileges revoked*\n\n` +
    `You are no longer an administrator. Your admin access has been removed.`;
  try {
    await bot.api.sendMessage(telegramId, message, { parse_mode: 'Markdown' });
  } catch (error) {
    logger.error(`Failed to send admin revoked notification to ${telegramId}:`, error);
  }
}

  async sendDepositConfirmed(userId: number, amountETB: number, requestId: string) {
    const bot = await this.ensureBot();
    
    // Fetch user's language preference
    const user = await User.findOne({ telegramId: userId }).select('language').lean();
    const lang = user?.language || 'en';
    
    const message = t(lang, 'notification.deposit_confirmed', {
      amount: amountETB.toFixed(2),
      id: requestId,
    });
    
    await bot.api.sendMessage(userId, message, { parse_mode: 'Markdown' });
  }

  async sendDepositRejected(userId: number, amountETB: number, requestId: string, reason: string) {
    const bot = await this.ensureBot();
    const message = `❌ *Deposit Rejected*\n\n` +
      `Request ID: \`${requestId}\`\n` +
      `Amount: ${amountETB} ETB\n` +
      `Reason: ${reason}\n\n` +
      `Please contact support if you have questions.`;
    await bot.api.sendMessage(userId, message, { parse_mode: 'Markdown' });
  }

  async sendWithdrawalProcessed(userId: number, amountETB: number, requestId: string) {
    const bot = await this.ensureBot();
    const message = `✅ *Withdrawal Processed*\n\n` +
      `Request ID: \`${requestId}\`\n` +
      `Amount: ${amountETB} ETB → ${amountETB} ETB\n\n` +
      `Your withdrawal has been sent.`;
    await bot.api.sendMessage(userId, message, { parse_mode: 'Markdown' });
  }

  async sendWithdrawalRejected(userId: number, amountETB: number, requestId: string, reason: string) {
    const bot = await this.ensureBot();
    const message = `❌ *Withdrawal Rejected*\n\n` +
      `Request ID: \`${requestId}\`\n` +
      `Amount: ${amountETB} ETB\n` +
      `Reason: ${reason}\n\n` +
      `Please contact support.`;
    await bot.api.sendMessage(userId, message, { parse_mode: 'Markdown' });
  }

  async sendAgentApproved(telegramId: number) {
    const bot = await this.ensureBot();
    await bot.api.sendMessage(telegramId, 
      `✅ *Agent Approved!*\n\n` +
      `Congratulations! Your request to become an agent has been approved.\n` +
      `You can now earn commissions when your referrals deposit.\n\n` +
      `Share your referral link with friends to start earning!`,
      { parse_mode: 'Markdown' }
    );
  }

  async sendAgentRejected(telegramId: number, reason?: string) {
    const bot = await this.ensureBot();
    let message = `❌ *Agent Request Rejected*\n\nYour request to become an agent was not approved.`;
    if (reason) message += `\nReason: ${reason}`;
    message += `\n\nIf you have questions, contact support.`;
    await bot.api.sendMessage(telegramId, message, { parse_mode: 'Markdown' });
  }

  async sendUserBanned(telegramId: number, reason?: string) {
    const bot = await this.ensureBot();
    const message = `❌ *Account Suspended*\n\nYour account has been banned. Reason: ${reason || 'Violation of terms'}\n\nIf you believe this is a mistake, please contact support.`;
    await bot.api.sendMessage(telegramId, message, { parse_mode: 'Markdown' });
  }

  async sendUserUnbanned(telegramId: number) {
    const bot = await this.ensureBot();
    const message = `✅ *Account Restored*\n\nYour account has been unbanned. You can now use the bot again.\n\nThank you for your patience.`;
    await bot.api.sendMessage(telegramId, message, { parse_mode: 'Markdown' });
  }

  /**
 * Notify agent about first deposit bonus from a referred user (non-withdrawable)
 */
async sendAgentFirstDepositBonus(
  agentTelegramId: number,
  bonusAmount: number,
  referredUserTelegramId: number,
  depositAmount: number,
  isLocked: boolean = true
): Promise<void> {
  const bot = await this.ensureBot();
  const message = 
    `🎉 *Agent Bonus Earned!*\n\n` +
    `A user you referred (ID: \`${referredUserTelegramId}\`) made their first deposit of *${depositAmount} ETB*.\n\n` +
    `You received a *one‑time bonus* of *${bonusAmount} ETB* (${isLocked ? 'non‑withdrawable' : 'withdrawable'}).\n\n` +
    `Keep inviting more users to earn commissions on every deposit!`;
  
  try {
    await bot.api.sendMessage(agentTelegramId, message, { parse_mode: 'Markdown' });
  } catch (error) {
    logger.error(`Failed to send agent first deposit bonus notification to ${agentTelegramId}:`, error);
  }
}

/**
 * Notify agent about commission from a deposit by a referred user (withdrawable)
 */
async sendAgentCommission(
  agentTelegramId: number,
  commissionAmount: number,
  referredUserTelegramId: number,
  depositAmount: number,
  commissionPercent: number,
  isWithdrawable: boolean = true
): Promise<void> {
  const bot = await this.ensureBot();
  const message = 
    `🤑 *Agent Commission Earned!*\n\n` +
    `A user you referred (ID: \`${referredUserTelegramId}\`) deposited *${depositAmount} ETB*.\n\n` +
    `You earned *${commissionPercent}%* commission: *${commissionAmount} ETB* (${isWithdrawable ? 'withdrawable' : 'locked'}).\n\n` +
    `Track your earnings insettings transaction.`;
  
  try {
    await bot.api.sendMessage(agentTelegramId, message, { parse_mode: 'Markdown' });
  } catch (error) {
    logger.error(`Failed to send agent commission notification to ${agentTelegramId}:`, error);
  }
}

  /**
   * Notify user about global deposit bonus.
   */
  async sendDepositBonus(
    userId: number,
    bonusAmount: number,
    depositAmount: number,
    bonusPercent: number,
    lang: string = 'en'
  ): Promise<void> {
    const bot = await this.ensureBot();
    const message =
      `🎁 *Deposit Bonus Received!*\n\n` +
      `You received a *${bonusPercent}%* bonus of *${bonusAmount.toFixed(2)} ETB* on your deposit of *${depositAmount.toFixed(2)} ETB*.\n\n` +
      `This bonus is non‑withdrawable and has been added to your locked balance. It can be converted to withdrawable balance later.\n\n` +
      `Thank you for using our service!`;
    
    try {
      await bot.api.sendMessage(userId, message, { parse_mode: 'Markdown' });
    } catch (error) {
      logger.error(`Failed to send deposit bonus notification to ${userId}:`, error);
    }
  }

    /**
   * Notify referrer about the signup referral bonus (non-withdrawable)
   */
  async sendReferralBonus(
    referrerTelegramId: number,
    bonusAmount: number,
    referredUserId: string,
    lang: string = 'en'
  ): Promise<void> {
    const bot = await this.ensureBot();
    const message =
      `🎉 *Referral Bonus Earned!*\n\n` +
      `You received *${bonusAmount.toFixed(2)} ETB* because someone you invited verified their phone number.\n\n` +
      `This bonus is non‑withdrawable and can be used to play games.\n\n` +
      `Keep inviting friends to earn more!`;
    
    try {
      await bot.api.sendMessage(referrerTelegramId, message, { parse_mode: 'Markdown' });
    } catch (error) {
      logger.error(`Failed to send referral bonus notification to ${referrerTelegramId}:`, error);
    }
  }

    /**
   * Notify a user that they won a weekly reward.
   */
  async sendWeeklyReward(
    telegramId: number,
    type: 'depositor' | 'referrer',
    amount: number,
    rank: number,
    metricValue: number,
    weekId: string,
    lang: string = 'en'
  ): Promise<void> {
    const bot = await this.ensureBot();
    const headline = type === 'depositor'
      ? '🏆 *Weekly Top Depositor Reward!*'
      : '🏆 *Weekly Top Referrer Reward!*';
    const metricLine = type === 'depositor'
      ? `Total deposited: *${metricValue.toFixed(2)} ETB*`
      : `New verified referrals: *${metricValue}*`;
    const message =
      `${headline}\n\n` +
      `Congratulations! You ranked *#${rank}* for week \`${weekId}\`.\n\n` +
      `${metricLine}\n` +
      `Reward: *${amount.toFixed(2)} ETB*\n\n` +
      `💡 This reward has been added to your *non‑withdrawable* balance. ` +
      `Play games to convert it to withdrawable balance.\n\n` +
      `Keep it up! 🎉`;
    try {
      await bot.api.sendMessage(telegramId, message, { parse_mode: 'Markdown' });
    } catch (error) {
      logger.error(`Failed to send weekly reward notification to ${telegramId}:`, error);
    }
  }

  /**
   * Notify a user that a weekly reward was reverted.
   */
  async sendWeeklyRewardReverted(
    telegramId: number,
    amount: number,
    revertedAmount: number,
    reason: string,
    weekId: string
  ): Promise<void> {
    const bot = await this.ensureBot();
    const message =
      `⚠️ *Weekly Reward Reverted*\n\n` +
      `Week: \`${weekId}\`\n` +
      `Original reward: *${amount.toFixed(2)} ETB*\n` +
      `Reclaimed: *${revertedAmount.toFixed(2)} ETB*\n` +
      (reason ? `Reason: ${reason}\n\n` : '\n') +
      `If you believe this is a mistake, please contact support.`;
    try {
      await bot.api.sendMessage(telegramId, message, { parse_mode: 'Markdown' });
    } catch (error) {
      logger.error(`Failed to send reward revert notification to ${telegramId}:`, error);
    }
  }

  /**
 * Send a detailed balance adjustment notification
 * @param userId Telegram ID
 * @param amount The adjustment amount (positive for addition, negative for subtraction)
 * @param newBalance The new ETBCoins balance after adjustment
 * @param withdrawableBalance Current withdrawable (balanceMain)
 * @param lockedBalance Current lockedBalance (non‑withdrawable)
 * @param reason Optional custom reason for the adjustment
 * @param lang User's language (default 'en')
 */
async sendBalanceAdjusted(
  userId: number,
  amount: number,
  newBalance: number,
  withdrawableBalance: number,
  lockedBalance: number,
  reason?: string,
  lang: string = 'en'
) {
  const bot = await this.ensureBot();
  const sign = amount > 0 ? '+' : '';
  const absoluteAmount = Math.abs(amount).toFixed(2);
  const isAddition = amount > 0;

  // Build the message in English (can be localized later)
  const message = 
    `🤑 *Balance Update*\n\n` +
    `Your account balance has been *${isAddition ? 'increased' : 'decreased'}* by *${sign}${absoluteAmount} ETB*.\n\n` +
    `📊 *Current Balances:*\n` +
    `• Withdrawable: *${withdrawableBalance.toFixed(2)} ETB*\n` +
    `• Non‑withdrawable: *${lockedBalance.toFixed(2)} ETB*\n` +
    `• Total Balance: *${newBalance.toFixed(2)} ETB*\n\n` +
    (reason ? `📝 *Reason:* ${reason}\n\n` : '') +
    `If you have any questions, please contact support.`;

  await bot.api.sendMessage(userId, message, { parse_mode: 'Markdown' });
}

/**
 * Send a detailed balance conversion notification
 * @param userId Telegram ID
 * @param amount The amount converted
 * @param newWithdrawable New withdrawable balance after conversion
 * @param newLocked New locked balance after conversion
 * @param lang User's language
 */
async sendBalanceConverted(
  userId: number,
  amount: number,
  newWithdrawable: number,
  newLocked: number,
  lang: string = 'en'
) {
  const bot = await this.ensureBot();
  const message = 
    `🔄 *Balance Conversion Completed*\n\n` +
    `*${amount.toFixed(2)} ETB* has been moved from your non‑withdrawable balance to your withdrawable balance.\n\n` +
    `📊 *Updated Balances:*\n` +
    `• Withdrawable: *${newWithdrawable.toFixed(2)} ETB*\n` +
    `• Non‑withdrawable: *${newLocked.toFixed(2)} ETB*\n` +
    `• Total Balance: *${(newWithdrawable + newLocked).toFixed(2)} ETB*\n\n` +
    `You can now withdraw this amount. Thank you!`;

  await bot.api.sendMessage(userId, message, { parse_mode: 'Markdown' });
}
}


export default NotificationService;