import { customAlphabet } from 'nanoid';
import type { FastifyBaseLogger } from 'fastify';
import type { Pool, PoolClient } from 'pg';
import type { AppEnv } from '../../config/env';
import { AppError, ErrorCodes } from '../../lib/errors';

const pairingCodeGenerator = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6);

type RelationshipType = 'friend' | 'parent_child';

type PairingCodeRow = {
  id: string;
  code: string;
  created_by: string;
  consumed_by: string | null;
  relationship_type: RelationshipType;
  created_at: Date;
  expires_at: Date;
  consumed_at: Date | null;
};

type UserRoleRow = {
  id: string;
  role: 'parent' | 'user';
};

type RelationshipRow = {
  id: string;
  pair_key: string;
  user_a_id: string;
  user_b_id: string;
  relationship_type: RelationshipType;
  status: 'active' | 'blocked' | 'deleted';
  created_at: Date;
};

type RelationshipListRow = {
  relationship_id: string;
  relationship_type: RelationshipType;
  relationship_status: 'active' | 'blocked' | 'deleted';
  peer_user_id: string;
  peer_email: string;
  peer_role: 'parent' | 'user';
  peer_display_name: string | null;
  room_id: string | null;
  created_at: Date;
};

function getPairKey(userIdA: string, userIdB: string): { pairKey: string; userAId: string; userBId: string } {
  const [userAId, userBId] = [userIdA, userIdB].sort();
  return {
    pairKey: `${userAId}:${userBId}`,
    userAId,
    userBId
  };
}

export class PairingService {
  constructor(
    private readonly db: Pool,
    private readonly env: AppEnv,
    private readonly logger: FastifyBaseLogger
  ) {}

  async createCode(
    createdByUserId: string,
    ttlSeconds?: number,
    relationshipType: RelationshipType = 'friend'
  ): Promise<{
    code: string;
    relationshipType: RelationshipType;
    expiresAt: string;
    ttlSeconds: number;
  }> {
    const effectiveTtlSeconds = ttlSeconds && ttlSeconds > 0 ? ttlSeconds : this.env.PAIRING_CODE_TTL_SECONDS;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = pairingCodeGenerator();
      const expiresAt = new Date(Date.now() + effectiveTtlSeconds * 1000);

      try {
        await this.db.query(
          `INSERT INTO pairing_codes (code, created_by, expires_at, relationship_type)
           VALUES ($1, $2, $3, $4)`,
          [code, createdByUserId, expiresAt, relationshipType]
        );

        return {
          code,
          relationshipType,
          expiresAt: expiresAt.toISOString(),
          ttlSeconds: effectiveTtlSeconds
        };
      } catch (error) {
        this.logger.warn({ error, attempt, createdByUserId }, 'Pairing code collision detected. Retrying.');
      }
    }

    throw new AppError(500, ErrorCodes.INTERNAL_ERROR, 'Failed to generate pairing code. Please retry.');
  }

  async consumeCode(userId: string, codeInput: string): Promise<{
    code: string;
    pairedWithUserId: string;
    relationshipType: RelationshipType;
    relationshipId: string;
    roomId: string;
    consumedAt: string;
  }> {
    const code = codeInput.trim().toUpperCase();
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      const selectResult = await client.query<PairingCodeRow>(
        `SELECT id, code, created_by, consumed_by, relationship_type, created_at, expires_at, consumed_at
         FROM pairing_codes
         WHERE code = $1
         FOR UPDATE`,
        [code]
      );

      const row = selectResult.rows[0];
      if (!row) {
        throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, 'Pairing code not found.');
      }

      if (row.created_by === userId) {
        throw new AppError(409, ErrorCodes.CONFLICT, 'You cannot consume your own pairing code.');
      }

      if (row.consumed_at) {
        throw new AppError(409, ErrorCodes.CONFLICT, 'Pairing code already consumed.');
      }

      if (row.expires_at.getTime() <= Date.now()) {
        throw new AppError(410, ErrorCodes.RESOURCE_NOT_FOUND, 'Pairing code has expired.');
      }

      const roleByUserId = await this.fetchUserRoles(client, row.created_by, userId);
      this.validateRelationshipType(row.relationship_type, roleByUserId[row.created_by], roleByUserId[userId]);

      await client.query(
        `UPDATE pairing_codes
         SET consumed_by = $1, consumed_at = NOW()
         WHERE id = $2`,
        [userId, row.id]
      );

      const relationship = await this.createRelationshipIfMissing(client, {
        userIdA: row.created_by,
        userIdB: userId,
        relationshipType: row.relationship_type,
        createdBy: row.created_by
      });

      const roomId = await this.createRoomIfMissing(client, row.created_by, userId);

      await client.query('COMMIT');

      return {
        code: row.code,
        pairedWithUserId: row.created_by,
        relationshipType: row.relationship_type,
        relationshipId: relationship.id,
        roomId,
        consumedAt: new Date().toISOString()
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async listRelationships(userId: string): Promise<
    Array<{
      relationshipId: string;
      relationshipType: RelationshipType;
      status: 'active' | 'blocked' | 'deleted';
      peer: {
        userId: string;
        email: string;
        role: 'parent' | 'user';
        displayName?: string;
      };
      roomId?: string;
      createdAt: string;
    }>
  > {
    const result = await this.db.query<RelationshipListRow>(
      `SELECT ur.id AS relationship_id,
              ur.relationship_type,
              ur.status AS relationship_status,
              CASE WHEN ur.user_a_id = $1 THEN ur.user_b_id ELSE ur.user_a_id END AS peer_user_id,
              pu.email AS peer_email,
              pu.role AS peer_role,
              pu.display_name AS peer_display_name,
              cr.id AS room_id,
              ur.created_at
       FROM user_relationships ur
       INNER JOIN users pu
               ON pu.id = CASE WHEN ur.user_a_id = $1 THEN ur.user_b_id ELSE ur.user_a_id END
       LEFT JOIN chat_rooms cr
              ON cr.pair_key = ur.pair_key
       WHERE ur.user_a_id = $1
          OR ur.user_b_id = $1
       ORDER BY ur.created_at DESC`,
      [userId]
    );

    return result.rows.map((row) => ({
      relationshipId: row.relationship_id,
      relationshipType: row.relationship_type,
      status: row.relationship_status,
      peer: {
        userId: row.peer_user_id,
        email: row.peer_email,
        role: row.peer_role,
        ...(row.peer_display_name ? { displayName: row.peer_display_name } : {})
      },
      ...(row.room_id ? { roomId: row.room_id } : {}),
      createdAt: row.created_at.toISOString()
    }));
  }

  private async fetchUserRoles(client: PoolClient, creatorId: string, consumerId: string): Promise<Record<string, 'parent' | 'user'>> {
    const users = await client.query<UserRoleRow>(
      `SELECT id, role
       FROM users
       WHERE id = ANY($1::uuid[])`,
      [[creatorId, consumerId]]
    );

    const map: Record<string, 'parent' | 'user'> = {};
    for (const row of users.rows) {
      map[row.id] = row.role;
    }

    if (!map[creatorId] || !map[consumerId]) {
      throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, 'User not found for pairing.');
    }

    return map;
  }

  private validateRelationshipType(
    relationshipType: RelationshipType,
    creatorRole: 'parent' | 'user',
    consumerRole: 'parent' | 'user'
  ): void {
    if (relationshipType !== 'parent_child') {
      return;
    }

    const valid =
      (creatorRole === 'parent' && consumerRole === 'user') ||
      (creatorRole === 'user' && consumerRole === 'parent');

    if (!valid) {
      throw new AppError(
        409,
        ErrorCodes.CONFLICT,
        'parent_child pairing requires one parent account and one user account.'
      );
    }
  }

  private async createRelationshipIfMissing(
    client: PoolClient,
    params: {
      userIdA: string;
      userIdB: string;
      relationshipType: RelationshipType;
      createdBy: string;
    }
  ): Promise<RelationshipRow> {
    const { pairKey, userAId, userBId } = getPairKey(params.userIdA, params.userIdB);

    const insert = await client.query<RelationshipRow>(
      `INSERT INTO user_relationships (pair_key, user_a_id, user_b_id, relationship_type, status, created_via, created_by)
       VALUES ($1, $2, $3, $4, 'active', 'pairing', $5)
       ON CONFLICT (pair_key, relationship_type)
       DO UPDATE SET
         status = 'active'
       RETURNING id, pair_key, user_a_id, user_b_id, relationship_type, status, created_at`,
      [pairKey, userAId, userBId, params.relationshipType, params.createdBy]
    );

    return insert.rows[0];
  }

  private async createRoomIfMissing(client: PoolClient, userIdA: string, userIdB: string): Promise<string> {
    const { pairKey, userAId, userBId } = getPairKey(userIdA, userIdB);

    const room = await client.query<{ id: string }>(
      `INSERT INTO chat_rooms (pair_key, user_a_id, user_b_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (pair_key)
       DO UPDATE SET
         pair_key = EXCLUDED.pair_key
       RETURNING id`,
      [pairKey, userAId, userBId]
    );

    return room.rows[0].id;
  }
}
