// src/bot/handlers/commands/admin.ts
import { Context } from '../../framework';
import { User } from '../../../core/database/models/User';
import { NotificationService } from '../../../services/notificationService';
import { KeyboardFactory } from '../../framework/keyboards';
import { logger } from '../../../core/utils/logger';
import { Types } from 'mongoose';
import { Operator } from '../../../core/database/models/Operator';
import { sanitizeInput } from '../../../core/utils/security';
import { t, replyWithTranslation } from '../../utils/i18n';

// Main owner email – restrict pause/resume to this admin only
const MAIN_ADMIN_EMAIL = 'ethiogames.ethiogames@gmail.com,amanuelababu19@gmail.com';

async function getAdminUserObjectId(telegramId: number): Promise<Types.ObjectId | null> {
  const user = await User.findOne({ telegramId });
  return user?._id || null;
}

export async function adminCommand(ctx: Context) {
  const telegramId = sanitizeInput(ctx.from!.id);
  const lang = ctx.state.lang;
  const user = await User.findOne({ telegramId: parseInt(telegramId) });
  
  if (!user?.isAdmin) {
    return await replyWithTranslation(ctx, 'errors.admin_access');
  }
  
  const stats = await getAdminStats();
  
  const message = t(lang, 'admin.dashboard', {
    totalUsers: stats.totalUsers,
    activeUsers: stats.activeUsers,
    time: new Date().toLocaleTimeString()
  });
  
  await ctx.reply(message, {
    parse_mode: 'Markdown' as const,
    reply_markup: KeyboardFactory.adminDashboard(lang)
  });
}

export async function togglePauseCommand(ctx: Context) {
  const telegramId = sanitizeInput(ctx.from!.id);
  const lang = ctx.state.lang;
  logger.info(`togglePauseCommand triggered by user ${telegramId}`);

  try {
    const admin = await User.findOne({ telegramId: parseInt(telegramId) });
    if (!admin?.isAdmin) {
      logger.warn(`Non-admin user ${telegramId} attempted to toggle pause`);
      return replyWithTranslation(ctx, 'errors.admin_access');
    }

    // ✅ Restrict to main owner only
    if (admin.email !== MAIN_ADMIN_EMAIL) {
      logger.warn(`Admin ${admin.email} (${telegramId}) attempted to toggle pause – not authorized`);
      await ctx.reply('❌ *Access Denied*\n\nOnly the main system owner can pause/resume the bot.', { parse_mode: 'Markdown' });
      return;
    }

    const operator = await Operator.findOne({ operatorId: 'ethio_bingoobot' });
    if (!operator) {
      logger.error('Operator "ethio_bingoobot" not found in database');
      return replyWithTranslation(ctx, 'errors.operator_not_found');
    }

    logger.info(`Current operator state: isActive=${operator.isActive}`);

    operator.isActive = !operator.isActive;
    await operator.save();

    logger.info(`Operator state toggled to: isActive=${operator.isActive}`);

    const statusText = operator.isActive ? t(lang, 'admin.status_enabled') : t(lang, 'admin.status_disabled');
    await ctx.reply(
      t(lang, 'admin.pause_status', { status: statusText }),
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    logger.error('Error in togglePauseCommand:', error);
    await replyWithTranslation(ctx, 'errors.general');
  }
}

async function getAdminStats() {
  const [totalUsers, activeUsers] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ lastLoginAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }),
  ]);
  return { totalUsers, activeUsers };
}