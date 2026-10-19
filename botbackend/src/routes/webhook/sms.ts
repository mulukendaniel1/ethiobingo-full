// src/routes/webhook/sms.ts
import express, { Router, Request, Response } from 'express';
import { ETBDepositService as depositServiceInstance } from '../../services/ETBDepositServiceInstance';
import { ETBDeposit } from '../../core/database/models/ETBDeposit';
import { UnclaimedReceipt } from '../../core/database/models/UnclaimedReceipt';
import { logger } from '../../core/utils/logger';
import { getSettings } from '../../core/utils/settingsCache';
import { NotificationService } from '../../services/notificationService';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';

const router = Router();

// Strict rate limiter for SMS webhook (max 30 requests per 5 minutes per IP)
const smsWebhookLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 30,
  message: { error: 'Too many requests' },
  standardHeaders: true,
  legacyHeaders: false,
});

const SYSTEM_ADMIN_ID = new mongoose.Types.ObjectId('000000000000000000000001');
const TELEBIRR_SENDERS = ['telebirr', '127'];
const CBEBIRR_SENDERS = ['cbebirr'];

router.post(
  '/sms-receipt',
  smsWebhookLimiter,
  express.text({ type: '*/*' }), // Capture raw text regardless of Content-Type
  async (req: Request, res: Response) => {
    const rawBody = req.body as string;

    logger.info({
      event: 'sms_webhook_received',
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      rawBodyLength: rawBody?.length,
    }, 'SMS webhook call received');

    try {
      // 1. Security: validate secret token
      const authHeader = req.headers['x-secret-token'];
      if (!authHeader || authHeader !== process.env.SMS_WEBHOOK_SECRET) {
        logger.warn({ event: 'sms_webhook_outcome', outcome: 'unauthorized', ip: req.ip });
        return res.status(403).json({ error: 'Unauthorized' });
      }

      // 2. Sanitize and parse JSON manually
      let payload: { sender?: string; messageText?: string };
      try {
        // Replace literal newlines inside the JSON string with escaped versions
        const sanitized = rawBody
          .replace(/\n/g, '\\n')
          .replace(/\r/g, '\\r')
          .replace(/\t/g, '\\t');
        payload = JSON.parse(sanitized);
      } catch (parseError: any) {
        logger.error({
          event: 'sms_webhook_outcome',
          outcome: 'json_parse_failed',
          error: parseError.message,
          rawBodyPreview: rawBody.substring(0, 200),
          ip: req.ip,
        });
        return res.status(400).json({ error: 'Invalid JSON payload' });
      }

      const { sender, messageText } = payload;
      if (!sender || !messageText) {
        logger.warn({ event: 'sms_webhook_outcome', outcome: 'invalid_request', ip: req.ip });
        return res.status(400).json({ error: 'Missing sender or messageText' });
      }

      // Restore actual newlines for the parsers (they expect raw text)
      const actualMessageText = messageText.replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t');

      const depositService = depositServiceInstance;
      let parsedReceipt: any = null;
      let method: 'telebirr' | 'cbebirr' | null = null;

      const senderLower = sender.toLowerCase();
      if (TELEBIRR_SENDERS.some(s => senderLower.includes(s))) {
        parsedReceipt = depositService.parseTelebirrReceipt(actualMessageText);
        method = 'telebirr';
      } else if (CBEBIRR_SENDERS.some(s => senderLower.includes(s))) {
        parsedReceipt = depositService.parseCbeBirrReceipt(actualMessageText);
        method = 'cbebirr';
      } else {
        logger.info({ event: 'sms_webhook_outcome', outcome: 'ignored_unknown_sender', sender, ip: req.ip });
        return res.status(200).json({ success: true, ignored: true, reason: 'unknown_sender' });
      }

      if (!parsedReceipt) {
        logger.warn({ event: 'sms_webhook_outcome', outcome: 'parse_failed', sender, ip: req.ip });
        return res.status(400).json({ error: 'Could not parse receipt' });
      }

     logger.info(`Parsed receipt: txId=${parsedReceipt.transactionId}, amount=${parsedReceipt.amount}`);

    const settings = getSettings();
    const expectedReceiver = method === 'telebirr'
      ? settings.telebirrAccountName
      : settings.cbeBirrAccountName;

    // Fallback for received SMS where receiver name might be missing
    if (!parsedReceipt.receiverName || parsedReceipt.receiverName.trim() === '') {
      parsedReceipt.receiverName = expectedReceiver;
    }

    // ✅ IGNORE OUTGOING TRANSFERS (tolerant match)
    const normalizedParsed = parsedReceipt.receiverName.trim().toLowerCase();
    const normalizedExpected = expectedReceiver.trim().toLowerCase();
    const isReceiverMatch = normalizedParsed === normalizedExpected ||
                            normalizedExpected.includes(normalizedParsed) ||
                            normalizedParsed.includes(normalizedExpected);

    if (expectedReceiver && !isReceiverMatch) {
      logger.info({
        event: 'sms_webhook_outcome',
        outcome: 'ignored_outgoing_transfer',
        transactionId: parsedReceipt.transactionId,
        receiver: parsedReceipt.receiverName,
        expected: expectedReceiver,
        ip: req.ip,
      }, 'SMS webhook ignored outgoing transfer (receiver mismatch)');
      return res.status(200).json({
        success: true,
        ignored: true,
        reason: 'outgoing_transfer',
        message: 'Outgoing transfer ignored',
      });
    }

      const pendingDeposit = await ETBDeposit.findOne({
        transactionId: parsedReceipt.transactionId,
        status: 'pending',
      }).populate('userId');

      if (!pendingDeposit) {
        logger.info({
          event: 'sms_webhook_outcome',
          outcome: 'stored_unclaimed',
          transactionId: parsedReceipt.transactionId,
          ip: req.ip,
        });

        try {
          await UnclaimedReceipt.create({
            transactionId: parsedReceipt.transactionId,
            method,
            amount: parsedReceipt.amount,
            senderName: parsedReceipt.senderName,
            receiverName: parsedReceipt.receiverName,
            date: parsedReceipt.date,
            link: parsedReceipt.link,
            rawSms: actualMessageText,
          });
        } catch (err: any) {
          if (err.code !== 11000) {
            logger.error('Failed to store unclaimed receipt:', err);
          }
        }

        return res.status(200).json({
          success: true,
          message: 'Stored as unclaimed receipt (no matching pending deposit)',
          transactionId: parsedReceipt.transactionId,
        });
      }

      const user = pendingDeposit.userId as any;

      const amountMatch = Math.abs(parsedReceipt.amount - pendingDeposit.amountETB) <= 0.01;
      if (!amountMatch) {
        logger.warn({
          event: 'sms_webhook_outcome',
          outcome: 'amount_mismatch_flagged',
          transactionId: parsedReceipt.transactionId,
          requestId: pendingDeposit.requestId,
          userAmount: pendingDeposit.amountETB,
          smsAmount: parsedReceipt.amount,
          ip: req.ip,
        });

        pendingDeposit.adminNotes = `[AUTO-FLAG] Amount mismatch: user entered ${pendingDeposit.amountETB}, SMS shows ${parsedReceipt.amount}`;
        await pendingDeposit.save();

        const notification = new NotificationService();
        await notification.sendAdminAlert(
          `⚠️ *Amount Mismatch Detected*\n\n` +
          `Request ID: \`${pendingDeposit.requestId}\`\n` +
          `User: @${user?.username || user?.telegramId}\n` +
          `User Amount: ${pendingDeposit.amountETB} ETB\n` +
          `SMS Amount: ${parsedReceipt.amount} ETB\n` +
          `Transaction ID: \`${parsedReceipt.transactionId}\`\n\n` +
          `Please review manually.`,
          'warning'
        );

        return res.status(200).json({
          success: true,
          message: 'Amount mismatch – flagged for review',
          requestId: pendingDeposit.requestId,
        });
      }

      const result = await depositService.confirmDeposit(
        pendingDeposit.requestId,
        SYSTEM_ADMIN_ID,
        `Auto-confirmed via SMS webhook (sender: ${sender})`
      );

      if (result.success) {
        logger.info({
          event: 'sms_webhook_outcome',
          outcome: 'auto_confirmed',
          transactionId: parsedReceipt.transactionId,
          requestId: pendingDeposit.requestId,
          ip: req.ip,
        });

        const notification = new NotificationService();
        await notification.sendAdminAlert(
          `✅ *Deposit Auto‑Confirmed*\n\n` +
          `Request ID: \`${pendingDeposit.requestId}\`\n` +
          `User: @${user?.username || user?.telegramId}\n` +
          `Amount: ${pendingDeposit.amountETB} ETB\n` +
          `Method: ${method?.toUpperCase()}\n` +
          `Transaction ID: \`${parsedReceipt.transactionId}\`\n\n` +
          `Confirmed automatically via SMS webhook.`,
          'info'
        );

        return res.status(200).json({
          success: true,
          message: 'Deposit auto‑confirmed',
          requestId: pendingDeposit.requestId,
        });
      } else {
        logger.error({
          event: 'sms_webhook_outcome',
          outcome: 'confirm_failed',
          transactionId: parsedReceipt.transactionId,
          requestId: pendingDeposit.requestId,
          error: result.error,
          ip: req.ip,
        });
        return res.status(500).json({ error: 'Failed to confirm deposit' });
      }
    } catch (error: any) {
      logger.error({
        event: 'sms_webhook_outcome',
        outcome: 'internal_error',
        error: error.message,
        stack: error.stack,
        ip: req.ip,
      });
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default router;