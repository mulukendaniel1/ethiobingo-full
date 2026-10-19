// src/bot/handlers/commands/menu.ts - Updated
import { CommandContext } from 'grammy';
import { Context } from '../../framework';
import { User } from '../../../core/database/models/User';
import { KeyboardFactory } from '../../framework/keyboards';
import { logger } from '../../../core/utils/logger';
import { SessionCleaner } from '@/core/utils/sessionCleaner';
import { sanitizeInput } from '../../../core/utils/security';

// Update the menuCommand in src/bot/handlers/commands/menu.ts
export async function menuCommand(ctx: CommandContext<Context>) {
    try {
        const userId = sanitizeInput(ctx.from!.id);
        const user = await User.findOne({ telegramId: parseInt(userId) });
        
        if (!user) {
            return await ctx.reply('❌ Please use /start to register first.');
        }
        
        // Clear workflow-specific session data but keep UI preferences
        const menuExpanded = ctx.session?.menuExpanded ?? true;
        
        SessionCleaner.clearSession(ctx.session);
        
        // Restore UI preference
        ctx.session.menuExpanded = menuExpanded;
        
        // Use OPTIMIZED reply keyboard
        await ctx.reply(
            `🏠 *Main Menu*\n\n` +
            `Hello ${user.firstName}!\n\n` +
            `🤑 **Your Stats:**\n` +
            `• Withdrawable: *${user.balanceMain.toFixed(2)}ETB*\n` +
            `• Main balance: *${user.ETBCoins.toFixed(2)}ETB*\n` +
            `• Total Earned: *${user.totalEarned.toFixed(2)}ETB*\n` +
            `Use buttons below or menu commands →`,
            {
    parse_mode: 'Markdown',
    reply_markup: KeyboardFactory.mainMenu(user.isAdmin, menuExpanded, ctx.state.lang)
  }
);
        
    } catch (error: any) {
        logger.error('Menu command error:', error);
        await ctx.reply('❌ Error loading menu. Please try /start again.');
    }
}