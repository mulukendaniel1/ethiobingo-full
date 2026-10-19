//src\bot\handlers\callbacks\index.ts
import { Bot, InlineKeyboard } from 'grammy';
import { sanitizeInput } from '../../../core/utils/security';
import { Context } from '../../framework';
import { ETBCoinsCommand, handleETBPendingRequests, handleETBTransactions } from '../commands/ETBCoins';
import { env } from '@/core/config/env';
import { balanceCommand } from '../commands/balance';
import { User } from '@/core/database/models/User';
import { handleMenuToggle } from './menuToggle';
import { handleRefreshMenu } from './menuRefresh';
import { KeyboardFactory } from '@/bot/framework/keyboards';
import { TelegramFormatter } from '../../../core/utils/messageFormatter';
import { 
  handleAdminStats, 
  handleAdminMenu, 
  handleAdminUsers, 
  handleAdminControls,
  handleAdminUserStats,
  handleAdminUserCommands,
  handleAdminClearCache,
  handleAdminRestartHistory,
  handleAdminSoftRestart,
  handleAdminSearchUsers,
  handleListUsers,
  handleBanUser,
  handleBanAction,
  handleUnbanUser,
  handleUserDetail,
  handleUserActions,
  handleAdjustBalance,
  handleBanConfirmation,
  handleViewSearchResults,
  handleBanWithReason,
  handleUserNotes,
  handleUserStatsDetail,
} from './admin';
// REMOVED: import { HelpTemplates } from '../../messages/helpTemplates';

import {
  handleBroadcastDashboard,
  handleNewBroadcast,
  handleBroadcastTemplate,
  handleBroadcastTarget,
  handleBroadcastChannel,
  handleBroadcastConfirm,
  handleScheduledBroadcasts,
  handleCancelBroadcast,
  handleBroadcastTemplates,
  handleBroadcastStats,
  getBroadcastHandler
} from './enhancedBroadcast';
import { handleReferralStats } from '../commands/settings';
import { handleDismissSuggestion, handleVerifySubscription, handleWhySubscription } from './subscription';

import {
  handleETBDeposit,
  handleETBDepositMethod,
} from '../commands/ETBDeposit';

import {
  handleETBWithdraw,
  handleETBWithdrawMethod,
  handleETBWithdrawDestinationInput
} from '../commands/ETBWithdraw';

import {
  handleAdminETBDeposits,
  handleAdminETBDepositDetail,
  handleAdminETBConfirmDeposit,
  handleAdminETBForceConfirmDeposit,
  handleAdminETBRejectDeposit,
  handleAdminETBWithdrawals,
  handleAdminETBWithdrawalDetail,
  handleAdminETBConfirmWithdrawal,
  handleAdminETBRejectWithdrawal
} from './ETBAdmin';
import { handleLanguageSelection } from './language';
import { operatorService } from '@/services/operatorService';
import { t, replyWithTranslation } from '../../utils/i18n'; // ADDED
import { handleChannelShamoClaim } from '../channelShamo';

export function setupCallbackHandlers(bot: Bot<Context>) {
  
  bot.callbackQuery(/^lang_(.+)$/, handleLanguageSelection);

  // subscription callbacks
  bot.callbackQuery('verify_subscription', handleVerifySubscription);
  bot.callbackQuery('why_subscription', handleWhySubscription);
  bot.callbackQuery('dismiss_suggestion', handleDismissSuggestion);

  // ==================== MENU TOGGLE ====================
  bot.callbackQuery('toggle_menu_min', handleMenuToggle);
  bot.callbackQuery('toggle_menu_full', handleMenuToggle);
  bot.callbackQuery('refresh_menu', handleRefreshMenu);
  bot.callbackQuery(/^shamo_claim_(.+)$/, handleChannelShamoClaim);

  // ==================== REFERRAL STATS ====================
  bot.callbackQuery('referral_stats', handleReferralStats);
  
  // ==================== RESTART HANDLERS ====================
  bot.callbackQuery('admin_restart', async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText?.(
    t(ctx.state.lang, 'admin.restart'),
    {
      parse_mode: 'Markdown',
      reply_markup: new InlineKeyboard()
        .text(t(ctx.state.lang, 'buttons.soft_restart'), 'admin_soft_restart')
        .text(t(ctx.state.lang, 'buttons.restart_history'), 'admin_restart_history')
        .row()
        .text(t(ctx.state.lang, 'buttons.cancel'), 'admin_controls')
    }
  );
});
  
  bot.callbackQuery('confirm_restart', async (ctx) => {
  await ctx.answerCallbackQuery({ text: t(ctx.state.lang, 'admin.restart_initiated') });
  await ctx.editMessageText?.(t(ctx.state.lang, 'admin.restart_scheduled'));
});

bot.callbackQuery('admin_full_restart', async (ctx) => {
  await ctx.answerCallbackQuery({ text: t(ctx.state.lang, 'admin.full_restart_coming') });
});

bot.callbackQuery('admin_emergency_stop', async (ctx) => {
  await ctx.answerCallbackQuery({ text: t(ctx.state.lang, 'admin.emergency_stop_coming') });
});

  // ==================== BROADCAST ====================
  bot.callbackQuery('admin_broadcast', handleBroadcastDashboard);
  bot.callbackQuery('broadcast_new', handleNewBroadcast);
  bot.callbackQuery('broadcast_scheduled', handleScheduledBroadcasts);
  bot.callbackQuery('broadcast_templates', handleBroadcastTemplates);
  bot.callbackQuery('broadcast_stats', handleBroadcastStats);
  bot.callbackQuery('broadcast_custom', async (ctx) => {
    const handler = getBroadcastHandler(ctx.api);
    const instructions = t(ctx.state.lang, 'broadcast.custom_input');
    await ctx.editMessageText(instructions, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: t(ctx.state.lang, 'buttons.view_templates'), callback_data: 'broadcast_templates' }],
          [{ text: t(ctx.state.lang, 'buttons.back'), callback_data: 'admin_broadcast' }]
        ]
      }
    });
    ctx.session.step = 'awaiting_custom_broadcast';
  });

  bot.callbackQuery(/^broadcast_template_(.+)$/, async (ctx) => {
    const templateKey = ctx.match![1];
    await handleBroadcastTemplate(ctx, templateKey);
  });

  bot.callbackQuery(/^broadcast_target_(.+?)(?:_(.+))?$/, async (ctx) => {
    const target = ctx.match![1];
    const templateKey = ctx.match![2];
    await handleBroadcastTarget(ctx, target, templateKey);
  });

  bot.callbackQuery(/^broadcast_channel_(.+?)_(.+)$/, async (ctx) => {
    const channel = ctx.match![1];
    const target = ctx.match![2];
    await handleBroadcastChannel(ctx, channel, target);
  });

  bot.callbackQuery(/^broadcast_confirm_(.+)_(.+)$/, async (ctx) => {
    const target = ctx.match![1];
    const channel = ctx.match![2];
    await handleBroadcastConfirm(ctx, target, channel);
  });

  bot.callbackQuery(/^broadcast_cancel_(.+)$/, async (ctx) => {
    const broadcastId = ctx.match![1];
    await handleCancelBroadcast(ctx, broadcastId);
  });

  bot.callbackQuery(/^broadcast_details_(.+)$/, async (ctx) => {
    const identifier = ctx.match![1];
    const { handleBroadcastDetails } = await import('./enhancedBroadcast');
    await handleBroadcastDetails(ctx, identifier);
  });

  bot.callbackQuery(/^broadcast_schedule_([^_]+)_(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const target = ctx.match![1];
    const channel = ctx.match![2];
    ctx.session.pendingSchedule = { target, channel };
    await ctx.editMessageText?.(
      t(ctx.state.lang, 'broadcast.schedule'),
      { parse_mode: 'Markdown' }
    );
    ctx.session.step = 'awaiting_schedule_time';
  });

  bot.callbackQuery('broadcast_stats_week', async (ctx) => {
    await ctx.answerCallbackQuery();
    const handler = getBroadcastHandler(ctx.api);
    const stats = await handler.broadcastService.getBroadcastStats('week');
    await ctx.editMessageText?.(
      t(ctx.state.lang, 'broadcast.stats_week', { total: stats.total, completed: stats.completed, rate: stats.successRate.toFixed(1) }),
      { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: t(ctx.state.lang, 'buttons.back'), callback_data: 'broadcast_stats' }]] } }
    );
  });

  bot.callbackQuery('broadcast_stats_month', async (ctx) => {
    await ctx.answerCallbackQuery();
    const handler = getBroadcastHandler(ctx.api);
    const stats = await handler.broadcastService.getBroadcastStats('month');
    await ctx.editMessageText?.(
      t(ctx.state.lang, 'broadcast.stats_month', { total: stats.total, completed: stats.completed, rate: stats.successRate.toFixed(1) }),
      { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: t(ctx.state.lang, 'buttons.back'), callback_data: 'broadcast_stats' }]] } }
    );
  });

  bot.callbackQuery('broadcast_schedule_new', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText?.(
      t(ctx.state.lang, 'broadcast.schedule_new'),
      { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: t(ctx.state.lang, 'buttons.view_scheduled'), callback_data: 'broadcast_scheduled' }], [{ text: t(ctx.state.lang, 'buttons.back'), callback_data: 'admin_broadcast' }]] } }
    );
  });

  // Toggle pause
  bot.callbackQuery('admin_togglepause', async (ctx) => {
    await ctx.answerCallbackQuery();
    const { togglePauseCommand } = await import('../commands/admin');
    await togglePauseCommand(ctx);
  });

  // ==================== SESSION CLEARING CALLBACKS ====================
  bot.callbackQuery(['done_', 'cancel_', 'payout_completed_'], async (ctx) => {
    await ctx.answerCallbackQuery();
  });

  // ==================== ADMIN CALLBACKS ====================
  bot.callbackQuery('admin_stats', handleAdminStats);
  bot.callbackQuery('admin_menu', handleAdminMenu);
  bot.callbackQuery('admin_search_users', handleAdminSearchUsers);
  bot.callbackQuery('admin_controls', handleAdminControls);
  bot.callbackQuery('admin_clear_cache', handleAdminClearCache);
  bot.callbackQuery('admin_restart_history', handleAdminRestartHistory);
  bot.callbackQuery('admin_user_stats', handleAdminUserStats);
  bot.callbackQuery('admin_user_commands', handleAdminUserCommands);
  bot.callbackQuery('admin_soft_restart', handleAdminSoftRestart);
  bot.callbackQuery('admin_users', handleAdminUsers);
  bot.callbackQuery('admin_list_users', handleListUsers);

  bot.callbackQuery(/^admin_ban_(\d+)$/, async (ctx) => {
    const userId = ctx.match![1];
    await handleBanUser(ctx, userId);
  });

  bot.callbackQuery(/^admin_ban_now_(.+)_(.+)$/, async (ctx) => {
    const userId = ctx.match![1];
    const reason = ctx.match![2];
    await handleBanAction(ctx, userId, reason);
  });

  bot.callbackQuery(/^admin_unban_(\d+)$/, async (ctx) => {
    const userId = ctx.match![1];
    await handleUnbanUser(ctx, userId);
  });

  bot.callbackQuery(/^admin_ban_reason_(\d+)__(.+)$/, async (ctx) => {
    const userId = ctx.match![1];
    const reason = ctx.match![2].replace(/_/g, ' ');
    await handleBanWithReason(ctx, userId, reason);
  });

  bot.callbackQuery(/^admin_user_detail_(.+)$/, async (ctx) => {
    const userId = ctx.match![1];
    await handleUserDetail(ctx, userId);
  });



  // Handle approve with notes
  bot.callbackQuery(/^approve_with_notes_(.+)$/, async (ctx) => {
    const jobId = ctx.match![1];
    await ctx.answerCallbackQuery();
    await ctx.editMessageText?.(
      t(ctx.state.lang, 'admin.approve_notes', { jobId }),
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[{ text: t(ctx.state.lang, 'buttons.cancel'), callback_data: `admin_view_${jobId}` }]]
        }
      }
    );
    ctx.session.step = `admin_approve_notes_${jobId}`;
  });

  bot.callbackQuery(/^admin_user_actions_(.+)$/, async (ctx) => {
    const userId = ctx.match![1];
    await handleUserActions(ctx, userId);
  });

  bot.callbackQuery(/^admin_adjust_balance_(.+)$/, async (ctx) => {
    const userId = ctx.match![1];
    await handleAdjustBalance(ctx, userId);
  });

  bot.callbackQuery(/^admin_ban_confirmation_(.+)$/, async (ctx) => {
    const userId = ctx.match![1];
    await handleBanConfirmation(ctx, userId);
  });

  bot.callbackQuery(/^admin_view_search_results_(.+)$/, async (ctx) => {
    const encodedQuery = ctx.match![1];
    await handleViewSearchResults(ctx, encodedQuery);
  });

  bot.callbackQuery(/^admin_search_more_(.+)_(.+)$/, async (ctx) => {
    const encodedQuery = ctx.match![1];
    const offset = parseInt(ctx.match![2]);
    await handleViewSearchResults(ctx, encodedQuery, offset);
  });

  bot.callbackQuery('admin_banned_list', async (ctx) => {
    const { handleBannedUsersList } = await import('./admin');
    await handleBannedUsersList(ctx);
  });

  bot.callbackQuery('admin_pause_bot', async (ctx) => {
    await ctx.answerCallbackQuery();
    const userId = sanitizeInput(ctx.from!.id);
    const user = await User.findOne({ telegramId: parseInt(userId) });
    if (!user?.isAdmin) {
      await replyWithTranslation(ctx, 'errors.admin_access');
      return;
    }
    const operator = await operatorService.getOperator();
    if (!operator.isActive) {
      await replyWithTranslation(ctx, 'admin.bot_already_paused');
      return;
    }
    await operatorService.pause(user._id, parseInt(userId));
    await ctx.editMessageText?.(
      t(ctx.state.lang, 'admin.bot_paused'),
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: t(ctx.state.lang, 'buttons.resume_bot'), callback_data: 'admin_resume_bot' }],
            [{ text: t(ctx.state.lang, 'buttons.back'), callback_data: 'admin_menu' }]
          ]
        }
      }
    );
  });

  bot.callbackQuery('admin_resume_bot', async (ctx) => {
    await ctx.answerCallbackQuery();
    const userId = sanitizeInput(ctx.from!.id);
    const user = await User.findOne({ telegramId: parseInt(userId) });
    if (!user?.isAdmin) {
      await replyWithTranslation(ctx, 'errors.admin_access');
      return;
    }
    const operator = await operatorService.getOperator();
    if (operator.isActive) {
      await replyWithTranslation(ctx, 'admin.bot_already_active');
      return;
    }
    await operatorService.resume(user._id, parseInt(userId));
    await ctx.editMessageText?.(
      t(ctx.state.lang, 'admin.bot_resumed'),
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[{ text: t(ctx.state.lang, 'buttons.back'), callback_data: 'admin_menu' }]]
        }
      }
    );
  });

  // ==================== ADMIN USER DETAILS ====================
  bot.callbackQuery(/^admin_user_stats_detail_(.+)$/, async (ctx) => {
    const userId = ctx.match![1];
    await handleUserDetail(ctx, userId);
  });

  bot.callbackQuery(/^admin_user_notes_(.+)$/, async (ctx) => {
    const userId = ctx.match![1];
    await handleUserNotes(ctx, userId);
  });

  bot.callbackQuery(/^admin_user_stats_(.+)$/, async (ctx) => {
    const userId = ctx.match![1];
    await handleUserStatsDetail(ctx, userId);
  });

  bot.callbackQuery(/^admin_ban_custom_(.+)$/, async (ctx) => {
    const userId = ctx.match![1];
    await ctx.answerCallbackQuery();
    const adminId = ctx.from!.id;
    const admin = await User.findOne({ telegramId: adminId });
    if (!admin?.isAdmin) {
      await ctx.editMessageText?.('❌ Admin access required.');
      return;
    }
    await ctx.editMessageText?.(
      t(ctx.state.lang, 'admin.custom_ban_reason', { userId }),
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[{ text: t(ctx.state.lang, 'buttons.cancel'), callback_data: `admin_user_detail_${userId}` }]]
        }
      }
    );
    ctx.session.step = `admin_ban_custom_${userId}`;
  });

  bot.callbackQuery(/^admin_ban_reason_(\d+)__(.+)$/, async (ctx) => {
    const userId = ctx.match![1];
    const reason = ctx.match![2].replace(/_/g, ' ');
    const { handleBanWithReason } = await import('./admin');
    await handleBanWithReason(ctx, userId, reason);
  });

  // ETB Deposit/Withdraw
  bot.callbackQuery('ETB_deposit', handleETBDeposit);
  bot.callbackQuery(/^ETB_deposit_method_(.+)$/, handleETBDepositMethod);
  bot.callbackQuery('ETB_withdraw', handleETBWithdraw);
  bot.callbackQuery(/^ETB_withdraw_method_(.+)$/, handleETBWithdrawMethod);

  bot.callbackQuery('ETB_pending_requests', handleETBPendingRequests);

  // Admin ETB
  bot.callbackQuery('admin_ETB_deposits', handleAdminETBDeposits);
  bot.callbackQuery(/^admin_ETB_deposit_(.+)$/, handleAdminETBDepositDetail);
  bot.callbackQuery(/^admin_ETB_confirm_deposit_(.+)$/, handleAdminETBConfirmDeposit);
  bot.callbackQuery(/^admin_force_confirm_(.+)$/, handleAdminETBForceConfirmDeposit);
  bot.callbackQuery(/^admin_ETB_reject_deposit_(.+)$/, handleAdminETBRejectDeposit);

  bot.callbackQuery('admin_ETB_withdrawals', handleAdminETBWithdrawals);
  bot.callbackQuery(/^admin_ETB_withdrawal_(.+)$/, handleAdminETBWithdrawalDetail);
  bot.callbackQuery(/^admin_ETB_confirm_withdrawal_(.+)$/, handleAdminETBConfirmWithdrawal);
  bot.callbackQuery(/^admin_ETB_reject_withdrawal_(.+)$/, handleAdminETBRejectWithdrawal);

  // ==================== ETB COIN CALLBACKS ====================
  bot.callbackQuery('ETB_balance', async (ctx) => {
    await ETBCoinsCommand(ctx as any);
  });

  // ==================== ETB CALLBACKS ====================
  bot.callbackQuery('ETB_transactions', handleETBTransactions);

  bot.callbackQuery('ETB_earn_more', async (ctx) => {
    await ctx.editMessageText(
      t(ctx.state.lang, 'ETB.earn_more', { reward: env.ETB_REWARD_PER_TASK || 0 }),
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: t(ctx.state.lang, 'buttons.transactions'), callback_data: 'ETB_transactions' }],
            [{ text: t(ctx.state.lang, 'buttons.back'), callback_data: 'ETB_balance' }],
            [{ text: t(ctx.state.lang, 'buttons.main_menu'), callback_data: 'main_menu' }]
          ]
        }
      }
    );
  });

  // ==================== SETTINGS CALLBACKS ====================
  bot.callbackQuery('settings', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText?.(
      t(ctx.state.lang, 'settings.title'),
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: t(ctx.state.lang, 'buttons.transactions'), callback_data: 'ETB_balance' }],
            [{ text: t(ctx.state.lang, 'buttons.back'), callback_data: 'balance' }]
          ]
        }
      }
    );
  });

  // ==================== MENU NAVIGATION ====================
  bot.callbackQuery('main_menu', async (ctx) => {
    await ctx.answerCallbackQuery();
    const userId = sanitizeInput(ctx.from!.id);
    const user = await User.findOne({ telegramId: parseInt(userId) });
    const message = user
      ? t(ctx.state.lang, 'menu.main', { name: user.firstName, balance: user.balanceMain, coins: user.ETBCoins, earned: user.totalEarned })
      : t(ctx.state.lang, 'menu.main_guest');
    await ctx.editMessageText?.(message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: t(ctx.state.lang, 'buttons.play_games'), callback_data: 'play_games' },
            { text: t(ctx.state.lang, 'buttons.balance'), callback_data: 'balance' }
          ],
          [
            { text: t(ctx.state.lang, 'buttons.settings'), callback_data: 'settings' }
          ],
          user?.isAdmin
            ? [{ text: t(ctx.state.lang, 'buttons.admin'), callback_data: 'admin_menu' }]
            : [{ text: t(ctx.state.lang, 'buttons.help'), callback_data: 'help_menu' }]
        ]
      }
    }).catch(() => {
      ctx.reply?.(message, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: t(ctx.state.lang, 'buttons.play_games'), callback_data: 'play_games' },
              { text: t(ctx.state.lang, 'buttons.balance'), callback_data: 'balance' }
            ],
            [
              { text: t(ctx.state.lang, 'buttons.settings'), callback_data: 'settings' }
            ],
            user?.isAdmin
              ? [{ text: t(ctx.state.lang, 'buttons.admin'), callback_data: 'admin_menu' }]
              : [{ text: t(ctx.state.lang, 'buttons.help'), callback_data: 'help_menu' }]
          ]
        }
      });
    });
  });

  bot.callbackQuery('balance', async (ctx) => {
    await ctx.answerCallbackQuery();
    await balanceCommand(ctx as any);
  });

  // ==================== HELP MENU ====================
  bot.callbackQuery('help_menu', async (ctx) => {
    await ctx.answerCallbackQuery();
    const helpMessage = t(ctx.state.lang, 'help.main');
    await ctx.editMessageText(helpMessage, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: t(ctx.state.lang, 'help.buttons.how_to_play'), callback_data: 'help_howtoplay' }],
          [{ text: t(ctx.state.lang, 'help.buttons.payouts'), callback_data: 'help_payouts' }],
          [{ text: t(ctx.state.lang, 'help.buttons.referral'), callback_data: 'help_referral' }],
          [{ text: t(ctx.state.lang, 'help.buttons.technical'), callback_data: 'help_technical' }],
          [{ text: t(ctx.state.lang, 'help.buttons.fairness'), callback_data: 'help_fairness' }],
          [{ text: t(ctx.state.lang, 'help.buttons.support'), callback_data: 'help_support' }],
          [{ text: t(ctx.state.lang, 'help.buttons.news'), callback_data: 'help_news' }],
          [{ text: t(ctx.state.lang, 'buttons.back'), callback_data: 'main_menu' }]
        ]
      }
    });
  });

  // Handlers for each help topic
  bot.callbackQuery('help_howtoplay', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(t(ctx.state.lang, 'help.how_to_play'), {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: t(ctx.state.lang, 'buttons.back'), callback_data: 'help_menu' }]] }
    });
  });

  bot.callbackQuery('help_payouts', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(t(ctx.state.lang, 'help.payouts'), {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: t(ctx.state.lang, 'buttons.back'), callback_data: 'help_menu' }]] }
    });
  });

  bot.callbackQuery('help_referral', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(t(ctx.state.lang, 'help.referral'), {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: t(ctx.state.lang, 'buttons.back'), callback_data: 'help_menu' }]] }
    });
  });

  bot.callbackQuery('help_technical', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(t(ctx.state.lang, 'help.technical'), {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: t(ctx.state.lang, 'buttons.back'), callback_data: 'help_menu' }]] }
    });
  });

  bot.callbackQuery('help_fairness', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(t(ctx.state.lang, 'help.fairness'), {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: t(ctx.state.lang, 'buttons.back'), callback_data: 'help_menu' }]] }
    });
  });

  // Support handler
bot.callbackQuery('help_support', async (ctx) => {
  await ctx.answerCallbackQuery();
  const supportLink = TelegramFormatter.formatUsernameAsLink('@Ethiobingosupport2');
  const message = t(ctx.state.lang, 'help.support', { support_link: supportLink });
  await ctx.editMessageText(message, {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: [[{ text: t(ctx.state.lang, 'buttons.back'), callback_data: 'help_menu' }]] }
  });
});

// News handler
bot.callbackQuery('help_news', async (ctx) => {
  await ctx.answerCallbackQuery();
  const channelLink = TelegramFormatter.formatUsernameAsLink('@ethio_bingo7');
  const message = t(ctx.state.lang, 'help.news', { channel_link: channelLink });
  await ctx.editMessageText(message, {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: [[{ text: t(ctx.state.lang, 'buttons.back'), callback_data: 'help_menu' }]] }
  });
});

  // ==================== FALLBACK FOR UNHANDLED ====================
 bot.on('callback_query:data', async (ctx) => {
  const callbackData = ctx.callbackQuery.data;
  if (!callbackData.startsWith('test_')) {
    console.warn(`⚠️ Unhandled callback: ${callbackData}`);
  }
  try {
    await ctx.answerCallbackQuery({
      text: t(ctx.state.lang, 'common.expired_action'),
      show_alert: false
    });
  } catch (error) {
    // Ignore "query too old" errors
  }
});

  bot.callbackQuery('test_callback', async (ctx) => {
    await ctx.answerCallbackQuery({ text: '✅ Callback handler is working!' });
    await ctx.editMessageText?.('✅ Callback handler test successful!');
  });

}