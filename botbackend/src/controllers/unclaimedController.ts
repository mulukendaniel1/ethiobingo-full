//src\controllers\unclaimedController.ts
import { Request, Response } from 'express';
import { UnclaimedReceipt } from '../core/database/models/UnclaimedReceipt';
import { ETBDeposit } from '../core/database/models/ETBDeposit';
import { User } from '../core/database/models/User';
import { logger } from '../core/utils/logger';
import { sanitizeInput } from '../core/utils/security';
import { ETBDepositService } from '../services/ETBDepositServiceInstance';
import mongoose from 'mongoose';

const SYSTEM_ADMIN_ID = new mongoose.Types.ObjectId('000000000000000000000001');

// GET /api/admin/unclaimed-receipts
export const getUnclaimedReceipts = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 20, search = '', method, matched } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    
    const query: any = {};
    if (method && method !== 'all') query.method = method;
    if (matched !== undefined) query.matched = matched === 'true';
    
    if (search) {
      const safeSearch = sanitizeInput(String(search));
      query.$or = [
        { transactionId: { $regex: safeSearch, $options: 'i' } },
        { senderName: { $regex: safeSearch, $options: 'i' } },
        { receiverName: { $regex: safeSearch, $options: 'i' } },
      ];
    }
    
    const receipts = await UnclaimedReceipt.find(query)
      .populate('matchedDepositId', 'requestId amountETB userId')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();
    
    // Populate user info for matched deposits
    for (const r of receipts) {
      if (r.matchedDepositId) {
        const deposit = await ETBDeposit.findById(r.matchedDepositId).populate('userId', 'telegramId username').lean();
        (r as any).matchedDeposit = deposit;
      }
    }
    
    const total = await UnclaimedReceipt.countDocuments(query);
    
    res.json({ receipts, total, page: Number(page), limit: Number(limit) });
  } catch (error) {
    logger.error('Get unclaimed receipts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /api/admin/unclaimed-receipts/:id/match
export const matchUnclaimedReceipt = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { requestId } = req.body; // optional: link to existing deposit requestId
    
    const receipt = await UnclaimedReceipt.findById(id);
    if (!receipt) return res.status(404).json({ error: 'Receipt not found' });
    if (receipt.matched) return res.status(400).json({ error: 'Already matched' });
    
    let deposit;
    if (requestId) {
      deposit = await ETBDeposit.findOne({ requestId, status: 'pending' });
      if (!deposit) return res.status(404).json({ error: 'Deposit not found or not pending' });
    } else {
      // Auto‑confirm directly: create confirmed deposit for a user? Not implemented here.
      return res.status(400).json({ error: 'Manual match requires a pending deposit requestId' });
    }
    
    // Confirm the deposit using the service
    const result = await ETBDepositService.confirmDeposit(
      deposit.requestId,
      (req as any).user._id,
      `Matched manually to unclaimed receipt ${receipt.transactionId}`
    );
    
    if (result.success) {
      receipt.matched = true;
      receipt.matchedDepositId = deposit._id;
      await receipt.save();
      res.json({ success: true });
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    logger.error('Match unclaimed receipt error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// DELETE /api/admin/unclaimed-receipts/:id
export const deleteUnclaimedReceipt = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await UnclaimedReceipt.findByIdAndDelete(id);
    res.json({ success: true });
  } catch (error) {
    logger.error('Delete unclaimed receipt error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};