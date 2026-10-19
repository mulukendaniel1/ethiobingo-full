//src\core\database\models\UnclaimedReceipt.ts
import mongoose, { Schema, Document } from 'mongoose';

export interface IUnclaimedReceipt extends Document {
  transactionId: string;
  method: 'telebirr' | 'cbebirr';
  amount: number;
  senderName: string;
  receiverName: string;
  date: Date;
  link?: string;
  rawSms: string;
  createdAt: Date;
  matched: boolean;
  matchedDepositId?: mongoose.Types.ObjectId;
}

const UnclaimedReceiptSchema = new Schema<IUnclaimedReceipt>({
  transactionId: { type: String, required: true, unique: true },
  method: { type: String, enum: ['telebirr', 'cbebirr'], required: true },
  amount: { type: Number, required: true },
  senderName: String,
  receiverName: String,
  date: Date,
  link: String,
  rawSms: String,
  createdAt: { type: Date, default: Date.now, expires: 172800 }, // auto‑delete after 48h
  matched: { type: Boolean, default: false },
  matchedDepositId: { type: Schema.Types.ObjectId, ref: 'ETBDeposit' },
});

export const UnclaimedReceipt = mongoose.model<IUnclaimedReceipt>(
  'UnclaimedReceipt',
  UnclaimedReceiptSchema
);