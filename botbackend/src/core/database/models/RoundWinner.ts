// src/core/database/models/RoundWinner.ts
import mongoose from 'mongoose';

const roundWinnerSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  roundId: { type: String, required: true, index: true },
  winAmount: { type: Number, required: true },
  stake: { type: Number, required: true, default: 10 },
  cardId: { type: Number, default: 0 },                 // NEW: which card won
  createdAt: { type: Date, default: Date.now, expires: '30d' }
});

// Updated index: one win per user per round per card
roundWinnerSchema.index(
  { userId: 1, roundId: 1, cardId: 1 },
  { unique: true }
);

export const RoundWinner = mongoose.model('RoundWinner', roundWinnerSchema);