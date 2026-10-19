// src/services/auditService.ts - COMPLETE FIXED VERSION
import { AuditLog, AuditSource, AuditActionType, AuditSeverity, auditLogger } from '../core/database/models/AuditLog';
import { User } from '../core/database/models/User';
import { logger } from '../core/utils/logger';
import mongoose from 'mongoose';
import { sanitizeInput } from '../core/utils/security';
export class AuditService {
  
  /**
   * Log a system action
   */
  async logSystemAction(
    action: string,
    details?: any,
    severity: AuditSeverity = 'INFO'
  ): Promise<void> {
    try {
      const safeAction = sanitizeInput(action);
      if (!safeAction) return;
      await auditLogger[severity.toLowerCase() as 'info' | 'warning' | 'error' | 'critical']({
        action,
        actionType: 'SYSTEM',
        entityType: 'System',
        details,
        source: 'SYSTEM',
        tags: ['system', 'automated']
      });
    } catch (error) {
      logger.error('Failed to log system action:', error);
    }
  }
  
  /**
   * Log a user action
   */
  async logUserAction(
    userId: mongoose.Types.ObjectId | string,
    telegramId: number,
    action: string,
    actionType: AuditActionType,
    entityType: string,
    entityId?: string,
    details?: any,
    severity: AuditSeverity = 'INFO'
  ): Promise<void> {
    const safeAction = sanitizeInput(action);
    const safeEntityType = sanitizeInput(entityType);
    const safeEntityId = sanitizeInput(entityId);
    try {
      await auditLogger[severity.toLowerCase() as 'info' | 'warning' | 'error' | 'critical']({
        action,
        actionType,
        entityType,
        entityId,
        userId: typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId,
        userTelegramId: telegramId,
        details,
        source: 'BOT',
        tags: ['user', 'action', entityType.toLowerCase()]
      });
    } catch (error) {
      logger.error('Failed to log user action:', error);
    }
  }
  
  /**
   * Log an admin action
   */
  async logAdminAction(
    adminId: mongoose.Types.ObjectId | string,
    telegramId: number,
    action: string,
    actionType: AuditActionType,
    entityType: string,
    entityId?: string,
    details?: any,
    severity: AuditSeverity = 'INFO'
  ): Promise<void> {
    try {
      await auditLogger[severity.toLowerCase() as 'info' | 'warning' | 'error' | 'critical']({
        action,
        actionType,
        entityType,
        entityId: entityId ? entityId.toString() : undefined,
        userId: typeof adminId === 'string' ? new mongoose.Types.ObjectId(adminId) : adminId,
        userTelegramId: telegramId,
        details,
        source: 'ADMIN',
        tags: ['admin', 'management', entityType.toLowerCase()]
      });
    } catch (error) {
      logger.error('Failed to log admin action:', error);
    }
  }
  
  /**
   * Log a financial transaction
   */
  async logFinancialTransaction(
    userId: mongoose.Types.ObjectId | string,
    telegramId: number,
    action: string,
    amount: number,
    currency: string = 'USD',
    transactionId?: string,
    details?: any,
    severity: AuditSeverity = 'INFO'
  ): Promise<void> {
    try {
      await auditLogger[severity.toLowerCase() as 'info' | 'warning' | 'error' | 'critical']({
        action,
        actionType: 'FINANCIAL',
        entityType: 'Transaction',
        entityId: transactionId,
        userId: typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId,
        userTelegramId: telegramId,
        details: {
          amount,
          currency,
          ...details
        },
        source: 'SYSTEM',
        tags: ['financial', 'transaction', currency.toLowerCase()]
      });
    } catch (error) {
      logger.error('Failed to log financial transaction:', error);
    }
  }
  
  /**
   * Log a security event
   */
  async logSecurityEvent(
    userId?: mongoose.Types.ObjectId | string,
    telegramId?: number,
    action?: string,
    details?: any,
    severity: AuditSeverity = 'WARNING'
  ): Promise<void> {
    try {
      const logData: any = {
        action: action || 'SECURITY_EVENT',
        actionType: 'SECURITY',
        entityType: 'Security',
        details,
        source: 'SYSTEM',
        tags: ['security', 'event']
      };
      
      if (userId) {
        logData.userId = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;
      }
      
      if (telegramId) {
        logData.userTelegramId = telegramId;
      }
      
      await auditLogger[severity.toLowerCase() as 'info' | 'warning' | 'error' | 'critical'](logData);
    } catch (error) {
      logger.error('Failed to log security event:', error);
    }
  }
  
  /**
   * Log an API request
   */
  async logApiRequest(
    action: string,
    method: string,
    resource: string,
    statusCode: number,
    duration?: number,
    details?: any,
    severity: AuditSeverity = 'INFO'
  ): Promise<void> {
    try {
      await auditLogger[severity.toLowerCase() as 'info' | 'warning' | 'error' | 'critical']({
        action,
        actionType: 'READ',
        entityType: 'API',
        resource,
        method,
        statusCode,
        duration,
        details,
        source: 'API',
        tags: ['api', 'request', method.toLowerCase()]
      });
    } catch (error) {
      logger.error('Failed to log API request:', error);
    }
  }
  
  /**
   * Log a bot interaction
   */
  async logBotInteraction(
    telegramId: number,
    action: string,
    entityType: string,
    entityId?: string,
    details?: any,
    severity: AuditSeverity = 'INFO'
  ): Promise<void> {
    try {
      // Find user by telegramId
      const user = await User.findOne({ telegramId });
      
      await auditLogger[severity.toLowerCase() as 'info' | 'warning' | 'error' | 'critical']({
        action,
        actionType: 'READ',
        entityType,
        entityId,
        userId: user?._id,
        userTelegramId: telegramId,
        details,
        source: 'BOT',
        tags: ['bot', 'interaction', entityType.toLowerCase()]
      });
    } catch (error) {
      logger.error('Failed to log bot interaction:', error);
    }
  }
  
  /**
   * Log a cron job execution
   */
  async logCronJob(
    jobName: string,
    action: string,
    success: boolean,
    duration?: number,
    details?: any,
    severity: AuditSeverity = success ? 'INFO' : 'ERROR'
  ): Promise<void> {
    try {
      await auditLogger[severity.toLowerCase() as 'info' | 'warning' | 'error' | 'critical']({
        action,
        actionType: 'SYSTEM',
        entityType: 'CronJob',
        entityId: jobName,
        duration,
        details: {
          jobName,
          success,
          ...details
        },
        source: 'CRON',
        tags: ['cron', 'job', jobName.toLowerCase()]
      });
    } catch (error) {
      logger.error('Failed to log cron job:', error);
    }
  }
  
  /**
   * Log a queue job execution
   */
  async logQueueJob(
    queueName: string,
    jobId: string,
    action: string,
    success: boolean,
    duration?: number,
    details?: any,
    severity: AuditSeverity = success ? 'INFO' : 'ERROR'
  ): Promise<void> {
    try {
      await auditLogger[severity.toLowerCase() as 'info' | 'warning' | 'error' | 'critical']({
        action,
        actionType: 'SYSTEM',
        entityType: 'QueueJob',
        entityId: jobId,
        duration,
        details: {
          queueName,
          jobId,
          success,
          ...details
        },
        source: 'QUEUE',
        tags: ['queue', 'job', queueName.toLowerCase()]
      });
    } catch (error) {
      logger.error('Failed to log queue job:', error);
    }
  }
  
  /**
   * Get audit logs with filters
   */
  async getLogs(filters: {
    startDate?: Date;
    endDate?: Date;
    source?: AuditSource;
    severity?: AuditSeverity;
    actionType?: AuditActionType;
    userId?: mongoose.Types.ObjectId | string;
    userTelegramId?: number;
    entityType?: string;
    entityId?: string;
    limit?: number;
    skip?: number;
  }): Promise<{ logs: any[]; total: number }> {
    try {
      const query: any = {};
      
      // Date range
      if (filters.startDate || filters.endDate) {
        query.timestamp = {};
        if (filters.startDate) query.timestamp.$gte = filters.startDate;
        if (filters.endDate) query.timestamp.$lte = filters.endDate;
      }
      
      // Other filters
      if (filters.source) query.source = filters.source;
      if (filters.severity) query.severity = filters.severity;
      if (filters.actionType) query.actionType = filters.actionType;
      if (filters.userId) query.userId = typeof filters.userId === 'string' ? new mongoose.Types.ObjectId(filters.userId) : filters.userId;
      if (filters.userTelegramId) query.userTelegramId = filters.userTelegramId;
      if (filters.entityType) query.entityType = filters.entityType;
      if (filters.entityId) query.entityId = filters.entityId;
      
      const [logs, total] = await Promise.all([
        AuditLog.find(query)
          .sort({ timestamp: -1 })
          .skip(filters.skip || 0)
          .limit(filters.limit || 50)
          .lean(),
        AuditLog.countDocuments(query)
      ]);
      
      return { logs, total };
    } catch (error) {
      logger.error('Failed to get audit logs:', error);
      return { logs: [], total: 0 };
    }
  }
  
  /**
   * Get system statistics
   */
  async getStats(startDate?: Date, endDate?: Date): Promise<any> {
    try {
      const stats = await AuditLog.getStats(startDate, endDate);
      return stats;
    } catch (error) {
      logger.error('Failed to get audit stats:', error);
      return [];
    }
  }
  
  /**
   * Cleanup old audit logs
   */
  async cleanupOldLogs(days: number = 90): Promise<number> {
    try {
      const deletedCount = await AuditLog.cleanupOldLogs(days);
      logger.info(`Cleaned up ${deletedCount} old audit logs (older than ${days} days)`);
      return deletedCount;
    } catch (error) {
      logger.error('Failed to cleanup old audit logs:', error);
      return 0;
    }
  }
  
  /**
   * Search audit logs by action or description
   */
  async searchLogs(searchTerm: string, limit: number = 50): Promise<any[]> {
    try {
      return await AuditLog.find({
        $or: [
          { action: { $regex: searchTerm, $options: 'i' } },
          { entityType: { $regex: searchTerm, $options: 'i' } },
          { 'details.description': { $regex: searchTerm, $options: 'i' } },
          { tags: { $in: [new RegExp(searchTerm, 'i')] } }
        ]
      })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();
    } catch (error) {
      logger.error('Failed to search audit logs:', error);
      return [];
    }
  }
}

// Export singleton instance
export const auditService = new AuditService();

// Utility export for quick logging
export const auditLog = {
  system: (action: string, details?: any) =>
    auditService.logSystemAction(action, details),
  
  user: (
    userId: mongoose.Types.ObjectId | string,
    telegramId: number,
    action: string,
    actionType: AuditActionType,
    entityType: string,
    entityId?: string,
    details?: any
  ) => auditService.logUserAction(userId, telegramId, action, actionType, entityType, entityId, details),
  
  admin: (
    adminId: mongoose.Types.ObjectId | string,
    telegramId: number,
    action: string,
    actionType: AuditActionType,
    entityType: string,
    entityId?: string,
    details?: any
  ) => auditService.logAdminAction(adminId, telegramId, action, actionType, entityType, entityId, details),
  
  financial: (
    userId: mongoose.Types.ObjectId | string,
    telegramId: number,
    action: string,
    amount: number,
    currency?: string,
    transactionId?: string,
    details?: any
  ) => auditService.logFinancialTransaction(userId, telegramId, action, amount, currency, transactionId, details),
  
  security: (
    userId?: mongoose.Types.ObjectId | string,
    telegramId?: number,
    action?: string,
    details?: any,
    severity?: AuditSeverity
  ) => auditService.logSecurityEvent(userId, telegramId, action, details, severity),
  
  api: (
    action: string,
    method: string,
    resource: string,
    statusCode: number,
    duration?: number,
    details?: any
  ) => auditService.logApiRequest(action, method, resource, statusCode, duration, details),
  
  bot: (
    telegramId: number,
    action: string,
    entityType: string,
    entityId?: string,
    details?: any
  ) => auditService.logBotInteraction(telegramId, action, entityType, entityId, details),
  
  cron: (
    jobName: string,
    action: string,
    success: boolean,
    duration?: number,
    details?: any
  ) => auditService.logCronJob(jobName, action, success, duration, details),
  
  queue: (
    queueName: string,
    jobId: string,
    action: string,
    success: boolean,
    duration?: number,
    details?: any
  ) => auditService.logQueueJob(queueName, jobId, action, success, duration, details)
};