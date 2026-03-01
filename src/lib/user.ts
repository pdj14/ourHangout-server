import type { AuthProvider, JwtUserPayload } from '../modules/auth/auth.types';

export function toSafeUser(user: {
  id: string;
  email: string;
  role: string;
  auth_provider: AuthProvider;
  display_name: string | null;
  phone_e164?: string | null;
  created_at: Date;
}): {
  id: string;
  email: string;
  role: string;
  authProvider: AuthProvider;
  displayName?: string;
  phoneE164?: string;
  createdAt: string;
} {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    authProvider: user.auth_provider,
    ...(user.display_name ? { displayName: user.display_name } : {}),
    ...(user.phone_e164 ? { phoneE164: user.phone_e164 } : {}),
    createdAt: user.created_at.toISOString()
  };
}

export function toJwtPayload(user: { id: string; email: string; role: string }): JwtUserPayload {
  return {
    sub: user.id,
    email: user.email,
    role: user.role
  };
}
