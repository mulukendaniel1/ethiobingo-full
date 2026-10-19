// src/bot/framework/index.ts
import { Bot, session, Context, SessionFlavor } from 'grammy';
import { autoRetry } from '@grammyjs/auto-retry';
import { MongoDBAdapter } from '@grammyjs/storage-mongodb';
import { connectMongo } from '../../core/database/connections/mongodb';
import { rateLimitMiddleware } from './middleware/rateLimit';
import { auditMiddleware } from './middleware/audit';
import { authMiddleware } from './middleware/auth';
import { setupHandlers } from '../handlers';
import { logger } from '../../core/utils/logger';
import { KeyboardFactory } from './keyboards';
import mongoose from 'mongoose';
import { SessionCleaner } from '../../core/utils/sessionCleaner';
import { User } from '../../core/database/models/User';  // Fixed path
import { sanitizeInput } from '../../core/utils/security';
import { languageMiddleware } from './middleware/language';
import { getSettings } from '@/core/utils/settingsCache';

export interface ParsedTelebirrReceipt {
  senderName: string;
  receiverName: string;
  amount: number;
  transactionId: string;
  date: Date;
  link?: string;
}
// Session structure
export interface SessionData {
  step?: string;
  jobId?: string;
  payoutState?: string;
  payoutAmount?: number;
  conversationStep?: string;
  tempData?: Record<string, any>;
  broadcastMessage?: string;
  broadcastId?: string;
  menuExpanded?: boolean;
  phoneRequestedAt?: number;
  pendingReferralCode?: string;
  
  broadcastData?: {
    title: string;
    content: string;
    type: 'announcement' | 'promotion' | 'update' | 'alert' | 'educational';
    target: 'all' | 'active' | 'balance' | 'recent' | 'specific';
    channels: ('bot' | 'channel' | 'both')[];
    buttons?: Array<{
      text: string;
      url?: string;
      callback_data?: string;
    }>;
    step: 'target_selection' | 'channel_selection' | 'confirmation' | 'scheduling';
  };
  
  // ETB deposit session data
  ETBDeposit?: {
    method?: 'cbe' | 'abyssinia' | 'cbebirr' | 'telebirr';
    amountETB?: number;
    transactionId?: string;
     requestId?: string;            // new
    parsedReceipt?: ParsedTelebirrReceipt; // new
  };
  
  // ETB withdraw session data
  ETBWithdraw?: {
    method?: 'cbe' | 'abyssinia' | 'cbebirr' | 'telebirr';
    amountETB?: number;
  };
  
  
  operatorData?: {
    operatorId: string;
    balance?: number;
    commission?: number;
  };

   cachedUser?: {
    _id: string;
    telegramId: number;
    isAdmin: boolean;
    isBanned: boolean;
    banReason?: string;
    phoneNumber?: string;
    firstName: string;
    username?: string;
    language: string;
    lastLoginAt?: string;
  };
  pendingSchedule?: {
  target: string;
  channel: string;
};
}

// Define state structure
export interface BotState {
  user?: any;
  job?: any;
 lang?: 'en' | 'am' | 'ti' | 'om' | 'so'; 
}

// Create a custom context type
type BotContext = Context & 
  SessionFlavor<SessionData> & {
    state: BotState;
  };

export let botInstance: Bot<BotContext> | null = null;

export async function createBot(): Promise<Bot<BotContext>> {
  try {
    const settings = getSettings();
    const bot = new Bot<BotContext>(settings.botToken);
    botInstance = bot;
    
    // Connect to MongoDB first
    await connectMongo();
    
    // Wait for connection to be ready
    if (mongoose.connection.readyState !== 1) {
      await new Promise<void>((resolve, reject) => {
        mongoose.connection.once('connected', resolve);
        mongoose.connection.once('error', reject);
      });
    }
    
    // Get the sessions collection
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('MongoDB database not connected');
    }
    
    const collection = db.collection('sessions') as any;
    
    // Session middleware with MongoDB storage - FIRST
    bot.use(session({
      initial: (): SessionData => ({
        step: undefined,
        jobId: undefined,
        payoutState: undefined,
        payoutAmount: undefined,
        conversationStep: undefined,
        tempData: {},
        broadcastMessage: undefined,
        broadcastId: undefined,
        menuExpanded: true
      }),
      getSessionKey: (ctx) => ctx.from?.id.toString(),
      storage: new MongoDBAdapter({ collection })
    }));
    
    // SESSION VALIDATION MIDDLEWARE - AFTER session middleware
    bot.use(async (ctx, next) => {
      // Validate and fix session data now that session middleware has run
      ctx.session = SessionCleaner.validateSession(ctx.session);
      await next();
    });
    
    // Initialize state
    bot.use(async (ctx, next) => {
      if (!ctx.state) {
        ctx.state = {};
      }
      await next();
    });
    
    // Add auto-retry for API calls
    bot.api.config.use(autoRetry({
      maxRetryAttempts: 3,
      maxDelaySeconds: 5
    }));
    
    // Add rate limiting middleware
    bot.use(rateLimitMiddleware());
    
    // Add auth middleware
    bot.use(authMiddleware());

    bot.use(languageMiddleware());
    // Add audit middleware
    bot.use(auditMiddleware());
    
    // Setup ALL handlers
    setupHandlers(bot);
    
    // ==================== ERROR HANDLING ====================
    
    // Handle middleware errors
    bot.catch(async (err) => {
      const ctx = err.ctx;
      logger.error(`Error while handling update ${ctx.update.update_id}:`, err.error);
      
      // Try to send an error message to the user
      try {
        if (ctx.callbackQuery) {
          await ctx.answerCallbackQuery({
            text: '❌ Something went wrong. Please try again.',
            show_alert: true,
          }).catch(() => {});
        } else if (ctx.chat?.type === 'private') {
          await ctx.reply('❌ An error occurred. Please try again.').catch(() => {});
        }
      } catch { /* swallow */ }
    });
    
    // Handle polling errors via the start method options
    // We'll handle this when starting the bot in index.ts
    
    // Handle API errors
    bot.api.config.use((prev, method, payload) => {
      return prev(method, payload).catch((error) => {
        logger.error(`API call ${method} failed:`, error.message);
        
        // Handle rate limits
        if (error.error_code === 429) {
          const retryAfter = error.parameters?.retry_after || 5;
          logger.warn(`Rate limited, retrying after ${retryAfter} seconds...`);
          return new Promise(resolve => setTimeout(resolve, retryAfter * 1000))
            .then(() => prev(method, payload));
        }
        
        throw error;
      });
    });
    
    // ==================== STARTUP LOGGING ====================
    
    // Log when bot starts successfully
    bot.api.getMe().then((me) => {
      logger.info(`✅ Bot initialized: @${me.username} (${me.first_name})`);
    }).catch((error) => {
      logger.error('Failed to get bot info:', error);
    });
    
    // Add a test command for debugging
    bot.command('ping', async (ctx) => {
      const start = Date.now();
      await ctx.reply('Pong!');
      const latency = Date.now() - start;
      await ctx.reply(`Latency: ${latency}ms\nBot: ${ctx.me.username}`);
    });

    // Add a handler for admin command (only works if typed manually)
    bot.command('admin', async (ctx) => {
     const userId = sanitizeInput(ctx.from!.id);
      const user = await User.findOne({ telegramId: parseInt(userId) });
      
      if (!user?.isAdmin) {
        await ctx.reply('❌ Admin access required.', {
          reply_markup: KeyboardFactory.mainMenu(false, true, ctx.state.lang)
        });
        return;
      }
      
      await ctx.reply(
        `♦️ *Admin Dashboard*\n\n` +
        `Select an option:`,
        {
          parse_mode: 'Markdown',
          reply_markup: KeyboardFactory.adminMenu()
        }
      );
    });
    
    // Help command
bot.command('help', async (ctx) => {
  const message = `📚 *Available Commands*\n\n` +
    `• /start - Register/Login\n` +
    `• /balance - Check your balance\n` +
    `• /register - Start new account registration\n` +
    `• /payout - Request payment\n` +
    `• /accounts - View your jobs\n` +
    `• /menu - Show main menu\n` +
    `• /ping - Test bot responsiveness\n` +
    `• /help - This message\n\n` +
    `📱 *Main Features:*\n` +
    `• Earn $0.16 per account\n` +
    `• 1-hour hold period\n` +
    `• Minimum payout: $0.50\n` +
    `• TRON (TRX) payouts`;
  
  await ctx.reply(message, {
    parse_mode: 'Markdown',
    reply_markup: KeyboardFactory.mainMenu(false, true, ctx.state.lang)
  });
});

    
    // Handle unhandled callback queries
    bot.on('callback_query:data', async (ctx) => {
      logger.warn(`Unhandled callback query: ${ctx.callbackQuery.data}`);
      await ctx.answerCallbackQuery({
        text: 'This action is not available',
        show_alert: false
      });
    });
    
   // Unhandled messages (non-command text)
    bot.on('message', async (ctx) => {
      if (ctx.message.text && !ctx.message.text.startsWith('/')) {
        await ctx.reply(
          '🤔 *Need Help?*\n\n' +
          'Use the buttons below or type commands:\n' +
          '/start - Register/Login\n' +
          '/balance - Check balance\n' +
          '/register - New account\n' +
          '/help - More help',
          {
            parse_mode: 'Markdown',
            reply_markup: KeyboardFactory.mainMenu(false, true, ctx.state.lang)
          }
        );
      }
    });
    

    // Handle unhandled callback queries with better error message
    bot.on('callback_query:data', async (ctx) => {
      logger.warn(`Unhandled callback query: ${ctx.callbackQuery.data}`);
      
      try {
        await ctx.answerCallbackQuery({
          text: 'This action is not available or expired',
          show_alert: false
        });
      } catch (error) {
        // Ignore "query is too old" errors
        logger.debug('Callback answer error:', error);
      }
    });

    logger.info('✅ Bot created successfully');
    return bot;
    
  } catch (error) {
    logger.error('❌ Failed to create bot:', error);
    throw error;
  }
}


export function getBotInstance(): Bot<BotContext> {
  if (!botInstance) {
    throw new Error('Bot not initialized. Call createBot() first.');
  }
  return botInstance;
}

// Export for external use
export type { BotContext as Context };