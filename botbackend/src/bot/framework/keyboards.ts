// src/bot/framework/keyboards.ts
import { InlineKeyboard, Keyboard } from 'grammy';
import { t, Language } from '../../services/translationService';
import { getSettings } from '@/core/utils/settingsCache';

export class KeyboardFactory {
  
  // MAIN MENU - already translated
  static mainMenu(isAdmin = false, expanded = true, lang: Language = 'en'): any {
    const getText = (key: string) => t(lang, `buttons.${key}`);

    if (expanded) {
      const buttons = [];
      buttons.push([{ text: getText('play_games') }, { text: getText('balance') }]);
      buttons.push([{ text: getText('deposit') }, { text: getText('withdraw') }]);
      if (isAdmin) {
        buttons.push([{ text: getText('admin') }, { text: getText('language') }]);
      } else {
        buttons.push([{ text: getText('referral') }, { text: getText('language') }]);
      }
      buttons.push([{ text: getText('help') }]);
      return {
        keyboard: buttons,
        resize_keyboard: true,
        one_time_keyboard: false,
        selective: false
      };
    } else {
      // compact layout – icons only, no translation needed
      const buttons = [];
      if (isAdmin) {
        buttons.push([{ text: '❇️' }]);
        buttons.push([{ text: '🤑' }, { text: '⚙️' }]);
        buttons.push([{ text: '⬇️' }, { text: '⬆️' }]);
        buttons.push([{ text: '♦️' }, { text: '🇪🇹' }]);
        buttons.push([{ text: '🆘' }]);
      } else {
        buttons.push([{ text: '❇️' }]);
        buttons.push([{ text: '🤑' }, { text: '⚙️' }]);
        buttons.push([{ text: '⬇️' }, { text: '⬆️' }]);
        buttons.push([{ text: '👥' }, { text: '🇪🇹' }]);
        buttons.push([{ text: '🆘' }]);
      }
      return {
        keyboard: buttons,
        resize_keyboard: true,
        one_time_keyboard: false,
        selective: false
      };
    }
  }
  
  static settingsMenu(lang: Language = 'en'): any {
    const getText = (key: string) => t(lang, `buttons.${key}`);
    return {
      keyboard: [
        [{ text: getText('referral') }, { text: getText('etb_coins') }],
        [{ text: getText('main_menu') }]
      ],
      resize_keyboard: true,
      one_time_keyboard: false,
      selective: false
    };
  }
  
  static adminMenuNative(lang: Language = 'en'): any {
    const getText = (key: string) => t(lang, `buttons.${key}`);
    return {
      keyboard: [
        [{ text: getText('stats') }, { text: getText('users') }],
        [{ text: getText('broadcast') }, { text: getText('controls') }],
        [{ text: getText('main_menu') }]
      ],
      resize_keyboard: true,
      one_time_keyboard: false,
      selective: false
    };
  }
  
  static helpMenuNative(lang: Language = 'en'): any {
    const getText = (key: string) => t(lang, `buttons.${key}`);
    return {
      keyboard: [
        [{ text: getText('account_issues') }, { text: getText('referral_system') }],
        [{ text: getText('support') }, { text: getText('news') }],
        [{ text: getText('main_menu') }]
      ],
      resize_keyboard: true,
      one_time_keyboard: false,
      selective: false
    };
  }
  
  static balanceMenu(balance: number, hasAddress: boolean, hasTelebirr: boolean, lang: Language = 'en'): any {
    const getText = (key: string) => t(lang, `buttons.${key}`);
    const buttons = [];
    buttons.push([{ text: getText('settings') }, { text: getText('main_menu') }]);
    return {
      keyboard: buttons,
      resize_keyboard: true,
      one_time_keyboard: false,
      selective: false
    };
  }
  
  static referralMenu(lang: Language = 'en'): any {
    const getText = (key: string) => t(lang, `buttons.${key}`);
    return {
      keyboard: [
        [{ text: getText('stats') }, { text: getText('share_link') }],
        [{ text: getText('my_referrals') }, { text: getText('earnings') }],
        [{ text: getText('settings') }, { text: getText('main_menu') }]
      ],
      resize_keyboard: true,
      one_time_keyboard: false,
      selective: false
    };
  }
  
  static ETBCoinsMenu(lang: Language = 'en'): any {
    const getText = (key: string) => t(lang, `buttons.${key}`);
    return {
      keyboard: [
        [{ text: getText('etb_balance') }, { text: getText('transactions') }],
        [{ text: getText('earn_more') }, { text: getText('convert') }],
        [{ text: getText('settings') }, { text: getText('main_menu') }]
      ],
      resize_keyboard: true,
      one_time_keyboard: false,
      selective: false
    };
  }
  
  static removeKeyboard(): any {
    return { remove_keyboard: true, selective: false };
  }
  
  static forceReply(placeholder = 'Type your response...'): any {
    return { force_reply: true, input_field_placeholder: placeholder, selective: true };
  }
  
  // ===================== INLINE KEYBOARDS =====================
  
  static menuToggleInline(menuExpanded: boolean, lang: Language = 'en'): InlineKeyboard {
    const getText = (key: string) => t(lang, `buttons.${key}`);
    return new InlineKeyboard()
      .text(
        menuExpanded ? getText('compact_menu') : getText('expanded_menu'),
        `toggle_menu_${menuExpanded ? 'min' : 'full'}`
      )
      .row()
      .text(getText('refresh'), 'refresh_menu')
      .text(getText('help'), 'help_menu');
  }
  
  static adminDashboard(lang: Language = 'en'): InlineKeyboard {
    const getText = (key: string) => t(lang, `buttons.${key}`);
    return new InlineKeyboard()
      .text(getText('stats'), 'admin_stats')
      .text(getText('users'), 'admin_users')
      .row()
      .text(getText('broadcast'), 'admin_broadcast')
      .text(getText('controls'), 'admin_controls')
      .row()
      .text(getText('etb_deposits'), 'admin_ETB_deposits')
      .text(getText('etb_withdrawals'), 'admin_ETB_withdrawals')
      .row()
      .text(getText('pause_game'), 'admin_togglepause')
      .text(getText('main_menu'), 'main_menu');
  }
  
  static adminMenu(lang: Language = 'en'): InlineKeyboard {
    const getText = (key: string) => t(lang, `buttons.${key}`);
    return new InlineKeyboard()
      .text(getText('stats'), 'admin_stats')
      .text(getText('users'), 'admin_users')
      .row()
      .text(getText('etb_deposits'), 'admin_ETB_deposits')
      .text(getText('etb_withdrawals'), 'admin_ETB_withdrawals')
      .row()
      .text(getText('broadcast'), 'admin_broadcast')
      .text(getText('controls'), 'admin_controls')
      .row()
      .text(getText('pause_game'), 'admin_togglepause')
      .text(getText('main_menu'), 'main_menu');
  }
  
  static adminControls(lang: Language = 'en'): InlineKeyboard {
    const getText = (key: string) => t(lang, `buttons.${key}`);
    return new InlineKeyboard()
      .text(getText('restart'), 'admin_restart')
      .text(getText('clear_cache'), 'admin_clear_cache')
      .row()
      .text(getText('add_accounts'), 'admin_add_accounts')
      .text(getText('restart_history'), 'admin_restart_history')
      .row()
      .text(getText('back_to_admin'), 'admin_menu');
  }
  
  static balanceActions(balance: number, hasAddress: boolean, hasTelebirr: boolean, lang: Language = 'en'): InlineKeyboard {
    const getText = (key: string) => t(lang, `buttons.${key}`);
    return new InlineKeyboard()
      .text(getText('settings'), 'settings')
      .row()
      .text(getText('main_menu'), 'main_menu');
  }
  
  static settingsInlineMenu(hasAddress: boolean, currentThreshold: number, hasTelebirr: boolean, lang: Language = 'en'): InlineKeyboard {
    const getText = (key: string) => t(lang, `buttons.${key}`);
    const keyboard = new InlineKeyboard()
      .text(getText('referral_stats'), 'referral_stats')
      .row();
    if (getSettings().etbCoinEnabled) {
      keyboard.text(getText('etb_coins'), 'ETB_balance');
      keyboard.row();
    }
    keyboard.text(getText('back'), 'main_menu');
    return keyboard;
  }
  
  static referralStatsInline(lang: Language = 'en'): InlineKeyboard {
    const getText = (key: string) => t(lang, `buttons.${key}`);
    return new InlineKeyboard()
      .text(getText('stats'), 'referral_stats')
      .text(getText('share_link'), 'share_referral')
      .row()
      .text(getText('my_referrals'), 'my_referrals')
      .text(getText('earnings'), 'referral_earnings')
      .row()
      .text(getText('back'), 'settings')
      .text(getText('main_menu'), 'main_menu');
  }
  
  static confirmation(action: 'done' | 'cancel' | 'payout' | 'approve' | 'reject', id: string, lang: Language = 'en'): InlineKeyboard {
    const getText = (key: string) => t(lang, `buttons.${key}`);
    const labels = {
      done: { yes: getText('yes_done'), no: getText('continue') },
      cancel: { yes: getText('yes_cancel'), no: getText('keep') },
      payout: { yes: getText('confirm'), no: getText('cancel') },
      approve: { yes: getText('approve'), no: getText('cancel') },
      reject: { yes: getText('reject'), no: getText('cancel') }
    };
    return new InlineKeyboard()
      .text(labels[action].yes, `confirm_${action}_${id}`)
      .text(labels[action].no, `back_${action}_${id}`);
  }
  
  static myJobsInline(jobs: Array<{jobId: string, status: string}>, lang: Language = 'en'): InlineKeyboard {
    const getText = (key: string) => t(lang, `buttons.${key}`);
    const keyboard = new InlineKeyboard()
      .text(getText('refresh'), 'refresh_jobs')
      .row()
      .text(getText('balance'), 'balance')
      .text(getText('main_menu'), 'main_menu');
    return keyboard;
  }
  
  static ETBCoinsInline(lang: Language = 'en'): InlineKeyboard {
    const getText = (key: string) => t(lang, `buttons.${key}`);
    return new InlineKeyboard()
      .text(getText('transactions'), 'ETB_transactions')
      .text(getText('earn_more'), 'ETB_earn_more')
      .row()
      .text(getText('back'), 'settings')
      .text(getText('main_menu'), 'main_menu');
  }
  
  static backInlineButton(target: string, lang: Language = 'en'): InlineKeyboard {
    const getText = (key: string) => t(lang, `buttons.${key}`);
    return new InlineKeyboard().text(getText('back'), target);
  }
  
  static restartConfirmation(lang: Language = 'en'): InlineKeyboard {
    const getText = (key: string) => t(lang, `buttons.${key}`);
    return new InlineKeyboard()
      .text(getText('confirm'), 'confirm_restart')
      .text(getText('cancel'), 'admin_controls')
      .row()
      .text(getText('soft_restart'), 'admin_soft_restart')
      .text(getText('restart_history'), 'admin_restart_history');
  }
  
  static adminBroadcastConfirm(message: string, type: 'all' | 'active' | 'balance' | 'recent', lang: Language = 'en'): any {
    const getText = (key: string) => t(lang, `buttons.${key}`);
    const encodedMessage = Buffer.from(message).toString('base64');
    return {
      inline_keyboard: [
        [{ text: getText('confirm_to').replace('{{type}}', type), callback_data: `confirm_broadcast_${type}_${encodedMessage}` }],
        [{ text: getText('cancel'), callback_data: 'admin_menu' }]
      ]
    };
  }
  
  static yesNoConfirmation(yesCallback: string, noCallback: string, lang: Language = 'en'): InlineKeyboard {
    const getText = (key: string) => t(lang, `buttons.${key}`);
    return new InlineKeyboard()
      .text(getText('yes'), yesCallback)
      .text(getText('no'), noCallback);
  }
  
  // UTILITY METHODS
  static createInlineKeyboard(buttons: Array<Array<{ text: string; callback_data: string }>>): InlineKeyboard {
    const keyboard = new InlineKeyboard();
    for (const row of buttons) {
      for (const button of row) {
        keyboard.text(button.text, button.callback_data);
      }
      keyboard.row();
    }
    return keyboard;
  }
  
  static toggleMenuKeyboard(isExpanded: boolean, isAdmin: boolean, lang: Language = 'en'): any {
    return this.mainMenu(isAdmin, !isExpanded, lang);
  }
  
  static getContextMenu(context: string, isAdmin: boolean, userData?: any, lang: Language = 'en'): any {
    switch (context) {
      case 'main': return this.mainMenu(isAdmin, true, lang);
      case 'settings': return this.settingsMenu(lang);
      case 'admin': return this.adminMenuNative(lang);
      case 'help': return this.helpMenuNative(lang);
      case 'referral': return this.referralMenu(lang);
      case 'ETB': return this.ETBCoinsMenu(lang);
      default: return this.mainMenu(isAdmin, true, lang);
    }
  }
}