//src\core\database\models\BotLeaderboardEntry.ts
import mongoose, { Schema, Document } from 'mongoose';

export interface IBotLeaderboardEntry extends Document {
  botId: string;            // e.g., bot_1744391234567_0
  displayName: string;      // e.g., "Abebe"
  totalBuys: number;        // number of cards bought
  totalSpent: number;       // total ETB spent
  totalWins: number;        // number of rounds won
  updatedAt: Date;
  expiresAt: Date;          // TTL index – automatically delete after 7 days
}

const BotLeaderboardEntrySchema = new Schema<IBotLeaderboardEntry>({
  botId: { type: String, required: true, unique: true, index: true },
  displayName: { type: String, required: true },
  totalBuys: { type: Number, default: 0 },
  totalSpent: { type: Number, default: 0 },
  totalWins: { type: Number, default: 0 },
  updatedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
});

BotLeaderboardEntrySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const BotLeaderboardEntry = mongoose.model<IBotLeaderboardEntry>(
  'BotLeaderboardEntry',
  BotLeaderboardEntrySchema
);