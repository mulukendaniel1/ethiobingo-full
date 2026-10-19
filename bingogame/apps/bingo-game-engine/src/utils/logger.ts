//apps\bingo-game-engine\src\utils\logger.ts
import { GameLog, GameLogType } from '../models/GameLog';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// Configuration for sensitive keys
const SENSITIVE_KEYS = [
  'REDIS_URL', 'BROKER_INTERNAL_SECRET', 'JWT_SECRET', 
  'MONGODB_URI', 'password', 'secret', 'token', 'privateKey', 'apiKey'
];

const colors = {
  reset: '\x1b[0m',
  gray: '\x1b[90m',
  blue: '\x1b[34m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
};

// Recursive function to redact sensitive data
function redactObject(obj: any): any {
  if (typeof obj !== 'object' || obj === null) return obj;

  const redacted = Array.isArray(obj) ? [...obj] : { ...obj };

  for (const key in redacted) {
    if (SENSITIVE_KEYS.some(s => key.toLowerCase().includes(s.toLowerCase()))) {
      redacted[key] = '[REDACTED]';
    } else if (typeof redacted[key] === 'object') {
      redacted[key] = redactObject(redacted[key]);
    }
  }
  return redacted;
}

function colorize(level: LogLevel, msg: string): string {
  const color =
    level === 'debug' ? colors.gray :
    level === 'info'  ? colors.green :
    level === 'warn'  ? colors.yellow :
    colors.red;
  return `${color}${msg}${colors.reset}`;
}

function formatMessage(level: LogLevel, ...args: any[]): string {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
  // Redact all arguments before stringifying
  const message = args.map(arg => {
    const sanitized = typeof arg === 'object' ? redactObject(arg) : arg;
    return typeof sanitized === 'object' ? JSON.stringify(sanitized, null, 2) : String(sanitized);
  }).join(' ');
  return `${prefix} ${message}`;
}

class Logger {
  private async logToDb(
    type: GameLogType,
    level: LogLevel,
    data: any,
    roundId?: string,
    userId?: string,
    operatorId?: string
  ) {
    try {
      // Ensure data is sanitized before DB write
      const sanitizedData = redactObject(data);
      await GameLog.create({
        type,
        level: level as 'info' | 'warn' | 'error',
        data: sanitizedData,
        roundId,
        userId,
        operatorId,
      });
    } catch (err) {
      console.error('Failed to write to GameLog:', err);
    }
  }

  debug(...args: any[]) { console.debug(colorize('debug', formatMessage('debug', ...args))); }
  info(...args: any[]) { console.info(colorize('info', formatMessage('info', ...args))); }
  warn(...args: any[]) { console.warn(colorize('warn', formatMessage('warn', ...args))); }
  error(...args: any[]) { console.error(colorize('error', formatMessage('error', ...args))); }

  async logEvent(
    type: GameLogType,
    data: any,
    options?: { roundId?: string; userId?: string; operatorId?: string }
  ) {
    const { roundId, userId, operatorId } = options || {};
    const level = type === 'ERROR' ? 'error' : type === 'WARNING' ? 'warn' : 'info';

    // Log to console (already sanitized by formatMessage)
    console.info(colorize(level, formatMessage(level, `EVENT ${type}:`, data)));

    // Log to DB
    await this.logToDb(type, level, data, roundId, userId, operatorId);
  }
}

export const logger = new Logger();