//src/core/types/index.ts

import mongoose from 'mongoose';

// Re-export all types for easy access
export * from './telegram';

// Core types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: Date;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface FilterOptions {
  page?: number;
  limit?: number;
  sort?: Record<string, 1 | -1>;
  search?: string;
  filters?: Record<string, any>;
}

// User types
export interface UserProfile {
  telegramId: number;
  username?: string;
  firstName: string;
  lastName?: string;
  balanceMain: number;
  balanceHold: number;
  totalEarned: number;
  totalWithdrawn: number;
  referralCode: string;
  referralCount: number;
  referralEarnings: number;
  jobsCompleted: number;
  successRate: number;
  isAdmin: boolean;
  createdAt: Date;
}

export interface UserStats {
  userId: string;
  dailyEarnings: number;
  weeklyEarnings: number;
  monthlyEarnings: number;
  totalJobs: number;
  successRate: number;
  averageCompletionTime: number;
  preferredServices: string[];
}

export interface ReferralCommission {
  jobId: string;
  fromUserId: mongoose.Types.ObjectId;
  amount: number;
  level: number;
  createdAt: Date;
}

export interface ReferralEntry {
  userId: mongoose.Types.ObjectId;
  level: number;
  joinedAt: Date;
}

export interface BalanceHold {
  jobId: string;
  amount: number;
  createdAt: Date;
}

// Job types
export interface JobDetails {
  jobId: string;
  userId: string;
  status: string;
  stage: string;
  credentials: JobCredentials;
  amount: number;
  commission: number;
  netAmount: number;
  assignedAt: Date;
  submittedAt?: Date;
  releaseAt?: Date;
  completedAt?: Date;
  externalBotMessageId?: number;
  confirmationHash?: string;
}

export interface JobCredentials {
  service: string;
  firstName: string;
  lastName?: string;
  email: string;
  password: string;
  recoveryEmail?: string;
  phoneNumber?: string;
  dob?: Date;
  gender?: string;
  address?: string;
  zipCode?: string;
}

export interface JobStats {
  total: number;
  completed: number;
  failed: number;
  pending: number;
  onHold: number;
  successRate: number;
  totalAmount: number;
  averageAmount: number;
}

// Account types
export interface AccountData {
  service: string;
  email: string;
  password: string;
  firstName: string;
  lastName?: string;
  recoveryEmail?: string;
  country?: string;
  price: number;
  payoutAmount: number;
  successRate: number;
  status: string;
  tags: string[];
}

export interface AccountPoolStats {
  total: number;
  available: number;
  assigned: number;
  completed: number;
  failed: number;
  successRate: number;
  byService: Record<string, number>;
}

// Payout types
export interface PayoutDetails {
  payoutId: string;
  userId: string;
  amountUSD: number;
  amountTRX: number;
  trxAddress: string;
  transactionHash?: string;
  status: string;
  commission: number;
  networkFee: number;
  finalAmount: number;
  createdAt: Date;
  completedAt?: Date;
}

export interface PayoutStats {
  total: number;
  completed: number;
  pending: number;
  failed: number;
  totalAmount: number;
  totalFees: number;
  averageAmount: number;
  dailyVolume: number;
}

// Queue types
export interface QueueJob {
  id: string;
  name: string;
  data: any;
  opts: any;
  progress: number;
  delay: number;
  timestamp: number;
  attemptsMade: number;
  failedReason?: string;
  stacktrace?: string[];
  returnvalue?: any;
  finishedOn?: number;
  processedOn?: number;
}

export interface QueueStats {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

// System types
export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  components: {
    database: ComponentHealth;
    redis: ComponentHealth;
    queues: ComponentHealth;
    mtproto: ComponentHealth;
    tron: ComponentHealth;
  };
  metrics: {
    uptime: number;
    memory: NodeJS.MemoryUsage;
    cpu: NodeJS.CpuUsage;
    responseTime: number;
  };
  timestamp: Date;
}

export interface ComponentHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency?: number;
  error?: string;
  details?: any;
}

export interface SystemMetrics {
  users: {
    total: number;
    active: number;
    newToday: number;
  };
  jobs: {
    total: number;
    completedToday: number;
    successRate: number;
    averageAmount: number;
  };
  payouts: {
    totalToday: number;
    amountToday: number;
    pending: number;
  };
  accounts: {
    total: number;
    available: number;
    successRate: number;
  };
  revenue: {
    today: number;
    week: number;
    month: number;
    total: number;
  };
  timestamp: Date;
}

// Financial types
export interface Transaction {
  id: string;
  type: 'credit' | 'debit' | 'hold' | 'release' | 'commission' | 'fee';
  amount: number;
  currency: string;
  userId: string;
  entityType: string;
  entityId: string;
  description: string;
  timestamp: Date;
  metadata?: any;
}

export interface BalanceHistory {
  date: Date;
  balance: number;
  hold: number;
  total: number;
}

// Audit types
export interface AuditLogEntry {
  id: string;
  action: string;
  actionType: string;
  severity: string;
  entityType: string;
  entityId?: string;
  userId?: string;
  description: string;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
  source: string;
  tags: string[];
}

// Configuration types
export interface BotConfig {
  token: string;
  webhookUrl?: string;
  adminIds: number[];
  supportUsername: string;
  channelUsername: string;
}

export interface DatabaseConfig {
  mongoUri: string;
  redisUrl: string;
  connectionTimeout: number;
  maxPoolSize: number;
  minPoolSize: number;
}

export interface RateLimitConfig {
  maxJobsPerHour: number;
  minTimeBetweenActions: number;
  maxConcurrentJobs: number;
}

// Error types
export interface AppError extends Error {
  code: string;
  statusCode: number;
  details?: any;
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

// Utility types
export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type AsyncResult<T, E = Error> = Promise<Result<T, E>>;

export interface Result<T, E = Error> {
  success: boolean;
  data?: T;
  error?: E;
}

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

// Event types
export interface JobEvent {
  type: 'assigned' | 'started' | 'completed' | 'failed' | 'cancelled';
  jobId: string;
  userId: string;
  timestamp: Date;
  data?: any;
}

export interface PaymentEvent {
  type: 'hold' | 'release' | 'payout_requested' | 'payout_completed' | 'payout_failed';
  userId: string;
  amount: number;
  timestamp: Date;
  transactionHash?: string;
  details?: any;
}

export interface SystemEvent {
  type: 'startup' | 'shutdown' | 'maintenance' | 'error' | 'warning';
  component: string;
  message: string;
  timestamp: Date;
  severity: 'info' | 'warning' | 'error' | 'critical';
  details?: any;
}