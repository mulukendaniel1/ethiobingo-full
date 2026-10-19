// src/bot/handlers/index.ts - UPDATED
import { Bot, InlineKeyboard } from 'grammy';
import { Context } from '../framework';
import { setupCallbackHandlers } from './callbacks';
import { startCommand } from './commands/start';
import { balanceCommand } from './commands/balance';
import { menuCommand } from './commands/menu';
import { adminCommand } from './commands/admin';
import { settingsCommand } from './commands/settings';
import { ETBCoinsCommand } from './commands/ETBCoins';
import { KeyboardFactory } from '../framework/keyboards';
import { User } from '@/core/database/models/User';
import { SessionCleaner } from '@/core/utils/sessionCleaner';
import { referralService } from '@/services/referralServiceInstance';
import { auditService } from '@/services/auditService';
import { logger } from '@/core/utils/logger';
import { escapeMarkdown } from '@/core/utils/escapeMarkdown';
import { createFilterFromTarget, getBroadcastHandler, getTargetDescription } from './callbacks/enhancedBroadcast';
import { env } from '@/core/config/env';
import { playCommand } from './commands/play';
import { sanitizeInput } from '../../core/utils/security';
import { replyWithTranslation, t } from '../utils/i18n';
import { showDepositMethodSelection } from './commands/ETBDeposit';
import { showWithdrawMethodSelection } from './commands/ETBWithdraw';
import { SystemSettings } from '@/core/database/models/SystemSettings';
import { BroadcastMessage } from '@/services/broadcastService';
import { BroadcastService } from '@/services/broadcastService';
import { getSettings } from '@/core/utils/settingsCache';
import { TelegramFormatter } from '../../core/utils/messageFormatter';
import { normalizePhoneNumber } from '@/core/utils/phoneUtils';
import { PhoneAbuseLog } from '@/core/database/models/PhoneAbuseLog';

export function setupHandlers(bot: Bot<Context>) {
  
  // ==================== SETUP CALLBACK HANDLERS FIRST ====================
  setupCallbackHandlers(bot);
  
  // ==================== COMMAND HANDLERS ====================
  
  // User commands
  bot.command('start', startCommand);
  bot.command('balance', balanceCommand);
  bot.command('menu', menuCommand);
  bot.command('settings', settingsCommand);
  bot.command('ETB', ETBCoinsCommand);
  bot.command('play', playCommand);
  
  // Admin commands
  bot.command('admin', adminCommand);
  
  
  // Help command
 bot.command('help', async (ctx) => {
  await replyWithTranslation(ctx, 'help.available_commands', {}, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: t(ctx.state.lang, 'buttons.main_menu'), callback_data: 'main_menu' }],
        [{ text: t(ctx.state.lang, 'buttons.play_games'), callback_data: 'play_games' }]
      ]
    }
  });
});
  
  // ==================== MESSAGE HANDLERS ====================
  
  // Handle text messages for various flows
    bot.on('message:text', async (ctx) => {
    const text = ctx.message.text;
    const userId = ctx.from!.id;
        
    // Handle workflow-specific inputs first
    if (ctx.session.step === 'awaiting_broadcast_message') {
  const message = sanitizeInput(text);
  const adminId = sanitizeInput(ctx.from!.id);
  const admin = await User.findOne({ telegramId: parseInt(adminId) });
      
      if (!admin?.isAdmin) {
        await ctx.reply('❌ Admin access required.');
        delete ctx.session.step;
        return;
      }
      
      await ctx.reply(
        `📢 *Confirm Broadcast*\n\n` +
        `Message: ${message}\n\n` +
        `Select broadcast type:`,
        {
          parse_mode: 'Markdown' as const,
          reply_markup: {
            inline_keyboard: [
              [
                { text: '👥 All Users', callback_data: `confirm_broadcast_all_${Buffer.from(message).toString('base64')}` },
                { text: '🤑 Active Users', callback_data: `confirm_broadcast_active_${Buffer.from(message).toString('base64')}` }
              ],
              [
                { text: '📊 With Balance', callback_data: `confirm_broadcast_balance_${Buffer.from(message).toString('base64')}` },
                { text: '✅ Recent Users', callback_data: `confirm_broadcast_recent_${Buffer.from(message).toString('base64')}` }
              ],
              [{ text: '❌ Cancel', callback_data: 'admin_menu' }]
            ]
          }
        }
      );
      
      delete ctx.session.step;
      return;
    }

    // Add this condition to the message handler (after other session step checks)
if (ctx.session.step && ctx.session.step.startsWith('admin_user_notes_')) {
  const userId = sanitizeInput(ctx.session.step.replace('admin_user_notes_', ''));
  const notes = sanitizeInput(text);
  const adminId = sanitizeInput(ctx.from!.id);
  const admin = await User.findOne({ telegramId: parseInt(adminId) });
  const user = await User.findOne({ telegramId: parseInt(userId) });
  
  if (!admin?.isAdmin || !user) {
    await ctx.reply('❌ Access denied or user not found.');
    delete ctx.session.step;
    return;
  }
  
  // For now, just log the notes (you can add a notes field to User model later)
  logger.info(`Admin notes for user ${userId}: ${notes}`);
  
  // Log the action
  await auditService.logAdminAction(
    admin._id,
    parseInt(adminId),
    'USER_NOTES_ADDED',
    'SYSTEM',
    'User',
    user._id.toString(),
    { 
      notes,
      userId 
    }
  );
  
  await ctx.reply(
    `📝 *Notes Added*\n\n` +
    `User: @${user.username || user.telegramId}\n` +
    `Notes: ${escapeMarkdown(notes.substring(0, 200))}\n\n` +
    `✅ Notes have been logged in the audit trail.`,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔙 Back to User', callback_data: `admin_user_detail_${userId}` }]
        ]
      }
    }
  );
  
  // Clear session step
  delete ctx.session.step;
  return;
}

    // Handle admin search inputs
    if (ctx.session.step === 'admin_search_users') {
      const { handleAdminSearchInput } = await import('./callbacks/admin');
      await handleAdminSearchInput(ctx);
      return;
    }
    
    

    if (ctx.session.step && ctx.session.step.startsWith('admin_ban_custom_')) {
      const userId = ctx.session.step.replace('admin_ban_custom_', '');
      const { handleCustomBanInput } = await import('./callbacks/admin');
      await handleCustomBanInput(ctx, userId);
      return;
    }

    

    // After existing session steps
    if (ctx.session.step === 'awaiting_ETB_deposit_amount') {
      const { handleETBDepositAmountInput } = await import('./commands/ETBDeposit');
      await handleETBDepositAmountInput(ctx);
      return;
    }
    
   /*  if (ctx.session.step === 'awaiting_ETB_deposit_transaction_id') {
      const { handleETBDepositTransactionIdInput } = await import('./commands/ETBDeposit');
      await handleETBDepositTransactionIdInput(ctx);
      return;
    }
    if (ctx.session.step === 'awaiting_ETB_deposit_account_details') {
      const { handleETBDepositAccountDetailsInput } = await import('./commands/ETBDeposit');
      await handleETBDepositAccountDetailsInput(ctx);
      return;
    }
      */

    if (ctx.session.step === 'awaiting_ETB_deposit_receipt') {
      const { handleETBDepositReceiptInput } = await import('./commands/ETBDeposit');
      await handleETBDepositReceiptInput(ctx);
      return;
    }
    if (ctx.session.step === 'awaiting_ETB_withdraw_amount') {
      const { handleETBWithdrawAmountInput } = await import('./commands/ETBWithdraw');
      await handleETBWithdrawAmountInput(ctx);
      return;
    }
    if (ctx.session.step === 'awaiting_ETB_withdraw_destination') {
      const { handleETBWithdrawDestinationInput } = await import('./commands/ETBWithdraw');
      await handleETBWithdrawDestinationInput(ctx);
      return;
    }
    if (ctx.session.step?.startsWith('admin_ETB_reject_deposit_')) {
      const { handleAdminETBRejectDepositInput } = await import('./callbacks/ETBAdmin');
      await handleAdminETBRejectDepositInput(ctx);
      return;
    }
    if (ctx.session.step?.startsWith('admin_ETB_reject_withdrawal_')) {
      const { handleAdminETBRejectWithdrawalInput } = await import('./callbacks/ETBAdmin');
      await handleAdminETBRejectWithdrawalInput(ctx);
      return;
    }

    if (ctx.session.step === 'awaiting_custom_broadcast') {
      const text = ctx.message?.text;
      if (!text) return;

      let title = '';
      let content = '';

      // Parse title and content as before...
      const lines = text.split('\n');
      let foundTitle = false;
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.match(/^(Title|title|TITLE)[:*]?\s*(.+)/i)) {
          const match = trimmedLine.match(/^(Title|title|TITLE)[:*]?\s*(.+)/i);
          title = match ? match[2].trim() : '';
          foundTitle = true;
        } else if (trimmedLine.match(/^(Content|content|CONTENT)[:*]?\s*(.+)/i)) {
          const match = trimmedLine.match(/^(Content|content|CONTENT)[:*]?\s*(.+)/i);
          content = match ? match[2].trim() : '';
        } else if (foundTitle && !content) {
          content = trimmedLine;
        } else if (content) {
          content += '\n' + trimmedLine;
        } else if (!title && trimmedLine) {
          title = trimmedLine;
          foundTitle = true;
        }
      }

      if (!content && foundTitle) {
        const titleEndIndex = text.indexOf(title) + title.length;
        const remainingText = text.substring(titleEndIndex).trim();
        if (remainingText) content = remainingText.replace(/^[\n\s]+/, '');
      }

      if (!title && !content) {
        await ctx.reply(
          '❌ *Invalid Format*\n\n' +
          'Please send your broadcast message in one of these formats:\n\n' +
          '*Option 1 (Recommended):*\n' +
          '`Title: Your Title Here`\n' +
          '`Content: Your message here...`\n\n' +
          '*Option 2 (Simple):*\n' +
          '`Your Title Here`\n' +
          '`Your message here...`\n\n' +
          '*Example:*\n' +
          'Title: 🎉 Special Offer!\n' +
          'Content: Get 10% bonus on all tasks!',
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '🔙 Back to Templates', callback_data: 'broadcast_templates' }],
                [{ text: '❌ Cancel', callback_data: 'admin_broadcast' }]
              ]
            }
          }
        );
        return;
      }

      if (!title && content) {
        const firstLine = content.split('\n')[0];
        title = firstLine;
        content = content.substring(firstLine.length).trim();
      }

      const cleanTitle = title.replace(/[^\w\s]/g, '').trim() || 'Announcement';

      // Store in session
      ctx.session.broadcastData = {
        title: cleanTitle,
        content: content,
        type: 'announcement' as const,
        target: 'all' as const,
        channels: ['bot' as const],
        step: 'target_selection' as const,
        buttons: [
          { text: '🤖 Open Bot', url: `https://t.me/${env.BOT_USERNAME || 'ethio_bingoobot'}` },
          { text: '🆘 Contact Support', url: `https://t.me/${getSettings().supportUsername?.replace('@', '') || 'Ethiobingosupport2'}` },
          { text: '🎥 Tutorial', callback_data: 'how_it_works' }
        ]
      };

      // Instead of calling handler.selectTarget, send inline keyboard directly
      const targetDescriptions: Record<string, string> = {
        all: '👥 *All Users* - Send to every registered user',
        active: '✅ *Active Users* - Users active in last 7 days',
        balance: '🤑 *With Balance* - Users with minimum balance',
        recent: '🆕 *Recent Users* - Users joined in last 30 days',
      };

      const keyboard = new InlineKeyboard()
        .text('👥 All Users', `broadcast_target_all`)
        .text('✅ Active Users', `broadcast_target_active`)
        .row()
        .text('🤑 With Balance', `broadcast_target_balance`)
        .text('🆕 Recent Users', `broadcast_target_recent`)
        .row()
        .text('❌ Cancel', 'admin_broadcast');

      await ctx.reply(
        `🎯 *Select Target Audience*\n\n` +
        `Your broadcast is ready. Now choose who should receive it:`,
        {
          parse_mode: 'Markdown',
          reply_markup: keyboard,
        }
      );

      delete ctx.session.step;
      return;
    }

    if (ctx.session.step === 'awaiting_schedule_time') {
      const input = sanitizeInput(text);
      if (input.toLowerCase() === 'cancel') {
        delete ctx.session.step;
        delete ctx.session.pendingSchedule;
        await ctx.reply('❌ Scheduling cancelled.');
        return;
      }

      let scheduleTime: Date;
      try {
        // You need to import the parseScheduleInput function (from enhancedBroadcast or define here)
        // For now, we'll inline a simple parser or import from a shared utility.
        // I'll assume we have a function `parseScheduleInput` available.
        const { parseScheduleInput } = await import('./callbacks/enhancedBroadcast');
        scheduleTime = parseScheduleInput(input);
      } catch (err: any) {
        await ctx.reply(`❌ ${err.message}\n\nPlease try again or send "cancel".`);
        return;
      }

      const broadcastData = ctx.session.broadcastData;
      const pending = ctx.session.pendingSchedule;
      if (!broadcastData || !pending) {
        await ctx.reply('❌ Broadcast data not found. Please start over.');
        delete ctx.session.step;
        delete ctx.session.pendingSchedule;
        return;
      }

      const userId = sanitizeInput(ctx.from!.id);
      const user = await User.findOne({ telegramId: parseInt(userId) });
      if (!user?.isAdmin) {
        await ctx.reply('❌ Admin access required.');
        delete ctx.session.step;
        return;
      }
      const broadcastService = new BroadcastService();

      // Normalize channels
      let channels: ('bot' | 'channel')[];
      if (pending.channel === 'both') {
        channels = ['bot', 'channel'];
      } else {
        channels = [pending.channel as 'bot' | 'channel'];
      }

      const message: BroadcastMessage = {
        title: broadcastData.title,
        content: broadcastData.content,
        type: broadcastData.type,
        target: pending.target as any,
        channels,
      };

      const filter = createFilterFromTarget(pending.target); // You'll need to define or import this helper

      const jobId = await broadcastService.scheduleBroadcast(
        message,
        scheduleTime,
        filter,
        user._id,
        parseInt(userId)
      );

      await ctx.reply(
        `✅ *Broadcast Scheduled*\n\n` +
        `Title: ${message.title}\n` +
        `Target: ${getTargetDescription(pending.target)}\n` +
        `Channels: ${channels.join(', ')}\n` +
        `Scheduled for: ${scheduleTime.toLocaleString()}\n\n` +
        `Job ID: \`${jobId}\``,
        { parse_mode: 'Markdown' }
      );

      delete ctx.session.step;
      delete ctx.session.pendingSchedule;
      delete ctx.session.broadcastData;
      return;
    }


    if (ctx.session.step && ctx.session.step.startsWith('admin_adjust_balance_')) {
      const userId = sanitizeInput(ctx.session.step.replace('admin_adjust_balance_', ''));
      const amountText = sanitizeInput(ctx.message.text.trim());

      
      // Parse amount (can be +5.00, -2.50, or just 5)
      let amount = parseFloat(amountText);
      
      if (isNaN(amount)) {
        await ctx.reply('❌ Invalid amount. Please enter a valid number (e.g., +5.00, -2.50, or 5)');
        return;
      }
      
       
      const adminId = sanitizeInput(ctx.from!.id);
      const admin = await User.findOne({ telegramId: parseInt(adminId) });
      const user = await User.findOne({ telegramId: parseInt(userId) });
      
      if (!admin?.isAdmin || !user) {
        await ctx.reply('❌ Access denied or user not found.');
        delete ctx.session.step;
        return;
      }
      
      // Update user balance
      const oldBalance = user.ETBCoins;
      user.ETBCoins += amount;
      await user.save();
      
      // Log the action
      await auditService.logAdminAction(
        admin._id,
        parseInt(adminId),
        'USER_BALANCE_ADJUSTED',
        'FINANCIAL',
        'User',
        user._id.toString(),
        { 
          oldBalance, 
          newBalance: user.ETBCoins,
          adjustment: amount,
          userId 
        }
      );
      
      await ctx.reply(
        `✅ Balance adjusted successfully!\n\n` +
        `User: @${user.username || user.telegramId}\n` +
        `Old Balance: ${oldBalance.toFixed(2)}ETB\n` +
        `Adjustment: ${amount >= 0 ? '+' : ''}${amount.toFixed(2)}ETB\n` +
        `New Balance: ${user.ETBCoins.toFixed(2)}ETB`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔙 Back to User', callback_data: `admin_user_detail_${userId}` }]
            ]
          }
        }
      );
      
      // Clear session step
      delete ctx.session.step;
      return;
    }
    
    // ==================== REPLY KEYBOARD NAVIGATION ====================
    // Handle reply keyboard button clicks
    switch (text) {
      // ===== Open Bingo =====
      case '🚀 Open Bingo':
      case '🚀 ጨዋታ ጀምር':     // Amharic
      case '🚀 ጸወታ ጀምር':     // Tigrinya
      case '🚀 Taphachuu':      // Oromo
      case '🚀 Ciyaar':          // Somali
      case '🚀':                 // icon only
        await playCommand(ctx as any);
        break;

      // ===== BALANCE =====
      case '🤑 Balance':
      case '🤑 ቀሪ ሂሳብ':       // Amharic
      case '🤑 ቀሪ ሒሳብ':       // Tigrinya
      case '🤑 Maallaqa':        // Oromo
      case '🤑 Haraaga':         // Somali
      case '🤑':                 // icon only
        await balanceCommand(ctx as any);
        break;

      // ===== DEPOSIT =====
      case '⬇️ Deposit':
      case '⬇️ ብር ያስገቡ':      // Amharic
      case '⬇️ መዝለፍ':          // Tigrinya
      case '⬇️ Kuusannaa':       // Oromo
      case '⬇️ Keyd':            // Somali
      case '⬇️':                 // icon only
        await showDepositMethodSelection(ctx);
        break;

      // ===== WITHDRAW =====
      case '⬆️ Withdraw':
      case '⬆️ ወጪ':             // Amharic
      case '⬆️ ምውጻእ':          // Tigrinya
      case '⬆️ Baafachuu':       // Oromo
      case '⬆️ Lacag Kadhig':    // Somali
      case '⬆️':                 // icon only
        await showWithdrawMethodSelection(ctx);
        break;

      // ===== LANGUAGE =====
      case '🇪🇹 Language':
      case '🇪🇹 ቋንቋ':           // Amharic & Tigrinya (same word)
      case '🇪🇹 Afaan':           // Oromo
      case '🇪🇹 Luqad':           // Somali
      case '🇪🇹':                 // icon only
        await showLanguageSelection(ctx);
        break;

      // ===== REFERRAL =====
      case '👥 Referral':
      case '👥 ጓደኛ ለመጋበዝ':
      case '👥 ምልላይ':
      case '👥 Tumsa':
      case '👥 Tixraac':
      case '👥':
        const userForReferral = await User.findOne({ telegramId: userId });
        if (userForReferral) {
          const settings = await SystemSettings.findOne({ key: 'referral_bonus_amount' });
          const referralStats = await referralService.getUserReferralStats(userForReferral._id);
          const referralLink = `https://t.me/${ctx.me.username}?start=ref_${userForReferral.referralCode}`;
          
          const message = t(ctx.state.lang, 'referral.share_link', { link: referralLink }) + '\n\n' +
            t(ctx.state.lang, 'referral.stats', {
              code: userForReferral.referralCode,
              count: referralStats?.referralCount || 0,
              earnings: (referralStats?.referralEarnings || 0).toFixed(2)
            });
          
          await ctx.reply(message, { parse_mode: 'Markdown' });
        }
        break;

      // ===== Agent =====
      case '👤 Agent':
      case '👤 ኤጀንት ለመሆን':
      case '👤 ወኪል ኩን':
      case '👤 Agent ta\'i':
      case '👤 Wakiil noqo':
      case '👤':
        await ctx.reply(
          t(ctx.state.lang, 'agent.become_agent'),
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: t(ctx.state.lang, 'buttons.confirm'), callback_data: 'be_agent' }],
                [{ text: t(ctx.state.lang, 'buttons.cancel'), callback_data: 'settings' }]
              ]
            }
          }
        );
        break;

      // ===== HELP =====
      case '🆘 Help':
      case '🆘 አርዳታ':
      case '🆘 ሓገዝ':
      case '🆘 Gargaarsa':
      case '🆘 Caawi':
      case '🆘':
        const supportLink = TelegramFormatter.formatUsernameAsLink('@Ethiobingosupport2');
        await ctx.reply(
          t(ctx.state.lang, 'help.support_short', { support_link: supportLink }),
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: t(ctx.state.lang, 'help.buttons.how_it_works'), callback_data: 'help_menu' }],
                [{ text: t(ctx.state.lang, 'help.buttons.contact_support'), url: 'https://t.me/Ethiobingosupport2' }],
                [{ text: t(ctx.state.lang, 'buttons.main_menu'), callback_data: 'main_menu' }]
              ]
            }
          }
        );
        break;

      // ===== ADMIN =====
      case '♦️ Admin':
      case '♦️ አስተዳዳሪ':
      case '♦️ ኣስተዳደር':
      case '♦️ Bulchaa':
      case '♦️ Maamul':
      case '♦️':
        const adminUser = await User.findOne({ telegramId: userId });
        if (adminUser?.isAdmin) {
          await adminCommand(ctx as any);
        } else {
          await ctx.reply(t(ctx.state.lang, 'errors.admin_access'));
        }
        break;

      // ===== SETTINGS =====
      case '⚙️ Settings':
      case '⚙️ ቅንብሮች':        // Amharic
      case '⚙️ ኣቀማምጣ':        // Tigrinya
      case '⚙️ Sajoo':           // Oromo
      case '⚙️ Dejinta':         // Somali
      case '⚙️':                 // icon only
        await settingsCommand(ctx);
        break;

      // ===== MAIN MENU (explicit) =====
      case '🏠 Main Menu':
      case '🏠 ዋና ምናሌ':        // Amharic
      case '🏠 ቀንዲ ምናሌ':      // Tigrinya
      case '🏠 Baafata Guddaa':  // Oromo
      case '🏠 Menu-ka Guud':    // Somali
      case '🏠':                 // icon only
        await menuCommand(ctx as any);
        break;

      // Legacy / extra buttons
      case '🤑 Check Balance':
        await balanceCommand(ctx as any);
        break;

      // Default
      default:
  if (text.startsWith('/')) return;
  await replyWithTranslation(ctx, 'help.unhandled_message', {}, {
    reply_markup: KeyboardFactory.mainMenu(false, true, ctx.state.lang)
  });
    }
  });
  
  bot.on('message:contact', async (ctx) => {
  const userId = ctx.from!.id;
  const rawPhone = ctx.message.contact.phone_number;
  const normalizedPhone = normalizePhoneNumber(rawPhone);

  // Block forged contact cards – number must belong to sender
  if (ctx.message.contact.user_id && ctx.message.contact.user_id !== userId) {
    await ctx.reply('❌ Please share your own phone number using the button below.');
    return;
  }

  const user = await User.findOne({ telegramId: userId });
  if (!user) {
    await ctx.reply('❌ Please use /start first.');
    return;
  }

  const requestedAt = ctx.session.phoneRequestedAt;
  const secondsSinceRequest = requestedAt ? (Date.now() - requestedAt) / 1000 : null;
  delete ctx.session.phoneRequestedAt;

  if (!user.phoneNumber) {
    let claimed = false;
    try {
      const claimResult = await User.findOneAndUpdate(
        { _id: user._id, phoneNumber: null },
        { $set: { phoneNumber: normalizedPhone } },
        { new: true }
      );
      claimed = !!claimResult;
    } catch (err: any) {
      if (err.code === 11000) {
        const owner = await User.findOne({ phoneNumber: normalizedPhone }).select('telegramId').lean();
        await PhoneAbuseLog.create({
          normalizedPhone,
          attemptedByTelegramId: userId,
          existingOwnerTelegramId: owner?.telegramId,
          secondsSinceStart: secondsSinceRequest ?? undefined
        });
        await User.updateOne(
          { _id: user._id },
          { $inc: { riskScore: 25 }, $addToSet: { riskFlags: 'duplicate_phone_number' } }
        );
        await ctx.reply('❌ This phone number is already linked to another account. Please use a different number or contact support.');
        return;
      }
      throw err;
    }

    if (claimed) {
      // Speed heuristic
      if (secondsSinceRequest !== null && secondsSinceRequest < 2) {
        await User.updateOne(
          { _id: user._id },
          { $inc: { riskScore: 10 }, $addToSet: { riskFlags: 'fast_contact_share' } }
        );
      }

      // Award phone bonus
      const settings = await SystemSettings.findOne({ key: 'phone_bonus_enabled' });
      const bonusEnabled = settings?.value === true;
      if (bonusEnabled) {
        const amountDoc = await SystemSettings.findOne({ key: 'phone_bonus_amount' });
        const bonusAmount = amountDoc?.value ?? 10;
        if (bonusAmount > 0) {
          const shouldRearm = (user.totalConfirmedDepositsETB || 0) < 200;
          const update: any = {
            $inc: {
              lockedBalance: bonusAmount,
              bonusBalance: bonusAmount,
              ETBCoins: bonusAmount
            },
            $push: {
              ETBCoinTransactions: {
                type: 'earned',
                amount: bonusAmount,
                reference: `PHONE-BONUS-${Date.now()}`,
                notes: `Phone number verification bonus`,
                timestamp: new Date()
              }
            }
          };
          if (shouldRearm) update.$set = { isAbuser: true };
          await User.findByIdAndUpdate(user._id, update);
          await ctx.reply(`🎉 *Bonus!* You received ${bonusAmount} ETB for verifying your phone number. You can be used to Open Bingo.`);
        }
      }

      // Award referral bonus if pending
      if (ctx.session.pendingReferralCode) {
        const referrerCode = ctx.session.pendingReferralCode;
        delete ctx.session.pendingReferralCode;
        await referralService.awardReferralBonusAfterPhoneVerification(user._id, referrerCode);
      }
    }
  }

  const freshUser = await User.findById(user._id);
  if (!freshUser) return;

  ctx.session.cachedUser = {
    _id: freshUser._id.toString(),
    telegramId: freshUser.telegramId,
    isAdmin: freshUser.isAdmin,
    isBanned: freshUser.isBanned,
    banReason: freshUser.banReason,
    phoneNumber: freshUser.phoneNumber,
    firstName: freshUser.firstName,
    username: freshUser.username,
    language: freshUser.language || 'en',
    lastLoginAt: freshUser.lastLoginAt?.toISOString()
  };
  ctx.session.menuExpanded = true;

  await ctx.reply(
    `✅ *Phone Number Saved!*\n\nWelcome, ${freshUser.firstName}!`,
    { parse_mode: 'Markdown', reply_markup: KeyboardFactory.mainMenu(freshUser.isAdmin, true, ctx.state.lang) }
  );
});
  // Handle any other message types
  bot.on(['message:photo', 'message:document', 'message:video'], async (ctx) => {
    await ctx.reply('📎 I can only process text messages. Please use buttons or type commands.');
  });

  async function showLanguageSelection(ctx: Context) {
  const keyboard = new InlineKeyboard()
    .text('English 🇬🇧', 'lang_en')
    .text('አማርኛ 🇪🇹', 'lang_am')
    .row()
    .text('ትግርኛ 🇪🇹', 'lang_ti')
    .text('Afaan Oromoo 🇪🇹', 'lang_om')
    .row()
    .text('Soomaali 🇪🇹', 'lang_so')
    .row()
    .text(t(ctx.state.lang, 'buttons.back'), 'settings');

  await replyWithTranslation(ctx, 'language.select', {}, { reply_markup: keyboard });
}
  
}