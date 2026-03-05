import { createHash } from 'crypto';
import { customAlphabet } from 'nanoid';
import bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import type { FastifyBaseLogger } from 'fastify';
import type { Pool } from 'pg';
import type { AppEnv } from '../../config/env';
import { AppError, ErrorCodes } from '../../lib/errors';
import { normalizePhoneE164 } from '../../lib/phone';
import { toJwtPayload, toSafeUser } from '../../lib/user';
import type { AuthProvider, AuthTokenResponse, SafeUser } from './auth.types';

const refreshTokenAlphabet = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ', 64);

type UserRow = {
  id: string;
  email: string;
  role: string;
  password_hash: string | null;
  auth_provider: AuthProvider;
  provider_user_id: string | null;
  display_name: string | null;
  phone_e164: string | null;
  created_at: Date;
};

type SignAccessToken = (payload: { sub: string; email: string; role: string }) => string;

type GoogleIdentity = {
  providerUserId: string;
  email: string;
  displayName: string | null;
};

export class AuthService {
  private googleClient?: OAuth2Client;

  constructor(
    private readonly db: Pool,
    private readonly env: AppEnv,
    private readonly signAccessToken: SignAccessToken,
    private readonly logger: FastifyBaseLogger
  ) {}

  async signup(params: {
    email: string;
    password: string;
    role: 'parent' | 'user';
    displayName?: string;
  }): Promise<{ user: SafeUser; tokens: AuthTokenResponse }> {
    const email = params.email.trim().toLowerCase();

    const existing = await this.db.query<{ id: string }>(
      `SELECT id
       FROM users
       WHERE lower(email) = lower($1)
       LIMIT 1`,
      [email]
    );

    if (existing.rows[0]) {
      throw new AppError(409, ErrorCodes.CONFLICT, 'Email already exists.');
    }

    const passwordHash = await bcrypt.hash(params.password, 10);

    const insert = await this.db.query<UserRow>(
      `INSERT INTO users (email, password_hash, role, auth_provider, display_name)
       VALUES ($1, $2, $3, 'local', $4)
       RETURNING id, email, role, password_hash, auth_provider, provider_user_id, display_name, phone_e164, created_at`,
      [email, passwordHash, params.role, params.displayName?.trim() ?? null]
    );

    const user = insert.rows[0];
    const tokens = await this.issueTokens(user);

    return {
      user: toSafeUser(user),
      tokens
    };
  }

  async login(emailInput: string, password: string): Promise<{ user: SafeUser; tokens: AuthTokenResponse }> {
    const email = emailInput.trim().toLowerCase();

    const user = await this.findUserByEmail(email);
    if (!user || !user.password_hash) {
      throw new AppError(401, ErrorCodes.AUTH_INVALID_CREDENTIALS, 'Invalid email or password.');
    }

    const passwordMatched = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatched) {
      throw new AppError(401, ErrorCodes.AUTH_INVALID_CREDENTIALS, 'Invalid email or password.');
    }

    const tokens = await this.issueTokens(user);
    return {
      user: toSafeUser(user),
      tokens
    };
  }

  async loginWithGoogle(params: {
    idToken: string;
    role?: 'parent' | 'user';
  }): Promise<{ user: SafeUser; tokens: AuthTokenResponse }> {
    const identity = await this.verifyGoogleToken(params.idToken);

    const byProvider = await this.db.query<UserRow>(
      `SELECT id, email, role, password_hash, auth_provider, provider_user_id, display_name, phone_e164, created_at
       FROM users
       WHERE provider_user_id = $1
       LIMIT 1`,
      [identity.providerUserId]
    );

    if (byProvider.rows[0]) {
      const user = byProvider.rows[0];
      const tokens = await this.issueTokens(user);
      return {
        user: toSafeUser(user),
        tokens
      };
    }

    const existingByEmail = await this.findUserByEmail(identity.email);
    if (existingByEmail) {
      if (existingByEmail.auth_provider !== 'google' || !existingByEmail.provider_user_id) {
        throw new AppError(
          409,
          ErrorCodes.AUTH_PROVIDER_MISMATCH,
          'This email is already registered with local login. Sign in with password first and then call /v1/auth/link/google.'
        );
      }

      const updated = await this.db.query<UserRow>(
        `UPDATE users
         SET provider_user_id = COALESCE(provider_user_id, $1),
             display_name = COALESCE(display_name, $2)
         WHERE id = $3
         RETURNING id, email, role, password_hash, auth_provider, provider_user_id, display_name, phone_e164, created_at`,
        [identity.providerUserId, identity.displayName, existingByEmail.id]
      );

      const user = updated.rows[0];
      const tokens = await this.issueTokens(user);

      return {
        user: toSafeUser(user),
        tokens
      };
    }

    const created = await this.db.query<UserRow>(
      `INSERT INTO users (email, password_hash, role, auth_provider, provider_user_id, display_name)
       VALUES ($1, NULL, $2, 'google', $3, $4)
       RETURNING id, email, role, password_hash, auth_provider, provider_user_id, display_name, phone_e164, created_at`,
      [identity.email, params.role ?? 'user', identity.providerUserId, identity.displayName]
    );

    const user = created.rows[0];
    const tokens = await this.issueTokens(user);

    return {
      user: toSafeUser(user),
      tokens
    };
  }

  async linkGoogleAccount(userId: string, idToken: string): Promise<SafeUser> {
    const identity = await this.verifyGoogleToken(idToken);
    const currentUser = await this.getUserRowById(userId);

    if (currentUser.email.toLowerCase() !== identity.email.toLowerCase()) {
      throw new AppError(
        409,
        ErrorCodes.AUTH_PROVIDER_MISMATCH,
        'Google account email does not match the current signed-in account.'
      );
    }

    const inUse = await this.db.query<{ id: string }>(
      `SELECT id
       FROM users
       WHERE provider_user_id = $1
         AND id <> $2
       LIMIT 1`,
      [identity.providerUserId, userId]
    );

    if (inUse.rows[0]) {
      throw new AppError(409, ErrorCodes.CONFLICT, 'This Google account is already linked to another user.');
    }

    const updated = await this.db.query<UserRow>(
      `UPDATE users
       SET auth_provider = 'google',
           provider_user_id = $1,
           display_name = COALESCE(display_name, $2)
       WHERE id = $3
       RETURNING id, email, role, password_hash, auth_provider, provider_user_id, display_name, phone_e164, created_at`,
      [identity.providerUserId, identity.displayName, userId]
    );

    return toSafeUser(updated.rows[0]);
  }

  async changePassword(params: {
    userId: string;
    currentPassword: string;
    newPassword: string;
  }): Promise<void> {
    const user = await this.getUserRowById(params.userId);

    if (!user.password_hash) {
      throw new AppError(409, ErrorCodes.AUTH_PROVIDER_MISMATCH, 'Password login is not enabled for this account.');
    }

    const passwordMatched = await bcrypt.compare(params.currentPassword, user.password_hash);
    if (!passwordMatched) {
      throw new AppError(401, ErrorCodes.AUTH_PASSWORD_INVALID, 'Current password is incorrect.');
    }

    const sameAsCurrent = await bcrypt.compare(params.newPassword, user.password_hash);
    if (sameAsCurrent) {
      throw new AppError(409, ErrorCodes.CONFLICT, 'New password must be different from current password.');
    }

    const newHash = await bcrypt.hash(params.newPassword, 10);

    await this.db.query(
      `UPDATE users
       SET password_hash = $1
       WHERE id = $2`,
      [newHash, params.userId]
    );

    await this.logoutAll(params.userId);
  }

  async updatePhone(userId: string, phoneRaw?: string | null): Promise<SafeUser> {
    let normalized: string | null = null;

    if (phoneRaw && phoneRaw.trim().length > 0) {
      normalized = normalizePhoneE164(phoneRaw);
      if (!normalized) {
        throw new AppError(
          400,
          ErrorCodes.AUTH_PHONE_INVALID,
          'Phone format is invalid. Use E.164 format, for example +821012345678.'
        );
      }
    }

    try {
      const updated = await this.db.query<UserRow>(
        `UPDATE users
         SET phone_e164 = $1
         WHERE id = $2
         RETURNING id, email, role, password_hash, auth_provider, provider_user_id, display_name, phone_e164, created_at`,
        [normalized, userId]
      );

      if (!updated.rows[0]) {
        throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, 'User not found.');
      }

      return toSafeUser(updated.rows[0]);
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        throw new AppError(409, ErrorCodes.CONFLICT, 'This phone number is already linked to another account.');
      }
      throw error;
    }
  }

  async refresh(refreshToken: string): Promise<{ user: SafeUser; tokens: AuthTokenResponse }> {
    const tokenHash = this.hashRefreshToken(refreshToken);

    const result = await this.db.query<
      UserRow & {
        refresh_token_id: string;
      }
    >(
      `SELECT u.id,
              u.email,
              u.role,
              u.password_hash,
              u.auth_provider,
              u.provider_user_id,
              u.display_name,
              u.phone_e164,
              u.created_at,
              rt.id AS refresh_token_id
       FROM refresh_tokens rt
       INNER JOIN users u ON u.id = rt.user_id
       WHERE rt.token_hash = $1
         AND rt.revoked_at IS NULL
         AND rt.expires_at > NOW()
       LIMIT 1`,
      [tokenHash]
    );

    const row = result.rows[0];
    if (!row) {
      throw new AppError(401, ErrorCodes.AUTH_REFRESH_INVALID, 'Refresh token is invalid or expired.');
    }

    await this.db.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1 AND revoked_at IS NULL', [
      row.refresh_token_id
    ]);

    const tokens = await this.issueTokens(row);
    return {
      user: toSafeUser(row),
      tokens
    };
  }

  async logout(userId: string, refreshToken: string): Promise<void> {
    const tokenHash = this.hashRefreshToken(refreshToken);
    await this.db.query(
      `UPDATE refresh_tokens
       SET revoked_at = NOW()
       WHERE token_hash = $1
         AND user_id = $2
         AND revoked_at IS NULL`,
      [tokenHash, userId]
    );
  }

  async logoutAll(userId: string): Promise<void> {
    await this.db.query(
      `UPDATE refresh_tokens
       SET revoked_at = NOW()
       WHERE user_id = $1
         AND revoked_at IS NULL`,
      [userId]
    );
  }

  async getUserById(userId: string): Promise<SafeUser> {
    const user = await this.getUserRowById(userId);
    return toSafeUser(user);
  }

  private async findUserByEmail(email: string): Promise<UserRow | null> {
    const result = await this.db.query<UserRow>(
      `SELECT id, email, role, password_hash, auth_provider, provider_user_id, display_name, phone_e164, created_at
       FROM users
       WHERE lower(email) = lower($1)
       LIMIT 1`,
      [email]
    );

    return result.rows[0] ?? null;
  }

  private async getUserRowById(userId: string): Promise<UserRow> {
    const result = await this.db.query<UserRow>(
      `SELECT id, email, role, password_hash, auth_provider, provider_user_id, display_name, phone_e164, created_at
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [userId]
    );

    const user = result.rows[0];
    if (!user) {
      throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, 'User not found.');
    }

    return user;
  }

  private async issueTokens(user: { id: string; email: string; role: string }): Promise<AuthTokenResponse> {
    const payload = toJwtPayload(user);
    const accessToken = this.signAccessToken(payload);

    const refreshToken = refreshTokenAlphabet();
    const refreshTokenHash = this.hashRefreshToken(refreshToken);
    const expiresAt = new Date(Date.now() + this.env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

    await this.db.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [user.id, refreshTokenHash, expiresAt]
    );

    this.logger.debug({ userId: user.id }, 'Issued new token pair');

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: this.env.ACCESS_TOKEN_TTL
    };
  }

  private getGoogleClient(): OAuth2Client {
    if (!this.googleClient) {
      this.googleClient = new OAuth2Client();
    }

    return this.googleClient;
  }

  private async verifyGoogleToken(idToken: string): Promise<GoogleIdentity> {
    const audiences = this.env.GOOGLE_CLIENT_IDS;
    if (audiences.length < 1) {
      throw new AppError(
        503,
        ErrorCodes.AUTH_GOOGLE_CONFIG,
        'Google login is not configured. Set GOOGLE_CLIENT_ID(S) first.'
      );
    }

    const client = this.getGoogleClient();

    let payload:
      | {
          sub?: string;
          email?: string;
          email_verified?: boolean;
          name?: string;
        }
      | undefined;

    try {
      const ticket = await client.verifyIdToken({
        idToken,
        audience: audiences
      });
      payload = ticket.getPayload();
    } catch (error) {
      this.logger.warn({ error }, 'Failed to verify Google ID token');
      throw new AppError(401, ErrorCodes.AUTH_GOOGLE_INVALID, 'Google token verification failed.');
    }

    if (!payload?.sub || !payload.email || payload.email_verified !== true) {
      throw new AppError(401, ErrorCodes.AUTH_GOOGLE_INVALID, 'Google token is invalid or email is not verified.');
    }

    return {
      providerUserId: payload.sub,
      email: payload.email.toLowerCase(),
      displayName: payload.name?.trim() || null
    };
  }

  private hashRefreshToken(refreshToken: string): string {
    return createHash('sha256').update(refreshToken).digest('hex');
  }
}
