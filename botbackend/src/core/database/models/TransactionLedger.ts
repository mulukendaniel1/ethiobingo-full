// src/core/database/models/TransactionLedger.ts
import mongoose, { Schema, Document, model } from 'mongoose';

export type LedgerType =
  | 'deposit'
  | 'deposit_auto_confirmed'
  | 'withdrawal_lock'
  | 'withdrawal_process'
  | 'withdrawal_refund'
  | 'withdrawal_fee'
  | 'card_purchase'
  | 'card_refund'
  | 'win'
  | 'admin_adjustment'
  | 'convert_locked'
  | 'agent_commission'
  | 'agent_first_deposit_bonus'
  | 'referral_bonus'
  | 'phone_bonus'
  | 'weekly_reward'
  | 'shamo_prize'
  | 'other';

export interface ITransactionLedger extends Document {
  userId: mongoose.Types.ObjectId;
  type: LedgerType;
  amount: number;            // positive = credit to user, negative = debit
  balanceAfter: number;      // user's ETBCoins after the operation
  referenceId?: string;      // requestId, roundId, etc.
  notes?: string;
  createdAt: Date;
}

const TransactionLedgerSchema = new Schema<ITransactionLedger>({
  userId:      { type: Schema.Types.ObjectId, ref: 'User', required: true },
  type:        { type: String, required: true, enum: [
    'deposit', 'deposit_auto_confirmed', 'withdrawal_lock', 'withdrawal_process',
    'withdrawal_refund', 'withdrawal_fee', 'card_purchase', 'card_refund',
    'win', 'admin_adjustment', 'convert_locked', 'agent_commission',
    'agent_first_deposit_bonus', 'referral_bonus', 'phone_bonus', 'weekly_reward', 'shamo_prize', 'other'
  ]},
  amount:      { type: Number, required: true },
  balanceAfter:{ type: Number, required: true },
  referenceId: { type: String },
  notes:       { type: String },
  createdAt:   { type: Date, default: Date.now },
});

// TTL index: automatically delete documents after 30 days
TransactionLedgerSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

TransactionLedgerSchema.index({ userId: 1, createdAt: -1 });
TransactionLedgerSchema.index({ type: 1, createdAt: -1 });
TransactionLedgerSchema.index({ referenceId: 1 });

export const TransactionLedger = model<ITransactionLedger>(
  'TransactionLedger',
  TransactionLedgerSchema
);