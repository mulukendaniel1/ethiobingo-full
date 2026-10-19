import { mock } from 'bun:test';

// Create a base mock object with all Redis methods used in the game engine
const createMockRedis = () => ({
  // Basic key-value
  get: mock(async () => null),
  set: mock(async () => 'OK'),
  setex: mock(async () => 'OK'),
  del: mock(async () => 1),
  keys: mock(async () => []),

  // Sets
  sadd: mock(async () => 1),
  srem: mock(async () => 1),
  smembers: mock(async () => []),

  // Hashes
  hget: mock(async () => null),
  hset: mock(async () => 1),
  hdel: mock(async () => 1),
  hlen: mock(async () => 0),

  // Lists
  lpush: mock(async () => 1),
  lrange: mock(async () => []),
  ltrim: mock(async () => 'OK'),

  // Expiration
  expire: mock(async () => 1),

  // Pub/Sub
  publish: mock(async () => 0),
  subscribe: mock(async () => {}),
  on: mock(),

  // Connection management
  quit: mock(async () => 'OK'),
});

export const redis = createMockRedis();
export const redisPub = createMockRedis();