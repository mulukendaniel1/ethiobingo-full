export function normalizePhoneNumber(raw: string): string {
  let digits = raw.replace(/[^\d]/g, '');
  if (digits.startsWith('0') && digits.length === 10) {
    digits = '251' + digits.slice(1); // Ethiopian local -> country code
  }
  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }
  return digits;
}