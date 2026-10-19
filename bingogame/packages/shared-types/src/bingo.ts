// packages/shared-types/src/bingo.ts
export interface BuyCardRequest {
  userId: string;
  roundId: string;
  amount: number;
  count: number;
  operatorId: string;
  nonce: string;
  payload: string;
  signature: string;
}

export interface BuyCardResponse {
  success: boolean;
  cardIds?: string[];
  newBalance?: number;
  error?: string;
}

export interface WinRequest {
  userId: string;
  roundId: string;
  cardId?: string;          // optional for number-based win
  winAmount?: number;       // new field
  operatorId: string;
  nonce: string;
  payload: string;
  signature: string;
}

export interface WinResponse {
  success: boolean;
  winAmount?: number;
  balance?: number;
  error?: string;
}

export interface RoundResultRequest {
  roundId: string;
  operatorId: string;
  totalStaked: number;
  totalPayout: number;
  totalCommission: number;
  winnerId?: string;
  startTime: number;
  endTime: number;
  userStakes?: Array<{ userId: string; stake: number }>; // new field
  payload: string;
  signature: string;
}

export interface RoundResultResponse {
  success: boolean;
  error?: string;
}