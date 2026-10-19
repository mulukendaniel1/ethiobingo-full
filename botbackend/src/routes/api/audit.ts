//src\routes\api\audit.ts
import { Router } from 'express';
import { adminAuth } from '../../middleware/adminAuth';
import { AuditLog } from '../../core/database/models/AuditLog';
import { logger } from '../../core/utils/logger';
import { sanitizeInput } from '../../core/utils/security';

const router = Router();
router.use(adminAuth);

// GET /api/admin/audit-logs
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      source,
      severity,
      actionType,
      userId,
      userTelegramId,
      entityType,
      entityId,
      startDate,
      endDate,
      search,
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    const query: any = {};

    if (source) query.source = source;
    if (severity) query.severity = severity;
    if (actionType) query.actionType = actionType;
    if (userId) query.userId = sanitizeInput(userId as string);
    if (userTelegramId) query.userTelegramId = parseInt(sanitizeInput(userTelegramId as string));
    if (entityType) query.entityType = { $regex: sanitizeInput(entityType as string), $options: 'i' };
    if (entityId) query.entityId = { $regex: sanitizeInput(entityId as string), $options: 'i' };

    // Date range
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate as string);
      if (endDate) query.timestamp.$lte = new Date(endDate as string);
    }

    // Full‑text search on action, details, tags
    if (search) {
      const safeSearch = sanitizeInput(search as string);
      query.$or = [
        { action: { $regex: safeSearch, $options: 'i' } },
        { entityType: { $regex: safeSearch, $options: 'i' } },
        { tags: { $in: [new RegExp(safeSearch, 'i')] } },
        { 'details.description': { $regex: safeSearch, $options: 'i' } },
      ];
    }

    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate('userId', 'username telegramId firstName')
        .lean(),
      AuditLog.countDocuments(query),
    ]);

    res.json({
      logs,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    });
  } catch (error) {
    logger.error('Failed to fetch audit logs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/audit-logs/stats
router.get('/stats', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const stats = await AuditLog.getStats(
      startDate ? new Date(startDate as string) : undefined,
      endDate ? new Date(endDate as string) : undefined
    );
    res.json(stats);
  } catch (error) {
    logger.error('Failed to fetch audit stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;