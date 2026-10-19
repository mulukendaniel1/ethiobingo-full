//src\core\database\models\UserBetHistory.ts
import mongoose, { Schema, Document } from 'mongoose';

export interface IUserBetHistory extends Document {
  userId: string;
  roundId: string;
  cardId?: string;
  action: 'buy' | 'win';
  amount: number;
  createdAt: Date;
  expiresAt: Date;
}

const UserBetHistorySchema = new Schema<IUserBetHistory>({
  userId: { type: String, required: true, index: true },
  roundId: { type: String, required: true },
  cardId: String,
  action: { type: String, enum: ['buy', 'win'], required: true },
  amount: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }, // 30 days – keep bets long enough for monthly reporting
});

UserBetHistorySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
UserBetHistorySchema.index({ createdAt: -1 });
UserBetHistorySchema.index({ userId: 1, createdAt: -1 });
UserBetHistorySchema.index({ action: 1, createdAt: -1, userId: 1 });

export const UserBetHistory = mongoose.model<IUserBetHistory>('UserBetHistory', UserBetHistorySchema);