//src/database/connections/mongodb.ts
import mongoose from 'mongoose';
import { logger } from '../../../core/utils/logger';
import { env } from '../../../core/config/env';

// MongoDB connection options
const mongoOptions: mongoose.ConnectOptions = {
  maxPoolSize: 10,
  minPoolSize: 5,
  socketTimeoutMS: 45000,
  serverSelectionTimeoutMS: 10000,
  family: 4,
  autoIndex: true,
  retryWrites: true,
  w: 'majority'
};

// Connection state
let isConnected = false;
let connectionAttempt = 0;
const maxConnectionAttempts = 3;

// Event handlers
mongoose.connection.on('connected', () => {
  isConnected = true;
  connectionAttempt = 0;
  logger.info('✅ MongoDB connected successfully');
});

mongoose.connection.on('error', (error) => {
  logger.error('❌ MongoDB connection error:', error.message);
  isConnected = false;
});

mongoose.connection.on('disconnected', () => {
  logger.warn('⚠️ MongoDB disconnected');
  isConnected = false;
});

mongoose.connection.on('reconnected', () => {
  logger.info('🔄 MongoDB reconnected');
  isConnected = true;
});

export async function connectMongo(): Promise<typeof mongoose> {
  if (isConnected && mongoose.connection.readyState === 1) {
    logger.info('MongoDB already connected');
    return mongoose;
  }
  
  if (connectionAttempt >= maxConnectionAttempts) {
    const error = new Error(`Max MongoDB connection attempts (${maxConnectionAttempts}) reached`);
    logger.error(error.message);
    throw error;
  }
  
  connectionAttempt++;
  
  try {
    logger.info(`Attempting MongoDB connection (attempt ${connectionAttempt}/${maxConnectionAttempts})...`);
    
    // Add timeout to prevent hanging
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('MongoDB connection timeout')), 15000);
    });
    
    const connectionPromise = mongoose.connect(env.MONGODB_URI, mongoOptions);
    
    const connection = await Promise.race([connectionPromise, timeoutPromise]) as typeof mongoose;
    
    logger.info(`✅ MongoDB connected to the host successfully`);
    
    // Create indexes in background
    process.nextTick(async () => {
      try {
        await mongoose.model('User').createIndexes();
        await mongoose.model('Job').createIndexes();
        await mongoose.model('Account').createIndexes();
        await mongoose.model('Payout').createIndexes();
        await mongoose.model('AuditLog').createIndexes();
        logger.info('✅ All database indexes created');
      } catch (indexError: any) {
        logger.error('Failed to create indexes:', indexError.message);
      }
    });
    
    return connection;
  } catch (error: any) {
    logger.error(`MongoDB connection failed (attempt ${connectionAttempt}/${maxConnectionAttempts}):`, error.message);
    
    if (connectionAttempt < maxConnectionAttempts) {
      const delay = connectionAttempt * 2000;
      logger.info(`Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return connectMongo();
    }
    
    throw error;
  }
}

export async function disconnectMongo(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    logger.info('MongoDB disconnected');
  }
}

export async function checkMongoHealth(): Promise<{
  status: 'healthy' | 'unhealthy';
  latency: number;
  dbStats?: any;
}> {
  const startTime = Date.now();
  
  try {
    if (!mongoose.connection.db) {
      throw new Error('Database not initialized');
    }
    
    const adminDb = mongoose.connection.db.admin();
    
    // Ping the database
    await adminDb.ping();
    const latency = Date.now() - startTime;
    
    return {
      status: 'healthy',
      latency,
      dbStats: {
        readyState: mongoose.connection.readyState,
        host: mongoose.connection.host,
        port: mongoose.connection.port,
        name: mongoose.connection.name
      }
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      latency: Date.now() - startTime,
      dbStats: undefined
    };
  }
}

export function isMongoConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

// Export mongoose instance
export { mongoose };