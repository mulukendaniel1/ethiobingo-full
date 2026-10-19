// src/bot/handlers/helpers.ts
import { Context } from '../framework';
import { logger } from '../../core/utils/logger';

export async function safeEditMessage(ctx: Context, text: string, options?: any) {
    if (ctx.editMessageText) {
        try {
            return await ctx.editMessageText(text, options);
        } catch (error) {
            logger.debug('Edit message failed:', error);
            if (ctx.reply) {
                return await ctx.reply(text, options);
            }
        }
    }
    if (ctx.reply) {
        return await ctx.reply(text, options);
    }
    return null;
}

export async function safeAnswerCallback(ctx: Context, text?: string) {
    if (ctx.answerCallbackQuery) {
        try {
            await ctx.answerCallbackQuery(text ? { text } : undefined);
        } catch (error) {
            logger.debug('Callback answer error:', error);
        }
    }
}

// Helper for creating inline keyboards
export function createInlineKeyboard(buttons: Array<Array<{ text: string; callback_data: string }>>) {
    return {
        inline_keyboard: buttons
    };
}

// Helper for creating reply keyboards
export function createReplyKeyboard(buttons: string[][], resize = true) {
    return {
        keyboard: buttons.map(row => row.map(text => ({ text }))),
        resize_keyboard: resize,
        one_time_keyboard: false,
        selective: true
    };
}


// Helper to get user mention
export function getUserMention(user: any) {
    if (user.username) {
        return `@${user.username}`;
    }
    return user.firstName || `User ${user.telegramId}`;
}

// Helper to handle message sending with retry
export async function sendMessageWithRetry(
    ctx: Context | any, 
    text: string, 
    options?: any, 
    maxRetries = 3
) {
    let lastError;
    
    for (let i = 0; i < maxRetries; i++) {
        try {
            if (ctx.reply) {
                return await ctx.reply(text, options);
            } else if (ctx.editMessageText) {
                return await ctx.editMessageText(text, options);
            } else if (ctx.api?.sendMessage) {
                return await ctx.api.sendMessage(ctx.chat?.id || ctx.from?.id, text, options);
            }
        } catch (error: any) {
            lastError = error;
            logger.warn(`Message send attempt ${i + 1} failed:`, error.message);
            
            // Wait before retry (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
    }
    
    throw lastError || new Error('Failed to send message');
}