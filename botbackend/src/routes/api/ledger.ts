import { Router } from 'express';
import { TransactionLedger } from '../../core/database/models/TransactionLedger';
import { logger } from '../../core/utils/logger';
import mongoose from 'mongoose';

const router = Router();

// GET /admin/ledger
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      userId,
      type,
      startDate,
      endDate,
      search
    } = req.query;

    const query: any = {};
    if (userId) {
      query.userId = new mongoose.Types.ObjectId(userId as string);
    }
    if (type && type !== 'all') {
      query.type = type;
    }
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate as string);
      if (endDate)   query.createdAt.$lte = new Date(endDate as string);
    }
    if (search) {
      const regex = { $regex: search, $options: 'i' };
      query.$or = [
        { referenceId: regex },
        { notes: regex }
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [entries, total] = await Promise.all([
      TransactionLedger.find(query)
        .populate('userId', 'telegramId username firstName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      TransactionLedger.countDocuments(query)
    ]);

    res.json({
      entries,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit))
    });
  } catch (error) {
    logger.error('Ledger query error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;