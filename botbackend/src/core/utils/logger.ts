//src\core\utils\logger.ts
import pino from 'pino';
import fs from 'fs';
import path from 'path';

// Ensure log directory exists
const logDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Create multiple transports
const streams = [
  { stream: process.stdout },
  { stream: fs.createWriteStream(path.join(logDir, 'app.log')) },
  { stream: fs.createWriteStream(path.join(logDir, 'error.log'), { flags: 'a' }) }
];

export const logger: any = pino({
  level: process.env.LOG_LEVEL || 'info',
  timestamp: pino.stdTimeFunctions.isoTime,
  // ADD THIS REDACT BLOCK: to protect sensitive information from being logged
    redact: {
      paths: [
        // --- Security & Auth ---
        'BOT_TOKEN', 'JWT_SECRET', 'ENCRYPTION_KEY', 'WEBHOOK_SECRET', 'INTERNAL_API_SECRET',
        // --- Database & Cache ---
        'MONGODB_URI', 'REDIS_URL', 'REDIS_PASSWORD',
        // --- Blockchain & Financial ---
        'TRON_PRIVATE_KEY', 'TRONGRID_API_KEY',
        // --- Banking Details (Privacy) ---
        'CBE_ACCOUNT_NUMBER', 'ABYSSINIA_ACCOUNT_NUMBER', 'CBE_BIRR_PHONE', 'TELEBIRR_PHONE',
        // --- Generic catch-alls ---
        'password', '*.password', 'secret', '*.secret', 'token', 'key', '*.key'
      ],
      censor: '[REDACTED]'
    },
  formatters: {
    level: (label) => ({ level: label.toUpperCase() }),
    bindings: (bindings) => ({
      pid: bindings.pid,
      hostname: bindings.hostname,
      node_version: process.version
    })
  },
  serializers: {
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err
  }
}, pino.multistream(streams)) as any;

// Specialized loggers
export const auditLogger = logger.child({ module: 'audit' });
export const queueLogger = logger.child({ module: 'queue' });
export const mtprotoLogger = logger.child({ module: 'mtproto' });
export const botLogger = logger.child({ module: 'bot' });

// Structured logging helper
export function logTransaction(type: string, data: any) {
  logger.info({
    type: 'transaction',
    transactionType: type,
    ...data,
    timestamp: new Date().toISOString()
  }, `Transaction: ${type}`);
}

// Performance logging
export function logPerformance(operation: string, startTime: number, metadata?: any) {
  const duration = Date.now() - startTime;
  logger.info({
    type: 'performance',
    operation,
    duration,
    ...metadata
  }, `Performance: ${operation} took ${duration}ms`);
}