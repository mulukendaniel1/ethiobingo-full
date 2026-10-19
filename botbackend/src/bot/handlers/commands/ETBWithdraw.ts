// src/bot/handlers/commands/ETBWithdraw.ts
import { Context } from '../../framework';
import { CallbackQueryContext } from 'grammy';
import { User } from '../../../core/database/models/User';
import { logger } from '../../../core/utils/logger';
import { InlineKeyboard } from 'grammy';
import { ETBWithdrawalService } from '../../../services/ETBWithdrawalServiceInstance';
import { sanitizeInput } from '../../../core/utils/security';
import { getSettings } from '@/core/utils/settingsCache';
import { t, replyWithTranslation } from '../../utils/i18n';
import { checkWithdrawalEligibility } from '@/services/depositEligibilityService';
import { ChannelSubscription } from '@/core/utils/channelSubscription';

async function getUserAndCheckAvailable(ctx: Context): Promise<{ user: any; available: number } | null> {
  const user = await User.findOne({ telegramId: ctx.from!.id });
  if (!user) {
    await replyWithTranslation(ctx, 'errors.user_not_found');
    return null;
  }
  const available = user.balanceMain - (user.lockedWithdrawAmount || 0);
  return { user, available };
}

export async function showWithdrawMethodSelection(ctx: Context) {
  const allowed = await ChannelSubscription.requireForCriticalActions(ctx, 'make a withdrawal');
if (!allowed) return;
  const userId = sanitizeInput(ctx.from!.id);
  const user = await User.findOne({ telegramId: parseInt(userId) });
  if (!user) {
    await replyWithTranslation(ctx, 'errors.user_not_found');
    return;
  }

  if (!getSettings().etbCoinEnabled) {
    await replyWithTranslation(ctx, 'errors.etb_disabled');
    return;
  }

  const settings = getSettings();
  if (!settings.withdrawEnabled) {
    await replyWithTranslation(ctx, 'errors.withdraw_disabled');
    return;
  }

  const guide = t(ctx.state.lang, 'withdraw.guide');
  const message = `${guide}\n\n${t(ctx.state.lang, 'withdraw.select_method')}`;

  const keyboard = new InlineKeyboard()
    //.text(t(ctx.state.lang, 'withdraw.method_cbe'), 'ETB_withdraw_method_cbe')
    //.text(t(ctx.state.lang, 'withdraw.method_abyssinia'), 'ETB_withdraw_method_abyssinia')
    //.row()
    .text(t(ctx.state.lang, 'withdraw.method_cbebirr'), 'ETB_withdraw_method_cbebirr')
    .text(t(ctx.state.lang, 'withdraw.method_telebirr'), 'ETB_withdraw_method_telebirr')
    .row()
    .text(t(ctx.state.lang, 'buttons.back'), 'ETB_balance');

  await ctx.reply(message, { parse_mode: 'Markdown', reply_markup: keyboard });
}

export async function handleETBWithdraw(ctx: CallbackQueryContext<Context>) {
  try {
    const settings = getSettings();
    if (!settings.etbCoinEnabled) {
      await ctx.answerCallbackQuery({
        text: t(ctx.state.lang, 'errors.etb_disabled'),
        show_alert: true
      });
      return;
    }
    if (!settings.withdrawEnabled) {
      await ctx.answerCallbackQuery({
        text: t(ctx.state.lang, 'errors.withdraw_disabled'),
        show_alert: true
      });
      return;
    }

    const allowed = await ChannelSubscription.requireForCriticalActions(ctx, 'make a withdrawal');
if (!allowed) return;

    await showWithdrawMethodSelection(ctx);
  } catch (error) {
    logger.error('ETB withdraw start error:', error);
  }
}

export async function handleETBWithdrawMethod(ctx: CallbackQueryContext<Context>) {
  try {
    await ctx.answerCallbackQuery?.();
    const method = sanitizeInput(ctx.match![1]) as 'cbe' | 'abyssinia' | 'cbebirr' | 'telebirr';

    if (!ctx.session.ETBWithdraw) ctx.session.ETBWithdraw = {};
    ctx.session.ETBWithdraw.method = method;

    // Immediately ask for amount (no button)
    const userId = sanitizeInput(ctx.from!.id);
    const user = await User.findOne({ telegramId: parseInt(userId) });
    if (!user) return;

    const keyboard = new InlineKeyboard().text(t(ctx.state.lang, 'buttons.back'), 'ETB_withdraw');
    await ctx.editMessageText?.(
      t(ctx.state.lang, 'withdraw.enter_custom_amount'),
      { parse_mode: 'Markdown', reply_markup: keyboard }
    );
    ctx.session.step = 'awaiting_ETB_withdraw_amount';
  } catch (error) {
    logger.error('ETB withdraw method error:', error);
  }
}

async function proceedToDestination(ctx: Context | CallbackQueryContext<Context>, amountETB: number, isCallback = false) {
  if (!ctx.session.ETBWithdraw) {
    const errorMsg = t(ctx.state.lang, 'errors.session_expired');
    if (isCallback) await (ctx as CallbackQueryContext<Context>).editMessageText?.(errorMsg);
    else await ctx.reply(errorMsg);
    return;
  }
  const method = ctx.session.ETBWithdraw.method;
  if (!method) {
    const errorMsg = t(ctx.state.lang, 'errors.session_expired');
    if (isCallback) await (ctx as CallbackQueryContext<Context>).editMessageText?.(errorMsg);
    else await ctx.reply(errorMsg);
    return;
  }

  ctx.session.ETBWithdraw.amountETB = amountETB;

  const keyboard = new InlineKeyboard()
    .text(t(ctx.state.lang, 'buttons.back'), 'ETB_withdraw')
    .text(t(ctx.state.lang, 'buttons.cancel'), 'ETB_balance');

  const message = t(ctx.state.lang, 'withdraw.enter_destination', { method: method.toUpperCase() });

  if (isCallback) {
    await (ctx as CallbackQueryContext<Context>).editMessageText?.(message, { parse_mode: 'Markdown', reply_markup: keyboard });
  } else {
    await ctx.reply(message, { parse_mode: 'Markdown', reply_markup: keyboard });
  }

  ctx.session.step = 'awaiting_ETB_withdraw_destination';
}

export async function handleETBWithdrawDestinationInput(ctx: Context) {
  if (ctx.session?.step !== 'awaiting_ETB_withdraw_destination') return;

  const destination = sanitizeInput(ctx.message?.text?.trim());
  if (!destination) {
    await replyWithTranslation(ctx, 'withdraw.enter_destination', { method: '' });
    return;
  }

  const menuCommands = [
    t(ctx.state.lang, 'buttons.balance'),
    t(ctx.state.lang, 'buttons.main_menu'),
    t(ctx.state.lang, 'buttons.settings'),
    t(ctx.state.lang, 'buttons.referral'),
    t(ctx.state.lang, 'buttons.help'),
    t(ctx.state.lang, 'buttons.admin')
  ];
  if (menuCommands.includes(destination)) {
    await replyWithTranslation(ctx, 'withdraw.invalid_destination');
    return;
  }

  const withdrawData = ctx.session.ETBWithdraw;
  if (!withdrawData?.method || !withdrawData.amountETB) {
    await replyWithTranslation(ctx, 'errors.session_expired');
    delete ctx.session.step;
    return;
  }

  // Validate destination
  if (withdrawData.method === 'cbebirr' || withdrawData.method === 'telebirr') {
    const digits = destination.replace(/\D/g, '');
    if (digits.length !== 10 || !digits.startsWith('09')) {
      await replyWithTranslation(ctx, 'withdraw.invalid_phone');
      return;
    }
  } else if (withdrawData.method === 'cbe') {
    const digits = destination.replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 16 || /[a-zA-Z]/.test(destination)) {
      await replyWithTranslation(ctx, 'withdraw.invalid_account_cbe');
      return;
    }
  } else if (withdrawData.method === 'abyssinia') {
    const digits = destination.replace(/\D/g, '');
    if (digits.length < 6 || digits.length > 10 || /[a-zA-Z]/.test(destination)) {
      await replyWithTranslation(ctx, 'withdraw.invalid_account_abyssinia');
      return;
    }
  }

  const userId = sanitizeInput(ctx.from!.id);
  const user = await User.findOne({ telegramId: parseInt(userId) });
  if (!user) {
    await replyWithTranslation(ctx, 'errors.user_not_found');
    delete ctx.session.step;
    return;
  }

  const result = await ETBWithdrawalService.createWithdrawalRequest(
    user._id,
    withdrawData.method,
    withdrawData.amountETB,
    destination
  );

  if (!result.success) {
    await ctx.reply(`${t(ctx.state.lang, 'errors.general')}: ${result.error}`);
    delete ctx.session.step;
    return;
  }

  delete ctx.session.ETBWithdraw;
  delete ctx.session.step;

  const keyboard = new InlineKeyboard()
    .text(t(ctx.state.lang, 'buttons.etb_balance'), 'ETB_balance')
    .text(t(ctx.state.lang, 'buttons.main_menu'), 'main_menu');

  await ctx.reply(
    t(ctx.state.lang, 'withdraw.request_submitted', {
      requestId: result.requestId,
      amountETB: withdrawData.amountETB.toString(),
      destination
    }),
    { parse_mode: 'Markdown', reply_markup: keyboard }
  );
}

export async function handleETBWithdrawAmountInput(ctx: Context) {
  if (ctx.session?.step !== 'awaiting_ETB_withdraw_amount') return;
  const amountText = ctx.message?.text?.trim();
  if (!amountText) return;
  const amountETB = parseFloat(sanitizeInput(amountText));
  // ✅ Minimum 50 ETB
  if (isNaN(amountETB) || amountETB < 50) {
    await replyWithTranslation(ctx, 'withdraw.minimum_amount', { min: 50 });
    return;
  }
  const result = await getUserAndCheckAvailable(ctx);
  if (!result) return;
  const { user, available } = result;

  if (available === 0) {
    await replyWithTranslation(ctx, 'withdraw.zero_balance');
    return;
  }

  if (amountETB > available) {
    await replyWithTranslation(ctx, 'withdraw.insufficient_balance', { available: available.toFixed(2) });
    return;
  }

// –– Gate 1: bonus-clear gate (agents are exempt) ––
const eligibility = await checkWithdrawalEligibility(user._id, amountETB);
if (!eligibility.isAgent && !eligibility.bonusCleared) {
  const remaining = (eligibility.lockedBalance - eligibility.bonusClearThreshold).toFixed(2);
  await ctx.reply(
    t(ctx.state.lang, 'withdraw.bonus_clear_block', {
      locked: eligibility.lockedBalance.toFixed(2),
      remaining,
      threshold: String(eligibility.bonusClearThreshold),
    }),
    { parse_mode: 'Markdown' }
  );
  return;
}

  // –– Gate 2: Option C ––
  if (!eligibility.canWithdraw) {
    await replyWithTranslation(ctx, 'withdraw.bonus_abuse_block', {
      current: eligibility.totalConfirmedDepositsETB.toString(),
    });
    return;
  }
  // –– end guard ––

  await proceedToDestination(ctx, amountETB, false);
}