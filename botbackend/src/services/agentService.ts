// src/services/agentService.ts
import mongoose from 'mongoose';
import { User } from '../core/database/models/User';
import { AgentRequest } from '../core/database/models/AgentRequest';
import { NotificationService } from './notificationService';
import { logger } from '../core/utils/logger';

export class AgentService {
  private notificationService: NotificationService;

  constructor() {
    this.notificationService = new NotificationService();
  }

  async approveAgentRequest(requestId: string | mongoose.Types.ObjectId, adminId: mongoose.Types.ObjectId) {
  const request = await AgentRequest.findById(requestId);
  if (!request) throw new Error('Request not found');
  if (request.status !== 'pending') throw new Error('Request already processed');

  const user = await User.findById(request.userId);
  if (!user) throw new Error('User not found');

  user.isAgent = true;
  user.agentApprovedAt = new Date();   // ← critical for commission cut-off
  await user.save();

  request.status = 'approved';
  request.reviewedBy = adminId;
  request.reviewedAt = new Date();
  await request.save();

  await this.notificationService.sendAgentApproved(user.telegramId);
  return { success: true };
}

  async rejectAgentRequest(requestId: string | mongoose.Types.ObjectId, adminId: mongoose.Types.ObjectId, reason?: string) {
    const request = await AgentRequest.findById(requestId);
    if (!request) throw new Error('Request not found');
    if (request.status !== 'pending') throw new Error('Request already processed');

    const user = await User.findById(request.userId);
    if (!user) throw new Error('User not found');

    request.status = 'rejected';
    request.reviewedBy = adminId;
    request.reviewedAt = new Date();
    request.notes = reason;
    await request.save();

    await this.notificationService.sendAgentRejected(user.telegramId, reason);
    return { success: true };
  }

  async getPendingRequests() {
    return await AgentRequest.find({ status: 'pending' })
      .populate('userId', 'telegramId username firstName')
      .sort({ requestedAt: -1 });
  }
}