// src/core/database/models/AuditLog.ts - COMPLETE FIXED VERSION
import mongoose, { Schema, model, Document, Model } from 'mongoose';
import { env } from '../../config/env';
import { sanitizeInput } from '../../utils/security';
import NotificationService from '@/services/notificationService';
import { getSettings } from '@/core/utils/settingsCache';

// Audit Log Sources (REMOVED MTProto)
export type AuditSource = 'SYSTEM' | 'API' | 'BOT' | 'CRON' | 'QUEUE' | 'WEB' | 'ORCHESTRATOR' | 'ADMIN';

// Audit Action Types
export type AuditActionType = 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'SYSTEM' | 'FINANCIAL' | 'SECURITY';

// Audit Severity Levels
export type AuditSeverity = 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';

export interface IAuditLog extends Document {
  // Core Information
  action: string;
  actionType: AuditActionType;
  severity: AuditSeverity;
  
  // Entity Information
  entityType: string;
  entityId?: string;
  
  // User Information
  userId?: mongoose.Types.ObjectId;
  userTelegramId?: number;
  ipAddress?: string;
  userAgent?: string;
  
  // Request Information
  requestId: string;
  resource?: string;
  method?: string;
  statusCode?: number;
  
  // Error Information
  errorMessage?: string;
  stackTrace?: string;
  
  // Additional Details
  details?: any;
  tags?: string[];
  
  // Source & Environment
  source: AuditSource;
  environment: 'development' | 'production' | 'testing' | 'staging' | 'test';
  
  // Timestamps
  timestamp: Date;
  duration?: number; // in milliseconds
  createdAt: Date;
  updatedAt: Date;
}

interface AuditLogModel extends Model<IAuditLog> {
  log(data: AuditLogData): Promise<IAuditLog>;
  findByRequestId(requestId: string): Promise<IAuditLog | null>;
  findByUserId(userId: mongoose.Types.ObjectId | string, limit?: number): Promise<IAuditLog[]>;
  findByAction(action: string, limit?: number): Promise<IAuditLog[]>;
  cleanupOldLogs(days: number): Promise<number>;
  getStats(startDate?: Date, endDate?: Date): Promise<any>;
}

interface AuditLogData {
  action: string;
  actionType: AuditActionType;
  severity: AuditSeverity;
  entityType: string;
  entityId?: string;
  userId?: mongoose.Types.ObjectId | string;
  userTelegramId?: number;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  resource?: string;
  method?: string;
  statusCode?: number;
  errorMessage?: string;
  stackTrace?: string;
  details?: any;
  tags?: string[];
  source: AuditSource;
  environment?: 'development' | 'production' | 'testing' | 'staging';
  timestamp?: Date;
  duration?: number;
}

const AuditLogSchema = new Schema<IAuditLog, AuditLogModel>({
  // Core Information
  action: {
    type: String,
    required: true,
    index: true
  },
  actionType: {
    type: String,
    required: true,
    enum: ['CREATE', 'READ', 'UPDATE', 'DELETE', 'SYSTEM', 'FINANCIAL', 'SECURITY']
  },
  severity: {
    type: String,
    required: true,
    enum: ['INFO', 'WARNING', 'ERROR', 'CRITICAL']
  },
  
  // Entity Information
  entityType: {
    type: String,
    required: true
  },
  entityId: {
    type: String,
    index: true
  },
  
  // User Information
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  userTelegramId: {
    type: Number,
    index: true
  },
  ipAddress: {
    type: String
  },
  userAgent: {
    type: String
  },
  
  // Request Information
  requestId: {
    type: String,
    required: true,
    index: true,
    default: () => require('crypto').randomUUID()
  },
  resource: {
    type: String
  },
  method: {
    type: String
  },
  statusCode: {
    type: Number
  },
  
  // Error Information
  errorMessage: {
    type: String
  },
  stackTrace: {
    type: String
  },
  
  // Additional Details
  details: {
    type: Schema.Types.Mixed
  },
  tags: {
    type: [String],
    default: []
  },
  
  // Source & Environment
  source: {
    type: String,
    required: true,
    enum: ['SYSTEM', 'API', 'BOT', 'CRON', 'QUEUE', 'WEB', 'ORCHESTRATOR', 'ADMIN']
  },
  environment: {
  type: String,
  required: true,
  enum: ['development', 'production', 'testing', 'staging', 'test'], // added 'test'
  default: () => env.NODE_ENV
},
  
  // Timestamps
  timestamp: {
    type: Date,
    required: true,
    default: Date.now
    },
  duration: {
    type: Number
  }
}, {
  timestamps: true,
  collection: 'auditlogs'
});

// Indexes
AuditLogSchema.index({ actionType: 1, timestamp: -1 });
AuditLogSchema.index({ severity: 1, timestamp: -1 });
AuditLogSchema.index({ source: 1, timestamp: -1 });
AuditLogSchema.index({ userId: 1, timestamp: -1 });
AuditLogSchema.index({ userTelegramId: 1, timestamp: -1 });
AuditLogSchema.index({ environment: 1, timestamp: -1 });

// Static Methods
AuditLogSchema.statics.log = async function(data: AuditLogData): Promise<IAuditLog> {
  try {
    // Skip logging in testing environment if configured
    if (env.NODE_ENV === 'testing' && process.env.SKIP_AUDIT_LOG === 'true') {
      return {} as IAuditLog;
    }
    
    const auditLog = new this({
      ...data,
      requestId: data.requestId || require('crypto').randomUUID(),
      environment: data.environment || env.NODE_ENV,
      timestamp: data.timestamp || new Date()
    });
    
    const savedLog = await auditLog.save();

    // 🚨 Send Telegram alert for CRITICAL severity
    if (data.severity === 'CRITICAL') {
      try {
        const notificationService = new NotificationService();
        const adminIds = getSettings().adminIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
        const message = `🚨 *CRITICAL EVENT*\n\n` +
          `Action: ${data.action}\n` +
          `Type: ${data.actionType}\n` +
          `Entity: ${data.entityType}${data.entityId ? ` (${data.entityId})` : ''}\n` +
          `User: ${data.userTelegramId ? `@${data.userTelegramId}` : 'System'}\n` +
          `Details: ${JSON.stringify(data.details)}\n` +
          `Request ID: \`${savedLog.requestId}\``;
        for (const adminId of adminIds) {
          await notificationService.sendAdminAlert(message, 'error');
        }
      } catch (alertErr) {
        console.error('Failed to send critical alert:', alertErr);
      }
    }
    
    return savedLog;
  } catch (error) {
    console.error('Failed to save audit log:', error);
    throw error;
  }
};

AuditLogSchema.statics.findByRequestId = async function(requestId: string): Promise<IAuditLog | null> {
  const safeRequestId = sanitizeInput(requestId);
  return this.findOne({ requestId: safeRequestId }).exec();
};

AuditLogSchema.statics.findByUserId = async function(
  userId: mongoose.Types.ObjectId | string,
  limit: number = 50
): Promise<IAuditLog[]> {
  let safeUserId: mongoose.Types.ObjectId | string;
  if (typeof userId === 'string') {
    safeUserId = sanitizeInput(userId);
  } else {
    safeUserId = userId;
  }
  return this.find({ userId: safeUserId })
    .sort({ timestamp: -1 })
    .limit(limit)
    .exec();
};

AuditLogSchema.statics.findByAction = async function(
  action: string,
  limit: number = 100
): Promise<IAuditLog[]> {
  const safeAction = sanitizeInput(action);
  return this.find({ action: safeAction })
    .sort({ timestamp: -1 })
    .limit(limit)
    .exec();
};

AuditLogSchema.statics.cleanupOldLogs = async function(days: number = 90): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  const result = await this.deleteMany({
    timestamp: { $lt: cutoffDate },
    severity: { $in: ['INFO', 'WARNING'] }
  });
  
  return result.deletedCount || 0;
};

AuditLogSchema.statics.getStats = async function(
  startDate?: Date, 
  endDate?: Date
): Promise<any> {
  const matchStage: any = {};
  
  if (startDate || endDate) {
    matchStage.timestamp = {};
    if (startDate) matchStage.timestamp.$gte = startDate;
    if (endDate) matchStage.timestamp.$lte = endDate;
  }
  
  const stats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: {
          source: '$source',
          severity: '$severity',
          actionType: '$actionType'
        },
        count: { $sum: 1 },
        avgDuration: { $avg: '$duration' },
        uniqueUsers: { $addToSet: '$userId' }
      }
    },
    {
      $group: {
        _id: '$_id.source',
        totalLogs: { $sum: '$count' },
        severityBreakdown: {
          $push: {
            severity: '$_id.severity',
            count: '$count'
          }
        },
        actionTypeBreakdown: {
          $push: {
            actionType: '$_id.actionType',
            count: '$count'
          }
        },
        avgDuration: { $avg: '$avgDuration' },
        uniqueUsers: { $sum: { $size: '$uniqueUsers' } }
      }
    },
    { $sort: { totalLogs: -1 } }
  ]);
  
  return stats;
};

// TTL index for auto‑deletion after 7 days
AuditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

// Export the model
export const AuditLog = model<IAuditLog, AuditLogModel>('AuditLog', AuditLogSchema);

// Utility function for logging
export const auditLogger = {
  info: (data: Omit<AuditLogData, 'severity'>) => 
    AuditLog.log({ ...data, severity: 'INFO' }),
  
  warning: (data: Omit<AuditLogData, 'severity'>) => 
    AuditLog.log({ ...data, severity: 'WARNING' }),
  
  error: (data: Omit<AuditLogData, 'severity'>) => 
    AuditLog.log({ ...data, severity: 'ERROR' }),
  
  critical: (data: Omit<AuditLogData, 'severity'>) => 
    AuditLog.log({ ...data, severity: 'CRITICAL' })
};