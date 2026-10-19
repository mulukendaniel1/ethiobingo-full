//src\core\utils\settings.ts
import { SystemSettings } from '../database/models/SystemSettings';

// Simple in-memory cache
const cache = new Map<string, { value: any; expires: number }>();
const CACHE_TTL = 60000; // 60 seconds

export async function getSetting(key: string): Promise<any> {
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) {
    return cached.value;
  }

  const doc = await SystemSettings.findOne({ key }).lean();
  if (!doc) return null;

  const value = doc.value;
  cache.set(key, { value, expires: Date.now() + CACHE_TTL });
  return value;
}

export async function getSettingString(key: string, defaultValue: string = ''): Promise<string> {
  const val = await getSetting(key);
  return val !== undefined && val !== null ? String(val) : defaultValue;
}

export async function getSettingBoolean(key: string, defaultValue: boolean = false): Promise<boolean> {
  const val = await getSetting(key);
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') return val.toLowerCase() === 'true';
  return defaultValue;
}

export async function getSettingNumber(key: string, defaultValue: number = 0): Promise<number> {
  const val = await getSetting(key);
  const num = Number(val);
  return isNaN(num) ? defaultValue : num;
}

export function refreshSettings() {
  cache.clear();
}