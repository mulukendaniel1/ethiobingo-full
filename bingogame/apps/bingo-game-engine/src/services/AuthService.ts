//apps\etm-game-engine\src\services\AuthService.ts
import jwt from 'jsonwebtoken';
import { config } from '../config';

export function verifyJWT(token: string): { uid: string; operatorId: string; sessionId?: string } | null {
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET) as { uid: string; operatorId: string; sessionId?: string };
    return decoded;
  } catch {
    return null;
  }
}