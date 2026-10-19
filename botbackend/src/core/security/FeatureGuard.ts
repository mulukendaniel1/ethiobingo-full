// src/core/security/FeatureGuard.ts
import { getSettings } from '../utils/settingsCache';

export class FeatureGuard {
  /**
   * Master switch check – if false, no ETB operations are allowed.
   */
  static isETBEnabled(): boolean {
    return getSettings().etbCoinEnabled === true;
  }

  /**
   * Deposit‑specific check.
   * Throws an error if deposits are not allowed.
   */
  static requireDepositEnabled(): void {
    if (!this.isETBEnabled()) {
      throw new Error('ETB feature is disabled. Please try again later.');
    }
    if (!getSettings().depositEnabled) {
      throw new Error('Deposits are temporarily disabled. Please try again later.');
    }
  }

  /**
   * Withdrawal‑specific check.
   * Throws an error if withdrawals are not allowed.
   */
  static requireWithdrawEnabled(): void {
    if (!this.isETBEnabled()) {
      throw new Error('ETB feature is disabled. Please try again later.');
    }
    if (!getSettings().withdrawEnabled) {
      throw new Error('Withdrawals are temporarily disabled. Please try again later.');
    }
  }

  /**
   * For any operation that needs the master switch only (e.g., viewing balance).
   */
  static requireETBEnabled(): void {
    if (!this.isETBEnabled()) {
      throw new Error('ETB feature is currently unavailable.');
    }
  }
}