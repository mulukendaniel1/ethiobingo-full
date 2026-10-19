// src/index.ts 
import 'dotenv/config';
import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import cookieParser from 'cookie-parser';
import adminRouter from './routes/api/admin';
import { botInstance, createBot } from './bot/framework';
import { connectMongo } from './core/database/connections/mongodb';
import { redisManager } from './core/database/connections/redis';
import { logger } from './core/utils/logger';
import { startCronJobs } from './cron';
import { env } from './core/config/env';
import { notifyRestartCompletion } from './core/utils/restartNotifier';
import gameLinkRoutes from './routes/game-link';
import apiUserRoutes from './routes/api/user';
import cors from 'cors';
import { Operator } from './core/database/models/Operator';
import bingoWalletRoutes from './routes/internal/bingo';
import { seedSettings } from './core/database/seedSettings';
import { loadSettings } from './core/utils/settingsCache';
import backupRouter from './routes/api/backup';
import auditRouter from './routes/api/audit';
import leaderboardRouter from './routes/api/leaderboard';
import smsWebhookRouter from './routes/webhook/sms';
import ledgerRouter from './routes/api/ledger';
import shamoInternalRouter from './routes/internal/shamo';
import { SystemSettings } from './core/database/models/SystemSettings';
import { User } from './core/database/models/User';
import { channelShamoService } from './services/channelShamoService';

import { t } from './bot/utils/i18n';
// Create Express app
const app = express();
app.set('trust proxy', 1);
const port = env.PORT || 3000;

// Service health tracking
const serviceHealth = {
  mongodb: false,
  redis: false,
  bot: false,
  mtproto: false
};

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.disable('x-powered-by');

app.use(cors({
  origin: [
    'https://ethiogames.site',
    'https://admin.ethiogames.site',
    'https://api.ethiogames.site',
    'https://ws.ethiogames.site',
    'https://engine.ethiogames.site',  // we'll add this subdomain
    'http://localhost:5173'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// ==================== ROUTES ====================

// Health endpoint
app.get('/health', (req, res) => {
  const botStatus = botInstance ? 'connected' : 'disconnected';
  const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  const redisStatus = redisManager.isReady() ? 'connected' : 'disconnected';
  
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'ethio_bingoobot',
    version: '2.0.0',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    services: {
      bot: botStatus,
      mongodb: mongoStatus,
      redis: redisStatus
    },
    mode: 'polling',
    keepAlive: 'active',
    smsWebhook: !!process.env.SMS_WEBHOOK_SECRET,
  };
  
  // Return 200 OK
  res.status(200).json(health);
});

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    service: 'Etemarts Bot',
    status: 'running',
    mode: 'polling',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      metrics: '/metrics'
    }
  });
});

// Metrics endpoint
app.get('/metrics', (req: Request, res: Response) => {
  res.json({
    timestamp: new Date().toISOString(),
    memory: process.memoryUsage(),
    uptime: process.uptime(),
    services: serviceHealth
  });
});

// ==================== HELPER FUNCTIONS ====================

async function ensureDirectories(): Promise<void> {
  const directories = ['logs', 'backups', 'sessions'];
  
  for (const dir of directories) {
    const dirPath = path.join(process.cwd(), dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      logger.info(`Created directory: ${dirPath}`);
    }
  }
}

async function initializeDatabase(): Promise<void> {
  try {
    logger.info('Connecting to MongoDB...');
    await connectMongo();
    serviceHealth.mongodb = true;
    logger.info('✅ MongoDB connected successfully');
  } catch (error: any) {
    logger.error('❌ MongoDB connection failed:', error.message);
    serviceHealth.mongodb = false;
  }
}

async function ensureDefaultOperator() {
  const defaultOp = await Operator.findOne({ operatorId: 'ethio_bingoobot' });
  if (!defaultOp) {
    await Operator.create({
      operatorId: 'ethio_bingoobot',
      isActive: true,
    });
    logger.info('✅ Default operator created');
  }
}

async function initializeRedis(): Promise<void> {
  try {
    logger.info('Connecting to Redis...');
    await redisManager.connect();
    serviceHealth.redis = true;
    logger.info('✅ Redis connected successfully');
  } catch (error: any) {
    logger.warn('⚠️ Redis connection failed:', error.message);
    serviceHealth.redis = false;
  }
}
async function backfillHasPlacedFirstBet(): Promise<void> {
  try {
    logger.info('🔷 Backfill: hasPlacedFirstBet for existing active users...');

    const { UserBetHistory } = await import('./core/database/models/UserBetHistory');
    const mongoose = (await import('mongoose')).default;

    // distinct() returns whatever type is stored. bingo.ts stores it as String,
    // so we normalize to strings and then convert to ObjectId for the _id query.
    const rawIds: any[] = await UserBetHistory.distinct('userId', { action: 'buy' });
    logger.info(`🔷 Backfill: found ${rawIds.length} raw userId(s) with bet history.`);

    if (rawIds.length === 0) {
      logger.info('✅ Backfill: no bet history found — nothing to do.');
      return;
    }

    const objectIds = rawIds
      .map((id) => (id == null ? null : String(id)))
      .filter((id): id is string => !!id && mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    logger.info(`🔷 Backfill: ${objectIds.length} valid ObjectIds after normalization.`);

    if (objectIds.length === 0) {
      logger.warn('⚠️ Backfill: no valid ObjectIds after normalization — aborting.');
      return;
    }

    const result = await User.updateMany(
      {
        _id: { $in: objectIds },
        hasPlacedFirstBet: { $ne: true },
      },
      { $set: { hasPlacedFirstBet: true } }
    );

    logger.info(
      `✅ Backfill complete: candidates=${objectIds.length}, matched=${result.matchedCount}, modified=${result.modifiedCount}.`
    );
  } catch (err: any) {
    logger.error('❌ Backfill hasPlacedFirstBet failed:', err?.message || err);
  }
}
/*
async function runBonusAbuseMigration() {
  logger.info('🔷 Checking for bonus‑abuse migration updates...');

  try {
    const users = await User.find({
      'ETBCoinTransactions.reference': /^PHONE-BONUS-/,
    }).lean();

    let flaggedCount = 0;
    let unFlaggedCount = 0;

    for (const user of users) {
      const bonusTx = user.ETBCoinTransactions.find(
        (tx: any) => tx.reference?.startsWith('PHONE-BONUS-')
      );
      if (!bonusTx) continue;

      // Determine if the user has already played / spent the bonus
      const hasRedeemed = (user.totalETBRedeemed || 0) > 0;
      const hasOtherTxns = user.ETBCoinTransactions.length > 1;
      const spentBonus = (user.lockedBalance || 0) < bonusTx.amount;

      if (hasRedeemed || hasOtherTxns || spentBonus) {
        // User has already been active → un‑flag and mark as played
        if (user.isAbuser === true) {
          await User.updateOne(
            { _id: user._id },
            {
              $set: {
                isAbuser: false,
                hasPlacedFirstBet: true,
                bonusBalance: 0,
                firstBetFundedByDeposit: false,
                hasWageredFromDeposit: false,
                firstBetRoundId: null,
              },
            }
          );
          unFlaggedCount++;
        }
      } else {
        // Genuine silent collector → flag
        if (!user.isAbuser) {
          await User.updateOne(
            { _id: user._id },
            {
              $set: {
                isAbuser: true,
                bonusBalance: bonusTx.amount,
                hasPlacedFirstBet: false,
                totalConfirmedDepositsETB: 0,
                depositBalance: 0,
                firstBetFundedByDeposit: false,
                hasWageredFromDeposit: false,
                firstBetRoundId: null,
              },
            }
          );
          flaggedCount++;
        }
      }
    }

    logger.info(`✅ Bonus‑abuse migration finished. ${flaggedCount} flagged, ${unFlaggedCount} corrected.`);
  } catch (err) {
    logger.error('❌ Bonus‑abuse migration failed:', err);
  }
}
  */


// ==================== MAIN INITIALIZATION ====================

async function initializeApp(): Promise<void> {
  try {
    logger.info('🔷 Starting Etemarts Bot Initialization...');
    
    await ensureDirectories();
    if (!process.env.SMS_WEBHOOK_SECRET || process.env.SMS_WEBHOOK_SECRET.length < 32) {
      logger.error('❌ SMS_WEBHOOK_SECRET is missing or too weak (must be at least 32 characters). Exiting.');
      process.exit(1);
    }
    await initializeDatabase();
    await loadSettings();
    await initializeRedis();
    await ensureDefaultOperator();
    await seedSettings();

    /*
    // 🔷 Run one-time migration for existing bonus recipients
  await runBonusAbuseMigration().catch(err =>
    logger.error('Bonus abuse migration failed:', err)
  );
  */
// ═══════════════════════════════════════════════════════════════
// ONE-SHOT BACKFILL — ran 2026-10-04, verified complete, disabled.
// ═══════════════════════════════════════════════════════════════
// await backfillHasPlacedFirstBet();
    
    logger.info('Creating bot instance...');
    const bot = await createBot();
    
    // Clear any existing webhook
    try {
      await bot.api.deleteWebhook({ drop_pending_updates: true });
      logger.info('✅ Cleared existing webhook');
    } catch (error) {
      logger.warn('Could not clear webhook:', error);
    }
    
    // Init channel mirror for ሻሞ — non-fatal if it fails
await channelShamoService.init(bot).catch((err) =>
  logger.error('ChannelShamo init failed:', err)
);
    logger.info('Starting bot in polling mode...');
    
    // Infinite polling loop with exponential backoff on 409
    const startPolling = async () => {
      let retryDelay = 5000; // start with 5 seconds
      while (true) {
        try {
          await bot.start({
            drop_pending_updates: true,
            allowed_updates: ["message", "callback_query", "chat_member", "my_chat_member"],
            onStart: (info) => {
              serviceHealth.bot = true;
              logger.info(`✅ Bot started successfully: @${info.username}`);
            }
          });
          // If start() returns normally (should never happen, it's an infinite loop)
          break;
        } catch (error: any) {
          serviceHealth.bot = false;
          if (error.error_code === 409) {
            logger.warn(`⚠️ 409 conflict – another bot instance is running. Retrying in ${retryDelay/1000}s...`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            retryDelay = Math.min(retryDelay * 2, 60000); // exponential backoff up to 60s
          } else {
            logger.error('❌ Bot polling error:', error);
            // For other errors, wait a bit and restart polling
            await new Promise(resolve => setTimeout(resolve, 10000));
          }
        }
      }
    };
    
    // Start polling without blocking other initializations
    startPolling().catch(error => {
      logger.error('Fatal polling error:', error);
      process.exit(1);
    });
    
    // Rest of your initialization (workers, cron, etc.)
    
    startCronJobs();
    
    setTimeout(() => {
      notifyRestartCompletion().catch(e => logger.warn('Restart notification failed:', e));
    }, 15000);
    
    logger.info('🎉 Application initialized successfully!');
    
  } catch (error: any) {
    logger.error('❌ Application initialization failed:', error);
    process.exit(1);
  }
}

// ==================== ETB game engine ====================
app.use('/api/admin', adminRouter);
app.use('/internal/wallet/bingo', bingoWalletRoutes);
app.use('/game-link', gameLinkRoutes);
app.use('/api/user', apiUserRoutes);
app.use('/api/admin/backup', backupRouter);
app.use('/api/admin/audit-logs', auditRouter);
app.use('/api/leaderboard', leaderboardRouter);
app.use('/webhook', smsWebhookRouter);
app.use('/api/admin/ledger', ledgerRouter);
app.use('/internal/wallet/shamo', shamoInternalRouter);


// ==================== ERROR HANDLING ====================

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not found',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// Global error handler
app.use((error: Error, req: Request, res: Response, next: any) => {
  // Log the full error with stack trace
  logger.error({ err: error, req: req }, '🚨 Express error:');
  
  res.status(500).json({
    error: 'Internal server error',
    message: env.NODE_ENV === 'development' ? error.message : undefined,
    timestamp: new Date().toISOString()
  });
});

// ==================== START SERVER ====================

// Start the server
const server = app.listen(port, () => {
  logger.info(`🌍 Web server running on port ${port}`);
  logger.info(`📡 Bot running in POLLING mode`);
  logger.info(`🏥 Health check: http://localhost:${port}/health`);
  
  // Initialize app after server starts
  initializeApp().catch(error => {
    logger.error('Failed to initialize app:', error);
    process.exit(1);
  });
});

// ==================== GRACEFUL SHUTDOWN ====================

const shutdown = async (signal: string) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  
  try {
    if (botInstance) {
      await botInstance.stop();
      await channelShamoService.shutdown().catch(() => {});
      logger.info('✅ Bot stopped');
      await new Promise(resolve => setTimeout(resolve, 1000)); // extra grace
    }
    
    server.close();
    
    if (serviceHealth.mongodb && mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
      logger.info('✅ MongoDB disconnected');
    }
    
    if (serviceHealth.redis) {
      await redisManager.disconnect();
      logger.info('✅ Redis disconnected');
    }
    
    logger.info('✅ Graceful shutdown complete');
    process.exit(0);
  } catch (error: any) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('uncaughtException', (error) => {
  logger.error('🚨 Uncaught exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('🚨 Unhandled rejection at:', promise, 'reason:', reason);
});