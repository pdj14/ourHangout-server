import { promises as fs } from 'fs';
import type { Dirent } from 'fs';
import { relative, resolve } from 'path';
import type { FastifyBaseLogger } from 'fastify';
import type { Pool } from 'pg';
import { env } from '../../config/env';
import { AppError, ErrorCodes } from '../../lib/errors';
import { normalizePhoneE164 } from '../../lib/phone';
import type { MessageDelivery, MessageKind, RoomType } from '../social/social.types';

type UserRole = 'parent' | 'user';
type AssetStatus = 'pending' | 'completed' | 'failed';

type SummaryUsersRow = {
  total_users: number;
  parent_users: number;
  child_users: number;
};

type SummaryRoomsRow = {
  total_rooms: number;
  direct_rooms: number;
  group_rooms: number;
};

type SummaryMessagesRow = {
  total_messages: number;
  text_messages: number;
  image_messages: number;
  video_messages: number;
  system_messages: number;
  recent_test_messages: number;
};

type SummaryAssetsRow = {
  total_assets: number;
  completed_assets: number;
  pending_assets: number;
  failed_assets: number;
  tracked_bytes: string | number;
};

type CountRow = {
  count: number;
};

type TopStorageUserRow = {
  id: string;
  email: string;
  display_name: string | null;
  storage_bytes: string | number;
  asset_count: number;
};

type GuardianUserRow = {
  id: string;
  email: string;
  role: UserRole;
  display_name: string | null;
  status_message: string | null;
  phone_e164: string | null;
  locale: string | null;
  created_at: Date;
  updated_at: Date;
  room_count: number;
  message_count: number;
  storage_bytes: string | number;
  family_link_count: number;
};

type FamilyLinkRow = {
  relationship_id: string;
  created_at: Date;
  parent_id: string;
  parent_email: string;
  parent_display_name: string | null;
  child_id: string;
  child_email: string;
  child_display_name: string | null;
};

type GuardianRoomRow = {
  id: string;
  type: RoomType;
  title: string | null;
  created_at: Date;
  updated_at: Date;
  message_count: number;
  active_member_count: number;
  last_message_id: string | null;
  last_message_kind: MessageKind | null;
  last_message_text: string | null;
  last_message_created_at: Date | null;
  last_message_sender_id: string | null;
  last_message_sender_name: string | null;
  last_message_sender_email: string | null;
};

type GuardianRoomMemberRow = {
  room_id: string;
  user_id: string;
  email: string;
  role: UserRole;
  display_name: string | null;
};

type ManagedMessageRow = {
  id: string;
  room_id: string;
  room_type: RoomType;
  room_title: string | null;
  sender_id: string | null;
  kind: MessageKind;
  text: string | null;
  media_url: string | null;
  delivery: MessageDelivery;
  created_at: Date;
  sender_display_name: string | null;
  sender_email: string | null;
};

type AssetOverviewRow = {
  kind: 'image' | 'video' | 'avatar';
  asset_count: number;
  total_bytes: string | number;
};

type AssetListRow = {
  id: string;
  owner_user_id: string;
  owner_email: string;
  owner_display_name: string | null;
  kind: 'image' | 'video' | 'avatar';
  mime_type: string;
  size_bytes: number;
  file_url: string;
  status: AssetStatus;
  created_at: Date;
  updated_at: Date;
  referenced_by_avatar: boolean;
  message_reference_count: number;
};

type AssetDeleteRow = {
  id: string;
  file_url: string;
  referenced_by_avatar: boolean;
  message_reference_count: number;
};

type TrackedAssetPathRow = {
  file_url: string;
  status: AssetStatus;
};

type StorageFileEntry = {
  absolutePath: string;
  relativePath: string;
  sizeBytes: number;
};

function normalizeName(displayName: string | null, email: string): string {
  if (displayName && displayName.trim().length > 0) {
    return displayName.trim();
  }

  return email;
}

function normalizeMessagePreview(kind: MessageKind | null, text: string | null): string | null {
  if (!kind) {
    return null;
  }

  if (kind === 'image') return '[image]';
  if (kind === 'video') return '[video]';
  return text?.trim() || null;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function getMediaPublicPrefix(): string {
  return `${trimTrailingSlash(env.PUBLIC_BASE_URL)}/v1/media/files/`;
}

function getMediaStorageRoot(): string {
  return resolve(process.cwd(), env.MEDIA_STORAGE_DIR);
}

function resolveMediaStoragePath(fileUrl: string): string {
  const prefix = getMediaPublicPrefix();
  if (!fileUrl.startsWith(prefix)) {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Unsupported media file URL.');
  }

  const relativePath = fileUrl.slice(prefix.length).replace(/^\/+/, '');
  if (!relativePath) {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Missing media file path.');
  }

  const root = getMediaStorageRoot();
  const absolutePath = resolve(root, relativePath);
  const relativeToRoot = relative(root, absolutePath);

  if (!relativeToRoot || relativeToRoot.startsWith('..')) {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Invalid media file path.');
  }

  return absolutePath;
}

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}

function normalizeLimit(limit: number | undefined, defaultValue: number, max: number): number {
  if (limit === undefined) {
    return defaultValue;
  }

  const normalized = Math.floor(limit);
  if (!Number.isFinite(normalized) || normalized < 1) {
    return defaultValue;
  }

  return Math.min(normalized, max);
}

function normalizeLocaleValue(locale: string | null | undefined): string | null {
  if (locale === null) {
    return null;
  }

  const trimmed = locale?.trim() || '';
  return trimmed.length > 0 ? trimmed : null;
}

async function collectStorageFiles(root: string, current = root): Promise<StorageFileEntry[]> {
  let entries: Dirent[];

  try {
    entries = await fs.readdir(current, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }

    throw error;
  }

  const files: StorageFileEntry[] = [];

  for (const entry of entries) {
    const absolutePath = resolve(current, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectStorageFiles(root, absolutePath)));
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const stat = await fs.stat(absolutePath);
    files.push({
      absolutePath,
      relativePath: relative(root, absolutePath).replace(/\\/g, '/'),
      sizeBytes: stat.size
    });
  }

  return files;
}

export class GuardianService {
  constructor(
    private readonly db: Pool,
    private readonly logger: FastifyBaseLogger
  ) {}

  async getSummary(requesterUserId: string): Promise<{
    users: {
      total: number;
      parents: number;
      children: number;
    };
    rooms: {
      total: number;
      direct: number;
      group: number;
    };
    messages: {
      total: number;
      text: number;
      image: number;
      video: number;
      system: number;
      recentTestLike: number;
    };
    moderation: {
      parentChildLinks: number;
      openReports: number;
    };
    storage: {
      trackedAssets: number;
      completedAssets: number;
      pendingAssets: number;
      failedAssets: number;
      trackedBytes: number;
      actualDiskBytes: number;
      orphanFileCount: number;
      missingTrackedFileCount: number;
    };
    topStorageUsers: Array<{
      userId: string;
      email: string;
      name: string;
      storageBytes: number;
      assetCount: number;
    }>;
    orphanFiles: Array<{
      relativePath: string;
      sizeBytes: number;
    }>;
  }> {
    await this.assertParentRole(requesterUserId);

    const [usersRow, roomsRow, messagesRow, reportsRow, linksRow, assetsRow, topStorageUsers, storageAudit] =
      await Promise.all([
        this.db.query<SummaryUsersRow>(
          `SELECT COUNT(*)::int AS total_users,
                  COUNT(*) FILTER (WHERE role = 'parent')::int AS parent_users,
                  COUNT(*) FILTER (WHERE role = 'user')::int AS child_users
           FROM users`
        ),
        this.db.query<SummaryRoomsRow>(
          `SELECT COUNT(*)::int AS total_rooms,
                  COUNT(*) FILTER (WHERE type = 'direct')::int AS direct_rooms,
                  COUNT(*) FILTER (WHERE type = 'group')::int AS group_rooms
           FROM rooms
           WHERE deleted_at IS NULL`
        ),
        this.db.query<SummaryMessagesRow>(
          `SELECT COUNT(*)::int AS total_messages,
                  COUNT(*) FILTER (WHERE kind = 'text')::int AS text_messages,
                  COUNT(*) FILTER (WHERE kind = 'image')::int AS image_messages,
                  COUNT(*) FILTER (WHERE kind = 'video')::int AS video_messages,
                  COUNT(*) FILTER (WHERE kind = 'system')::int AS system_messages,
                  COUNT(*) FILTER (
                    WHERE kind IN ('text', 'system')
                      AND lower(COALESCE(text, '')) LIKE '%test%'
                  )::int AS recent_test_messages
           FROM room_messages`
        ),
        this.db.query<CountRow>(`SELECT COUNT(*)::int AS count FROM reports WHERE status = 'open'`),
        this.db.query<CountRow>(
          `SELECT COUNT(*)::int AS count
           FROM user_relationships
           WHERE relationship_type = 'parent_child'
             AND status = 'active'`
        ),
        this.db.query<SummaryAssetsRow>(
          `SELECT COUNT(*)::int AS total_assets,
                  COUNT(*) FILTER (WHERE status = 'completed')::int AS completed_assets,
                  COUNT(*) FILTER (WHERE status = 'pending')::int AS pending_assets,
                  COUNT(*) FILTER (WHERE status = 'failed')::int AS failed_assets,
                  COALESCE(SUM(size_bytes), 0)::bigint AS tracked_bytes
           FROM media_assets`
        ),
        this.db.query<TopStorageUserRow>(
          `SELECT u.id,
                  u.email,
                  u.display_name,
                  COALESCE(SUM(ma.size_bytes) FILTER (WHERE ma.status = 'completed'), 0)::bigint AS storage_bytes,
                  COUNT(ma.id) FILTER (WHERE ma.status = 'completed')::int AS asset_count
           FROM users u
           LEFT JOIN media_assets ma ON ma.owner_user_id = u.id
           GROUP BY u.id, u.email, u.display_name
           HAVING COALESCE(SUM(ma.size_bytes) FILTER (WHERE ma.status = 'completed'), 0) > 0
           ORDER BY storage_bytes DESC, asset_count DESC, u.created_at ASC
           LIMIT 8`
        ),
        this.auditStorage()
      ]);

    const users = usersRow.rows[0];
    const rooms = roomsRow.rows[0];
    const messages = messagesRow.rows[0];
    const openReports = reportsRow.rows[0];
    const links = linksRow.rows[0];
    const assets = assetsRow.rows[0];

    return {
      users: {
        total: users?.total_users ?? 0,
        parents: users?.parent_users ?? 0,
        children: users?.child_users ?? 0
      },
      rooms: {
        total: rooms?.total_rooms ?? 0,
        direct: rooms?.direct_rooms ?? 0,
        group: rooms?.group_rooms ?? 0
      },
      messages: {
        total: messages?.total_messages ?? 0,
        text: messages?.text_messages ?? 0,
        image: messages?.image_messages ?? 0,
        video: messages?.video_messages ?? 0,
        system: messages?.system_messages ?? 0,
        recentTestLike: messages?.recent_test_messages ?? 0
      },
      moderation: {
        parentChildLinks: links?.count ?? 0,
        openReports: openReports?.count ?? 0
      },
      storage: {
        trackedAssets: assets?.total_assets ?? 0,
        completedAssets: assets?.completed_assets ?? 0,
        pendingAssets: assets?.pending_assets ?? 0,
        failedAssets: assets?.failed_assets ?? 0,
        trackedBytes: toNumber(assets?.tracked_bytes),
        actualDiskBytes: storageAudit.actualDiskBytes,
        orphanFileCount: storageAudit.orphanFiles.length,
        missingTrackedFileCount: storageAudit.missingTrackedFileCount
      },
      topStorageUsers: topStorageUsers.rows.map((row) => ({
        userId: row.id,
        email: row.email,
        name: normalizeName(row.display_name, row.email),
        storageBytes: toNumber(row.storage_bytes),
        assetCount: row.asset_count
      })),
      orphanFiles: storageAudit.orphanFiles.slice(0, 12).map((entry) => ({
        relativePath: entry.relativePath,
        sizeBytes: entry.sizeBytes
      }))
    };
  }

  async listUsers(
    requesterUserId: string,
    params: {
      q?: string;
      role?: UserRole;
      limit?: number;
    }
  ): Promise<{
    items: Array<{
      id: string;
      email: string;
      role: UserRole;
      displayName?: string;
      effectiveName: string;
      statusMessage?: string;
      phoneE164?: string;
      locale?: string;
      roomCount: number;
      messageCount: number;
      storageBytes: number;
      familyLinkCount: number;
      createdAt: string;
      updatedAt: string;
    }>;
  }> {
    await this.assertParentRole(requesterUserId);

    const limit = normalizeLimit(params.limit, 100, 200);
    const filters: string[] = [];
    const values: unknown[] = [];

    if (params.role) {
      values.push(params.role);
      filters.push(`u.role = $${values.length}`);
    }

    const q = params.q?.trim();
    if (q) {
      values.push(`%${q.toLowerCase()}%`);
      filters.push(
        `(lower(u.email) LIKE $${values.length}
          OR lower(COALESCE(u.display_name, '')) LIKE $${values.length}
          OR lower(COALESCE(u.phone_e164, '')) LIKE $${values.length})`
      );
    }

    values.push(limit);
    const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

    const result = await this.db.query<GuardianUserRow>(
      `SELECT u.id,
              u.email,
              u.role,
              u.display_name,
              u.status_message,
              u.phone_e164,
              u.locale,
              u.created_at,
              u.updated_at,
              COALESCE(room_stats.room_count, 0)::int AS room_count,
              COALESCE(message_stats.message_count, 0)::int AS message_count,
              COALESCE(asset_stats.storage_bytes, 0)::bigint AS storage_bytes,
              COALESCE(link_stats.family_link_count, 0)::int AS family_link_count
       FROM users u
       LEFT JOIN (
         SELECT mem.user_id,
                COUNT(DISTINCT mem.room_id)::int AS room_count
         FROM room_members mem
         INNER JOIN rooms r ON r.id = mem.room_id
         WHERE r.deleted_at IS NULL
           AND (r.type = 'direct' OR mem.left_at IS NULL)
         GROUP BY mem.user_id
       ) room_stats ON room_stats.user_id = u.id
       LEFT JOIN (
         SELECT sender_id AS user_id,
                COUNT(*)::int AS message_count
         FROM room_messages
         WHERE sender_id IS NOT NULL
         GROUP BY sender_id
       ) message_stats ON message_stats.user_id = u.id
       LEFT JOIN (
         SELECT owner_user_id AS user_id,
                COALESCE(SUM(size_bytes) FILTER (WHERE status = 'completed'), 0)::bigint AS storage_bytes
         FROM media_assets
         GROUP BY owner_user_id
       ) asset_stats ON asset_stats.user_id = u.id
       LEFT JOIN (
         SELECT user_id,
                COUNT(*)::int AS family_link_count
         FROM (
           SELECT user_a_id AS user_id
           FROM user_relationships
           WHERE relationship_type = 'parent_child'
             AND status = 'active'
           UNION ALL
           SELECT user_b_id AS user_id
           FROM user_relationships
           WHERE relationship_type = 'parent_child'
             AND status = 'active'
         ) related
         GROUP BY user_id
       ) link_stats ON link_stats.user_id = u.id
       ${whereClause}
       ORDER BY u.created_at DESC, u.id DESC
       LIMIT $${values.length}`,
      values
    );

    return {
      items: result.rows.map((row) => ({
        id: row.id,
        email: row.email,
        role: row.role,
        ...(row.display_name ? { displayName: row.display_name } : {}),
        effectiveName: normalizeName(row.display_name, row.email),
        ...(row.status_message ? { statusMessage: row.status_message } : {}),
        ...(row.phone_e164 ? { phoneE164: row.phone_e164 } : {}),
        ...(row.locale ? { locale: row.locale } : {}),
        roomCount: row.room_count,
        messageCount: row.message_count,
        storageBytes: toNumber(row.storage_bytes),
        familyLinkCount: row.family_link_count,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString()
      }))
    };
  }

  async updateUser(
    requesterUserId: string,
    targetUserId: string,
    input: {
      role?: UserRole;
      displayName?: string | null;
      statusMessage?: string | null;
      phoneE164?: string | null;
      locale?: string | null;
    }
  ): Promise<{
    id: string;
    email: string;
    role: UserRole;
    displayName?: string;
    effectiveName: string;
    statusMessage?: string;
    phoneE164?: string;
    locale?: string;
    createdAt: string;
    updatedAt: string;
  }> {
    await this.assertParentRole(requesterUserId);

    const hasRole = input.role !== undefined;
    const hasDisplayName = input.displayName !== undefined;
    const hasStatusMessage = input.statusMessage !== undefined;
    const hasPhone = input.phoneE164 !== undefined;
    const hasLocale = input.locale !== undefined;

    if (!hasRole && !hasDisplayName && !hasStatusMessage && !hasPhone && !hasLocale) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'At least one field must be provided for update.');
    }

    let normalizedPhone: string | null = null;
    if (hasPhone) {
      const trimmed = input.phoneE164?.trim();
      if (trimmed) {
        normalizedPhone = normalizePhoneE164(trimmed);
        if (!normalizedPhone) {
          throw new AppError(
            400,
            ErrorCodes.AUTH_PHONE_INVALID,
            'Phone format is invalid. Use E.164 format, for example +821012345678.'
          );
        }
      }
    }

    const displayName = hasDisplayName ? input.displayName?.trim() || null : null;
    const statusMessage = hasStatusMessage ? input.statusMessage?.trim() || null : null;
    const locale = hasLocale ? normalizeLocaleValue(input.locale) : null;

    try {
      const result = await this.db.query<GuardianUserRow>(
        `UPDATE users
         SET role = CASE WHEN $2::boolean THEN $3 ELSE role END,
             display_name = CASE WHEN $4::boolean THEN $5 ELSE display_name END,
             status_message = CASE WHEN $6::boolean THEN $7 ELSE status_message END,
             phone_e164 = CASE WHEN $8::boolean THEN $9 ELSE phone_e164 END,
             locale = CASE WHEN $10::boolean THEN $11 ELSE locale END,
             updated_at = NOW()
         WHERE id = $1
         RETURNING id,
                   email,
                   role,
                   display_name,
                   status_message,
                   phone_e164,
                   locale,
                   created_at,
                   updated_at,
                   0::int AS room_count,
                   0::int AS message_count,
                   0::bigint AS storage_bytes,
                   0::int AS family_link_count`,
        [
          targetUserId,
          hasRole,
          input.role ?? null,
          hasDisplayName,
          displayName,
          hasStatusMessage,
          statusMessage,
          hasPhone,
          normalizedPhone,
          hasLocale,
          locale
        ]
      );

      const row = result.rows[0];
      if (!row) {
        throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, 'User not found.');
      }

      return {
        id: row.id,
        email: row.email,
        role: row.role,
        ...(row.display_name ? { displayName: row.display_name } : {}),
        effectiveName: normalizeName(row.display_name, row.email),
        ...(row.status_message ? { statusMessage: row.status_message } : {}),
        ...(row.phone_e164 ? { phoneE164: row.phone_e164 } : {}),
        ...(row.locale ? { locale: row.locale } : {}),
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString()
      };
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        throw new AppError(409, ErrorCodes.CONFLICT, 'This phone number is already linked to another account.');
      }

      throw error;
    }
  }

  async revokeUserSessions(requesterUserId: string, targetUserId: string): Promise<{ revoked: boolean }> {
    await this.assertParentRole(requesterUserId);

    const result = await this.db.query<{ id: string }>(
      `UPDATE refresh_tokens
       SET revoked_at = NOW()
       WHERE user_id = $1
         AND revoked_at IS NULL
       RETURNING id`,
      [targetUserId]
    );

    return {
      revoked: (result.rowCount ?? 0) > 0
    };
  }

  async listFamilyLinks(requesterUserId: string): Promise<{
    items: Array<{
      relationshipId: string;
      createdAt: string;
      parent: {
        userId: string;
        email: string;
        name: string;
      };
      child: {
        userId: string;
        email: string;
        name: string;
      };
    }>;
  }> {
    await this.assertParentRole(requesterUserId);

    const result = await this.db.query<FamilyLinkRow>(
      `SELECT ur.id AS relationship_id,
              ur.created_at,
              parent_user.id AS parent_id,
              parent_user.email AS parent_email,
              parent_user.display_name AS parent_display_name,
              child_user.id AS child_id,
              child_user.email AS child_email,
              child_user.display_name AS child_display_name
       FROM user_relationships ur
       INNER JOIN users ua ON ua.id = ur.user_a_id
       INNER JOIN users ub ON ub.id = ur.user_b_id
       INNER JOIN users parent_user
               ON parent_user.id = CASE WHEN ua.role = 'parent' THEN ua.id ELSE ub.id END
       INNER JOIN users child_user
               ON child_user.id = CASE WHEN ua.role = 'user' THEN ua.id ELSE ub.id END
       WHERE ur.relationship_type = 'parent_child'
         AND ur.status = 'active'
       ORDER BY ur.created_at DESC, ur.id DESC`
    );

    return {
      items: result.rows.map((row) => ({
        relationshipId: row.relationship_id,
        createdAt: row.created_at.toISOString(),
        parent: {
          userId: row.parent_id,
          email: row.parent_email,
          name: normalizeName(row.parent_display_name, row.parent_email)
        },
        child: {
          userId: row.child_id,
          email: row.child_email,
          name: normalizeName(row.child_display_name, row.child_email)
        }
      }))
    };
  }

  async listRooms(
    requesterUserId: string,
    params: {
      type?: RoomType;
      memberUserId?: string;
      q?: string;
      limit?: number;
    }
  ): Promise<{
    items: Array<{
      id: string;
      type: RoomType;
      title: string;
      messageCount: number;
      activeMemberCount: number;
      createdAt: string;
      updatedAt: string;
      members: Array<{
        userId: string;
        email: string;
        role: UserRole;
        name: string;
      }>;
      lastMessage?: {
        id: string;
        senderId?: string;
        senderName: string;
        kind: MessageKind;
        preview?: string;
        createdAt: string;
      };
    }>;
  }> {
    await this.assertParentRole(requesterUserId);

    const limit = normalizeLimit(params.limit, 60, 120);
    const values: unknown[] = [params.type ?? null, params.memberUserId ?? null];
    const q = params.q?.trim();
    values.push(q ? `%${q.toLowerCase()}%` : null);
    values.push(limit);

    const result = await this.db.query<GuardianRoomRow>(
      `SELECT r.id,
              r.type,
              r.title,
              r.created_at,
              r.updated_at,
              COALESCE(message_stats.message_count, 0)::int AS message_count,
              COALESCE(member_stats.active_member_count, 0)::int AS active_member_count,
              last_message.id AS last_message_id,
              last_message.kind AS last_message_kind,
              last_message.text AS last_message_text,
              last_message.created_at AS last_message_created_at,
              last_message.sender_id AS last_message_sender_id,
              last_sender.display_name AS last_message_sender_name,
              last_sender.email AS last_message_sender_email
       FROM rooms r
       LEFT JOIN (
         SELECT room_id,
                COUNT(*)::int AS message_count
         FROM room_messages
         GROUP BY room_id
       ) message_stats ON message_stats.room_id = r.id
       LEFT JOIN (
         SELECT rm.room_id,
                COUNT(*) FILTER (WHERE rm.left_at IS NULL)::int AS active_member_count
         FROM room_members rm
         GROUP BY rm.room_id
       ) member_stats ON member_stats.room_id = r.id
       LEFT JOIN LATERAL (
         SELECT m.id,
                m.kind,
                m.text,
                m.created_at,
                m.sender_id
         FROM room_messages m
         WHERE m.room_id = r.id
         ORDER BY m.created_at DESC, m.id DESC
         LIMIT 1
       ) last_message ON TRUE
       LEFT JOIN users last_sender ON last_sender.id = last_message.sender_id
       WHERE r.deleted_at IS NULL
         AND ($1::text IS NULL OR r.type = $1)
         AND (
           $2::uuid IS NULL OR EXISTS (
             SELECT 1
             FROM room_members mem_filter
             WHERE mem_filter.room_id = r.id
               AND mem_filter.user_id = $2
               AND (r.type = 'direct' OR mem_filter.left_at IS NULL)
           )
         )
         AND (
           $3::text IS NULL
           OR lower(COALESCE(r.title, '')) LIKE $3
           OR EXISTS (
             SELECT 1
             FROM room_members mem_search
             INNER JOIN users user_search ON user_search.id = mem_search.user_id
             WHERE mem_search.room_id = r.id
               AND (
                 lower(user_search.email) LIKE $3
                 OR lower(COALESCE(user_search.display_name, '')) LIKE $3
               )
           )
         )
       ORDER BY r.updated_at DESC, r.id DESC
       LIMIT $4`,
      values
    );

    const roomIds = result.rows.map((row) => row.id);
    const membersByRoom = await this.getRoomMembers(roomIds);

    return {
      items: result.rows.map((row) => {
        const members = membersByRoom.get(row.id) ?? [];
        const title =
          row.type === 'group'
            ? row.title?.trim() || 'Group room'
            : members.map((member) => member.name).join(' x ') || 'Direct room';

        const preview = normalizeMessagePreview(row.last_message_kind, row.last_message_text);

        return {
          id: row.id,
          type: row.type,
          title,
          messageCount: row.message_count,
          activeMemberCount: row.active_member_count,
          createdAt: row.created_at.toISOString(),
          updatedAt: row.updated_at.toISOString(),
          members,
          ...(row.last_message_id
            ? {
                lastMessage: {
                  id: row.last_message_id,
                  ...(row.last_message_sender_id ? { senderId: row.last_message_sender_id } : {}),
                  senderName: row.last_message_sender_id
                    ? normalizeName(row.last_message_sender_name, row.last_message_sender_email ?? 'unknown@ourhangout.local')
                    : 'System',
                  kind: row.last_message_kind ?? 'system',
                  ...(preview ? { preview } : {}),
                  createdAt: row.last_message_created_at?.toISOString() ?? row.updated_at.toISOString()
                }
              }
            : {})
        };
      })
    };
  }

  async listRoomMessages(
    requesterUserId: string,
    params: {
      roomId: string;
      before?: string;
      q?: string;
      limit?: number;
    }
  ): Promise<{
    items: Array<{
      id: string;
      roomId: string;
      roomType: RoomType;
      roomTitle?: string;
      senderId?: string;
      senderName: string;
      senderEmail?: string;
      kind: MessageKind;
      text?: string;
      uri?: string;
      delivery: MessageDelivery;
      createdAt: string;
    }>;
    nextBefore?: string;
  }> {
    await this.assertParentRole(requesterUserId);
    await this.assertRoomExists(params.roomId);

    const limit = normalizeLimit(params.limit, 80, 200);
    const values: unknown[] = [params.roomId];
    let beforeIndex = 0;
    let queryIndex = 0;

    if (params.before) {
      values.push(new Date(params.before));
      beforeIndex = values.length;
    }

    const q = params.q?.trim();
    if (q) {
      values.push(`%${q.toLowerCase()}%`);
      queryIndex = values.length;
    }

    values.push(limit + 1);

    const result = await this.db.query<ManagedMessageRow>(
      `SELECT m.id,
              m.room_id,
              r.type AS room_type,
              r.title AS room_title,
              m.sender_id,
              m.kind,
              m.text,
              m.media_url,
              m.delivery,
              m.created_at,
              sender.display_name AS sender_display_name,
              sender.email AS sender_email
       FROM room_messages m
       INNER JOIN rooms r ON r.id = m.room_id
       LEFT JOIN users sender ON sender.id = m.sender_id
       WHERE m.room_id = $1
         ${beforeIndex ? `AND m.created_at < $${beforeIndex}` : ''}
         ${queryIndex ? `AND lower(COALESCE(m.text, '')) LIKE $${queryIndex}` : ''}
       ORDER BY m.created_at DESC, m.id DESC
       LIMIT $${values.length}`,
      values
    );

    const hasMore = result.rows.length > limit;
    const rows = hasMore ? result.rows.slice(0, limit) : result.rows;
    const lastRow = rows[rows.length - 1];

    return {
      items: rows.map((row) => this.mapManagedMessage(row)),
      ...(hasMore && lastRow ? { nextBefore: lastRow.created_at.toISOString() } : {})
    };
  }

  async deleteMessage(
    requesterUserId: string,
    messageId: string
  ): Promise<{
    id: string;
    roomId: string;
    kind: MessageKind;
    createdAt: string;
  }> {
    await this.assertParentRole(requesterUserId);

    const result = await this.db.query<ManagedMessageRow>(
      `DELETE FROM room_messages
       WHERE id = $1
       RETURNING id,
                 room_id,
                 'direct'::text AS room_type,
                 NULL::text AS room_title,
                 sender_id,
                 kind,
                 text,
                 media_url,
                 delivery,
                 created_at,
                 NULL::text AS sender_display_name,
                 NULL::text AS sender_email`,
      [messageId]
    );

    const row = result.rows[0];
    if (!row) {
      throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, 'Message not found.');
    }

    await this.touchRooms([row.room_id]);

    return {
      id: row.id,
      roomId: row.room_id,
      kind: row.kind,
      createdAt: row.created_at.toISOString()
    };
  }

  async bulkDeleteMessages(
    requesterUserId: string,
    params: {
      searchText?: string;
      roomId?: string;
      senderId?: string;
      before?: string;
      kinds?: MessageKind[];
      limit?: number;
      dryRun?: boolean;
    }
  ): Promise<{
    dryRun: boolean;
    matchedCount: number;
    deletedCount: number;
    items: Array<{
      id: string;
      roomId: string;
      roomType: RoomType;
      roomTitle?: string;
      senderId?: string;
      senderName: string;
      senderEmail?: string;
      kind: MessageKind;
      text?: string;
      uri?: string;
      delivery: MessageDelivery;
      createdAt: string;
    }>;
  }> {
    await this.assertParentRole(requesterUserId);

    const hasScopedFilter = Boolean(params.searchText?.trim() || params.roomId || params.senderId);
    if (!hasScopedFilter) {
      throw new AppError(
        400,
        ErrorCodes.VALIDATION_ERROR,
        'Bulk delete requires at least one scope filter: searchText, roomId, or senderId.'
      );
    }

    const limit = normalizeLimit(params.limit, 100, 500);
    const rows = await this.findManagedMessages({
      roomId: params.roomId,
      senderId: params.senderId,
      searchText: params.searchText,
      before: params.before,
      kinds: params.kinds,
      limit
    });

    if (params.dryRun !== false || rows.length === 0) {
      return {
        dryRun: true,
        matchedCount: rows.length,
        deletedCount: 0,
        items: rows.map((row) => this.mapManagedMessage(row))
      };
    }

    const ids = rows.map((row) => row.id);
    const roomIds = Array.from(new Set(rows.map((row) => row.room_id)));

    await this.db.query(`DELETE FROM room_messages WHERE id = ANY($1::uuid[])`, [ids]);
    await this.touchRooms(roomIds);

    return {
      dryRun: false,
      matchedCount: rows.length,
      deletedCount: rows.length,
      items: rows.map((row) => this.mapManagedMessage(row))
    };
  }

  async getStorageOverview(requesterUserId: string): Promise<{
    totals: {
      trackedAssets: number;
      completedAssets: number;
      pendingAssets: number;
      failedAssets: number;
      trackedBytes: number;
      actualDiskBytes: number;
      orphanFileCount: number;
      missingTrackedFileCount: number;
    };
    byKind: Array<{
      kind: 'image' | 'video' | 'avatar';
      assetCount: number;
      totalBytes: number;
    }>;
    topUsers: Array<{
      userId: string;
      email: string;
      name: string;
      storageBytes: number;
      assetCount: number;
    }>;
    orphanFiles: Array<{
      relativePath: string;
      sizeBytes: number;
    }>;
  }> {
    await this.assertParentRole(requesterUserId);

    const [totalsRow, byKindRows, topUsersRows, audit] = await Promise.all([
      this.db.query<SummaryAssetsRow>(
        `SELECT COUNT(*)::int AS total_assets,
                COUNT(*) FILTER (WHERE status = 'completed')::int AS completed_assets,
                COUNT(*) FILTER (WHERE status = 'pending')::int AS pending_assets,
                COUNT(*) FILTER (WHERE status = 'failed')::int AS failed_assets,
                COALESCE(SUM(size_bytes), 0)::bigint AS tracked_bytes
         FROM media_assets`
      ),
      this.db.query<AssetOverviewRow>(
        `SELECT kind,
                COUNT(*)::int AS asset_count,
                COALESCE(SUM(size_bytes), 0)::bigint AS total_bytes
         FROM media_assets
         GROUP BY kind
         ORDER BY kind ASC`
      ),
      this.db.query<TopStorageUserRow>(
        `SELECT u.id,
                u.email,
                u.display_name,
                COALESCE(SUM(ma.size_bytes) FILTER (WHERE ma.status = 'completed'), 0)::bigint AS storage_bytes,
                COUNT(ma.id) FILTER (WHERE ma.status = 'completed')::int AS asset_count
         FROM users u
         LEFT JOIN media_assets ma ON ma.owner_user_id = u.id
         GROUP BY u.id, u.email, u.display_name
         HAVING COALESCE(SUM(ma.size_bytes) FILTER (WHERE ma.status = 'completed'), 0) > 0
         ORDER BY storage_bytes DESC, asset_count DESC, u.created_at ASC
         LIMIT 12`
      ),
      this.auditStorage()
    ]);

    const totals = totalsRow.rows[0];

    return {
      totals: {
        trackedAssets: totals?.total_assets ?? 0,
        completedAssets: totals?.completed_assets ?? 0,
        pendingAssets: totals?.pending_assets ?? 0,
        failedAssets: totals?.failed_assets ?? 0,
        trackedBytes: toNumber(totals?.tracked_bytes),
        actualDiskBytes: audit.actualDiskBytes,
        orphanFileCount: audit.orphanFiles.length,
        missingTrackedFileCount: audit.missingTrackedFileCount
      },
      byKind: byKindRows.rows.map((row) => ({
        kind: row.kind,
        assetCount: row.asset_count,
        totalBytes: toNumber(row.total_bytes)
      })),
      topUsers: topUsersRows.rows.map((row) => ({
        userId: row.id,
        email: row.email,
        name: normalizeName(row.display_name, row.email),
        storageBytes: toNumber(row.storage_bytes),
        assetCount: row.asset_count
      })),
      orphanFiles: audit.orphanFiles.slice(0, 24).map((entry) => ({
        relativePath: entry.relativePath,
        sizeBytes: entry.sizeBytes
      }))
    };
  }

  async listStorageAssets(
    requesterUserId: string,
    params: {
      ownerUserId?: string;
      status?: AssetStatus;
      unreferencedOnly?: boolean;
      limit?: number;
    }
  ): Promise<{
    items: Array<{
      id: string;
      owner: {
        userId: string;
        email: string;
        name: string;
      };
      kind: 'image' | 'video' | 'avatar';
      mimeType: string;
      sizeBytes: number;
      fileUrl: string;
      status: AssetStatus;
      referencedByAvatar: boolean;
      messageReferenceCount: number;
      fileExists: boolean;
      actualSizeBytes?: number;
      createdAt: string;
      updatedAt: string;
    }>;
  }> {
    await this.assertParentRole(requesterUserId);

    const limit = normalizeLimit(params.limit, 80, 200);
    const values: unknown[] = [params.ownerUserId ?? null, params.status ?? null, params.unreferencedOnly ?? false, limit];

    const result = await this.db.query<AssetListRow>(
      `SELECT ma.id,
              ma.owner_user_id,
              owner_user.email AS owner_email,
              owner_user.display_name AS owner_display_name,
              ma.kind,
              ma.mime_type,
              ma.size_bytes,
              ma.file_url,
              ma.status,
              ma.created_at,
              ma.updated_at,
              EXISTS(
                SELECT 1
                FROM users avatar_user
                WHERE avatar_user.avatar_url = ma.file_url
              ) AS referenced_by_avatar,
              (
                SELECT COUNT(*)::int
                FROM room_messages rm
                WHERE rm.media_url = ma.file_url
              ) AS message_reference_count
       FROM media_assets ma
       INNER JOIN users owner_user ON owner_user.id = ma.owner_user_id
       WHERE ($1::uuid IS NULL OR ma.owner_user_id = $1)
         AND ($2::text IS NULL OR ma.status = $2)
         AND (
           $3::boolean = FALSE
           OR (
             NOT EXISTS(SELECT 1 FROM users avatar_user WHERE avatar_user.avatar_url = ma.file_url)
             AND NOT EXISTS(SELECT 1 FROM room_messages rm WHERE rm.media_url = ma.file_url)
           )
         )
       ORDER BY ma.updated_at DESC, ma.id DESC
       LIMIT $4`,
      values
    );

    const items = await Promise.all(
      result.rows.map(async (row) => {
        const fileState = await this.getAssetFileState(row.file_url);

        return {
          id: row.id,
          owner: {
            userId: row.owner_user_id,
            email: row.owner_email,
            name: normalizeName(row.owner_display_name, row.owner_email)
          },
          kind: row.kind,
          mimeType: row.mime_type,
          sizeBytes: row.size_bytes,
          fileUrl: row.file_url,
          status: row.status,
          referencedByAvatar: row.referenced_by_avatar,
          messageReferenceCount: row.message_reference_count,
          fileExists: fileState.exists,
          ...(fileState.actualSizeBytes !== undefined ? { actualSizeBytes: fileState.actualSizeBytes } : {}),
          createdAt: row.created_at.toISOString(),
          updatedAt: row.updated_at.toISOString()
        };
      })
    );

    return { items };
  }

  async deleteStorageAsset(
    requesterUserId: string,
    assetId: string,
    forceAvatarDetach = false
  ): Promise<{
    id: string;
    deleted: boolean;
    detachedAvatarUsers: number;
    removedFile: boolean;
  }> {
    await this.assertParentRole(requesterUserId);

    const client = await this.db.connect();
    let fileUrl = '';
    let detachedAvatarUsers = 0;

    try {
      await client.query('BEGIN');

      const assetResult = await client.query<AssetDeleteRow>(
        `SELECT ma.id,
                ma.file_url,
                EXISTS(
                  SELECT 1
                  FROM users avatar_user
                  WHERE avatar_user.avatar_url = ma.file_url
                ) AS referenced_by_avatar,
                (
                  SELECT COUNT(*)::int
                  FROM room_messages rm
                  WHERE rm.media_url = ma.file_url
                ) AS message_reference_count
         FROM media_assets ma
         WHERE ma.id = $1
         LIMIT 1
         FOR UPDATE`,
        [assetId]
      );

      const asset = assetResult.rows[0];
      if (!asset) {
        throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, 'Media asset not found.');
      }

      if (asset.message_reference_count > 0) {
        throw new AppError(
          409,
          ErrorCodes.CONFLICT,
          'This media asset is still referenced by room messages. Delete those messages first.'
        );
      }

      if (asset.referenced_by_avatar && !forceAvatarDetach) {
        throw new AppError(
          409,
          ErrorCodes.CONFLICT,
          'This media asset is currently used as an avatar. Retry with forceAvatarDetach to clear the avatar first.'
        );
      }

      if (asset.referenced_by_avatar) {
        const detachResult = await client.query(
          `UPDATE users
           SET avatar_url = NULL,
               updated_at = NOW()
           WHERE avatar_url = $1`,
          [asset.file_url]
        );
        detachedAvatarUsers = detachResult.rowCount ?? 0;
      }

      await client.query(`DELETE FROM media_assets WHERE id = $1`, [asset.id]);
      await client.query('COMMIT');

      fileUrl = asset.file_url;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    const removedFile = await this.removeFileIfExists(fileUrl);

    return {
      id: assetId,
      deleted: true,
      detachedAvatarUsers,
      removedFile
    };
  }

  async cleanupOrphanFiles(requesterUserId: string): Promise<{
    deletedCount: number;
    freedBytes: number;
    deletedFiles: string[];
  }> {
    await this.assertParentRole(requesterUserId);

    const audit = await this.auditStorage();
    let freedBytes = 0;
    const deletedFiles: string[] = [];

    for (const orphan of audit.orphanFiles) {
      try {
        await fs.unlink(orphan.absolutePath);
        freedBytes += orphan.sizeBytes;
        deletedFiles.push(orphan.relativePath);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          this.logger.warn({ error, path: orphan.absolutePath }, 'Failed to delete orphan media file');
        }
      }
    }

    return {
      deletedCount: deletedFiles.length,
      freedBytes,
      deletedFiles
    };
  }

  private async findManagedMessages(params: {
    roomId?: string;
    senderId?: string;
    searchText?: string;
    before?: string;
    kinds?: MessageKind[];
    limit: number;
  }): Promise<ManagedMessageRow[]> {
    const values: unknown[] = [];
    const filters: string[] = [];

    if (params.roomId) {
      values.push(params.roomId);
      filters.push(`m.room_id = $${values.length}`);
    }

    if (params.senderId) {
      values.push(params.senderId);
      filters.push(`m.sender_id = $${values.length}`);
    }

    const searchText = params.searchText?.trim();
    if (searchText) {
      values.push(`%${searchText.toLowerCase()}%`);
      filters.push(`lower(COALESCE(m.text, '')) LIKE $${values.length}`);
    }

    if (params.before) {
      values.push(new Date(params.before));
      filters.push(`m.created_at < $${values.length}`);
    }

    if (params.kinds && params.kinds.length > 0) {
      values.push(params.kinds);
      filters.push(`m.kind = ANY($${values.length}::text[])`);
    }

    values.push(params.limit);

    return (
      await this.db.query<ManagedMessageRow>(
        `SELECT m.id,
                m.room_id,
                r.type AS room_type,
                r.title AS room_title,
                m.sender_id,
                m.kind,
                m.text,
                m.media_url,
                m.delivery,
                m.created_at,
                sender.display_name AS sender_display_name,
                sender.email AS sender_email
         FROM room_messages m
         INNER JOIN rooms r ON r.id = m.room_id
         LEFT JOIN users sender ON sender.id = m.sender_id
         ${filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : ''}
         ORDER BY m.created_at DESC, m.id DESC
         LIMIT $${values.length}`,
        values
      )
    ).rows;
  }

  private mapManagedMessage(row: ManagedMessageRow): {
    id: string;
    roomId: string;
    roomType: RoomType;
    roomTitle?: string;
    senderId?: string;
    senderName: string;
    senderEmail?: string;
    kind: MessageKind;
    text?: string;
    uri?: string;
    delivery: MessageDelivery;
    createdAt: string;
  } {
    return {
      id: row.id,
      roomId: row.room_id,
      roomType: row.room_type,
      ...(row.room_title ? { roomTitle: row.room_title } : {}),
      ...(row.sender_id ? { senderId: row.sender_id } : {}),
      senderName: row.sender_id
        ? normalizeName(row.sender_display_name, row.sender_email ?? 'unknown@ourhangout.local')
        : 'System',
      ...(row.sender_email ? { senderEmail: row.sender_email } : {}),
      kind: row.kind,
      ...(row.text ? { text: row.text } : {}),
      ...(row.media_url ? { uri: row.media_url } : {}),
      delivery: row.delivery,
      createdAt: row.created_at.toISOString()
    };
  }

  private async getRoomMembers(roomIds: string[]): Promise<
    Map<
      string,
      Array<{
        userId: string;
        email: string;
        role: UserRole;
        name: string;
      }>
    >
  > {
    const map = new Map<
      string,
      Array<{
        userId: string;
        email: string;
        role: UserRole;
        name: string;
      }>
    >();

    if (roomIds.length === 0) {
      return map;
    }

    const result = await this.db.query<GuardianRoomMemberRow>(
      `SELECT mem.room_id,
              u.id AS user_id,
              u.email,
              u.role,
              u.display_name
       FROM room_members mem
       INNER JOIN rooms r ON r.id = mem.room_id
       INNER JOIN users u ON u.id = mem.user_id
       WHERE mem.room_id = ANY($1::uuid[])
         AND (r.type = 'direct' OR mem.left_at IS NULL)
       ORDER BY mem.joined_at ASC, u.created_at ASC`,
      [roomIds]
    );

    for (const row of result.rows) {
      const members = map.get(row.room_id) ?? [];
      members.push({
        userId: row.user_id,
        email: row.email,
        role: row.role,
        name: normalizeName(row.display_name, row.email)
      });
      map.set(row.room_id, members);
    }

    return map;
  }

  private async getAssetFileState(
    fileUrl: string
  ): Promise<{
    exists: boolean;
    actualSizeBytes?: number;
  }> {
    try {
      const stat = await fs.stat(resolveMediaStoragePath(fileUrl));
      if (!stat.isFile()) {
        return { exists: false };
      }

      return {
        exists: true,
        actualSizeBytes: stat.size
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return { exists: false };
      }

      this.logger.warn({ error, fileUrl }, 'Failed to inspect media asset file');
      return { exists: false };
    }
  }

  private async auditStorage(): Promise<{
    actualDiskBytes: number;
    missingTrackedFileCount: number;
    orphanFiles: StorageFileEntry[];
  }> {
    const storageRoot = getMediaStorageRoot();
    const [trackedAssets, storageFiles] = await Promise.all([
      this.db.query<TrackedAssetPathRow>('SELECT file_url, status FROM media_assets'),
      collectStorageFiles(storageRoot)
    ]);

    const trackedPaths = new Set<string>();
    const completedPaths = new Set<string>();

    for (const row of trackedAssets.rows) {
      try {
        const path = resolveMediaStoragePath(row.file_url);
        trackedPaths.add(path);
        if (row.status === 'completed') {
          completedPaths.add(path);
        }
      } catch (error) {
        this.logger.warn({ error, fileUrl: row.file_url }, 'Skipping invalid media asset path during storage audit');
      }
    }

    let actualDiskBytes = 0;
    const orphanFiles: StorageFileEntry[] = [];
    const filePathSet = new Set<string>();

    for (const file of storageFiles) {
      actualDiskBytes += file.sizeBytes;
      filePathSet.add(file.absolutePath);

      if (!trackedPaths.has(file.absolutePath)) {
        orphanFiles.push(file);
      }
    }

    let missingTrackedFileCount = 0;
    for (const path of completedPaths) {
      if (!filePathSet.has(path)) {
        missingTrackedFileCount += 1;
      }
    }

    orphanFiles.sort((left, right) => right.sizeBytes - left.sizeBytes);

    return {
      actualDiskBytes,
      missingTrackedFileCount,
      orphanFiles
    };
  }

  private async touchRooms(roomIds: string[]): Promise<void> {
    const uniqueRoomIds = Array.from(new Set(roomIds.map((roomId) => roomId.trim()).filter(Boolean)));
    if (uniqueRoomIds.length === 0) {
      return;
    }

    await this.db.query(
      `UPDATE rooms
       SET updated_at = NOW()
       WHERE id = ANY($1::uuid[])`,
      [uniqueRoomIds]
    );
  }

  private async removeFileIfExists(fileUrl: string): Promise<boolean> {
    if (!fileUrl) {
      return false;
    }

    try {
      await fs.unlink(resolveMediaStoragePath(fileUrl));
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return false;
      }

      this.logger.warn({ error, fileUrl }, 'Failed to remove media asset file');
      return false;
    }
  }

  private async assertRoomExists(roomId: string): Promise<void> {
    const result = await this.db.query<{ id: string }>(
      `SELECT id
       FROM rooms
       WHERE id = $1
         AND deleted_at IS NULL
       LIMIT 1`,
      [roomId]
    );

    if (!result.rows[0]) {
      throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, 'Room not found.');
    }
  }

  private async assertParentRole(userId: string): Promise<void> {
    const result = await this.db.query<{ role: UserRole }>(
      `SELECT role
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [userId]
    );

    const row = result.rows[0];
    if (!row) {
      throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, 'User not found.');
    }

    if (row.role !== 'parent') {
      throw new AppError(403, ErrorCodes.FORBIDDEN, 'Only parent accounts can access Guardian Console.');
    }
  }
}
