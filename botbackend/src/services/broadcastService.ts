// src/services/broadcastService.ts
import { User } from '../core/database/models/User';
import { logger } from '../core/utils/logger';
import { auditService } from './auditService';
import { NotificationService } from './notificationService';
import { env } from '../core/config/env';
import { Api, InputFile } from 'grammy';
import mongoose from 'mongoose';
import { BroadcastTemplate, IBroadcastTemplate, BroadcastTemplateCreateInput } from '../core/database/models/BroadcastTemplate';
import { getSettings } from '@/core/utils/settingsCache';
import sharp from 'sharp';
export interface BroadcastMessage {
  title: string;
  content: string;
  type: 'announcement' | 'promotion' | 'update' | 'alert' | 'educational';
  target: 'all' | 'active' | 'balance' | 'recent';
  channels: ('bot' | 'channel')[];
  imageUrl?: string;
  buttons?: Array<{
    text: string;
    url?: string;
    callback_data?: string;
  }>;
  schedule?: Date;
  metadata?: any;
}

export interface BroadcastStats {
  totalUsers: number;
  sentCount: number;
  failedCount: number;
  successRate: number;
  startTime: Date;
  endTime: Date;
  deliveryTime: number;
}

export interface BroadcastFilter {
  minBalance?: number;
  lastActiveDays?: number;
  registrationDateRange?: {
    from: Date;
    to: Date;
  };
  specificUsers?: number[];
}

export class BroadcastService {
  private notificationService: NotificationService;
  private botApi?: Api;
  private botInitPromise: Promise<void> | null = null;

  constructor(botApi?: Api) {
    this.notificationService = new NotificationService();
    if (botApi) {
      this.botApi = botApi;
    } else {
      // Lazy load bot instance on first use
      this.ensureBotApi();
    }
  }

  private async ensureBotApi(): Promise<void> {
    if (this.botApi) return;
    if (this.botInitPromise) return this.botInitPromise;

    this.botInitPromise = (async () => {
      try {
        const { getBotInstance } = await import('../bot/framework');
        const bot = getBotInstance();
        this.botApi = bot.api;
        logger.info('✅ Broadcast service connected to bot API');
      } catch (error) {
        logger.error('❌ Failed to get bot instance for broadcast:', error);
        throw new Error('Bot API not available');
      }
    })();
    return this.botInitPromise;
  }

  // ==================== TEMPLATE MANAGEMENT ====================

  async getTemplates(): Promise<IBroadcastTemplate[]> {
    const docs = await BroadcastTemplate.find({ isActive: true }).sort({ createdAt: -1 }).lean();
    return docs as unknown as IBroadcastTemplate[];
  }

  async getTemplate(id: string): Promise<IBroadcastTemplate | null> {
    const doc = await BroadcastTemplate.findById(id).lean();
    return doc as unknown as IBroadcastTemplate | null;
  }

  async createTemplate(data: BroadcastTemplateCreateInput, userId: mongoose.Types.ObjectId): Promise<IBroadcastTemplate> {
    const template = new BroadcastTemplate({
      ...data,
      createdBy: userId
    });
    await template.save();
    return template;
  }

  async updateTemplate(id: string, data: Partial<BroadcastTemplateCreateInput>): Promise<IBroadcastTemplate | null> {
    const doc = await BroadcastTemplate.findByIdAndUpdate(id, data, { new: true }).lean();
    return doc as unknown as IBroadcastTemplate | null;
  }

  async deleteTemplate(id: string): Promise<boolean> {
    const result = await BroadcastTemplate.findByIdAndDelete(id);
    return !!result;
  }

  // ==================== BROADCAST SENDING ====================

async sendBroadcast(
  message: BroadcastMessage,
  filters?: BroadcastFilter,
  adminId?: mongoose.Types.ObjectId,
  adminTelegramId?: number,
  imageBase64?: string   // <-- new parameter
): Promise<BroadcastStats> {
  await this.ensureBotApi();

  let normalizedChannels = message.channels;
  if (normalizedChannels.includes('both' as any)) {
    normalizedChannels = ['bot', 'channel'];
  }

  const startTime = new Date();
  let sentCount = 0;
  let failedCount = 0;

  try {
    const users = await this.getFilteredUsers(filters);
    const formattedMessages = this.formatMessageForChannels(message);
    const photoBuffer = imageBase64 ? Buffer.from(imageBase64.split(',')[1], 'base64') : undefined;

    // Send to bot users
    if (normalizedChannels.includes('bot')) {
      const botResults = await this.sendToBotUsers(users, formattedMessages.bot, photoBuffer);
      sentCount += botResults.sentCount;
      failedCount += botResults.failedCount;
    }

    // Send to channel
    if (normalizedChannels.includes('channel') && this.botApi) {
      try {
        await this.sendToChannel(formattedMessages.channel, photoBuffer);
      } catch (chanErr) {
        logger.error('Channel send failed:', chanErr);
      }
    }

    const endTime = new Date();
    const deliveryTime = (endTime.getTime() - startTime.getTime()) / 1000;
    const stats: BroadcastStats = {
      totalUsers: users.length,
      sentCount,
      failedCount,
      successRate: users.length > 0 ? (sentCount / users.length) * 100 : 0,
      startTime,
      endTime,
      deliveryTime
    };

    if (adminId && adminTelegramId) {
      await auditService.logAdminAction(
        adminId,
        adminTelegramId,
        'BROADCAST_SENT',
        'SYSTEM',
        'Broadcast',
        undefined,
        {
          messageTitle: message.title,
          type: message.type,
          target: message.target,
          channels: normalizedChannels,
          stats,
          filters,
          hadImage: !!photoBuffer
        }
      );
    }

    logger.info(`Broadcast completed: ${sentCount} success, ${failedCount} failed in ${deliveryTime}s`);
    return stats;

  } catch (error) {
    logger.error('Critical broadcast failure:', error);
    throw error;
  }
}



  async getFilteredUsers(filters?: BroadcastFilter): Promise<any[]> {
  const query: any = {
    isBanned: false,
    telegramId: { $ne: 0 }, // exclude placeholder admin
    lastLoginAt: { $exists: true, $ne: null }, // only users who started the bot
  };

  if (filters?.minBalance) {
    query.balanceMain = { $gte: filters.minBalance };
  }
  if (filters?.lastActiveDays) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - filters.lastActiveDays);
    query.lastLoginAt = { $gte: cutoff };
  }
  if (filters?.registrationDateRange) {
    query.createdAt = {
      $gte: filters.registrationDateRange.from,
      $lte: filters.registrationDateRange.to,
    };
  }
  if (filters?.specificUsers && filters.specificUsers.length > 0) {
    query.telegramId = { $in: filters.specificUsers };
  }

  return await User.find(query).select('telegramId username firstName').lean();
}

 private formatMessageForChannels(message: BroadcastMessage): {
  bot: string;
  channel: { text: string; parse_mode: 'HTML'; reply_markup?: any };
} {
  const botUsername = (env.BOT_USERNAME || 'ethio_bingoobot').replace('@', '');
  const supportUsername = (getSettings().supportUsername || 'Ethiobingosupport2').replace('@', '');

  // Helper to escape HTML special chars
  const escapeHTML = (str: string) => 
    str.replace(/[&<>"']/g, (m) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[m] || m);

  const title = `<b>📢 ${escapeHTML(message.title)}</b>\n\n`;
  const content = escapeHTML(message.content) + '\n\n';

  const botMessage = title + content + 
    `📢 <b>Stay Connected</b>\n` +
    `• Bot: @${botUsername}\n` +
    `• Support: @${supportUsername}`;

  const channelMessage = title + content + 
    `🤖 <b>Bot:</b> @${botUsername}\n` +
    `📞 <b>Support:</b> @${supportUsername}\n\n` +
    `Join our bot to start earning!`;

  const inline_keyboard: any[][] = [];
inline_keyboard.push([{ text: '❇️ Play Now', url: `https://t.me/${botUsername}?start=start` }]); // Changed from ?start=start
inline_keyboard.push([{ text: '🆘 Contact Support', url: `https://t.me/${supportUsername}` }]);

return {
  bot: botMessage,
  channel: {
    text: channelMessage,
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard },
  },
};
}

// sendToBotUsers with compression
private async sendToBotUsers(users: any[], htmlMessage: string, photoBuffer?: Buffer): Promise<{ sentCount: number; failedCount: number }> {
  if (!this.botApi) throw new Error('Bot API not available');
  let sentCount = 0;
  let failedCount = 0;
  const botUsername = (env.BOT_USERNAME || 'ethio_bingoobot').replace('@', '');

  let compressedBuffer: Buffer | undefined;
  if (photoBuffer) {
    try {
      // Compress and resize image to max 1280x1280, quality 80%, JPEG format
      compressedBuffer = await sharp(photoBuffer)
        .resize(1280, 1280, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();
      logger.info(`Image compressed from ${photoBuffer.length} to ${compressedBuffer.length} bytes`);
    } catch (err) {
      logger.error('Image compression failed, using original:', err);
      compressedBuffer = photoBuffer;
    }
  }

  for (const user of users) {
    try {
      if (compressedBuffer) {
        await this.botApi.sendPhoto(user.telegramId, new InputFile(compressedBuffer), {
          caption: htmlMessage,
          parse_mode: 'HTML'
        });
        // Send a separate message with Play button
        await this.botApi.sendMessage(user.telegramId, '❇️ Tap to Play', {
          reply_markup: {
            inline_keyboard: [[{ text: '❇️ Play Now', url: `https://t.me/${botUsername}?start=start` }]]
          }
        });
      } else {
        await this.botApi.sendMessage(user.telegramId, htmlMessage, { parse_mode: 'HTML' });
      }
      sentCount++;
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error: any) {
      failedCount++;
      logger.error(`Failed to send to ${user.telegramId}: ${error.message}`);
    }
  }
  return { sentCount, failedCount };
}

// Replace sendToChannel with compression
private async sendToChannel(messageData: { text: string; parse_mode: 'HTML'; reply_markup?: any }, photoBuffer?: Buffer): Promise<void> {
  if (!this.botApi) throw new Error('Bot API not available');

  const settings = getSettings();
  let channelUsername = settings.channelUsername;
  if (!channelUsername) {
    logger.error('Channel username not configured');
    throw new Error('Channel username not configured');
  }
  channelUsername = channelUsername.replace('@', '');

  let compressedBuffer: Buffer | undefined;
  if (photoBuffer) {
    try {
      compressedBuffer = await sharp(photoBuffer)
        .resize(1280, 1280, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();
      logger.info(`Channel image compressed from ${photoBuffer.length} to ${compressedBuffer.length} bytes`);
    } catch (err) {
      logger.error('Channel image compression failed, using original:', err);
      compressedBuffer = photoBuffer;
    }
  }

  try {
    if (compressedBuffer) {
      await this.botApi.sendPhoto(`@${channelUsername}`, new InputFile(compressedBuffer), {
        caption: messageData.text,
        parse_mode: 'HTML'
      });
    } else {
      await this.botApi.sendMessage(`@${channelUsername}`, messageData.text, {
        parse_mode: 'HTML',
        reply_markup: messageData.reply_markup
      });
    }
    logger.info(`Broadcast posted to channel @${channelUsername}`);
  } catch (error: any) {
    logger.error(`Failed to send to channel @${channelUsername}: ${error.message}`);
    if (error.response?.body?.description?.includes('not enough rights')) {
      logger.error('Bot is not an admin of the channel or lacks post permissions.');
    }
    throw error;
  }
}


  /**
   * Schedule a broadcast
   */
  async scheduleBroadcast(
    message: BroadcastMessage,
    scheduleTime: Date,
    filters?: BroadcastFilter,
    adminId?: mongoose.Types.ObjectId,
    adminTelegramId?: number
  ): Promise<string> {
    // Store scheduled broadcast in database
    const { ScheduledBroadcast } = await import('../core/database/models/ScheduledBroadcast');
    
    const scheduledBroadcast = new ScheduledBroadcast({
      title: message.title,
      content: message.content,
      type: message.type,
      target: message.target,
      channels: message.channels,
      filters: filters || {},
      scheduledTime: scheduleTime,
      createdBy: adminId,
      status: 'scheduled',
      metadata: message.metadata
    });

    await scheduledBroadcast.save();

    // Schedule in the system scheduler
    const { scheduler } = await import('../core/utils/scheduler');
    const jobId = `broadcast_${scheduledBroadcast._id}`;
    
    scheduler.scheduleOnce(
      jobId,
      scheduleTime,
      async () => {
        try {
          await this.sendBroadcast(message, filters, adminId, adminTelegramId);
          
          // Update status
          scheduledBroadcast.status = 'completed';
          scheduledBroadcast.completedAt = new Date();
          await scheduledBroadcast.save();
          
        } catch (error) {
          scheduledBroadcast.status = 'failed';
          scheduledBroadcast.error = error.message;
          await scheduledBroadcast.save();
          logger.error(`Scheduled broadcast failed: ${error.message}`);
        }
      }
    );

    return jobId;
  }
async processPendingScheduledBroadcasts(): Promise<void> {
  const { ScheduledBroadcast } = await import('../core/database/models/ScheduledBroadcast');
  const now = new Date();
  const pending = await ScheduledBroadcast.find({
    status: 'scheduled',
    scheduledTime: { $lte: now }
  });

  for (const bc of pending) {
    bc.status = 'processing';
    await bc.save();

    try {
      // Map 'specific' to 'all' because filters already handle specific users
      let target = bc.target;
      if (target === 'specific') target = 'all';

      const message: BroadcastMessage = {
        title: bc.title,
        content: bc.content,
        type: bc.type,
        target: target as any,
        channels: bc.channels.filter(c => c !== 'both') as any
      };
      const filters = bc.filters;
      const stats = await this.sendBroadcast(message, filters, bc.createdBy);
      bc.sentCount = stats.sentCount;
      bc.failedCount = stats.failedCount;
      bc.successRate = stats.successRate;
      bc.status = 'completed';
      bc.completedAt = new Date();
    } catch (error: any) {
      bc.status = 'failed';
      bc.error = error.message;
    }
    await bc.save();
  }
}
  /**
 * Get broadcast statistics for the last week or month
 */
async getBroadcastStats(timeframe: 'today' | 'week' | 'month' = 'week'): Promise<any> {
  const { ScheduledBroadcast } = await import('../core/database/models/ScheduledBroadcast');
  const { AuditLog } = await import('../core/database/models/AuditLog');
  
  let startDate = new Date();
  switch (timeframe) {
    case 'today':
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'week':
      startDate.setDate(startDate.getDate() - 7);
      break;
    case 'month':
      startDate.setMonth(startDate.getMonth() - 1);
      break;
  }

  // Count completed broadcasts from ScheduledBroadcast
  const total = await ScheduledBroadcast.countDocuments({
    createdAt: { $gte: startDate },
    status: { $in: ['completed', 'failed'] }
  });

  const completed = await ScheduledBroadcast.countDocuments({
    createdAt: { $gte: startDate },
    status: 'completed'
  });

  // Calculate success rate based on actual messages sent (from AuditLog)
  const logs = await AuditLog.find({
    action: 'BROADCAST_SENT',
    createdAt: { $gte: startDate }
  });

  let totalSent = 0;
  let totalFailed = 0;
  let totalUsers = 0;

  logs.forEach(log => {
    const meta = log.details;
    if (meta?.stats) {
      totalSent += meta.stats.sentCount || 0;
      totalFailed += meta.stats.failedCount || 0;
      totalUsers += meta.stats.totalUsers || 0;
    }
  });

  const successRate = totalUsers > 0 ? (totalSent / totalUsers) * 100 : 0;

  // Simple breakdown by type (from ScheduledBroadcast)
  const breakdown = await ScheduledBroadcast.aggregate([
    { $match: { createdAt: { $gte: startDate } } },
    { $group: { _id: '$type', count: { $sum: 1 } } }
  ]);

  return {
    total,
    completed,
    successRate,
    breakdown,
    timeframe,
    details: { totalSent, totalFailed, totalUsers }
  };
}

  /**
   * Cancel scheduled broadcast
   */
  async cancelScheduledBroadcast(broadcastId: string): Promise<boolean> {
    const { scheduler } = await import('../core/utils/scheduler');
    const { ScheduledBroadcast } = await import('../core/database/models/ScheduledBroadcast');
    
    // Cancel in scheduler
    const cancelled = scheduler.cancel(`broadcast_${broadcastId}`);
    
    if (cancelled) {
      // Update database
      await ScheduledBroadcast.findByIdAndUpdate(broadcastId, {
        status: 'cancelled',
        cancelledAt: new Date()
      });
      return true;
    }
    
    return false;
  }

}