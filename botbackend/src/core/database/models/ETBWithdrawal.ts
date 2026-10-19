//src/core/database/models/ETBWithdrawal.ts
import mongoose, { Schema, Document } from 'mongoose';

export interface IETBWithdrawal extends Document {
  userId: mongoose.Types.ObjectId;
  requestId: string;
  method: 'cbe' | 'abyssinia' | 'cbebirr' | 'telebirr';
  amountETB: number;
  destinationDetails: string;     // e.g., bank account or phone number
  status: 'pending' | 'processed' | 'rejected';
  adminNotes?: string;
  processedBy?: mongoose.Types.ObjectId;
  processedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ETBWithdrawalSchema = new Schema<IETBWithdrawal>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  requestId: { type: String, required: true, unique: true },
  method: { type: String, enum: ['cbe', 'abyssinia', 'cbebirr', 'telebirr'], required: true },
  amountETB: { type: Number, required: true, min: 0 },
  destinationDetails: { type: String, required: true },
  status: { type: String, enum: ['pending', 'processed', 'rejected'], default: 'pending' },
  adminNotes: String,
  processedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  processedAt: Date,
}, { timestamps: true });

ETBWithdrawalSchema.index({ userId: 1, status: 1 });
ETBWithdrawalSchema.index({ status: 1, createdAt: 1 });
ETBWithdrawalSchema.index({ status: 1, processedAt: -1 });

export const ETBWithdrawal = mongoose.model<IETBWithdrawal>('ETBWithdrawal', ETBWithdrawalSchema);