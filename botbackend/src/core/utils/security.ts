//src\core\utils\security.ts
export const sanitizeInput = (input: any): string => {
  if (input === null || input === undefined) return '';
  
  // CRITICAL: If input is an object/array, it's a potential NoSQL injection
  if (typeof input === 'object') {
    return ''; 
  }

  // Force to string and strip HTML/Script tags for Telegram safety
  return String(input)
    .replace(/<[^>]*>?/gm, '') 
    .trim();
};