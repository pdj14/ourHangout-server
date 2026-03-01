import { createHash } from 'crypto';
import { customAlphabet } from 'nanoid';
import bcrypt from 'bcryptjs';
import type { FastifyBaseLogger } from 'fastify';
import type { Pool } from 'pg';
import type { AppEnv } from '../../config/env';
import { AppError, ErrorCodes } from '../../lib/errors';
import { toJwtPayload, toSafeUser } from '../../lib/user';
import type { AuthTokenResponse, SafeUser } from './auth.types';

const refreshTokenAlphabet = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ', 64);

type UserRow = {
  id: string;
  email: string;
  role: string;
  password_hash: string;
  created_at: Date;
};

type SignAccessToken = (payload: { sub: string; email: string; role: string }) => string;

export class AuthService {
  constructor(
    private readonly db: Pool,
    private readonly env: AppEnv,
    private readonly signAccessToken: SignAccessToken,
    private readonly logger: FastifyBaseLogger
  ) {}

  async login(email: string, password: string): Promise<{ user: SafeUser; tokens: AuthTokenResponse }> {
    const result = await this.db.query<UserRow>(
      `SELECT id, email, role, password_hash, created_at
       FROM users
       WHERE lower(email) = lower($1)
       LIMIT 1`,
      [email]
    );

    const user = result.rows[0];
    if (!user) {
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

  async refresh(refreshToken: string): Promise<{ user: SafeUser; tokens: AuthTokenResponse }> {
    const tokenHash = this.hashRefreshToken(refreshToken);

    const result = await this.db.query<
      UserRow & {
        refresh_token_id: string;
      }
    >(
      `SELECT u.id, u.email, u.role, u.password_hash, u.created_at, rt.id AS refresh_token_id
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

  async getUserById(userId: string): Promise<SafeUser> {
    const result = await this.db.query<UserRow>(
      `SELECT id, email, role, password_hash, created_at
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [userId]
    );

    const user = result.rows[0];
    if (!user) {
      throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, 'User not found.');
    }

    return toSafeUser(user);
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

  private hashRefreshToken(refreshToken: string): string {
    return createHash('sha256').update(refreshToken).digest('hex');
  }
}
