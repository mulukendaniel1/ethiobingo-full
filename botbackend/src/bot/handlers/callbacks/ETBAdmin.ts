//src/bot/handlers/callbacks/ETBAdmin.ts
import { CallbackQueryContext, InlineKeyboard } from 'grammy';
import { Context } from '../../framework';
import { User } from '../../../core/database/models/User';
import { ETBDeposit } from '../../../core/database/models/ETBDeposit';
import { ETBWithdrawal } from '../../../core/database/models/ETBWithdrawal';
import { logger } from '../../../core/utils/logger';
import { ETBDepositService } from '../../../services/ETBDepositServiceInstance';
import { ETBWithdrawalService } from '../../../services/ETBWithdrawalServiceInstance';
import { auditService } from '../../../services/auditService';
import { sanitizeInput } from '../../../core/utils/security';
import { UnclaimedReceipt } from '../../../core/database/models/UnclaimedReceipt';

// ========== DEPOSITS ==========

export async function handleAdminETBDeposits(ctx: CallbackQueryContext<Context>) {
  await ctx.answerCallbackQuery();
  try {
    const adminId = sanitizeInput(ctx.from!.id);
    const admin = await User.findOne({ telegramId: parseInt(adminId) });
    if (!admin?.isAdmin) return;

    const deposits = await ETBDeposit.find({ status: 'pending' })
      .populate('userId', 'telegramId username')
      .sort({ createdAt: 1 })
      .limit(20)
      .lean();

    let message = `🤑 *Pending ETB Deposits*\n\n`;
    if (deposits.length === 0) {
      message += 'No pending deposits.';
    } else {
      message += `Found ${deposits.length} pending:\n\n`;
      for (const d of deposits) {
        const user = d.userId as any;
        message += `• ID: \`${d.requestId}\`\n`;
        message += `  User: @${user?.username || user?.telegramId}\n`;
        message += `  Amount: ${d.amountETB} ETB\n`;
        message += `  Method: ${d.method.toUpperCase()}\n`;
        message += `  TX ID: \`${d.transactionId}\`\n`;
        message += `  Time: ${new Date(d.createdAt).toLocaleString()}\n\n`;
      }
    }

    const keyboard = new InlineKeyboard();
    for (const d of deposits.slice(0, 5)) {
      keyboard.text(`✅ ${d.requestId.substring(0, 8)}...`, `admin_ETB_deposit_${d.requestId}`).row();
    }
    keyboard
      .text('🔄 Refresh', 'admin_ETB_deposits')
      .text('🔙 Back', 'admin_menu');

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  } catch (error) {
      logger.error({ err: error }, 'Admin ETB deposits error');

  }
}

export async function handleAdminETBDepositDetail(ctx: CallbackQueryContext<Context>) {
  await ctx.answerCallbackQuery();
  const requestId = sanitizeInput(ctx.match![1]);
  if (!requestId) {
    await ctx.editMessageText?.('❌ Invalid request ID.');
    return;
  }
  try {
    const deposit = await ETBDeposit.findOne({ requestId })
      .populate('userId', 'telegramId username firstName balanceMain ETBCoins')
      .populate('confirmedBy', 'username');

    if (!deposit) {
      await ctx.editMessageText?.('❌ Deposit not found.');
      return;
    }

    const user = deposit.userId as any;
    const confirmedByUser = deposit.confirmedBy as any;
    const statusEmoji = deposit.status === 'pending' ? '⏳' : deposit.status === 'confirmed' ? '✅' : '❌';

    // Header
    let message = `${statusEmoji} *ETB Deposit Details*\n\n`;

    // General info
    message += `*Request ID:* \`${deposit.requestId}\`\n`;
    message += `*User:* @${user?.username || user?.telegramId}\n`;
    message += `*Method:* ${deposit.method.toUpperCase()}\n`;
    message += `*Amount:* ${deposit.amountETB} ETB\n`;
    message += `*Transaction ID:* \`${deposit.transactionId}\`\n`;

    // Method‑specific details
    if (deposit.method === 'telebirr') {
      message += `\n*📱 Telebirr Receipt Details*\n`;
      message += `• *Sender:* ${deposit.senderName || 'N/A'}\n`;
      message += `• *Receiver:* ${deposit.receiverName || 'N/A'}\n`;
      message += `• *Extracted Amount:* ${deposit.extractedAmount ? deposit.extractedAmount.toFixed(2) : 'N/A'} ETB\n`;
      message += `• *Date:* ${deposit.extractedDate?.toLocaleString() || 'N/A'}\n`;
      if (deposit.receiptLink) message += `• *Receipt Link:* ${deposit.receiptLink}\n`;
    } else {
      message += `*Account Details:* ${deposit.accountDetails || 'N/A'}\n`;
    }

    // Status and timestamps
    message += `\n*Status:* ${deposit.status.toUpperCase()}\n`;
    message += `*Created:* ${deposit.createdAt.toLocaleString()}\n`;

    if (deposit.status !== 'pending') {
      message += `*Processed By:* @${confirmedByUser?.username || 'Admin'}\n`;
      message += `*Processed At:* ${deposit.confirmedAt?.toLocaleString()}\n`;
      if (deposit.adminNotes) message += `*Notes:* ${deposit.adminNotes}\n`;
    }

    // Build keyboard
    const keyboard = new InlineKeyboard();

    if (deposit.status === 'pending') {
      keyboard
        .text('✅ Confirm', `admin_ETB_confirm_deposit_${deposit.requestId}`)
        .text('❌ Reject', `admin_ETB_reject_deposit_${deposit.requestId}`)
        .row();
    }

    keyboard
      .text('📋 Back to List', 'admin_ETB_deposits')
      .text('🏠 Admin Menu', 'admin_menu');

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  } catch (error) {
    logger.error('Admin ETB deposit detail error:', error);
  }
}

export async function handleAdminETBConfirmDeposit(ctx: CallbackQueryContext<Context>) {
  await ctx.answerCallbackQuery({ text: 'Checking receipt...' });
  const requestId = sanitizeInput(ctx.match![1]);
  const adminId = sanitizeInput(ctx.from!.id);
  const admin = await User.findOne({ telegramId: parseInt(adminId) });
  if (!admin?.isAdmin) return;

  const deposit = await ETBDeposit.findOne({ requestId }).lean();
  if (!deposit) {
    await ctx.editMessageText?.('❌ Deposit not found.');
    return;
  }

  const unclaimed = await UnclaimedReceipt.findOne({ transactionId: deposit.transactionId });
  
  if (unclaimed) {
    // Auto-confirm
    const result = await ETBDepositService.confirmDeposit(requestId, admin._id);
    if (result.success) {
      await ctx.editMessageText?.(`✅ Deposit confirmed (unclaimed receipt matched).`, {
        reply_markup: { inline_keyboard: [[{ text: '🔙 Back to Deposits', callback_data: 'admin_ETB_deposits' }]] }
      });
    } else {
      await ctx.answerCallbackQuery({ text: `❌ ${result.error}`, show_alert: true });
    }
  } else {
    // Show warning and ask for manual confirmation
    const message = 
      `⚠️ *VERIFICATION REQUIRED*\n\n` +
      `Transaction ID \`${deposit.transactionId}\` was *NOT* found in unclaimed SMS receipts.\n\n` +
      `Please manually verify:\n` +
      `• Telebirr: SuperApp → Profile → Verify Payment\n` +
      `• CBE Birr: Check app transaction history\n\n` +
      `Ensure amount (${deposit.amountETB} ETB) and receiver match.\n\n` +
      `*Confirming without verification may cause financial loss.*`;
    
    const keyboard = new InlineKeyboard()
      .text('✅ Yes, I have verified', `admin_force_confirm_${requestId}`)
      .text('❌ Cancel', `admin_ETB_deposit_${requestId}`);
    
    await ctx.editMessageText?.(message, { parse_mode: 'Markdown', reply_markup: keyboard });
  }
}

export async function handleAdminETBForceConfirmDeposit(ctx: CallbackQueryContext<Context>) {
  await ctx.answerCallbackQuery();
  const requestId = sanitizeInput(ctx.match![1]);
  const adminId = sanitizeInput(ctx.from!.id);
  const admin = await User.findOne({ telegramId: parseInt(adminId) });
  if (!admin?.isAdmin) return;
  
  const result = await ETBDepositService.confirmDeposit(requestId, admin._id, 'Manually confirmed after verification warning');
  if (result.success) {
    await ctx.editMessageText?.(`✅ Deposit confirmed.`, {
      reply_markup: { inline_keyboard: [[{ text: '🔙 Back to Deposits', callback_data: 'admin_ETB_deposits' }]] }
    });
  } else {
    await ctx.answerCallbackQuery({ text: `❌ ${result.error}`, show_alert: true });
  }
}

export async function handleAdminETBRejectDeposit(ctx: CallbackQueryContext<Context>) {
  const requestId = sanitizeInput(ctx.match![1]);
  const adminId = sanitizeInput(ctx.from!.id);
  const admin = await User.findOne({ telegramId: parseInt(adminId) });
  if (!admin?.isAdmin) return;

  await ctx.editMessageText?.(
    `✏️ *Reject Deposit*\n\nPlease enter the reason for rejection:`,
    { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🔙 Cancel', callback_data: `admin_ETB_deposit_${requestId}` }]] } }
  );
  ctx.session.step = `admin_ETB_reject_deposit_${requestId}`;
}

export async function handleAdminETBRejectDepositInput(ctx: Context) {
  if (!ctx.session?.step?.startsWith('admin_ETB_reject_deposit_')) return;
  const requestId = sanitizeInput(ctx.session.step.replace('admin_ETB_reject_deposit_', ''));
  const reason = ctx.message?.text?.trim();
  if (!reason) {
    await ctx.reply('❌ Please enter a reason.');
    return;
  }
  const adminId = sanitizeInput(ctx.from!.id);
  const admin = await User.findOne({ telegramId: parseInt(adminId) });
  if (!admin?.isAdmin) {
    delete ctx.session.step;
    return;
  }
  const result = await ETBDepositService.rejectDeposit(requestId, admin._id, reason);

  if (result.success) {
    await ctx.reply(`✅ Deposit rejected.`, {
      reply_markup: { inline_keyboard: [[{ text: '🔙 Back to Deposits', callback_data: 'admin_ETB_deposits' }]] }
    });
  } else {
    await ctx.reply(`❌ ${result.error}`);
  }

  delete ctx.session.step;
}

// ========== WITHDRAWALS (similar pattern) ==========

export async function handleAdminETBWithdrawals(ctx: CallbackQueryContext<Context>) {
  await ctx.answerCallbackQuery();
  try {
    const adminId = sanitizeInput(ctx.from!.id);
    const admin = await User.findOne({ telegramId: parseInt(adminId) });
    if (!admin?.isAdmin) return;

    const withdrawals = await ETBWithdrawal.find({ status: 'pending' })
      .populate('userId', 'telegramId username')
      .sort({ createdAt: 1 })
      .limit(20)
      .lean();

    let message = `⬆️ *Pending ETB Withdrawals*\n\n`;
    if (withdrawals.length === 0) {
      message += 'No pending withdrawals.';
    } else {
      for (const w of withdrawals) {
        const user = w.userId as any;
        message += `• ID: \`${w.requestId}\`\n`;
        message += `  User: @${user?.username || user?.telegramId}\n`;
        message += `  Amount: ${w.amountETB} ETB → ${w.amountETB} ETB\n`;
        message += `  Method: ${w.method.toUpperCase()}\n`;
        message += `  Destination: \`${w.destinationDetails}\`\n\n`;
      }
    }

    const keyboard = new InlineKeyboard();
    for (const w of withdrawals.slice(0, 5)) {
      keyboard.text(`⬆️ ${w.requestId.substring(0, 8)}...`, `admin_ETB_withdrawal_${w.requestId}`).row();
    }
    keyboard
      .text('🔄 Refresh', 'admin_ETB_withdrawals')
      .text('🔙 Back', 'admin_menu');

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  } catch (error) {
    logger.error('Admin ETB withdrawals error:', error);
  }
}

export async function handleAdminETBWithdrawalDetail(ctx: CallbackQueryContext<Context>) {
  const requestId = sanitizeInput(ctx.match![1]);
  if (!requestId) {
    await ctx.editMessageText?.('❌ Invalid request ID.');
    return;
  }
  try {
    const withdrawal = await ETBWithdrawal.findOne({ requestId })
      .populate('userId', 'telegramId username balanceMain')
      .populate('processedBy', 'username');

    if (!withdrawal) {
      await ctx.editMessageText?.('❌ Withdrawal not found.');
      return;
    }
    const user = withdrawal.userId as any;               // cast to any or proper populated type
    const processedByUser = withdrawal.processedBy as any; // ✅ cast
    const statusEmoji = withdrawal.status === 'pending' ? '⏳' : withdrawal.status === 'processed' ? '✅' : '❌';

    let message = `${statusEmoji} *ETB Withdrawal Details*\n\n` +
      `Request ID: \`${withdrawal.requestId}\`\n` +
      `User: @${user?.username || user?.telegramId}\n` +
      `Method: ${withdrawal.method.toUpperCase()}\n` +
      `Amount: ${withdrawal.amountETB} ETB\n` +
      `Destination: \`${withdrawal.destinationDetails}\`\n` +
      `Status: *${withdrawal.status}*\n` +
      `Created: ${withdrawal.createdAt.toLocaleString()}\n`;

    if (withdrawal.status !== 'pending') {
      message += `Processed By: @${processedByUser?.username || 'Admin'}\n`;
      message += `Processed At: ${withdrawal.processedAt?.toLocaleString()}\n`;
      if (withdrawal.adminNotes) message += `Notes: ${withdrawal.adminNotes}\n`;
    }

    const keyboard = new InlineKeyboard();
    if (withdrawal.status === 'pending') {
      keyboard
        .text('✅ Process', `admin_ETB_confirm_withdrawal_${withdrawal.requestId}`)
        .text('❌ Reject', `admin_ETB_reject_withdrawal_${withdrawal.requestId}`)
        .row();
    }
    keyboard
      .text('📋 Back to List', 'admin_ETB_withdrawals')
      .text('🏠 Admin Menu', 'admin_menu');

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  } catch (error) {
      logger.error({ err: error }, 'Admin ETB withdrawal detail error:');

  }
}

export async function handleAdminETBConfirmWithdrawal(ctx: CallbackQueryContext<Context>) {
  try {
    await ctx.answerCallbackQuery({ text: 'Processing withdrawal...' });
    const requestId = sanitizeInput(ctx.match![1]);
    const adminId = sanitizeInput(ctx.from!.id);
    const admin = await User.findOne({ telegramId: parseInt(adminId) });
    if (!admin?.isAdmin) return;
    const result = await ETBWithdrawalService.processWithdrawal(requestId, admin._id);

  if (result.success) {
    await ctx.editMessageText?.(`✅ Withdrawal processed.`, {
      reply_markup: { inline_keyboard: [[{ text: '🔙 Back to Withdrawals', callback_data: 'admin_ETB_withdrawals' }]] }
    });
  } else {
    await ctx.answerCallbackQuery({ text: `❌ ${result.error}`, show_alert: true });
  }
} catch (error) {
  logger.error({ err: error }, 'Admin ETB confirm withdrawal error');
}
}

export async function handleAdminETBRejectWithdrawal(ctx: CallbackQueryContext<Context>) {
  const requestId = sanitizeInput(ctx.match![1]);
  await ctx.editMessageText?.(
    `✏️ *Reject Withdrawal*\n\nPlease enter the reason for rejection:`,
    { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🔙 Cancel', callback_data: `admin_ETB_withdrawal_${requestId}` }]] } }
  );
  ctx.session.step = `admin_ETB_reject_withdrawal_${requestId}`;
}

export async function handleAdminETBRejectWithdrawalInput(ctx: Context) {
  if (!ctx.session?.step?.startsWith('admin_ETB_reject_withdrawal_')) return;
  const requestId = sanitizeInput(ctx.session.step.replace('admin_ETB_reject_withdrawal_', ''));
  const reason = ctx.message?.text?.trim();
  if (!reason) {
    await ctx.reply('❌ Please enter a reason.');
    return;
  }
  const adminId = sanitizeInput(ctx.from!.id);
  const admin = await User.findOne({ telegramId: parseInt(adminId) });
  if (!admin?.isAdmin) {
    delete ctx.session.step;
    return;
  }
  const result = await ETBWithdrawalService.rejectWithdrawal(requestId, admin._id, reason);

  if (result.success) {
    await ctx.reply(`✅ Withdrawal rejected.`, {
      reply_markup: { inline_keyboard: [[{ text: '🔙 Back to Withdrawals', callback_data: 'admin_ETB_withdrawals' }]] }
    });
  } else {
    await ctx.reply(`❌ ${result.error}`);
  }

  delete ctx.session.step;
}