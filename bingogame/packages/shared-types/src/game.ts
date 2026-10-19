//packages\shared-types\src\game.ts
export interface Bet {
  userId: string;
  operatorId: string;
  roundId: string;
  amount: number;
  autoCashout?: number;
  cashedOutAt?: number;
  payout?: number;
  status: 'pending' | 'cashed' | 'crashed';
  createdAt: Date;
}

export interface Round {
  roundId: string;
  serverSeedHash: string;
  clientSeed: string;
  nonceStart: number;
  crashPoint: number;
  startTime: Date;
  endTime?: Date;
}

export interface OperatorKey {
  operatorId: string;
  apiKey: string;
  walletBaseUrl: string;
  isActive: boolean;
}