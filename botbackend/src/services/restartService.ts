//src\services\restartService.ts
import { logger } from '../core/utils/logger';
import { botInstance } from '../bot/framework';
import { trackRestartRequest, markRestartCompleted, markRestartFailed } from '../core/utils/restartTracker';
import { cronScheduler } from '../cron';
import { getSetting } from '../core/utils/settings';
import { NotificationService } from './notificationService';

export class RestartService {
  private notificationService: NotificationService;

  constructor() {
    this.notificationService = new NotificationService();
  }

  /**
   * Perform a soft restart of the bot (stop and start services)
   */
  async softRestart(adminId: number, chatId: number, messageId?: number): Promise<{ success: boolean; restartId: string }> {
    const restartId = await trackRestartRequest(adminId, chatId, messageId);
    
    // Notify admin that restart is starting
    await this.notificationService.sendAdminAlert(
      `🔄 *Soft Restart Initiated*\n\nRestart ID: \`${restartId}\`\nPlease wait 30-60 seconds for the bot to come back online.`,
      'info'
    );

    // Perform restart in background
    setTimeout(async () => {
      try {
        // Stop cron jobs
        cronScheduler.stopAll();
        
        // Stop the bot if running
        if (botInstance) {
          await botInstance.stop();
          logger.info('✅ Bot stopped successfully');
        }
        
        // Wait a moment
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Recreate and restart bot
        const { createBot } = await import('../bot/framework');
        const newBot = await createBot();
        
        // Clear any existing webhook
        await newBot.api.deleteWebhook({ drop_pending_updates: true });
        
        // Start polling
        await newBot.start({
          drop_pending_updates: true,
          allowed_updates: ["message", "callback_query", "chat_member", "my_chat_member"],
          onStart: (info) => {
            logger.info(`✅ Bot restarted successfully: @${info.username}`);
          }
        });
        
        // Restart cron jobs
        cronScheduler.startAll();
        
        // Mark restart as completed
        await markRestartCompleted(restartId);
        
        // Notify admin of success
        const bot = await import('../bot/framework').then(m => m.getBotInstance());
        await bot.api.sendMessage(
          chatId,
          `✅ *Bot Restart Completed Successfully!*\n\n` +
          `Restart ID: \`${restartId}\`\n` +
          `The bot is now back online and fully operational.\n\n` +
          `⏱️ Downtime: ~${Math.floor((Date.now() - new Date().getTime()) / 1000)} seconds`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '⚙️ Back to Admin', callback_data: 'admin_menu' }]
              ]
            }
          }
        );
        
      } catch (error: any) {
        logger.error('Soft restart failed:', error);
        await markRestartFailed(restartId, error.message);
        
        // Notify admin of failure
        const bot = await import('../bot/framework').then(m => m.getBotInstance());
        await bot.api.sendMessage(
          chatId,
          `❌ *Bot Restart Failed*\n\n` +
          `Restart ID: \`${restartId}\`\n` +
          `Error: ${error.message}\n\n` +
          `Please check the logs and try again.`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '🔄 Try Again', callback_data: 'admin_restart' }],
                [{ text: '📊 View Logs', callback_data: 'admin_restart_history' }]
              ]
            }
          }
        );
      }
    }, 1000);
    
    return { success: true, restartId };
  }
}