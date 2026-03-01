import type { JwtUserPayload } from '../modules/auth/auth.types';

export function toSafeUser(user: { id: string; email: string; role: string; created_at: Date }): {
  id: string;
  email: string;
  role: string;
  createdAt: string;
} {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
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
