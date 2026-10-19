// src/bot/framework/middleware/audit.ts
import { NextFunction } from 'grammy';
import { Context } from '../index';
import crypto from 'crypto';
import { auditService } from '../../../services/auditService';
import { User } from '../../../core/database/models/User';
import { logger } from '../../../core/utils/logger';
import { sanitizeInput } from '../../../core/utils/security';

export function auditMiddleware() {
  return async (ctx: Context, next: NextFunction) => {
    const startTime = Date.now();
    const userId = sanitizeInput(ctx.from?.id);
    
    // Get callback data from ctx.update or ctx.callbackQuery
    const callbackData = ctx.update?.callback_query?.data || ctx.callbackQuery?.data;
    
    // Skip audit for certain actions
    if (callbackData?.startsWith('ping')) {
      return next();
    }
    
    let user;
    if (userId) {
      user = await User.findOne({ telegramId: parseInt(userId) });
    }
    
    const auditData = {
      userId: user?._id,
      userTelegramId: userId,
      action: getActionFromContext(ctx),
      entityType: getEntityTypeFromContext(ctx),
      entityId: getEntityIdFromContext(ctx, callbackData),
      ipAddress: getIpFromContext(ctx),
      userAgent: getUserAgent(ctx),
      requestId: generateRequestId(),
      resource: getResourceFromContext(ctx, callbackData),
      method: getMethodFromContext(ctx)
    };
    
    try {
      await next();
      
      const duration = Date.now() - startTime;
      
      // Log successful action
      await auditService.logBotInteraction(
        parseInt(userId!),  // <-- convert to number
        auditData.action,
        auditData.entityType,
        auditData.entityId,
        {
          chatId: ctx.chat?.id,
          messageId: ctx.msg?.message_id,
          callbackData,
          command: ctx.msg?.text,
          duration,
          success: true
        }
      );
      
    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      // Log failed action
      await auditService.logBotInteraction(
        parseInt(userId!),
        `FAILED_${auditData.action}`,
        auditData.entityType,
        auditData.entityId,
        {
          error: error.message,
          stackTrace: error.stack,
          duration,
          success: false
        },
        'ERROR'
      );
            
      logger.error(`Bot action failed: ${auditData.action}`, error);
      
      throw error;
    }
  };
}

// Helper functions remain the same
function getActionFromContext(ctx: Context): string {
  if (ctx.message?.text) {
    if (ctx.message.text.startsWith('/')) {
      const command = ctx.message.text.split(' ')[0].substring(1);
      return `COMMAND_${command.toUpperCase()}`;
    }
    return 'MESSAGE_TEXT';
  }
  
  const callbackData = ctx.update?.callback_query?.data || ctx.callbackQuery?.data;
  if (callbackData) {
    const callbackPrefix = callbackData.split('_')[0];
    return `CALLBACK_${callbackPrefix.toUpperCase()}`;
  }
  
  if (ctx.message?.photo) return 'MESSAGE_PHOTO';
  if (ctx.message?.document) return 'MESSAGE_DOCUMENT';
  if (ctx.message?.contact) return 'MESSAGE_CONTACT';
  
  return 'UNKNOWN_ACTION';
}

function getEntityTypeFromContext(ctx: Context): string {
  const callbackData = ctx.update?.callback_query?.data || ctx.callbackQuery?.data;
  const messageText = ctx.message?.text;
  
  // Check callback data first
  if (callbackData) {
    // Job-related callbacks
    if (callbackData.includes('register') || 
        callbackData.includes('job') || 
        callbackData.includes('done') || 
        callbackData.includes('cancel')) {
      return 'Job';
    }
    // Payout-related callbacks
    if (callbackData.includes('payout')) {
      return 'Payout';
    }
  }
  
  // Check message text
  if (messageText?.startsWith('/balance')) return 'User';
  if (messageText?.startsWith('/register')) return 'Job';
  if (messageText?.startsWith('/accounts')) return 'Job';
  
  return 'Bot';
}

function getEntityIdFromContext(ctx: Context, callbackData?: string): string | undefined {
  if (callbackData) {
    const parts = callbackData.split('_');
    
    // For done_JOB-123, return JOB-123
    if (parts.length >= 2 && (parts[0] === 'done' || parts[0] === 'cancel')) {
      return parts[1];
    }
    
    // For other patterns, try to find an ID
    for (const part of parts) {
      if (part.includes('-') && (part.startsWith('JOB') || part.startsWith('job'))) {
        return part;
      }
    }
  }
  return undefined;
}

function getIpFromContext(ctx: Context): string | undefined {
  return undefined;
}

function getUserAgent(ctx: Context): string {
  return `Telegram Bot API - ${ctx.me?.username || 'unknown'}`;
}

function generateRequestId(): string {
  return crypto.randomUUID();
}

function getResourceFromContext(ctx: Context, callbackData?: string): string {
  if (ctx.message?.text) {
    return ctx.message.text.substring(0, 100);
  }
  if (callbackData) {
    return callbackData;
  }
  return 'unknown';
}

function getMethodFromContext(ctx: Context): string {
  if (ctx.message) return 'message';
  if (ctx.callbackQuery || ctx.update?.callback_query) return 'callback_query';
  return 'unknown';
}