// src/bot/handlers/callbacks/subscription.ts - NEW FILE
import { CallbackQueryContext } from 'grammy';
import { Context } from '../../framework';
import { ChannelSubscription } from '../../../core/utils/channelSubscription';

export async function handleVerifySubscription(ctx: CallbackQueryContext<Context>) {
  await ChannelSubscription.handleVerifySubscription(ctx);
}

export async function handleWhySubscription(ctx: CallbackQueryContext<Context>) {
  await ChannelSubscription.handleWhySubscription(ctx);
}

export async function handleDismissSuggestion(ctx: CallbackQueryContext<Context>) {
  try {
    await ctx.answerCallbackQuery({ text: 'Got it!', show_alert: false });
    await ctx.deleteMessage();
  } catch (error) {
    // Ignore deletion errors
  }
}