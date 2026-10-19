// test/setup.ts
import { beforeEach } from 'bun:test';
import { InMemoryRedis } from './helpers/in-memory-redis';
import { MockWalletClient } from './helpers/mock-wallet';
import { RoundManager } from '../src/engine/RoundManager';

// Set environment variables
process.env.NODE_ENV = 'test';
process.env.BROKER_BOT_INTERNAL_URL = 'http://localhost:3000';
process.env.BROKER_INTERNAL_SECRET = 'test-secret';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
process.env.ENGINE_PORT = '4000';
process.env.OPERATOR_ID = 'ethio_bingoobot';
process.env.HOUSE_EDGE_PERCENT = '20';

export let redis: InMemoryRedis;
export let walletClient: MockWalletClient;
export let roundManager: RoundManager;

beforeEach(async () => {
  redis = new InMemoryRedis();
  walletClient = new MockWalletClient();
  roundManager = new RoundManager(redis as any, walletClient as any);

  // Disable DB persistence for tests
  (roundManager as any).saveStateToDB = async () => {};
  (roundManager as any).loadRound = async () => false;

  // Mock mongoose for systemsettings
  (globalThis as any).mongoose = {
    connection: {
      db: {
        collection: (name: string) => ({
          findOne: async (query: any) => {
            const key = query.key;
            if (key === 'game_paused') return { value: false };
            if (key === 'bots_enabled') return { value: true };
            if (key === 'bot_mode_enabled') return { value: false };
            if (key === 'bot_mode_rig_seed') return { value: 'test-seed' };
            return null;
          },
        }),
      },
    },
  };
});