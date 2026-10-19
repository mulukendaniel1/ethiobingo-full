//apps/bingo-game-engine/src/engine/ShamoManager.ts
import { Redis } from 'ioredis';
import EventEmitter from 'events';
import { logger } from '../utils/logger';

export interface ShamoState {
  roundId: string;
  status: string;
  startedAt: string;
  totalButtons: number;
  prizePerButton: number;
  claimedCount: number;
  claimedButtons: number[];
  claimedUsers: string[];
  eligibilityDepositDays: number;
  cooldownHours: number;
}

export interface ShamoClaimBroadcast {
  roundId: string;
  buttonIndex: number;
  userId: string;
  prize: number;
  claimedCount: number;
}

export class ShamoManager extends EventEmitter {
  private redis: Redis;
  private sub: Redis;
  private state: ShamoState | null = null;

  constructor(redis: Redis) {
    super();
    this.redis = redis;
    this.sub = redis.duplicate();

    this.sub.subscribe('shamo:events').catch(err =>
      logger.error('Shamo subscribe failed:', err)
    );

    this.sub.on('message', (ch, msg) => {
      if (ch !== 'shamo:events') return;
      try {
        const evt = JSON.parse(msg);

        if (evt.type === 'shamo_started') {
          this.state = evt.data;
          this.emit('shamoStarted', this.state);
          logger.info(`[Shamo] started: ${this.state?.roundId}`);
          return;
        }

        if (evt.type === 'shamo_ended') {
          const { roundId, reason, claimedCount } = evt.data;
          this.state = null;
          this.emit('shamoEnded', { roundId, reason, claimedCount });
          logger.info(`[Shamo] ended: ${roundId} (${reason})`);
          return;
        }

        if (evt.type === 'shamo_button_claimed') {
          const data: ShamoClaimBroadcast = evt.data;

          // Update local mirror only for the current round
          if (this.state && this.state.roundId === data.roundId) {
            if (!this.state.claimedButtons.includes(data.buttonIndex)) {
              this.state.claimedButtons.push(data.buttonIndex);
              this.state.claimedCount = data.claimedCount;
              if (!this.state.claimedUsers.includes(data.userId)) {
                this.state.claimedUsers.push(data.userId);
              }
            }
          }

          // Single emit point — every instance (including origin) fires this once.
          this.emit('shamoButtonClaimed', data);
        }
      } catch (e) {
        logger.error('Shamo message parse error:', e);
      }
    });
  }

  setState(s: ShamoState | null): void {
    this.state = s;
  }

  getState(): ShamoState | null {
    return this.state;
  }

  /**
   * Publish a claim to all engine instances.
   * Intentionally does NOT emit locally — the subscriber above will receive
   * this same message and fire `shamoButtonClaimed` exactly once per instance.
   */
  async broadcastClaim(data: ShamoClaimBroadcast): Promise<void> {
    await this.redis
      .publish('shamo:events', JSON.stringify({
        type: 'shamo_button_claimed',
        data,
      }))
      .catch(err => logger.error('Shamo broadcast publish failed:', err));
  }
}