//packages\translations\src\index.ts
import en from './en.json';
import am from './am.json';
import om from './om.json';
import ti from './ti.json';
import so from './so.json';

export const translations = { en, am, om, ti, so };
export type Language = keyof typeof translations;
export type TranslationKey = keyof typeof en;
export default translations;