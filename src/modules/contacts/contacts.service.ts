import type { FastifyBaseLogger } from 'fastify';
import type { Pool, PoolClient } from 'pg';
import { AppError, ErrorCodes } from '../../lib/errors';
import { toSafeUser } from '../../lib/user';

type ContactType = 'email' | 'phone';

type ContactInput = {
  type: ContactType;
  hash: string;
  label?: string;
};

type UserRow = {
  id: string;
  email: string;
  role: string;
  auth_provider: 'local' | 'google';
  display_name: string | null;
  phone_e164: string | null;
  created_at: Date;
};

type MatchRow = UserRow & {
  matched_by: ContactType;
  source_label: string | null;
  matched_at: Date;
};

function normalizeContacts(contacts: ContactInput[]): ContactInput[] {
  const deduped = new Map<string, ContactInput>();

  for (const raw of contacts) {
    const type = raw.type;
    const hash = raw.hash.trim().toLowerCase();
    const key = `${type}:${hash}`;

    deduped.set(key, {
      type,
      hash,
      ...(raw.label?.trim() ? { label: raw.label.trim().slice(0, 120) } : {})
    });
  }

  return [...deduped.values()];
}

export class ContactsService {
  constructor(
    private readonly db: Pool,
    private readonly logger: FastifyBaseLogger
  ) {}

  async syncContacts(params: {
    userId: string;
    contacts: ContactInput[];
    clearMissing?: boolean;
  }): Promise<{ syncedCount: number; totalStoredCount: number }> {
    const contacts = normalizeContacts(params.contacts);
    if (contacts.length > 5000) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Too many contacts. Maximum 5000 items per sync call.');
    }

    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      if (params.clearMissing) {
        await client.query('DELETE FROM contact_hashes WHERE owner_user_id = $1', [params.userId]);
      }

      for (const contact of contacts) {
        await this.upsertContact(client, params.userId, contact);
      }

      const countResult = await client.query<{ count: string }>(
        'SELECT count(*) AS count FROM contact_hashes WHERE owner_user_id = $1',
        [params.userId]
      );

      await client.query('COMMIT');

      return {
        syncedCount: contacts.length,
        totalStoredCount: Number(countResult.rows[0]?.count ?? 0)
      };
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error({ error, userId: params.userId }, 'Failed to sync contact hashes');
      throw error;
    } finally {
      client.release();
    }
  }

  async getMatchCandidates(params: {
    userId: string;
    limit: number;
  }): Promise<
    Array<{
      user: ReturnType<typeof toSafeUser>;
      matchedBy: ContactType;
      sourceLabel?: string;
      matchedAt: string;
    }>
  > {
    const result = await this.db.query<MatchRow>(
      `SELECT m.id,
              m.email,
              m.role,
              m.auth_provider,
              m.display_name,
              m.phone_e164,
              m.created_at,
              m.matched_by,
              m.source_label,
              m.matched_at
       FROM (
         SELECT DISTINCT ON (candidate.id)
                candidate.id,
                candidate.email,
                candidate.role,
                candidate.auth_provider,
                candidate.display_name,
                candidate.phone_e164,
                candidate.created_at,
                candidate.matched_by,
                candidate.source_label,
                candidate.matched_at
         FROM (
           SELECT u.id,
                  u.email,
                  u.role,
                  u.auth_provider,
                  u.display_name,
                  u.phone_e164,
                  u.created_at,
                  'email'::text AS matched_by,
                  ch.label AS source_label,
                  ch.updated_at AS matched_at
           FROM contact_hashes ch
           INNER JOIN users u
                   ON ch.contact_type = 'email'
                  AND ch.contact_hash = encode(digest(lower(u.email), 'sha256'), 'hex')
           WHERE ch.owner_user_id = $1
             AND u.id <> $1

           UNION ALL

           SELECT u.id,
                  u.email,
                  u.role,
                  u.auth_provider,
                  u.display_name,
                  u.phone_e164,
                  u.created_at,
                  'phone'::text AS matched_by,
                  ch.label AS source_label,
                  ch.updated_at AS matched_at
           FROM contact_hashes ch
           INNER JOIN users u
                   ON ch.contact_type = 'phone'
                  AND u.phone_e164 IS NOT NULL
                  AND ch.contact_hash = encode(digest(u.phone_e164, 'sha256'), 'hex')
           WHERE ch.owner_user_id = $1
             AND u.id <> $1
         ) AS candidate
         ORDER BY candidate.id, candidate.matched_at DESC
       ) AS m
       ORDER BY m.matched_at DESC
       LIMIT $2`,
      [params.userId, params.limit]
    );

    return result.rows.map((row) => ({
      user: toSafeUser(row),
      matchedBy: row.matched_by,
      ...(row.source_label ? { sourceLabel: row.source_label } : {}),
      matchedAt: row.matched_at.toISOString()
    }));
  }

  async getContactStatus(userId: string): Promise<{
    totalStoredCount: number;
    emailCount: number;
    phoneCount: number;
  }> {
    const result = await this.db.query<
      {
        total_count: string;
        email_count: string;
        phone_count: string;
      }
    >(
      `SELECT count(*) AS total_count,
              count(*) FILTER (WHERE contact_type = 'email') AS email_count,
              count(*) FILTER (WHERE contact_type = 'phone') AS phone_count
       FROM contact_hashes
       WHERE owner_user_id = $1`,
      [userId]
    );

    const row = result.rows[0];

    return {
      totalStoredCount: Number(row?.total_count ?? 0),
      emailCount: Number(row?.email_count ?? 0),
      phoneCount: Number(row?.phone_count ?? 0)
    };
  }

  private async upsertContact(client: PoolClient, userId: string, contact: ContactInput): Promise<void> {
    await client.query(
      `INSERT INTO contact_hashes (owner_user_id, contact_type, contact_hash, label, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (owner_user_id, contact_type, contact_hash)
       DO UPDATE SET
         label = COALESCE(EXCLUDED.label, contact_hashes.label),
         updated_at = NOW()`,
      [userId, contact.type, contact.hash, contact.label ?? null]
    );
  }
}
