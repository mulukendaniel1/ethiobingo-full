import mongoose, { Schema, Document } from 'mongoose';

export type ShamoStatus = 'active' | 'completed' | 'cancelled' | 'expired';
export type ShamoEndReason = 'all_claimed' | 'manual' | 'expired' | 'cancelled';

export interface IShamoRound extends Document {
  roundId: string;
  status: ShamoStatus;
  startedAt: Date;
  endedAt?: Date;
  endReason?: ShamoEndReason;

  totalButtons: number;
  prizePerButton: number;
  claimedCount: number;
  totalPayout: number;

  eligibilityDepositDays: number;
  cooldownHours: number;

  createdBy?: mongoose.Types.ObjectId;
  triggeredBy: 'auto' | 'manual';

  channelChatId?: string | null;
channelMessageId?: number | null;

  createdAt: Date;
  updatedAt: Date;
}

const ShamoRoundSchema = new Schema<IShamoRound>({
  roundId: { type: String, required: true, unique: true, index: true },
  status: {
    type: String,
    enum: ['active', 'completed', 'cancelled', 'expired'],
    default: 'active',
    index: true,
  },
  startedAt: { type: Date, required: true },
  endedAt: Date,
  endReason: { type: String, enum: ['all_claimed', 'manual', 'expired', 'cancelled'] },

  totalButtons: { type: Number, default: 50, min: 1, max: 500 },
  prizePerButton: { type: Number, default: 50, min: 1 },
  claimedCount: { type: Number, default: 0 },
  totalPayout: { type: Number, default: 0 },

  eligibilityDepositDays: { type: Number, default: 7, min: 0 },
  cooldownHours: { type: Number, default: 24, min: 1 },

  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  triggeredBy: { type: String, enum: ['auto', 'manual'], default: 'manual' },
  channelChatId:    { type: String, default: null },
channelMessageId: { type: Number, default: null },
}, { timestamps: true });

ShamoRoundSchema.index(
  { status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'active' },
    name: 'one_active_round_only',
  }
);

export const ShamoRound = mongoose.model<IShamoRound>('ShamoRound', ShamoRoundSchema);