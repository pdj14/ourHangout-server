import type { FastifyBaseLogger } from 'fastify';
import type { Pool, PoolClient } from 'pg';
import { AppError, ErrorCodes } from '../../lib/errors';
import type { ConnectionManager } from '../chat/connection-manager';

type UserRole = 'parent' | 'user';
type FamilyRelationshipType = 'parent_child';
type FamilyLabel = 'mother' | 'father' | 'guardian' | 'child';
type FamilyMemberRole = 'parent' | 'child' | 'guardian';
type FamilyServiceKey = 'location' | 'schedule' | 'todo' | 'family_calendar';
type FamilyPermissionLevel = 'none' | 'view' | 'edit' | 'manage';

type UserIdentityRow = {
  id: string;
  email: string;
  role: UserRole;
  display_name: string | null;
  avatar_url: string | null;
};

type SourceRelationshipRow = { id: string };

type UpgradeRequestListRow = {
  id: string;
  requester_id: string;
  target_user_id: string;
  requested_relationship_type: FamilyRelationshipType;
  requester_label: FamilyLabel;
  target_label: FamilyLabel;
  note: string | null;
  created_at: Date;
  peer_name: string | null;
  peer_email: string;
  peer_avatar_url: string | null;
};

type UpgradeRequestForUpdateRow = {
  id: string;
  requester_id: string;
  target_user_id: string;
  source_relationship_id: string | null;
  requested_relationship_type: FamilyRelationshipType;
  requester_label: FamilyLabel;
  target_label: FamilyLabel;
  note: string | null;
  status: 'pending' | 'accepted' | 'rejected' | 'canceled' | 'expired';
  created_at: Date;
  expires_at: Date | null;
};

type ActiveGroupMembershipRow = {
  family_group_id: string;
  user_id: string;
};

type FamilyRelationshipRow = {
  id: string;
  family_group_id: string | null;
};

type LinkRow = {
  relationship_id: string;
  family_group_id: string | null;
  relationship_type: FamilyRelationshipType;
  status: 'active' | 'blocked' | 'deleted';
  pair_key: string;
  created_at: Date;
  direct_room_id: string | null;
  peer_user_id: string;
  peer_email: string;
  peer_display_name: string | null;
  peer_avatar_url: string | null;
  me_member_role: FamilyMemberRole | null;
  me_display_label: FamilyLabel | null;
  peer_member_role: FamilyMemberRole | null;
  peer_display_label: FamilyLabel | null;
};

type PermissionRow = {
  family_group_id: string;
  actor_user_id: string;
  subject_user_id: string | null;
  service_key: FamilyServiceKey;
  permission_level: FamilyPermissionLevel;
};

type GroupRow = {
  family_group_id: string;
  name: string | null;
  status: 'active' | 'archived';
  created_at: Date;
};

type GroupMemberRow = {
  family_group_id: string;
  user_id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  member_role: FamilyMemberRole;
  display_label: FamilyLabel;
  custom_label: string | null;
  status: 'active' | 'invited' | 'removed';
  joined_at: Date;
};

const UPGRADE_REQUEST_TTL_DAYS = 7;
const PARENTISH_LABELS = new Set<FamilyLabel>(['mother', 'father', 'guardian']);

function normalizeName(displayName: string | null, email: string): string {
  if (displayName && displayName.trim().length > 0) return displayName.trim();
  return email;
}

function getPairKey(userIdA: string, userIdB: string): { pairKey: string; userAId: string; userBId: string } {
  const [userAId, userBId] = [userIdA, userIdB].sort();
  return { pairKey: `${userAId}:${userBId}`, userAId, userBId };
}

function isParentish(label: FamilyLabel): boolean {
  return PARENTISH_LABELS.has(label);
}

function toMemberRole(label: FamilyLabel): FamilyMemberRole {
  if (label === 'child') return 'child';
  if (label === 'guardian') return 'guardian';
  return 'parent';
}

export class FamilyService {
  constructor(
    private readonly db: Pool,
    private readonly connectionManager: ConnectionManager,
    private readonly logger: FastifyBaseLogger
  ) {}

  async createUpgradeRequest(params: {
    requesterId: string;
    targetUserId: string;
    note?: string;
  }): Promise<{
    requestId: string;
    status: 'pending';
    targetUserId: string;
    relationshipType: FamilyRelationshipType;
    requesterLabel: FamilyLabel;
    targetLabel: FamilyLabel;
    createdAt: string;
  }> {
    const targetUserId = params.targetUserId.trim();
    if (!targetUserId) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Target user id is required.');
    }
    if (params.requesterId === targetUserId) {
      throw new AppError(409, ErrorCodes.CONFLICT, 'Cannot create a family upgrade request for yourself.');
    }

    await this.fetchUsers(params.requesterId, targetUserId);

    await this.assertFriendship(params.requesterId, targetUserId);
    await this.assertNoActiveFamilyLink(params.requesterId, targetUserId, 'parent_child');
    await this.assertNoPendingRequest(params.requesterId, targetUserId, 'parent_child');

    const sourceRelationshipId = await this.findFriendRelationshipId(params.requesterId, targetUserId);
    const note = (params.note || '').trim();
    const expiresAt = new Date(Date.now() + UPGRADE_REQUEST_TTL_DAYS * 24 * 60 * 60 * 1000);

    const inserted = await this.db.query<{ id: string; created_at: Date }>(
      `INSERT INTO family_upgrade_requests (
         requester_id,
         target_user_id,
         source_relationship_id,
         requested_relationship_type,
         requester_label,
         target_label,
         note,
         expires_at,
         created_at,
         updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
       RETURNING id, created_at`,
      [
        params.requesterId,
        targetUserId,
        sourceRelationshipId,
        'parent_child',
        'guardian',
        'child',
        note || null,
        expiresAt
      ]
    );

    const requestId = inserted.rows[0].id;
    this.emitToUsers([params.requesterId, targetUserId], {
      event: 'family.updated',
      data: { type: 'upgrade_request.created', requestId }
    });

    return {
      requestId,
      status: 'pending',
      targetUserId,
      relationshipType: 'parent_child',
      requesterLabel: 'guardian',
      targetLabel: 'child',
      createdAt: inserted.rows[0].created_at.toISOString()
    };
  }

  async listUpgradeRequests(userId: string): Promise<{
    incoming: Array<{
      requestId: string;
      peer: { userId: string; name: string; avatarUri?: string };
      relationshipType: FamilyRelationshipType;
      requesterLabel: FamilyLabel;
      targetLabel: FamilyLabel;
      note?: string;
      createdAt: string;
    }>;
    outgoing: Array<{
      requestId: string;
      peer: { userId: string; name: string; avatarUri?: string };
      relationshipType: FamilyRelationshipType;
      requesterLabel: FamilyLabel;
      targetLabel: FamilyLabel;
      note?: string;
      createdAt: string;
    }>;
  }> {
    const incomingResult = await this.db.query<UpgradeRequestListRow>(
      `SELECT fur.id,
              fur.requester_id,
              fur.target_user_id,
              fur.requested_relationship_type,
              fur.requester_label,
              fur.target_label,
              fur.note,
              fur.created_at,
              u.display_name AS peer_name,
              u.email AS peer_email,
              u.avatar_url AS peer_avatar_url
       FROM family_upgrade_requests fur
       INNER JOIN users u ON u.id = fur.requester_id
       WHERE fur.target_user_id = $1
         AND fur.status = 'pending'
       ORDER BY fur.created_at DESC`,
      [userId]
    );

    const outgoingResult = await this.db.query<UpgradeRequestListRow>(
      `SELECT fur.id,
              fur.requester_id,
              fur.target_user_id,
              fur.requested_relationship_type,
              fur.requester_label,
              fur.target_label,
              fur.note,
              fur.created_at,
              u.display_name AS peer_name,
              u.email AS peer_email,
              u.avatar_url AS peer_avatar_url
       FROM family_upgrade_requests fur
       INNER JOIN users u ON u.id = fur.target_user_id
       WHERE fur.requester_id = $1
         AND fur.status = 'pending'
       ORDER BY fur.created_at DESC`,
      [userId]
    );

    return {
      incoming: incomingResult.rows.map((row) => ({
        requestId: row.id,
        peer: {
          userId: row.requester_id,
          name: normalizeName(row.peer_name, row.peer_email),
          ...(row.peer_avatar_url ? { avatarUri: row.peer_avatar_url } : {})
        },
        relationshipType: row.requested_relationship_type,
        requesterLabel: row.requester_label,
        targetLabel: row.target_label,
        ...(row.note ? { note: row.note } : {}),
        createdAt: row.created_at.toISOString()
      })),
      outgoing: outgoingResult.rows.map((row) => ({
        requestId: row.id,
        peer: {
          userId: row.target_user_id,
          name: normalizeName(row.peer_name, row.peer_email),
          ...(row.peer_avatar_url ? { avatarUri: row.peer_avatar_url } : {})
        },
        relationshipType: row.requested_relationship_type,
        requesterLabel: row.requester_label,
        targetLabel: row.target_label,
        ...(row.note ? { note: row.note } : {}),
        createdAt: row.created_at.toISOString()
      }))
    };
  }

  async acceptUpgradeRequest(userId: string, requestId: string): Promise<{
    requestId: string;
    status: 'accepted';
    familyGroupId: string;
    relationshipId: string;
    relationshipType: FamilyRelationshipType;
    roomId: string;
    permissionsSeeded: false;
  }> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      const request = await this.getPendingRequestForTarget(client, userId, requestId);
      await this.fetchUsersWithClient(client, request.requester_id, request.target_user_id);
      await this.assertFriendship(request.requester_id, request.target_user_id, client);

      const familyGroupId = await this.resolveFamilyGroupId(client, request.requester_id, request.target_user_id);
      await this.upsertFamilyMembers(client, familyGroupId, request);
      const relationshipId = await this.upsertFamilyRelationship(client, familyGroupId, request);
      const roomId = await this.ensureDirectRoomForUsers(
        client,
        request.requester_id,
        request.target_user_id,
        request.requester_id
      );

      await client.query(
        `UPDATE family_upgrade_requests
         SET status = 'accepted',
             responded_at = NOW(),
             updated_at = NOW()
         WHERE id = $1`,
        [request.id]
      );

      await client.query('COMMIT');

      this.emitToUsers([request.requester_id, request.target_user_id], {
        event: 'family.updated',
        data: { type: 'upgrade_request.accepted', requestId: request.id, familyGroupId, relationshipId }
      });
      this.emitToUsers([request.requester_id, request.target_user_id], {
        event: 'friend.updated',
        data: {
          type: 'family.changed',
          peerUserId: request.requester_id === userId ? request.target_user_id : request.requester_id
        }
      });
      this.emitToUsers([request.requester_id, request.target_user_id], {
        event: 'room.updated',
        data: { roomId }
      });

      return {
        requestId: request.id,
        status: 'accepted',
        familyGroupId,
        relationshipId,
        relationshipType: request.requested_relationship_type,
        roomId,
        permissionsSeeded: false
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async rejectUpgradeRequest(userId: string, requestId: string): Promise<{ requestId: string; status: 'rejected' }> {
    const result = await this.db.query<{ id: string; requester_id: string; target_user_id: string }>(
      `UPDATE family_upgrade_requests
       SET status = 'rejected',
           responded_at = NOW(),
           updated_at = NOW()
       WHERE id = $1
         AND target_user_id = $2
         AND status = 'pending'
       RETURNING id, requester_id, target_user_id`,
      [requestId, userId]
    );

    const row = result.rows[0];
    if (!row) {
      throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, 'Pending family upgrade request not found.');
    }

    this.emitToUsers([row.requester_id, row.target_user_id], {
      event: 'family.updated',
      data: { type: 'upgrade_request.rejected', requestId }
    });

    return { requestId, status: 'rejected' };
  }

  async cancelUpgradeRequest(userId: string, requestId: string): Promise<{ requestId: string; status: 'canceled' }> {
    const result = await this.db.query<{ id: string; requester_id: string; target_user_id: string }>(
      `UPDATE family_upgrade_requests
       SET status = 'canceled',
           responded_at = NOW(),
           updated_at = NOW()
       WHERE id = $1
         AND requester_id = $2
         AND status = 'pending'
       RETURNING id, requester_id, target_user_id`,
      [requestId, userId]
    );

    const row = result.rows[0];
    if (!row) {
      throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, 'Pending family upgrade request not found.');
    }

    this.emitToUsers([row.requester_id, row.target_user_id], {
      event: 'family.updated',
      data: { type: 'upgrade_request.canceled', requestId }
    });

    return { requestId, status: 'canceled' };
  }

  async removeLink(
    userId: string,
    relationshipId: string
  ): Promise<{ relationshipId: string; status: 'deleted'; peerUserId: string }> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query<{
        id: string;
        family_group_id: string | null;
        user_a_id: string;
        user_b_id: string;
        status: 'active' | 'blocked' | 'deleted';
      }>(
        `SELECT id, family_group_id, user_a_id, user_b_id, status
         FROM user_relationships
         WHERE id = $1
           AND relationship_type = 'parent_child'
         FOR UPDATE`,
        [relationshipId]
      );

      const row = result.rows[0];
      if (!row || row.status !== 'active') {
        throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, 'Active family link not found.');
      }

      if (row.user_a_id !== userId && row.user_b_id !== userId) {
        throw new AppError(403, ErrorCodes.FORBIDDEN, 'Family link access is not allowed.');
      }

      await client.query(
        `UPDATE user_relationships
         SET status = 'deleted',
             metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{removedBy}', to_jsonb($2::text), true)
         WHERE id = $1`,
        [relationshipId, userId]
      );

      if (row.family_group_id) {
        const memberIds = [row.user_a_id, row.user_b_id];
        for (const memberUserId of memberIds) {
          const activeLinks = await client.query<{ count: string }>(
            `SELECT COUNT(*)::text AS count
             FROM user_relationships
             WHERE family_group_id = $1
               AND status = 'active'
               AND relationship_type = 'parent_child'
               AND (user_a_id = $2 OR user_b_id = $2)`,
            [row.family_group_id, memberUserId]
          );

          if (Number(activeLinks.rows[0]?.count || '0') === 0) {
            await client.query(
              `UPDATE family_group_members
               SET status = 'removed',
                   removed_at = NOW()
               WHERE family_group_id = $1
                 AND user_id = $2
                 AND status = 'active'`,
              [row.family_group_id, memberUserId]
            );
          }
        }

        const activeMembers = await client.query<{ count: string }>(
          `SELECT COUNT(*)::text AS count
           FROM family_group_members
           WHERE family_group_id = $1
             AND status = 'active'`,
          [row.family_group_id]
        );

        if (Number(activeMembers.rows[0]?.count || '0') === 0) {
          await client.query(
            `UPDATE family_groups
             SET status = 'archived',
                 updated_at = NOW()
             WHERE id = $1`,
            [row.family_group_id]
          );
        }
      }

      await client.query('COMMIT');

      const peerUserId = row.user_a_id === userId ? row.user_b_id : row.user_a_id;
      this.emitToUsers([row.user_a_id, row.user_b_id], {
        event: 'family.updated',
        data: { type: 'link.removed', relationshipId, peerUserId }
      });
      this.emitToUsers([row.user_a_id, row.user_b_id], {
        event: 'friend.updated',
        data: { type: 'family.removed', peerUserId }
      });

      return {
        relationshipId,
        status: 'deleted',
        peerUserId
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async listLinks(userId: string): Promise<
    Array<{
      relationshipId: string;
      familyGroupId: string;
      relationshipType: FamilyRelationshipType;
      status: 'active' | 'blocked' | 'deleted';
      me: {
        userId: string;
        memberRole?: FamilyMemberRole;
        displayLabel?: FamilyLabel;
      };
      peer: {
        userId: string;
        name: string;
        avatarUri?: string;
        memberRole?: FamilyMemberRole;
        displayLabel?: FamilyLabel;
      };
      serviceSummary: Record<'location' | 'schedule' | 'todo' | 'familyCalendar', FamilyPermissionLevel>;
      directRoomId?: string;
      createdAt: string;
    }>
  > {
    const result = await this.db.query<LinkRow>(
      `SELECT ur.id AS relationship_id,
              ur.family_group_id,
              ur.relationship_type,
              ur.status,
              ur.pair_key,
              ur.created_at,
              r.id AS direct_room_id,
              peer.id AS peer_user_id,
              peer.email AS peer_email,
              peer.display_name AS peer_display_name,
              peer.avatar_url AS peer_avatar_url,
              me_member.member_role AS me_member_role,
              me_member.display_label AS me_display_label,
              peer_member.member_role AS peer_member_role,
              peer_member.display_label AS peer_display_label
       FROM user_relationships ur
       INNER JOIN users peer
               ON peer.id = CASE WHEN ur.user_a_id = $1 THEN ur.user_b_id ELSE ur.user_a_id END
       LEFT JOIN rooms r
              ON r.type = 'direct'
             AND r.direct_key = ur.pair_key
             AND r.deleted_at IS NULL
       LEFT JOIN family_group_members me_member
              ON me_member.family_group_id = ur.family_group_id
             AND me_member.user_id = $1
             AND me_member.status = 'active'
       LEFT JOIN family_group_members peer_member
              ON peer_member.family_group_id = ur.family_group_id
             AND peer_member.user_id = peer.id
             AND peer_member.status = 'active'
       WHERE ur.relationship_type = 'parent_child'
         AND (ur.user_a_id = $1 OR ur.user_b_id = $1)
         AND ur.status = 'active'
       ORDER BY ur.created_at DESC`,
      [userId]
    );

    const familyGroupIds = Array.from(
      new Set(result.rows.map((row) => row.family_group_id).filter((value): value is string => !!value))
    );
    const permissionMap = await this.listPermissionMapForActor(userId, familyGroupIds);

    return result.rows
      .filter((row): row is LinkRow & { family_group_id: string } => !!row.family_group_id)
      .map((row) => {
        const summary = {
          location: 'none',
          schedule: 'none',
          todo: 'none',
          familyCalendar: 'none'
        } as Record<'location' | 'schedule' | 'todo' | 'familyCalendar', FamilyPermissionLevel>;
        const subjectPermissions = permissionMap.get(`${row.family_group_id}:${row.peer_user_id}`) ?? new Map();
        const groupPermissions = permissionMap.get(`${row.family_group_id}:group`) ?? new Map();

        summary.location = subjectPermissions.get('location') ?? 'none';
        summary.schedule = subjectPermissions.get('schedule') ?? 'none';
        summary.todo = subjectPermissions.get('todo') ?? 'none';
        summary.familyCalendar = groupPermissions.get('family_calendar') ?? 'none';

        return {
          relationshipId: row.relationship_id,
          familyGroupId: row.family_group_id,
          relationshipType: row.relationship_type,
          status: row.status,
          me: {
            userId,
            ...(row.me_member_role ? { memberRole: row.me_member_role } : {}),
            ...(row.me_display_label ? { displayLabel: row.me_display_label } : {})
          },
          peer: {
            userId: row.peer_user_id,
            name: normalizeName(row.peer_display_name, row.peer_email),
            ...(row.peer_avatar_url ? { avatarUri: row.peer_avatar_url } : {}),
            ...(row.peer_member_role ? { memberRole: row.peer_member_role } : {}),
            ...(row.peer_display_label ? { displayLabel: row.peer_display_label } : {})
          },
          serviceSummary: summary,
          ...(row.direct_room_id ? { directRoomId: row.direct_room_id } : {}),
          createdAt: row.created_at.toISOString()
        };
      });
  }

  async getMyGroups(userId: string): Promise<{
    items: Array<{
      familyGroupId: string;
      name?: string;
      status: 'active' | 'archived';
      createdAt: string;
      members: Array<{
        userId: string;
        name: string;
        avatarUri?: string;
        memberRole: FamilyMemberRole;
        displayLabel: FamilyLabel;
        customLabel?: string;
        status: 'active' | 'invited' | 'removed';
        joinedAt: string;
      }>;
    }>;
  }> {
    const groups = await this.db.query<GroupRow>(
      `SELECT fg.id AS family_group_id, fg.name, fg.status, fg.created_at
       FROM family_group_members fgm
       INNER JOIN family_groups fg ON fg.id = fgm.family_group_id
       WHERE fgm.user_id = $1
         AND fgm.status = 'active'
       ORDER BY fg.created_at DESC`,
      [userId]
    );

    const groupIds = groups.rows.map((row) => row.family_group_id);
    if (groupIds.length === 0) return { items: [] };

    const members = await this.db.query<GroupMemberRow>(
      `SELECT fgm.family_group_id,
              fgm.user_id,
              u.email,
              u.display_name,
              u.avatar_url,
              fgm.member_role,
              fgm.display_label,
              fgm.custom_label,
              fgm.status,
              fgm.joined_at
       FROM family_group_members fgm
       INNER JOIN users u ON u.id = fgm.user_id
       WHERE fgm.family_group_id = ANY($1::uuid[])
       ORDER BY fgm.joined_at ASC`,
      [groupIds]
    );

    const membersByGroup = new Map<string, GroupMemberRow[]>();
    for (const row of members.rows) {
      const bucket = membersByGroup.get(row.family_group_id) ?? [];
      bucket.push(row);
      membersByGroup.set(row.family_group_id, bucket);
    }

    return {
      items: groups.rows.map((group) => ({
        familyGroupId: group.family_group_id,
        ...(group.name ? { name: group.name } : {}),
        status: group.status,
        createdAt: group.created_at.toISOString(),
        members: (membersByGroup.get(group.family_group_id) ?? []).map((member) => ({
          userId: member.user_id,
          name: normalizeName(member.display_name, member.email),
          ...(member.avatar_url ? { avatarUri: member.avatar_url } : {}),
          memberRole: member.member_role,
          displayLabel: member.display_label,
          ...(member.custom_label ? { customLabel: member.custom_label } : {}),
          status: member.status,
          joinedAt: member.joined_at.toISOString()
        }))
      }))
    };
  }

  async listGroupPermissions(
    userId: string,
    familyGroupId: string
  ): Promise<{
    familyGroupId: string;
    items: Array<{
      actorUserId: string;
      subjectUserId?: string;
      serviceKey: FamilyServiceKey;
      permissionLevel: FamilyPermissionLevel;
    }>;
  }> {
    await this.assertGroupAccess(userId, familyGroupId);

    const result = await this.db.query<PermissionRow>(
      `SELECT family_group_id, actor_user_id, subject_user_id, service_key, permission_level
       FROM family_service_permissions
       WHERE family_group_id = $1
       ORDER BY created_at ASC, actor_user_id ASC`,
      [familyGroupId]
    );

    return {
      familyGroupId,
      items: result.rows.map((row) => ({
        actorUserId: row.actor_user_id,
        ...(row.subject_user_id ? { subjectUserId: row.subject_user_id } : {}),
        serviceKey: row.service_key,
        permissionLevel: row.permission_level
      }))
    };
  }

  private async fetchUsers(userIdA: string, userIdB: string): Promise<Record<string, UserIdentityRow>> {
    const result = await this.db.query<UserIdentityRow>(
      `SELECT id, email, role, display_name, avatar_url
       FROM users
       WHERE id = ANY($1::uuid[])`,
      [[userIdA, userIdB]]
    );
    return this.ensureUsers(result.rows, userIdA, userIdB);
  }

  private async fetchUsersWithClient(
    client: PoolClient,
    userIdA: string,
    userIdB: string
  ): Promise<Record<string, UserIdentityRow>> {
    const result = await client.query<UserIdentityRow>(
      `SELECT id, email, role, display_name, avatar_url
       FROM users
       WHERE id = ANY($1::uuid[])`,
      [[userIdA, userIdB]]
    );
    return this.ensureUsers(result.rows, userIdA, userIdB);
  }

  private ensureUsers(
    rows: UserIdentityRow[],
    userIdA: string,
    userIdB: string
  ): Record<string, UserIdentityRow> {
    const users = Object.fromEntries(rows.map((row) => [row.id, row])) as Record<string, UserIdentityRow>;
    if (!users[userIdA] || !users[userIdB]) {
      throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, 'User not found.');
    }
    return users;
  }

  private async assertFriendship(userId: string, friendUserId: string, client?: PoolClient): Promise<void> {
    const executor = client ?? this.db;
    const result = await executor.query<{ exists: boolean }>(
      `SELECT EXISTS(
         SELECT 1
         FROM friendships
         WHERE user_id = $1
           AND friend_user_id = $2
       )`,
      [userId, friendUserId]
    );
    if (!(result.rows[0]?.exists ?? false)) {
      throw new AppError(409, ErrorCodes.CONFLICT, 'Family upgrade requires an existing friend relationship.');
    }
  }

  private async assertNoActiveFamilyLink(
    userIdA: string,
    userIdB: string,
    relationshipType: FamilyRelationshipType
  ): Promise<void> {
    const { pairKey } = getPairKey(userIdA, userIdB);
    const result = await this.db.query<FamilyRelationshipRow>(
      `SELECT id, family_group_id
       FROM user_relationships
       WHERE pair_key = $1
         AND relationship_type = $2
         AND status = 'active'
       LIMIT 1`,
      [pairKey, relationshipType]
    );
    if (result.rows[0]) {
      throw new AppError(409, ErrorCodes.CONFLICT, 'Users are already connected as family.');
    }
  }

  private async assertNoPendingRequest(
    userIdA: string,
    userIdB: string,
    relationshipType: FamilyRelationshipType
  ): Promise<void> {
    const result = await this.db.query<{ id: string }>(
      `SELECT id
       FROM family_upgrade_requests
       WHERE requested_relationship_type = $3
         AND status = 'pending'
         AND (
           (requester_id = $1 AND target_user_id = $2) OR
           (requester_id = $2 AND target_user_id = $1)
         )
       LIMIT 1`,
      [userIdA, userIdB, relationshipType]
    );
    if (result.rows[0]) {
      throw new AppError(409, ErrorCodes.CONFLICT, 'A family upgrade request is already pending.');
    }
  }

  private async findFriendRelationshipId(userIdA: string, userIdB: string): Promise<string | null> {
    const { pairKey } = getPairKey(userIdA, userIdB);
    const result = await this.db.query<SourceRelationshipRow>(
      `SELECT id
       FROM user_relationships
       WHERE pair_key = $1
         AND relationship_type = 'friend'
       LIMIT 1`,
      [pairKey]
    );
    return result.rows[0]?.id ?? null;
  }

  private async getPendingRequestForTarget(
    client: PoolClient,
    targetUserId: string,
    requestId: string
  ): Promise<UpgradeRequestForUpdateRow> {
    const result = await client.query<UpgradeRequestForUpdateRow>(
      `SELECT id,
              requester_id,
              target_user_id,
              source_relationship_id,
              requested_relationship_type,
              requester_label,
              target_label,
              note,
              status,
              created_at,
              expires_at
       FROM family_upgrade_requests
       WHERE id = $1
         AND target_user_id = $2
       FOR UPDATE`,
      [requestId, targetUserId]
    );

    const row = result.rows[0];
    if (!row) {
      throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, 'Family upgrade request not found.');
    }
    if (row.status !== 'pending') {
      throw new AppError(409, ErrorCodes.CONFLICT, 'Family upgrade request is already handled.');
    }
    if (row.expires_at && row.expires_at.getTime() <= Date.now()) {
      throw new AppError(410, ErrorCodes.RESOURCE_NOT_FOUND, 'Family upgrade request has expired.');
    }
    return row;
  }

  private async resolveFamilyGroupId(client: PoolClient, userIdA: string, userIdB: string): Promise<string> {
    const result = await client.query<ActiveGroupMembershipRow>(
      `SELECT family_group_id, user_id
       FROM family_group_members
       WHERE user_id = ANY($1::uuid[])
         AND status = 'active'`,
      [[userIdA, userIdB]]
    );

    const groupsByUser = new Map<string, Set<string>>();
    for (const row of result.rows) {
      const bucket = groupsByUser.get(row.user_id) ?? new Set<string>();
      bucket.add(row.family_group_id);
      groupsByUser.set(row.user_id, bucket);
    }

    const userAGroups = Array.from(groupsByUser.get(userIdA) ?? []);
    const userBGroups = Array.from(groupsByUser.get(userIdB) ?? []);
    if (userAGroups.length > 1 || userBGroups.length > 1) {
      throw new AppError(409, ErrorCodes.CONFLICT, 'A user cannot belong to multiple active family groups in this flow.');
    }

    const groupA = userAGroups[0] ?? '';
    const groupB = userBGroups[0] ?? '';
    if (!groupA && !groupB) {
      const created = await client.query<{ id: string }>(
        `INSERT INTO family_groups (name, status, created_by, created_at, updated_at)
         VALUES (NULL, 'active', $1, NOW(), NOW())
         RETURNING id`,
        [userIdA]
      );
      return created.rows[0].id;
    }
    if (groupA && !groupB) return groupA;
    if (!groupA && groupB) return groupB;
    if (groupA === groupB) return groupA;

    throw new AppError(
      409,
      ErrorCodes.CONFLICT,
      'Users already belong to different family groups. Manual merge flow is required.'
    );
  }

  private async upsertFamilyMembers(
    client: PoolClient,
    familyGroupId: string,
    request: UpgradeRequestForUpdateRow
  ): Promise<void> {
    await client.query(
      `INSERT INTO family_group_members (
         family_group_id,
         user_id,
         member_role,
         display_label,
         status,
         joined_at,
         removed_at
       )
       VALUES
         ($1, $2, $3, $4, 'active', NOW(), NULL),
         ($1, $5, $6, $7, 'active', NOW(), NULL)
       ON CONFLICT (family_group_id, user_id)
       DO UPDATE SET
         member_role = EXCLUDED.member_role,
         display_label = EXCLUDED.display_label,
         status = 'active',
         removed_at = NULL`,
      [
        familyGroupId,
        request.requester_id,
        toMemberRole(request.requester_label),
        request.requester_label,
        request.target_user_id,
        toMemberRole(request.target_label),
        request.target_label
      ]
    );
  }

  private async upsertFamilyRelationship(
    client: PoolClient,
    familyGroupId: string,
    request: UpgradeRequestForUpdateRow
  ): Promise<string> {
    const { pairKey, userAId, userBId } = getPairKey(request.requester_id, request.target_user_id);
    const requesterIsUserA = request.requester_id === userAId;
    const labelForUserA = requesterIsUserA ? request.target_label : request.requester_label;
    const labelForUserB = requesterIsUserA ? request.requester_label : request.target_label;

    const result = await client.query<FamilyRelationshipRow>(
      `INSERT INTO user_relationships (
         pair_key,
         user_a_id,
         user_b_id,
         relationship_type,
         status,
         created_via,
         created_by,
         family_group_id,
         label_for_user_a,
         label_for_user_b,
         upgraded_from_friendship,
         confirmed_at,
         metadata
       )
       VALUES ($1, $2, $3, $4, 'active', 'manual', $5, $6, $7, $8, TRUE, NOW(), '{}'::jsonb)
       ON CONFLICT (pair_key, relationship_type)
       DO UPDATE SET
         status = 'active',
         created_via = 'manual',
         created_by = EXCLUDED.created_by,
         family_group_id = EXCLUDED.family_group_id,
         label_for_user_a = EXCLUDED.label_for_user_a,
         label_for_user_b = EXCLUDED.label_for_user_b,
         upgraded_from_friendship = TRUE,
         confirmed_at = NOW(),
         metadata = EXCLUDED.metadata
       RETURNING id, family_group_id`,
      [
        pairKey,
        userAId,
        userBId,
        request.requested_relationship_type,
        request.requester_id,
        familyGroupId,
        labelForUserA,
        labelForUserB
      ]
    );
    return result.rows[0].id;
  }

  private async ensureDirectRoomForUsers(
    client: PoolClient,
    userAId: string,
    userBId: string,
    createdBy: string
  ): Promise<string> {
    const { pairKey } = getPairKey(userAId, userBId);
    const roomResult = await client.query<{ id: string }>(
      `INSERT INTO rooms (type, direct_key, title, created_by, created_at, updated_at, deleted_at)
       VALUES ('direct', $1, NULL, $2, NOW(), NOW(), NULL)
       ON CONFLICT (direct_key)
       DO UPDATE SET
         updated_at = NOW(),
         deleted_at = NULL
       RETURNING id`,
      [pairKey, createdBy]
    );

    const roomId = roomResult.rows[0].id;
    await client.query(
      `INSERT INTO room_members (room_id, user_id, role, joined_at, left_at)
       VALUES
         ($1, $2, 'member', NOW(), NULL),
         ($1, $3, 'member', NOW(), NULL)
       ON CONFLICT (room_id, user_id)
       DO UPDATE SET
         left_at = NULL`,
      [roomId, userAId, userBId]
    );

    await client.query(
      `INSERT INTO room_user_settings (room_id, user_id, favorite, muted, created_at, updated_at)
       VALUES
         ($1, $2, FALSE, FALSE, NOW(), NOW()),
         ($1, $3, FALSE, FALSE, NOW(), NOW())
       ON CONFLICT (room_id, user_id)
       DO UPDATE SET
         hidden_at = NULL,
         updated_at = NOW()`,
      [roomId, userAId, userBId]
    );

    return roomId;
  }

  private async listPermissionMapForActor(
    actorUserId: string,
    familyGroupIds: string[]
  ): Promise<Map<string, Map<FamilyServiceKey, FamilyPermissionLevel>>> {
    const summary = new Map<string, Map<FamilyServiceKey, FamilyPermissionLevel>>();
    if (familyGroupIds.length === 0) return summary;

    const result = await this.db.query<PermissionRow>(
      `SELECT family_group_id, actor_user_id, subject_user_id, service_key, permission_level
       FROM family_service_permissions
       WHERE family_group_id = ANY($1::uuid[])
         AND actor_user_id = $2`,
      [familyGroupIds, actorUserId]
    );

    for (const row of result.rows) {
      const key = `${row.family_group_id}:${row.subject_user_id || 'group'}`;
      const bucket = summary.get(key) ?? new Map<FamilyServiceKey, FamilyPermissionLevel>();
      bucket.set(row.service_key, row.permission_level);
      summary.set(key, bucket);
    }

    return summary;
  }

  private async assertGroupAccess(userId: string, familyGroupId: string): Promise<void> {
    const result = await this.db.query<{ exists: boolean }>(
      `SELECT EXISTS(
         SELECT 1
         FROM family_group_members
         WHERE family_group_id = $1
           AND user_id = $2
           AND status = 'active'
       )`,
      [familyGroupId, userId]
    );
    if (!(result.rows[0]?.exists ?? false)) {
      throw new AppError(403, ErrorCodes.FORBIDDEN, 'Family group access is not allowed.');
    }
  }

  private emitToUsers(userIds: string[], payload: unknown): void {
    const unique = Array.from(new Set(userIds));
    for (const userId of unique) {
      this.connectionManager.sendToUser(userId, payload);
    }
  }
}
