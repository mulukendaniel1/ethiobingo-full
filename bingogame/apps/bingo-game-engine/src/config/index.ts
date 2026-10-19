//apps\bingo-game-engine\src\config\index.ts
import { z } from 'zod';

export const config = z.object({
  ENGINE_PORT: z.string().default('4000').transform(Number),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  BROKER_BOT_INTERNAL_URL: z.string().url(),
  FRONTEND_URL: z.string().url(),
  BROKER_INTERNAL_SECRET: z.string().min(1),
  JWT_SECRET: z.string().min(1),
  MONGODB_URI: z.string().url(),
  OPERATOR_ID: z.string().default('ethio_bingoobot'),
  HOUSE_EDGE_PERCENT: z.string().default('20').transform(Number), // commission %
  BALL_DRAW_INTERVAL_MS: z.string().default('4000').transform(Number),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
}).parse(process.env);