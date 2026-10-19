//apps\etm-game-engine\src\models\GameLog.ts
import mongoose, { Schema, Document } from 'mongoose';

export type GameLogType =
  | 'ROUND_START'
  | 'ROUND_END'
  | 'BET_PLACED'
  | 'BET_CONFIRMED'
  | 'BET_CANCELLED'
  | 'CASHOUT'
  | 'CRASH'
  | 'AUTO_CASHOUT'
  | 'ERROR'
  | 'WARNING'
  | 'INFO'
  | 'BET_CRASHED';

export interface IGameLog extends Document {
  type: GameLogType;
  level: 'info' | 'warn' | 'error';
  timestamp: Date;
  data: any;
  roundId?: string;
  userId?: string;
  operatorId?: string;
}

const GameLogSchema = new Schema<IGameLog>(
  {
    type: { 
      type: String, 
      required: true, 
      enum: [
        'ROUND_START','ROUND_END','BET_PLACED','BET_CONFIRMED',
        'BET_CANCELLED','CASHOUT','CRASH','AUTO_CASHOUT',
        'ERROR','WARNING','INFO','BET_CRASHED'
      ] 
    },
    level: { type: String, required: true, enum: ['info','warn','error'], default: 'info' },
    timestamp: { type: Date, default: Date.now }, // field-level index removed
    data: { type: Schema.Types.Mixed, default: {} },
    roundId: { type: String, index: true },
    userId: { type: String, index: true },
    operatorId: { type: String, index: true },
  },
  { timestamps: true }
);

// TTL index (auto‑delete logs after 6 hours – this also creates an index on timestamp
GameLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 6 * 60 * 60 }); // 6 hours

export const GameLog = mongoose.model<IGameLog>('GameLog', GameLogSchema);