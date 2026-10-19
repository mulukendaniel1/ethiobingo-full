// src/core/config/env.ts - FIXED VERSION
import { z } from 'zod';

const envSchema = z.object({
  // Telegram Bot (KEEP)
  BOT_TOKEN: z.string(),
  BOT_USERNAME: z.string().optional(),
  
  // MongoDB Atlas (KEEP)
  MONGODB_URI: z.string().refine((val) => val.startsWith('mongodb://') || val.startsWith('mongodb+srv://'), {
    message: 'MongoDB URI must start with mongodb:// or mongodb+srv://',
  }),
  
  // Redis (for BullMQ - KEEP)
  REDIS_URL: z.string().url(),
  REDIS_PASSWORD: z.string().optional(),
  
  
  // Rate Limits (KEEP but simplify)
  MAX_JOBS_PER_HOUR: z.string().transform(Number).default('10'),
  MIN_TIME_BETWEEN_ACTIONS: z.string().transform(Number).default('2000'),
  MAX_CONCURRENT_JOBS: z.string().transform(Number).default('3'),
  
  // Commission Settings (KEEP)
  MINIMUM_PAYOUT: z.string().transform(Number).default('0.50'),
  
  // Security (KEEP)
  ENCRYPTION_KEY: z.string().default('change-this-to-a-secure-random-string-32-chars'),
  JWT_SECRET: z.string().default('change-this-to-a-secure-random-string'),
  ADMIN_IDS: z.string().default(''),
  MONITORING_TOKEN: z.string().default(''),
  
  // Server (KEEP)
  PORT: z.string().transform(Number).default('3000'),
  NODE_ENV: z.enum(['development', 'production', 'testing', 'staging', 'test']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  WEBHOOK_URL: z.string().url().optional(),
  WEBHOOK_SECRET: z.string().optional(),
  
  // Session Management (KEEP)
  SESSION_TTL: z.string().transform(Number).default('604800000'),
  MAX_SESSIONS_PER_USER: z.string().transform(Number).default('3'),
  
  // Monitoring (KEEP)
  SENTRY_DSN: z.string().optional(),
  METRICS_PORT: z.string().transform(Number).default('9090'),
  ENABLE_MONITORING: z.string().default('false'),
  
  // Backup (KEEP)
  BACKUP_INTERVAL: z.string().transform(Number).default('86400000'),
  BACKUP_RETENTION_DAYS: z.string().transform(Number).default('30'),
  BACKUP_DIR: z.string().default('./backups'),
  
  // Feature flags (REMOVE automation, keep others)
  ENABLE_AUTO_PAYOUT: z.string().transform(val => val === 'true').default('false'),
  ENABLE_MULTI_LANGUAGE: z.string().transform(val => val === 'true').default('false'),
  ENABLE_ADVANCED_ANALYTICS: z.string().transform(val => val === 'true').default('false'),

  // FIXED: Convert strings to proper types
  TELEBIRR_ENABLED: z.string()
    .transform((val) => val.toLowerCase() === 'true')
    .default('true'),
  TELEBIRR_FEE_ETB: z.string()
    .transform(Number)
    .default('5'),
  USD_TO_ETB_RATE: z.string()
    .transform(Number)
    .default('56.5'),
  TELEBIRR_MIN_WITHDRAWAL_USD: z.string()
    .transform(Number)
    .default('0.50'),
  TELEBIRR_MAX_WITHDRAWAL_USD: z.string()
    .transform(Number)
    .default('100'),

  // Commission & Fees
  STANDARD_TASK_PAYMENT: z.string()
    .transform(Number)
    .default('0.16'),
  COMMISSION_RATE: z.string()
    .transform(Number)
    .default('0.20'),
  NETWORK_FEE_BUFFER: z.string()
    .transform(Number)
    .default('0.01'),

  // Referral System
  REFERRAL_SYSTEM_ENABLED: z.string()
    .transform((val) => val.toLowerCase() === 'true')
    .default('true'),
  REFERRAL_COMMISSION_RATE: z.string()
    .transform(Number)
    .default('0.10'),
  REFERRAL_LEVELS: z.string()
    .transform(Number)
    .default('3'),
  REFERRAL_LEVEL_RATES: z.string()
    .default('0.10,0.05,0.02'),
    
  // URLs (KEEP)
  SUPPORT_WEBSITE: z.string().url().optional(),
  
  // System (KEEP)
  LOG_DIR: z.string().default('/tmp/logs'),

  // Support & Channel (KEEP)
  SUPPORT_USERNAME: z.string()
    .default('Ethiobingosupport2'),
  
  CHANNEL_USERNAME: z.string()
    .default('ethio_bingo7'),

  // ETB Coin System
  ETB_COIN_ENABLED: z.string()
    .transform((val) => val.toLowerCase() === 'true')
    .default('true'),
  ETB_TO_ETB_RATE: z.string()
    .transform(Number)
    .default('2'), // 2 ETB = 1 ETB coin
  ETB_REWARD_PER_TASK: z.string()
    .transform(Number)
    .default('1'), // 1 ETB coin per completed task
  
  // Commission allocation for ETB rewards
  ETB_REWARD_SOURCE_COMMISSION: z.string()
    .transform(Number)
    .default('0.05'), // 5% of commission allocated for ETB rewards
  
  // ==================== ETB DEPOSIT ACCOUNT DETAILS ====================
  CBE_ACCOUNT_NAME: z.string().default('Your Name'),
  CBE_ACCOUNT_NUMBER: z.string().default('1000266285594'),
  CBE_INSTRUCTIONS_AMH: z.string().default('ወደሚከተለው የንግድ ባንክ አካውንት ገንዘብ ያስገቡ እና የዝውውር መለያዎን ማለትም TRANSACTION ID ያስገቡ።'),

  ABYSSINIA_ACCOUNT_NAME: z.string().default('Your Name'),
  ABYSSINIA_ACCOUNT_NUMBER: z.string().default('77411027'),
  ABYSSINIA_INSTRUCTIONS_AMH: z.string().default('ወደሚከተለው የአቢሲንያ ባንክ አካውንት ገንዘብ ያስገቡ እና የዝውውር መለያዎን ማለትም TRANSACTION ID ያስገቡ።'),

  CBE_BIRR_ACCOUNT_NAME: z.string().default('Your Name'),
  CBE_BIRR_PHONE: z.string().default('0951217455'),
  CBE_BIRR_INSTRUCTIONS_AMH: z.string().default('ወደሚከተለው የሲቢኢ ብር ስልክ ቁጥር ገንዘብ ያስገቡ እና የዝውውር መለያዎን ማለትም TRANSACTION ID ያስገቡ።'),

  TELEBIRR_ACCOUNT_NAME: z.string().default('Your Name'),
  TELEBIRR_PHONE: z.string().default('0900212426'),
  TELEBIRR_INSTRUCTIONS_AMH: z.string().default('ወደሚከተለው የቴሌቢር ስልክ ቁጥር ገንዘብ ያስገቡ እና የዝውውር መለያዎን ማለትም TRANSACTION ID ያስገቡ።'),
});

export type Env = z.infer<typeof envSchema>;

// Parse environment variables
let env: Env;

try {
  env = envSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error('❌ Environment validation failed:');
    error.errors.forEach(err => {
      console.error(`  - ${err.path.join('.')}: ${err.message}`);
    });
    if (process.env.NODE_ENV !== 'production') {
      process.exit(1);
    }
  }
  // Use safe defaults for production
  env = {
    BOT_TOKEN: process.env.BOT_TOKEN || '',
    MONGODB_URI: process.env.MONGODB_URI || '',
    REDIS_URL: process.env.REDIS_URL || '',
    PORT: parseInt(process.env.PORT || '3000'),
    NODE_ENV: (process.env.NODE_ENV as any) || 'development',
  } as Env;
}

export { env };