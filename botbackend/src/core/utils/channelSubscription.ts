// src/core/utils/channelSubscription.ts
import { Context } from '@/bot/framework';
import { User } from '@/core/database/models/User';
import { logger } from '@/core/utils/logger';
import { Api } from 'grammy';
import { KeyboardFactory } from '@/bot/framework/keyboards';
import { sanitizeInput } from './security';
import { getSettings } from './settingsCache';
import { escapeMarkdown } from './escapeMarkdown';

export class ChannelSubscription {
  private static cache = new Map<number, { isSubscribed: boolean; expiresAt: number }>();
  private static readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  public static get channelUsername(): string {
    const username = getSettings().channelUsername || 'ethio_bingo7';
    return username.replace(/^@+/, '');
  }

  public static get channelUrl(): string {
    return `https://t.me/${this.channelUsername}`;
  }

  static async checkSubscription(telegramId: number, api: Api): Promise<boolean> {
    const safeTelegramId = parseInt(sanitizeInput(telegramId.toString()));

    // Check cache
    const cached = this.cache.get(safeTelegramId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.isSubscribed;
    }

    try {
      const username = this.channelUsername;
      if (!username || username.trim() === '') {
        logger.warn('No channel username configured, allowing access');
        this.updateCache(safeTelegramId, true);
        return true;
      }

      const chatMember = await api.getChatMember(`@${username}`, safeTelegramId);
      const isSubscribed = ['member', 'administrator', 'creator'].includes(chatMember.status);

      this.updateCache(safeTelegramId, isSubscribed);
      return isSubscribed;
    } catch (error: any) {
      logger.warn(`Subscription check failed for user ${safeTelegramId}:`, error.message);

      // If bot is not admin or channel missing → allow (fail-open)
      if (error.description?.includes('bot is not a member') ||
          error.description?.includes('CHAT_NOT_FOUND') ||
          error.description?.includes('bot was kicked')) {
        logger.error(`Bot is not admin in channel @${this.channelUsername} or channel not found`);
        this.updateCache(safeTelegramId, true);
        return true;
      }

      // For ANY other error → allow (fail-open) to avoid blocking users
      this.updateCache(safeTelegramId, true);
      return true;
    }
  }

  static async forceCheckSubscription(telegramId: number, api: Api): Promise<boolean> {
    this.invalidateCache(telegramId);
    return this.checkSubscription(telegramId, api);
  }

  static invalidateCache(telegramId: number): void {
    this.cache.delete(telegramId);
  }

  private static updateCache(telegramId: number, isSubscribed: boolean): void {
    this.cache.set(telegramId, {
      isSubscribed,
      expiresAt: Date.now() + this.CACHE_TTL
    });
  }

  // TIERED SUBSCRIPTION CHECKING SYSTEM (unchanged, but now uses forceCheck)
  static async requireForCriticalActions(ctx: Context, actionName: string): Promise<boolean> {
    const userId = parseInt(sanitizeInput(ctx.from!.id.toString()));
    const user = await User.findOne({ telegramId: userId });
    if (user?.isAdmin) return true;

    // Force fresh check (bypass cache)
    const isSubscribed = await this.forceCheckSubscription(userId, ctx.api);
    if (!isSubscribed) {
      await this.showCriticalActionBlockedMessage(ctx, actionName);
      return false;
    }
    // Update subscription status
    if (user) {
      user.isSubscribed = true;
      user.lastSubscriptionCheck = new Date();
      await user.save();
    }
    return true;
  }
  
  /**
   * Tier 2: Important Actions (SOFT REQUIREMENT)
   * - Viewing balance
   * - Settings changes
   * - Profile updates
   */
  static async suggestForImportantActions(ctx: Context): Promise<boolean> {
    const userId = parseInt(sanitizeInput(ctx.from!.id.toString()));
  const user = await User.findOne({ telegramId: userId });
    
    if (!user || user.isAdmin) return true;
    
    // Check but don't block
    const isSubscribed = await this.checkSubscription(userId, ctx.api);
    
    if (!isSubscribed) {
      user.isSubscribed = false;
      await user.save();
      
      // Only show suggestion occasionally (30% chance to avoid spam)
      if (Math.random() < 0.3) {
        await this.showSuggestionMessage(ctx);
      }
    } else {
      user.isSubscribed = true;
      await user.save();
    }
    
    return true;
  }
  
  /**
   * Tier 3: Basic Actions (NO REQUIREMENT)
   * - /start command
   * - Referral recording
   * - Help commands
   * - Viewing tutorials
   */
  static async recordSubscriptionStatus(userId: number, api: Api): Promise<boolean> {
    const safeUserId = parseInt(sanitizeInput(userId.toString()));
  const user = await User.findOne({ telegramId: safeUserId });
    if (!user || user.isAdmin) return true;
    
    const isSubscribed = await this.checkSubscription(safeUserId, api);
    
    user.isSubscribed = isSubscribed;
    user.lastSubscriptionCheck = new Date();
    await user.save();
    
    return isSubscribed;
  }
  
   /**
   * Show critical action blocked message (PUBLIC, used by auth middleware)
   */
static async showCriticalActionBlockedMessage(ctx: Context, actionName: string): Promise<void> {
  // NEVER post into a channel — answer the callback privately
  if (ctx.chat?.type === 'channel' || ctx.chat?.type === 'supergroup') {
    if (ctx.callbackQuery) {
      const safeChannel = this.channelUsername;
      await ctx.answerCallbackQuery({
        text: `Please join @${safeChannel} first.`,
        show_alert: true,
        url: this.channelUrl,   // Telegram renders this as a "Join" button in the popup
      }).catch(() => {});
    }
    return;
  }
    const safeChannel = escapeMarkdown(this.channelUsername);
    const message = `🔒 *Subscription Required*\n\n` +
      `To ${actionName}, you must join our official channel:\n\n` +
      `📢 @${safeChannel}\n\n` +
      `*Why join?*\n` +
      `• Access to all earning opportunities\n` +
      `• Get payout approvals faster\n` +
      `• Stay updated with system changes\n\n` +
      `Join now and try again!`;

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: `✅ Join @${safeChannel}`, url: this.channelUrl }],
          [{ text: '🔄 Verify Subscription', callback_data: 'verify_subscription' }],
          [{ text: '❓ Why Required?', callback_data: 'why_subscription' }]
        ]
      }
    });
  }

  /**
   * Show suggestion message (non-blocking) – also escape
   */
  private static async showSuggestionMessage(ctx: Context): Promise<void> {
    const safeChannel = escapeMarkdown(this.channelUsername);
    const message = `💡 *Tip: Join Our Channel*\n\n` +
      `Get faster payouts and exclusive offers by joining:\n\n` +
      `📢 @${safeChannel}\n\n` +
      `✅ Priority support\n` +
      `🔷 Early access to new features\n` +
      `🤑 Special bonus offers`;

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: `👍 Join Channel`, url: this.channelUrl }],
          [{ text: '❌ Dismiss', callback_data: 'dismiss_suggestion' }]
        ]
      }
    });
  }

  /**
   * Show welcome with subscription info – now escapes Markdown
   */
  static async showWelcomeWithSubscription(ctx: Context, firstName: string): Promise<void> {
    const safeChannel = escapeMarkdown(this.channelUsername);
    const message = `🎉 Welcome to ethio_bingoobot, ${firstName}!\n\n` +
      `🤑 Start playing Now:\n` +
      `1. deposit now\n` +
      `2. upgrade to agent\n\n` +
      `💡 Pro Tip: Join our channel for:\n` +
      `• Faster payout approvals\n` +
      `• Exclusive bonus offers\n` +
      `• System updates\n\n` +
      `📢 @${safeChannel}`;

    await ctx.reply(message, {
      reply_markup: {
        inline_keyboard: [
          [{ text: `📢 Join Channel`, url: this.channelUrl }],
          [{ text: '⚙️ Settings', callback_data: 'settings' }]
        ]
      }
    });
  }
  


static async handleVerifySubscription(ctx: Context): Promise<void> {
  try {
    await ctx.answerCallbackQuery({ text: 'Checking subscription...' });
    const telegramId = parseInt(sanitizeInput(ctx.from!.id.toString()));

    // ✅ FORCE FRESH CHECK - clear stale cache
    this.invalidateCache(telegramId);

    let user = await User.findOne({ telegramId });

    // If user doesn't exist, create minimal record
    if (!user) {
      user = await User.create({
        telegramId,
        username: ctx.from?.username,
        firstName: ctx.from?.first_name || 'User',
        lastName: ctx.from?.last_name,
        balanceMain: 0,
        balanceHold: 0,
        totalEarned: 0,
        jobsCompleted: 0,
        payoutThreshold: 0.50,
        dailyLimit: 10,
        lastLoginAt: new Date(),
        isSubscribed: false
      });
      logger.info(`Auto-created user record for ${telegramId} during subscription verification`);
    }

    const isSubscribed = await this.checkSubscription(telegramId, ctx.api);

     if (isSubscribed) {
      const safeChannel = escapeMarkdown(this.channelUsername);
      this.invalidateCache(telegramId); // force re-check next time (or set to true)
      await ctx.editMessageText?.(
        `✅ *Subscription Verified!*\n\n` +
        `Thank you for joining @${safeChannel}`,
        { parse_mode: 'Markdown' }
      );

      // Update user record
      user.isSubscribed = true;
      user.lastSubscriptionCheck = new Date();
      await user.save();

      // Continue flow: request phone if missing, otherwise show main menu
      if (!user.phoneNumber) {
        const { sendPhoneNumberRequest } = await import('../../bot/utils/phoneNumber');
        await sendPhoneNumberRequest(ctx);
      } else {
        await ctx.reply(
          `❇️ *Main Menu*\n\nUse the buttons below to navigate.`,
          {
            parse_mode: 'Markdown',
            reply_markup: KeyboardFactory.mainMenu(user.isAdmin || false, true)
          }
        );
      }
    } else {
      const safeChannel = escapeMarkdown(this.channelUsername);
      await ctx.editMessageText?.(
        `❌ *Not Subscribed Yet*\n\n` +
        `Please join @${safeChannel} first.`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: `✅ Join @${safeChannel}`, url: this.channelUrl }],
              [{ text: '🔄 Check Again', callback_data: 'verify_subscription' }]
            ]
          }
        }
      );
    }
  } catch (error) {
    logger.error('Subscription verification error:', error);
    await ctx.answerCallbackQuery({ text: 'Error checking subscription', show_alert: true });
  }
}
  
  /**
   * Handle "Why Required?" callback
   */
  static async handleWhySubscription(ctx: Context): Promise<void> {
    await ctx.answerCallbackQuery();
    
    await ctx.editMessageText?.(
      `📋 *Why Subscription is Required*\n\n` +
      `1. **Security & Verification:**\n` +
      `   • Ensures you're a real user\n` +
      `   • Reduces fraud and abuse\n` +
      `   • Protects the system for everyone\n\n` +
      `2. **Better Service:**\n` +
      `   • Priority support for subscribers\n` +
      `   • Faster payout processing\n` +
      `   • Early access to new features\n\n` +
      `3. **Communication:**\n` +
      `   • Important system updates\n` +
      `   • Maintenance notifications\n` +
      `   • Bonus and promotion alerts\n\n` +
      `4. **Community Building:**\n` +
      `   • Connect with other users\n` +
      `   • Share tips and strategies\n` +
      `   • Grow together\n\n` +
      `Joining is free and takes just 10 seconds!`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ 
              text: `✅ Join @${this.channelUsername}`, 
              url: this.channelUrl 
            }],
            [{ text: '🔙 Back', callback_data: 'back_to_previous' }]
          ]
        }
      }
    );
  }
}