// src/services/translationService.ts
import en from '../locales/en.json';
import am from '../locales/am.json';
import ti from '../locales/ti.json';
import om from '../locales/om.json';
import so from '../locales/so.json';

const translations = { en, am, ti, om, so };
export type Language = keyof typeof translations;

export function t(lang: Language | undefined, key: string, replacements?: Record<string, string | number>): string {
  const safeLang = lang || 'en';
  const keys = key.split('.');
  let value: any = translations[safeLang];
  for (const k of keys) {
    value = value?.[k];
    if (value === undefined) break;
  }
  if (typeof value !== 'string') {
    value = translations.en;
    for (const k of keys) {
      value = value?.[k];
      if (value === undefined) break;
    }
  }
  const result = typeof value === 'string' ? value : key;
  if (!replacements) return result;
  return result.replace(/{{(\w+)}}/g, (_, p) => String(replacements[p] ?? `{{${p}}}`));
}