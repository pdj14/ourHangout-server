export const ErrorCodes = {
  AUTH_UNAUTHORIZED: 'AUTH_UNAUTHORIZED',
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  AUTH_REFRESH_INVALID: 'AUTH_REFRESH_INVALID',
  AUTH_PROVIDER_MISMATCH: 'AUTH_PROVIDER_MISMATCH',
  AUTH_GOOGLE_INVALID: 'AUTH_GOOGLE_INVALID',
  AUTH_GOOGLE_CONFIG: 'AUTH_GOOGLE_CONFIG',
  AUTH_PASSWORD_INVALID: 'AUTH_PASSWORD_INVALID',
  AUTH_PHONE_INVALID: 'AUTH_PHONE_INVALID',
  FORBIDDEN: 'FORBIDDEN',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  OPENCLAW_TIMEOUT: 'OPENCLAW_TIMEOUT',
  OPENCLAW_UPSTREAM_ERROR: 'OPENCLAW_UPSTREAM_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR'
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly details?: unknown;

  constructor(statusCode: number, code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
