// src/bot/handlers/commands/play.ts
import { Context } from '../../framework';
import jwt from 'jsonwebtoken';
import { User } from '../../../core/database/models/User';
import { logger } from '../../../core/utils/logger';
import { sanitizeInput } from '../../../core/utils/security';
import { CryptoUtils } from '@/core/utils/crypto';
import redisManager from '@/core/database/connections/redis';
import { t, replyWithTranslation } from '../../utils/i18n';

export async function playCommand(ctx: Context) {
  const telegramId = sanitizeInput(ctx.from?.id);
  const lang = ctx.state.lang;
  
  if (!telegramId) {
    logger.warn('No telegramId in context');
    return;
  }

  if (!process.env.JWT_SECRET) {
    await replyWithTranslation(ctx, 'play.error_no_secret');
    return;
  }
  if (!process.env.FRONTEND_URL) {
    await replyWithTranslation(ctx, 'play.error_no_url');
    return;
  }

  try {
    const user = await User.findOne({ telegramId: parseInt(telegramId) });
    if (!user) {
      await replyWithTranslation(ctx, 'errors.user_not_found');
      return;
    }

    // Generate new session ID and store it
    const sessionId = CryptoUtils.generateToken(32);
    user.sessionId = sessionId;
    await user.save();

    const redis = redisManager.getClient();
    await redis.setex(`session:${user._id.toString()}`, 86400, sessionId);

    const token = jwt.sign(
      {
        uid: user._id.toString(),
        operatorId: process.env.OPERATOR_ID || 'ethio_bingoobot',
        sessionId,
        jti: CryptoUtils.generateToken(16),
      },
      process.env.JWT_SECRET!,
      { expiresIn: '1d' }
    );
    const baseUrl = process.env.FRONTEND_URL.replace(/\/$/, '');
    const gameUrl = `${baseUrl}/?token=${token}`;
    logger.info(`Generated game URL for user ${telegramId}: ${gameUrl}`);

    // Attempt 1: Web App button
    try {
      await ctx.reply(t(lang, 'play.message'), {
        reply_markup: {
          inline_keyboard: [
            [{ text: t(lang, 'play.button_web_app'), web_app: { url: gameUrl } }]
          ]
        }
      });
      return;
    } catch (webAppError: any) {
      logger.warn('Web App button failed:', webAppError);

      // Attempt 2: Normal URL button
      try {
        await ctx.reply(t(lang, 'play.message_fallback'), {
          reply_markup: {
            inline_keyboard: [
              [{ text: t(lang, 'play.button_url'), url: gameUrl }]
            ]
          }
        });
        return;
      } catch (urlError: any) {
        logger.error('Normal URL button also failed:', urlError);
        await ctx.reply(`${t(lang, 'play.message')}: ${gameUrl}`);
      }
    }
  } catch (error: any) {
    logger.error('Unexpected error in /play command:', error);
    await replyWithTranslation(ctx, 'play.error_generic');
  }
}