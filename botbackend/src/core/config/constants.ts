// src/core/config/constants.ts - FIXED VERSION
import { getSettings } from '../utils/settingsCache';
import { env } from './env';

export const Constants = {
  // Bot configuration
  BOT: {
    NAME: 'ethio_bingoobot',
    VERSION: '2.0.0',
    SUPPORT_USERNAME: getSettings().supportUsername,
    CHANNEL_USERNAME: getSettings().channelUsername,
  },
  
  // Job status constants
  JOB_STATUS: {
    PENDING: 'pending',
    ASSIGNED: 'assigned',
    SUBMITTED: 'submitted',
    UNDER_REVIEW: 'under_review',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    ON_HOLD: 'on_hold',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
    FAILED: 'failed'
  } as const,

  // Account status constants
  ACCOUNT_STATUS: {
    AVAILABLE: 'available',
    ASSIGNED: 'assigned',
    SUBMITTED: 'submitted',
    COMPLETED: 'completed',
    FAILED: 'failed',
    HOLD: 'hold'
  } as const,
  
  // Payout status constants
  PAYOUT_STATUS: {
    PENDING: 'pending',
    PROCESSING: 'processing',
    COMPLETED: 'completed',
    FAILED: 'failed',
    CANCELLED: 'cancelled'
  } as const,
  
  // Audit constants
  AUDIT_ACTION_TYPES: {
    CREATE: 'CREATE',
    READ: 'READ',
    UPDATE: 'UPDATE',
    DELETE: 'DELETE',
    SYSTEM: 'SYSTEM',
    FINANCIAL: 'FINANCIAL',
    SECURITY: 'SECURITY'
  } as const,
  
  AUDIT_SEVERITY: {
    INFO: 'INFO',
    WARNING: 'WARNING',
    ERROR: 'ERROR',
    CRITICAL: 'CRITICAL'
  } as const,
  
  // Validation constants
  VALIDATION: {
    EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    TRX_ADDRESS_REGEX: /^T[a-zA-Z0-9]{33}$/,
    USERNAME_REGEX: /^[a-zA-Z0-9_]{3,20}$/,
    PHONE_REGEX: /^\+?[1-9]\d{1,14}$/,
    TELEBIRR_PHONE_REGEX: /^09\d{8}$/
  },
  
  // Financial constants
  FINANCIAL: {
    COMMISSION_RATE: env.COMMISSION_RATE,
    MINIMUM_PAYOUT: env.MINIMUM_PAYOUT,
    MAXIMUM_PAYOUT: 100.00,
    DAILY_PAYOUT_LIMIT: 3,
    NETWORK_FEE_BUFFER: env.NETWORK_FEE_BUFFER,
    HOLD_PERIOD_HOURS: 1
  },

  // Telebirr constants
  TELEBIRR: {
    ENABLED: env.TELEBIRR_ENABLED,
    FEE_ETB: env.TELEBIRR_FEE_ETB,
    USD_TO_ETB_RATE: env.USD_TO_ETB_RATE,
    MIN_WITHDRAWAL_USD: env.TELEBIRR_MIN_WITHDRAWAL_USD,
    MAX_WITHDRAWAL_USD: env.TELEBIRR_MAX_WITHDRAWAL_USD
  },
  
  // Referral constants
  REFERRAL: {
    ENABLED: env.REFERRAL_SYSTEM_ENABLED,
    COMMISSION_RATE: env.REFERRAL_COMMISSION_RATE,
    LEVELS: env.REFERRAL_LEVELS,
    LEVEL_RATES: env.REFERRAL_LEVEL_RATES
      .split(',')
      .map(rate => parseFloat(rate.trim()))
  },
  
  // Commission & Task Payment
  TASK: {
    STANDARD_PAYMENT: env.STANDARD_TASK_PAYMENT
  },
  
  // Security constants
  SECURITY: {
    SESSION_TTL: 7 * 24 * 60 * 60 * 1000,
    MAX_SESSIONS_PER_USER: 3,
    PASSWORD_MIN_LENGTH: 8,
    REFERRAL_CODE_LENGTH: 8
  },

  // ETB Coin System
  ETB_COIN: {
    ENABLED: getSettings().etbCoinEnabled,
    ETB_TO_ETB_RATE: env.ETB_TO_ETB_RATE,
    REWARD_PER_TASK: env.ETB_REWARD_PER_TASK,
    SOURCE_COMMISSION: env.ETB_REWARD_SOURCE_COMMISSION,
    
    // For future ecommerce use
    MIN_REDEMPTION_AMOUNT: 10, // Minimum ETB coins for redemption
    MAX_REDEMPTION_AMOUNT: 1000,
    REDEMPTION_FEE_PERCENTAGE: 0.01, // 1% redemption fee
  }
  
} as const;

// Type exports remain the same
export type JobStatus = typeof Constants.JOB_STATUS[keyof typeof Constants.JOB_STATUS];
export type AccountStatus = typeof Constants.ACCOUNT_STATUS[keyof typeof Constants.ACCOUNT_STATUS];
export type PayoutStatus = typeof Constants.PAYOUT_STATUS[keyof typeof Constants.PAYOUT_STATUS];
export type AuditActionType = typeof Constants.AUDIT_ACTION_TYPES[keyof typeof Constants.AUDIT_ACTION_TYPES];
export type AuditSeverity = typeof Constants.AUDIT_SEVERITY[keyof typeof Constants.AUDIT_SEVERITY];

// Rest of the file remains the same
export const AuditConstants = {
  SOURCES: ['SYSTEM', 'API', 'BOT', 'CRON', 'QUEUE', 'WEB', 'ORCHESTRATOR', 'ADMIN'] as const,
  ENVIRONMENTS: ['development', 'staging', 'production', 'testing'] as const
};

export type AuditEnvironment = typeof AuditConstants.ENVIRONMENTS[number];
export type AuditSource = typeof AuditConstants.SOURCES[number];

export const VIDEO_PATHS = {
  HOW_TO_CREATE_ACCOUNT: './videos/How_to_create_account.mp4'
};