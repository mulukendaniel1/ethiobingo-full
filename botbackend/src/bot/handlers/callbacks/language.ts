// src/bot/handlers/callbacks/language.ts
import { CallbackQueryContext } from 'grammy';
import { Context } from '../../framework';
import { User } from '../../../core/database/models/User';
import { KeyboardFactory } from '../../framework/keyboards';
import { replyWithTranslation, t } from '../../utils/i18n';

export async function handleLanguageSelection(ctx: CallbackQueryContext<Context>) {
  await ctx.answerCallbackQuery();
  const lang = ctx.match?.[1] as 'en' | 'am' | 'ti' | 'om' | 'so';
  if (!lang) return;

  const user = await User.findOneAndUpdate(
    { telegramId: ctx.from!.id },
    { language: lang },
    { new: true }
  );

  if (!user) {
    await ctx.editMessageText(t('en', 'errors.user_not_found'));
    return;
  }

  ctx.state.lang = lang;

  try {
    await ctx.deleteMessage();
  } catch (e) {}

  await replyWithTranslation(ctx, 'language.changed', { lang: getLanguageName(lang) });
  await ctx.reply(t(lang, 'menu.main', { name: user.firstName, balance: user.balanceMain, coins: user.ETBCoins, earned: user.totalEarned }), {
    parse_mode: 'Markdown',
    reply_markup: KeyboardFactory.mainMenu(user.isAdmin, true, lang)
  });
}

function getLanguageName(code: string): string {
  const names: Record<string, string> = {
    en: 'English',
    am: 'አማርኛ',
    ti: 'ትግርኛ',
    om: 'Afaan Oromoo',
    so: 'Soomaali'
  };
  return names[code] || code;
}