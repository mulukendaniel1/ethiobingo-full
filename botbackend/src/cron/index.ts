// src/cron/index.ts - COMPLETE
import { CronJob, CronTime } from 'cron';
import { logger } from '../core/utils/logger';
import { cleanupRestartRecords } from './cleanupRestartRecords';
import { scheduler } from '@/core/utils/scheduler';
import { BroadcastService } from '@/services/broadcastService';
import { getSettings } from '@/core/utils/settingsCache';
import { cleanupOldAgentRequests, cleanupOldETBTransactions } from '../services/cleanupService';

export class CronScheduler {
  private jobs: Map<string, CronJob> = new Map();
  
  constructor() {
    this.setupCronJobs();
  }
  
  private setupCronJobs(): void {
    try {
      // Broadcast check every minute
      const broadcastCheckJob = new CronJob('* * * * *', async () => {
        try {
          const broadcastService = new BroadcastService();
          await broadcastService.processPendingScheduledBroadcasts();
        } catch (error) {
          logger.error('Error processing scheduled broadcasts:', error);
        }
      });
      this.jobs.set('broadcastCheck', broadcastCheckJob);
      broadcastCheckJob.start();

      // Daily backup (if enabled)
      if (getSettings().backupEnabled) {
        const backupCronTime = getSettings().backupCronTime;
        logger.info(`⏰ Scheduling daily backup at cron: ${backupCronTime}`);
        const backupJob = new CronJob(backupCronTime, async () => {
          logger.info('🔄 Starting scheduled backup...');
          try {
            const { backupService } = await import('../services/BackupService');
            const result = await backupService.createBackup();
            logger.info(`✅ Scheduled backup completed: ${result.filename} (${result.sizeBytes} bytes)`);
            
            await backupService.cleanupOldBackups();
            
            const { NotificationService } = await import('../services/notificationService');
            const notification = new NotificationService();
            await notification.sendAdminAlert('✅ Daily backup completed successfully.', 'info');
          } catch (error) {
            logger.error('❌ Scheduled backup failed:', error);
            const { NotificationService } = await import('../services/notificationService');
            const notification = new NotificationService();
            await notification.sendAdminAlert(`❌ Daily backup failed: ${error.message}`, 'error');
          }
        });
        this.jobs.set('dailyBackup', backupJob);
        backupJob.start();
        logger.info(`✅ Backup cron job started. Next run: ${backupJob.nextDate()}`);
      } else {
        logger.info('ℹ️ Backup disabled – skipping cron job');
      }

      // Daily cleanup of old data (3 AM UTC)
      const cleanupJob = new CronJob('0 3 * * *', async () => {
        try {
          await cleanupOldETBTransactions(30);
          await cleanupOldAgentRequests(7);
          logger.info('✅ Daily cleanup completed (ETB transactions + agent requests)');
        } catch (error) {
          logger.error('Failed to run daily cleanup:', error);
        }
      });
      this.jobs.set('dailyCleanup', cleanupJob);
      cleanupJob.start();

      // Interval for restart records cleanup (every 6 hours)
      scheduler.scheduleInterval('cleanup-restart-records', 6 * 60 * 60 * 1000, cleanupRestartRecords);

      // ═══════════════════════════════════════════════════════
      // Weekly Rewards
      // Fires every Sunday at 00:05 EAT (= Sat 21:05 UTC),
      // 5 minutes after the week rolls over.
      // Cron: minute 5, hour 21 UTC, day-of-week = Saturday (6)
      // ═══════════════════════════════════════════════════════
      const weeklyRewardJob = new CronJob('5 21 * * 6', async () => {
        try {
          const { weeklyRewardService } = await import('../services/WeeklyRewardService');
          const settings = getSettings();

          if (settings.depositorRewardEnabled && settings.depositorRewardAutoEnabled) {
            logger.info('🏆 Processing weekly DEPOSITOR rewards...');
            await weeklyRewardService.processWeeklyPayouts('depositor');
          }

          if (settings.referrerRewardEnabled && settings.referrerRewardAutoEnabled) {
            logger.info('🏆 Processing weekly REFERRER rewards...');
            await weeklyRewardService.processWeeklyPayouts('referrer');
          }
        } catch (error: any) {
          logger.error('❌ Weekly reward cron failed:', error?.message || error);
        }
      });
            this.jobs.set('weeklyReward', weeklyRewardJob);
      weeklyRewardJob.start();
      logger.info(`✅ Weekly reward cron scheduled. Next run: ${weeklyRewardJob.nextDate()}`);
      
      // ═══════════════════════════════════════════════════════════════
      // Shamo Daily Giveaway — auto-start scheduler
      // Fires every minute; starts at configured Ethiopian time (UTC+3).
      // ═══════════════════════════════════════════════════════════════
      const shamoSchedulerJob = new CronJob('* * * * *', async () => {
        try {
          const settings = getSettings();

          const { shamoService } = await import('../services/shamoService');
          const active = await shamoService.getActiveRound();

          // ───────────────────────────────────────────────────────────────
          // ALWAYS run stale-round expiry, regardless of shamoAutoEnabled.
          // A stuck round must be recoverable even when auto-start is OFF.
          // ───────────────────────────────────────────────────────────────
          if (active) {
            const MAX_ROUND_MS = 24 * 3600_000;
            if (Date.now() - active.startedAt.getTime() > MAX_ROUND_MS) {
              await shamoService.endRound({ roundId: active.roundId, reason: 'expired' });
              const { redisManager } = await import('../core/database/connections/redis');
              await redisManager.getClient().publish('shamo:events', JSON.stringify({
                type: 'shamo_ended',
                data: { roundId: active.roundId, reason: 'expired', claimedCount: active.claimedCount },
              }));
              logger.info(`🎁 Stale Shamo auto-expired: ${active.roundId}`);
            }
            return;
          }

          // ───────────────────────────────────────────────────────────────
          // Auto-start only runs when the admin has enabled it.
          // ───────────────────────────────────────────────────────────────
          if (!settings.shamoAutoEnabled) return;

          // Compute current Ethiopian HH:MM
          const now = new Date();
          const eat = new Date(now.getTime() + 3 * 3600_000);
          const hh = String(eat.getUTCHours()).padStart(2, '0');
          const mm = String(eat.getUTCMinutes()).padStart(2, '0');
          const nowStr = `${hh}:${mm}`;

          if (nowStr !== settings.shamoDailyTime) return;

          // Guard against double-fire within the same minute across restarts
          const { redisManager } = await import('../core/database/connections/redis');
          const lockKey = `shamo:auto:${eat.toISOString().slice(0, 16)}`; // minute-precision
          const gotLock = await redisManager.getClient().set(lockKey, '1', 'EX', 120, 'NX');
          if (!gotLock) return;

          const round = await shamoService.createRound({
            triggeredBy: 'auto',
            prizePerButton: settings.shamoPrizePerButton,
            totalButtons: settings.shamoTotalButtons,
            depositDays: settings.shamoEligibilityDepositDays,
            cooldownHours: settings.shamoCooldownHours,
          });

          await redisManager.getClient().publish('shamo:events', JSON.stringify({
            type: 'shamo_started',
            data: await shamoService.getRoundState(round.roundId),
          }));

          logger.info(`🎁 Auto Shamo started: ${round.roundId}`);
        } catch (err) {
          logger.error('Shamo auto-scheduler error:', err);
        }
      });
      this.jobs.set('shamoScheduler', shamoSchedulerJob);
      shamoSchedulerJob.start();
    
      logger.info(`✅ Setup ${this.jobs.size} cron jobs`);
      
    } catch (error) {
      logger.error('Failed to setup cron jobs:', error);
    }
  }
  
  startAll(): void {
    this.jobs.forEach((job, name) => {
      try {
        job.start();
        logger.debug(`Started cron job: ${name}`);
      } catch (error) {
        logger.error(`Failed to start cron job ${name}:`, error);
      }
    });
    logger.info(`✅ All ${this.jobs.size} cron jobs started`);
  }
  
  stopAll(): void {
    this.jobs.forEach((job, name) => {
      try {
        job.stop();
        logger.debug(`Stopped cron job: ${name}`);
      } catch (error) {
        logger.error(`Failed to stop cron job ${name}:`, error);
      }
    });
    logger.info(`✅ All ${this.jobs.size} cron jobs stopped`);
  }
  
  getJobStatus(): Array<{ name: string; running: boolean; nextDate: Date | null }> {
    const statuses: Array<{ name: string; running: boolean; nextDate: Date | null }> = [];
    this.jobs.forEach((job, name) => {
      const nextDate = job.nextDate ? job.nextDate() : null;
      statuses.push({
        name,
        running: job.running,
        nextDate: nextDate ? (nextDate as any).toJSDate?.() || nextDate : null
      });
    });
    return statuses;
  }
  
  startJob(name: string): boolean {
    const job = this.jobs.get(name);
    if (!job) {
      logger.warn(`Cannot start non-existent cron job: ${name}`);
      return false;
    }
    try {
      job.start();
      logger.info(`Started cron job: ${name}`);
      return true;
    } catch (error) {
      logger.error(`Failed to start cron job ${name}:`, error);
      return false;
    }
  }
  
  stopJob(name: string): boolean {
    const job = this.jobs.get(name);
    if (!job) {
      logger.warn(`Cannot stop non-existent cron job: ${name}`);
      return false;
    }
    try {
      job.stop();
      logger.info(`Stopped cron job: ${name}`);
      return true;
    } catch (error) {
      logger.error(`Failed to stop cron job ${name}:`, error);
      return false;
    }
  }
  
  rescheduleJob(name: string, cronTime: string): boolean {
    const job = this.jobs.get(name);
    if (!job) {
      logger.warn(`Cannot reschedule non-existent cron job: ${name}`);
      return false;
    }
    try {
      job.setTime(new CronTime(cronTime));
      job.start();
      logger.info(`Rescheduled cron job ${name} to: ${cronTime}`);
      return true;
    } catch (error) {
      logger.error(`Failed to reschedule cron job ${name}:`, error);
      return false;
    }
  }
}

export const cronScheduler = new CronScheduler();

export function startCronJobs(): void {
  cronScheduler.startAll();
}