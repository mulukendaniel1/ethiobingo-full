//src/services/ETBDepositService.ts
import { User } from '../core/database/models/User';
import { ETBDeposit } from '../core/database/models/ETBDeposit';
import { logger } from '../core/utils/logger';
import { NotificationService } from './notificationService';
import { auditService } from './auditService';
import mongoose from 'mongoose';
import { sanitizeInput } from '../core/utils/security';
import { SystemSettings } from '../core/database/models/SystemSettings';
import { getSettings } from '@/core/utils/settingsCache';
import { FeatureGuard } from '@/core/security/FeatureGuard';
import { UnclaimedReceipt } from '../core/database/models/UnclaimedReceipt';
import { recordLedger } from './ledgerHelper';

const SYSTEM_ADMIN_ID = new mongoose.Types.ObjectId('000000000000000000000001');
export class ETBDepositService {
  private notificationService: NotificationService;

  constructor() {
    this.notificationService = new NotificationService();
  }

  private formatUsername(user: any): string {
    if (user.username) {
      const escaped = user.username.replace(/_/g, '\\_');
      return `@${escaped}`;
    }
    return user.telegramId.toString();
  }

  private async notifyAdminsAutoConfirmed(deposit: any, user: any) {
  const message = `✅ *Deposit Auto‑Confirmed (SMS First)*\n\n` +
    `Request ID: \`${deposit.requestId}\`\n` +
    `User: ${this.formatUsername(user)}\n` +
    `Method: ${deposit.method.toUpperCase()}\n` +
    `Amount: ${deposit.amountETB} ETB\n` +
    `Transaction ID: \`${deposit.transactionId}\`\n` +
    `Note: SMS arrived before user submission.`;
  
  await this.notificationService.sendAdminAlert(message, 'info');
}

  getMethodDetails(method: 'cbe' | 'abyssinia' | 'cbebirr' | 'telebirr') {
    const settings = getSettings();
    switch (method) {
      case 'cbe':
        return {
          name: 'CBE Bank',
          accountName: settings.cbeAccountName,
          accountNumber: settings.cbeAccountNumber,
          instructionsAmh: settings.cbeInstructionsAmh,
        };
      case 'abyssinia':
        return {
          name: 'Abyssinia Bank',
          accountName: settings.abyssiniaAccountName,
          accountNumber: settings.abyssiniaAccountNumber,
          instructionsAmh: settings.abyssiniaInstructionsAmh,
        };
      case 'cbebirr':
        return {
          name: 'CBE Birr',
          accountName: settings.cbeBirrAccountName,
          accountNumber: settings.cbeBirrPhone,
          instructionsAmh: settings.cbeBirrInstructionsAmh,
        };
      case 'telebirr':
        return {
          name: 'Telebirr',
          accountName: settings.telebirrAccountName,
          accountNumber: settings.telebirrPhone,
          instructionsAmh: settings.telebirrInstructionsAmh,
        };
    }
  }

 /**
 * Parse Telebirr receipt SMS in multiple languages (English, Amharic, Tigrinya, Oromo, Somali).
 * Handles both "transferred" (user sends money) and "received" (merchant receives money) formats.
 */
parseTelebirrReceipt(text: string): {
  senderName: string;
  receiverName: string;
  amount: number;
  transactionId: string;
  date: Date;
  link?: string;
} | null {
  const clean = text.trim();
  const lowerClean = clean.toLowerCase();
  const isReceived = lowerClean.includes('received') || lowerClean.includes('ተቀብለዋል'); // "received" in Amharic? We'll rely mainly on English for type detection; other languages may need separate handling, but for now we use the presence of "received" to swap identities.

  // Language‑specific regex patterns
  const patterns = [
    // English
    {
      addressedTo: /Dear\s+([^\r\n]+)/i,
      payerFrom: /from\s+([A-Za-z0-9\s]+)\s*\(/i,
      payeeTo: /to\s+([A-Za-z0-9\s]+)\s*\(/i,
      amount: /(?:transferred|received)\s+ETB\s+([\d,]+\.\d{2})/i,
      tx: /(?:Your )?transaction number is\s+([A-Za-z0-9]+)/i,
      date: /on\s+(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2})/i,
      link: /link:\s+(https:\/\/\S+)/i,
    },
    // Amharic (አማርኛ)
    {
      addressedTo: /ውድ\s*([^\r\n]+)/i,
      payerFrom: /ከ\s+([^(]+)\s*\(/i,           // "from" in received messages
      payeeTo: /ወደ\s+([^(]+)\s*\(/i,           // "to" in transferred messages
      amount: /(\d+(?:[,.]?\d+)?)\s*ብር\s+(?:ልከዋል|ተቀብለዋል|አስተላልፈዋል|በ)/i,
      tx: /የሂሳብ\s+እንቅስቃሴ\s+ቁጥርዎ\s+([A-Za-z0-9]+)/i,
      date: /በ\s+(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2})/i,
      link: /ማስፈንጠርያውን\s+ይጫኑ፡\s+(https:\/\/\S+)/i,
    },
    // Tigrinya (ትግርኛ)
    {
      addressedTo: /ክቡር\s*([^\r\n]+)/i,
      payerFrom: /ካብ\s+([^(]+)\s*\(/i,
      payeeTo: /ናብ\s+([^(]+)\s*\(/i,
      amount: /(\d+(?:[,.]?\d+)?)\s*ቕርሺ\s+ናብ/i,
      tx: /ቁፅሪ\s+ሒሳብ\s+ዝተንቀሳቀሰ\s+([A-Za-z0-9]+)/i,
      date: /ብዕለት\s+(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2})/i,
      link: /ነዚ\s+ሊንክ\s+ይጠውቑ:\s+(https:\/\/\S+)/i,
    },
    // Oromo (Afaan Oromoo)
    {
      addressedTo: /Kabajamoo\s*([^\r\n]+)/i,
      payerFrom: /Irraa\s+([^(]+)\s*\(/i,
      payeeTo: /Gara\s+([^(]+)\s*\(/i,
      amount: /Qarshii\s+(\d+(?:[,.]?\d+)?)\s+gaafa/i,
      tx: /Lakkoofsi\s+sochii\s+maallaqaa\s+keessan\s+([A-Za-z0-9]+)(?:'|\s|$)/i,
      date: /gaafa\s+guyyaa\s+(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2})/i,
      link: /link\s+kana\s+tuqaa:\s+(https:\/\/\S+)/i,
    },
    // Somali (Soomaali)
    {
      addressedTo: /Qaali\s*([^\r\n]+)/i,
      payerFrom: /ka\s+([^(]+)\s*\(/i,
      payeeTo: /xagan\s+([^(]+)\s*\(/i,
      amount: /wareejisay\s+ETB\s+(\d+(?:[,.]?\d+)?)/i,
      tx: /lambarka\s+hawulgalkaaguna\s+waa\s+([A-Za-z0-9]+)/i,
      date: /markay\s+ahayd\s+(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2})/i,
      link: /xiriirka:\s+(https:\/\/\S+)/i,
    },
  ];

  for (const lang of patterns) {
    const addressMatch = clean.match(lang.addressedTo);
    const fromMatch = clean.match(lang.payerFrom);
    const toMatch = clean.match(lang.payeeTo);
    const amountMatch = clean.match(lang.amount);
    const txMatch = clean.match(lang.tx);
    const dateMatch = clean.match(lang.date);

    if (!amountMatch || !txMatch || !dateMatch) continue;

    let senderName = '';
    let receiverName = '';

    // Determine message type (received vs transferred) – fallback to checking presence of "from" or "to"
    const hasFrom = fromMatch !== null;
    const hasTo = toMatch !== null;
    const addressName = addressMatch ? addressMatch[1].trim() : '';

    if (hasFrom) {
      // Received message: sender is the one after "from", receiver is the addressed person
      senderName = fromMatch[1].trim();
      receiverName = addressName;
    } else if (hasTo) {
      // Transferred message: sender is the addressed person, receiver is after "to"
      senderName = addressName;
      receiverName = toMatch[1].trim();
    } else {
      // Fallback for messages that lack both: use addressed person as sender for transferred (most common)
      senderName = addressName;
      receiverName = ''; // will be filled by webhook fallback
    }

    // Clean names
    senderName = senderName.replace(/[\r\n]+/g, ' ').replace(/[.,!]$/, '').trim();
    receiverName = receiverName.replace(/[\r\n]+/g, ' ').replace(/[.,!]$/, '').trim();

    let amountStr = amountMatch[1].replace(/,/g, '');
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) continue;

    let transactionId = txMatch[1].replace(/[^\w]/g, '');

    const dateParts = dateMatch[1].split(/[\/ :]/);
    if (dateParts.length < 6) continue;
    const [day, month, year, hour, minute, second] = dateParts;
    const date = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute), parseInt(second)));
    if (isNaN(date.getTime())) continue;

    // Link extraction
    let link: string | undefined;
    let linkMatch = clean.match(lang.link);
    if (!linkMatch) {
      const genericLinkMatch = clean.match(/https:\/\/transactioninfo\.ethiotelecom\.et\/receipt\/[A-Za-z0-9]+/i);
      if (genericLinkMatch) linkMatch = genericLinkMatch;
    }
    if (linkMatch) {
      let rawLink = linkMatch[1] || linkMatch[0];
      rawLink = rawLink.replace(/[.,!]$/, '');
      try {
        const url = new URL(rawLink);
        if (url.protocol === 'https:' && url.hostname === 'transactioninfo.ethiotelecom.et') {
          const pathMatch = url.pathname.match(/^\/receipt\/([A-Za-z0-9]+)$/i);
          if (pathMatch && pathMatch[1] === transactionId) {
            link = rawLink;
          }
        }
      } catch {}
    }

    return { senderName, receiverName, amount, transactionId, date, link };
  }

  return null;
}

   /**
   * Validate Telebirr receipt without saving to DB.
   */
  async validateTelebirrReceipt(receiptText: string, expectedAmount: number): Promise<{
    success: boolean;
    error?: string;
    parsed?: any;
  }> {
    FeatureGuard.requireETBEnabled(); // master only
    const parsed = this.parseTelebirrReceipt(receiptText);
    if (!parsed) {
      return { success: false, error: 'Could not parse receipt. Please paste the full SMS exactly as received.' };
    }

    const settings = getSettings();
    const expectedReceiver = settings.telebirrAccountName;
    if (!expectedReceiver || parsed.receiverName.toLowerCase() !== expectedReceiver.toLowerCase()) {
      return { success: false, error: `Receiver name "${parsed.receiverName}" does not match our account "${expectedReceiver}".` };
    }

    if (Math.abs(parsed.amount - expectedAmount) > 0.01) {
      return { success: false, error: `Amount mismatch: you entered ${expectedAmount} ETB, but receipt shows ${parsed.amount.toFixed(2)} ETB.` };
    }

    const existing = await ETBDeposit.findOne({ transactionId: parsed.transactionId });
    if (existing) {
      return { success: false, error: `Transaction ID ${parsed.transactionId} already used in request ${existing.requestId}.` };
    }

    return { success: true, parsed };
  }

  /**
 * Parse CBE Birr receipt SMS and extract fields.
 * Example SMS:
 * Dear chalachew, you have sent 100.00Br. to Abr... ... on 11/04/26 12:28,Txn ID DDB71ACHTQR...
*Dear ABREHAM, you received 100.00Br. from 0912847430 - chalachew zeleke anley on 18/04/26 22:17,Txn ID DDB71ACHTQR...
 * Dear mitku, you have sent 10.00Br. to BAYE YILIKAL on 11/04/26 12:28,Txn ID DDB71ACHTQR. Your CBE Birr account balance is 40.07Br.Thank you! For invoice https://cbepay1.cbe.com.et/aureceipt?TID=DDB71ACHTQR&PH=251912847430 For your feedback please click the link https://shorturl.at/gy3A0
 */
parseCbeBirrReceipt(text: string): {
  senderName: string;
  receiverName: string;
  amount: number;
  transactionId: string;
  date: Date;
  link?: string;
} | null {
  const clean = text.trim();
  const lowerClean = clean.toLowerCase();

  // Determine message type
  const isReceived = lowerClean.includes('received');

  // 1. Addressed person: after "Dear " until comma or end
  const addressMatch = clean.match(/Dear\s+([^,]+)/i);
  if (!addressMatch) return null;
  const addressedTo = addressMatch[1].trim();

  // 2. Amount: number followed by "Br" (with optional decimal and commas)
  const amountMatch = clean.match(/(?:sent|received)\s+([\d,]+\.\d{2})\s*Br\.?/i);
  if (!amountMatch) return null;
  const amountStr = amountMatch[1].replace(/,/g, '');
  const amount = parseFloat(amountStr);
  if (isNaN(amount) || amount <= 0) return null;

  // 3. Sender and Receiver based on type
  let senderName = '';
  let receiverName = '';

  if (isReceived) {
    // Received: "you received ... from [Sender]"
    const fromMatch = clean.match(/from\s+([A-Za-z0-9\s\-]+?)(?:\s+on\b|$)/i);
    if (fromMatch) {
      senderName = fromMatch[1].trim();
    }
    receiverName = addressedTo;
  } else {
    // Sent: "you have sent ... to [Receiver]"
    const toMatch = clean.match(/to\s+([A-Za-z0-9\s]+?)(?:\s+on\b|$)/i);
    if (toMatch) {
      receiverName = toMatch[1].trim();
    }
    senderName = addressedTo;
  }

  // 4. Date: format DD/MM/YY HH:MM
  const dateMatch = clean.match(/on\s+(\d{2}\/\d{2}\/\d{2})\s+(\d{2}:\d{2})/i);
  if (!dateMatch) return null;
  const [day, month, shortYear] = dateMatch[1].split('/');
  const [hour, minute] = dateMatch[2].split(':');
  const year = 2000 + parseInt(shortYear);
  const date = new Date(Date.UTC(year, parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute), 0));
  if (isNaN(date.getTime())) return null;

  // 5. Transaction ID: after "Txn ID "
  const txMatch = clean.match(/Txn\s+ID\s+([A-Z0-9]+)/i);
  if (!txMatch) return null;
  const transactionId = txMatch[1];

  // 6. Link: extract invoice URL
  let link: string | undefined;
  const linkMatch = clean.match(/https:\/\/cbepay1\.cbe\.com\.et\/aureceipt\?TID=[A-Z0-9]+&PH=\d+/i);
  if (linkMatch) {
    link = linkMatch[0];
  }

  // Clean names
  senderName = senderName.replace(/[\r\n]+/g, ' ').replace(/[.,!]$/, '').trim();
  receiverName = receiverName.replace(/[\r\n]+/g, ' ').replace(/[.,!]$/, '').trim();

  return { senderName, receiverName, amount, transactionId, date, link };
}

/**
 * Validate CBE Birr receipt without saving to DB.
 */
async validateCbeBirrReceipt(receiptText: string, expectedAmount: number): Promise<{
  success: boolean;
  error?: string;
  parsed?: any;
}> {
  FeatureGuard.requireETBEnabled();
  const parsed = this.parseCbeBirrReceipt(receiptText);
  if (!parsed) {
    return { success: false, error: 'Could not parse receipt. Please paste the full SMS exactly as received.' };
  }

  const settings = getSettings();
  const expectedReceiver = settings.cbeBirrAccountName;
  if (!expectedReceiver || parsed.receiverName.toLowerCase() !== expectedReceiver.toLowerCase()) {
    return { success: false, error: `Receiver name "${parsed.receiverName}" does not match our account "${expectedReceiver}". Please verify.` };
  }

  if (Math.abs(parsed.amount - expectedAmount) > 0.01) {
    return { success: false, error: `Amount mismatch: you entered ${expectedAmount} ETB, but receipt shows ${parsed.amount.toFixed(2)} ETB. Please start over.` };
  }

  const existing = await ETBDeposit.findOne({ transactionId: parsed.transactionId });
  if (existing) {
    return { success: false, error: `Transaction ID ${parsed.transactionId} already used in request ${existing.requestId}.` };
  }

  return { success: true, parsed };
}

  /**
   * Finalize deposit after user confirmation.
   */
async finalizeDepositRequest(
  userId: mongoose.Types.ObjectId,
  method: string,
  amountETB: number,
  parsedReceipt: any
): Promise<{ success: boolean; error?: string; requestId?: string; autoConfirmed?: boolean }> {
  FeatureGuard.requireDepositEnabled();

  const user = await User.findById(userId);
  if (!user) return { success: false, error: 'User not found' };

  // 🔍 Check for existing unclaimed receipt
  const unclaimed = await UnclaimedReceipt.findOne({
    transactionId: parsedReceipt.transactionId,
    matched: false,
  });

  if (unclaimed) {
    // Verify amount matches
    if (Math.abs(unclaimed.amount - amountETB) <= 0.01) {
      logger.info(`Unclaimed receipt found for txId ${parsedReceipt.transactionId}, auto‑confirming immediately.`);

      const requestId = `DEP-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      const deposit = await ETBDeposit.create({
        userId,
        requestId,
        method,
        amountETB,
        transactionId: parsedReceipt.transactionId,
        status: 'confirmed', // directly confirmed
        confirmedBy: SYSTEM_ADMIN_ID,
        confirmedAt: new Date(),
        adminNotes: 'Auto-confirmed via unclaimed SMS receipt (SMS arrived first)',
        senderName: parsedReceipt.senderName,
        receiverName: parsedReceipt.receiverName,
        extractedAmount: parsedReceipt.amount,
        extractedDate: parsedReceipt.date,
        receiptLink: parsedReceipt.link,
      });

      // Mark unclaimed receipt as matched
      unclaimed.matched = true;
      unclaimed.matchedDepositId = deposit._id;
      await unclaimed.save();

      // Update user balance (main deposit)
      await User.findByIdAndUpdate(userId, {
        $inc: {
          // Deposits are real money → immediately withdrawable
          balanceMain: amountETB,
          totalConfirmedDepositsETB: amountETB,
          ETBCoins: amountETB,
          totalETBEarned: amountETB,
        },
        $push: {
          ETBCoinTransactions: {
            type: 'earned',
            amount: amountETB,
            reference: `DEPOSIT-${requestId}`,
            notes: `ETB deposit via ${method} (auto‑confirmed)`,
            timestamp: new Date(),
          },
        },
      });


              // ----- GLOBAL DEPOSIT BONUS (for auto‑confirmed deposits) -----
              const cachedSettings = getSettings();
              if (cachedSettings.depositBonusEnabled && cachedSettings.depositBonusPercent > 0) {
                const bonusPercent = cachedSettings.depositBonusPercent;
                const bonusAmount = Math.round((amountETB * bonusPercent / 100) * 100) / 100;
                
                if (bonusAmount > 0) {
                  await User.findByIdAndUpdate(
                    userId,
                    {
                      $inc: {
                        lockedBalance: bonusAmount,
                        bonusBalance: bonusAmount,
                        ETBCoins: bonusAmount,
                        totalETBEarned: bonusAmount
                      },
                      $push: {
                        ETBCoinTransactions: {
                          type: 'earned',
                          amount: bonusAmount,
                          reference: `DEPOSIT-BONUS-${requestId}`,
                          notes: `Global deposit bonus (${bonusPercent}% of deposit)`,
                          timestamp: new Date()
                        }
                      }
                    }
                  );

                  // Fire‑and‑forget notification
                  this.notificationService.sendDepositBonus(
                    user.telegramId,
                    bonusAmount,
                    amountETB,
                    bonusPercent,
                    user.language || 'en'
                  ).catch(err => logger.error('Failed to send deposit bonus notification:', err));
                }
              }

            const updatedUser = await User.findById(userId).select('ETBCoins').lean();
            if (!updatedUser) {
              logger.error('User not found after balance update for auto-deposit');
              return { success: false, error: 'User balance update failed' };
            }

            // ── Bonus-abuse guard: re-check clearing conditions after this deposit ──
            // Either lifetime deposits reached 200, OR the user has ever wagered real
            // deposit money and lifetime deposits now exceed 10. The second path exists
            // so a user isn't stuck waiting for 200 just because their first bet happened
            // to be bonus-funded (see round-result handler).
            const abuserCheck = await User.findById(userId)
              .select('isAbuser totalConfirmedDepositsETB hasWageredFromDeposit')
              .lean();
            if (abuserCheck?.isAbuser) {
              const qualifies =
                (abuserCheck.totalConfirmedDepositsETB || 0) >= 200 ||
                (abuserCheck.hasWageredFromDeposit && (abuserCheck.totalConfirmedDepositsETB || 0) > 10);
              if (qualifies) {
                await User.updateOne({ _id: userId }, { $set: { isAbuser: false } });
              }
            }

            // ----- AGENT COMMISSION + FIRST-DEPOSIT BONUS (auto‑confirmed path) -----
            const agentSettings = await SystemSettings.find();
            const agentSettingsMap: Record<string, any> = {};
            for (const s of agentSettings) agentSettingsMap[s.key] = s.value;

            if (agentSettingsMap.agent_system_enabled && updatedUser.referredBy) {
              const referrer = await User.findById(updatedUser.referredBy);
              if (referrer && referrer.isAgent && referrer.agentApprovedAt) {
                const referralEntry = referrer.referrals.find(r => r.userId.equals(updatedUser._id));
                if (referralEntry) {
                  const joinedAt = referralEntry.joinedAt;
                  if (joinedAt >= referrer.agentApprovedAt) {
                    // ── FIRST DEPOSIT BONUS (non-withdrawable) ──
                    if (!referralEntry.firstDepositBonusGiven && agentSettingsMap.agent_first_deposit_bonus_enabled) {
                      let bonus = 0;
                      const highThreshold = agentSettingsMap.agent_min_deposit_for_bonus_high || 50;
                      const lowThreshold = agentSettingsMap.agent_min_deposit_for_bonus_low || 20;
                      if (amountETB >= highThreshold) {
                        bonus = agentSettingsMap.agent_first_deposit_bonus_high || 10;
                      } else if (amountETB >= lowThreshold) {
                        bonus = agentSettingsMap.agent_first_deposit_bonus_low || 5;
                      }
                      if (bonus > 0) {
                        await User.findByIdAndUpdate(referrer._id, {
                          $inc: {
                            lockedBalance: bonus,
                            ETBCoins: bonus,
                            totalCommissionPaid: bonus,
                            referralEarnings: bonus,
                          },
                          $push: {
                            ETBCoinTransactions: {
                              type: 'earned',
                              amount: bonus,
                              reference: `FIRST-DEPOSIT-${requestId}`,
                              notes: `First deposit bonus from ${updatedUser.telegramId} (non‑withdrawable)`,
                              timestamp: new Date()
                            }
                          }
                        });
                        await User.updateOne(
                          { _id: referrer._id, 'referrals.userId': updatedUser._id },
                          { $set: { 'referrals.$.firstDepositBonusGiven': true } }
                        );
                        await this.notificationService.sendAgentFirstDepositBonus(
                          referrer.telegramId,
                          bonus,
                          updatedUser.telegramId,
                          amountETB,
                          false
                        ).catch(err => logger.error('sendAgentFirstDepositBonus failed:', err));
                      }
                    }

                    // ── LIFETIME COMMISSION (withdrawable) ──
                    const commissionPercent = agentSettingsMap.agent_commission_percent || 5;
                    const commissionAmount = amountETB * (commissionPercent / 100);
                    if (commissionAmount > 0) {
                      await User.findByIdAndUpdate(referrer._id, {
                        $inc: {
                          balanceMain: commissionAmount,
                          ETBCoins: commissionAmount,
                          totalCommissionPaid: commissionAmount,
                          referralEarnings: commissionAmount,
                        },
                        $push: {
                          ETBCoinTransactions: {
                            type: 'earned',
                            amount: commissionAmount,
                            reference: `COMMISSION-${requestId}`,
                            notes: `${commissionPercent}% commission on deposit from ${updatedUser.telegramId} (withdrawable)`,
                            timestamp: new Date()
                          }
                        }
                      });
                      await auditService.logFinancialTransaction(
                        referrer._id,
                        referrer.telegramId,
                        'AGENT_COMMISSION',
                        commissionAmount,
                        'ETB',
                        requestId,
                        {
                          fromUserId: updatedUser._id,
                          depositAmount: amountETB,
                          commissionPercent,
                        }
                      );
                      await this.notificationService.sendAgentCommission(
                        referrer.telegramId,
                        commissionAmount,
                        updatedUser.telegramId,
                        amountETB,
                        commissionPercent,
                        true
                      ).catch(err => logger.error('sendAgentCommission failed:', err));
                    }
                  }
                }
              }
            }

            await recordLedger({
              userId,
              type: 'deposit_auto_confirmed',
              amount: amountETB,
              balanceAfter: updatedUser.ETBCoins,
              referenceId: requestId,
              notes: 'Auto‑confirmed via unclaimed SMS receipt',
            });

      await this.notificationService.sendDepositConfirmed(
        user.telegramId,
        amountETB,
        requestId
      );

      await this.notifyAdminsAutoConfirmed(deposit, user);

      return { success: true, requestId, autoConfirmed: true };
    } else {
      // Amount mismatch – flag for manual review
      logger.warn(`Unclaimed receipt amount mismatch: txId ${parsedReceipt.transactionId}, SMS ${unclaimed.amount} vs user ${amountETB}`);
    }
  }

  // Normal pending deposit creation (existing code)
  const requestId = `DEP-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
  const deposit = await ETBDeposit.create({
    userId,
    requestId,
    method,
    amountETB,
    transactionId: parsedReceipt.transactionId,
    status: 'pending',
    senderName: parsedReceipt.senderName,
    receiverName: parsedReceipt.receiverName,
    extractedAmount: parsedReceipt.amount,
    extractedDate: parsedReceipt.date,
    receiptLink: parsedReceipt.link,
  });

  await this.notifyAdminsNewDeposit(deposit, user);
  logger.info(`Deposit request created: ${requestId} for user ${user.telegramId}`);
  return { success: true, requestId, autoConfirmed: false };
}

  async createDepositRequest(
  userId: mongoose.Types.ObjectId,
  method: 'cbe' | 'abyssinia' | 'cbebirr' | 'telebirr',
  amountETB: number,
  receiptText?: string,
  transactionId?: string,
  accountDetails?: string
) {
  FeatureGuard.requireDepositEnabled();

  try {
    const user = await User.findById(userId);
    if (!user) return { success: false, error: 'User not found' };

    // --- Handle CBE Birr (receipt parsing) ---
    if (method === 'cbebirr') {
      if (!receiptText) return { success: false, error: 'Receipt text is required' };
      const parsed = this.parseCbeBirrReceipt(receiptText);
      if (!parsed) {
        return { success: false, error: 'Could not parse receipt. Please paste the full SMS exactly as received.' };
      }

      const settings = getSettings();
      const expectedReceiver = settings.cbeBirrAccountName;
      if (!expectedReceiver || parsed.receiverName.toLowerCase() !== expectedReceiver.toLowerCase()) {
        return { success: false, error: `Receiver name "${parsed.receiverName}" does not match our account "${expectedReceiver}".` };
      }

      if (Math.abs(parsed.amount - amountETB) > 0.01) {
        return { success: false, error: `Amount mismatch: you entered ${amountETB} ETB, but receipt shows ${parsed.amount.toFixed(2)} ETB.` };
      }

      const existing = await ETBDeposit.findOne({ transactionId: parsed.transactionId });
      if (existing) {
        return { success: false, error: `Transaction ID already used.` };
      }

      const requestId = `DEP-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      const deposit = await ETBDeposit.create({
        userId,
        requestId,
        method,
        amountETB,
        transactionId: parsed.transactionId,
        status: 'pending',
        senderName: parsed.senderName,
        receiverName: parsed.receiverName,
        extractedAmount: parsed.amount,
        extractedDate: parsed.date,
        receiptLink: parsed.link,
      });

      await this.notifyAdminsNewDeposit(deposit, user);
      return { success: true, requestId, amountETB, parsed };
    }

    // --- Handle Telebirr (receipt parsing) ---
    if (method === 'telebirr') {
      if (!receiptText) return { success: false, error: 'Receipt text is required' };
      const parsed = this.parseTelebirrReceipt(receiptText);
      if (!parsed) {
        return { success: false, error: 'Could not parse receipt. Please paste the full SMS exactly as received.' };
      }

      const settings = getSettings();
      const expectedReceiver = settings.telebirrAccountName;
      if (!expectedReceiver || parsed.receiverName.toLowerCase() !== expectedReceiver.toLowerCase()) {
        return { success: false, error: `Receiver name "${parsed.receiverName}" does not match our account "${expectedReceiver}".` };
      }

      if (Math.abs(parsed.amount - amountETB) > 0.01) {
        return { success: false, error: `Amount mismatch: you entered ${amountETB} ETB, but receipt shows ${parsed.amount.toFixed(2)} ETB.` };
      }

      const existing = await ETBDeposit.findOne({ transactionId: parsed.transactionId });
      if (existing) {
        return { success: false, error: `Transaction ID ${parsed.transactionId} already used.` };
      }

      const requestId = `DEP-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      const deposit = await ETBDeposit.create({
        userId,
        requestId,
        method,
        amountETB,
        transactionId: parsed.transactionId,
        status: 'pending',
        senderName: parsed.senderName,
        receiverName: parsed.receiverName,
        extractedAmount: parsed.amount,
        extractedDate: parsed.date,
        receiptLink: parsed.link,
      });

      await this.notifyAdminsNewDeposit(deposit, user);
      return { success: true, requestId, amountETB, parsed };
    }

    // --- Handle other methods (cbe, abyssinia) – legacy ---
    const safeTransactionId = sanitizeInput(transactionId);
    const safeAccountDetails = sanitizeInput(accountDetails);
    if (!safeTransactionId) return { success: false, error: 'Transaction ID required' };
    if (amountETB <= 0) return { success: false, error: 'Amount must be greater than 0' };

    const existing = await ETBDeposit.findOne({ transactionId: safeTransactionId });
    if (existing) {
      return { success: false, error: `Transaction ID already used in request ${existing.requestId}.` };
    }

    const requestId = `DEP-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    const deposit = await ETBDeposit.create({
      userId,
      requestId,
      method,
      amountETB,
      transactionId: safeTransactionId,
      accountDetails: safeAccountDetails,
      status: 'pending'
    });
    await this.notifyAdminsNewDeposit(deposit, user);
    logger.info(`Deposit request created: ${requestId} for user ${user.telegramId}`);
    return { success: true, requestId, amountETB };
  } catch (error: any) {
    logger.error('Create deposit error:', error);
    return { success: false, error: error.message };
  }
}

 async confirmDeposit(requestId: string, adminId: mongoose.Types.ObjectId, notes?: string) {
  try {
    const safeRequestId = sanitizeInput(requestId);

    const deposit = await ETBDeposit.findOneAndUpdate(
      { requestId: safeRequestId, status: 'pending' },
      {
        $set: {
          status: 'confirmed',
          confirmedBy: adminId,
          confirmedAt: new Date(),
          adminNotes: notes
        }
      },
      { new: true }
    );

    if (!deposit) {
      return { success: false, error: 'Deposit request not found or already processed' };
    }

    const user = await User.findById(deposit.userId);
    if (!user) return { success: false, error: 'User not found' };

    // 1) Main deposit update
    const updatedUser = await User.findByIdAndUpdate(
      deposit.userId,
      {
        $inc: {
          // Deposits are real money → immediately withdrawable
          balanceMain: deposit.amountETB,
          totalConfirmedDepositsETB: deposit.amountETB,
          ETBCoins: deposit.amountETB,
          totalETBEarned: deposit.amountETB
        },
        $push: {
          ETBCoinTransactions: {
            type: 'earned',
            amount: deposit.amountETB,
            reference: `DEPOSIT-${deposit.requestId}`,
            notes: `ETB deposit via ${deposit.method}`,
            timestamp: new Date()
          }
        }
      },
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return { success: false, error: 'Failed to update user balance' };
    }

    // 2) Global deposit bonus (non‑withdrawable, separate from main deposit)
    const cachedSettings = getSettings();
    if (cachedSettings.depositBonusEnabled && cachedSettings.depositBonusPercent > 0) {
      const bonusPercent = cachedSettings.depositBonusPercent;
      const bonusAmount = Math.round((deposit.amountETB * bonusPercent / 100) * 100) / 100;

      if (bonusAmount > 0) {
        await User.findByIdAndUpdate(
          deposit.userId,
          {
            $inc: {
              lockedBalance: bonusAmount,
              bonusBalance: bonusAmount,
              ETBCoins: bonusAmount,
              totalETBEarned: bonusAmount
            },
            $push: {
              ETBCoinTransactions: {
                type: 'earned',
                amount: bonusAmount,
                reference: `DEPOSIT-BONUS-${deposit.requestId}`,
                notes: `Global deposit bonus (${bonusPercent}% of deposit)`,
                timestamp: new Date()
              }
            }
          }
        );

        this.notificationService.sendDepositBonus(
          updatedUser.telegramId,
          bonusAmount,
          deposit.amountETB,
          bonusPercent,
          updatedUser.language || 'en'
        ).catch(err => logger.error('Failed to send deposit bonus notification:', err));
      }
    }

    // 3) Fetch final user object (includes all balance changes)
    const finalUser = await User.findById(deposit.userId);
    if (!finalUser) {
      return { success: false, error: 'User not found after deposit' };
    }

    // 4) Bonus‑abuse guard (uses final values)
    if (finalUser.isAbuser) {
      const qualifies =
        finalUser.totalConfirmedDepositsETB >= 200 ||
        (finalUser.hasWageredFromDeposit && finalUser.totalConfirmedDepositsETB > 10);
      if (qualifies) {
        await User.updateOne({ _id: finalUser._id }, { $set: { isAbuser: false } });
      }
    }

    // 5) Agent commission and first deposit bonus (uses finalUser)
    const settings = await SystemSettings.find();
    const settingsMap: Record<string, any> = {};
    for (const s of settings) settingsMap[s.key] = s.value;

    if (settingsMap.agent_system_enabled && finalUser.referredBy) {
      const referrer = await User.findById(finalUser.referredBy);
      if (referrer && referrer.isAgent && referrer.agentApprovedAt) {
        const referralEntry = referrer.referrals.find(r => r.userId.equals(finalUser._id));
        if (referralEntry) {
          const joinedAt = referralEntry.joinedAt;
          if (joinedAt >= referrer.agentApprovedAt) {
            // ----- FIRST DEPOSIT BONUS (non-withdrawable) -----
            if (!referralEntry.firstDepositBonusGiven && settingsMap.agent_first_deposit_bonus_enabled) {
              let bonus = 0;
              const highThreshold = settingsMap.agent_min_deposit_for_bonus_high || 50;
              const lowThreshold = settingsMap.agent_min_deposit_for_bonus_low || 20;
              if (deposit.amountETB >= highThreshold) {
                bonus = settingsMap.agent_first_deposit_bonus_high || 10;
              } else if (deposit.amountETB >= lowThreshold) {
                bonus = settingsMap.agent_first_deposit_bonus_low || 5;
              }
              if (bonus > 0) {
                const referrerAfterBonus = await User.findByIdAndUpdate(
                  referrer._id,
                  {
                    $inc: {
                      lockedBalance: bonus,
                      ETBCoins: bonus,
                      totalCommissionPaid: bonus,
                      referralEarnings: bonus,
                    },
                    $push: {
                      ETBCoinTransactions: {
                        type: 'earned',
                        amount: bonus,
                        reference: `FIRST-DEPOSIT-${deposit.requestId}`,
                        notes: `First deposit bonus from ${finalUser.telegramId} (non‑withdrawable)`,
                        timestamp: new Date()
                      }
                    }
                  },
                  { new: true, runValidators: true }
                );
                await User.updateOne(
                  { _id: referrer._id, 'referrals.userId': finalUser._id },
                  { $set: { 'referrals.$.firstDepositBonusGiven': true } }
                );

                await recordLedger({
                  userId: referrer._id,
                  type: 'agent_first_deposit_bonus',
                  amount: bonus,
                  balanceAfter: referrerAfterBonus!.ETBCoins,
                  referenceId: deposit.requestId,
                  notes: `First deposit bonus from ${finalUser.telegramId} (non‑withdrawable)`,
                });
                await this.notificationService.sendAgentFirstDepositBonus(
                  referrer.telegramId,
                  bonus,
                  finalUser.telegramId,
                  deposit.amountETB,
                  false
                );
              }
            }

            // ----- LIFETIME COMMISSION (withdrawable) -----
            const commissionPercent = settingsMap.agent_commission_percent || 5;
            const commissionAmount = deposit.amountETB * (commissionPercent / 100);
            if (commissionAmount > 0) {
              const referrerAfterComm = await User.findByIdAndUpdate(
                referrer._id,
                {
                  $inc: {
                    balanceMain: commissionAmount,
                    ETBCoins: commissionAmount,
                    totalCommissionPaid: commissionAmount,
                    referralEarnings: commissionAmount,
                  },
                  $push: {
                    ETBCoinTransactions: {
                      type: 'earned',
                      amount: commissionAmount,
                      reference: `COMMISSION-${deposit.requestId}`,
                      notes: `${commissionPercent}% commission on deposit from ${finalUser.telegramId} (withdrawable)`,
                      timestamp: new Date()
                    }
                  }
                },
                { new: true, runValidators: true }
              );

              await recordLedger({
                userId: referrer._id,
                type: 'agent_commission',
                amount: commissionAmount,
                balanceAfter: referrerAfterComm!.ETBCoins,
                referenceId: deposit.requestId,
                notes: `${commissionPercent}% commission from ${finalUser.telegramId}`,
              });
              await auditService.logFinancialTransaction(
                referrer._id,
                referrer.telegramId,
                'AGENT_COMMISSION',
                commissionAmount,
                'ETB',
                deposit.requestId,
                {
                  fromUserId: finalUser._id,
                  depositAmount: deposit.amountETB,
                  commissionPercent,
                }
              );
              await this.notificationService.sendAgentCommission(
                referrer.telegramId,
                commissionAmount,
                finalUser.telegramId,
                deposit.amountETB,
                commissionPercent,
                true
              );
            }
          } else {
            logger.info(`User ${finalUser.telegramId} joined before agent approval (joined: ${joinedAt}, approved: ${referrer.agentApprovedAt}), skipping commission`);
          }
        }
      }
    }

    // 6) Notifications and audit (uses finalUser)
    await this.notificationService.sendDepositConfirmed(
      finalUser.telegramId,
      deposit.amountETB,
      deposit.requestId
    );

    await auditService.logAdminAction(
      adminId,
      finalUser.telegramId,
      'DEPOSIT_CONFIRMED',
      'FINANCIAL',
      'ETBDeposit',
      deposit._id.toString(),
      { requestId, amountETB: deposit.amountETB }
    );

    await recordLedger({
      userId: deposit.userId,
      type: 'deposit',
      amount: deposit.amountETB,
      balanceAfter: finalUser.ETBCoins,
      referenceId: deposit.requestId,
      notes: `Deposit via ${deposit.method}`,
    });

    return { success: true };
  } catch (error: any) {
    logger.error('Confirm deposit error:', error);
    return { success: false, error: error.message };
  }
}

  async rejectDeposit(requestId: string, adminId: mongoose.Types.ObjectId, reason: string) {
  try {
    const safeRequestId = sanitizeInput(requestId);
    const safeReason = sanitizeInput(reason);
    
    const deposit = await ETBDeposit.findOneAndUpdate(
      { requestId: safeRequestId, status: 'pending' },
      { 
        $set: { 
          status: 'rejected', 
          adminNotes: safeReason,
          confirmedBy: adminId,
          confirmedAt: new Date()
        }
      },
      { new: true }
    );
    
    if (!deposit) {
      return { success: false, error: 'Deposit request not found or already processed' };
    }

    const user = await User.findById(deposit.userId);
    if (user) {
      await this.notificationService.sendDepositRejected(
        user.telegramId,
        deposit.amountETB,
        deposit.requestId,
        safeReason
      );
    }

    await auditService.logAdminAction(
      adminId,
      user?.telegramId || 0,
      'DEPOSIT_REJECTED',
      'FINANCIAL',
      'ETBDeposit',
      deposit._id.toString(),
      { requestId: safeRequestId, reason: safeReason }
    );

    return { success: true };
  } catch (error: any) {
    logger.error('Reject deposit error:', error);
    return { success: false, error: error.message };
  }
}

  private async notifyAdminsNewDeposit(deposit: any, user: any) {
  let message = `🤑 *New ETB Deposit Request*\n\n` +
    `Request ID: \`${deposit.requestId}\`\n` +
    `User: ${this.formatUsername(user)}\n` +
    `Method: ${deposit.method.toUpperCase()}\n` +
    `Amount: ${deposit.amountETB} ETB\n` +
    `Transaction ID: \`${deposit.transactionId}\`\n`;
  if (deposit.method === 'telebirr') {
    message += `Sender: ${deposit.senderName}\n` +
      `Receiver: ${deposit.receiverName}\n` +
      `Extracted Amount: ${deposit.extractedAmount} ETB\n` +
      `Date: ${deposit.extractedDate?.toLocaleString()}\n`;
    if (deposit.receiptLink) message += `Receipt Link: ${deposit.receiptLink}\n`;
  }
  message += `Time: ${deposit.createdAt.toLocaleString()}`;
  
  // Log to console for debugging
  logger.info(`New deposit request: ${deposit.requestId} from user ${user.telegramId} (${user.username || 'no username'})`);
  
  await this.notificationService.sendAdminAlert(message, 'info').catch(err => {
    logger.error('Failed to send admin alert for deposit:', err);
  });
}
}