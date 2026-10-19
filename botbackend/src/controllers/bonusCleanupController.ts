// src/controllers/bonusCleanupController.ts
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { SystemSettings } from '../core/database/models/SystemSettings';
import { bonusCleanupService } from '../services/bonusCleanupService';
import { auditService } from '../services/auditService';
import { logger } from '../core/utils/logger';

async function verifyPassword(pw: string | undefined): Promise<boolean> {
  if (!pw) return false;
  const doc = await SystemSettings.findOne({ key: 'settings_access_password' });
  if (!doc) return false;
  return bcrypt.compare(pw, doc.value);
}

export const previewCleanup = async (req: Request, res: Response) => {
  try {
    const { userIds } = req.body || {};
    const scope = Array.isArray(userIds) && userIds.length > 0
      ? userIds.filter((id: string) => mongoose.Types.ObjectId.isValid(id))
          .map((id: string) => new mongoose.Types.ObjectId(id))
      : undefined;

    const preview = await bonusCleanupService.preview(scope);
    res.json(preview);
  } catch (e: any) {
    logger.error('Bonus cleanup preview error:', e);
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
};

export const executeCleanup = async (req: Request, res: Response) => {
  try {
    const { settingsPassword, userIds } = req.body || {};
    if (!(await verifyPassword(settingsPassword))) {
      return res.status(403).json({ error: 'Invalid settings password' });
    }

    const adminUser = (req as any).user;
    const scope = Array.isArray(userIds) && userIds.length > 0
      ? userIds.filter((id: string) => mongoose.Types.ObjectId.isValid(id))
          .map((id: string) => new mongoose.Types.ObjectId(id))
      : undefined;

    const result = await bonusCleanupService.execute(adminUser._id, scope);

    await auditService.logAdminAction(
      adminUser._id,
      adminUser.telegramId,
      'BONUS_CLEANUP_EXECUTED',
      'FINANCIAL',
      'BulkOperation',
      result.batchId,
      {
        processed: result.processed,
        totalRemoved: result.totalRemoved,
        failedCount: result.failed.length,
        scope: scope ? `userIds[${scope.length}]` : 'all-non-agents',
      }
    );

    res.json(result);
  } catch (e: any) {
    logger.error('Bonus cleanup execute error:', e);
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
};