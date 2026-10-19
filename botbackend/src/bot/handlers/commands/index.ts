// src/bot/handlers/commands/index.ts
import { Bot } from 'grammy';
import { Context } from '../../framework';

// Import command handlers
import { startCommand } from './start';
import { balanceCommand } from './balance';
import { SessionCleaner } from '@/core/utils/sessionCleaner';

export function setupHandlers(bot: Bot<Context>) {
  // Command handlers

  // Add middleware to clear session for main commands
bot.command(['start', 'menu', 'help'], async (ctx, next) => {
  SessionCleaner.clearSession(ctx.session);
  await next();
});
  bot.command('start', startCommand);
  bot.command('balance', balanceCommand);
 
}