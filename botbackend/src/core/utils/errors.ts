export class AppError extends Error {
  code: string;
  details?: any;

  constructor(code: string, message?: string, details?: any) {
    super(message || code);
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export const isAppError = (err: any): err is AppError => err && typeof err.code === 'string';
