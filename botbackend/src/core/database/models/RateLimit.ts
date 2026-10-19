//src/core/database/models/RateLimit.ts
import { Schema, model, Document, Model, Types } from 'mongoose';
import { sanitizeInput } from '../../utils/security';
export interface IRateLimit extends Document {
  // Identification
  key: string;
  userId?: Types.ObjectId;
  ipAddress?: string;
  
  // Rate limiting data
  action: string;
  count: number;
  windowStart: Date;
  windowEnd: Date;
  
  // Limits
  maxRequests: number;
  windowMs: number;
  
  // Status
  isBlocked: boolean;
  blockUntil?: Date;
  blockReason?: string;
  
  // Metadata
  userAgent?: string;
  country?: string;
  deviceId?: string;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  lastRequestAt: Date;
  
  // Custom instance methods (avoiding conflict with Document methods)
  resetCount(): Promise<void>;
  incrementCount(amount?: number): Promise<void>;
}

// Static methods interface
export interface RateLimitModel extends Model<IRateLimit> {
  checkLimit(
    key: string,
    action: string,
    maxRequests: number,
    windowMs: number
  ): Promise<RateLimitResult>;
  
  blockUser(
    userId: Types.ObjectId,
    action: string,
    durationMs: number,
    reason: string
  ): Promise<void>;
  
  getUserStats(userId: Types.ObjectId): Promise<UserRateLimitStats>;
}

const RateLimitSchema = new Schema<IRateLimit, RateLimitModel>({
  // Identification
  key: { type: String, required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  ipAddress: { type: String, index: true },
  
  // Rate limiting data
  action: { type: String, required: true, index: true },
  count: { type: Number, default: 1, min: 0 },
  windowStart: { type: Date, required: true, index: true },
  windowEnd: { type: Date, required: true, index: true },
  
  // Limits
  maxRequests: { type: Number, default: 10 },
  windowMs: { type: Number, default: 60 * 60 * 1000 }, // 1 hour
  
  // Status
  isBlocked: { type: Boolean, default: false, index: true },
  blockUntil: { type: Date, index: true },
  blockReason: String,
  
  // Metadata
  userAgent: String,
  country: String,
  deviceId: String,
  
  // Timestamps
  lastRequestAt: { type: Date, default: Date.now, required: true }
}, {
  timestamps: true
});

// Compound indexes
RateLimitSchema.index({ key: 1, action: 1, windowStart: 1 });
RateLimitSchema.index({ userId: 1, action: 1, isBlocked: 1 });
RateLimitSchema.index({ ipAddress: 1, action: 1, isBlocked: 1 });
RateLimitSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 }); // 7 days TTL

// Static methods
// Update the checkLimit method to properly handle the count
RateLimitSchema.statics.checkLimit = async function(
  key: string,
  action: string,
  maxRequests: number,
  windowMs: number
): Promise<RateLimitResult> {
  const safeKey = sanitizeInput(key);
  const safeAction = sanitizeInput(action);
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowMs);

  let rateLimit = await this.findOne({
    key: safeKey,
    action: safeAction,
    windowStart: { $gte: windowStart },
    windowEnd: { $gt: now }
  });
  
  if (!rateLimit) {
    // Start new window
    rateLimit = new this({
      key,
      action,
      windowStart: new Date(now.getTime()), // Window starts now
      windowEnd: new Date(now.getTime() + windowMs),
      maxRequests,
      windowMs,
      count: 0, // Start at 0
      lastRequestAt: now
    });
  }
  
  // Check if blocked
  if (rateLimit.isBlocked && rateLimit.blockUntil && rateLimit.blockUntil > now) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: rateLimit.blockUntil,
      blockReason: rateLimit.blockReason,
      isBlocked: true
    };
  }
  
  // Clear block if expired
  if (rateLimit.isBlocked && (!rateLimit.blockUntil || rateLimit.blockUntil <= now)) {
    rateLimit.isBlocked = false;
    rateLimit.blockUntil = undefined;
    rateLimit.blockReason = undefined;
  }
  
  // Check if we've already hit the limit (check BEFORE incrementing)
  if (rateLimit.count >= maxRequests) {
    // Record this violation
    const violationWindowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const violations = await this.countDocuments({
      key,
      action,
      windowStart: { $gte: violationWindowStart },
      count: { $gte: maxRequests }
    });
    
    if (violations >= 2) { // Already have 2 violations? This makes 3
      // Block for 1 hour after 3 violations
      rateLimit.isBlocked = true;
      rateLimit.blockUntil = new Date(now.getTime() + 60 * 60 * 1000);
      rateLimit.blockReason = 'Too many rate limit violations';
      await rateLimit.save();
      
      return {
        allowed: false,
        remaining: 0,
        resetTime: rateLimit.blockUntil,
        blockReason: rateLimit.blockReason,
        isBlocked: true
      };
    }
    
    // Just deny without blocking
    return {
      allowed: false,
      remaining: 0,
      resetTime: rateLimit.windowEnd,
      isBlocked: false
    };
  }
  
  // Increment count (this is the current request)
  rateLimit.count += 1;
  rateLimit.lastRequestAt = now;
  await rateLimit.save();
  
  // Calculate remaining (maxRequests - current count)
  // If count is 1, remaining is 4 (for max 5)
  const remaining = Math.max(0, maxRequests - rateLimit.count);
  
  return {
    allowed: true,
    remaining,
    resetTime: rateLimit.windowEnd,
    isBlocked: false
  };
};

RateLimitSchema.statics.blockUser = async function(
  userId: Types.ObjectId,
  action: string,
  durationMs: number,
  reason: string
): Promise<void> {
  const safeAction = sanitizeInput(action);
  const safeReason = sanitizeInput(reason);
  await this.updateMany(
    { userId, action: safeAction },
    {
      $set: {
        isBlocked: true,
        blockUntil: new Date(Date.now() + durationMs),
        blockReason: safeReason
      }
    }
  );
};

RateLimitSchema.statics.getUserStats = async function(userId: Types.ObjectId): Promise<UserRateLimitStats> {
  const stats = await this.aggregate([
    {
      $match: {
        userId,
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
      }
    },
    {
      $group: {
        _id: {
          action: '$action',
          isBlocked: '$isBlocked'
        },
        count: { $sum: 1 },
        totalRequests: { $sum: '$count' },
        lastRequest: { $max: '$lastRequestAt' }
      }
    },
    {
      $group: {
        _id: '$_id.action',
        totalRequests: { $sum: '$totalRequests' },
        blockedCount: {
          $sum: {
            $cond: [{ $eq: ['$_id.isBlocked', true] }, '$count', 0]
          }
        },
        lastRequest: { $max: '$lastRequest' }
      }
    }
  ]);
  
  return {
    userId,
    actions: stats.map(stat => ({
      action: stat._id,
      totalRequests: stat.totalRequests,
      blockedCount: stat.blockedCount,
      lastRequest: stat.lastRequest
    })),
    timestamp: new Date()
  };
};

// Custom instance methods (avoiding conflict with Document.increment())
RateLimitSchema.methods.resetCount = async function(): Promise<void> {
  this.count = 0;
  this.isBlocked = false;
  this.blockUntil = undefined;
  this.blockReason = undefined;
  await this.save();
};

RateLimitSchema.methods.incrementCount = async function(amount: number = 1): Promise<void> {
  this.count += amount;
  this.lastRequestAt = new Date();
  await this.save();
};

export const RateLimit = model<IRateLimit, RateLimitModel>('RateLimit', RateLimitSchema);

// Type definitions
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: Date;
  blockReason?: string;
  isBlocked: boolean;
}

export interface UserRateLimitStats {
  userId: Types.ObjectId;
  actions: Array<{
    action: string;
    totalRequests: number;
    blockedCount: number;
    lastRequest: Date;
  }>;
  timestamp: Date;
}