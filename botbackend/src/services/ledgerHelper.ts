// src/services/ledgerHelper.ts
import { TransactionLedger } from '../core/database/models/TransactionLedger';
import mongoose from 'mongoose';

type LedgerEntry = {
  userId: mongoose.Types.ObjectId;
  type: string;
  amount: number;
  balanceAfter: number;
  referenceId?: string;
  notes?: string;
};

export async function recordLedger(entry: LedgerEntry): Promise<void> {
  try {
    await TransactionLedger.create(entry);
  } catch (err) {
    console.error('Failed to write ledger entry:', err);
    // Fail silently – ledger is non‑critical for business logic
  }
}