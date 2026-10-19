// src/routes/api/leaderboard.ts
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { UserBetHistory } from '../../core/database/models/UserBetHistory';
import { User } from '../../core/database/models/User';
import { BotLeaderboardEntry } from '../../core/database/models/BotLeaderboardEntry';

const router = Router();

const getDateRange = (period: 'daily' | 'weekly') => {
  const now = new Date();
  if (period === 'daily') {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return { $gte: start };
  } else {
    const start = new Date(now);
    start.setDate(now.getDate() - 7);
    start.setHours(0, 0, 0, 0);
    return { $gte: start };
  }
};

// Helper to build combined leaderboard
async function getCombinedLeaderboard(period: 'daily' | 'weekly', currentUserId?: string | null) {
  const dateRange = getDateRange(period);

  // 1. Real users aggregation (exclude bots)
  const realUsers = await UserBetHistory.aggregate([
    {
      $match: {
        action: 'buy',
        createdAt: dateRange,
        userId: { $not: /^bot_/ } // exclude bot userIds
      }
    },
    { $group: { _id: '$userId', totalBuys: { $sum: 1 } } },
    { $sort: { totalBuys: -1 } },
    { $limit: 100 }
  ]);

  // 2. Bot entries (updated within the same range)
 const bots = await BotLeaderboardEntry.find({
  updatedAt: dateRange
}).lean();

const combined: Array<{
  type: 'user' | 'bot';
  userId: string;
  displayName?: string;
  totalBuys: number; // for users: totalBuys, for bots: totalWins
}> = [
  ...realUsers.map(u => ({ type: 'user' as const, userId: u._id, totalBuys: u.totalBuys })),
  ...bots.map(b => ({ type: 'bot' as const, userId: b.botId, displayName: b.displayName, totalBuys: b.totalWins }))
];
combined.sort((a, b) => b.totalBuys - a.totalBuys);

  // 4. Fetch real user names
  const realUserIds = combined.filter(c => c.type === 'user').map(c => c.userId);
  const users = await User.find({ _id: { $in: realUserIds } }).select('username firstName').lean();
  const userMap = new Map(users.map(u => [u._id.toString(), u.username || u.firstName || 'User']));

  // 5. Build leaderboard array
  const leaderboard = combined.map((item, idx) => ({
    rank: idx + 1,
    userId: item.userId,
    username: item.type === 'bot' ? (item.displayName || 'Bot') : (userMap.get(item.userId) || 'Anonymous'),
    totalBuys: item.totalBuys,
  }));

  // 6. Calculate user's rank (if authenticated)
  let userRank: number | null = null;
  if (currentUserId) {
    // Find user in leaderboard
    const userEntry = leaderboard.find(entry => entry.userId === currentUserId);
    if (userEntry) {
      userRank = userEntry.rank;
    } else {
      // User not in top 100 – count how many have more buys
      const userTotalBuys = await UserBetHistory.countDocuments({
        userId: currentUserId,
        action: 'buy',
        createdAt: dateRange
      });
      if (userTotalBuys > 0) {
        // Count real users with more buys
        const higherReal = await UserBetHistory.countDocuments({
          action: 'buy',
          createdAt: dateRange,
          userId: { $ne: currentUserId, $not: /^bot_/ }
        });
        // Count bots with more buys
        const higherBots = await BotLeaderboardEntry.countDocuments({
          totalBuys: { $gt: userTotalBuys },
          updatedAt: dateRange
        });
        userRank = higherReal + higherBots + 1;
      }
    }
  }

  return { leaderboard, userRank };
}

// Daily endpoint
router.get('/daily', async (req, res) => {
  try {
    const token = req.query.token as string;
    let currentUserId: string | null = null;
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { uid: string };
        currentUserId = decoded.uid;
      } catch {}
    }
    const result = await getCombinedLeaderboard('daily', currentUserId);
    res.json(result);
  } catch (err) {
    console.error('Leaderboard daily error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Weekly endpoint
router.get('/weekly', async (req, res) => {
  try {
    const token = req.query.token as string;
    let currentUserId: string | null = null;
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { uid: string };
        currentUserId = decoded.uid;
      } catch {}
    }
    const result = await getCombinedLeaderboard('weekly', currentUserId);
    res.json(result);
  } catch (err) {
    console.error('Leaderboard weekly error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;