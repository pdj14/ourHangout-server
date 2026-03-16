import { timingSafeEqual } from 'crypto';
import { env } from '../../config/env';
import type { JwtUserPayload } from '../auth/auth.types';

export const GUARDIAN_CONSOLE_SCOPE = 'guardian_console';
export const GUARDIAN_CONSOLE_SUB = 'guardian-console';
export const GUARDIAN_CONSOLE_ROLE = 'parent';

type GuardianConsoleUser = {
  id: string;
  email: string;
  displayName: string;
  role: 'parent';
};

function secureCompare(expected: string, actual: string): boolean {
  const expectedBuffer = Buffer.from(expected, 'utf8');
  const actualBuffer = Buffer.from(actual, 'utf8');

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, actualBuffer);
}

export function isGuardianConsoleCredentialMatch(loginId: string, password: string): boolean {
  return secureCompare(env.GUARDIAN_CONSOLE_LOGIN_ID, loginId.trim()) &&
    secureCompare(env.GUARDIAN_CONSOLE_PASSWORD, password);
}

export function buildGuardianConsoleJwtPayload(): JwtUserPayload {
  return {
    sub: GUARDIAN_CONSOLE_SUB,
    email: env.GUARDIAN_CONSOLE_LOGIN_ID,
    role: GUARDIAN_CONSOLE_ROLE,
    scope: GUARDIAN_CONSOLE_SCOPE
  };
}

export function isGuardianConsoleTokenPayload(payload: JwtUserPayload | null | undefined): boolean {
  return payload?.sub === GUARDIAN_CONSOLE_SUB &&
    payload?.role === GUARDIAN_CONSOLE_ROLE &&
    payload?.scope === GUARDIAN_CONSOLE_SCOPE;
}

export function buildGuardianConsoleUser(): GuardianConsoleUser {
  return {
    id: GUARDIAN_CONSOLE_SUB,
    email: env.GUARDIAN_CONSOLE_LOGIN_ID,
    displayName: env.GUARDIAN_CONSOLE_LOGIN_ID,
    role: GUARDIAN_CONSOLE_ROLE
  };
}
