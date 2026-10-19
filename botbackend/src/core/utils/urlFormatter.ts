// src/core/utils/urlFormatter.ts
export class UrlFormatter {
  
  /**
   * Format URLs for Telegram Markdown/HTML
   */
  static formatUrlForTelegram(url: string, label?: string, parseMode: 'Markdown' | 'HTML' = 'Markdown'): string {
    if (!url) return '';
    
    const cleanUrl = url.trim();
    
    switch (parseMode) {
      case 'HTML':
        const displayLabel = label || this.extractUsernameFromUrl(cleanUrl) || cleanUrl;
        return `<a href="${cleanUrl}">${displayLabel}</a>`;
        
      case 'Markdown':
      default:
        const displayText = label || this.extractUsernameFromUrl(cleanUrl) || cleanUrl;
        // Escape underscores in Markdown
        const escapedUrl = this.escapeMarkdown(cleanUrl);
        const escapedLabel = this.escapeMarkdown(displayText);
        return `[${escapedLabel}](${escapedUrl})`;
    }
  }
  
  /**
   * Extract username from Telegram URL
   */
  static extractUsernameFromUrl(url: string): string | null {
    if (!url) return null;
    
    const telegramPattern = /(?:https?:\/\/)?(?:t\.me|telegram\.me|telegram\.dog)\/([a-zA-Z0-9_]+)/i;
    const match = url.match(telegramPattern);
    
    if (match && match[1]) {
      return `@${match[1]}`;
    }
    
    return null;
  }
  
  /**
   * Escape special characters for Markdown
   */
  static escapeMarkdown(text: string): string {
    if (!text) return '';
    
    // Characters that need escaping in Markdown
    return text
      .replace(/_/g, '\\_')      // Escape underscores
      .replace(/\*/g, '\\*')     // Escape asterisks
      .replace(/\[/g, '\\[')     // Escape opening brackets
      .replace(/\]/g, '\\]')     // Escape closing brackets
      .replace(/\(/g, '\\(')     // Escape opening parentheses
      .replace(/\)/g, '\\)')     // Escape closing parentheses
      .replace(/~/g, '\\~')      // Escape tildes
      .replace(/`/g, '\\`')      // Escape backticks
      .replace(/>/g, '\\>')      // Escape greater than
      .replace(/#/g, '\\#')      // Escape hash
      .replace(/\+/g, '\\+')     // Escape plus
      .replace(/-/g, '\\-')      // Escape minus
      .replace(/=/g, '\\=')      // Escape equals
      .replace(/\|/g, '\\|')     // Escape pipe
      .replace(/{/g, '\\{')      // Escape opening curly brace
      .replace(/}/g, '\\}')      // Escape closing curly brace
      .replace(/\./g, '\\.')     // Escape dot
      .replace(/!/g, '\\!');     // Escape exclamation
  }
  
  /**
   * Format Telegram username with proper @ symbol
   */
  static formatTelegramUsername(username: string): string {
    if (!username) return '';
    
    let cleanUsername = username.trim();
    
    // Remove @ if it's already there
    if (cleanUsername.startsWith('@')) {
      cleanUsername = cleanUsername.substring(1);
    }
    
    // Ensure username is valid
    const isValid = /^[a-zA-Z0-9_]+$/.test(cleanUsername);
    
    if (!isValid) {
      console.warn(`Invalid Telegram username: ${username}`);
      return `@${cleanUsername}`; // Still return it, but warn
    }
    
    return `@${cleanUsername}`;
  }
  
  /**
   * Create a proper Telegram link
   */
  static createTelegramLink(username: string): string {
    const cleanUsername = this.formatTelegramUsername(username);
    
    if (cleanUsername.startsWith('@')) {
      const usernameOnly = cleanUsername.substring(1);
      return `https://t.me/${usernameOnly}`;
    }
    
    return `https://t.me/${cleanUsername}`;
  }
  
  /**
   * Create inline keyboard button for Telegram contact
   */
  static createContactButton(username: string, buttonText = '📞 Contact Support'): any {
    const cleanUsername = this.formatTelegramUsername(username);
    const usernameOnly = cleanUsername.startsWith('@') 
      ? cleanUsername.substring(1) 
      : cleanUsername;
    
    return {
      text: buttonText,
      url: `https://t.me/${usernameOnly}`
    };
  }
  
  /**
   * Validate Telegram URL
   */
  static isValidTelegramUrl(url: string): boolean {
    if (!url) return false;
    
    const patterns = [
      /^https?:\/\/(?:t\.me|telegram\.me|telegram\.dog)\/[a-zA-Z0-9_]+$/i,
      /^@[a-zA-Z0-9_]+$/,
      /^[a-zA-Z0-9_]+$/
    ];
    
    return patterns.some(pattern => pattern.test(url.trim()));
  }
}