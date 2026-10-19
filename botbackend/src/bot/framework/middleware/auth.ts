// src/bot/framework/middleware/auth.ts - OPTIMISED
import { NextFunction } from 'grammy';
import { Context } from '../index';
import { User } from '../../../core/database/models/User';
import { logger } from '../../../core/utils/logger';
import { sanitizeInput } from '../../../core/utils/security';
import { operatorService } from '@/services/operatorService';
import { ChannelSubscription } from '@/core/utils/channelSubscription';
import { getSettings } from '@/core/utils/settingsCache';

export function authMiddleware() {
  return async (ctx: Context, next: NextFunction) => {
    try {
      // 1. If there's no user ID, ignore it
      if (!ctx || !ctx.from?.id) return await next();

      // 2. Only run auth check for Private Messages or Callbacks
      const isPrivateChat = ctx.chat?.type === 'private';
      const isCallback = !!ctx.callbackQuery;
      if (!isPrivateChat && !isCallback) {
        return await next();
      }

      const telegramId = parseInt(sanitizeInput(ctx.from.id.toString()));
      const messageText = ctx.message?.text;
      const callbackData = ctx.callbackQuery?.data;

      const publicCommands = ['/start', '/help', '/ping'];
      const publicCallbacks = [
        'verify_subscription',
        'why_subscription',
        'dismiss_suggestion'
      ];
      const isPublicCommand = messageText && publicCommands.some(cmd => messageText.startsWith(cmd));
      const isPublicCallback = callbackData && publicCallbacks.some(cb => callbackData === cb);
      const isChannelCallback = !!ctx.callbackQuery && ctx.chat?.type === 'channel';

      // Load user from session cache if available, else DB
      let userDoc: any = null;
      if (ctx.session.cachedUser) {
        userDoc = ctx.session.cachedUser;
      } else {
        try {
          userDoc = await User.findOne({ telegramId }).lean();
        } catch (dbError: any) {
          logger.warn('Database error in auth middleware:', dbError.message);
        }

        // Cache in session for future use
        if (userDoc) {
          ctx.session.cachedUser = {
            _id: userDoc._id.toString(),
            telegramId: userDoc.telegramId,
            isAdmin: userDoc.isAdmin,
            isBanned: userDoc.isBanned,
            banReason: userDoc.banReason,
            phoneNumber: userDoc.phoneNumber,
            firstName: userDoc.firstName,
            username: userDoc.username,
            language: userDoc.language || 'en',
            lastLoginAt: userDoc.lastLoginAt?.toISOString()
          };
        }
      }

      // Build ctx.state.user
      if (userDoc) {
        ctx.state.user = {
          _id: userDoc._id.toString(),
          telegramId: userDoc.telegramId,
          isAdmin: userDoc.isAdmin,
          isBanned: userDoc.isBanned,
          banReason: userDoc.banReason,
          phoneNumber: userDoc.phoneNumber,
          firstName: userDoc.firstName,
          username: userDoc.username,
          language: userDoc.language || 'en',
          lastLoginAt: userDoc.lastLoginAt?.toISOString()
        };
      } else {
        ctx.state.user = null;
      }

      // Allow public commands and callbacks without registration
      if (isPublicCommand || isPublicCallback) {
        return await next();
      }

      // Allow callback queries from channels
      if (ctx.callbackQuery && ctx.chat?.type === 'channel') {
        return await next();
      }

      // Channel users interact *in* the channel — subscription gate makes no sense there.
      // Also, telling them via answerCallbackQuery avoids posting into the channel.
      if (!isChannelCallback && ctx.state.user && !ctx.state.user.isAdmin) {
        const isSubscribed = await ChannelSubscription.checkSubscription(telegramId, ctx.api);
        if (!isSubscribed) {
          if (ctx.callbackQuery) {
            await ctx.answerCallbackQuery({
              text: 'Please join our channel to use the bot.',
              show_alert: true,
            }).catch(() => {});
            return;
          }
          await ChannelSubscription.showCriticalActionBlockedMessage(ctx, 'use the bot');
          return;
        }
      }

      // Non-public actions require registration
        if (!userDoc) {
          const botName = (getSettings().botUsername || 'ethio_bingoobot').replace(/^@/, '');
          const msg = `❌ Please start @${botName} first, then come back and claim.`;

          if (ctx.callbackQuery) {
            try { await ctx.answerCallbackQuery({ text: msg, show_alert: true }); } catch {}
          } else if (ctx.reply) {
            await ctx.reply(msg);
          }
          return;
        }

      // Phone number check (skip if start or contact)
      if (!isChannelCallback && !ctx.state.user.phoneNumber) {
        const isStartCommand = ctx.message?.text === '/start';
        const isContact = !!ctx.message?.contact;
        if (!isStartCommand && !isContact) {
          const { sendPhoneNumberRequest } = await import('../../utils/phoneNumber');
          await sendPhoneNumberRequest(ctx);
          return;
        }
      }

      // Ban check
      if (ctx.state.user.isBanned) {
        const msg = `❌ Account banned. Reason: ${ctx.state.user.banReason || 'Violation of terms'}`;
        if (ctx.callbackQuery) {
          try {
            await ctx.answerCallbackQuery({ text: msg, show_alert: true });
          } catch (e) {}
        } else if (ctx.reply) {
          await ctx.reply(msg);
        }
        return;
      }

      // Bot pause check – only admins can bypass
      if (!isChannelCallback && !ctx.state.user.isAdmin) {
        const operator = await operatorService.getOperator();
        if (!operator.isActive) {
          const msg = '⏸️ Bot is currently paused for maintenance. Please try again later.';
          if (ctx.callbackQuery) {
            await ctx.answerCallbackQuery({ text: msg, show_alert: true });
          } else if (ctx.reply) {
            await ctx.reply(msg);
          }
          return;
        }
      }

      // Admin command check
      const isAdminCommand = messageText?.startsWith('/admin') || callbackData?.startsWith('admin_');
      if (isAdminCommand && !ctx.state.user.isAdmin) {
        const msg = '❌ Admin access required';
        if (ctx.callbackQuery) {
          try {
            await ctx.answerCallbackQuery({ text: msg, show_alert: true });
          } catch (e) {}
        } else if (ctx.reply) {
          await ctx.reply(msg);
        }
        return;
      }

      // Update last login in background (only if not cached recently)
      const lastLogin = ctx.state.user.lastLoginAt;
      if (lastLogin) {
        const hoursSince = (Date.now() - new Date(lastLogin).getTime()) / (1000 * 60 * 60);
        if (hoursSince >= 1) {
          User.updateOne({ telegramId }, { lastLoginAt: new Date() }).catch(e =>
            logger.debug('Failed to update last login:', e.message)
          );
        }
      } else {
        User.updateOne({ telegramId }, { lastLoginAt: new Date() }).catch(e =>
          logger.debug('Failed to update last login:', e.message)
        );
      }

      await next();
    } catch (error: any) {
      logger.warn('Auth middleware error (non-critical):', error?.stack || error?.message || error);
      try { await next(); } catch (nextError) {
        logger.error('Error in next middleware after auth error:', nextError);
      }
    }
  };
}