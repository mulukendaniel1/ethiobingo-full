// src/cron/subscriptionChecker.ts
import { CronJob } from 'cron';
import { User } from '../core/database/models/User';
import { ChannelSubscription } from '../core/utils/channelSubscription';
import { logger } from '../core/utils/logger';
import { AuditLog } from '../core/database/models/AuditLog';
import mongoose from 'mongoose';
import { IUser } from '../core/database/models/User';
import { sanitizeInput } from '../core/utils/security';

export class SubscriptionChecker {
  private job: CronJob;

  constructor() {
    // Run every 6 hours to check subscriptions
    this.job = new CronJob('0 */6 * * *', this.checkAllSubscriptions.bind(this));
  }

  async checkAllSubscriptions(): Promise<void> {
    try {
      logger.info('🔄 Starting comprehensive subscription check for all users...');

      const { getBotInstance } = await import('../bot/framework');
      const bot = getBotInstance();

      if (!bot) {
        logger.warn('❌ Bot instance not available for subscription check');
        return;
      }

      // Check users marked as subscribed but might have left
      const subscribedUsers = await User.find({
        isSubscribed: true,
        isAdmin: false,
        lastSubscriptionCheck: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Check daily
      }).limit(100); // Check 100 users per run

      // Also check recently active users who might not be subscribed
      const recentlyActiveUsers = await User.find({
        isAdmin: false,
        isBanned: false,
        lastLoginAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // active last 7 days
        isSubscribed: false,
        lastSubscriptionCheck: { $lt: new Date(Date.now() - 12 * 60 * 60 * 1000) } // not checked in 12h
      }).limit(50);

      const allUsers = [...subscribedUsers, ...recentlyActiveUsers];
      // Remove duplicates by _id
      const uniqueUsers = new Map();
      for (const user of allUsers) {
        uniqueUsers.set(user._id.toString(), user);
      }
      const usersToCheck = Array.from(uniqueUsers.values());

      logger.info(`Checking ${usersToCheck.length} users for subscription status`);

      let checkedCount = 0;
      let unsubscribedCount = 0;
      let notifiedCount = 0;

      for (const user of usersToCheck) {
        try {
          const telegramId = user.telegramId;
          if (!telegramId) {
            logger.warn(`User ${user._id} has no telegramId, skipping`);
            continue;
          }

          // Check current subscription
          const isSubscribed = await ChannelSubscription.checkSubscription(telegramId, bot.api);
          const wasSubscribed = user.isSubscribed;

          user.isSubscribed = isSubscribed;
          user.lastSubscriptionCheck = new Date();
          await user.save();

          checkedCount++;

          // If user was subscribed but now is not
          if (!isSubscribed && wasSubscribed) {
            unsubscribedCount++;

            // Log the change
            await AuditLog.create({
              action: 'USER_UNSUBSCRIBED_FROM_CHANNEL',
              actionType: 'SYSTEM',
              severity: 'INFO',
              entityType: 'User',
              entityId: user._id.toString(),
              userId: user._id,
              userTelegramId: telegramId,
              details: {
                reason: 'Channel membership lost',
                channel: ChannelSubscription.channelUsername
              },
              source: 'CRON',
              environment: process.env.NODE_ENV as any
            });

            // Notify user (only if recently active)
            const lastActive = user.lastLoginAt || user.createdAt;
            const daysSinceActive = lastActive
              ? Math.floor((Date.now() - new Date(lastActive).getTime()) / (1000 * 60 * 60 * 24))
              : 30;

            if (daysSinceActive <= 7) { // Notify if active within the last week
              try {
                const message =
                  `📢 *Stay Connected!*\n\n` +
                  `We noticed you're no longer subscribed to our channel.\n\n` +
                  `By rejoining, you'll get:\n` +
                  `✅ Faster payout approvals\n` +
                  `✅ Exclusive bonus offers\n` +
                  `✅ Priority support\n` +
                  `✅ System updates\n\n` +
                  `Join now: @${ChannelSubscription.channelUsername}`;

                await bot.api.sendMessage(telegramId, message, {
                  parse_mode: 'Markdown' as const,
                  reply_markup: {
                    inline_keyboard: [
                      [
                        {
                          text: `✅ Join @${ChannelSubscription.channelUsername}`,
                          url: `https://t.me/${ChannelSubscription.channelUsername}`
                        }
                      ],
                      [{ text: '🔄 Verify Now', callback_data: 'verify_subscription' }]
                    ]
                  }
                });

                notifiedCount++;
              } catch (error: any) {
                if (error.error_code === 403) {
                  logger.warn(`User ${telegramId} blocked the bot`);
                  user.isBanned = true;
                  user.banReason = 'Blocked bot';
                  await user.save();
                } else {
                  logger.warn(`Failed to notify user ${telegramId}:`, error.message);
                }
              }
            }
          }

          // Small delay to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          logger.error(`Error checking subscription for user ${user._id}:`, error);
        }
      }

      // Also encourage new users who haven't subscribed yet
      await this.encourageNewUsers(bot);

      logger.info(`✅ Subscription check completed:
        • Total checked: ${checkedCount}
        • Unsubscribed: ${unsubscribedCount}
        • Notified: ${notifiedCount}`);

      await this.logSubscriptionStats();
    } catch (error) {
      logger.error('❌ Subscription check job failed:', error);
    }
  }

  /**
   * Encourage new users who haven't subscribed yet
   */
  private async encourageNewUsers(bot: any): Promise<void> {
    try {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

      const newUsers = await User.find({
        createdAt: { $gte: threeDaysAgo },
        isSubscribed: false,
        isAdmin: false,
        isBanned: false,
        lastSubscriptionCheck: { $lt: new Date(Date.now() - 12 * 60 * 60 * 1000) }
      }).limit(50);

      logger.info(`Found ${newUsers.length} new users to encourage subscription`);

      for (const user of newUsers) {
        try {
          const telegramId = user.telegramId;
          if (!telegramId) continue;

          user.lastSubscriptionCheck = new Date();
          await user.save();

          const hasBalance = user.balanceMain > 0;

          let message = hasBalance
            ? `🎯 *Ready to Earn More?*\n\n` +
              `You've already started using the bot!\n\n` +
              `🔓 *Unlock full access by joining our channel:*\n\n` +
              `📢 @${ChannelSubscription.channelUsername}\n\n` +
              `✅ Priority payout processing\n` +
              `🔷 Higher daily limits\n` +
              `💎 Exclusive bonus offers`
            : `🔷 *Ready to Start Earning?*\n\n` +
              `Join our channel to get started:\n\n` +
              `📢 @${ChannelSubscription.channelUsername}\n\n` +
              `By joining you'll get:\n` +
              `✅ Access to account registration\n` +
              `✅ Step-by-step tutorials\n` +
              `✅ Priority support\n` +
              `✅ Bonus opportunities`;

          await bot.api.sendMessage(telegramId, message, {
            parse_mode: 'Markdown' as const,
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: `✅ Join @${ChannelSubscription.channelUsername}`,
                    url: `https://t.me/${ChannelSubscription.channelUsername}`
                  }
                ],
                [{ text: '❌ Not Now', callback_data: 'dismiss_suggestion' }]
              ]
            }
          });

          logger.debug(`Encouraged new user ${telegramId} to subscribe`);
          await new Promise(resolve => setTimeout(resolve, 50));
        } catch (error: any) {
          if (error.error_code !== 403) {
            logger.warn(`Failed to encourage new user:`, error.message);
          }
        }
      }
    } catch (error) {
      logger.error('Error encouraging new users:', error);
    }
  }

  /**
   * Log subscription statistics
   */
  private async logSubscriptionStats(): Promise<void> {
    try {
      const totalUsers = await User.countDocuments({ isAdmin: false });
      const subscribedUsers = await User.countDocuments({
        isSubscribed: true,
        isAdmin: false,
        isBanned: false
      });
      const unsubscribedUsers = await User.countDocuments({
        isSubscribed: false,
        isAdmin: false,
        isBanned: false
      });

      const subscriptionRate = totalUsers > 0 ? (subscribedUsers / totalUsers) * 100 : 0;

      logger.info(`📊 Subscription Statistics:
        • Total Users: ${totalUsers}
        • Subscribed: ${subscribedUsers} (${subscriptionRate.toFixed(1)}%)
        • Not Subscribed: ${unsubscribedUsers}
      `);

      // Store stats in audit log weekly
      const today = new Date();
      if (today.getDay() === 1) {
        // Monday
        await AuditLog.create({
          action: 'WEEKLY_SUBSCRIPTION_STATS',
          actionType: 'SYSTEM',
          severity: 'INFO',
          details: {
            totalUsers,
            subscribedUsers,
            unsubscribedUsers,
            subscriptionRate: subscriptionRate.toFixed(1)
          },
          source: 'CRON',
          environment: process.env.NODE_ENV as any
        });
      }
    } catch (error) {
      logger.error('Error logging subscription stats:', error);
    }
  }

  /**
   * Perform a targeted check for specific users
   */
  async checkSpecificUsers(userIds: number[]): Promise<{ [userId: number]: boolean }> {
    const results: { [userId: number]: boolean } = {};

    try {
      const { getBotInstance } = await import('../bot/framework');
      const bot = getBotInstance();

      if (!bot) {
        throw new Error('Bot instance not available');
      }

      for (const rawUserId of userIds) {
        try {
          const userId = parseInt(sanitizeInput(rawUserId.toString()));
          if (isNaN(userId)) {
            logger.warn(`Invalid user ID in checkSpecificUsers: ${rawUserId}`);
            results[rawUserId] = false;
            continue;
          }

          const isSubscribed = await ChannelSubscription.checkSubscription(userId, bot.api);
          results[rawUserId] = isSubscribed;

          await User.findOneAndUpdate(
            { telegramId: userId },
            {
              isSubscribed,
              lastSubscriptionCheck: new Date()
            }
          );

          await new Promise(resolve => setTimeout(resolve, 50));
        } catch (error) {
          logger.error(`Error checking user ${rawUserId}:`, error);
          results[rawUserId] = false;
        }
      }
    } catch (error) {
      logger.error('Error in targeted subscription check:', error);
    }

    return results;
  }

  /**
   * Get subscription analytics for admin dashboard
   */
  async getSubscriptionAnalytics(): Promise<any> {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const dailyStats = await User.aggregate([
        {
          $match: {
            createdAt: { $gte: thirtyDaysAgo },
            isAdmin: false
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
              day: { $dayOfMonth: '$createdAt' }
            },
            totalUsers: { $sum: 1 },
            subscribedUsers: {
              $sum: { $cond: [{ $eq: ['$isSubscribed', true] }, 1, 0] }
            }
          }
        },
        {
          $project: {
            date: {
              $dateFromParts: {
                year: '$_id.year',
                month: '$_id.month',
                day: '$_id.day'
              }
            },
            totalUsers: 1,
            subscribedUsers: 1,
            subscriptionRate: {
              $cond: [
                { $eq: ['$totalUsers', 0] },
                0,
                { $multiply: [{ $divide: ['$subscribedUsers', '$totalUsers'] }, 100] }
              ]
            }
          }
        },
        { $sort: { date: 1 } }
      ]);

      const activityStats = await User.aggregate([
        {
          $match: { isAdmin: false }
        },
        {
          $group: {
            _id: '$isSubscribed',
            count: { $sum: 1 },
            avgJobsCompleted: { $avg: '$jobsCompleted' },
            avgBalance: { $avg: '$balanceMain' },
            avgLastActiveDays: {
              $avg: {
                $divide: [
                  { $subtract: [new Date(), '$lastLoginAt'] },
                  1000 * 60 * 60 * 24
                ]
              }
            }
          }
        }
      ]);

      return {
        dailyStats,
        activityStats,
        summary: {
          totalUsers: await User.countDocuments({ isAdmin: false }),
          subscribedUsers: await User.countDocuments({ isSubscribed: true, isAdmin: false }),
          unsubscribedUsers: await User.countDocuments({ isSubscribed: false, isAdmin: false }),
          averageSubscriptionRate:
            dailyStats.length > 0
              ? dailyStats.reduce((sum: number, day: any) => sum + day.subscriptionRate, 0) /
                dailyStats.length
              : 0
        }
      };
    } catch (error) {
      logger.error('Error getting subscription analytics:', error);
      return null;
    }
  }

  start(): void {
    this.job.start();
    logger.info('✅ Subscription checker started (runs every 6 hours)');
  }

  stop(): void {
    this.job.stop();
    logger.info('🛑 Subscription checker stopped');
  }

  async runImmediateCheck(): Promise<void> {
    logger.info('🔷 Running immediate subscription check...');
    await this.checkAllSubscriptions();
  }
}

export const subscriptionChecker = new SubscriptionChecker();