// src/bot/handlers/callbacks/menuToggle.ts - FIXED VERSION
import { CallbackQueryContext } from 'grammy';
import { Context } from '../../framework';
import { KeyboardFactory } from '../../framework/keyboards';
import { User } from '../../../core/database/models/User';
import { logger } from '../../../core/utils/logger';
import { sanitizeInput } from '../../../core/utils/security';

export async function handleMenuToggle(ctx: CallbackQueryContext<Context>) {
  try {
    await ctx.answerCallbackQuery({ text: '🔄 Updating menu...' });
    
    const callbackData = ctx.callbackQuery.data;
    const action = callbackData.replace('toggle_menu_', '');
    
    // Ensure session.menuExpanded is initialized
    if (ctx.session.menuExpanded === undefined) {
      ctx.session.menuExpanded = true;
    }
    
    // Update menu expansion state
    if (action === 'min') {
      ctx.session.menuExpanded = false;
    } else if (action === 'full') {
      ctx.session.menuExpanded = true;
    }
    
     const userId = sanitizeInput(ctx.from!.id);
    const user = await User.findOne({ telegramId: parseInt(userId) });
    
    if (!user) {
      await ctx.editMessageText?.('❌ Please use /start to register first.');
      return;
    }
    
    // Now menuExpanded is guaranteed to be boolean
    const menuExpanded = ctx.session.menuExpanded;
    
    const message = `🏠 *Main Menu*\n\n` +
      `Hello ${user.firstName}!\n\n` +
      `Menu layout: **${menuExpanded ? 'Expanded' : 'Compact'}**\n\n` +
      `🤑 Available Balance: *$${user.balanceMain.toFixed(2)}*\n` +
      `Use buttons below or menu commands →`;
    
    // Send as new message with reply keyboard
    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: KeyboardFactory.mainMenu(user.isAdmin, menuExpanded)
    });
    
    // Try to delete the old inline message
    try {
      await ctx.deleteMessage();
    } catch (error) {
      // Ignore if can't delete
      logger.debug('Could not delete old menu message');
    }
    
  } catch (error) {
    logger.error('Menu toggle handler error:', error);
    await ctx.answerCallbackQuery({ 
      text: '❌ Error updating menu', 
      show_alert: false 
    });
  }
}