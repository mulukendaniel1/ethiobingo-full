// src/cron/cleanupRestartRecords.ts - UPDATED VERSION
import { RestartRecord } from '../core/utils/restartTracker';
import { logger } from '../core/utils/logger';
import mongoose from 'mongoose';

export async function cleanupRestartRecords(): Promise<void> {
  try {
    if (mongoose.connection.readyState !== 1) {
  logger.error('MongoDB not connected, skipping cron');
  return;
}
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    const result = await RestartRecord.updateMany(
      {
        status: 'pending',
        requestedAt: { $lt: oneHourAgo }
      },
      {
        $set: { 
          status: 'failed',
          completedAt: new Date()
        }
      }
    );
    
    if (result.modifiedCount > 0) {
      logger.info(`Cleaned up ${result.modifiedCount} old restart records`);
    }
  } catch (error: any) {
    logger.error('Failed to cleanup restart records:', error);
  }
}

