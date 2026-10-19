// src/services/channelShamoService.ts
import Redis from 'ioredis';
import { InlineKeyboard } from 'grammy';
import { env } from '../core/config/env';
import { ShamoRound } from '../core/database/models/ShamoRound';
import { logger } from '../core/utils/logger';
import { getSettings } from '../core/utils/settingsCache';

class ChannelShamoService {
  private bot: any = null;
  private sub: Redis | null = null;
  private editTimers: Map<string, NodeJS.Timeout> = new Map();

  async init(bot: any): Promise<void> {
    this.bot = bot;

    // Dedicated subscriber connection — does not conflict with redisManager
    this.sub = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 100, 3000),
    });

    this.sub.on('connect', () => logger.info('✅ ChannelShamo: Redis connected'));
    this.sub.on('error', (err) => logger.error('ChannelShamo Redis error:', err));

    await this.sub.subscribe('shamo:events');
    this.sub.on('message', (channel, raw) => {
      if (channel === 'shamo:events') this.handleEvent(raw);
    });

    logger.info('✅ ChannelShamo: subscribed to shamo:events');

    // Recover: if a round is active on boot and has no channel message, post it
    await this.recoverActiveRound();
  }

  private async handleEvent(raw: string): Promise<void> {
    try {
      const evt = JSON.parse(raw);
      if (evt.type === 'shamo_started')       await this.onRoundStarted(evt.data);
      else if (evt.type === 'shamo_button_claimed') this.scheduleEdit(evt.data.roundId);
      else if (evt.type === 'shamo_ended')    await this.onRoundEnded(evt.data);
    } catch (err) {
      logger.error('ChannelShamo event handling failed:', err);
    }
  }

  // ── Round started → post channel message ─────────────────────
  private async onRoundStarted(state: {
    roundId: string;
    totalButtons: number;
    prizePerButton: number;
    claimedCount: number;
  }): Promise<void> {
    const settings = getSettings();
    const rawChannel = settings.channelUsername;
    if (!rawChannel) {
      logger.warn('ChannelShamo: channelUsername not configured, skipping post');
      return;
    }
    const channelId = rawChannel.startsWith('@') ? rawChannel : `@${rawChannel}`;

    try {
      const remaining = state.totalButtons - state.claimedCount;
      const text = this.buildIdleMessage(state, remaining);
      const keyboard = remaining > 0
        ? new InlineKeyboard().text('🎁 Claim ሻሞ', `shamo_claim_${state.roundId}`)
        : undefined;

      const sent = await this.bot.api.sendMessage(channelId, text, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });

      await ShamoRound.updateOne(
        { roundId: state.roundId },
        {
          $set: {
            channelChatId: String(sent.chat.id),
            channelMessageId: sent.message_id,
          },
        }
      );

      logger.info(
        `📢 ChannelShamo message posted: ${state.roundId} → chat ${sent.chat.id}, msg ${sent.message_id}`
      );
    } catch (err: any) {
      logger.error('ChannelShamo: failed to post channel message:', err?.message || err);
      // Non-fatal — WS side continues independently
    }
  }

  // ── Round ended → edit message to "Ended" ─────────────────────
  private async onRoundEnded(data: { roundId: string; reason?: string }): Promise<void> {
    const round = await ShamoRound.findOne({ roundId: data.roundId }).lean();
    if (!round?.channelChatId || !round?.channelMessageId) return;

    const reasonLine =
      data.reason === 'all_claimed' ? 'All boxes claimed. Thanks for playing!'
      : data.reason === 'cancelled'  ? 'This round was cancelled.'
      : data.reason === 'expired'    ? 'Round expired.'
      : 'Round ended.';

    try {
      await this.bot.api.editMessageText(
        round.channelChatId,
        round.channelMessageId,
        `🎁 *ሻሞ Giveaway — Ended*\n\n${reasonLine}`,
        { parse_mode: 'Markdown' }
      );
    } catch (err: any) {
      if (this.isBenignEditError(err)) return;
      logger.error('ChannelShamo: ended message edit failed:', err?.message || err);
    }
  }

  // ── Debounced message edit on any claim ───────────────────────
  private scheduleEdit(roundId: string): void {
    if (this.editTimers.has(roundId)) return;
    const timer = setTimeout(async () => {
      this.editTimers.delete(roundId);
      await this.performEdit(roundId).catch((err) =>
        logger.error('ChannelShamo performEdit failed:', err)
      );
    }, 500);
    this.editTimers.set(roundId, timer);
  }

  private async performEdit(roundId: string): Promise<void> {
    const round = await ShamoRound.findOne({ roundId }).lean();
    if (!round?.channelChatId || !round?.channelMessageId) return;
    if (round.status !== 'active') return; // ended handler owns it now

    const remaining = round.totalButtons - round.claimedCount;
    const text = this.buildIdleMessage(
      {
        roundId,
        totalButtons: round.totalButtons,
        prizePerButton: round.prizePerButton,
        claimedCount: round.claimedCount,
      },
      remaining
    );

    const keyboard = remaining > 0
      ? new InlineKeyboard().text('🎁 Claim ሻሞ', `shamo_claim_${roundId}`)
      : undefined;

    try {
      await this.bot.api.editMessageText(
        round.channelChatId,
        round.channelMessageId,
        text,
        { parse_mode: 'Markdown', reply_markup: keyboard }
      );
    } catch (err: any) {
      // If the channel message was deleted, clear and repost
      if (err?.description?.includes('message to edit not found')) {
        await ShamoRound.updateOne(
          { roundId },
          { $set: { channelChatId: null, channelMessageId: null } }
        );
        await this.onRoundStarted({
          roundId,
          totalButtons: round.totalButtons,
          prizePerButton: round.prizePerButton,
          claimedCount: round.claimedCount,
        });
        return;
      }
      if (this.isBenignEditError(err)) return;
      logger.error('ChannelShamo edit failed:', err?.message || err);
    }
  }

  private isBenignEditError(err: any): boolean {
    const d = String(err?.description || '');
    return d.includes('message is not modified') || d.includes('message to edit not found');
  }

  private buildIdleMessage(
    state: {
      roundId: string;
      totalButtons: number;
      prizePerButton: number;
      claimedCount?: number;
    },
    remaining: number
  ): string {
    return (
      `🎁 *ሻሞ Giveaway — LIVE NOW*\n\n` +
      `${state.totalButtons} boxes × ${state.prizePerButton} ETB locked bonus\n` +
      `First come, first served!\n\n` +
      `⏳ Remaining: *${remaining} / ${state.totalButtons}* boxes`
    );
  }

  // ── Boot recovery ─────────────────────────────────────────────
  private async recoverActiveRound(): Promise<void> {
    try {
      const active = await ShamoRound.findOne({ status: 'active' }).lean();
      if (!active) return;

      if (active.channelMessageId && active.channelChatId) {
        // Refresh in case claimedCount drifted while offline
        this.scheduleEdit(active.roundId);
        return;
      }

      logger.info(`ChannelShamo: recovering round ${active.roundId}`);
      await this.onRoundStarted({
        roundId: active.roundId,
        totalButtons: active.totalButtons,
        prizePerButton: active.prizePerButton,
        claimedCount: active.claimedCount,
      });
    } catch (err) {
      logger.error('ChannelShamo recovery failed:', err);
    }
  }

  async shutdown(): Promise<void> {
    this.editTimers.forEach((t) => clearTimeout(t));
    this.editTimers.clear();
    if (this.sub) await this.sub.quit().catch(() => {});
  }
}

export const channelShamoService = new ChannelShamoService();