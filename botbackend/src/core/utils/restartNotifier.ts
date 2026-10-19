// src/core/restartNotifier.ts
import { RestartRecord, getPendingRestarts, markRestartCompleted } from './restartTracker';
import { getBotInstance } from '../../bot/framework';
import { logger } from './logger';

const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

export async function notifyRestartCompletion(): Promise<void> {
  try {
    await delay(5000);
    
    const pendingRestarts = await getPendingRestarts();
    if (pendingRestarts.length === 0) {
      logger.info('No pending restarts to notify');
      return;
    }
    
    logger.info(`Found ${pendingRestarts.length} pending restarts to notify`);
    
    for (const restart of pendingRestarts) {
      try {
        const bot = getBotInstance();
        const timeElapsed = Math.floor((Date.now() - restart.requestedAt.getTime()) / 1000);
        
        if (restart.messageId) {
          try {
            await bot.api.editMessageText(
              restart.chatId,
              restart.messageId,
              `✅ *Bot Restart Completed!*\n\n` +
              `Restart ID: \`${restart._id}\`\n` +
              `⏱️ Downtime: ${timeElapsed} seconds\n` +
              `📅 Completed: ${new Date().toLocaleString()}`,
              {
                parse_mode: 'Markdown',
                reply_markup: {
                  inline_keyboard: [
                    [{ text: '⚙️ Back to Admin', callback_data: 'admin_menu' }],
                    [{ text: '📜 Restart History', callback_data: 'admin_restart_history' }]
                  ]
                }
              }
            );
          } catch (editError) {
            await bot.api.sendMessage(
              restart.chatId,
              `✅ *Bot Restart Completed!*\n\n` +
              `Restart ID: \`${restart._id}\`\n` +
              `⏱️ Downtime: ${timeElapsed} seconds\n` +
              `📅 Completed: ${new Date().toLocaleString()}`,
              {
                parse_mode: 'Markdown',
                reply_markup: {
                  inline_keyboard: [
                    [{ text: '⚙️ Back to Admin', callback_data: 'admin_menu' }],
                    [{ text: '📜 Restart History', callback_data: 'admin_restart_history' }]
                  ]
                }
              }
            );
          }
        } else {
          await bot.api.sendMessage(
            restart.chatId,
            `✅ *Bot Restart Completed!*\n\n` +
            `Restart ID: \`${restart._id}\`\n` +
            `⏱️ Downtime: ${timeElapsed} seconds\n` +
            `📅 Completed: ${new Date().toLocaleString()}`,
            {
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [
                  [{ text: '⚙️ Back to Admin', callback_data: 'admin_menu' }],
                  [{ text: '📜 Restart History', callback_data: 'admin_restart_history' }]
                ]
              }
            }
          );
        }
        
        await markRestartCompleted(restart._id.toString());
        await delay(1000);
        
      } catch (error: any) {
        logger.error(`Failed to notify restart ${restart._id}:`, error.message);
      }
    }
    
  } catch (error: any) {
    logger.error('Restart notifier error:', error);
  }
}