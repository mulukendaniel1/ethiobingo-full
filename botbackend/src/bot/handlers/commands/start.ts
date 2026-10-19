// src/bot/handlers/commands/start.ts - OPTIMISED
import { CommandContext } from 'grammy';
import { Context } from '../../framework';
import { User } from '../../../core/database/models/User';
import { KeyboardFactory } from '../../framework/keyboards';
import { logger } from '../../../core/utils/logger';
import { referralService } from '../../../services/referralService';
import { SessionCleaner } from '../../../core/utils/sessionCleaner';
import { ChannelSubscription } from '../../../core/utils/channelSubscription';
import { sanitizeInput } from '../../../core/utils/security';
import { getSettings } from '@/core/utils/settingsCache';
import { replyWithTranslation, t } from '../../utils/i18n';

export async function startCommand(ctx: CommandContext<Context>) {
  const userId = sanitizeInput(ctx.from!.id);
  const username = ctx.from!.username;
  const firstName = ctx.from!.first_name;
  const lang = ctx.state.lang;

  try {
    let user = await User.findOne({ telegramId: parseInt(userId) });

    // Determine admin IDs from settings
    const adminIds = (getSettings().adminIds?.split(',') || [])
      .map(id => parseInt(sanitizeInput(id.trim())))
      .filter(id => !isNaN(id));
    const isAdminTelegramId = adminIds.includes(parseInt(userId));

    // If user exists, update last login and possibly promote to admin
    if (user) {
      user.lastLoginAt = new Date();
      if (username) user.username = username;
      if (isAdminTelegramId && !user.isAdmin) {
        user.isAdmin = true;
      }
      await user.save();
    }

    // MANDATORY SUBSCRIPTION CHECK – skip for admins
    const isAdminUser = user?.isAdmin || isAdminTelegramId;
    if (!isAdminUser) {
      const isSubscribed = await ChannelSubscription.checkSubscription(parseInt(userId), ctx.api);
      if (!isSubscribed) {
        await ChannelSubscription.showCriticalActionBlockedMessage(ctx, 'use the bot');
        return;
      }
    }

    // If user doesn't exist yet, create now
    if (!user) {
      user = await User.create({
        telegramId: parseInt(userId),
        username,
        firstName,
        lastName: ctx.from!.last_name,
        balanceMain: 0,
        balanceHold: 0,
        totalEarned: 0,
        jobsCompleted: 0,
        payoutThreshold: 0.50,
        dailyLimit: 10,
        lastLoginAt: new Date(),
        isSubscribed: true,
        isAdmin: isAdminTelegramId
      });
    }

    // Cache user in session for future middleware
    ctx.session.cachedUser = {
      _id: user._id.toString(),
      telegramId: user.telegramId,
      isAdmin: user.isAdmin,
      isBanned: user.isBanned,
      banReason: user.banReason,
      phoneNumber: user.phoneNumber,
      firstName: user.firstName,
      username: user.username,
      language: user.language || 'en',
      lastLoginAt: user.lastLoginAt?.toISOString()
    };

    // Handle deep-link payloads (deposit/withdraw)
    const startPayload = ctx.match;
    if (startPayload && startPayload === 'deposit') {
      const { showDepositMethodSelection } = await import('../commands/ETBDeposit');
      await showDepositMethodSelection(ctx);
      return;
    }
    if (startPayload && startPayload === 'withdraw') {
      const { showWithdrawMethodSelection } = await import('../commands/ETBWithdraw');
      await showWithdrawMethodSelection(ctx);
      return;
    }

    // Referral handling
    if (startPayload && startPayload.startsWith('ref_')) {
      const match = startPayload.match(/^ref_([A-Z0-9]+)$/);
      if (match && getSettings().referralEnabled) {
        const referralCode = sanitizeInput(match[1]);
        ctx.session.pendingReferralCode = referralCode;
        await referralService.registerReferralWithoutBonus(user._id, referralCode);
      }
    }

    // Phone verification (if missing)
    if (!user.phoneNumber) {
      const { sendPhoneNumberRequest } = await import('../../utils/phoneNumber');
      await sendPhoneNumberRequest(ctx);
      return;
    }

    // Show main menu / welcome
    SessionCleaner.clearSession(ctx.session);
    ctx.session.menuExpanded = true;

    const welcomeMsg = user.isAdmin
      ? t(lang, 'start.welcome_back_admin', { name: firstName })
      : t(lang, 'start.welcome_back_subscribed', { name: firstName });
    await ctx.reply(welcomeMsg, {
      parse_mode: 'Markdown',
      reply_markup: KeyboardFactory.mainMenu(user.isAdmin, true, lang)
    });

    // Update subscription status in DB (background)
    setTimeout(async () => {
      try {
        await ChannelSubscription.recordSubscriptionStatus(parseInt(userId), ctx.api);
      } catch (error) {
        logger.error('Background subscription check failed:', error);
      }
    }, 1000);

    logger.info(`User ${userId} started bot${user.isAdmin ? ' (Admin)' : ''}`);
  } catch (error: any) {
    logger.error('Start command error:', error);
    await replyWithTranslation(ctx, 'errors.general', {}, { reply_markup: KeyboardFactory.mainMenu(false, true, ctx.state.lang) });
  }
}