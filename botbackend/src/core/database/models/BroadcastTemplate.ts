// src/core/database/models/BroadcastTemplate.ts
import mongoose, { Schema, Document } from 'mongoose';

export interface IBroadcastTemplate extends Document {
  name: string;
  title: string;
  content: string;
  type: 'announcement' | 'promotion' | 'update' | 'alert' | 'educational';
  target: 'all' | 'active' | 'balance' | 'recent';
  channels: ('bot' | 'channel')[];
  isActive: boolean;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// Input type for creation (without Mongoose document fields)
export interface BroadcastTemplateCreateInput {
  name: string;
  title: string;
  content: string;
  type: 'announcement' | 'promotion' | 'update' | 'alert' | 'educational';
  target: 'all' | 'active' | 'balance' | 'recent';
  channels: ('bot' | 'channel')[];
  isActive: boolean;
}

const BroadcastTemplateSchema = new Schema<IBroadcastTemplate>({
  name: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  content: { type: String, required: true },
  type: {
    type: String,
    enum: ['announcement', 'promotion', 'update', 'alert', 'educational'],
    default: 'announcement'
  },
  target: {
    type: String,
    enum: ['all', 'active', 'balance', 'recent'],
    default: 'all'
  },
  channels: [{
    type: String,
    enum: ['bot', 'channel'],
    default: ['bot']
  }],
  isActive: { type: Boolean, default: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

export const BroadcastTemplate = mongoose.model<IBroadcastTemplate>('BroadcastTemplate', BroadcastTemplateSchema);