// apps/bingo-game-engine/src/index.ts
import { Elysia } from 'elysia';
import { Redis } from 'ioredis';
import mongoose from 'mongoose';
import cors from '@elysiajs/cors';
import { config } from './config';
import { GameLoop } from './engine/GameLoop';
import { RoundManager } from './engine/RoundManager';
import { WalletClient } from '@bingogame/wallet-client';
import { logger } from './utils/logger';
import { verifyJWT } from './services/AuthService';
import { RoundState } from './models/RoundState';
import cardsData from '../data/cards.json'; // ✅ card data from JSON
import { ShamoManager } from './engine/ShamoManager';
import { signPayload } from '@bingogame/crypto-utils';

// 1. DATABASE CONNECTIONS
await mongoose.connect(config.MONGODB_URI, {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
});
mongoose.set('sanitizeFilter', true);
logger.info('✅ MongoDB connected');
mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected – driver will auto-reconnect');
});
mongoose.connection.on('reconnected', () => {
  logger.info('MongoDB reconnected');
});

const redis = new Redis(config.REDIS_URL, {
  retryStrategy: (times) => {
    const delay = Math.min(times * 100, 3000);
    logger.warn(`Redis connection lost. Retrying in ${delay}ms...`);
    return delay;
  },
  maxRetriesPerRequest: 3,
  enableAutoPipelining: false,
  autoResendUnfulfilledCommands: true,
  lazyConnect: false,
});

redis.on('connect', () => logger.info('✅ Redis connected'));
redis.on('error', (err) => logger.error('Redis error:', err));
redis.on('close', () => logger.warn('Redis connection closed'));
redis.on('reconnecting', () => logger.warn('Redis reconnecting...'));

// Redis Pub/Sub (for cross‑instance communication)
const redisPub = new Redis(config.REDIS_URL, {
  retryStrategy: (times) => {
    const delay = Math.min(times * 100, 3000);
    return delay;
  },
  maxRetriesPerRequest: 3,
});

// 2. ENGINE INITIALIZATION
const walletClient = new WalletClient(
  config.BROKER_BOT_INTERNAL_URL,
  config.OPERATOR_ID,
  config.BROKER_INTERNAL_SECRET
);

const roundManager = new RoundManager(redis, walletClient);
const shamoManager = new ShamoManager(redis);

await roundManager.initialize();

// Load active Shamo from bot-backend on boot (retry up to 5× with backoff)
(async () => {
  for (let i = 0; i < 5; i++) {
    try {
      const nonce = `boot:${Date.now()}`;
      const r = await fetch(
        `${config.BROKER_BOT_INTERNAL_URL}/internal/wallet/shamo/active`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            payload: nonce,
            signature: signPayload(nonce, config.BROKER_INTERNAL_SECRET),
          }),
        }
      );
      const j = await r.json();
      if (j.active) shamoManager.setState(j.active);
      return;
    } catch (e) {
      if (i === 4) logger.warn('Shamo boot state fetch failed after 5 attempts:', e);
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
})();

const activeRound = await RoundState.findOne({ ended: false }).sort({ createdAt: -1 });
const gameLoop = new GameLoop(redis, roundManager);

if (activeRound) {
  logger.info(`Found active round ${activeRound.roundId}. Attempting to resume...`);
  const loaded = await roundManager.loadRound(activeRound.roundId);
  if (loaded) {
    logger.info(`Round resumed successfully. Phase: ${activeRound.phase}`);
    await gameLoop.resumeRound(activeRound, roundManager);
  } else {
    logger.warn('Failed to load active round, starting fresh');
    await gameLoop.start();
  }
} else {
  logger.info('No active round found, starting fresh');
  await gameLoop.start();
}

const userSockets = new Map<string, any>();

// Shamo claim throttle — module-scoped so it survives across all sockets
const shamoClaimThrottle = new Map<string, number>();
const SHAMO_THROTTLE_MS = 500;

// Helper broadcasts
const broadcastStats = () => {
  const onlineUsers = userSockets.size;
  const activePlayers = roundManager.getActivePlayers();
  const payload = { onlineUsers, activePlayers };
  app.server?.publish('bingo', JSON.stringify({ type: 'stats_update', data: payload }));
};

// 3. SERVER
export const app = new Elysia()
  .use(cors({ origin: [config.FRONTEND_URL, 'http://localhost:5173'] }))
  .onError(({ code, error }) => {
    logger.error(`[Elysia Error] ${code}:`, error);
    return { error: 'Internal server error', code };
  })
  .ws('/ws', {
    open: async (ws) => {
      const token = ws.data.query?.token as string;
      const decoded = verifyJWT(token);
    if (!decoded) {
      ws.send({ type: 'error', message: 'Unauthorized' });
      return ws.close();
    }

    // ✅ Validate session ID against Redis
    const storedSessionId = await redis.get(`session:${decoded.uid}`);
    if (!storedSessionId || storedSessionId !== decoded.sessionId) {
      ws.send({ type: 'error', message: 'Session expired or duplicate detected' });
      return ws.close();
    }
      const userId = decoded.uid;

      // Check for existing socket
      const existing = userSockets.get(userId);
      if (existing) {
        existing.send(JSON.stringify({
          type: 'duplicate_session',
          message: 'Another session was started. This tab will close.'
        }));
        existing.close();
        userSockets.delete(userId);
      }

      userSockets.set(userId, ws);
      (ws.data as any).userId = userId;
      ws.subscribe('bingo');

      const heartbeatInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        } else {
          clearInterval(heartbeatInterval);
          userSockets.delete(userId);
        }
      }, 30000);

      // Sync initial game state
      const roundData = roundManager.getRoundData();
      const userCards = roundManager.getUserCards(userId);
      const userMarksObj: Record<number, number[]> = {};
      for (const cid of userCards) {
        userMarksObj[cid] = Array.from(roundManager.getUserMarks(userId, cid));
      }
      const availableCards = await roundManager.getAvailableCards();
      const userBanned = roundManager.getUserBanned(userId);

          ws.send({
            type: 'game_state',
            data: {
              phase: roundData?.phase || 'selection',
              roundId: roundData?.roundId || '',
              countdown: gameLoop.getCountdown(),
              drawnBalls: roundData?.drawnBalls || [],
              prizePool: roundData?.prizePool || 0,
              winner: null,
              onlineUsers: userSockets.size,
              activePlayers: roundManager.getActivePlayers(),
              userCards,
              userMarks: userMarksObj,   // ✅ corrected
              availableCards,
              banned: userBanned,
            }
          });

      const gamePaused = await roundManager.isGamePaused();
      ws.send(JSON.stringify({ type: 'game_paused', data: { paused: gamePaused } }));
      ws.send(JSON.stringify({ type: 'shamo_state', data: shamoManager.getState() }));

      // Optional: send user history
      const userHistoryStrings = await redis.lrange(`user:${userId}:history`, 0, 9);
      ws.send({
        type: 'user_history',
        data: userHistoryStrings.map(s => JSON.parse(s))
      });

      broadcastStats();
    },

    message: async (ws, raw: any) => {
      const userId = (ws.data as any).userId;
      if (!userId) return;

      const { type } = raw;

      if (type === 'select_card') {
        const cardId = raw.cardId;
        if (typeof cardId !== 'number') return ws.send({ type: 'error', message: 'Invalid card ID' });
        const result = await roundManager.selectCard(userId, cardId);
        if (result.success) {
          const availableCards = await roundManager.getAvailableCards();
          app.server?.publish('bingo', JSON.stringify({
            type: 'available_cards_update',
            data: { available: availableCards }
          }));
          ws.send({ type: 'user_card_update', data: { cardId } });
          broadcastStats();
        } else {
          ws.send({ type: 'error', message: result.error });
        }
      }
      else if (type === 'shamo_claim') {
        // Per-user throttle — 500ms between Shamo claim attempts
        const now = Date.now();
        const last = shamoClaimThrottle.get(userId) || 0;
        if (now - last < SHAMO_THROTTLE_MS) {
          return ws.send(JSON.stringify({
            type: 'shamo_claim_result',
            success: false,
            error: 'Slow down',
          }));
        }
        shamoClaimThrottle.set(userId, now);

        // Memory guard — clear map if it grows too large (10k users)
        if (shamoClaimThrottle.size > 10_000) {
          shamoClaimThrottle.clear();
        }
        const { roundId, buttonIndex } = raw;
        if (typeof roundId !== 'string' || typeof buttonIndex !== 'number') {
          return ws.send({ type: 'shamo_claim_result', success: false, error: 'Invalid payload' });
        }

        const nonce = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const payload = `${userId}:${roundId}:${buttonIndex}:${nonce}`;
        const signature = signPayload(payload, config.BROKER_INTERNAL_SECRET);

        try {
          const r = await fetch(`${config.BROKER_BOT_INTERNAL_URL}/internal/wallet/shamo/claim`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId, roundId, buttonIndex,
              nonce, payload, signature,
            }),
          });
          const j = await r.json();

          if (!j.success) {
            ws.send(JSON.stringify({
              type: 'shamo_claim_result',
              success: false,
              code: j.code,
              error: j.error,
            }));
            return;
          }

          // Broadcast to everyone (single emit per instance via Redis pub/sub)
          await shamoManager.broadcastClaim({
            roundId,
            buttonIndex,
            userId,
            prize: j.prize,
            claimedCount: j.claimedCount,
          });

          // Balance refresh for the winner
          ws.send(JSON.stringify({
            type: 'shamo_claim_result',
            success: true,
            prize: j.prize,
            buttonIndex,
            newBalance: j.newBalance,
          }));
          ws.send(JSON.stringify({ type: 'balance_updated', data: { balance: j.newBalance } }));

          // Auto-end handled server-side; engine receives shamo_ended via pub/sub.
        } catch (err) {
          logger.error('[Shamo] claim error:', err);
          ws.send(JSON.stringify({ type: 'shamo_claim_result', success: false, error: 'Network error' }));
        }
      }
      else if (type === 'mark_number') {
        const { number, cardId } = raw;
        if (typeof number !== 'number' || typeof cardId !== 'number') {
          ws.send({ type: 'error', message: 'Invalid number or cardId' });
          return;
        }
        const result = await roundManager.markNumber(userId, number, cardId);
        ws.send({ type: 'mark_result', success: result.success, error: result.error, cardId, number });
      }
      else if (type === 'claim_bingo') {
        const { cardId } = raw;
        if (typeof cardId !== 'number') {
          ws.send({ type: 'error', message: 'Invalid cardId' });
          return;
        }
        const result = await roundManager.claimBingo(userId, cardId);
        if (result.success) {
          ws.send({ type: 'claim_result', success: true, message: result.message });
        } else {
          ws.send({ type: 'error', message: result.error });
        }
      }
      else if (type === 'sell_card') {
        const cardId = raw.cardId;
        if (typeof cardId !== 'number') {
          ws.send({ type: 'error', message: 'Invalid card ID' });
          return;
        }
        const result = await roundManager.sellCard(userId, cardId);
        if (result.success) {
          // The roundManager will emit userCardsUpdated, which sends user_cards_update to this client.
          // Broadcast updated available cards to all clients.
          const availableCards = await roundManager.getAvailableCards();
          app.server?.publish('bingo', JSON.stringify({
            type: 'available_cards_update',
            data: { available: availableCards }
          }));
          // Send balance update to this client (though roundManager also emits balanceUpdated)
          ws.send({ type: 'balance_updated', data: { balance: result.newBalance } });
          broadcastStats();
        } else {
          ws.send({ type: 'error', message: result.error });
        }
      }
    },

    close(ws) {
      const userId = (ws.data as any).userId;
      if (userId) {
        userSockets.delete(userId);
        broadcastStats();
      }
    }
  })

  // Serve card data from JSON (fast, no DB)
  .get('/card/:cardId', async ({ params }) => {
    const cardId = parseInt(params.cardId);
    if (isNaN(cardId) || cardId < 1 || cardId > 400) {
      return { error: 'Invalid card ID' };
    }
    const card = (cardsData as any[]).find((c: any) => c.cardId === cardId);
    if (!card) return { error: 'Card not found' };
    return card;
  })
  // ==================== ADMIN: Broadcast game pause/resume to all WebSocket clients ====================
app.post('/admin/game/pause-broadcast', async ({ body }) => {
  const { paused } = body as { paused?: boolean };
  if (typeof paused !== 'boolean') {
    return { error: 'Invalid payload' };
  }
  app.server?.publish('bingo', JSON.stringify({ type: 'game_paused', data: { paused } }));
  if (!paused) {
    // Fire and forget – don't block the HTTP response
    roundManager.resumeGameIfNeeded(gameLoop).catch(err => logger.error('Resume failed:', err));
  }
  logger.info(`Broadcast game paused status: ${paused}`);
  return { success: true };
})

.get('/health', () => ({ status: 'ok' }))

  .listen(config.ENGINE_PORT);

logger.info(`🚀 Bingo Engine live on port ${config.ENGINE_PORT}`);

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');
  gameLoop.stop();
  await roundManager.saveStateToDB();
  await mongoose.disconnect();
  await redis.quit();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  gameLoop.stop();
  await roundManager.saveStateToDB();
  await mongoose.disconnect();
  await redis.quit();
  process.exit(0);
});

// Event listeners

roundManager.on('botJoined', () => {
  broadcastStats();
});

roundManager.on('ballDrawn', (payload) => {
  app.server?.publish('bingo', JSON.stringify({ type: 'ball', data: payload }));
});

roundManager.on('phaseChanged', (payload) => {
  app.server?.publish('bingo', JSON.stringify({ type: 'phase_change', data: payload }));
});

roundManager.on('roundEnded', (data) => {
  broadcastStats();
  app.server?.publish('bingo', JSON.stringify({
    type: 'round_ended',
    data: {
      winnerId: data.winnerId,
      winnerName: data.winnerName,
      winAmount: data.winAmount,
      winnerCardId: data.winnerCardId,
      // Optional arrays for future frontend extension
      winnerIds: data.winnerIds,
      winnerNames: data.winnerNames,
      winnerCardIds: data.winnerCardIds,
    }
  }));
  gameLoop.stopGame(); // STOP THE BALLS
  gameLoop.scheduleNextRound(6000); 
});

roundManager.on('balanceUpdated', ({ userId, newBalance }) => {
  const ws = userSockets.get(userId);
  if (ws) ws.send(JSON.stringify({ type: 'balance_updated', data: { balance: newBalance } }));
});

roundManager.on('prizePoolUpdated', ({ prizePool }) => {
  app.server?.publish('bingo', JSON.stringify({ type: 'prize_pool_updated', data: { prizePool } }));
});

// (Optional) userCardsUpdated – kept for compatibility, but not used by frontend
roundManager.on('userCardsUpdated', ({ userId, cards }) => {
  const ws = userSockets.get(userId);
  if (ws) ws.send(JSON.stringify({ type: 'user_cards_update', data: { cards } }));
});

roundManager.on('availableCardsUpdated', ({ available }) => {
  app.server?.publish('bingo', JSON.stringify({
    type: 'available_cards_update',
    data: { available }
  }));
});

roundManager.on('roundStateUpdated', (data) => {
  app.server?.publish('bingo', JSON.stringify({ type: 'round_state_updated', data }));
});

shamoManager.on('shamoStarted', (state) => {
  app.server?.publish('bingo', JSON.stringify({ type: 'shamo_started', data: state }));
});

shamoManager.on('shamoButtonClaimed', (data) => {
  app.server?.publish('bingo', JSON.stringify({ type: 'shamo_button_claimed', data }));
});

shamoManager.on('shamoEnded', (data) => {
  app.server?.publish('bingo', JSON.stringify({ type: 'shamo_ended', data }));
});

// Pub/Sub for countdown (cross‑instance)
redisPub.subscribe('bingo:countdown');
redisPub.on('message', (channel, message) => {
  if (channel === 'bingo:countdown') {
    app.server?.publish('bingo', JSON.stringify({ type: 'countdown', data: JSON.parse(message) }));
  }
});