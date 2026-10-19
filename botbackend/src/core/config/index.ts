// src/core/config/index.ts - FIXED VERSION
import { env } from './env';
import { Constants } from './constants';
import { getSettings } from '../utils/settingsCache';

export const config = {
  env,
  constants: Constants,
  
  // Bot configuration
  bot: {
    token: env.BOT_TOKEN,
    webhookUrl: env.WEBHOOK_URL || undefined,
    adminIds: env.ADMIN_IDS?.split(',').map(id => parseInt(id.trim())) || [],
    supportUsername: getSettings().supportUsername || '@support',
    channelUsername: getSettings().channelUsername || '@channel'
  },
  
  // Database configuration
  database: {
    mongoUri: env.MONGODB_URI,
    redisUrl: env.REDIS_URL,
    connectionTimeout: 10000,
    maxPoolSize: 10,
    minPoolSize: 5
  },
  
  // Rate limiting configuration
  rateLimiting: {
    maxJobsPerHour: env.MAX_JOBS_PER_HOUR,
    minTimeBetweenActions: env.MIN_TIME_BETWEEN_ACTIONS,
    maxConcurrentJobs: env.MAX_CONCURRENT_JOBS
  },
  
  // Commission configuration
  commission: {
    rate: env.COMMISSION_RATE,
    minimumPayout: env.MINIMUM_PAYOUT,
    networkFeeBuffer: env.NETWORK_FEE_BUFFER,
    // Use the actual referral rates from env
    referralRates: env.REFERRAL_LEVEL_RATES
      .split(',')
      .map(rate => parseFloat(rate.trim()))
  },
  
  // Queue configuration
  queue: {
    redisUrl: env.REDIS_URL,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000
      },
      removeOnComplete: 100,
      removeOnFail: 50
    }
  },
  
  // Security configuration
  security: {
    encryptionKey: env.ENCRYPTION_KEY, // Removed 'change-this-in-production'
    jwtSecret: env.JWT_SECRET,         // Removed 'change-this-too'
    sessionTtl: env.SESSION_TTL || 7 * 24 * 60 * 60 * 1000,
    maxSessionsPerUser: env.MAX_SESSIONS_PER_USER
  },
  
  // Monitoring configuration
  monitoring: {
    metricsPort: env.METRICS_PORT,
    healthCheckInterval: 5 * 60 * 1000, // 5 minutes
    logLevel: env.LOG_LEVEL,
    sentryDsn: env.SENTRY_DSN
  },
  
  // Backup configuration
  backup: {
    interval: env.BACKUP_INTERVAL,
    retentionDays: env.BACKUP_RETENTION_DAYS,
    backupDir: env.BACKUP_DIR || './backups'
  },
  
  // Feature flags - REMOVED parseEnvBoolean since env variables are already booleans
  features: {
    enableAutoPayout: env.ENABLE_AUTO_PAYOUT,
    enableReferralSystem: env.REFERRAL_SYSTEM_ENABLED, // Use the actual env variable
    enableMultiLanguage: env.ENABLE_MULTI_LANGUAGE,
    enableAdvancedAnalytics: env.ENABLE_ADVANCED_ANALYTICS
  },
  
  
};

// Type exports
export type Config = typeof config;
export type BotConfig = typeof config.bot;
export type DatabaseConfig = typeof config.database;

// Environment validation
export function validateConfig(): void {
  const required = [
    'BOT_TOKEN',
    'MONGODB_URI',
    'REDIS_URL'
  ];
  
  const missing = required.filter(key => !(env as any)[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  
  console.log('✅ Configuration validated successfully');
}