//\src\middleware\internalAuth.ts
import { Request, Response, NextFunction } from 'express';
import { CryptoUtils } from '../core/utils/crypto';

export function internalAuth(req: Request, res: Response, next: NextFunction) {
  const { payload, signature } = req.body;
  const secret = process.env.INTERNAL_API_SECRET!;

  if (!payload || !signature) {
    return res.status(400).json({ error: 'Missing payload or signature' });
  }

  if (!CryptoUtils.verifySignature(payload, signature, secret)) {
    return res.status(403).json({ error: 'Invalid signature' });
  }

  next();
}