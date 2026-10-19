// src/bot/handlers/commands/balance.ts
import { CommandContext } from 'grammy';
import { Context } from '../../framework';
import { KeyboardFactory } from '../../framework/keyboards';
import { User } from '../../../core/database/models/User';
import { logger } from '../../../core/utils/logger';
import { InlineKeyboard } from 'grammy';
import { ChannelSubscription } from '@/core/utils/channelSubscription';
import { sanitizeInput } from '../../../core/utils/security';
import { ETBCoinService } from '@/services/ETBCoinServiceInstance';
import { getSettings } from '@/core/utils/settingsCache';
import { t, replyWithTranslation } from '../../utils/i18n';

export async function balanceCommand(ctx: CommandContext<Context>) {
  const userId = sanitizeInput(ctx.from!.id);
  const lang = ctx.state.lang;
  let isAdmin = false;

  try {
    const user = await User.findOne({ telegramId: parseInt(userId) });
    if (!user) {
      await replyWithTranslation(ctx, 'errors.user_not_found', {}, {
        reply_markup: KeyboardFactory.mainMenu(false, true, lang)
      });
      return;
    }
    isAdmin = user.isAdmin;

    await ChannelSubscription.suggestForImportantActions(ctx);

    const ETBEnabled = getSettings().etbCoinEnabled;
    const locked = user.lockedBalance || 0;

    const ETBStats = await ETBCoinService.getUserETBStats(user._id);
    if (!ETBStats) {
      await replyWithTranslation(ctx, 'errors.general', {}, {
        reply_markup: KeyboardFactory.mainMenu(false, true, lang)
      });
      return;
    }

    // Use translation for the balance details
    const message = t(lang, 'balance.etb_balance_details', {
      balance: user.balanceMain.toFixed(2),
      coins: user.ETBCoins.toFixed(2),
      locked: locked.toFixed(2),
      earned: ETBStats.totalEarned.toFixed(2),
      withdrawn: ETBStats.totalRedeemed.toFixed(2)
    });

    const inlineKeyboard = new InlineKeyboard();
    if (ETBEnabled) {
      inlineKeyboard.text(t(lang, 'buttons.deposit_etb'), 'ETB_deposit');
      inlineKeyboard.text(t(lang, 'buttons.withdraw_etb'), 'ETB_withdraw');
      inlineKeyboard.row();
    }
    inlineKeyboard
      .text(t(lang, 'buttons.settings'), 'settings')
      .row()
      .text(t(lang, 'buttons.main_menu'), 'main_menu');

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: inlineKeyboard
    });
  } catch (error: any) {
    logger.error('Balance command error:', error);
    await replyWithTranslation(ctx, 'errors.general', {}, {
      reply_markup: KeyboardFactory.mainMenu(isAdmin, true, lang)
    });
  }
}