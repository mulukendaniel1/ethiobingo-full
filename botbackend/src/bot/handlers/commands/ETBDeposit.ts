// src/bot/handlers/commands/ETBDeposit.ts
import { Context } from '../../framework';
import { CallbackQueryContext } from 'grammy';
import { User } from '../../../core/database/models/User';
import { logger } from '../../../core/utils/logger';
import { InlineKeyboard } from 'grammy';
import { ETBDepositService } from '../../../services/ETBDepositServiceInstance';
import { sanitizeInput } from '../../../core/utils/security';
import { getSettings } from '@/core/utils/settingsCache';
import { t, replyWithTranslation } from '../../utils/i18n';
import { ETBDeposit } from '@/core/database/models/ETBDeposit';
import { ChannelSubscription } from '@/core/utils/channelSubscription';

export async function showDepositMethodSelection(ctx: Context) {
  const allowed = await ChannelSubscription.requireForCriticalActions(ctx, 'make a deposit');
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
  if (!settings.depositEnabled) {
    await replyWithTranslation(ctx, 'errors.deposit_disabled');
    return;
  }

  const guide = t(ctx.state.lang, 'deposit.guide_short');
  const message = `${guide}\n\n${t(ctx.state.lang, 'deposit.select_method')}`;

  const keyboard = new InlineKeyboard()
    .text(t(ctx.state.lang, 'deposit.method_telebirr'), 'ETB_deposit_method_telebirr')
    .text(t(ctx.state.lang, 'deposit.method_cbebirr'), 'ETB_deposit_method_cbebirr')
    .row()
    .text(t(ctx.state.lang, 'buttons.back'), 'ETB_balance');

  await ctx.reply(message, { parse_mode: 'Markdown', reply_markup: keyboard });
}

export async function handleETBDeposit(ctx: CallbackQueryContext<Context>) {
  try {
    const settings = getSettings();
    if (!settings.etbCoinEnabled) {
      await ctx.answerCallbackQuery({
        text: t(ctx.state.lang, 'errors.etb_disabled'),
        show_alert: true
      });
      return;
    }
    if (!settings.depositEnabled) {
      await ctx.answerCallbackQuery({
        text: t(ctx.state.lang, 'errors.deposit_disabled'),
        show_alert: true
      });
      return;
    }

    const allowed = await ChannelSubscription.requireForCriticalActions(ctx, 'make a deposit');
if (!allowed) return;

    if (ctx.session.ETBDeposit?.parsedReceipt) {
      try {
        await ctx.deleteMessage();
      } catch (err) {
        await ctx.editMessageText?.('❌ Deposit cancelled.', { reply_markup: undefined });
      }
    }

    delete ctx.session.ETBDeposit;
    await showDepositMethodSelection(ctx);
  } catch (error) {
    logger.error('ETB deposit start error:', error);
  }
}

export async function handleETBDepositMethod(ctx: CallbackQueryContext<Context>) {
  try {
    await ctx.answerCallbackQuery?.();
    const method = sanitizeInput(ctx.match![1]) as 'telebirr' | 'cbebirr';
    
    if (method !== 'telebirr' && method !== 'cbebirr') {
      await ctx.editMessageText?.(t(ctx.state.lang, 'deposit.method_unavailable'), {
        parse_mode: 'Markdown',
        reply_markup: new InlineKeyboard().text(t(ctx.state.lang, 'buttons.back'), 'ETB_deposit')
      });
      return;
    }

    // Store method in session
    if (!ctx.session.ETBDeposit) ctx.session.ETBDeposit = {};
    ctx.session.ETBDeposit.method = method;

    // Show receipt instructions (without amount)
    const details = ETBDepositService.getMethodDetails(method);
    const instructionKey = method === 'telebirr' 
      ? 'deposit.instructions_telebirr_noamount' 
      : 'deposit.instructions_cbebirr_noamount';
    const message = t(ctx.state.lang, instructionKey, {
      accountNumber: details.accountNumber,
      accountName: details.accountName,
    });

    const keyboard = new InlineKeyboard()
      .text(t(ctx.state.lang, 'buttons.back'), 'ETB_deposit')
      .text(t(ctx.state.lang, 'buttons.cancel'), 'ETB_balance');

    await ctx.editMessageText?.(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });

    ctx.session.step = 'awaiting_ETB_deposit_receipt';
  } catch (error) {
    logger.error('ETB deposit method error:', error);
  }
}

async function proceedToAccountDetails(ctx: Context | CallbackQueryContext<Context>, amountETB: number, isCallback = false) {
  if (!ctx.session.ETBDeposit) {
    const errorMsg = t(ctx.state.lang, 'errors.session_expired');
    if (isCallback) await (ctx as CallbackQueryContext<Context>).editMessageText?.(errorMsg);
    else await ctx.reply(errorMsg);
    return;
  }
  const method = ctx.session.ETBDeposit.method;
  if (!method) {
    const errorMsg = t(ctx.state.lang, 'errors.session_expired');
    if (isCallback) await (ctx as CallbackQueryContext<Context>).editMessageText?.(errorMsg);
    else await ctx.reply(errorMsg);
    return;
  }

  const details = ETBDepositService.getMethodDetails(method);
  ctx.session.ETBDeposit.amountETB = amountETB;

  let instructionKey: string;
  if (method === 'telebirr') {
    instructionKey = 'deposit.instructions_telebirr';
  } else if (method === 'cbebirr') {
    instructionKey = 'deposit.instructions_cbebirr';
  } else {
    instructionKey = 'deposit.instructions'; // fallback
  }

  const message = t(ctx.state.lang, instructionKey, {
    accountNumber: details.accountNumber,
    accountName: details.accountName,
    amountETB: amountETB.toString()
  });

  const keyboard = new InlineKeyboard()
    .text(t(ctx.state.lang, 'buttons.back'), 'ETB_deposit')
    .text(t(ctx.state.lang, 'buttons.cancel'), 'ETB_balance');

  if (isCallback) {
    await (ctx as CallbackQueryContext<Context>).editMessageText?.(message, { parse_mode: 'Markdown', reply_markup: keyboard });
  } else {
    await ctx.reply(message, { parse_mode: 'Markdown', reply_markup: keyboard });
  }

  ctx.session.step = 'awaiting_ETB_deposit_receipt';
}

export async function handleETBDepositReceiptInput(ctx: Context) {
  if (ctx.session?.step !== 'awaiting_ETB_deposit_receipt') return;

  const receiptText = sanitizeInput(ctx.message?.text?.trim());
  if (!receiptText) {
    await replyWithTranslation(ctx, 'deposit.enter_receipt');
    return;
  }

  const depositData = ctx.session.ETBDeposit;
  if (!depositData?.method) {
    await replyWithTranslation(ctx, 'errors.session_expired');
    delete ctx.session.step;
    return;
  }

  const userId = sanitizeInput(ctx.from!.id);
  const user = await User.findOne({ telegramId: parseInt(userId) });
  if (!user) {
    await replyWithTranslation(ctx, 'errors.user_not_found');
    delete ctx.session.step;
    return;
  }

  // 1. Parse receipt
  let parsed: any;
  if (depositData.method === 'telebirr') {
    parsed = ETBDepositService.parseTelebirrReceipt(receiptText);
  } else {
    parsed = ETBDepositService.parseCbeBirrReceipt(receiptText);
  }

  if (!parsed) {
    await ctx.reply(t(ctx.state.lang, 'deposit.receipt_parse_error'));   // specific
    return;
  }

  // 2. Enforce minimum 10 ETB
  if (parsed.amount < 10) {
    await ctx.reply(t(ctx.state.lang, 'deposit.amount_too_low', { amount: parsed.amount.toFixed(2) }));
    return;
  }

  // 3. Verify receiver matches our account
  const settings = getSettings();
  const expectedReceiver = depositData.method === 'telebirr' 
    ? settings.telebirrAccountName 
    : settings.cbeBirrAccountName;
  if (!expectedReceiver || parsed.receiverName.toLowerCase() !== expectedReceiver.toLowerCase()) {
    await ctx.reply(t(ctx.state.lang, 'deposit.receiver_mismatch'));   // specific
    return;
  }

  // 4. Check duplicate transaction
  const existing = await ETBDeposit.findOne({ transactionId: parsed.transactionId });
  if (existing) {
    await ctx.reply(t(ctx.state.lang, 'deposit.duplicate_transaction'));   // specific
    return;
  }

  // 5. Finalize deposit (auto‑confirm or pending)
  const result = await ETBDepositService.finalizeDepositRequest(
    user._id,
    depositData.method,
    parsed.amount,
    parsed
  );

  // Clear session
  delete ctx.session.ETBDeposit;
  delete ctx.session.step;

  if (result.success) {
    const keyboard = new InlineKeyboard()
      .text(t(ctx.state.lang, 'buttons.etb_balance'), 'ETB_balance')
      .text(t(ctx.state.lang, 'buttons.main_menu'), 'main_menu');

    let messageKey = result.autoConfirmed 
      ? 'notification.deposit_confirmed' 
      : 'notification.deposit_pending';
    let templateData: any = {
      requestId: result.requestId,
      amount: parsed.amount.toFixed(2),
    };
    if (!result.autoConfirmed) {
      templateData.txId = parsed.transactionId;
    }

    await ctx.reply(t(ctx.state.lang, messageKey, templateData), {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  } else {
    // If the service returned an error, show it; otherwise fallback to generic
    const errorMsg = result.error || t(ctx.state.lang, 'errors.general');
    await ctx.reply(errorMsg);
  }
}

export async function handleETBDepositAmountInput(ctx: Context) {
  if (ctx.session?.step !== 'awaiting_ETB_deposit_amount') return;
  const amountText = ctx.message?.text?.trim();
  if (!amountText) {
    await replyWithTranslation(ctx, 'deposit.enter_custom_amount');
    return;
  }
  const amountETB = parseFloat(sanitizeInput(amountText));
  if (isNaN(amountETB) || amountETB < 10) {
    await replyWithTranslation(ctx, 'deposit.invalid_amount');
    return;
  }
  await proceedToAccountDetails(ctx, amountETB, false);
}