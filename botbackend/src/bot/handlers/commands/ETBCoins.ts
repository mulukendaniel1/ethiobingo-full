//src\bot\handlers\commands\ETBCoins.ts
import { CommandContext } from 'grammy';
import { Context } from '../../framework';
import { KeyboardFactory } from '../../framework/keyboards';
import { User } from '../../../core/database/models/User';
import { logger } from '../../../core/utils/logger';
import { ETBCoinService } from '../../../services/ETBCoinServiceInstance';
import { InlineKeyboard } from 'grammy';
import { ETBDeposit } from '../../../core/database/models/ETBDeposit';
import { ETBWithdrawal } from '../../../core/database/models/ETBWithdrawal';
import { sanitizeInput } from '../../../core/utils/security';
import { getSettings } from '@/core/utils/settingsCache';
import { t, replyWithTranslation } from '../../utils/i18n';

export async function ETBCoinsCommand(ctx: CommandContext<Context>) {
  delete ctx.session.step;
  delete ctx.session.ETBWithdraw;
  delete ctx.session.ETBDeposit;

  const userId = sanitizeInput(ctx.from!.id);
  const lang = ctx.state.lang;
  
  try {
    const user = await User.findOne({ telegramId: parseInt(userId) });
    if (!user) {
      await replyWithTranslation(ctx, 'errors.user_not_found', {}, {
        reply_markup: KeyboardFactory.mainMenu(false, true, lang)
      });
      return;
    }

    const ETBEnabled = getSettings().etbCoinEnabled;
    if (!ETBEnabled) {
      await replyWithTranslation(ctx, 'errors.etb_disabled', {}, {
        reply_markup: KeyboardFactory.mainMenu(false, true, lang)
      });
      return;
    }

    const ETBStats = await ETBCoinService.getUserETBStats(user._id);
    if (!ETBStats) {
      await replyWithTranslation(ctx, 'errors.general', {}, {
        reply_markup: KeyboardFactory.mainMenu(false, true, lang)
      });
      return;
    }

    const locked = user.lockedWithdrawAmount || 0;

    const message = t(lang, 'ETB.balance', {
      balance: user.balanceMain.toFixed(2),
      coins: user.ETBCoins.toFixed(2),
      locked: locked.toFixed(2),
      earned: ETBStats.totalEarned.toFixed(2),
      withdrawn: ETBStats.totalRedeemed.toFixed(2)
    });

    const inlineKeyboard = new InlineKeyboard()
      .text(t(lang, 'buttons.transactions'), 'ETB_transactions')
      .row()
      .text(t(lang, 'buttons.pending_requests'), 'ETB_pending_requests')
      .text(t(lang, 'buttons.back'), 'settings');

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: inlineKeyboard
    });
  } catch (error) {
    logger.error('ETB coins command error:', error);
    await replyWithTranslation(ctx, 'errors.general', {}, {
      reply_markup: KeyboardFactory.mainMenu(false, true, lang)
    });
  }
}

// Callback handler for ETB transactions
export async function handleETBTransactions(ctx: any) {
  const lang = ctx.state.lang;
  try {
    const userId = sanitizeInput(ctx.from!.id);
    const user = await User.findOne({ telegramId: parseInt(userId) });
    if (!user) return;

    const recentTransactions = user.ETBCoinTransactions
      .slice(-10)
      .reverse();

    let message = t(lang, 'ETB.transactions_title') + '\n\n';
    if (recentTransactions.length === 0) {
      message += t(lang, 'ETB.no_transactions');
    } else {
      for (const tx of recentTransactions) {
        const typeEmoji = tx.type === 'earned' ? '➕' : 
                         tx.type === 'redeemed' ? '➖' : '🔄';
        const date = new Date(tx.timestamp).toLocaleDateString();
        message += t(lang, 'ETB.transaction_item', {
          emoji: typeEmoji,
          amount: tx.amount.toFixed(2),
          type: tx.type,
          date: date,
          notes: tx.notes || t(lang, 'ETB.no_description')
        }) + '\n\n';
      }
    }

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: t(lang, 'buttons.back'), callback_data: 'ETB_balance' }],
          [{ text: t(lang, 'buttons.main_menu'), callback_data: 'main_menu' }]
        ]
      }
    });
  } catch (error) {
    logger.error('ETB transactions error:', error);
  }
}

// Callback handler for pending requests
export async function handleETBPendingRequests(ctx: Context) {
  const lang = ctx.state.lang;
  try {
    const userId = sanitizeInput(ctx.from!.id);
    const user = await User.findOne({ telegramId: parseInt(userId) });
    if (!user) return;

    const deposits = await ETBDeposit.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();
    const withdrawals = await ETBWithdrawal.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    let message = t(lang, 'ETB.pending_requests_title') + '\n\n';
    if (deposits.length === 0 && withdrawals.length === 0) {
      message += t(lang, 'ETB.no_pending');
    } else {
      if (deposits.length > 0) {
        message += `*${t(lang, 'ETB.deposits_header')}*\n`;
        for (const d of deposits) {
          const statusEmoji = d.status === 'pending' ? '⏳' : d.status === 'confirmed' ? '✅' : '❌';
          message += t(lang, 'ETB.deposit_item', {
            emoji: statusEmoji,
            id: d.requestId.substring(0, 8),
            amount: d.amountETB,
            status: d.status
          }) + '\n';
        }
        message += '\n';
      }
      if (withdrawals.length > 0) {
        message += `*${t(lang, 'ETB.withdrawals_header')}*\n`;
        for (const w of withdrawals) {
          const statusEmoji = w.status === 'pending' ? '⏳' : w.status === 'processed' ? '✅' : '❌';
          message += t(lang, 'ETB.withdrawal_item', {
            emoji: statusEmoji,
            id: w.requestId.substring(0, 8),
            amount: w.amountETB,
            status: w.status
          }) + '\n';
        }
      }
    }

    const keyboard = new InlineKeyboard()
      .text(t(lang, 'buttons.back'), 'ETB_balance')
      .text(t(lang, 'buttons.main_menu'), 'main_menu');

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  } catch (error) {
    logger.error('ETB pending requests error:', error);
  }
}