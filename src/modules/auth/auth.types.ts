export interface JwtUserPayload {
  sub: string;
  email: string;
  role: string;
  scope?: string;
}

export type AuthProvider = 'local' | 'google';

export interface AuthTokenResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
}

export interface SafeUser {
  id: string;
  email: string;
  role: string;
  authProvider: AuthProvider;
  displayName?: string;
  phoneE164?: string;
  createdAt: string;
}
