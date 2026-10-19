// src/bot/handlers/callbacks/menuRefresh.ts - NEW FILE
import { CallbackQueryContext } from 'grammy';
import { Context } from '../../framework';
import { User } from '../../../core/database/models/User';
import { logger } from '../../../core/utils/logger';
import { InlineKeyboard } from 'grammy';
import { sanitizeInput } from '../../../core/utils/security';

export async function handleRefreshMenu(ctx: CallbackQueryContext<Context>) {
  try {
    await ctx.answerCallbackQuery({ text: '🔄 Refreshing menu...' });
    
    const userId = sanitizeInput(ctx.from!.id);
    const user = await User.findOne({ telegramId: parseInt(userId) });
    
    if (!user) {
      await ctx.editMessageText?.('❌ Please use /start to register first.');
      return;
    }
    
    const message = `🏠 *Main Menu*\n\n` +
      `Hello ${user.firstName}!\n\n` +
      `🤑 Available Balance: *$${user.balanceMain.toFixed(2)}*\n` +
      `Select an option:`;
    
    const inlineKeyboard = new InlineKeyboard()
      .text('➕ Earn', 'register_new')
      .text('🤑 Balance', 'balance')
      .row()
      .text('📋 My Jobs', 'my_jobs')
      .text('⚙️ Settings', 'settings')
      .row();
    
    if (user.isAdmin) {
      inlineKeyboard.text('♦️ Admin Panel', 'admin_menu');
    } else {
      inlineKeyboard.text('🆘 Help', 'help_menu');
    }
    
    inlineKeyboard.row()
      .text('🔄 Refresh', 'refresh_menu');
    
    await ctx.editMessageText?.(message, {
      parse_mode: 'Markdown',
      reply_markup: inlineKeyboard
    });
    
  } catch (error) {
    logger.error('Menu refresh handler error:', error);
    await ctx.answerCallbackQuery({ 
      text: '❌ Error refreshing menu', 
      show_alert: false 
    });
  }
}