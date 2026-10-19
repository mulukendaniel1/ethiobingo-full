// src/bot/handlers/callbacks/admin.ts
import { CallbackQueryContext, InlineKeyboard } from 'grammy';
import { Context } from '../../framework';
import { User } from '../../../core/database/models/User';
import { logger } from '../../../core/utils/logger';
import {  AdminService, NotificationService } from '@/services';
import { auditService } from '../../../services/auditService';
import { trackRestartRequest, markRestartCompleted } from '../../../core/utils/restartTracker';
import { cronScheduler } from '../../../cron';
import { escapeMarkdown, escapeCode } from '../../../core/utils/escapeMarkdown';
import { sanitizeInput } from '../../../core/utils/security';
import { KeyboardFactory } from '@/bot/framework/keyboards';
import { RestartService } from '@/services/restartService';
import { operatorService } from '@/services/operatorService';

export async function handleAdminStats(ctx: CallbackQueryContext<Context>) {
  await ctx.answerCallbackQuery();
  try {
    const userId = sanitizeInput(ctx.from!.id);
    const user = await User.findOne({ telegramId: parseInt(userId) });
    if (!user?.isAdmin) {
      await ctx.editMessageText?.('❌ Admin access required.');
      return;
    }
    
    // Get system stats
    const [totalUsers, activeUsers] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ lastLoginAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }),
      
    ]);
    

    const adminService = new AdminService();
    const stats = await adminService.getETBStats();
    
    let message = `📊 *System Statistics*\n\n`;

    // Add ETB stats if available
    if (stats.ETBStats) {
      message += `\n🏦 *ETB Coin System*\n` +
        `• Total Coins: ${stats.ETBStats.totalCoins.toFixed(2)} ETB\n` +
        `• Total Earned: ${stats.ETBStats.totalEarned.toFixed(2)} ETB\n` +
        `• Active Users: ${stats.ETBStats.activeUsers}\n` +
        `• Value: ${stats.ETBStats.etbValue.toFixed(2)} ETB / $${stats.ETBStats.usdValue.toFixed(2)}\n`;
    }
    
    await ctx.editMessageText?.(
      `📊 *System Statistics*\n\n` +
      `👥 *Users:*\n` +
      `• Total: ${totalUsers}\n` +
      `• Active (24h): ${activeUsers}\n` +
      `• Admins: ${await User.countDocuments({ isAdmin: true })}\n\n` +
      `⏰ *Last Updated:* ${new Date().toLocaleTimeString()}`,
      {
        parse_mode: 'Markdown' as const,
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔄 Refresh', callback_data: 'admin_stats' }],
            [{ text: '🔙 Back to Admin', callback_data: 'admin_menu' }]
          ]
        }
      }
    );
    
  } catch (error) {
    logger.error('Admin stats error:', error);
    await ctx.editMessageText?.('❌ Error loading statistics.');
  }
}


export async function handleAdminMenu(ctx: CallbackQueryContext<Context>) {
  await ctx.answerCallbackQuery();
  const operator = await operatorService.getOperator();
  const statusText = operator.isActive ? '✅ Active' : '⏸️ Paused';
  
  await ctx.editMessageText?.(
    `♦️ *Admin Dashboard*\n\n` +
    `Bot Status: ${statusText}\n\n` +
    `Select an option:`,
    {
      parse_mode: 'Markdown' as const,
      reply_markup: KeyboardFactory.adminMenu()
    }
  );
}

// Add user stats handler
export async function handleAdminUserStats(ctx: CallbackQueryContext<Context>) {
  await ctx.answerCallbackQuery();
  
  try {
    const userId = ctx.from!.id;
    const user = await User.findOne({ telegramId: userId });
    
    if (!user?.isAdmin) {
      await ctx.editMessageText?.('❌ Admin access required.');
      return;
    }
    
    const adminService = new AdminService();
    const userStats = await adminService.getUserStats();
    
    await ctx.editMessageText?.(
      `📊 *User Statistics*\n\n` +
      `👥 *Overview:*\n` +
      `• Total Users: ${userStats.totalUsers}\n` +
      `• Active Users: ${userStats.activeUsers}\n` +
      `• Banned Users: ${userStats.bannedUsers}\n` +
      `• Admin Users: ${userStats.adminUsers}\n\n` +
      `💼 *Activity:*\n` +
      `• Daily Signups: Calculating...\n` +
      `• Weekly Retention: Calculating...\n\n` +
      `🕒 *Last Updated:* ${new Date().toLocaleTimeString()}`,
      {
        parse_mode: 'Markdown' as const,
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔄 Refresh', callback_data: 'admin_user_stats' }],
            [{ text: '🔙 Back to Users', callback_data: 'admin_users' }]
          ]
        }
      }
    );
    
  } catch (error) {
    logger.error('Admin user stats error:', error);
  }
}

// Add user commands help
export async function handleAdminUserCommands(ctx: CallbackQueryContext<Context>) {
  await ctx.answerCallbackQuery();
  
  await ctx.editMessageText?.(
    '📋 *User Management Commands*\n\n' +
    '👤 *Basic Commands:*\n' +
    '• `/admin stats <user_id>` - View user statistics\n' +
    '• `/admin search <query>` - Search for users\n\n' +
    '⚖️ *Moderation Commands:*\n' +
    '• `/admin ban <user_id> <reason>` - Ban a user\n' +
    '• `/admin unban <user_id>` - Unban a user\n' +
    '• `/admin warn <user_id> <reason>` - Warn a user\n\n' +
    '🤑 *Financial Commands:*\n' +
    '• `/admin balance <user_id> <amount>` - Adjust balance\n' +
    '• `/admin payout <user_id>` - Force payout\n\n' +
    '📊 *Examples:*\n' +
    '• `/admin stats 123456789`\n' +
    '• `/admin ban 987654321 "Spamming"`\n' +
    '• `/admin search @username`',
    {
      parse_mode: 'Markdown' as const,
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔙 Back to Users', callback_data: 'admin_users' }],
          [{ text: '♦️ Admin Menu', callback_data: 'admin_menu' }]
        ]
      }
    }
  );
}

export async function handleAdminControls(ctx: CallbackQueryContext<Context>) {
  await ctx.answerCallbackQuery();
  
  try {
    const userId = ctx.from!.id;
    const user = await User.findOne({ telegramId: userId });
    
    if (!user?.isAdmin) {
      await ctx.editMessageText?.('❌ Admin access required.');
      return;
    }
    
    await ctx.editMessageText?.(
      '🔧 *Bot Controls*\n\n' +
      'Manage bot operations:',
      {
        parse_mode: 'Markdown' as const,
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔄 Restart server', callback_data: 'admin_restart' }],
            [{ text: '🗑️ Clear Cache', callback_data: 'admin_clear_cache' }],
            [{ text: '📜 Restart History', callback_data: 'admin_restart_history' }],
            [{ text: '🔙 Back to Admin', callback_data: 'admin_menu' }]
          ]
        }
      }
    );
    
  } catch (error) {
    logger.error('Admin controls error:', error);
    await ctx.editMessageText?.('❌ Error loading bot controls.');
  }
}

// Add clear cache handler
export async function handleAdminClearCache(ctx: CallbackQueryContext<Context>) {
  await ctx.answerCallbackQuery({ text: 'Clearing cache...' });
  
  try {
    const userId = ctx.from!.id;
    const user = await User.findOne({ telegramId: userId });
    
    if (!user?.isAdmin) {
      await ctx.editMessageText?.('❌ Admin access required.');
      return;
    }
    
    // Clear session cache (example)
    // In production, you might want to clear Redis cache
    const { redisManager } = await import('../../../core/database/connections/redis');
    await redisManager.clearAll();
    
    await ctx.editMessageText?.(
      '✅ *Cache Cleared Successfully!*\n\n' +
      '• Session cache cleared\n' +
      '• Rate limit cache cleared\n' +
      '• Temporary data cleared\n\n' +
      'The system cache has been cleared.',
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Back to Controls', callback_data: 'admin_controls' }],
            [{ text: '🏠 Admin Menu', callback_data: 'admin_menu' }]
          ]
        }
      }
    );
    
    // Log action
    await auditService.logAdminAction(
      user._id,
      userId,
      'CACHE_CLEARED',
      'SYSTEM',
      'System',
      undefined,
      { action: 'clear_cache' }
    );
    
  } catch (error) {
    logger.error('Clear cache error:', error);
    await ctx.editMessageText?.('❌ Failed to clear cache.');
  }
}

export async function handleAdminRestartHistory(ctx: CallbackQueryContext<Context>) {
  try {
    await ctx.answerCallbackQuery();
    
    const adminId = sanitizeInput(ctx.from!.id);
    const admin = await User.findOne({ telegramId: parseInt(adminId) });
    
    if (!admin?.isAdmin) {
      await ctx.editMessageText?.('❌ Admin access required.');
      return;
    }
    
    const { getAllRestarts } = await import('../../../core/utils/restartTracker');
    const restarts = await getAllRestarts(10);
    
    let message = '📜 *Restart History*\n\n';
    
    if (restarts.length === 0) {
      message += 'No restart history available.';
    } else {
      for (const restart of restarts) {
        const statusEmoji = 
          restart.status === 'completed' ? '✅' : 
          restart.status === 'failed' ? '❌' : '⏳';
        
        const timeDiff = restart.completedAt 
          ? ` (${Math.floor((restart.completedAt.getTime() - restart.requestedAt.getTime()) / 1000)}s)`
          : '';
        
        message += `${statusEmoji} *ID:* \`${restart._id.toString().substring(0, 8)}...\`\n`;
        message += `   Admin: ${restart.adminId}\n`;
        message += `   Requested: ${restart.requestedAt.toLocaleString()}\n`;
        message += `   Status: ${restart.status}${timeDiff}\n`;
        
        if (restart.completedAt) {
          message += `   Completed: ${restart.completedAt.toLocaleString()}\n`;
        }
        message += '\n';
      }
    }
    
    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔄 Refresh', callback_data: 'admin_restart_history' }],
          [{ text: '🔙 Back to Controls', callback_data: 'admin_controls' }]
        ]
      }
    });
    
  } catch (error: any) {
    logger.error('Restart history error:', error);
    await ctx.editMessageText?.('❌ Error loading restart history.');
  }
}

// Update restart confirmation handler
export async function handleAdminRestart(ctx: CallbackQueryContext<Context>) {
  await ctx.answerCallbackQuery();
  
  try {
    const userId = ctx.from!.id;
    const user = await User.findOne({ telegramId: userId });
    
    if (!user?.isAdmin) {
      await ctx.editMessageText?.('❌ Admin access required.');
      return;
    }
    
    await ctx.editMessageText?.(
      '🔄 *Bot Restart*\n\n' +
      'Choose restart type:\n\n' +
      '♦️ *Soft Restart:* Restart services only\n' +
      '⚠️ *Note:* Restarts may take 30-60 seconds.',
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '♦️ Soft Restart', callback_data: 'admin_soft_restart' },
              { text: '♻️ Full Restart', callback_data: 'admin_full_restart' }
            ],
            [
              { text: '📜 View History', callback_data: 'admin_restart_history' }
            ],
            [
              { text: '🔙 Back to Controls', callback_data: 'admin_controls' }
            ]
          ]
        }
      }
    );
    
  } catch (error) {
    logger.error('Admin restart error:', error);
  }
}

// Add soft restart handler
export async function handleAdminSoftRestart(ctx: CallbackQueryContext<Context>) {
  await ctx.answerCallbackQuery({ text: 'Initiating soft restart...' });
  
  try {
    const userId = sanitizeInput(ctx.from!.id);
    const user = await User.findOne({ telegramId: parseInt(userId) });
    
    if (!user?.isAdmin) {
      await ctx.editMessageText?.('❌ Admin access required.');
      return;
    }
    
    const restartService = new RestartService();
    const { restartId } = await restartService.softRestart(
      parseInt(userId),
      ctx.chat!.id,
      ctx.msg?.message_id
    );
    
    await ctx.editMessageText?.(
      `🔄 *Soft Restart Initiated*\n\n` +
      `Restart ID: \`${restartId}\`\n` +
      `The bot is restarting. This will take 30-60 seconds.\n\n` +
      `You will receive a notification when the bot is back online.`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📜 View Restart History', callback_data: 'admin_restart_history' }]
          ]
        }
      }
    );
    
  } catch (error: any) {
    logger.error('Soft restart error:', error);
    await ctx.editMessageText?.('❌ Failed to perform soft restart: ' + error.message);
  }
}

// Add this new function to handle user search
export async function handleAdminSearchUsers(ctx: CallbackQueryContext<Context>) {
    await ctx.answerCallbackQuery();
    
    try {
        const userId = ctx.from!.id;
        const user = await User.findOne({ telegramId: userId });
        
        if (!user?.isAdmin) {
            await ctx.editMessageText?.('❌ Admin access required.');
            return;
        }
        
        await ctx.editMessageText?.(
            '🔍 *Search Users*\n\n' +
            'Please enter a search query:\n' +
            '• Telegram ID (e.g., 123456789)\n' +
            '• Username (e.g., @username)\n' +
            '• Referral code\n' +
            '• First name\n\n' +
            'Type your search query now:',
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔙 Back to Users', callback_data: 'admin_users' }]
                    ]
                }
            }
        );
        
        // Set session for search
        ctx.session.step = 'admin_search_users';
        
    } catch (error) {
        logger.error('Admin search users error:', error);
    }
}

export async function handleAdminSearchInput(ctx: Context) {
  try {
    if (ctx.session?.step !== 'admin_search_users') return;
    
    const rawQuery = ctx.message?.text;
    if (!rawQuery) {
      await ctx.reply('❌ Please enter a search query.');
      return;
    }
    const query = sanitizeInput(rawQuery);
    const adminId = sanitizeInput(ctx.from!.id);
    const admin = await User.findOne({ telegramId: parseInt(adminId) });
    if (!admin?.isAdmin) {
      await ctx.reply('❌ Admin access required.');
      delete ctx.session.step;
      return;
    }
    
    const isNumeric = /^\d+$/.test(query);
    let users;
    if (isNumeric) {
      users = await User.find({ telegramId: parseInt(query) }) // parseInt is safe because query is numeric string
        .select('telegramId username firstName lastName isBanned isAdmin balanceMain balanceHold phoneNumber totalEarned createdAt')
        .limit(20)
        .lean();
    } else {
      users = await User.find({
        $or: [
          { username: { $regex: escapeRegex(query), $options: 'i' } },
          { firstName: { $regex: escapeRegex(query), $options: 'i' } },
          { lastName: { $regex: escapeRegex(query), $options: 'i' } },
          { referralCode: { $regex: escapeRegex(query), $options: 'i' } }
        ]
      })
        .select('telegramId username firstName lastName isBanned isAdmin balanceMain balanceHold phoneNumber totalEarned createdAt')
        .limit(20)
        .lean();
    }
    
    if (users.length === 0) {
      await ctx.reply('❌ No users found for that query.');
      // Clear search step
      delete ctx.session.step;
      return;
    }
    
    let message = `🔍 *Search Results*\n\nFound ${users.length} users for "${escapeMarkdown(query)}":\n\n`;
    
    for (const user of users) {
      const status = user.isBanned ? '❌ Banned' : '✅ Active';
      const adminStatus = user.isAdmin ? '♦️ Admin' : '👤 User';
      const username = user.username ? `@${escapeMarkdown(user.username)}` : 'N/A';
      
      message += `• ${adminStatus} - ${status}\n`;
      message += `  ID: ${user.telegramId}\n`;
      message += `  Username: ${username}\n`;
      message += `  Name: ${escapeMarkdown(user.firstName)} ${escapeMarkdown(user.lastName || '')}\n`;
      message += `  Balance: \\${(user.balanceMain || 0).toFixed(2)}ETB\n`;
      message += `  phonenumber: +${user.phoneNumber || 0}\n`;
    }
    
    // Create inline keyboard
    const inlineKeyboard = {
      inline_keyboard: [] as any[]
    };
    
    // Add first user's actions if available
    if (users.length > 0) {
      inlineKeyboard.inline_keyboard.push([
        { 
          text: `👤 ${users[0].telegramId}`, 
          callback_data: `admin_user_detail_${users[0].telegramId}` 
        }
      ]);
    }
    
    // Add view more if needed
    if (users.length > 1) {
      const encodedQuery = Buffer.from(query).toString('base64');
      inlineKeyboard.inline_keyboard.push([
        { 
          text: '📋 View All Results', 
          callback_data: `admin_view_search_results_${encodedQuery}` 
        }
      ]);
    }
    
    inlineKeyboard.inline_keyboard.push(
      [
        { text: '🔍 Search Again', callback_data: 'admin_search_users' },
        { text: '🔙 Back to Users', callback_data: 'admin_users' }
      ]
    );
    
    await ctx.reply(message, {
      parse_mode: 'Markdown' as const,
      reply_markup: inlineKeyboard
    });
    
    // Clear search step
    delete ctx.session.step;
    
  } catch (error: any) {
    logger.error('Admin search input error:', error);
    await ctx.reply('❌ Error performing search. Please try again: ' + escapeMarkdown(error.message));
    // Clear search step on error too
    if (ctx.session) {
      delete ctx.session.step;
    }
  }
}

// Helper function to escape regex special characters
function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// handle viewing all search results - FIXED
export async function handleViewSearchResults(
  ctx: CallbackQueryContext<Context>, 
  encodedQuery: string, 
  offset: number = 0
): Promise<void> {
  try {
    await ctx.answerCallbackQuery();
    
    const adminId = sanitizeInput(ctx.from!.id);
    const admin = await User.findOne({ telegramId: parseInt(adminId) });
    if (!admin?.isAdmin) return;
    
    const query = Buffer.from(encodedQuery, 'base64').toString('utf-8');
    // sanitize the decoded query (though it should already be safe, but for defense in depth)
    const safeQuery = sanitizeInput(query);
    
    const isNumeric = /^\d+$/.test(safeQuery);
    let users;
    if (isNumeric) {
      users = await User.find({ telegramId: parseInt(safeQuery) })
        .select('telegramId username firstName lastName isBanned balanceMain createdAt')
        .limit(50)
        .lean();
    } else {
      users = await User.find({
        $or: [
          { username: { $regex: escapeRegex(safeQuery), $options: 'i' } },
          { firstName: { $regex: escapeRegex(safeQuery), $options: 'i' } },
          { lastName: { $regex: escapeRegex(safeQuery), $options: 'i' } },
          { referralCode: { $regex: escapeRegex(safeQuery), $options: 'i' } }
        ]
      })
        .select('telegramId username firstName lastName isBanned balanceMain createdAt')
        .limit(50)
        .lean();
    }
    
    let message = `🔍 *Search Results: "${escapeMarkdown(query)}"*\n\n`;
    
    // Group users by status
    const activeUsers = users.filter(u => !u.isBanned);
    const bannedUsers = users.filter(u => u.isBanned);
    
    if (activeUsers.length > 0) {
      message += `✅ *Active Users (${activeUsers.length})*\n`;
      activeUsers.forEach((user, index) => {
        const username = user.username ? `@${escapeMarkdown(user.username)}` : user.telegramId;
        message += `${index + 1}. ${username} - \\$${(user.balanceMain || 0).toFixed(2)}\n`;
      });
      message += '\n';
    }
    
    if (bannedUsers.length > 0) {
      message += `❌ *Banned Users (${bannedUsers.length})*\n`;
      bannedUsers.forEach((user, index) => {
        const username = user.username ? `@${escapeMarkdown(user.username)}` : user.telegramId;
        message += `${index + 1}. ${username} - ${escapeMarkdown(user.banReason || 'No reason')}\n`;
      });
    }
    
    // Create inline keyboard using InlineKeyboard class
    const inlineKeyboard = new InlineKeyboard();
    const usersToShow = users.slice(offset, offset + 10);
    
    for (const user of usersToShow) {
      const username = user.username ? escapeMarkdown(user.username) : user.telegramId;
      inlineKeyboard.text(
        `${user.isBanned ? '❌' : '✅'} @${username}`, 
        `admin_user_detail_${user.telegramId}`
      );
      inlineKeyboard.row();
    }
    
    // Add navigation if there are more users
    if (users.length > offset + 10) {
      inlineKeyboard.text(
        '⬇️ More Results', 
        `admin_search_more_${encodedQuery}_${offset + 10}`
      );
      inlineKeyboard.row();
    }
    
    inlineKeyboard
      .text('🔍 New Search', 'admin_search_users')
      .text('🔙 Back to Users', 'admin_users');
    
    await ctx.editMessageText(message, {
      parse_mode: 'Markdown' as const,
      reply_markup: inlineKeyboard
    });
    
  } catch (error) {
    logger.error('View search results error:', error);
    await ctx.answerCallbackQuery({
      text: 'Error loading search results',
      show_alert: false
    });
  }
}

export async function handleAdminUsers(ctx: CallbackQueryContext<Context>) {
  await ctx.answerCallbackQuery();
  
  try {
    const userId = ctx.from!.id;
    const user = await User.findOne({ telegramId: userId });
    
    if (!user?.isAdmin) {
      await ctx.editMessageText?.('❌ Admin access required.');
      return;
    }
    
    // Get total user count
    const totalUsers = await User.countDocuments();
    const bannedUsers = await User.countDocuments({ isBanned: true });
    const activeUsers = totalUsers - bannedUsers;
    
    await ctx.editMessageText?.(
      `👥 *User Management*\n\n` +
      `📊 *Statistics:*\n` +
      `• Total Users: ${totalUsers}\n` +
      `• Active: ${activeUsers}\n` +
      `• Banned: ${bannedUsers}\n\n` +
      `🔧 *Management Tools:*`,
      {
        parse_mode: 'Markdown' as const,
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📋 List Users', callback_data: 'admin_list_users' },
              { text: '🔍 Search User', callback_data: 'admin_search_users' }
            ],
            [
              { text: '⚠️ Banned Users', callback_data: 'admin_banned_list' },
              { text: '📊 User Stats', callback_data: 'admin_user_stats' }
            ],
            [
              { text: '🔙 Back to Admin', callback_data: 'admin_menu' }
            ]
          ]
        }
      }
    );
    
  } catch (error) {
    logger.error('Admin users error:', error);
    await ctx.editMessageText?.('❌ Error loading user management.');
  }
}

export async function handleListUsers(ctx: CallbackQueryContext<Context>) {
  try {
    await ctx.answerCallbackQuery();
    
    const adminId = ctx.from!.id;
    const admin = await User.findOne({ telegramId: adminId });
    
    if (!admin?.isAdmin) {
      await ctx.editMessageText?.('❌ Admin access required.');
      return;
    }
    
    // Get recent users with proper field selection
    const users = await User.find()
      .sort({ createdAt: -1 })
      .limit(15)
      .select('telegramId username firstName lastName balanceMain balanceHold phoneNumber isBanned banReason createdAt lastLoginAt referralCode')
      .lean();
    
    // Get actual count
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isBanned: false });
    const bannedUsers = await User.countDocuments({ isBanned: true });
    
    let message = `📋 *Recent Users (${users.length} shown)*\n\n`;
    message += `📊 *Total Stats:*\n`;
    message += `• Total Users: ${totalUsers}\n`;
    message += `• Active: ${activeUsers}\n`;
    message += `• Banned: ${bannedUsers}\n\n`;
    
    if (users.length === 0) {
      message += 'No users found.';
    } else {
      message += '*Recent Users:*\n\n';
      
      for (const user of users) {
        const status = user.isBanned ? '❌ Banned' : '✅ Active';
        const banInfo = user.isBanned ? ` | Reason: ${escapeMarkdown(user.banReason || 'No reason')}` : '';
        const username = user.username ? `@${escapeMarkdown(user.username)}` : 'No username';
        const displayName = `${escapeMarkdown(user.firstName || '')} ${escapeMarkdown(user.lastName || '')}`.trim() || 'No name';
        
        message += `${status} | ID: ${user.telegramId}\n`;
        message += `Username: ${username}\n`;
        message += `Name: ${displayName}\n`;
        message += `Balance: ${(user.balanceMain || 0).toFixed(2)}ETB\n`;
        message += `phonenumber: +${user.phoneNumber || 0}\n`;
        message += `Joined: ${new Date(user.createdAt).toLocaleDateString()}\n\n`;
      }
    }
    
    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🔄 Refresh', callback_data: 'admin_list_users' },
            { text: '🔍 Search Users', callback_data: 'admin_search_users' }
          ],
          [
            { text: '⚠️ Banned Users', callback_data: 'admin_banned_list' },
            { text: '📊 User Stats', callback_data: 'admin_user_stats' }
          ],
          [
            { text: '🔙 Back to Users', callback_data: 'admin_users' }
          ]
        ]
      }
    });
    
  } catch (error: any) {
    logger.error('List users error:', error);
    await ctx.editMessageText?.('❌ Error loading users list: ' + error.message);
  }
}

export async function handleBanUser(ctx: CallbackQueryContext<Context>, userId: string) {
  try {
    await ctx.answerCallbackQuery();
    
    const adminId = sanitizeInput(ctx.from!.id);
    const admin = await User.findOne({ telegramId: parseInt(adminId) });
    if (!admin?.isAdmin) {
      await ctx.editMessageText?.('❌ Admin access required.');
      return;
    }
    
    const safeUserId = sanitizeInput(userId);
    const userTelegramId = parseInt(safeUserId);
    if (isNaN(userTelegramId)) {
      await ctx.editMessageText?.('❌ Invalid user ID.');
      return;
    }
    
    const userToBan = await User.findOne({ telegramId: userTelegramId });
    if (!userToBan) {
      await ctx.editMessageText?.('❌ User not found.');
      return;
    }
    
    if (userToBan.isBanned) {
      await ctx.editMessageText?.(`⚠️ User is already banned.\nReason: ${escapeMarkdown(userToBan.banReason || 'No reason provided')}`);
      return;
    }
    
    const username = userToBan.username ? `@${escapeMarkdown(userToBan.username)}` : `User ${userTelegramId}`;
    
    await ctx.editMessageText?.(`⚠️ *Ban User*\n\n` +
      `User: ${username}\n` +
      `Current Status: Active\n` +
      `Balance: ${userToBan.balanceMain.toFixed(2)}ETB\n\n` +
      `Select ban reason:`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🚫 Spamming', callback_data: `admin_ban_reason_${userTelegramId}__Spamming` },
              { text: '⚠️ Fraud', callback_data: `admin_ban_reason_${userTelegramId}__Fraud` }
            ],
            [
              { text: '📛 Multiple Accounts', callback_data: `admin_ban_reason_${userTelegramId}__Multiple_Accounts` },
              { text: '🤑 Payment Issues', callback_data: `admin_ban_reason_${userTelegramId}__Payment_Issues` }
            ],
            [
              { text: '✏️ Custom Reason', callback_data: `admin_ban_custom_${userTelegramId}` },
              { text: '🔙 Cancel', callback_data: `admin_user_detail_${userTelegramId}` }
            ]
          ]
        }
      }
    );
    
  } catch (error: any) {
    logger.error('Ban user error:', error);
    await ctx.editMessageText?.('❌ Error: ' + error.message);
  }
}

// Update the handleBanWithReason function to handle job rejection callbacks
export async function handleBanWithReason(ctx: CallbackQueryContext<Context>, userId: string, reason: string) {
  try {
    await ctx.answerCallbackQuery();
    
    const adminId = sanitizeInput(ctx.from!.id);
    const admin = await User.findOne({ telegramId: parseInt(adminId) });
    if (!admin?.isAdmin) {
      await ctx.editMessageText?.('❌ Admin access required.');
      return;
    }
    
    
    
    const safeUserId = sanitizeInput(userId);
    const userTelegramId = parseInt(safeUserId);
    if (isNaN(userTelegramId)) {
      await ctx.editMessageText?.('❌ Invalid user ID.');
      return;
    }
    
    const userToBan = await User.findOne({ telegramId: userTelegramId });
    if (!userToBan) {
      await ctx.editMessageText?.('❌ User not found.');
      return;
    }
    
    userToBan.isBanned = true;
    userToBan.banReason = reason;
    await userToBan.save();
    
    // Log the action
    await auditService.logAdminAction(
      admin._id,
      parseInt(adminId),
      'USER_BANNED',
      'SECURITY',
      'User',
      userToBan._id.toString(),
      { reason, userId: userTelegramId }
    );
    
    const username = userToBan.username ? `@${userToBan.username}` : `User ${userTelegramId}`;
    await ctx.editMessageText?.(`✅ ${username} has been banned.\nReason: ${escapeMarkdown(reason)}`, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📋 Back to Users', callback_data: 'admin_list_users' }]
        ]
      }
    });
    
  } catch (error: any) {
    logger.error('Ban with reason error:', error);
    await ctx.editMessageText?.('❌ Error banning user: ' + error.message);
  }
}


// Add this new function for handling custom ban reasons
export async function handleCustomBanInput(ctx: Context, userId: string) {
  try {
    if (ctx.session?.step !== `admin_ban_custom_${userId}`) return;
    
    const reason = ctx.message?.text?.trim();
    if (!reason) {
      await ctx.reply('❌ Please enter a ban reason.');
      return;
    }
    
    const adminId = sanitizeInput(ctx.from!.id);
    const admin = await User.findOne({ telegramId: parseInt(adminId) });
    const safeUserId = sanitizeInput(userId);
    const userTelegramId = parseInt(safeUserId);
    
    if (!admin?.isAdmin || isNaN(userTelegramId)) {
      await ctx.reply('❌ Access denied or invalid user ID.');
      delete ctx.session.step;
      return;
    }
    
    const userToBan = await User.findOne({ telegramId: userTelegramId });
    if (!userToBan) {
      await ctx.reply('❌ User not found.');
      delete ctx.session.step;
      return;
    }
    
    userToBan.isBanned = true;
    userToBan.banReason = reason;
    await userToBan.save();
    
    // Log the action
    await auditService.logAdminAction(
      admin._id,
      parseInt(adminId),
      'USER_BANNED',
      'SECURITY',
      'User',
      userToBan._id.toString(),
      { reason, userId: userTelegramId }
    );
    
    const username = userToBan.username ? `@${userToBan.username}` : `User ${userTelegramId}`;
    await ctx.reply(
      `✅ ${username} has been banned.\nReason: ${escapeMarkdown(reason)}`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📋 Back to Users', callback_data: 'admin_list_users' }]
          ]
        }
      }
    );
    
    delete ctx.session.step;
    
  } catch (error: any) {
    logger.error('Custom ban input error:', error);
    await ctx.reply('❌ Error: ' + error.message);
    if (ctx.session) delete ctx.session.step;
  }
}

export async function handleBanAction(ctx: CallbackQueryContext<Context>, userId: string, reason: string) {
  try {
    const adminId = sanitizeInput(ctx.from!.id);
    const admin = await User.findOne({ telegramId: parseInt(adminId) });
    if (!admin?.isAdmin) return;
    
    const safeUserId = sanitizeInput(userId);
    const userToBan = await User.findOne({ telegramId: parseInt(safeUserId) });
    if (!userToBan) {
      await ctx.editMessageText?.('❌ User not found.');
      return;
    }
    
    userToBan.isBanned = true;
    userToBan.banReason = reason;
    await userToBan.save();
    
    // Log the action
    await auditService.logAdminAction(
      admin._id,
      parseInt(adminId),
      'USER_BANNED',
      'SECURITY',
      'User',
      userToBan._id.toString(),
      { reason, userId: safeUserId }
    );
    
    await ctx.editMessageText?.(`✅ User @${userToBan.username || userToBan.telegramId} has been banned.\nReason: ${reason}`, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📋 Back to Users', callback_data: 'admin_list_users' }]
        ]
      }
    });
    
  } catch (error) {
    logger.error('Ban action error:', error);
  }
}

export async function handleBannedUsersList(ctx: CallbackQueryContext<Context>) {
  try {
    await ctx.answerCallbackQuery();
    const adminId = sanitizeInput(ctx.from!.id);
    const admin = await User.findOne({ telegramId: parseInt(adminId) });
    if (!admin?.isAdmin) {
      await ctx.editMessageText?.('❌ Admin access required.');
      return;
    }
    
    // Get banned users
    const bannedUsers = await User.find({ isBanned: true })
      .sort({ updatedAt: -1 })
      .limit(20)
      .select('telegramId username firstName lastName banReason balanceMain phoneNumber createdAt')
      .lean();
    
    let message = '⚠️ *Banned Users*\n\n';
    
    if (bannedUsers.length === 0) {
      message += 'No banned users found.';
    } else {
      message += `Found ${bannedUsers.length} banned users:\n\n`;
      
      for (const user of bannedUsers) {
        const username = user.username ? `@${user.username}` : 'N/A';
        const banDate = new Date(user.updatedAt).toLocaleDateString();
        
        message += `• ID: ${user.telegramId}\n`;
        message += `  Username: ${username}\n`;
        message += `  Name: ${user.firstName} ${user.lastName || ''}\n`;
        message += `  phonenumber: +${user.phoneNumber || 0}\n`;
        message += `  Balance: ${(user.balanceMain || 0).toFixed(2)}ETB\n`;
        message += `  Ban Reason: ${user.banReason || 'No reason provided'}\n`;
        message += `  Banned: ${banDate}\n\n`;
      }
    }
    
    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🔄 Refresh', callback_data: 'admin_banned_list' },
            { text: '📋 All Users', callback_data: 'admin_list_users' }
          ],
          [
            { text: '🔙 Back to Users', callback_data: 'admin_users' }
          ]
        ]
      }
    });
    
  } catch (error) {
    logger.error('Banned users list error:', error);
    await ctx.editMessageText?.('❌ Error loading banned users.');
  }
}

export async function handleUnbanUser(ctx: CallbackQueryContext<Context>, userId: string) {
  try {
    const adminId = sanitizeInput(ctx.from!.id);
    const admin = await User.findOne({ telegramId: parseInt(adminId) });
    if (!admin?.isAdmin) return;
    
    const safeUserId = sanitizeInput(userId);
    const userToUnban = await User.findOne({ telegramId: parseInt(safeUserId) });
    if (!userToUnban) {
      await ctx.editMessageText?.('❌ User not found.');
      return;
    }
    
    userToUnban.isBanned = false;
    userToUnban.banReason = undefined;
    await userToUnban.save();
    
    // Log the action - convert adminId to number
    await auditService.logAdminAction(
      admin._id,
      parseInt(adminId),
      'USER_UNBANNED',
      'SECURITY',
      'User',
      userToUnban._id.toString(),
      { userId: safeUserId }  // metadata can stay string
    );
    
    await ctx.editMessageText?.(`✅ User @${userToUnban.username || userToUnban.telegramId} has been unbanned.`, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📋 Back to Users', callback_data: 'admin_list_users' }]
        ]
      }
    });
    
  } catch (error) {
    logger.error('Unban user error:', error);
  }
}


export async function handleUserActions(ctx: CallbackQueryContext<Context>, userId: string) {
  try {
    await ctx.answerCallbackQuery();
    const adminId = sanitizeInput(ctx.from!.id);
    const admin = await User.findOne({ telegramId: parseInt(adminId) });
    if (!admin?.isAdmin) {
      await ctx.editMessageText?.('❌ Admin access required.');
      return;
    }
    const safeUserId = sanitizeInput(userId);
    const user = await User.findOne({ telegramId: parseInt(safeUserId) });
    if (!user) {
      await ctx.editMessageText?.('❌ User not found.');
      return;
    }
    
    const message = `♦️ *User Actions*\n\n` +
      `User: @${user.username || user.telegramId}\n` +
      `Status: ${user.isBanned ? '❌ BANNED' : '✅ ACTIVE'}\n` +
      `Balance: ${user.balanceMain.toFixed(2)}ETB\n\n` +
      `Select an action:`;
    
    const inlineKeyboard = {
      inline_keyboard: [
        user.isBanned 
          ? [{ text: '✅ Unban User', callback_data: `admin_unban_${userId}` }]
          : [{ text: '❌ Ban User', callback_data: `admin_ban_${userId}` }],
        [
          //{ text: '🤑 Adjust Balance', callback_data: `admin_adjust_balance_${userId}` },
          { text: '📊 View Stats', callback_data: `admin_user_stats_${userId}` },
          { text: '📝 Add Notes', callback_data: `admin_user_notes_${userId}` }
        ],
        [
          { text: '🔙 Back to User', callback_data: `admin_user_detail_${userId}` },
          { text: '🏠 User List', callback_data: 'admin_list_users' }
        ]
      ]
    };
    
    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: inlineKeyboard
    });
    
  } catch (error) {
    logger.error('User actions error:', error);
  }
}

export async function handleAdjustBalance(ctx: CallbackQueryContext<Context>, userId: string) {
  try {
    await ctx.answerCallbackQuery();
    const adminId = sanitizeInput(ctx.from!.id);
    const admin = await User.findOne({ telegramId: parseInt(adminId) });
    if (!admin?.isAdmin) {
      await ctx.editMessageText?.('❌ Admin access required.');
      return;
    }
    const safeUserId = sanitizeInput(userId);
    
    await ctx.editMessageText?.(`🤑 *Adjust Balance*\n\n` +
      `User ID: ${safeUserId}\n\n` +
      `Enter amount to adjust (positive to add, negative to subtract):\n` +
      `Example: +5.00 or -2.50`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Cancel', callback_data: `admin_user_actions_${userId}` }]
          ]
        }
      }
    );
    
    ctx.session.step = `admin_adjust_balance_${safeUserId}`;
    
  } catch (error) {
    logger.error('Adjust balance error:', error);
  }
}

export async function handleBanConfirmation(ctx: CallbackQueryContext<Context>, userId: string) {
  try {
    await ctx.answerCallbackQuery();
    const adminId = sanitizeInput(ctx.from!.id);
    const admin = await User.findOne({ telegramId: parseInt(adminId) });
    if (!admin?.isAdmin) {
      await ctx.editMessageText?.('❌ Admin access required.');
      return;
    }
    const safeUserId = sanitizeInput(userId);
    const user = await User.findOne({ telegramId: parseInt(safeUserId) });
    if (!user) {
      await ctx.editMessageText?.('❌ User not found.');
      return;
    }
    
    await ctx.editMessageText?.(`⚠️ *Confirm Ban*\n\n` +
      `User: @${user.username || user.telegramId}\n` +
      `Balance: ${user.balanceMain.toFixed(2)}ETB\n` +
      `Select ban reason:`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🚫 Spamming', callback_data: `admin_ban_reason_${userId}_spamming` },
              { text: '⚠️ Fraud', callback_data: `admin_ban_reason_${userId}_fraud` }
            ],
            [
              { text: '📛 Multiple Accounts', callback_data: `admin_ban_reason_${userId}_multi_account` },
              { text: '🤑 Payment Issue', callback_data: `admin_ban_reason_${userId}_payment` }
            ],
            [
              { text: '✏️ Custom Reason', callback_data: `admin_ban_custom_${userId}` },
              { text: '🔙 Cancel', callback_data: `admin_user_actions_${userId}` }
            ]
          ]
        }
      }
    );
    
  } catch (error) {
    logger.error('Ban confirmation error:', error);
  }
}

export async function handleUserDetail(ctx: CallbackQueryContext<Context>, userId: string) {
  await ctx.answerCallbackQuery();
  try {
    const adminId = sanitizeInput(ctx.from!.id);
    const admin = await User.findOne({ telegramId: parseInt(adminId) });
    if (!admin?.isAdmin) {
      await ctx.editMessageText?.('❌ Admin access required.');
      return;
    }
    const safeUserId = sanitizeInput(userId);
    const userTelegramId = parseInt(safeUserId);
    if (isNaN(userTelegramId)) {
      await ctx.editMessageText?.('❌ Invalid user ID format.');
      return;
    }
    const user = await User.findOne({ telegramId: userTelegramId });
    if (!user) {
      await ctx.editMessageText?.('❌ User not found.');
      return;
    }
    
    // FIX: Properly escape username for Markdown
    const usernameDisplay = user.username ? 
      `@${user.username.replace(/_/g, '\\_')}` : 
      'N/A';
    
    const message = `👤 *User Details*\n\n` +
      `• ID: ${user.telegramId}\n` +
      `• Username: ${usernameDisplay}\n` +
      `• Name: ${escapeMarkdown(user.firstName)} ${escapeMarkdown(user.lastName || '')}\n` +
      `• Status: ${user.isBanned ? '❌ Banned' : '✅ Active'}\n` +
      `• Balance: \\${user.balanceMain.toFixed(2)}ETB\n` +
      `• Hold: \\${user.balanceHold.toFixed(2)}ETB\n` +
      `• Total Earned: \\${user.totalEarned.toFixed(2)}ETB\n` +
      `• Total Withdrawn: \\${user.totalWithdrawn.toFixed(2)}ETB\n` +
      `• Referral Code: ${user.referralCode}\n` +
      `• Joined: ${user.createdAt.toLocaleDateString()}\n\n` +
      `${user.isBanned ? `• Ban Reason: ${escapeMarkdown(user.banReason || 'No reason')}\n` : ''}`;
    
    const keyboard = [
      [{ text: '♦️ User Actions', callback_data: `admin_user_actions_${user.telegramId}` },
        { text: '📊 User Stats', callback_data: `admin_user_stats_detail_${user.telegramId}` }
      ],
      [
        { text: '🔙 Back to Users', callback_data: 'admin_list_users' }
      ]
    ];
    
    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: keyboard }
    });
    
  } catch (error: any) {
    logger.error('User detail error:', error.message);
    await ctx.editMessageText?.('❌ Error loading user details: ' + error.message);
  }
}



// User Notes handler
export async function handleUserNotes(ctx: CallbackQueryContext<Context>, userId: string) {
  try {
    await ctx.answerCallbackQuery();
    const adminId = sanitizeInput(ctx.from!.id);
    const admin = await User.findOne({ telegramId: parseInt(adminId) });
    if (!admin?.isAdmin) {
      await ctx.editMessageText?.('❌ Admin access required.');
      return;
    }
    const safeUserId = sanitizeInput(userId);
    await ctx.editMessageText?.(
      `📝 *Add User Notes*\n\nUser ID: ${safeUserId}\n\nEnter notes:`,
      { reply_markup: { inline_keyboard: [[{ text: '🔙 Cancel', callback_data: `admin_user_detail_${safeUserId}` }]] } }
    );
    ctx.session.step = `admin_user_notes_${safeUserId}`;
    
  } catch (error: any) {
    logger.error('User notes error:', error);
    await ctx.editMessageText?.('❌ Error: ' + error.message);
  }
}

// User Stats Detail handler
export async function handleUserStatsDetail(ctx: CallbackQueryContext<Context>, userId: string) {
  try {
    await ctx.answerCallbackQuery();
    const adminId = sanitizeInput(ctx.from!.id);
    const admin = await User.findOne({ telegramId: parseInt(adminId) });
    if (!admin?.isAdmin) {
      await ctx.editMessageText?.('❌ Admin access required.');
      return;
    }
    const safeUserId = sanitizeInput(userId);
    const user = await User.findOne({ telegramId: parseInt(safeUserId) });
    if (!user) {
      await ctx.editMessageText?.('❌ User not found.');
      return;
    }
    
   
    
    const message = `📊 *User Statistics*\n\n` +
      `👤 *User Info:*\n` +
      `• ID: ${user.telegramId}\n` +
      `• Username: @${user.username || 'N/A'}\n` +
      `• Name: ${user.firstName} ${user.lastName || ''}\n` +
      `• Status: ${user.isBanned ? '❌ Banned' : '✅ Active'}\n\n` +
      `🤑 *Financial:*\n` +
      `• Main Balance: ${user.balanceMain.toFixed(2)}ETB\n` +
      `• Hold Balance: ${user.balanceHold.toFixed(2)}ETB\n` +
      `• Total Earned: ${user.totalEarned.toFixed(2)}ETB\n` +
      `• Total Withdrawn: ${user.totalWithdrawn.toFixed(2)}ETB\n\n` +
      `🕒 *Timestamps:*\n` +
      `• Joined: ${user.createdAt.toLocaleString()}\n` +
      `• Last Login: ${user.lastLoginAt?.toLocaleString() || 'Never'}`;
    
    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔙 Back to User', callback_data: `admin_user_detail_${userId}` }],
          [{ text: '📋 All Users', callback_data: 'admin_list_users' }]
        ]
      }
    });
    
  } catch (error: any) {
    logger.error('User stats detail error:', error);
    await ctx.editMessageText?.('❌ Error loading user stats: ' + error.message);
  }
}

// Ban Custom Reason handler
export async function handleBanCustom(ctx: CallbackQueryContext<Context>, userId: string) {
  try {
    await ctx.answerCallbackQuery();
    const adminId = sanitizeInput(ctx.from!.id);
    const admin = await User.findOne({ telegramId: parseInt(adminId) });
    if (!admin?.isAdmin) {
      await ctx.editMessageText?.('❌ Admin access required.');
      return;
    }
    const safeUserId = sanitizeInput(userId);
    await ctx.editMessageText?.(
      `✏️ *Custom Ban Reason*\n\nUser ID: ${safeUserId}\n\nEnter custom ban reason:`,
      { reply_markup: { inline_keyboard: [[{ text: '🔙 Cancel', callback_data: `admin_ban_confirmation_${safeUserId}` }]] } }
    );
    ctx.session.step = `admin_ban_custom_${safeUserId}`;
    
  } catch (error: any) {
    logger.error('Ban custom error:', error);
    await ctx.editMessageText?.('❌ Error: ' + error.message);
  }
}
