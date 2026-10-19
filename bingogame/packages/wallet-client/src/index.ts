// packages/wallet-client/src/index.ts
import { signPayload } from '@bingogame/crypto-utils';
import { BuyCardRequest, BuyCardResponse, WinRequest, WinResponse, RoundResultRequest, RoundResultResponse } from '@bingogame/shared-types';

export class WalletClient {
  private baseUrl: string;
  private operatorId: string;
  private secret: string;

  constructor(baseUrl: string, operatorId: string, secret: string) {
    this.baseUrl = baseUrl;
    this.operatorId = operatorId;
    this.secret = secret;
  }

  async buyCard(userId: string, roundId: string, amount: number, count: number): Promise<BuyCardResponse> {
    const nonce = `${Date.now()}-${Math.random()}`;
    const payload = `${userId}:${roundId}:${amount}:${count}:${nonce}`;
    const signature = signPayload(payload, this.secret);

    const req: BuyCardRequest = {
      userId,
      roundId,
      amount,
      count,
      operatorId: this.operatorId,
      nonce,
      payload,
      signature,
    };

    const res = await fetch(`${this.baseUrl}/internal/wallet/bingo/buy-card`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Invalid JSON from /bingo/buy-card: ${text.substring(0, 200)}`);
    }
  }

  async buyNumbers(userId: string, roundId: string, numbers: number[], totalCost: number): Promise<{ success: boolean; newBalance?: number; error?: string }> {
    const nonce = `${Date.now()}-${Math.random()}`;
    const payload = `${userId}:${roundId}:${numbers.join(',')}:${totalCost}:${nonce}`;
    const signature = signPayload(payload, this.secret);

    const req = {
      userId,
      roundId,
      numbers,
      totalCost,
      operatorId: this.operatorId,
      nonce,
      payload,
      signature,
    };

    const res = await fetch(`${this.baseUrl}/internal/wallet/bingo/buy-numbers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Invalid JSON from /bingo/buy-numbers: ${text.substring(0, 200)}`);
    }
  }

async win(userId: string, roundId: string, winAmount: number, totalStaked?: number, cardId?: number): Promise<WinResponse> {
  const nonce = `${Date.now()}-${Math.random()}`;
  const payload = `${userId}:${roundId}:${winAmount}:${cardId ?? 0}:${nonce}`;
  const signature = signPayload(payload, this.secret);

  const req = {
    userId,
    roundId,
    winAmount,
    totalStaked,
    cardId: cardId ?? 0,
    operatorId: this.operatorId,
    nonce,
    payload,
    signature,
  };

  const res = await fetch(`${this.baseUrl}/internal/wallet/bingo/win`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON from /bingo/win: ${text.substring(0, 200)}`);
  }
}
async sellCard(
  userId: string,
  roundId: string,
  cardId: number,
  amount?: number
): Promise<{ success: boolean; newBalance?: number; error?: string }> {
  const nonce = `${Date.now()}-${Math.random()}`;
  const refundAmount = amount ?? 10; // Bunna default stake
  const payload = `${userId}:${roundId}:${cardId}:${refundAmount}:${nonce}`;
  const signature = signPayload(payload, this.secret);

  const req = {
    userId,
    roundId,
    cardId,
    amount: refundAmount,
    operatorId: this.operatorId,
    nonce,
    payload,
    signature,
  };

  const res = await fetch(`${this.baseUrl}/internal/wallet/bingo/sell-card`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON from /bingo/sell-card: ${text.substring(0, 200)}`);
  }
}

  async sendRoundResult(data: Omit<RoundResultRequest, 'payload' | 'signature'> & { 
  winnerIds?: string[]; 
  winnerAmounts?: number[] 
}): Promise<RoundResultResponse> {
  const nonce = `${Date.now()}-${Math.random()}`;
  const stakesPart = data.userStakes ? data.userStakes.map(s => `${s.userId}:${s.stake}`).join(',') : '';
  const winnersPart = data.winnerIds ? data.winnerIds.map((id, i) => `${id}:${data.winnerAmounts?.[i]}`).join(',') : '';
  const payload = `${data.roundId}:${data.operatorId}:${data.totalStaked}:${data.totalPayout}:${data.totalCommission}:${data.winnerId || ''}:${data.startTime}:${data.endTime}:${stakesPart}:${winnersPart}`;
  const signature = signPayload(payload, this.secret);

    const req: RoundResultRequest = {
      ...data,
      payload,
      signature,
    };

    const res = await fetch(`${this.baseUrl}/internal/wallet/bingo/round-result`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Invalid JSON from /bingo/round-result: ${text.substring(0, 200)}`);
    }
  }
}