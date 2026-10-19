//src/core/utils/scheduler.ts
import { CronJob, CronTime } from 'cron';
import { logger } from './logger';
import { AuditLog } from '../../core/database/models/AuditLog';

// Helper function to get valid environment
function getValidEnvironment(): 'development' | 'staging' | 'production' | 'testing' {
  const env = process.env.NODE_ENV || 'production';
  
  switch (env) {
    case 'development':
    case 'staging':
    case 'production':
    case 'testing':
      return env;
    case 'test':
      return 'testing';
    default:
      logger.warn(`Unknown NODE_ENV: ${env}, defaulting to production`);
      return 'production';
  }
}

export class Scheduler {
  private jobs: Map<string, CronJob> = new Map();
  private jobCallbacks: Map<string, () => Promise<void>> = new Map();
  
  constructor() {
    this.setupGracefulShutdown();
  }
  
  schedule(name: string, cronTime: string, callback: () => Promise<void>): boolean {
    try {
      // Cancel existing job if any
      this.cancel(name);
      
      const job = new CronJob(cronTime, async () => {
        await this.executeJob(name, callback);
      });
      
      this.jobs.set(name, job);
      this.jobCallbacks.set(name, callback);
      
      logger.info(`Scheduled job "${name}" with cron "${cronTime}"`);
      
      return true;
      
    } catch (error) {
      logger.error(`Failed to schedule job "${name}":`, error);
      return false;
    }
  }
  
  scheduleOnce(name: string, date: Date, callback: () => Promise<void>): boolean {
    try {
      const now = new Date();
      const delay = date.getTime() - now.getTime();
      
      if (delay <= 0) {
        logger.warn(`Cannot schedule job "${name}" in the past`);
        return false;
      }
      
      // Cancel existing job if any
      this.cancel(name);
      
      const timeout = setTimeout(async () => {
        try {
          await this.executeJob(name, callback);
        } finally {
          this.jobs.delete(name);
          this.jobCallbacks.delete(name);
        }
      }, delay);
      
      // Store as CronJob for consistency
      const job = new CronJob(date, () => {});
      (job as any)._timeout = timeout;
      
      this.jobs.set(name, job);
      this.jobCallbacks.set(name, callback);
      
      logger.info(`Scheduled one-time job "${name}" for ${date.toISOString()}`);
      
      return true;
      
    } catch (error) {
      logger.error(`Failed to schedule one-time job "${name}":`, error);
      return false;
    }
  }
  
  scheduleInterval(name: string, intervalMs: number, callback: () => Promise<void>): boolean {
    try {
      // Cancel existing job if any
      this.cancel(name);
      
      const interval = setInterval(async () => {
        await this.executeJob(name, callback);
      }, intervalMs);
      
      // Store as CronJob for consistency
      const job = new CronJob('0 0 1 1 *', () => {}); // Dummy cron
      (job as any)._interval = interval;
      
      this.jobs.set(name, job);
      this.jobCallbacks.set(name, callback);
      
      logger.info(`Scheduled interval job "${name}" every ${intervalMs}ms`);
      
      return true;
      
    } catch (error) {
      logger.error(`Failed to schedule interval job "${name}":`, error);
      return false;
    }
  }
  
  cancel(name: string): boolean {
    const job = this.jobs.get(name);
    
    if (!job) {
      return false;
    }
    
    try {
      job.stop();
      
      // Clear timeouts/intervals
      if ((job as any)._timeout) {
        clearTimeout((job as any)._timeout);
      }
      
      if ((job as any)._interval) {
        clearInterval((job as any)._interval);
      }
      
      this.jobs.delete(name);
      this.jobCallbacks.delete(name);
      
      logger.info(`Cancelled job "${name}"`);
      
      return true;
      
    } catch (error) {
      logger.error(`Failed to cancel job "${name}":`, error);
      return false;
    }
  }
  
  reschedule(name: string, newCronTime: string): boolean {
    const job = this.jobs.get(name);
    
    if (!job) {
      logger.warn(`Cannot reschedule non-existent job "${name}"`);
      return false;
    }
    
    try {
      job.setTime(new CronTime(newCronTime));
      job.start();
      
      logger.info(`Rescheduled job "${name}" to "${newCronTime}"`);
      
      return true;
      
    } catch (error) {
      logger.error(`Failed to reschedule job "${name}":`, error);
      return false;
    }
  }
  
  start(name: string): boolean {
    const job = this.jobs.get(name);
    
    if (!job) {
      logger.warn(`Cannot start non-existent job "${name}"`);
      return false;
    }
    
    try {
      job.start();
      logger.info(`Started job "${name}"`);
      return true;
      
    } catch (error) {
      logger.error(`Failed to start job "${name}":`, error);
      return false;
    }
  }
  
  stop(name: string): boolean {
    const job = this.jobs.get(name);
    
    if (!job) {
      return false;
    }
    
    try {
      job.stop();
      logger.info(`Stopped job "${name}"`);
      return true;
      
    } catch (error) {
      logger.error(`Failed to stop job "${name}":`, error);
      return false;
    }
  }
  
  startAll(): void {
    for (const [name, job] of this.jobs) {
      try {
        job.start();
        logger.debug(`Started job "${name}"`);
      } catch (error) {
        logger.error(`Failed to start job "${name}":`, error);
      }
    }
    
    logger.info(`Started all ${this.jobs.size} jobs`);
  }
  
  stopAll(): void {
    for (const [name, job] of this.jobs) {
      try {
        job.stop();
        logger.debug(`Stopped job "${name}"`);
      } catch (error) {
        logger.error(`Failed to stop job "${name}":`, error);
      }
    }
    
    logger.info(`Stopped all ${this.jobs.size} jobs`);
  }
  
  async trigger(name: string): Promise<boolean> {
    const callback = this.jobCallbacks.get(name);
    
    if (!callback) {
      logger.warn(`Cannot trigger non-existent job "${name}"`);
      return false;
    }
    
    try {
      await this.executeJob(name, callback, true);
      return true;
      
    } catch (error) {
      logger.error(`Failed to trigger job "${name}":`, error);
      return false;
    }
  }
  
  getJobStatus(name: string): JobStatus | null {
    const job = this.jobs.get(name);
    
    if (!job) {
      return null;
    }
    
    const toDate = (v: any): Date | null => {
      if (!v) return null;
      if (typeof v.toJSDate === 'function') return v.toJSDate();
      if (v instanceof Date) return v;
      try { return new Date(v); } catch { return null; }
    };

    return {
      name,
      running: job.running,
      nextDate: toDate(job.nextDate && job.nextDate()),
      lastDate: toDate(job.lastDate && job.lastDate())
    };
  }
  
  getAllJobs(): JobStatus[] {
    const statuses: JobStatus[] = [];
    
    for (const [name, job] of this.jobs) {
      const toDate = (v: any): Date | null => {
        if (!v) return null;
        if (typeof v.toJSDate === 'function') return v.toJSDate();
        if (v instanceof Date) return v;
        try { return new Date(v); } catch { return null; }
      };

      statuses.push({
        name,
        running: job.running,
        nextDate: toDate(job.nextDate && job.nextDate()),
        lastDate: toDate(job.lastDate && job.lastDate())
      });
    }
    
    return statuses;
  }
  
  listScheduled(): string[] {
    return Array.from(this.jobs.keys());
  }
  
   private async executeJob(name: string, callback: () => Promise<void>, manualTrigger: boolean = false): Promise<void> {
  const startTime = Date.now();
  const environment = getValidEnvironment();
  
  try {
    logger.info(`Executing job "${name}"...`);
    
    // Log job start - FIXED: No duplicate details property
    await AuditLog.log({
      action: `JOB_${name.toUpperCase()}_START`,
      actionType: 'SYSTEM' as const,
      severity: 'INFO' as const,
      entityType: 'Job',
      details: {
        jobName: name,
        description: `Job "${name}" execution started`,
        manualTrigger
      },
      source: 'SYSTEM' as const,
      environment: environment,
      tags: ['job', 'scheduler', name]
    }).catch((e: any) => {
      logger.error(`Failed to write audit log for job start:`, e);
    });
    
    // Execute callback
    await callback();
    
    const duration = Date.now() - startTime;
    
    // Log job completion - FIXED: No duplicate details property
    await AuditLog.log({
      action: `JOB_${name.toUpperCase()}_COMPLETE`,
      actionType: 'SYSTEM' as const,
      severity: 'INFO' as const,
      entityType: 'Job',
      details: {
        jobName: name,
        description: `Job "${name}" executed successfully`,
        duration,
        manualTrigger
      },
      source: 'SYSTEM' as const,
      environment: environment,
      tags: ['job', 'scheduler', name, 'success']
    }).catch((e: any) => {
      logger.error(`Failed to write audit log for job completion:`, e);
    });
    
    logger.info(`Job "${name}" completed in ${duration}ms`);
    
  } catch (error: any) {
    const duration = Date.now() - startTime;
    
    // Log job failure - FIXED: No duplicate details property
    await AuditLog.log({
      action: `JOB_${name.toUpperCase()}_FAILED`,
      actionType: 'SYSTEM' as const,
      severity: 'ERROR' as const,
      entityType: 'Job',
      details: {
        jobName: name,
        description: `Job "${name}" execution failed`,
        duration,
        error: error?.message,
        stackTrace: error?.stack,
        manualTrigger
      },
      source: 'SYSTEM' as const,
      environment: environment,
      tags: ['job', 'scheduler', name, 'error']
    }).catch((e: any) => {
      logger.error(`Failed to write audit log for job failure:`, e);
    });
    
    logger.error(`Job "${name}" failed after ${duration}ms:`, error);
    
    throw error;
  }
}
  
  private setupGracefulShutdown(): void {
    // Handle process termination
    const shutdown = async () => {
      logger.info('Shutting down scheduler...');
      
      this.stopAll();
      
      // Wait for running jobs to complete
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      logger.info('Scheduler shutdown complete');
    };
    
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
    process.on('beforeExit', shutdown);
  }
}

export interface JobStatus {
  name: string;
  running: boolean;
  nextDate: Date | null;
  lastDate: Date | null;
}

// Singleton instance
export const scheduler = new Scheduler();