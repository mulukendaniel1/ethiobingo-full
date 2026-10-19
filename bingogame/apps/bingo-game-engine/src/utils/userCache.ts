//apps\etm-game-engine\src\utils\userCache.ts  utility to avoid hitting MongoDB for every bet.
import { objectIdSchema } from 'src/validation/schemas';
import { User } from '../models/User';

const userCache = new Map<string, { username: string; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function getUserDisplayName(userId: string): Promise<string> {
  if (!objectIdSchema.safeParse(userId).success) return 'Invalid User';
  // Check cache
  const cached = userCache.get(userId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.username;
  }

  try {
    const user = await User.findById(userId).select('username firstName');
    if (!user) return 'Anonymous';

    const displayName = user.username || user.firstName || 'User';
    userCache.set(userId, { username: displayName, timestamp: Date.now() });
    return displayName;
  } catch (err) {
    console.error(`Failed to fetch user ${userId}:`, err);
    return 'Unknown';
  }
}