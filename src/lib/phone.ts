export function normalizePhoneE164(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  let normalized = trimmed.replace(/[\s\-().]/g, '');

  if (normalized.startsWith('00')) {
    normalized = `+${normalized.slice(2)}`;
  }

  if (!normalized.startsWith('+')) {
    return null;
  }

  const digits = normalized.slice(1);
  if (!/^[1-9][0-9]{7,14}$/.test(digits)) {
    return null;
  }

  return `+${digits}`;
}
