// monitor-retries.js   To monitor bets with high retry counts, run this Redis command periodically: Run this every few minutes (cron) to alert you if any bet exceeds 3 attempts.
//If you see many, investigate broker latency.
import Redis from 'ioredis';
const redis = new Redis(process.env.REDIS_URL);

async function monitor() {
  const keys = await redis.keys('active_bets:*');
  for (const key of keys) {
    const bets = await redis.hgetall(key);
    for (const [betId, betJson] of Object.entries(bets)) {
      const bet = JSON.parse(betJson);
      if (bet.cashoutAttempts && bet.cashoutAttempts >= 3) {
        console.log(`High retry bet: ${betId}, attempts: ${bet.cashoutAttempts}`);
      }
    }
  }
  redis.disconnect();
}
monitor().catch(console.error);