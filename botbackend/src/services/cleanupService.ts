// src/services/cleanupService.ts
import { User } from '../core/database/models/User';
import { AgentRequest } from '../core/database/models/AgentRequest';
import { logger } from '../core/utils/logger';

/**
 * Remove ETBCoinTransactions older than specified days
 */
export async function cleanupOldETBTransactions(daysToKeep: number = 30): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  const result = await User.updateMany(
    { 'ETBCoinTransactions.timestamp': { $lt: cutoffDate } },
    { $pull: { ETBCoinTransactions: { timestamp: { $lt: cutoffDate } } } }
  );

  logger.info(`🧹 Cleaned old ETB transactions: ${result.modifiedCount} users affected, removed entries older than ${daysToKeep} days`);
  return result.modifiedCount;
}

/**
 * Delete resolved agent requests (approved/rejected) older than 7 days
 */
export async function cleanupOldAgentRequests(daysToKeep: number = 7): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  const result = await AgentRequest.deleteMany({
    status: { $in: ['approved', 'rejected'] },
    reviewedAt: { $lt: cutoffDate }
  });

  logger.info(`🧹 Cleaned old agent requests: ${result.deletedCount} records deleted (status approved/rejected older than ${daysToKeep} days)`);
  return result.deletedCount;
}

/**
 * Combined cleanup
 */
export async function runFullCleanup(): Promise<void> {
  await cleanupOldETBTransactions(30);
  await cleanupOldAgentRequests(7);
}