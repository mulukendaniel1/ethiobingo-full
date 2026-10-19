export const sanitizeInput = (input: any): string => {
  if (input === null || input === undefined) return '';
  if (typeof input === 'object') return '';
  return String(input).replace(/<[^>]*>?/gm, '').trim();
};

export const validateNumber = (value: any, min: number, max: number): number | null => {
  const num = Number(value);
  if (isNaN(num) || !isFinite(num)) return null;
  if (num < min || num > max) return null;
  return num;
};