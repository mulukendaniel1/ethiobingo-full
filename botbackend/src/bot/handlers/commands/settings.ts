// src/bot/handlers/commands/settings.ts - UPDATED
import { Context } from '../../framework';
import { User } from '../../../core/database/models/User';
import { referralService } from '../../../services/referralServiceInstance';
import { logger } from '../../../core/utils/logger';
import { InlineKeyboard } from 'grammy';
import { sanitizeInput } from '../../../core/utils/security';
import { getSettings } from '@/core/utils/settingsCache';
import { t, replyWithTranslation } from '../../utils/i18n';

export async function settingsCommand(ctx: Context) {
  const lang = ctx.state.lang;
  try {
    const userId = sanitizeInput(ctx.from!.id);
    const user = await User.findOne({ telegramId: parseInt(userId) });
    
    if (!user) {
      await replyWithTranslation(ctx, 'errors.user_not_found');
      return;
    }
    
    const referralStats = await referralService.getUserReferralStats(user._id);
    const referralLink = `https://t.me/${ctx.me.username}?start=ref_${user.referralCode}`;
    
    const ETBEnabled = getSettings().etbCoinEnabled;
    let ETBInfo = '';
    
    if (ETBEnabled) {
      const { ETBCoinService } = await import('../../../services/ETBCoinServiceInstance');
      const ETBStats = await ETBCoinService.getUserETBStats(user._id);
      if (ETBStats) {
        ETBInfo = t(lang, 'settings.etb_info', {
          coins: ETBStats.currentCoins.toFixed(2),
          value: ETBStats.etbValue.toFixed(2)
        });
      }
    }
    
    const message = t(lang, 'settings.message', {
      code: user.referralCode,
      referrals: referralStats?.referralCount || 0,
      earnings: referralStats?.referralEarnings?.toFixed(2) || '0.00',
      link: referralLink
    }) + ETBInfo;
    
    const keyboard = new InlineKeyboard();
    
    if (ETBEnabled) {
      keyboard.text(t(lang, 'buttons.etb_coins'), 'ETB_balance');
      keyboard.row();
    }
    
    keyboard
      .text(t(lang, 'buttons.referral_stats'), 'referral_stats')
      .row()
      .text(t(lang, 'buttons.main_menu'), 'main_menu');
    
    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
    
  } catch (error) {
    logger.error('Settings command error:', error);
    await replyWithTranslation(ctx, 'errors.general');
  }
}

// Add callback handler for referral stats
export async function handleReferralStats(ctx: Context) {
  const lang = ctx.state.lang;
  try {
    await ctx.answerCallbackQuery?.();
    
    const userId = sanitizeInput(ctx.from!.id);
    const user = await User.findOne({ telegramId: parseInt(userId) });
    if (!user) {
      await replyWithTranslation(ctx, 'errors.user_not_found');
      return;
    }
    
    const referralStats = await referralService.getUserReferralStats(user._id);
    
    if (!referralStats) {
      await replyWithTranslation(ctx, 'errors.general');
      return;
    }
    
    let message = t(lang, 'referral.stats', {
      code: user.referralCode,
      count: referralStats.referralCount,
      earnings: referralStats.referralEarnings.toFixed(2)
    }) + '\n\n';
    
    if (referralStats.referrals.length > 0) {
      message += t(lang, 'referral.recent_referrals') + '\n';
      referralStats.referrals.slice(0, 5).forEach((ref: any, index: number) => {
        const referredUser = ref.userId;
        const username = referredUser?.username || referredUser?.telegramId;
        const date = new Date(ref.joinedAt).toLocaleDateString();
        message += `${index + 1}. @${username} - ${t(lang, 'referral.joined_on')} ${date}\n`;
      });
    }
    
    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: t(lang, 'buttons.back'), callback_data: 'settings' }],
          [{ text: t(lang, 'buttons.main_menu'), callback_data: 'main_menu' }]
        ]
      }
    });
    
  } catch (error) {
    logger.error('Referral stats error:', error);
  }
}