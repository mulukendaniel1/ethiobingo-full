//src/core/utils/validator.ts
import { Constants } from '../config/constants';
import { UrlFormatter } from './urlFormatter';

const VALIDATION = {
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  TRX_ADDRESS_REGEX: /^T[a-zA-Z0-9]{33}$/,
  USERNAME_REGEX: /^[a-zA-Z0-9_]{3,20}$/,
  PHONE_REGEX: /^\+?[1-9]\d{1,14}$/
};

export class Validator {
  

   /**
   * Telegram username validation
   */
  static isValidTelegramUsername(username: string): ValidationResult {
    if (!username || typeof username !== 'string') {
      return {
        valid: false,
        error: 'Username is required'
      };
    }
    
    const cleanUsername = username.trim();
    
    // Remove @ symbol if present
    const usernameOnly = cleanUsername.startsWith('@') 
      ? cleanUsername.substring(1) 
      : cleanUsername;
    
    // Telegram username rules
    const minLength = 5;
    const maxLength = 32;
    
    if (usernameOnly.length < minLength) {
      return {
        valid: false,
        error: `Username must be at least ${minLength} characters`
      };
    }
    
    if (usernameOnly.length > maxLength) {
      return {
        valid: false,
        error: `Username cannot exceed ${maxLength} characters`
      };
    }
    
    // Only allow letters, numbers, and underscores
    if (!/^[a-zA-Z0-9_]+$/.test(usernameOnly)) {
      return {
        valid: false,
        error: 'Username can only contain letters, numbers, and underscores'
      };
    }
    
    // Cannot start or end with underscore
    if (usernameOnly.startsWith('_') || usernameOnly.endsWith('_')) {
      return {
        valid: false,
        error: 'Username cannot start or end with underscore'
      };
    }
    
    // Cannot contain consecutive underscores
    if (usernameOnly.includes('__')) {
      return {
        valid: false,
        error: 'Username cannot contain consecutive underscores'
      };
    }
    
    return { valid: true };
  }
  
  /**
   * Telegram URL validation
   */
  static isValidTelegramUrl(url: string): boolean {
    return UrlFormatter.isValidTelegramUrl(url);
  }


  // Email validation
  static isValidEmail(email: string): boolean {
    if (!email || typeof email !== 'string') {
      return false;
    }
    
    return VALIDATION.EMAIL_REGEX.test(email.trim());
  }
  
  // TRX address validation
  static isValidTRXAddress(address: string): boolean {
    if (!address || typeof address !== 'string') {
      return false;
    }
    
    return VALIDATION.TRX_ADDRESS_REGEX.test(address.trim());
  }
  
  // Username validation
  static isValidUsername(username: string): boolean {
    if (!username || typeof username !== 'string') {
      return false;
    }
    
    return VALIDATION.USERNAME_REGEX.test(username.trim());
  }
  
  // Phone number validation
  static isValidPhoneNumber(phone: string): boolean {
    if (!phone || typeof phone !== 'string') {
      return false;
    }
    
    return VALIDATION.PHONE_REGEX.test(phone.trim());
  }
  
  
  // Amount validation
  static isValidAmount(amount: number, options?: AmountOptions): ValidationResult {
    const min = options?.min || 0;
    const max = options?.max || 1000000;
    const precision = options?.precision || 2;
    
    if (typeof amount !== 'number' || isNaN(amount)) {
      return {
        valid: false,
        error: 'Amount must be a valid number'
      };
    }
    
    if (amount < min) {
      return {
        valid: false,
        error: `Amount must be at least ${min}`
      };
    }
    
    if (amount > max) {
      return {
        valid: false,
        error: `Amount cannot exceed ${max}`
      };
    }
    
    // Check decimal places
    const decimalPlaces = (amount.toString().split('.')[1] || '').length;
    if (decimalPlaces > precision) {
      return {
        valid: false,
        error: `Amount cannot have more than ${precision} decimal places`
      };
    }
    
    return { valid: true };
  }
  
  // Password validation
  static isValidPassword(password: string): ValidationResult {
    if (!password || typeof password !== 'string') {
      return {
        valid: false,
        error: 'Password is required'
      };
    }
    
    if (password.length < Constants.SECURITY.PASSWORD_MIN_LENGTH) {
      return {
        valid: false,
        error: `Password must be at least ${Constants.SECURITY.PASSWORD_MIN_LENGTH} characters long`
      };
    }
    
    // Optional: Add more complex password rules
    // if (!/[A-Z]/.test(password)) {
    //   return {
    //     valid: false,
    //     error: 'Password must contain at least one uppercase letter'
    //   };
    // }
    
    return { valid: true };
  }
  
  // Job status validation
  static isValidJobStatus(status: string): boolean {
    return Object.values(Constants.JOB_STATUS).includes(status as any);
  }
  
  // Account status validation
  static isValidAccountStatus(status: string): boolean {
    return Object.values(Constants.ACCOUNT_STATUS).includes(status as any);
  }
  
  // Payout status validation
  static isValidPayoutStatus(status: string): boolean {
    return Object.values(Constants.PAYOUT_STATUS).includes(status as any);
  }
  
  // Audit severity validation
  static isValidAuditSeverity(severity: string): boolean {
    return Object.values(Constants.AUDIT_SEVERITY).includes(severity as any);
  }
  
  // URL validation
  static isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
  
  // Date validation
  static isValidDate(date: Date | string): boolean {
    try {
      const d = new Date(date);
      return !isNaN(d.getTime());
    } catch {
      return false;
    }
  }
  
  // JSON validation
  static isValidJson(json: string): boolean {
    try {
      JSON.parse(json);
      return true;
    } catch {
      return false;
    }
  }
  
  // Object ID validation (Mongoose ObjectId)
  static isValidObjectId(id: string): boolean {
    return /^[0-9a-fA-F]{24}$/.test(id);
  }
  
  // UUID validation
  static isValidUUID(uuid: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid);
  }
  
  // Referral code validation
  static isValidReferralCode(code: string): boolean {
    if (!code || typeof code !== 'string') {
      return false;
    }
    
    return code.length === Constants.SECURITY.REFERRAL_CODE_LENGTH &&
           /^[A-Z0-9]+$/.test(code);
  }
  
  // IP address validation
  static isValidIPAddress(ip: string): boolean {
    // IPv4
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (ipv4Regex.test(ip)) {
      const parts = ip.split('.').map(Number);
      return parts.every(part => part >= 0 && part <= 255);
    }
    
    // IPv6 (simplified)
    const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    if (ipv6Regex.test(ip)) {
      return true;
    }
    
    // IPv6 compressed
    const ipv6CompressedRegex = /^(([0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4})?::(([0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4})?$/;
    return ipv6CompressedRegex.test(ip);
  }
  
  // Country code validation (ISO 3166-1 alpha-2)
  static isValidCountryCode(code: string): boolean {
    return /^[A-Z]{2}$/.test(code);
  }
  
  // Currency code validation (ISO 4217)
  static isValidCurrencyCode(code: string): boolean {
    return /^[A-Z]{3}$/.test(code);
  }
  
  // Language code validation (ISO 639-1)
  static isValidLanguageCode(code: string): boolean {
    return /^[a-z]{2}$/.test(code);
  }
  
  // Validate user input for registration
  static validateUserRegistration(data: UserRegistrationData): ValidationResult {
    const errors: string[] = [];
    
    if (!data.firstName || data.firstName.trim().length < 2) {
      errors.push('First name must be at least 2 characters');
    }
    
    if (data.email && !this.isValidEmail(data.email)) {
      errors.push('Invalid email address');
    }
    
    if (data.phone && !this.isValidPhoneNumber(data.phone)) {
      errors.push('Invalid phone number');
    }
    
    if (errors.length > 0) {
      return {
        valid: false,
        error: errors.join(', ')
      };
    }
    
    return { valid: true };
  }
  
  // Validate job creation data
  static validateJobCreation(data: JobCreationData): ValidationResult {
    const errors: string[] = [];
    
    if (!data.userId || !this.isValidObjectId(data.userId)) {
      errors.push('Invalid user ID');
    }
    
    if (!data.service || data.service.trim().length < 2) {
      errors.push('Service name is required');
    }
    
    const amountValidation = this.isValidAmount(data.amount || 0, {
      min: 0.01,
      max: 1000,
      precision: 2
    });
    
    if (!amountValidation.valid) {
      errors.push(amountValidation.error!);
    }
    
    if (errors.length > 0) {
      return {
        valid: false,
        error: errors.join(', ')
      };
    }
    
    return { valid: true };
  }

  // Add to existing Validator class in validator.ts
static isValidTRXPrivateKey(privateKey: string): boolean {
  if (!privateKey || typeof privateKey !== 'string') return false;
  
  // TRON private keys are 64 hex chars, optionally prefixed with 0x
  const cleanKey = privateKey.startsWith('0x') 
    ? privateKey.substring(2) 
    : privateKey;
  
  return /^[0-9a-fA-F]{64}$/.test(cleanKey);
}

static validatePayoutRequest(data: PayoutRequestData): ValidationResult {
  const errors: string[] = [];
  
  if (!data.userId || !this.isValidObjectId(data.userId)) {
    errors.push('Invalid user ID');
  }
  
  const amountValidation = this.isValidAmount(data.amount, {
    min: Constants.FINANCIAL.MINIMUM_PAYOUT,
    max: Constants.FINANCIAL.MAXIMUM_PAYOUT,
    precision: 2
  });
  
  if (!amountValidation.valid) {
    errors.push(amountValidation.error!);
  }
  
  if (!data.address || !this.isValidTRXAddress(data.address)) {
    errors.push('Invalid TRX address');
  }
  
  if (errors.length > 0) {
    return {
      valid: false,
      error: errors.join(', ')
    };
  }
  
  return { valid: true };
}
  
  // Sanitize input
  static sanitizeInput(input: string, options?: SanitizeOptions): string {
    if (!input || typeof input !== 'string') {
      return '';
    }
    
    let sanitized = input.trim();
    
    if (options?.maxLength) {
      sanitized = sanitized.substring(0, options.maxLength);
    }
    
    if (options?.removeHtml) {
      sanitized = sanitized.replace(/<[^>]*>/g, '');
    }
    
    if (options?.removeSpecialChars) {
      sanitized = sanitized.replace(/[^\w\s@.\-]/g, '');
    }
    
    if (options?.toLowerCase) {
      sanitized = sanitized.toLowerCase();
    }
    
    if (options?.toUpperCase) {
      sanitized = sanitized.toUpperCase();
    }
    
    if (options?.trim) {
      sanitized = sanitized.trim();
    }
    
    return sanitized;
  }
  
  // Validate and sanitize email
  static cleanEmail(email: string): string | null {
    if (!this.isValidEmail(email)) {
      return null;
    }
    
    return this.sanitizeInput(email, {
      toLowerCase: true,
      trim: true,
      maxLength: 254
    });
  }
  
  // Validate and sanitize phone number
  static cleanPhoneNumber(phone: string): string | null {
    if (!this.isValidPhoneNumber(phone)) {
      return null;
    }
    
    return this.sanitizeInput(phone, {
      trim: true,
      removeSpecialChars: true
    }).replace(/\s+/g, '');
  }
}

// Type definitions
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface AmountOptions {
  min?: number;
  max?: number;
  precision?: number;
}

export interface SanitizeOptions {
  maxLength?: number;
  removeHtml?: boolean;
  removeSpecialChars?: boolean;
  toLowerCase?: boolean;
  toUpperCase?: boolean;
  trim?: boolean;
}

export interface UserRegistrationData {
  firstName: string;
  lastName?: string;
  email?: string;
  phone?: string;
  username?: string;
}

export interface JobCreationData {
  userId: string;
  service: string;
  amount?: number;
  credentials?: any;
}

export interface PayoutRequestData {
  userId: string;
  amount: number;
  address: string;
}