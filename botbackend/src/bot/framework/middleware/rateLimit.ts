// src/bot/framework/middleware/rateLimit.ts - COMPLETE FIXED VERSION

import { NextFunction } from 'grammy';
import { Context } from '../index';
import { logger } from '../../../core/utils/logger';
import { User } from '../../../core/database/models/User';
import { RateLimit } from '../../../core/database/models/RateLimit';
import { sanitizeInput } from '../../../core/utils/security';

export function rateLimitMiddleware() {
  return async (ctx: Context, next: NextFunction) => {
    try {
      const userId = sanitizeInput(ctx.from?.id);
      if (!userId) {
        await next();
        return;
      }
      
      // Get message or callback data
      const messageText = ctx.message?.text;
      const callbackData = ctx.callbackQuery?.data;
      
      // Skip rate limiting for certain commands
      if (messageText?.startsWith('/start') || 
          messageText?.startsWith('/help') ||
          messageText?.startsWith('/ping')) {
        await next();
        return;
      }
      
      // Try to get user, but don't fail
      let user;
      try {
        user = await User.findOne({ telegramId: parseInt(userId) });
      } catch (dbError) {
        // Database error, skip rate limiting
        logger.warn('Database error in rate limit middleware, skipping:', dbError);
        await next();
        return;
      }
      
      if (!user) {
        await next();
        return;
      }
      
      // Admin bypass
      if (user.isAdmin) {
        await next();
        return;
      }
      
      // Try to check rate limit, but don't fail
      try {
        const key = `rate_limit:${userId}`;
        const result = await RateLimit.checkLimit(
          key,
          'bot_requests',
          20, // 20 requests per minute
          60 * 1000 // 1 minute window
        );
        
        if (!result.allowed) {
          const waitSeconds = Math.ceil((result.resetTime.getTime() - Date.now()) / 1000);
          const msg =
            `⏳ Rate limit exceeded. Please wait ${waitSeconds}s.\n` +
            `Reset at: ${result.resetTime.toLocaleTimeString()}`;

          // ALWAYS answer the callback — never reply into the chat
          if (ctx.callbackQuery) {
            await ctx.answerCallbackQuery({ text: msg, show_alert: true }).catch(() => {});
          } else {
            await ctx.reply?.(msg).catch(() => {});
          }
          return;
        }
      } catch (rateLimitError) {
        // Rate limit check failed, allow the request
        logger.debug('Rate limit check failed, allowing request:', rateLimitError);
      }
      
      await next();
      
    } catch (error: any) {
      logger.debug('Rate limit middleware error, continuing without rate limiting:', error.message);
      // Don't block on rate limit errors
      await next();
    }
  };
}