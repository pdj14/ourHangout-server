import { customAlphabet } from 'nanoid';
import type { FastifyBaseLogger } from 'fastify';
import type { Pool } from 'pg';
import type { AppEnv } from '../../config/env';
import { AppError, ErrorCodes } from '../../lib/errors';

const pairingCodeGenerator = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6);

type PairingCodeRow = {
  id: string;
  code: string;
  created_by: string;
  consumed_by: string | null;
  created_at: Date;
  expires_at: Date;
  consumed_at: Date | null;
};

export class PairingService {
  constructor(
    private readonly db: Pool,
    private readonly env: AppEnv,
    private readonly logger: FastifyBaseLogger
  ) {}

  async createCode(createdByUserId: string, ttlSeconds?: number): Promise<{
    code: string;
    expiresAt: string;
    ttlSeconds: number;
  }> {
    const effectiveTtlSeconds = ttlSeconds && ttlSeconds > 0 ? ttlSeconds : this.env.PAIRING_CODE_TTL_SECONDS;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = pairingCodeGenerator();
      const expiresAt = new Date(Date.now() + effectiveTtlSeconds * 1000);

      try {
        await this.db.query(
          `INSERT INTO pairing_codes (code, created_by, expires_at)
           VALUES ($1, $2, $3)`,
          [code, createdByUserId, expiresAt]
        );

        return {
          code,
          expiresAt: expiresAt.toISOString(),
          ttlSeconds: effectiveTtlSeconds
        };
      } catch (error) {
        // Retry on unique collision; escalate after multiple attempts.
        this.logger.warn({ error, attempt, createdByUserId }, 'Pairing code collision detected. Retrying.');
      }
    }

    throw new AppError(500, ErrorCodes.INTERNAL_ERROR, 'Failed to generate pairing code. Please retry.');
  }

  async consumeCode(userId: string, codeInput: string): Promise<{
    code: string;
    pairedWithUserId: string;
    consumedAt: string;
  }> {
    const code = codeInput.trim().toUpperCase();
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      const selectResult = await client.query<PairingCodeRow>(
        `SELECT id, code, created_by, consumed_by, created_at, expires_at, consumed_at
         FROM pairing_codes
         WHERE code = $1
         FOR UPDATE`,
        [code]
      );

      const row = selectResult.rows[0];
      if (!row) {
        throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, 'Pairing code not found.');
      }

      if (row.consumed_at) {
        throw new AppError(409, ErrorCodes.CONFLICT, 'Pairing code already consumed.');
      }

      if (row.expires_at.getTime() <= Date.now()) {
        throw new AppError(410, ErrorCodes.RESOURCE_NOT_FOUND, 'Pairing code has expired.');
      }

      await client.query(
        `UPDATE pairing_codes
         SET consumed_by = $1, consumed_at = NOW()
         WHERE id = $2`,
        [userId, row.id]
      );

      await client.query('COMMIT');

      const consumedAt = new Date();
      return {
        code: row.code,
        pairedWithUserId: row.created_by,
        consumedAt: consumedAt.toISOString()
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
