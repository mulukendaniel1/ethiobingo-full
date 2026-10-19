// src/bot/handlers/callbacks/enhancedBroadcast.ts
import { CallbackQueryContext, InlineKeyboard } from 'grammy';
import { Context } from '../../framework';
import { User } from '../../../core/database/models/User';
import { BroadcastService, BroadcastMessage, BroadcastFilter } from '../../../services/broadcastService';
import { logger } from '../../../core/utils/logger';
import { env } from '../../../core/config/env';
import { sanitizeInput } from '../../../core/utils/security';
import { getSettings } from '@/core/utils/settingsCache';

interface BroadcastSessionData {
  templateId?: string;           // if using a template
  title: string;
  content: string;
  type: 'announcement' | 'promotion' | 'update' | 'alert' | 'educational';
  target: 'all' | 'active' | 'balance' | 'recent' | 'specific';
  channels: ('bot' | 'channel')[]; // normalized, never 'both'
  step: 'target_selection' | 'channel_selection' | 'confirmation' | 'scheduling';
}

export function createFilterFromTarget(target: string): BroadcastFilter {
  switch (target) {
    case 'active': return { lastActiveDays: 7 };
    case 'balance': return { minBalance: 1 };
    case 'recent': {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return { registrationDateRange: { from: thirtyDaysAgo, to: new Date() } };
    }
    default: return {};
  }
}

export function getTargetDescription(target: string): string {
  const descriptions: Record<string, string> = {
    all: 'All Users',
    active: 'Active Users (7 days)',
    balance: 'Users with $1+ balance',
    recent: 'Recent Users (30 days)',
    specific: 'Specific Users',
  };
  return descriptions[target] || target;
}

export function parseScheduleInput(input: string): Date {
  const now = new Date();
  const lower = input.toLowerCase().trim();

  // Check for "in X [units]" format
  const relativeMatch = lower.match(/^in\s+(\d+)\s+(second|minute|hour|day)s?$/);
  if (relativeMatch) {
    const value = parseInt(relativeMatch[1]);
    const unit = relativeMatch[2];
    const ms = { second: 1000, minute: 60000, hour: 3600000, day: 86400000 }[unit];
    if (ms) return new Date(now.getTime() + value * ms);
  }

  // Check for "tomorrow HH:MM"
  const tomorrowMatch = lower.match(/^tomorrow\s+(\d{1,2}):(\d{2})$/);
  if (tomorrowMatch) {
    const hour = parseInt(tomorrowMatch[1]);
    const minute = parseInt(tomorrowMatch[2]);
    const date = new Date(now);
    date.setDate(date.getDate() + 1);
    date.setHours(hour, minute, 0, 0);
    if (date <= now) throw new Error('Time must be in the future');
    return date;
  }

  // Absolute format: YYYY-MM-DD HH:MM
  const absoluteMatch = input.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})$/);
  if (absoluteMatch) {
    const year = parseInt(absoluteMatch[1]);
    const month = parseInt(absoluteMatch[2]) - 1;
    const day = parseInt(absoluteMatch[3]);
    const hour = parseInt(absoluteMatch[4]);
    const minute = parseInt(absoluteMatch[5]);
    const date = new Date(year, month, day, hour, minute, 0, 0);
    if (isNaN(date.getTime())) throw new Error('Invalid date');
    if (date <= now) throw new Error('Date must be in the future');
    return date;
  }

  throw new Error('Unrecognized format. Use "YYYY-MM-DD HH:MM", "in X hours", or "tomorrow 10:30"');
}
export class BroadcastHandler {
  public broadcastService: BroadcastService;

  constructor(botApi: any) {
    this.broadcastService = new BroadcastService(botApi);
  }

  // ==================== DASHBOARD ====================
  async showBroadcastDashboard(ctx: CallbackQueryContext<Context>): Promise<void> {
  await ctx.answerCallbackQuery();
  const userId = sanitizeInput(ctx.from!.id);
  const user = await User.findOne({ telegramId: parseInt(userId) });
  if (!user?.isAdmin) {
    await ctx.editMessageText?.('❌ Admin access required.');
    return;
  }

  const stats = await this.broadcastService.getBroadcastStats('week');
  // CHANGED: Using HTML tags <b> instead of *
  const message = `<b>📢 Enhanced Broadcast System</b>\n\n` +
    `<b>📊 Statistics (Last 7 days):</b>\n` +
    `• Total Broadcasts: ${stats.total}\n` +
    `• Completed: ${stats.completed}\n` +
    `• Success Rate: ${stats.successRate.toFixed(1)}%\n\n` +
    `<b>🎯 Available Features:</b>\n` +
    `✅ Multi-channel (Bot & Channel)\n` +
    `✅ Advanced user targeting\n` +
    `✅ Scheduled broadcasts\n` +
    `✅ Rich media support\n` +
    `✅ Template system\n\n` +
    `Select an option:`;

  const keyboard = new InlineKeyboard()
    .text('📝 New Broadcast', 'broadcast_new')
    .text('📅 Scheduled', 'broadcast_scheduled')
    .row()
    .text('📋 Templates', 'broadcast_templates')
    .text('📊 Statistics', 'broadcast_stats')
    .row()
    .text('🔙 Back to Admin', 'admin_menu');

  await ctx.editMessageText(message, {
    parse_mode: 'HTML', // CHANGED to HTML
    reply_markup: keyboard,
  });
}

  // ==================== NEW BROADCAST WIZARD ====================
  async startNewBroadcast(ctx: CallbackQueryContext<Context>): Promise<void> {
    await ctx.answerCallbackQuery();

    const templates = await this.broadcastService.getTemplates();
    const keyboard = new InlineKeyboard();

    for (const tpl of templates) {
      keyboard.text(tpl.name, `broadcast_template_${tpl._id}`).row();
    }
    keyboard
      .text('✏️ Custom Broadcast', 'broadcast_custom')
      .row()
      .text('🔙 Back to Broadcast', 'admin_broadcast');

    await ctx.editMessageText(
      `📝 *New Broadcast*\n\nChoose a template or create custom:`,
      {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      }
    );
  }

  async useTemplate(ctx: CallbackQueryContext<Context>, templateId: string): Promise<void> {
    await ctx.answerCallbackQuery();
    const safeId = sanitizeInput(templateId);
    const template = await this.broadcastService.getTemplate(safeId);
    if (!template) {
      await ctx.editMessageText?.('❌ Template not found.');
      return;
    }

    // Store only essential data in session
    const broadcastData: BroadcastSessionData = {
      templateId: template._id.toString(),
      title: template.title,
      content: template.content,
      type: template.type,
      target: template.target,
      channels: template.channels, // already normalized
      step: 'target_selection',
    };
    ctx.session.broadcastData = broadcastData;

    const message =
      `📋 *Template Selected*\n\n` +
      `*Title:* ${template.title}\n` +
      `*Type:* ${template.type}\n\n` +
      `*Preview:*\n${template.content.substring(0, 200)}...\n\n` +
      `Now select target audience:`;

    const keyboard = new InlineKeyboard()
      .text('👥 All Users', `broadcast_target_all_${template._id}`)
      .text('✅ Active Users', `broadcast_target_active_${template._id}`)
      .row()
      .text('🤑 With Balance', `broadcast_target_balance_${template._id}`)
      .text('🆕 Recent Users', `broadcast_target_recent_${template._id}`)
      .row()
      .text('🔙 Choose Different', 'broadcast_new')
      .text('❌ Cancel', 'admin_broadcast');

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  }

  async selectTarget(
    ctx: CallbackQueryContext<Context>,
    target: string,
    templateId?: string
  ): Promise<void> {
    await ctx.answerCallbackQuery();
    const safeTarget = sanitizeInput(target);
    const safeTemplateId = templateId ? sanitizeInput(templateId) : undefined;

    let broadcastData = ctx.session.broadcastData as BroadcastSessionData | undefined;

    // If we have a template ID and no session data (maybe after a restart), load it
    if (safeTemplateId && !broadcastData) {
      const template = await this.broadcastService.getTemplate(safeTemplateId);
      if (template) {
        broadcastData = {
          templateId: template._id.toString(),
          title: template.title,
          content: template.content,
          type: template.type,
          target: safeTarget as any,
          channels: template.channels,
          step: 'target_selection',
        };
      }
    }

    if (!broadcastData) {
      await ctx.editMessageText?.('❌ Broadcast data not found. Please start over.');
      delete ctx.session.broadcastData;
      return;
    }

    broadcastData.target = safeTarget as any;
    broadcastData.step = 'channel_selection';
    ctx.session.broadcastData = broadcastData;

    const targetDescriptions: Record<string, string> = {
      all: '👥 *All Users* - Send to every registered user',
      active: '✅ *Active Users* - Users active in last 7 days',
      balance: '🤑 *With Balance* - Users with minimum balance',
      recent: '🆕 *Recent Users* - Users joined in last 30 days',
      specific: '🎯 *Specific Users* - Select users manually',
    };

    const message =
      `🎯 *Target Selected*\n\n` +
      `${targetDescriptions[safeTarget]}\n\n` +
      `Now select delivery channels:\n\n` +
      `🤖 *Bot Only* - Send via bot messages\n` +
      `📢 *Channel Only* - Post to our channel\n` +
      `📡 *Both* - Send to bot users and post to channel`;

    const keyboard = new InlineKeyboard()
      .text('🤖 Bot Only', `broadcast_channel_bot_${safeTarget}`)
      .text('📢 Channel Only', `broadcast_channel_channel_${safeTarget}`)
      .row()
      .text('📡 Both Channels', `broadcast_channel_both_${safeTarget}`)
      .row()
      .text('🔙 Change Target', 'broadcast_new')
      .text('❌ Cancel', 'admin_broadcast');

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  }

  async selectChannel(
    ctx: CallbackQueryContext<Context>,
    channel: string,
    target: string
  ): Promise<void> {
    await ctx.answerCallbackQuery();
    const safeChannel = sanitizeInput(channel);
    const safeTarget = sanitizeInput(target);

    const broadcastData = ctx.session.broadcastData as BroadcastSessionData | undefined;
    if (!broadcastData) {
      await ctx.editMessageText?.('❌ Broadcast data not found. Please start over.');
      return;
    }

    // Normalize channels
    let channels: ('bot' | 'channel')[];
    if (safeChannel === 'both') {
      channels = ['bot', 'channel'];
    } else {
      channels = [safeChannel as 'bot' | 'channel'];
    }
    broadcastData.channels = channels;
    broadcastData.step = 'confirmation';
    ctx.session.broadcastData = broadcastData;

    const channelDescriptions: Record<string, string> = {
      bot: '🤖 *Bot Only* - Will be sent as direct messages to users',
      channel: '📢 *Channel Only* - Will be posted to our announcement channel',
      both: '📡 *Both Channels* - Will be sent to users AND posted to channel',
    };

    const filter = this.createFilterFromTarget(safeTarget);
    const users = await this.broadcastService.getFilteredUsers(filter);
    const userCount = users.length;
    const channelUsername = getSettings().channelUsername?.replace('@', '') || 'ethio_bingo7';
    const botUsername = env.BOT_USERNAME?.replace('@', '') || 'ethio_bingoobot';

    const message =
      `<b>✅ Broadcast Configuration Complete</b>\n\n` +
      `<b>📝 Title:</b> ${broadcastData.title}\n` +
      `<b>🎯 Target:</b> ${this.getTargetDescription(safeTarget)} (${userCount} users)\n` +
      `<b>📡 Channel:</b> ${channelDescriptions[safeChannel]}\n` +
      `<b>⏰ Timing:</b> Send immediately\n\n` +
      `<b>Channel Info:</b>\n` +
      `• Bot: @${botUsername}\n` + // Underscores are safe in HTML
      `• Channel: @${channelUsername}\n\n` +
      `<b>Preview:</b>\n${broadcastData.content.substring(0, 150)}...\n\n` +
      `Ready to send?`;

    const keyboard = new InlineKeyboard()
      .text('🔷 Send Now', `broadcast_confirm_${safeTarget}_${safeChannel}`)
      .text('⏰ Schedule', `broadcast_schedule_${safeTarget}_${safeChannel}`)
      .row()
      .text('✏️ Edit Message', 'broadcast_custom')
      .row()
      .text('🔙 Start Over', 'broadcast_new')
      .text('❌ Cancel', 'admin_broadcast');

    await ctx.editMessageText(message, {
      parse_mode: 'HTML', // CHANGED to HTML
      reply_markup: keyboard,
    });
  }

async showBroadcastDetails(ctx: CallbackQueryContext<Context>, identifier: string): Promise<void> {
  await ctx.answerCallbackQuery();

  const { ScheduledBroadcast } = await import('../../../core/database/models/ScheduledBroadcast');
  const { AuditLog } = await import('../../../core/database/models/AuditLog');
  const mongoose = await import('mongoose');

  // Try to interpret identifier as timestamp (from send)
  const timestamp = parseInt(identifier);
  let broadcast: any = null;
  let source: string | null = null;

  if (!isNaN(timestamp)) {
    // Look for a broadcast sent around that time (±5 seconds)
    const start = new Date(timestamp - 5000);
    const end = new Date(timestamp + 5000);
    const auditLog = await AuditLog.findOne({
      action: 'BROADCAST_SENT',
      createdAt: { $gte: start, $lte: end }
    }).sort({ createdAt: -1 }).lean();
    if (auditLog) {
      broadcast = auditLog;
      source = 'audit';
    }
  } else {
    // It might be an ObjectId (for scheduled broadcasts)
    if (mongoose.Types.ObjectId.isValid(identifier)) {
      broadcast = await ScheduledBroadcast.findById(identifier).lean();
      source = 'scheduled';
    }
  }

  if (!broadcast) {
    await ctx.reply('❌ Broadcast details not found.');
    return;
  }

  const escapeHTML = (str: string) =>
    str.replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m] || m);

  let message = '';
  if (source === 'audit') {
    const details = broadcast.details || {};
    const stats = details.stats || {};
    message =
      `<b>📊 Broadcast Details</b>\n\n` +
      `<b>Title:</b> ${escapeHTML(details.messageTitle || 'N/A')}\n` +
      `<b>Type:</b> ${escapeHTML(details.type || 'N/A')}\n` +
      `<b>Target:</b> ${escapeHTML(details.target || 'N/A')}\n` +
      `<b>Channels:</b> ${(details.channels || []).join(', ') || 'N/A'}\n\n` +
      `<b>Delivery Stats:</b>\n` +
      `• Total Users: ${stats.totalUsers || 0}\n` +
      `• Sent: ${stats.sentCount || 0}\n` +
      `• Failed: ${stats.failedCount || 0}\n` +
      `• Success Rate: ${stats.successRate?.toFixed(1) || 0}%\n` +
      `• Time: ${new Date(broadcast.createdAt).toLocaleString()}`;
  } else {
    // Scheduled broadcast
    message =
      `<b>📅 Scheduled Broadcast</b>\n\n` +
      `<b>Title:</b> ${escapeHTML(broadcast.title)}\n` +
      `<b>Content:</b> ${escapeHTML(broadcast.content.substring(0, 200))}${broadcast.content.length > 200 ? '...' : ''}\n` +
      `<b>Type:</b> ${broadcast.type}\n` +
      `<b>Target:</b> ${broadcast.target}\n` +
      `<b>Channels:</b> ${broadcast.channels.join(', ')}\n` +
      `<b>Scheduled:</b> ${new Date(broadcast.scheduledTime).toLocaleString()}\n` +
      `<b>Status:</b> ${broadcast.status}\n` +
      (broadcast.completedAt ? `<b>Sent:</b> ${new Date(broadcast.completedAt).toLocaleString()}\n` : '') +
      (broadcast.sentCount ? `<b>Sent Count:</b> ${broadcast.sentCount}\n` : '') +
      (broadcast.failedCount ? `<b>Failed Count:</b> ${broadcast.failedCount}\n` : '');
  }

  await ctx.reply(message, { parse_mode: 'HTML' });
}

  async confirmAndSend(
    ctx: CallbackQueryContext<Context>,
    target: string,
    channel: string
  ): Promise<void> {
    await ctx.answerCallbackQuery({ text: 'Sending broadcast...' });

    const safeTarget = sanitizeInput(target);
    const safeChannel = sanitizeInput(channel);
    const broadcastData = ctx.session.broadcastData;
    if (!broadcastData) {
      await ctx.editMessageText?.('❌ Broadcast data not found.');
      return;
    }

    const userId = sanitizeInput(ctx.from!.id);
    const user = await User.findOne({ telegramId: parseInt(userId) });
    if (!user?.isAdmin) {
      await ctx.editMessageText?.('❌ Admin access required.');
      return;
    }

    // Prepare final BroadcastMessage (normalize channels)
    let channels: ('bot' | 'channel')[];
    if (safeChannel === 'both') {
      channels = ['bot', 'channel'];
    } else {
      channels = [safeChannel as 'bot' | 'channel'];
    }

    const message: BroadcastMessage = {
      title: broadcastData.title,
      content: broadcastData.content,
      type: broadcastData.type,
      target: safeTarget as any,
      channels,
    };

    const filter = this.createFilterFromTarget(safeTarget);

    try {
      const stats = await this.broadcastService.sendBroadcast(
        message,
        filter,
        user._id,
        parseInt(userId)
      );

      const successRate = stats.successRate.toFixed(1);
      const timeTaken = stats.deliveryTime.toFixed(1);

      const resultMsg =
      `<b>✅ Broadcast Sent Successfully!</b>\n\n` +
      `<b>📊 Delivery Statistics:</b>\n` +
      `• Total Users: ${stats.totalUsers}\n` +
      `• Successfully Sent: ${stats.sentCount}\n` +
      `• Failed: ${stats.failedCount}\n` +
      `• Success Rate: ${successRate}%\n` +
      `• Time Taken: ${timeTaken} seconds\n\n` +
      `<b>🎯 Target:</b> ${this.getTargetDescription(safeTarget)}\n` +
      `<b>📡 Channels:</b> ${message.channels.join(', ')}\n\n` +
      `✅ Broadcast completed at ${new Date().toLocaleTimeString()}`;

      const keyboard = new InlineKeyboard()
        .text('📊 View Details', `broadcast_details_${Date.now()}`)
        .row()
        .text('📝 New Broadcast', 'broadcast_new')
        .text('🔙 Dashboard', 'admin_broadcast');

      await ctx.editMessageText(resultMsg, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });

      delete ctx.session.broadcastData;
    } catch (error: any) {
      logger.error('Broadcast failed:', error);
      // Simple helper to escape HTML
      const escapeHTML = (str: string) => str.replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m] || m);
      
      await ctx.editMessageText?.(
        `<b>❌ Broadcast Failed</b>\n\n` +
        `Error: ${escapeHTML(error.message)}\n\n` + // Escaped for HTML
        `Please try again or contact support.`,
        {
          parse_mode: 'HTML', // CHANGED to HTML
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔄 Try Again', callback_data: 'broadcast_new' }],
              [{ text: '🔙 Dashboard', callback_data: 'admin_broadcast' }],
            ],
          },
        }
      );
    }
  }

  // ==================== SCHEDULED BROADCASTS ====================

  async handleSchedule(ctx: CallbackQueryContext<Context>, target: string, channel: string): Promise<void> {
  await ctx.answerCallbackQuery();
  const broadcastData = ctx.session.broadcastData;
  if (!broadcastData) {
    await ctx.editMessageText?.('❌ Broadcast data not found. Please start over.');
    return;
  }

  // Store target and channel for later use
  ctx.session.pendingSchedule = { target, channel };
  await ctx.editMessageText?.(
    `⏰ *Schedule Broadcast*\n\n` +
    `Please enter the date and time when you want this broadcast to be sent.\n\n` +
    `Format: \`YYYY-MM-DD HH:MM\` (24-hour format)\n` +
    `Example: \`2026-03-25 14:30\`\n\n` +
    `Or use relative time: \`in 2 hours\`, \`tomorrow 10am\`\n\n` +
    `Send "cancel" to cancel.`,
    { parse_mode: 'Markdown' }
  );
  ctx.session.step = 'awaiting_schedule_time';
}

  async showScheduledBroadcasts(ctx: CallbackQueryContext<Context>): Promise<void> {
    await ctx.answerCallbackQuery();
    const userId = sanitizeInput(ctx.from!.id);
    const user = await User.findOne({ telegramId: parseInt(userId) });
    if (!user?.isAdmin) {
      await ctx.editMessageText?.('❌ Admin access required.');
      return;
    }

    const { ScheduledBroadcast } = await import('../../../core/database/models/ScheduledBroadcast');
    const scheduled = await ScheduledBroadcast.find({ status: 'scheduled' })
      .populate('createdBy', 'username telegramId')
      .sort({ scheduledTime: 1 })
      .limit(10)
      .lean();

    let message = `📅 *Scheduled Broadcasts*\n\n`;
    if (scheduled.length === 0) {
      message += 'No scheduled broadcasts found.';
    } else {
      message += `Found ${scheduled.length} scheduled broadcasts:\n\n`;
      scheduled.forEach((bc, idx) => {
        const timeLeft = this.getTimeUntil(bc.scheduledTime);
        const createdBy = bc.createdBy as any;
        message += `${idx + 1}. *${bc.title}*\n`;
        message += `   🎯 Target: ${bc.target}\n`;
        message += `   📡 Channels: ${bc.channels.join(', ')}\n`;
        message += `   ⏰ Scheduled: ${bc.scheduledTime.toLocaleString()}\n`;
        message += `   ⏳ Time Left: ${timeLeft}\n`;
        message += `   👤 By: ${createdBy?.username ? `@${createdBy.username}` : `User ${createdBy?.telegramId}`}\n\n`;
      });
    }

    const keyboard = new InlineKeyboard();
    if (scheduled.length > 0) {
      for (const bc of scheduled) {
        const safeId = sanitizeInput(bc._id.toString());
        keyboard.text(`❌ Cancel "${bc.title.substring(0, 15)}..."`, `broadcast_cancel_${safeId}`).row();
      }
    }
    keyboard
      .text('🔄 Refresh', 'broadcast_scheduled')
      .text('📝 Schedule New', 'broadcast_schedule_new')
      .row()
      .text('🔙 Dashboard', 'admin_broadcast');

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  }

  async cancelScheduledBroadcast(ctx: CallbackQueryContext<Context>, broadcastId: string): Promise<void> {
    await ctx.answerCallbackQuery({ text: 'Cancelling...' });
    const safeId = sanitizeInput(broadcastId);
    try {
      const success = await this.broadcastService.cancelScheduledBroadcast(safeId);
      if (success) {
        await ctx.editMessageText?.(
          '✅ *Broadcast Cancelled*\n\n' +
          'The scheduled broadcast has been cancelled successfully.',
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '📅 View Scheduled', callback_data: 'broadcast_scheduled' }],
                [{ text: '🔙 Dashboard', callback_data: 'admin_broadcast' }],
              ],
            },
          }
        );
      } else {
        await ctx.editMessageText?.('❌ Failed to cancel broadcast. It may have already been sent.');
      }
    } catch (error: any) {
      logger.error('Cancel broadcast error:', error);
      await ctx.editMessageText?.(`❌ Error: ${error.message}`);
    }
  }

  // ==================== TEMPLATES (list) ====================
  async showBroadcastTemplates(ctx: CallbackQueryContext<Context>): Promise<void> {
    await ctx.answerCallbackQuery();
    const userId = sanitizeInput(ctx.from!.id);
    const user = await User.findOne({ telegramId: parseInt(userId) });
    if (!user?.isAdmin) {
      await ctx.editMessageText?.('❌ Admin access required.');
      return;
    }

    const templates = await this.broadcastService.getTemplates();
    let message = `📋 *Broadcast Templates*\n\n`;
    if (templates.length === 0) {
      message += 'No templates found. Create one from the broadcast form.';
    } else {
      message += `Found ${templates.length} templates:\n\n`;
      for (const tpl of templates) {
        message += `*${tpl.name}*\n`;
        message += `Type: ${tpl.type} | Target: ${tpl.target}\n`;
        message += `Preview: ${tpl.content.substring(0, 80)}...\n\n`;
      }
    }

    const keyboard = new InlineKeyboard()
      .text('✏️ Custom Message', 'broadcast_custom')
      .row()
      .text('🔙 Dashboard', 'admin_broadcast');

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  }

  // ==================== STATISTICS ====================
  async showBroadcastStats(ctx: CallbackQueryContext<Context>): Promise<void> {
    await ctx.answerCallbackQuery();
    const userId = sanitizeInput(ctx.from!.id);
    const user = await User.findOne({ telegramId: parseInt(userId) });
    if (!user?.isAdmin) {
      await ctx.editMessageText?.('❌ Admin access required.');
      return;
    }

    const stats = await this.broadcastService.getBroadcastStats('month');
    let msg = `📊 *Broadcast Statistics*\n\n` +
      `*Monthly Overview:*\n` +
      `• Total Broadcasts: ${stats.total}\n` +
      `• Completed: ${stats.completed}\n` +
      `• Success Rate: ${stats.successRate.toFixed(1)}%\n\n` +
      `*Breakdown by Type:*\n`;
    if (stats.breakdown && Array.isArray(stats.breakdown)) {
      for (const item of stats.breakdown) {
        msg += `• ${item._id}: ${item.count} broadcasts\n`;
      }
    }

    const keyboard = new InlineKeyboard()
      .text('📈 Weekly Stats', 'broadcast_stats_week')
      .text('📊 Monthly Stats', 'broadcast_stats_month')
      .row()
      .text('🔄 Refresh', 'broadcast_stats')
      .text('🔙 Dashboard', 'admin_broadcast');

    await ctx.editMessageText(msg, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  }

  // ==================== CUSTOM BROADCAST INPUT ====================
  async handleCustomBroadcastInput(ctx: CallbackQueryContext<Context>): Promise<void> {
    await ctx.answerCallbackQuery();
    const instructions = `✏️ *Custom Broadcast Message*\n\n` +
      `Send your message in one of these formats:\n\n` +
      `*Format 1 (Recommended):*\n` +
      `\`Title: Your Title Here\`\n` +
      `\`Content: Your message content here...\`\n\n` +
      `*Format 2 (Simple):*\n` +
      `\`Your Title Here\`\n` +
      `\`Your message content here...\`\n\n` +
      `*Examples:*\n` +
      `Title: 🎉 Special Offer!\n` +
      `Content: Get 10% bonus on all tasks!\n\n` +
      `Or simply:\n` +
      `🎉 Special Offer!\n` +
      `Get 10% bonus on all tasks!`;

    await ctx.editMessageText(instructions, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📋 View Templates', callback_data: 'broadcast_templates' }],
          [{ text: '🔙 Back to Dashboard', callback_data: 'admin_broadcast' }],
        ],
      },
    });

    ctx.session.step = 'awaiting_custom_broadcast';
  }

  // ==================== HELPERS ====================
  private createFilterFromTarget(target: string): BroadcastFilter {
    switch (target) {
      case 'active':
        return { lastActiveDays: 7 };
      case 'balance':
        return { minBalance: 1 };
      case 'recent':
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return { registrationDateRange: { from: thirtyDaysAgo, to: new Date() } };
      default:
        return {};
    }
  }

  private getTargetDescription(target: string): string {
    const descriptions: Record<string, string> = {
      all: 'All Users',
      active: 'Active Users (7 days)',
      balance: 'Users with $1+ balance',
      recent: 'Recent Users (30 days)',
      specific: 'Specific Users',
    };
    return descriptions[target] || target;
  }

  private getTimeUntil(date: Date): string {
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    if (diff <= 0) return 'Now';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days} day${days !== 1 ? 's' : ''}`;
    } else if (hours > 0) {
      return `${hours} hour${hours !== 1 ? 's' : ''} ${minutes} minute${minutes !== 1 ? 's' : ''}`;
    } else {
      return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }
  }
}

// Singleton instance
let broadcastHandler: BroadcastHandler;

export function getBroadcastHandler(botApi?: any): BroadcastHandler {
  if (!broadcastHandler && botApi) {
    broadcastHandler = new BroadcastHandler(botApi);
  }
  return broadcastHandler;
}

// Exported callback handlers (used in index.ts)
export async function handleBroadcastDashboard(ctx: CallbackQueryContext<Context>) {
  const handler = getBroadcastHandler(ctx.api);
  await handler.showBroadcastDashboard(ctx);
}
export async function handleNewBroadcast(ctx: CallbackQueryContext<Context>) {
  const handler = getBroadcastHandler(ctx.api);
  await handler.startNewBroadcast(ctx);
}
export async function handleBroadcastTemplate(ctx: CallbackQueryContext<Context>, templateId: string) {
  const handler = getBroadcastHandler(ctx.api);
  await handler.useTemplate(ctx, templateId);
}
export async function handleBroadcastTarget(ctx: CallbackQueryContext<Context>, target: string, templateId?: string) {
  const handler = getBroadcastHandler(ctx.api);
  await handler.selectTarget(ctx, target, templateId);
}
export async function handleBroadcastChannel(ctx: CallbackQueryContext<Context>, channel: string, target: string) {
  const handler = getBroadcastHandler(ctx.api);
  await handler.selectChannel(ctx, channel, target);
}
export async function handleBroadcastConfirm(ctx: CallbackQueryContext<Context>, target: string, channel: string) {
  const handler = getBroadcastHandler(ctx.api);
  await handler.confirmAndSend(ctx, target, channel);
}
export async function handleScheduledBroadcasts(ctx: CallbackQueryContext<Context>) {
  const handler = getBroadcastHandler(ctx.api);
  await handler.showScheduledBroadcasts(ctx);
}
export async function handleCancelBroadcast(ctx: CallbackQueryContext<Context>, broadcastId: string) {
  const handler = getBroadcastHandler(ctx.api);
  await handler.cancelScheduledBroadcast(ctx, broadcastId);
}
export async function handleBroadcastTemplates(ctx: CallbackQueryContext<Context>) {
  const handler = getBroadcastHandler(ctx.api);
  await handler.showBroadcastTemplates(ctx);
}
export async function handleBroadcastStats(ctx: CallbackQueryContext<Context>) {
  const handler = getBroadcastHandler(ctx.api);
  await handler.showBroadcastStats(ctx);
}
export async function handleBroadcastDetails(ctx: CallbackQueryContext<Context>, identifier: string) {
  const handler = getBroadcastHandler(ctx.api);
  await handler.showBroadcastDetails(ctx, identifier);
}