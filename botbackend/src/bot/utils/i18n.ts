// src/bot/utils/i18n.ts
import { Context } from '../framework';
import { t } from '../../services/translationService';

export async function replyWithTranslation(
  ctx: Context,
  key: string,
  replacements?: Record<string, string | number>,
  extra?: Parameters<typeof ctx.reply>[1]
) {
  const text = t(ctx.state?.lang, key, replacements);
  return ctx.reply(text, extra);
}

export { t };