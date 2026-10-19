// src/bot/framework/middleware/language.ts
import { NextFunction } from 'grammy';
import { Context } from '../index';

export function languageMiddleware() {
  return async (ctx: Context, next: NextFunction) => {
    if (ctx.state?.user) {
      ctx.state.lang = ctx.state.user.language || 'en';
    } else {
      ctx.state.lang = 'en'; // default
    }
    await next();
  };
}