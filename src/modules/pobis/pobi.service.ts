import { randomUUID } from 'crypto';
import type { FastifyBaseLogger } from 'fastify';
import type { Pool, PoolClient } from 'pg';
import { AppError, ErrorCodes } from '../../lib/errors';
import type { SocialService } from '../social/social.service';
import type { PobiRoomResult, PobiSummary } from './pobi.types';

type PobiRow = {
  pobi_id: string;
  owner_user_id: string;
  display_name: string;
  theme: string;
  pobi_is_default: boolean;
  pobi_is_active: boolean;
  pobi_created_at: Date;
  pobi_updated_at: Date;
  bot_id: string;
  bot_key: string;
  bot_user_id: string;
};

type PobiServiceDeps = {
  db: Pool;
  socialService: SocialService;
  logger: FastifyBaseLogger;
};

const POBI_THEMES = new Set(['seed', 'fairy', 'pet', 'buddy']);

export class PobiService {
  private readonly db: Pool;
  private readonly socialService: SocialService;
  private readonly logger: FastifyBaseLogger;

  constructor(deps: PobiServiceDeps) {
    this.db = deps.db;
    this.socialService = deps.socialService;
    this.logger = deps.logger;
  }

  async listPobis(ownerUserId: string): Promise<PobiSummary[]> {
    const result = await this.db.query<PobiRow>(
      `SELECT p.id AS pobi_id,
              p.owner_user_id,
              p.display_name,
              p.theme,
              p.is_default AS pobi_is_default,
              p.is_active AS pobi_is_active,
              p.created_at AS pobi_created_at,
              p.updated_at AS pobi_updated_at,
              b.id AS bot_id,
              b.bot_key,
              b.user_id AS bot_user_id
       FROM pobis p
       INNER JOIN bots b ON b.id = p.bot_id
       WHERE p.owner_user_id = $1
         AND p.is_active = TRUE
         AND b.is_active = TRUE
       ORDER BY p.is_default DESC, p.created_at ASC`,
      [ownerUserId]
    );

    return result.rows.map((row) => this.mapPobi(row));
  }

  async createPobi(
    ownerUserId: string,
    input: {
      name: string;
      theme?: string;
    }
  ): Promise<PobiSummary> {
    const name = input.name.trim();
    if (name.length < 1 || name.length > 40) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Pobi name must be 1-40 characters.');
    }

    const theme = this.normalizeTheme(input.theme);

    const client = await this.db.connect();
    let pobiId = '';

    try {
      await client.query('BEGIN');

      const hasDefaultResult = await client.query<{ exists: boolean }>(
        `SELECT EXISTS(
           SELECT 1
           FROM pobis
           WHERE owner_user_id = $1
             AND is_active = TRUE
             AND is_default = TRUE
         ) AS exists`,
        [ownerUserId]
      );

      const stableKey = randomUUID();
      const providerUserId = `system:pobi:${stableKey}`;
      const email = `pobi.${stableKey}@ourhangout.local`;
      const botKey = `pobi-${stableKey}`;
      const botDescription = 'OurHangout owner-owned Pobi bridged to OpenClaw provider.';

      const userInsert = await client.query<{ id: string }>(
        `INSERT INTO users (email, password_hash, role, auth_provider, provider_user_id, display_name)
         VALUES ($1, NULL, 'user', 'local', $2, $3)
         RETURNING id`,
        [email, providerUserId, name]
      );

      const botUserId = userInsert.rows[0]?.id;
      if (!botUserId) {
        throw new AppError(500, ErrorCodes.INTERNAL_ERROR, 'Failed to create Pobi user.');
      }

      const botInsert = await client.query<{ id: string }>(
        `INSERT INTO bots (bot_key, name, description, user_id, provider, is_active)
         VALUES ($1, $2, $3, $4, 'openclaw', TRUE)
         RETURNING id`,
        [botKey, name, botDescription, botUserId]
      );

      const botId = botInsert.rows[0]?.id;
      if (!botId) {
        throw new AppError(500, ErrorCodes.INTERNAL_ERROR, 'Failed to create Pobi bot record.');
      }

      const pobiInsert = await client.query<{ id: string }>(
        `INSERT INTO pobis (owner_user_id, bot_id, display_name, theme, is_default, is_active, updated_at)
         VALUES ($1, $2, $3, $4, $5, TRUE, NOW())
         RETURNING id`,
        [ownerUserId, botId, name, theme, !(hasDefaultResult.rows[0]?.exists ?? false)]
      );

      pobiId = pobiInsert.rows[0]?.id ?? '';
      if (!pobiId) {
        throw new AppError(500, ErrorCodes.INTERNAL_ERROR, 'Failed to create Pobi.');
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    const pobi = await this.getPobiByIdForOwner(ownerUserId, pobiId);
    this.logger.info({ pobiId: pobi.id, ownerUserId, botKey: pobi.botKey }, 'Owner Pobi created');
    return pobi;
  }

  async updatePobi(
    ownerUserId: string,
    pobiId: string,
    input: {
      name?: string;
      theme?: string;
      setDefault?: boolean;
    }
  ): Promise<PobiSummary> {
    const current = await this.getPobiRowByIdForOwner(ownerUserId, pobiId);
    const nextName = input.name === undefined ? current.display_name : input.name.trim();
    const nextTheme = input.theme === undefined ? current.theme : this.normalizeTheme(input.theme);

    if (nextName.length < 1 || nextName.length > 40) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Pobi name must be 1-40 characters.');
    }

    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      if (input.setDefault) {
        await client.query(
          `UPDATE pobis
           SET is_default = FALSE,
               updated_at = NOW()
           WHERE owner_user_id = $1
             AND is_active = TRUE`,
          [ownerUserId]
        );
      }

      await client.query(
        `UPDATE pobis
         SET display_name = $2,
             theme = $3,
             is_default = CASE WHEN $4::boolean THEN TRUE ELSE is_default END,
             updated_at = NOW()
         WHERE id = $1`,
        [current.pobi_id, nextName, nextTheme, !!input.setDefault]
      );

      await client.query(
        `UPDATE bots
         SET name = $2
         WHERE id = $1`,
        [current.bot_id, nextName]
      );

      await client.query(
        `UPDATE users
         SET display_name = $2,
             updated_at = NOW()
         WHERE id = $1`,
        [current.bot_user_id, nextName]
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    return this.getPobiByIdForOwner(ownerUserId, pobiId);
  }

  async createOrGetDirectRoom(ownerUserId: string, pobiId: string): Promise<PobiRoomResult> {
    const pobi = await this.getPobiByIdForOwner(ownerUserId, pobiId);
    const room = await this.socialService.createOrGetDirectRoom(ownerUserId, pobi.botUserId);
    return { pobi, room };
  }

  async joinPobiToRoom(ownerUserId: string, pobiId: string, roomId: string): Promise<PobiRoomResult> {
    const pobi = await this.getPobiByIdForOwner(ownerUserId, pobiId);

    const existing = await this.db.query<{ exists: boolean }>(
      `SELECT EXISTS(
         SELECT 1
         FROM room_members rm
         WHERE rm.room_id = $1
           AND rm.user_id = $2
           AND rm.left_at IS NULL
       ) AS exists`,
      [roomId, pobi.botUserId]
    );

    if (!(existing.rows[0]?.exists ?? false)) {
      const ownerAlreadyHasPobi = await this.db.query<{ exists: boolean }>(
        `SELECT EXISTS(
           SELECT 1
           FROM room_members rm
           INNER JOIN bots b ON b.user_id = rm.user_id
           INNER JOIN pobis p ON p.bot_id = b.id
           WHERE rm.room_id = $1
             AND rm.left_at IS NULL
             AND p.owner_user_id = $2
             AND rm.user_id <> $3
         ) AS exists`,
        [roomId, ownerUserId, pobi.botUserId]
      );

      if (ownerAlreadyHasPobi.rows[0]?.exists) {
        throw new AppError(409, ErrorCodes.CONFLICT, 'Only one active Pobi can join a room per owner.');
      }

      await this.socialService.addBotMemberToRoom({
        userId: ownerUserId,
        roomId,
        botUserId: pobi.botUserId
      });
    }

    const room = await this.socialService.getRoomByIdForUser(ownerUserId, roomId);
    return { pobi, room };
  }

  async leavePobiFromRoom(ownerUserId: string, pobiId: string, roomId: string): Promise<{ roomId: string; removed: true }> {
    const pobi = await this.getPobiByIdForOwner(ownerUserId, pobiId);
    return this.socialService.removeBotMemberFromRoom({
      userId: ownerUserId,
      roomId,
      botUserId: pobi.botUserId
    });
  }

  private async getPobiByIdForOwner(ownerUserId: string, pobiId: string): Promise<PobiSummary> {
    const row = await this.getPobiRowByIdForOwner(ownerUserId, pobiId);
    return this.mapPobi(row);
  }

  private async getPobiRowByIdForOwner(ownerUserId: string, pobiId: string, client?: PoolClient): Promise<PobiRow> {
    const executor = client ?? this.db;
    const result = await executor.query<PobiRow>(
      `SELECT p.id AS pobi_id,
              p.owner_user_id,
              p.display_name,
              p.theme,
              p.is_default AS pobi_is_default,
              p.is_active AS pobi_is_active,
              p.created_at AS pobi_created_at,
              p.updated_at AS pobi_updated_at,
              b.id AS bot_id,
              b.bot_key,
              b.user_id AS bot_user_id
       FROM pobis p
       INNER JOIN bots b ON b.id = p.bot_id
       WHERE p.id = $1
         AND p.owner_user_id = $2
         AND p.is_active = TRUE
         AND b.is_active = TRUE
       LIMIT 1`,
      [pobiId, ownerUserId]
    );

    const row = result.rows[0];
    if (!row) {
      throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, 'Pobi not found.');
    }

    return row;
  }

  private normalizeTheme(theme?: string): string {
    const normalized = (theme || '').trim().toLowerCase();
    if (!normalized) {
      return 'seed';
    }

    if (!POBI_THEMES.has(normalized)) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Unsupported Pobi theme.');
    }

    return normalized;
  }

  private mapPobi(row: PobiRow): PobiSummary {
    return {
      id: row.pobi_id,
      name: row.display_name,
      theme: row.theme,
      botId: row.bot_id,
      botKey: row.bot_key,
      botUserId: row.bot_user_id,
      isDefault: row.pobi_is_default,
      isActive: row.pobi_is_active,
      createdAt: row.pobi_created_at.toISOString(),
      updatedAt: row.pobi_updated_at.toISOString()
    };
  }
}
