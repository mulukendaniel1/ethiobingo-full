// src/middleware/adminAuth.ts
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { User } from '../core/database/models/User';
import { env } from '../core/config/env';

export interface AuthRequest extends Request {
  user?: any;
}

export const adminAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  let token = '';
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  } else if (req.query.token) {
    // Allow token from query string for downloads
    token = req.query.token as string;
  }

  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as { id: string; sessionId: string };
    const user = await User.findById(decoded.id).select('-password');
    if (!user || !user.isAdmin) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Check sessionId
    if (!user.sessionId || user.sessionId !== decoded.sessionId) {
      return res.status(401).json({ error: 'Duplicate session detected' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};