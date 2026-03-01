export interface JwtUserPayload {
  sub: string;
  email: string;
  role: string;
}

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
  createdAt: string;
}
