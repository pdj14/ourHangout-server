export const GUARDIAN_CONSOLE_PASSWORD_MIN_LENGTH = 16;
export const GUARDIAN_CONSOLE_LEGACY_PASSWORD_MIN_LENGTH = 8;

export function getGuardianConsolePasswordValidationError(
  password: string,
  allowLegacyPassword: boolean
): string | null {
  if (!password || password.length >= GUARDIAN_CONSOLE_PASSWORD_MIN_LENGTH) {
    return null;
  }

  if (allowLegacyPassword && password.length >= GUARDIAN_CONSOLE_LEGACY_PASSWORD_MIN_LENGTH) {
    return null;
  }

  if (allowLegacyPassword) {
    return `Guardian Console legacy password must be at least ${GUARDIAN_CONSOLE_LEGACY_PASSWORD_MIN_LENGTH} characters in production.`;
  }

  return `Guardian Console password must be at least ${GUARDIAN_CONSOLE_PASSWORD_MIN_LENGTH} characters in production. Set GUARDIAN_CONSOLE_ALLOW_LEGACY_PASSWORD=true only for an explicitly approved legacy credential.`;
}
