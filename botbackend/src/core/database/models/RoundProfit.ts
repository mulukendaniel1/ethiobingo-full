//src\core\database\models\RoundProfit.ts
import mongoose, { Schema, Document } from 'mongoose';

export interface IRoundProfit extends Document {
  roundId: string;
  operatorId: string;
  totalStaked: number;
  totalPayout: number;
  totalCommission: number;
  crashPoint: number;
  startTime: Date;
  endTime: Date;
  netProfit: number; // totalCommission - (totalPayout? Actually totalCommission is already 10% of totalStaked? No, we compute net as (totalStaked - totalPayout) because commission is already accounted in cashout)
  createdAt: Date;
  drawnBalls: number[];
}

const RoundProfitSchema = new Schema<IRoundProfit>({
  roundId: { type: String, required: true, unique: true },
  operatorId: { type: String, required: true },
  totalStaked: { type: Number, required: true, min: 0 },
  totalPayout: { type: Number, required: true, min: 0 },
  totalCommission: { type: Number, required: true, min: 0 },
  crashPoint: { type: Number, required: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  netProfit: { type: Number, required: true }, // totalStaked - totalPayout (since commission is already deducted from payout)
  createdAt: { type: Date, default: Date.now },
  drawnBalls: { type: [Number], default: [] },
});

RoundProfitSchema.index({ operatorId: 1, createdAt: -1 });

export const RoundProfit = mongoose.model<IRoundProfit>('RoundProfit', RoundProfitSchema);