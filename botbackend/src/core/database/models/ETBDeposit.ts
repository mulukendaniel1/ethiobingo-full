//src/core/database/models/ETBDeposit.ts
import mongoose, { Schema, Document } from 'mongoose';

export interface IETBDeposit extends Document {
  userId: mongoose.Types.ObjectId;
  requestId: string;
  method: 'cbe' | 'abyssinia' | 'cbebirr' | 'telebirr';
  amountETB: number;                 // user‑entered amount
  transactionId: string;             // extracted transaction number from receipt
  accountDetails?: string;           // not used for Telebirr, kept for compatibility
  status: 'pending' | 'confirmed' | 'rejected';
  adminNotes?: string;
  confirmedBy?: mongoose.Types.ObjectId;
  confirmedAt?: Date;
  // New fields for Telebirr
  senderName?: string;
  receiverName?: string;
  extractedAmount?: number;          // actual transferred amount from receipt
  extractedDate?: Date;
  receiptLink?: string;              // optional link from receipt
  createdAt: Date;
  updatedAt: Date;
}

const ETBDepositSchema = new Schema<IETBDeposit>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  requestId: { type: String, required: true, unique: true },
  method: { type: String, enum: ['cbe', 'abyssinia', 'cbebirr', 'telebirr'], required: true },
  amountETB: { type: Number, required: true, min: 0 },
  transactionId: { type: String, required: true },
  accountDetails: String,
  status: { type: String, enum: ['pending', 'confirmed', 'rejected'], default: 'pending' },
  adminNotes: String,
  confirmedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  confirmedAt: Date,
  // New fields
  senderName: String,
  receiverName: String,
  extractedAmount: Number,
  extractedDate: Date,
  receiptLink: String,
}, { timestamps: true });

ETBDepositSchema.index({ userId: 1, status: 1 });
ETBDepositSchema.index({ status: 1, createdAt: 1 });
ETBDepositSchema.index({ status: 1, confirmedAt: -1 });
// For uniqueness check
ETBDepositSchema.index({ transactionId: 1 }, { unique: true });

export const ETBDeposit = mongoose.model<IETBDeposit>('ETBDeposit', ETBDepositSchema);