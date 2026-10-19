// src/bot/handlers/channelShamo.ts
import { Context } from '../framework';
import { CallbackQueryContext } from 'grammy';
import { User } from '../../core/database/models/User';
import { ShamoRound } from '../../core/database/models/ShamoRound';
import { shamoService } from '../../services/shamoService';
import { logger } from '../../core/utils/logger';
import { redisManager } from '../../core/database/connections/redis';
import { getSettings } from '../../core/utils/settingsCache';

// Simple per-user throttle for channel clicks — separate from the WS flow
const lastClaimByUser = new Map<number, number>();
const CLAIM_THROTTLE_MS = 1500;

export async function handleChannelShamoClaim(ctx: CallbackQueryContext<Context>) {
  const roundId = ctx.match?.[1];
  const telegramId = ctx.from?.id;

  const ack = (text: string, alert = false) =>
    ctx.answerCallbackQuery({ text, show_alert: alert, cache_time: 0 }).catch(() => {});

  if (!roundId || !telegramId) return ack('Invalid request.', true);

  try {
    // Throttle
    const now = Date.now();
    const last = lastClaimByUser.get(telegramId) || 0;
    if (now - last < CLAIM_THROTTLE_MS) return ack('Slow down — try again in a moment.', true);
    lastClaimByUser.set(telegramId, now);
    if (lastClaimByUser.size > 5000) lastClaimByUser.clear();

    const user = await User.findOne({ telegramId });
    if (!user) {
      const botUsername = (getSettings().botUsername || 'ethio_bingoobot').replace(/^@/, '');
      return ack(`Please start @${botUsername} first, then come back.`, true);
    }
    if (user.isBanned) return ack('Your account is suspended.', true);

    const round = await ShamoRound.findOne({ roundId }).lean();
    if (!round || round.status !== 'active') return ack('This ሻሞ round has ended.', true);

    // Random open slot
    const redis = redisManager.getClient();
    const claimedSlots = await redis.smembers(`shamo:${roundId}:btns`);
    const claimedSet = new Set(claimedSlots.map(Number));
    const openSlots: number[] = [];
    for (let i = 0; i < round.totalButtons; i++) if (!claimedSet.has(i)) openSlots.push(i);
    if (openSlots.length === 0) return ack('All boxes have been claimed!', true);

    const buttonIndex = openSlots[Math.floor(Math.random() * openSlots.length)];

    const result = await shamoService.claim({
      roundId,
      userId: user._id as any,
      buttonIndex,
      ipAddress: 'channel',
    });

    if (!result.success) return ack(result.error || 'Could not claim.', true);

    // Fire-and-forget side effects — do NOT block the ack
    ctx.api.sendMessage(
      telegramId,
      `🎁 *ሻሞ Prize Claimed!*\n\n` +
      `Amount: *${result.prize} ETB* (locked bonus)\n` +
      `Round: \`${roundId}\`\n` +
      `Box: #${buttonIndex + 1}\n\n` +
      `💡 Play games to unlock withdrawals.`,
      { parse_mode: 'Markdown' }
    ).catch(() => {});

    redis.publish(
      'shamo:events',
      JSON.stringify({
        type: 'shamo_button_claimed',
        data: {
          roundId,
          buttonIndex,
          userId: user._id.toString(),
          prize: result.prize,
          claimedCount: result.claimedCount,
        },
      })
    ).catch((err) => logger.error('ChannelShamo publish failed:', err));

    logger.info(
      `🎁 Channel ሻሞ claim: telegram ${telegramId} won ${result.prize} in ${roundId} (box #${buttonIndex + 1})`
    );

    // ✅ Single ack — the ONLY one for this query
    return ack(`🎉 You won ${result.prize} ETB (locked bonus)!`, false);
  } catch (err) {
    logger.error('ChannelShamo claim handler error:', err);
    return ack('Something went wrong. Please try again.', true);
  }
}