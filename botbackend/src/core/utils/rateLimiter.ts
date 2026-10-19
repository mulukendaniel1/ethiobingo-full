// src/core/utils/rateLimiter.ts
import { RateLimit } from '../database/models/RateLimit';
import { logger } from './logger';
import { Types } from 'mongoose';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  reset: Date; // Change from reset to resetTime to match model
  blockReason?: string;
  isBlocked?: boolean;
}

export class RateLimiter {
  static async checkRateLimit(
  key: string,
  action: string,
  maxRequests: number,
  windowMs: number
): Promise<RateLimitResult> {
  try {
    const result = await RateLimit.checkLimit(key, action, maxRequests, windowMs);
    return {
      allowed: result.allowed,
      remaining: result.remaining,
      reset: result.resetTime, // Map resetTime to reset
      blockReason: result.blockReason,
      isBlocked: result.isBlocked
    };
  } catch (error) {
    logger.error('Rate limit check failed:', error);
    return {
      allowed: true,
      remaining: maxRequests,
      reset: new Date(Date.now() + windowMs)
    };
  }
}

  static async getUserRateLimitStatus(userId: Types.ObjectId): Promise<any> {
    try {
      return await RateLimit.getUserStats(userId);
    } catch (error) {
      logger.error('Failed to get user rate limit status:', error);
      return { userId, actions: [], timestamp: new Date() };
    }
  }

  static async blockUser(
    userId: Types.ObjectId,
    action: string,
    durationMs: number,
    reason: string
  ): Promise<void> {
    try {
      await RateLimit.blockUser(userId, action, durationMs, reason);
      logger.info(`Blocked user ${userId} for ${action}: ${reason}`);
    } catch (error) {
      logger.error('Failed to block user:', error);
    }
  }

  // Manual rate limits for different actions
  static readonly LIMITS = {
    REGISTRATION: {
      key: 'registration',
      maxRequests: 10,
      windowMs: 60 * 60 * 1000 // 1 hour
    },
    PAYOUT: {
      key: 'payout',
      maxRequests: 3,
      windowMs: 24 * 60 * 60 * 1000 // 24 hours
    },
    MESSAGES: {
      key: 'messages',
      maxRequests: 20,
      windowMs: 60 * 1000 // 1 minute
    }
  };

  static async checkUserRegistrationLimit(userId: Types.ObjectId): Promise<boolean> {
    const result = await this.checkRateLimit(
      `user:${userId}:registration`,
      'registration',
      this.LIMITS.REGISTRATION.maxRequests,
      this.LIMITS.REGISTRATION.windowMs
    );
    return result.allowed;
  }

  static async checkUserPayoutLimit(userId: Types.ObjectId): Promise<boolean> {
    const result = await this.checkRateLimit(
      `user:${userId}:payout`,
      'payout',
      this.LIMITS.PAYOUT.maxRequests,
      this.LIMITS.PAYOUT.windowMs
    );
    return result.allowed;
  }
}