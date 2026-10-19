// src/bot/utils/messageFormatter.ts
import { UrlFormatter } from '../../core/utils/urlFormatter';

export class MessageFormatter {
  
  /**
   * Format support contact information
   */
  static formatSupportContact(parseMode: 'Markdown' | 'HTML' = 'Markdown'): string {
    const supportUsername = 'Ethiobingosupport2';
    const supportUrl = `https://t.me/${supportUsername}`;
    
    switch (parseMode) {
      case 'HTML':
        return `For assistance, contact <a href="${supportUrl}">@${supportUsername}</a>`;
        
      case 'Markdown':
      default:
        return `For assistance, contact [@${supportUsername}](${supportUrl})`;
    }
  }
  
  /**
   * Format message with proper URL handling
   */
  static formatMessage(message: string, parseMode: 'Markdown' | 'HTML' = 'Markdown'): string {
    if (!message) return '';
    
    // Find and format Telegram URLs
    const telegramUrlPattern = /(?:https?:\/\/)?(?:t\.me|telegram\.me|telegram\.dog)\/([a-zA-Z0-9_]+)/gi;
    
    return message.replace(telegramUrlPattern, (match, username) => {
      const url = match.startsWith('http') ? match : `https://t.me/${username}`;
      return UrlFormatter.formatUrlForTelegram(url, `@${username}`, parseMode);
    });
  }
  
  /**
   * Get support button
   */
  static getSupportButton(): any {
    return UrlFormatter.createContactButton('Ethiobingosupport2', '🆘 Contact Support');
  }
  
  /**
   * Create inline keyboard with support button
   */
  static createSupportKeyboard(): any {
    return {
      inline_keyboard: [
        [UrlFormatter.createContactButton('Ethiobingosupport2', '🆘 Contact Support')],
        [{ text: '🏠 Main Menu', callback_data: 'main_menu' }]
      ]
    };
  }
}

export class TelegramFormatter {
    /**
     * Format Telegram username for display in Markdown
     */
    static formatUsernameForDisplay(username: string): string {
        if (!username) return '';
        
        // Remove @ if present
        const cleanUsername = username.replace('@', '');
        
        // Escape underscores for Markdown
        return cleanUsername.replace(/_/g, '\\_');
    }
    
    /**
     * Format Telegram username as clickable link
     */
    static formatUsernameAsLink(username: string, displayText?: string): string {
        if (!username) return '';
        
        const cleanUsername = username.replace('@', '');
        const display = displayText || `@${cleanUsername}`;
        const url = `https://t.me/${cleanUsername}`;
        
        return `[${display}](${url})`;
    }
    
    /**
     * Create inline keyboard button for Telegram contact
     */
    static createContactButton(username: string, buttonText = '📞 Contact Support'): any {
        const cleanUsername = username.replace('@', '');
        return {
            text: buttonText,
            url: `https://t.me/${cleanUsername}`
        };
    }
}