///src\routes\game-link.ts
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { sanitizeInput } from '../core/utils/security'; // <-- ADD

const router = Router();

router.get('/game-link', async (req, res) => {
  // Example: get userId from session
  const userId = (req as any).session?.userId; // or req.user?.id
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Sanitize even though it comes from session
  const safeUserId = sanitizeInput(userId.toString());

  const token = jwt.sign(
    { uid: safeUserId },
    process.env.JWT_SECRET!,
    { expiresIn: '1d' }
  );

  const gameUrl = `${process.env.FRONTEND_URL}/play?token=${token}`;
  res.json({ url: gameUrl });
});

export default router;