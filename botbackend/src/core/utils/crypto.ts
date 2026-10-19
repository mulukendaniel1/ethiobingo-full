//src\core\utils\crypto.ts
import crypto, { createHmac, randomBytes } from 'crypto';
import { logger } from './logger';
export class CryptoUtils {
  private static algorithm = 'aes-256-gcm';
  private static key: Buffer;
  
  static {
    const key = process.env.ENCRYPTION_KEY;
    if (!key) throw new Error('ENCRYPTION_KEY missing');
    
    const salt = crypto.createHash('sha256').update(key).digest(); 
    
    this.key = crypto.scryptSync(key, salt, 32);
}
  
  static encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = (cipher as any).getAuthTag();
    
    return `${iv.toString('hex')}:${encrypted}:${authTag.toString('hex')}`;
  }
  
  // Updated: Accept string | undefined | null and handle gracefully
  static decrypt(encryptedText: string | undefined | null): string {
    // Handle undefined/null input
    if (!encryptedText) {
      return '';
    }
    
    try {
      const parts = encryptedText.split(':');
      if (parts.length !== 3) {
        logger.warn('Invalid encrypted text format');
        return '';
      }
      
      const [ivHex, encrypted, authTagHex] = parts;
      
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
      
      (decipher as any).setAuthTag(authTag);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error: any) {
      logger.error('Decryption failed:', error.message);
      return ''; // Return empty string instead of throwing
    }
  }
  
  static hashPassword(password: string): string {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto
      .pbkdf2Sync(password, salt, 1000, 64, 'sha512')
      .toString('hex');
    
    return `${salt}:${hash}`;
  }
  
  static verifyPassword(password: string, storedHash: string): boolean {
    const parts = storedHash.split(':');
    if (parts.length !== 2) return false;
    
    const [salt, originalHash] = parts;
    const hash = crypto
      .pbkdf2Sync(password, salt, 1000, 64, 'sha512')
      .toString('hex');
    
    return hash === originalHash;
  }
  
  static generateToken(length = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }
  
  static generateReferralCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(crypto.randomInt(0, chars.length));
    }
    
    return code;
  }
  
  static hmacSign(data: string, secret: string): string {
    return crypto
      .createHmac('sha256', secret)
      .update(data)
      .digest('hex');
  }

  // Helper method for safe decryption with validation
  static safeDecrypt(encryptedText: string | undefined | null, fieldName?: string): string {
    const result = this.decrypt(encryptedText);
    
    if (!result && fieldName) {
      logger.warn(`Decryption returned empty for field: ${fieldName}`);
    }
    
    return result;
  }

  static signPayload(payload: string, secret: string): string {
    return createHmac('sha256', secret).update(payload).digest('hex');
  }

  static verifySignature(payload: string, signature: string, secret: string): boolean {
    return this.signPayload(payload, secret) === signature;
  }
  static generateSecret(): string {
    return randomBytes(32).toString('hex');
  }
}