// apps/bingo-game-engine/src/models/RoundState.ts
import mongoose, { Schema, Document } from 'mongoose';

export interface IUserCardsEntry {
  userId: string;
  cards: number[];
}

export interface ICardToUserEntry {
  cardId: number;
  userId: string;
}

export interface IRoundState extends Document {
  roundId: string;
  phase: 'selection' | 'game';
  serverSeed?: string; // actual seed for provably fair
  serverSeedHash: string; // hash (kept for compatibility)
  clientSeed: string;
  nonce: number;
  ballSequence: number[];
  drawnBalls: number[];
  drawnIndex: number;
  selectionStartTime: Date;   // when selection phase began
  gameStartTime?: Date;       // when game phase began
  lastBallDrawTime?: Date;    // when last ball was drawn
  ended: boolean;
  prizePool: number;
  botModeEnabled: boolean;
rigApplied: boolean;
  winnerId?: string;
  winnerCardId?: number;
  winnerIds: string[];        // ✅ added
  winnerCardIds: number[];    // ✅ added
  bannedUsers: string[];      // ✅ added
  availableCards: number[];
  purchasedCards: number[];
  userCards: IUserCardsEntry[];
  cardToUser: ICardToUserEntry[];
  endedAt?: Date; // timestamp when round ended
}

const RoundStateSchema = new Schema<IRoundState>({
  roundId: { type: String, required: true, unique: true },
  phase: { type: String, enum: ['selection', 'game'], required: true },
  serverSeed: { type: String },
  serverSeedHash: String,
  clientSeed: String,
  nonce: Number,
  ballSequence: [Number],
  drawnBalls: [Number],
  drawnIndex: Number,
  selectionStartTime: { type: Date, required: true },
  gameStartTime: Date,
  lastBallDrawTime: Date,
  ended: { type: Boolean, default: false },
  prizePool: { type: Number, default: 0 },
  botModeEnabled: { type: Boolean, default: false },
rigApplied: { type: Boolean, default: false },
  winnerId: String,
  winnerCardId: Number,
  winnerIds: { type: [String], default: [] },      // ✅
  winnerCardIds: { type: [Number], default: [] },  // ✅
  bannedUsers: { type: [String], default: [] },    // ✅
  availableCards: [Number],
  purchasedCards: [Number],
  userCards: [{
    userId: String,
    cards: [Number]
  }],
  cardToUser: [{
    cardId: Number,
    userId: String
  }],
  endedAt: { type: Date, default: null }
}, { timestamps: true });

// Create TTL index: automatically delete documents 7 days after endedAt is set
RoundStateSchema.index({ endedAt: 1 }, { expireAfterSeconds: 604800 }); // 7 days

export const RoundState = mongoose.model<IRoundState>('RoundState', RoundStateSchema);