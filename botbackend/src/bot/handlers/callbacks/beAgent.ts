// src/bot/handlers/callbacks/beAgent.ts
import { Context } from '../../framework';
import { User } from '../../../core/database/models/User';
import { AgentRequest } from '../../../core/database/models/AgentRequest';
import { logger } from '../../../core/utils/logger';
import { getSettings } from '@/core/utils/settingsCache';
import { replyWithTranslation, t } from '../../utils/i18n';
import { escapeMarkdown } from '@/core/utils/escapeMarkdown';

export async function handleBeAgent(ctx: Context) {
  await ctx.answerCallbackQuery();
  
  // Clear any existing session step to avoid interference
  if (ctx.session.step) {
    delete ctx.session.step;
  }
  
  const userId = ctx.from!.id;
  const user = await User.findOne({ telegramId: userId });
  if (!user) return;

  if (user.isAgent) {
    await replyWithTranslation(ctx, 'agent.already_agent');
    return;
  }

  const existingRequest = await AgentRequest.findOne({ userId: user._id, status: 'pending' });
  if (existingRequest) {
    await replyWithTranslation(ctx, 'agent.pending_request');
    return;
  }

  await AgentRequest.create({
    userId: user._id,
    status: 'pending',
    requestedAt: new Date(),
  });

  // Notify admins
  const adminIds = (getSettings().adminIds?.split(',') || []).map(id => parseInt(id.trim()));
  const escapedUsername = escapeMarkdown(user.username || user.telegramId.toString());
  const escapedFirstName = escapeMarkdown(user.firstName || '');

  for (const adminId of adminIds) {
    try {
      await ctx.api.sendMessage(adminId, 
        `👤 *New Agent Request*\n\n` +
        `User: @${escapedUsername} (${escapedFirstName})\n` +
        `User ID: ${user.telegramId}\n` +
        `Requested at: ${new Date().toLocaleString()}\n\n` +
        `Approve or reject via admin portal.`,
        { parse_mode: 'Markdown' }
      );
    } catch (err) {
      logger.error('Failed to send agent request notification to admin:', err);
    }
  }

  await replyWithTranslation(ctx, 'agent.request_submitted');
}