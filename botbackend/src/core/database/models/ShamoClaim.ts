import mongoose, { Schema, Document } from 'mongoose';

export interface IShamoClaim extends Document {
  roundId: string;
  userId: mongoose.Types.ObjectId;
  telegramId: number;
  buttonIndex: number;
  prizeAmount: number;
  claimedAt: Date;
  ipAddress?: string;
  phoneNumber?: string;
}

const ShamoClaimSchema = new Schema<IShamoClaim>({
  roundId: { type: String, required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  telegramId: { type: Number, required: true },
  buttonIndex: { type: Number, required: true },
  prizeAmount: { type: Number, required: true },
  claimedAt: { type: Date, default: Date.now, index: true },
  ipAddress: String,
  phoneNumber: String,
});

// CRITICAL — prevent double claims at DB level
ShamoClaimSchema.index({ roundId: 1, buttonIndex: 1 }, { unique: true });
ShamoClaimSchema.index({ roundId: 1, userId: 1 }, { unique: true });
// Fast 24h cooldown lookups
ShamoClaimSchema.index({ userId: 1, claimedAt: -1 });
// Multi-account audit
ShamoClaimSchema.index({ ipAddress: 1, claimedAt: -1 });

// TTL: 30-day auto-delete on individual claims.
// NOTE: this is per-claim detail only. ShamoRound keeps aggregate
// (claimedCount, totalPayout) forever, so financial history survives.
ShamoClaimSchema.index(
  { claimedAt: 1 },
  { expireAfterSeconds: 30 * 24 * 60 * 60 }
);

export const ShamoClaim = mongoose.model<IShamoClaim>('ShamoClaim', ShamoClaimSchema);