// apps/bingo-game-engine/src/engine/GameLoop.ts
import { Redis } from 'ioredis';
import { RoundManager } from './RoundManager';
import { config } from '../config';
import { logger } from '../utils/logger';

export class GameLoop {
  private redis: Redis;
  private roundManager: RoundManager;
  private selectionInterval: ReturnType<typeof setTimeout> | null = null;
  private winnerPauseTimeout: ReturnType<typeof setTimeout> | null = null;
  private selectionCountdown: number = 30; // seconds
  private ballDrawInterval: number = config.BALL_DRAW_INTERVAL_MS;
  private phase: 'selection' | 'game' = 'selection';
  private gameTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(redis: Redis, roundManager: RoundManager) {
    this.redis = redis;
    this.roundManager = roundManager;
  }

  public async start() {
    await this.startSelectionPhase();
  }

  public stop() {
    if (this.selectionInterval) clearInterval(this.selectionInterval);
    if (this.gameTimeout) { clearTimeout(this.gameTimeout); this.gameTimeout = null; }
    if (this.winnerPauseTimeout) clearTimeout(this.winnerPauseTimeout);
  }

  public async resumeRound(roundData: any, roundManager: RoundManager) {
    this.roundManager = roundManager;
    this.phase = roundData.phase;

    if (this.phase === 'selection') {
      const elapsed = Date.now() - new Date(roundData.selectionStartTime).getTime();
      const remaining = Math.max(0, this.selectionCountdown * 1000 - elapsed);
      if (remaining <= 0) {
        await this.roundManager.startGame();
        this.startGamePhase();
      } else {
        const interval = setInterval(() => {
          const seconds = Math.ceil(remaining / 1000);
          this.redis.publish('bingo:countdown', JSON.stringify({ countdown: seconds, phase: 'selection' }));
          if (seconds <= 0) {
            clearInterval(interval);
            this.roundManager.startGame();
            this.startGamePhase();
          }
        }, 1000);
        this.selectionInterval = interval;
      }
    } else if (this.phase === 'game') {
      const lastDraw = roundData.lastBallDrawTime ? new Date(roundData.lastBallDrawTime) : new Date();
      const now = Date.now();
      const timeSinceLastDraw = now - lastDraw.getTime();
      const nextDrawDelay = Math.max(0, this.ballDrawInterval - timeSinceLastDraw);
      if (nextDrawDelay <= 0) {
        await this.roundManager.drawNextBall();
        this.startGameInterval();
      } else {
        setTimeout(async () => {
          await this.roundManager.drawNextBall();
          this.startGameInterval();
        }, nextDrawDelay);
      }
    }
  }

  private async startSelectionPhase() {
    this.stop();
    if (await this.roundManager.isGamePaused()) {
      logger.info('Game is paused – not starting new round');
      return;
    }
    this.phase = 'selection';
    await this.roundManager.startNewRound();
    logger.info('Selection phase started, countdown begins.');

    let remaining = this.selectionCountdown;

    const countdownInterval = setInterval(async () => {
      remaining--;
      logger.debug(`Countdown: ${remaining}s remaining`);
      await this.redis.publish('bingo:countdown', JSON.stringify({ countdown: remaining, phase: 'selection' }));
      if (remaining <= 0) {
        clearInterval(countdownInterval);
        this.selectionInterval = null;
        await this.roundManager.startGame();
        this.startGamePhase();
      }
    }, 1000);
    this.selectionInterval = countdownInterval;
  }

  private startGamePhase() {
    if (this.selectionInterval) {
      clearInterval(this.selectionInterval);
      this.selectionInterval = null;
    }
    this.phase = 'game';
    logger.info('Game phase started, starting ball draw interval.');
    this.startGameInterval();
  }

private startGameInterval() {
  if (this.gameTimeout) clearTimeout(this.gameTimeout);

  const drawLoop = async () => {
    const roundData = this.roundManager.getRoundData();
    if (roundData?.ended) {
      this.stopGame();
      return;
    }
    try {
      logger.debug('Drawing next ball...');   // ← restored
      const ball = await this.roundManager.drawNextBall();
      if (ball === null) {
        this.stopGame();
        return;
      }
    } catch (err) {
      logger.error('drawNextBall failed:', err);
    }
    this.gameTimeout = setTimeout(drawLoop, this.ballDrawInterval);
  };

  this.gameTimeout = setTimeout(drawLoop, this.ballDrawInterval);
}

public stopGame() {
  if (this.gameTimeout) {
    clearTimeout(this.gameTimeout);
    this.gameTimeout = null;
    logger.info('Game interval stopped safely.');
  }
}

  public scheduleNextRound(delayMs: number = 5000) {
  // ✅ Prevent multiple timeouts
  if (this.winnerPauseTimeout) return;

  this.stopGame();
  this.winnerPauseTimeout = setTimeout(async () => {
    this.winnerPauseTimeout = null;
    await this.startSelectionPhase();
  }, delayMs);
}

  public getCountdown(): number {
    if (this.phase === 'selection') {
      return this.selectionCountdown;
    }
    return 0;
  }

  public async resumeGame(): Promise<void> {
  if (this.gameTimeout) {
    logger.info('Game loop already running, skipping resume');
    return;
  }
  const roundData = this.roundManager.getRoundData();
  if (!roundData || roundData.ended) {
    logger.info('Resume called but round is not active or already ended');
    return;
  }
  if (this.phase === 'game') {
    logger.info('Resuming game loop – starting interval and immediate draw');
    this.startGameInterval();
    // Immediately draw a ball to avoid waiting for the interval
    try {
      const ball = await this.roundManager.drawNextBall();
      if (ball === null) {
        logger.warn('Immediate draw returned null – game might have ended or paused again');
        this.stopGame();
      } else {
        logger.info(`Immediate draw successful: ball ${ball}`);
      }
    } catch (err) {
      logger.error('Error during immediate draw after resume:', err);
    }
  } else {
    logger.info(`Game loop resume called but phase is ${this.phase} – not resuming (might be in selection)`);
    // If we are in selection, start the selection phase again (if not already running)
    if (this.selectionInterval === null && !(await this.roundManager.isGamePaused())) {
      await this.startSelectionPhase();
    }
  }
}
}