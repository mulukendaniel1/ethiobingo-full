//packages\shared-types\src\api.ts
// Request to broker bot internal wallet API
export interface BetRequest {
  userId: string;          // ObjectId as string
  amount: number;          // ETM to lock
  operatorId: string;
  nonce: string;           // unique to prevent replay
  payload: string;  
  signature: string;
}

export interface BetResponse {
  success: boolean;
  newBalance?: number;     // remaining ETM after lock
  lockedBalance?: number;
  error?: string;
}

export interface CashoutRequest {
  userId: string;
  roundId: string;
  multiplier: number;      // crash point or cashout multiplier
  amount: number;          // original bet amount
  operatorId: string;
  payload: string;     
  nonce: string;
  signature: string;
}

export interface CashoutResponse {
  success: boolean;
  winAmount: number;       // ETM credited (after 10% commission)
  newBalance: number;
  error?: string;
}

export interface RainRequest {
  operatorId: string;
  amount: number;
  count: number;
  payload: string;
  signature: string;
}

export interface RainResponse {
  success: boolean;
  credited?: number;
  perUser?: number;
  error?: string;
}