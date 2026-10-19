// src/core/database/models/WeeklyRewardPayout.ts
import mongoose, { Schema, Document, model } from 'mongoose';

export type RewardType = 'depositor' | 'referrer';
export type PayoutStatus = 'paid' | 'reverted';

export interface IWeeklyRewardPayout extends Document {
  weekId: string;               // e.g., "2025-W45"
  weekStart: Date;              // Monday 00:00:00 UTC
  weekEnd: Date;                // Sunday 23:59:59.999 UTC
  type: RewardType;
  userId: mongoose.Types.ObjectId;
  telegramId: number;
  username?: string;
  firstName?: string;
  rank: number;                 // 1 = top
  metricValue: number;          // total deposits ETB or referral count
  rewardAmount: number;
  status: PayoutStatus;
  paidAt: Date;
  revertedAt?: Date;
  revertedBy?: mongoose.Types.ObjectId;
  revertAmount?: number;        // amount actually recovered
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const WeeklyRewardPayoutSchema = new Schema<IWeeklyRewardPayout>({
  weekId: { type: String, required: true, index: true },
  weekStart: { type: Date, required: true },
  weekEnd: { type: Date, required: true },
  type: { type: String, enum: ['depositor', 'referrer'], required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  telegramId: { type: Number, required: true },
  username: String,
  firstName: String,
  rank: { type: Number, required: true },
  metricValue: { type: Number, required: true },
  rewardAmount: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ['paid', 'reverted'], default: 'paid', index: true },
  paidAt: { type: Date, default: Date.now },
  revertedAt: Date,
  revertedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  revertAmount: Number,
  notes: String,
}, { timestamps: true });

// TTL: auto-delete history after 30 days
WeeklyRewardPayoutSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

// Prevent double payment: one payout per user per type per week
WeeklyRewardPayoutSchema.index({ weekId: 1, type: 1, userId: 1 }, { unique: true });

WeeklyRewardPayoutSchema.index({ type: 1, createdAt: -1 });
WeeklyRewardPayoutSchema.index({ status: 1, createdAt: -1 });

export const WeeklyRewardPayout = model<IWeeklyRewardPayout>(
  'WeeklyRewardPayout',
  WeeklyRewardPayoutSchema
);