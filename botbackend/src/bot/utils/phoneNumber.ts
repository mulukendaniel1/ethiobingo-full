//src\bot\utils\phoneNumber.ts
import { Context } from '../framework';
import { Keyboard } from 'grammy';
import { replyWithTranslation, t } from './i18n';

export async function sendPhoneNumberRequest(ctx: Context) {
  ctx.session.phoneRequestedAt = Date.now();
  const keyboard = new Keyboard()
    .requestContact('📱 ' + t(ctx.state.lang, 'buttons.share_phone')) // add "buttons.share_phone" to your JSON
    .resized()
    .oneTime();

  await replyWithTranslation(ctx, 'errors.phone_required', {}, {
    parse_mode: 'Markdown',
    reply_markup: keyboard
  });
}