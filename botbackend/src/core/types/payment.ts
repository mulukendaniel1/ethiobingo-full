//src\core\types\payment.ts
export interface PayoutTransaction {
  txHash: string;
  amount: number;
  commission: number;
  timestamp: Date;
}

export interface TransactionResult {
  success: boolean;
  txid?: string;
  amount?: number;
  from?: string;
  to?: string;
  timestamp?: Date;
  error?: string;
}