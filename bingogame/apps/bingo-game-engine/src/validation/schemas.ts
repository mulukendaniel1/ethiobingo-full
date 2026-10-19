//apps\etm-game-engine\src\validation\schemas.ts/
import { z } from 'zod';
import mongoose from 'mongoose';

export const objectIdSchema = z.string().refine(
  (val) => mongoose.Types.ObjectId.isValid(val),
  { message: 'Invalid ObjectId' }
);

export const buyCardSchema = z.object({
  type: z.literal('buy_card'),
  count: z.number().int().min(1).max(2),
});

export const wsMessageSchema = z.discriminatedUnion('type', [
  buyCardSchema,
  // we can add claim_bingo later if needed, but we'll do automatic check
]);