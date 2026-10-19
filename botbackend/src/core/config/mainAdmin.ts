// src/core/config/mainAdmin.ts
export const MAIN_ADMIN_EMAILS = ['amanuelababu19@gmail.com'];

export function isMainAdmin(email: string): boolean {
  return MAIN_ADMIN_EMAILS.includes(email);
}