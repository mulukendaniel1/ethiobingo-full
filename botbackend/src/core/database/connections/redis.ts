// src/core/database/connections/redis.ts 
import Redis, { RedisOptions } from 'ioredis';
import { logger } from '../../utils/logger';
import { env } from '../../../core/config/env';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  reset: number;
}

interface RedisHealthCheck {
  status: 'healthy' | 'unhealthy';
  latency: number;
  memory: any;
  clients: any;
}

class RedisManager {
  private client: Redis;
  private subscriber: Redis;
  private isConnected = false;
  
  constructor() {
    const redisUrl = env.REDIS_URL;
    
    // Configure Redis client with optimized settings
    const redisOptions: RedisOptions = {
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        logger.warn(`Redis reconnecting (attempt ${times}) in ${delay}ms`);
        return delay;
      },
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      connectTimeout: 10000,
      keepAlive: 1000,
      lazyConnect: true,
      autoResubscribe: true,
      autoResendUnfulfilledCommands: true,
      commandTimeout: 5000,
      disconnectTimeout: 2000,
      enableOfflineQueue: true,
      offlineQueue: true,
      enableAutoPipelining: true,
      autoPipeliningIgnoredCommands: ['auth', 'info', 'monitor']
    };
    
    // Create main client
    this.client = new Redis(redisUrl, redisOptions);
    
    // Create subscriber client
    this.subscriber = new Redis(redisUrl, {
      ...redisOptions,
      enableOfflineQueue: false
    });
    
    this.setupEventHandlers();
  }
  // Add this to the RedisManager constructor
async checkEvictionPolicy(): Promise<void> {
  try {
    const info = await this.client.info('memory');
    const policyMatch = info.match(/maxmemory_policy:(\w+)/);
    const policy = policyMatch ? policyMatch[1] : 'unknown';
    
    if (policy !== 'noeviction') {
      logger.warn(`⚠️ Redis eviction policy is "${policy}". Recommended: "noeviction"`);
      logger.info('ℹ️ To change in Redis Cloud: Configuration > Advanced > Maxmemory Policy = "noeviction"');
    } else {
      logger.info('✅ Redis eviction policy is correctly set to "noeviction"');
    }
  } catch (error) {
    logger.debug('Could not check Redis eviction policy:', error);
  }
}
  
  private setupEventHandlers(): void {
    // Main client events
    this.client.on('connect', () => {
      logger.info('🔌 Redis client connecting...');
    });
    
    this.client.on('ready', async () => {
      this.isConnected = true;
      logger.info('✅ Redis client ready');
      
      // Try to check eviction policy (but don't fail if we can't set it)
      try {
        const currentPolicy = await this.client.config('GET', 'maxmemory-policy') as string[];
        const policyValue = currentPolicy?.[1] || 'unknown';
        
        if (policyValue !== 'noeviction') {
          logger.warn(`⚠️ Redis eviction policy is "${policyValue}". Recommended: "noeviction"`);
          logger.info('ℹ️ To prevent data loss, set in Redis Cloud:');
          logger.info('   Configuration > Advanced > Maxmemory Policy = "noeviction"');
        } else {
          logger.info('✅ Redis eviction policy is correctly set to "noeviction"');
        }
      } catch (error: any) {
        // Don't fail if we can't check the policy
        logger.debug('Could not check Redis eviction policy:', error.message);
      }
      // Check eviction policy
     await this.checkEvictionPolicy();
    });
    
    this.client.on('error', (error) => {
      // Don't log connection errors during startup
      if (!error.message.includes('ECONNREFUSED') || this.isConnected) {
        logger.error('❌ Redis client error:', error);
      }
      this.isConnected = false;
    });
    
    this.client.on('close', () => {
      logger.warn('⚠️ Redis client connection closed');
      this.isConnected = false;
    });
    
    this.client.on('reconnecting', (delay) => {
      logger.info(`🔄 Redis reconnecting in ${delay}ms`);
    });
    
    // Subscriber client events
    this.subscriber.on('ready', () => {
      logger.info('✅ Redis subscriber ready');
    });
    
    this.subscriber.on('error', (error) => {
      logger.error('❌ Redis subscriber error:', error);
    });
  }
  
  async connect(): Promise<void> {
    if (this.isConnected) return;
    
    try {
      await Promise.all([
        this.client.connect(),
        this.subscriber.connect()
      ]);
      
      logger.info('✅ Redis connections established');
    } catch (error) {
      logger.error('Failed to connect to Redis:', error);
      throw error;
    }
  }
  
  async disconnect(): Promise<void> {
    try {
      await Promise.all([
        this.client.quit(),
        this.subscriber.quit()
      ]);
      logger.info('✅ Redis connections closed');
    } catch (error) {
      logger.error('Error closing Redis connections:', error);
    }
  }
  
  // Cache operations
  async set(key: string, value: any, ttl?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    
    if (ttl) {
      await this.client.setex(key, ttl, serialized);
    } else {
      await this.client.set(key, serialized);
    }
  }
  
  async get<T>(key: string): Promise<T | null> {
    const data = await this.client.get(key);
    return data ? JSON.parse(data) as T : null;
  }
  
  async del(key: string): Promise<void> {
    await this.client.del(key);
  }
  
  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }
  
  async keys(pattern: string): Promise<string[]> {
    return this.client.keys(pattern);
  }
  
  async flush(pattern?: string): Promise<void> {
    if (pattern) {
      const keys = await this.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
    } else {
      await this.client.flushdb();
    }
  }
  
  // Queue operations
  async enqueue(queue: string, data: any): Promise<string> {
    const id = `job:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
    const job = {
      id,
      queue,
      data,
      timestamp: Date.now(),
      attempts: 0
    };
    
    await this.client.lpush(`queue:${queue}`, JSON.stringify(job));
    return id;
  }
  
  async dequeue(queue: string): Promise<any | null> {
    const data = await this.client.rpop(`queue:${queue}`);
    return data ? JSON.parse(data) : null;
  }
  
  async queueLength(queue: string): Promise<number> {
    return this.client.llen(`queue:${queue}`);
  }
  
  // Rate limiting
  async rateLimit(key: string, limit: number, window: number): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - window * 1000;
    
    try {
      // Remove old entries
      await this.client.zremrangebyscore(key, 0, windowStart);
      
      // Get current count
      const currentCount = await this.client.zcard(key);
      
      // Check if we've exceeded the limit
      if (currentCount >= limit) {
        // Get the oldest entry to calculate reset time
        const oldestEntry = await this.client.zrange(key, 0, 0, 'WITHSCORES');
        const oldestTimestamp = oldestEntry[1] ? parseInt(oldestEntry[1] as string) : now;
        const resetTime = oldestTimestamp + window * 1000;
        
        return {
          allowed: false,
          remaining: 0,
          reset: resetTime
        };
      }
      
      // Add new request with current timestamp as score
      await this.client.zadd(key, now.toString(), now.toString());
      // Set expiry on the key (window seconds)
      await this.client.expire(key, window);
      
      return {
        allowed: true,
        remaining: limit - currentCount - 1,
        reset: now + window * 1000
      };
    } catch (error) {
      // On Redis error, allow the request (fail open)
      console.error('Redis rate limit error:', error);
      return {
        allowed: true,
        remaining: limit - 1,
        reset: now + window * 1000
      };
    }
  }
  
  // Pub/Sub
  async publish(channel: string, message: any): Promise<number> {
    return this.client.publish(channel, JSON.stringify(message));
  }
  
  async subscribe(channel: string, callback: (message: any) => void): Promise<void> {
    await this.subscriber.subscribe(channel);
    
    this.subscriber.on('message', (ch, msg) => {
      if (ch === channel) {
        try {
          callback(JSON.parse(msg));
        } catch (error) {
          logger.error('Failed to parse Redis message:', error);
        }
      }
    });
  }
  
  // Health check
  async healthCheck(): Promise<RedisHealthCheck> {
    const startTime = Date.now();
    
    try {
      await this.client.ping();
      const latency = Date.now() - startTime;
      
      const [info, clientList] = await Promise.all([
        this.client.info(),
        this.client.client('LIST')
      ]);
      
      // Parse Redis info
      const memoryMatch = (info as string).match(/used_memory_human:(\S+)/);
      const clientsMatch = (info as string).match(/connected_clients:(\d+)/);
      
      return {
        status: 'healthy',
        latency,
        memory: memoryMatch ? memoryMatch[1] : 'unknown',
        clients: clientsMatch ? parseInt(clientsMatch[1]) : 0
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        latency: Date.now() - startTime,
        memory: 'unknown',
        clients: 0
      };
    }
  }

   async clearAll(): Promise<boolean> {
    try {
      if (!this.client || !this.isConnected) {
        logger.warn('Redis client not connected, cannot clear cache');
        return false;
      }
      
      // Use flushall to clear all keys
      await this.client.flushall();
      logger.info('✅ Redis cache cleared successfully');
      return true;
    } catch (error: any) {
      logger.error('Failed to clear Redis cache:', error.message);
      return false;
    }
  }
  
  // Get client instances
  getClient(): Redis {
    return this.client;
  }
  
  getSubscriber(): Redis {
    return this.subscriber;
  }
  
  isReady(): boolean {
    return this.isConnected && this.client.status === 'ready';
  }
}

// Singleton instance
export const redisManager = new RedisManager();
export default redisManager;