// apps/etm-game-engine/src/models/User.ts
import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  telegramId: number;
  username?: string;
  firstName: string;
  ETBCoins: number; // Corrected to match Bot's Schema
  lockedETB: number; // Corrected to match Bot's Schema
}

const UserSchema = new Schema<IUser>({
  telegramId: { type: Number, required: true, unique: true },
  username: { type: String },
  firstName: { type: String, required: true },
  ETBCoins: { type: Number, default: 0 }, // Matches Bot
  lockedETB: { type: Number, default: 0 }, // Matches Bot
}, { 
  timestamps: true,
  collection: 'users' // Matches the bot's collection
});

export const User = mongoose.model<IUser>('User', UserSchema);