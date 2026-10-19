//src\routes\internal\shamo.ts
import { Router } from 'express';
import mongoose from 'mongoose';
import { internalAuth } from '../../middleware/internalAuth';
import { shamoService } from '../../services/shamoService';

const router = Router();

// GET /internal/wallet/shamo/active  (engine reads on boot + subscribes to pub/sub)
router.post('/active', internalAuth, async (_req, res) => {
  const active = await shamoService.getActiveRound();
  if (!active) return res.json({ active: null });
  const state = await shamoService.getRoundState(active.roundId);
  res.json({ active: state });
});

// POST /internal/wallet/shamo/claim
const claimThrottle = new Map<string, number>();
const THROTTLE_MS = 300;

router.post('/claim', internalAuth, async (req, res) => {
  const { userId, roundId, buttonIndex } = req.body;

  const now = Date.now();
  const last = claimThrottle.get(String(userId)) || 0;
  if (now - last < THROTTLE_MS) {
    return res.status(429).json({ success: false, error: 'Too many attempts' });
  }
  claimThrottle.set(String(userId), now);
  if (claimThrottle.size > 10_000) claimThrottle.clear();

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ success: false, error: 'Invalid userId' });
  }

  const result = await shamoService.claim({
    roundId: String(roundId),
    userId: new mongoose.Types.ObjectId(String(userId)),
    buttonIndex: Number(buttonIndex),
    ipAddress: req.ip,
  });

  if (!result.success) {
    return res.status(400).json({
      success: false,
      code: result.code,
      error: result.error,
    });
  }

  res.json({
    success: true,
    prize: result.prize,
    newBalance: result.newBalance,
    claimedCount: result.claimedCount,
    buttonIndex: result.buttonIndex,
    roundCompleted: result.roundCompleted,
  });
});

export default router;