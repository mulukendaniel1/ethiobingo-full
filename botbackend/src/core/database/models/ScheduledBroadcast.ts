//src/core/database/models/ScheduledBroadcast.ts
import mongoose, { Schema, model, Document } from 'mongoose';

export interface IScheduledBroadcast extends Document {
  title: string;
  content: string;
  type: 'announcement' | 'promotion' | 'update' | 'alert' | 'educational';
  target: 'all' | 'active' | 'balance' | 'recent' | 'specific';
  channels: ('bot' | 'channel' | 'both')[];
  filters: any;
  scheduledTime: Date;
  status: 'scheduled' | 'processing' | 'completed' | 'failed' | 'cancelled';
  sentCount?: number;
  failedCount?: number;
  successRate?: number;
  createdBy: mongoose.Types.ObjectId;
  completedAt?: Date;
  cancelledAt?: Date;
  error?: string;
  metadata?: any;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

const ScheduledBroadcastSchema = new Schema<IScheduledBroadcast>({
  title: { type: String, required: true },
  content: { type: String, required: true },
  type: { 
    type: String, 
    required: true,
    enum: ['announcement', 'promotion', 'update', 'alert', 'educational']
  },
  target: {
    type: String,
    required: true,
    enum: ['all', 'active', 'balance', 'recent', 'specific']
  },
  channels: [{
    type: String,
    enum: ['bot', 'channel', 'both'],
    required: true
  }],
  filters: { type: Schema.Types.Mixed, default: {} },
  scheduledTime: { type: Date, required: true },
  status: {
    type: String,
    enum: ['scheduled', 'processing', 'completed', 'failed', 'cancelled'],
    default: 'scheduled'
  },
  sentCount: { type: Number, default: 0 },
  failedCount: { type: Number, default: 0 },
  successRate: { type: Number, default: 0 },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  completedAt: { type: Date },
  cancelledAt: { type: Date },
  error: { type: String },
  metadata: { type: Schema.Types.Mixed }
}, {
  timestamps: true
});

// Indexes
ScheduledBroadcastSchema.index({ scheduledTime: 1, status: 1 });
ScheduledBroadcastSchema.index({ createdBy: 1, createdAt: -1 });
ScheduledBroadcastSchema.index({ status: 1 });

export const ScheduledBroadcast = model<IScheduledBroadcast>('ScheduledBroadcast', ScheduledBroadcastSchema);