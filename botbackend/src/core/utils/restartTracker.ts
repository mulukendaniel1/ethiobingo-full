// src/core/utils/restartTracker.ts - COMPLETE FILE
import { Schema, model, Document, Types } from 'mongoose';
import { sanitizeInput } from './security';
export interface IRestartRecord extends Document {
  adminId: number;
  chatId: number;
  messageId?: number;
  requestedAt: Date;
  completedAt?: Date;
  status: 'pending' | 'completed' | 'failed';
  botVersion?: string;
  _id: Types.ObjectId;
}

const restartRecordSchema = new Schema<IRestartRecord>({
  adminId: { type: Number, required: true },
  chatId: { type: Number, required: true },
  messageId: { type: Number },
  requestedAt: { type: Date, default: Date.now },
  completedAt: { type: Date },
  status: { 
    type: String, 
    enum: ['pending', 'completed', 'failed'],
    default: 'pending' 
  },
  botVersion: { type: String }
});

// Index for faster queries
restartRecordSchema.index({ adminId: 1, requestedAt: -1 });
restartRecordSchema.index({ status: 1, requestedAt: 1 });
restartRecordSchema.index({ requestedAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 }); // Auto-delete after 30 days

export const RestartRecord = model<IRestartRecord>('RestartRecord', restartRecordSchema);

// Track restart requests
export async function trackRestartRequest(
  adminId: number, 
  chatId: number, 
  messageId?: number
): Promise<string> {
  const safeAdminId = parseInt(sanitizeInput(adminId.toString()));
  const safeChatId = parseInt(sanitizeInput(chatId.toString()));
  const safeMessageId = messageId ? parseInt(sanitizeInput(messageId.toString())) : undefined;

  const record = await RestartRecord.create({
    adminId: safeAdminId,
    chatId: safeChatId,
    messageId: safeMessageId,
    status: 'pending',
    botVersion: process.env.npm_package_version || '1.0.0'
  });
  return record._id.toString();
}

export async function markRestartCompleted(recordId: string): Promise<void> {
  const safeRecordId = sanitizeInput(recordId);
  await RestartRecord.findByIdAndUpdate(safeRecordId, {
    status: 'completed',
    completedAt: new Date()
  });
}

export async function markRestartFailed(recordId: string, error?: string): Promise<void> {
  const safeRecordId = sanitizeInput(recordId);
  await RestartRecord.findByIdAndUpdate(safeRecordId, {
    status: 'failed',
    completedAt: new Date()
  });
}

export async function getRestartById(restartId: string): Promise<IRestartRecord | null> {
  const safeRestartId = sanitizeInput(restartId);
  return RestartRecord.findById(safeRestartId);
}

export async function getAdminRestarts(adminId: number, limit: number = 10): Promise<IRestartRecord[]> {
  const safeAdminId = parseInt(sanitizeInput(adminId.toString()));
  return RestartRecord.find({ adminId: safeAdminId })
    .sort({ requestedAt: -1 })
    .limit(limit);
}

// Get all recent restarts
export async function getAllRestarts(limit: number = 50): Promise<IRestartRecord[]> {
  const safeLimit = parseInt(sanitizeInput(limit.toString()));
  return RestartRecord.find()
    .sort({ requestedAt: -1 })
    .limit(limit);
}

// Check for pending restarts
export async function getPendingRestarts(): Promise<IRestartRecord[]> {
  return RestartRecord.find({ 
    status: 'pending',
    requestedAt: { $gte: new Date(Date.now() - 5 * 60 * 1000) } // Last 5 minutes
  }).sort({ requestedAt: 1 });
}