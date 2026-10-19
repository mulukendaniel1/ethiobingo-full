//apps\bingo-game-engine\src\models\RoundProfit.ts
import mongoose, { Schema, Document } from 'mongoose';

export interface IRoundProfit extends Document {
  roundId: string;
  operatorId: string;
  totalStaked: number;
  totalPayout: number;
  totalCommission: number;
  winnerId?: string;
  cardsSold: number;
  startTime: Date;
  endTime: Date;
  netProfit: number; // totalStaked - totalPayout
  drawnBalls: number[];
}

const RoundProfitSchema = new Schema<IRoundProfit>({
  roundId: { type: String, required: true, unique: true },
  operatorId: { type: String, required: true },
  totalStaked: { type: Number, required: true, min: 0 },
  totalPayout: { type: Number, required: true, min: 0 },
  totalCommission: { type: Number, required: true, min: 0 },
  winnerId: String,
  cardsSold: { type: Number, default: 0 },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  netProfit: { type: Number, required: true },
  drawnBalls: { type: [Number], default: [] },
}, { timestamps: true });

RoundProfitSchema.index({ operatorId: 1, createdAt: -1 });

export const RoundProfit = mongoose.model<IRoundProfit>('RoundProfit', RoundProfitSchema);