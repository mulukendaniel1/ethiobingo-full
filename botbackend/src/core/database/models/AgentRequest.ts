// src/core/database/models/AgentRequest.ts
import mongoose, { Schema, Document } from 'mongoose';

export interface IAgentRequest extends Document {
  userId: mongoose.Types.ObjectId;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: Date;
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedAt?: Date;
  notes?: string;
}

const AgentRequestSchema = new Schema<IAgentRequest>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  requestedAt: { type: Date, default: Date.now },
  reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: Date,
  notes: String,
});

export const AgentRequest = mongoose.model<IAgentRequest>('AgentRequest', AgentRequestSchema);