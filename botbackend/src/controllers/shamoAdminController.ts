import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { SystemSettings } from '../core/database/models/SystemSettings';
import { shamoService } from '../services/shamoService';
import { auditService } from '../services/auditService';
import { logger } from '../core/utils/logger';
import { getSettings } from '../core/utils/settingsCache';

async function requirePassword(pw: string | undefined) {
  if (!pw) return false;
  const doc = await SystemSettings.findOne({ key: 'settings_access_password' });
  if (!doc) return false;
  return bcrypt.compare(pw, doc.value);
}

export const getStatus = async (_req: Request, res: Response) => {
  try {
    const active = await shamoService.getActiveRound();
    const settings = getSettings();
    res.json({
      active: active ? await shamoService.getRoundState(active.roundId) : null,
      config: {
        autoEnabled:        settings.shamoAutoEnabled,
        dailyTime:          settings.shamoDailyTime,
        prizePerButton:     settings.shamoPrizePerButton,
        totalButtons:       settings.shamoTotalButtons,
        depositDays:        settings.shamoEligibilityDepositDays,
        cooldownHours:      settings.shamoCooldownHours,
        badgeEnabled:       settings.shamoBadgeEnabled,
        eligibilityEnabled: settings.shamoEligibilityEnabled,   // ← NEW
        minDepositAmount:   settings.shamoMinDepositAmount,     // ← NEW
      },
    });
  } catch (e: any) {
    logger.error('shamo status error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const startRound = async (req: Request, res: Response) => {
  try {
    const { settingsPassword } = req.body;
    if (!(await requirePassword(settingsPassword))) {
      return res.status(403).json({ error: 'Invalid settings password' });
    }
    const active = await shamoService.getActiveRound();
    if (active) return res.status(400).json({ error: 'A Shamo round is already active' });

    const settings = getSettings();
    const round = await shamoService.createRound({
      triggeredBy: 'manual',
      createdBy: (req as any).user._id,
      prizePerButton: settings.shamoPrizePerButton,
      totalButtons: settings.shamoTotalButtons,
      depositDays: settings.shamoEligibilityDepositDays,
      cooldownHours: settings.shamoCooldownHours,
    });

    // notify engine via Redis pub/sub
    const { redisManager } = await import('../core/database/connections/redis');
    await redisManager.getClient().publish('shamo:events', JSON.stringify({
      type: 'shamo_started',
      data: await shamoService.getRoundState(round.roundId),
    }));

    await auditService.logAdminAction(
      (req as any).user._id,
      (req as any).user.telegramId,
      'SHAMO_STARTED', 'FINANCIAL',
      'ShamoRound', round.roundId,
      { prizePerButton: round.prizePerButton, totalButtons: round.totalButtons }
    );

    res.json({ success: true, round: await shamoService.getRoundState(round.roundId) });
  } catch (e: any) {
    logger.error('shamo start error:', e);
    const msg = e?.message || '';
    if (msg.includes('already exists') || msg.includes('already active')) {
      return res.status(409).json({ error: 'A Shamo round is already active' });
    }
    res.status(500).json({ error: msg || 'Internal server error' });
  }
};

export const endRound = async (req: Request, res: Response) => {
  try {
    const { settingsPassword, reason = 'manual' } = req.body;
    if (!(await requirePassword(settingsPassword))) {
      return res.status(403).json({ error: 'Invalid settings password' });
    }
    const active = await shamoService.getActiveRound();
    if (!active) return res.status(400).json({ error: 'No active Shamo round' });

    const ended = await shamoService.endActiveRound(
      reason === 'cancelled' ? 'cancelled' : 'manual'
    );

    const { redisManager } = await import('../core/database/connections/redis');
    await redisManager.getClient().publish('shamo:events', JSON.stringify({
      type: 'shamo_ended',
      data: { roundId: active.roundId, reason: ended?.endReason, claimedCount: ended?.claimedCount },
    }));

    await auditService.logAdminAction(
      (req as any).user._id, (req as any).user.telegramId,
      'SHAMO_ENDED', 'FINANCIAL', 'ShamoRound', active.roundId,
      { reason: ended?.endReason, claimedCount: ended?.claimedCount }
    );

    res.json({ success: true, round: ended });
  } catch (e: any) {
    logger.error('shamo end error:', e);
    const msg = e?.message || '';
    if (msg.includes('No active') || msg.includes('not found')) {
      return res.status(409).json({ error: 'No active Shamo round to end' });
    }
    res.status(500).json({ error: msg || 'Internal server error' });
  }
};

export const setSchedule = async (req: Request, res: Response) => {
  try {
    const {
      settingsPassword,
      autoEnabled, dailyTime, prizePerButton, totalButtons,
      depositDays, cooldownHours, badgeEnabled,
      eligibilityEnabled, minDepositAmount,   // ← NEW
    } = req.body;
    if (!(await requirePassword(settingsPassword))) {
      return res.status(403).json({ error: 'Invalid settings password' });
    }

    const updates: Array<[string, any]> = [];
    if (typeof autoEnabled === 'boolean')   updates.push(['shamo_auto_enabled', autoEnabled]);
    if (typeof dailyTime === 'string' && /^\d{2}:\d{2}$/.test(dailyTime))
      updates.push(['shamo_daily_time', dailyTime]);
    if (typeof prizePerButton === 'number' && prizePerButton > 0) updates.push(['shamo_prize_per_button', prizePerButton]);
    if (typeof totalButtons === 'number' && totalButtons > 0)     updates.push(['shamo_total_buttons', totalButtons]);
    if (typeof depositDays === 'number' && depositDays >= 0)      updates.push(['shamo_eligibility_deposit_days', depositDays]);
    if (typeof cooldownHours === 'number' && cooldownHours >= 1)  updates.push(['shamo_cooldown_hours', cooldownHours]);
    if (typeof badgeEnabled === 'boolean')  updates.push(['shamo_badge_enabled', badgeEnabled]);
    if (typeof eligibilityEnabled === 'boolean')
      updates.push(['shamo_eligibility_enabled', eligibilityEnabled]);
    if (typeof minDepositAmount === 'number' && minDepositAmount >= 0)
      updates.push(['shamo_min_deposit_amount', minDepositAmount]);

    for (const [key, value] of updates) {
      await SystemSettings.findOneAndUpdate(
        { key },
        { value, updatedAt: new Date(), updatedBy: (req as any).user._id },
        { upsert: true }
      );
    }

    const { loadSettings } = await import('../core/utils/settingsCache');
    await loadSettings();

    res.json({ success: true });
  } catch (e: any) {
    logger.error('shamo schedule error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const listRounds = async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '20'), 10)));
  const status = req.query.status as string | undefined;
  res.json(await shamoService.listRounds(page, limit, status));
};

export const getRoundDetail = async (req: Request, res: Response) => {
  const { roundId } = req.params as { roundId: string };
  const state = await shamoService.getRoundState(roundId);
  if (!state) return res.status(404).json({ error: 'Round not found' });
  res.json(state);
};

export const getRoundClaims = async (req: Request, res: Response) => {
  const { roundId } = req.params as { roundId: string };
  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
  const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit || '50'), 10)));
  res.json(await shamoService.getRoundClaims(roundId, page, limit));
};