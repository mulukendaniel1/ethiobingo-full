//src\core\utils\escapeMarkdown.ts
export function escapeMarkdown(text: string): string {
  if (!text) return '';
  
  // Escape Markdown special characters
  return text
    .replace(/_/g, '\\_')
    .replace(/\*/g, '\\*')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/~/g, '\\~')
    .replace(/`/g, '\\`')
    .replace(/>/g, '\\>')
    .replace(/#/g, '\\#')
    .replace(/\+/g, '\\+')
    .replace(/-/g, '\\-')
    .replace(/=/g, '\\=')
    .replace(/\|/g, '\\|')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\./g, '\\.')
    .replace(/!/g, '\\!');
}

export function escapeCode(text: string): string {
  if (!text) return '';
  return text.replace(/`/g, '\\`');
}

// NEW: Function to format currency without escaping dollar sign
export function formatCurrency(amount: number, currency = 'USD'): string {
  if (currency === 'USD') {
    return `$${amount.toFixed(2)}`;
  }
  return `${amount.toFixed(2)} ${currency}`;
}

// NEW: Function to safely format balance messages
export function formatBalanceMessage(balance: number): string {
  return `$${balance.toFixed(2)}`;
}