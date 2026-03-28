import { createHash, randomBytes, randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import type { FastifyBaseLogger } from 'fastify';
import { dirname, relative, resolve } from 'path';
import type { Pool, PoolClient } from 'pg';
import { env } from '../../config/env';
import { AppError, ErrorCodes } from '../../lib/errors';
import { FcmPushService } from '../../lib/push/fcm-push.service';
import type { ConnectionManager } from '../chat/connection-manager';
import type { ClawBridgeService } from '../openclaw/claw-bridge.service';
import type {
  FamilyRoomMemberProfileDto,
  FamilyRoomRelationshipDto,
  FamilyRoomRelationshipRequestDto,
  MessageKind,
  RoomInvitationDto,
  RoomInvitationListDto,
  RoomMemberDto,
  RoomMemberListDto,
  RoomDto,
  RoomMessageDto,
  RoomType,
  UserLocationDto,
  UserLocationRefreshRequestDto,
  UserProfileDto
} from './social.types';

type CursorInput = {
  at: Date;
  id: string;
  order?: number;
};

type UserProfileRow = {
  id: string;
  email: string;
  display_name: string | null;
  status_message: string | null;
  avatar_url: string | null;
  locale: string | null;
  location_sharing_enabled?: boolean | null;
};

type FriendRow = {
  id: string;
  friend_user_id: string;
  trusted: boolean;
  created_at: Date;
  friend_name: string | null;
  friend_status: string | null;
  friend_avatar_url: string | null;
  friend_email: string;
};

type FriendAliasRow = {
  target_user_id: string;
  alias: string | null;
};

type FriendFamilySummaryRow = {
  peer_user_id: string;
  relationship_id: string;
  family_group_id: string | null;
  relationship_type: 'parent_child';
  status: 'active';
  display_label: 'mother' | 'father' | 'guardian' | 'child' | null;
  custom_label: string | null;
};

type FriendSearchRow = {
  id: string;
  email: string;
  display_name: string | null;
  status_message: string | null;
  avatar_url: string | null;
  is_friend: boolean;
  outgoing_pending: boolean;
  incoming_pending: boolean;
};

type FriendRequestRow = {
  id: string;
  requester_id: string;
  target_id: string;
  status: 'pending' | 'accepted' | 'rejected' | 'canceled';
  created_at: Date;
  peer_name: string | null;
  peer_email: string;
};

type RoomListRow = {
  id: string;
  type: RoomType;
  title: string | null;
  created_by: string;
  created_at: Date;
  updated_at: Date;
  favorite: boolean | null;
  muted: boolean | null;
  unread_count: number;
  preview_kind: MessageKind | null;
  preview_text: string | null;
  preview_media_url: string | null;
};

type RoomMemberRow = {
  room_id: string;
  user_id: string;
};

type RoomMembershipRow = RoomRow & {
  member_role: 'admin' | 'member';
};

type RoomMemberProfileRow = {
  user_id: string;
  role: 'admin' | 'member';
  display_name: string | null;
  email: string;
  avatar_url: string | null;
  alias: string | null;
  location_sharing_enabled: boolean | null;
  joined_at: Date;
};

type RoomInvitationRow = {
  id: string;
  room_id: string;
  room_type: RoomType;
  room_title: string | null;
  inviter_user_id: string;
  inviter_name: string | null;
  inviter_email: string;
  inviter_avatar_url: string | null;
  target_user_id: string;
  target_name: string | null;
  target_email: string;
  status: 'pending' | 'accepted' | 'rejected' | 'canceled' | 'expired';
  created_at: Date;
};

type RoomRelationshipRow = {
  id: string;
  guardian_user_id: string;
  guardian_name: string | null;
  guardian_email: string;
  child_user_id: string;
  child_name: string | null;
  child_email: string;
  status: 'pending' | 'active' | 'rejected' | 'removed';
  created_by: string | null;
  responded_by_user_id: string | null;
  responded_at: Date | null;
  created_at: Date;
};

type DirectRoomPeerTitleRow = {
  room_id: string;
  peer_name: string;
};

type RoomRow = {
  id: string;
  type: RoomType;
  title: string | null;
  created_by: string;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
};

type RoomMessageRow = {
  id: string;
  room_id: string;
  sender_id: string | null;
  kind: MessageKind;
  text: string | null;
  media_url: string | null;
  delivery: 'sent' | 'delivered' | 'read';
  created_at: Date;
  order_seq: number;
  sender_name: string | null;
  sender_email: string | null;
  unread_count?: number;
  read_by_names?: string[] | null;
};

type RoleRow = {
  role: 'parent' | 'user';
};

type ReportRow = {
  id: string;
  status: 'open' | 'reviewed' | 'closed';
  reason: string;
  room_id: string;
  message_id: string | null;
  created_at: Date;
  updated_at: Date;
  reporter_id: string;
  reporter_name: string | null;
  reporter_email: string;
};

type BotRecipientRow = {
  user_id: string;
  bot_key: string;
  bot_name: string;
};

type PushRecipientRow = {
  user_id: string;
  platform: 'android' | 'ios' | 'web';
  push_token: string;
  locale: string | null;
};

type MediaAssetRow = {
  file_url: string;
  mime_type: string;
  size_bytes: number;
};

type UserLocationLatestRow = {
  user_id: string;
  latitude: number;
  longitude: number;
  accuracy_m: number | null;
  captured_at: Date;
  source: 'heartbeat' | 'precision_refresh' | 'manual_refresh';
};

type UserLocationPrecisionRequestRow = {
  user_id: string;
  requested_by_user_id: string | null;
  requested_by_kind: 'guardian_app' | 'guardian_console';
  room_id: string | null;
  requested_at: Date;
  expires_at: Date;
  consumed_at: Date | null;
  request_token_hash: string | null;
};

type FamilyRoomLocationRow = {
  user_id: string;
  display_name: string | null;
  email: string;
  avatar_url: string | null;
  latitude: number;
  longitude: number;
  accuracy_m: number | null;
  captured_at: Date;
  source: 'heartbeat' | 'precision_refresh' | 'manual_refresh';
};

type SocialServiceDeps = {
  db: Pool;
  connectionManager: ConnectionManager;
  clawBridge: ClawBridgeService;
  pushService: FcmPushService;
  logger: FastifyBaseLogger;
};

const MAX_MEDIA_UPLOAD_BYTES = 200 * 1024 * 1024;

function normalizeName(displayName: string | null, email: string): string {
  if (displayName && displayName.trim().length > 0) {
    return displayName.trim();
  }
  return email;
}

function normalizeLocaleTag(locale?: string | null): 'ko-KR' | 'en-US' {
  const value = (locale || '').trim().toLowerCase();
  return value.startsWith('ko') ? 'ko-KR' : 'en-US';
}

function isKoreanLocale(locale?: string | null): boolean {
  return normalizeLocaleTag(locale) === 'ko-KR';
}

function getPushMessagePreview(kind: MessageKind, text: string | undefined, locale?: string | null): string {
  if (kind === 'text') return text?.trim() || '';
  if (kind === 'image') return isKoreanLocale(locale) ? '사진' : 'Image';
  if (kind === 'video') return isKoreanLocale(locale) ? '동영상' : 'Video';
  return text?.trim() || '';
}

function getFriendPushCopy(
  type: 'request' | 'accepted' | 'rejected',
  locale?: string | null
): { title: string; body: string } {
  if (isKoreanLocale(locale)) {
    if (type === 'request') {
      return { title: '친구 요청이 도착했어요', body: '친구 탭에서 요청을 확인해 보세요.' };
    }
    if (type === 'accepted') {
      return { title: '친구 요청이 수락되었어요', body: '이제 바로 대화를 시작할 수 있어요.' };
    }
    return { title: '친구 요청이 거절되었어요', body: '친구 탭에서 상태를 확인해 보세요.' };
  }
  if (type === 'request') {
    return { title: 'New friend request', body: 'Check the request in your Friends tab.' };
  }
  if (type === 'accepted') {
    return { title: 'Friend request accepted', body: 'You can start chatting right away.' };
  }
  return { title: 'Friend request declined', body: 'Check the status in your Friends tab.' };
}

function getRoomInvitationPushCopy(
  locale?: string | null,
  roomTitle?: string | null
): { title: string; body: string } {
  const safeRoomTitle = roomTitle?.trim();
  if (isKoreanLocale(locale)) {
    return {
      title: '가족방 초대가 도착했어요',
      body: safeRoomTitle ? `${safeRoomTitle} 초대를 확인해 보세요.` : '친구 탭에서 방 초대를 확인해 보세요.',
    };
  }
  return {
    title: 'New room invitation',
    body: safeRoomTitle ? `Check the invitation to ${safeRoomTitle}.` : 'Check the room invite in your Friends tab.',
  };
}

function createLocationRequestToken(): string {
  return randomBytes(32).toString('base64url');
}

function hashLocationRequestToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function makeSystemMessageToken(type: 'member_left', displayName: string): string {
  return `__sys__:${type}:${encodeURIComponent(displayName)}`;
}

function encodeCursor(input: CursorInput): string {
  return Buffer.from(
    JSON.stringify({ at: input.at.toISOString(), id: input.id, order: input.order ?? null }),
    'utf8'
  ).toString('base64url');
}

function decodeCursor(raw?: string): CursorInput | null {
  if (!raw || raw.trim().length === 0) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as {
      at?: string;
      id?: string;
      order?: number;
    };
    if (!parsed.at || !parsed.id) {
      return null;
    }

    const at = new Date(parsed.at);
    if (Number.isNaN(at.getTime())) {
      return null;
    }

    return {
      at,
      id: parsed.id,
      order: Number.isFinite(parsed.order) ? Number(parsed.order) : undefined
    };
  } catch {
    return null;
  }
}

function normalizeLimit(limit: number | undefined, defaultValue: number, max = 100): number {
  const value = limit ?? defaultValue;
  if (!Number.isFinite(value)) {
    return defaultValue;
  }

  const asInt = Math.floor(value);
  if (asInt < 1) {
    return 1;
  }
  if (asInt > max) {
    return max;
  }
  return asInt;
}

function mapMimeToExtension(mimeType: string): string {
  const lower = mimeType.toLowerCase();
  if (lower === 'image/jpeg' || lower === 'image/jpg') {
    return 'jpg';
  }
  if (lower === 'image/png') {
    return 'png';
  }
  if (lower === 'image/webp') {
    return 'webp';
  }
  if (lower === 'video/mp4') {
    return 'mp4';
  }
  if (lower === 'video/webm') {
    return 'webm';
  }
  return 'bin';
}

function normalizeMessagePreview(kind: MessageKind | null, text: string | null): string | undefined {
  if (!kind) {
    return undefined;
  }

  if (kind === 'image') {
    return '[image]';
  }
  if (kind === 'video') {
    return '[video]';
  }
  return text ?? '';
}

function normalizeBotAlias(value: string): string {
  return value.toLowerCase().replace(/[\s_-]+/g, '');
}

function getDirectKey(userIdA: string, userIdB: string): string {
  const [a, b] = [userIdA, userIdB].sort();
  return `${a}:${b}`;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function getMediaPublicBaseUrl(): string {
  return trimTrailingSlash(env.PUBLIC_BASE_URL);
}

function getMediaPublicPrefix(): string {
  return `${getMediaPublicBaseUrl()}/v1/media/files/`;
}

function buildMediaFileUrl(relativePath: string): string {
  return `${getMediaPublicPrefix()}${relativePath.replace(/^\/+/, '')}`;
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
  if (relativeToRoot.startsWith('..') || relativeToRoot === '') {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Invalid media file path.');
  }

  return absolutePath;
}

export class SocialService {
  private readonly db: Pool;
  private readonly connectionManager: ConnectionManager;
  private readonly clawBridge: ClawBridgeService;
  private readonly pushService: FcmPushService;
  private readonly logger: FastifyBaseLogger;

  constructor(deps: SocialServiceDeps) {
    this.db = deps.db;
    this.connectionManager = deps.connectionManager;
    this.clawBridge = deps.clawBridge;
    this.pushService = deps.pushService;
    this.logger = deps.logger;
  }

  getMediaPublicBaseUrl(): string {
    return getMediaPublicBaseUrl();
  }

  async getMeProfile(userId: string): Promise<UserProfileDto> {
    const row = await this.getUserProfileRow(userId);
    return this.mapProfile(row);
  }

  async updateMeProfile(
    userId: string,
    input: {
      name?: string;
      status?: string;
      avatarUri?: string;
      locale?: string;
      locationSharingEnabled?: boolean;
    }
  ): Promise<UserProfileDto> {
    const hasName = input.name !== undefined;
    const hasStatus = input.status !== undefined;
    const hasAvatar = input.avatarUri !== undefined;
    const hasLocale = input.locale !== undefined;
    const hasLocationSharing = input.locationSharingEnabled !== undefined;

    if (!hasName && !hasStatus && !hasAvatar && !hasLocale && !hasLocationSharing) {
      return this.getMeProfile(userId);
    }

    const nameValue = hasName ? (input.name?.trim() || null) : null;
    const statusValue = hasStatus ? (input.status?.trim() || null) : null;
    const avatarValue = hasAvatar ? (input.avatarUri?.trim() || null) : null;
    const localeValue = hasLocale ? normalizeLocaleTag(input.locale) : null;

    const updated = await this.db.query<UserProfileRow>(
      `UPDATE users
       SET display_name = CASE WHEN $2::boolean THEN $3 ELSE display_name END,
           status_message = CASE WHEN $4::boolean THEN $5 ELSE status_message END,
           avatar_url = CASE WHEN $6::boolean THEN $7 ELSE avatar_url END,
           locale = CASE WHEN $8::boolean THEN $9 ELSE locale END,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, email, display_name, status_message, avatar_url, locale`,
      [userId, hasName, nameValue, hasStatus, statusValue, hasAvatar, avatarValue, hasLocale, localeValue]
    );

    const row = updated.rows[0];
    if (!row) {
      throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, 'User not found.');
    }

    const friendIds = await this.getFriendUserIds(userId);
    if (friendIds.length > 0) {
      this.emitToUsers(friendIds, {
        event: 'friend.updated',
        data: {
          type: 'profile',
          peerUserId: userId
        }
      });
    }

    if (hasLocationSharing) {
      await this.upsertUserLocationSettings(userId, !!input.locationSharingEnabled);
      if (!input.locationSharingEnabled) {
        await this.db.query(`DELETE FROM user_location_latest WHERE user_id = $1`, [userId]);
        await this.db.query(`DELETE FROM user_location_precision_requests WHERE user_id = $1`, [userId]);
      }
    }

    return this.mapProfile(row);
  }

  async updateMyLocation(params: {
    userId: string;
    latitude: number;
    longitude: number;
    accuracyM?: number | null;
    capturedAt?: string;
    source: 'heartbeat' | 'precision_refresh' | 'manual_refresh';
  }): Promise<UserLocationDto> {
    const settings = await this.getUserLocationSettings(params.userId);
    if (!settings.sharingEnabled) {
      throw new AppError(409, ErrorCodes.CONFLICT, 'Location sharing is disabled for this account.');
    }

    if (!Number.isFinite(params.latitude) || !Number.isFinite(params.longitude)) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Latitude and longitude are required.');
    }
    if (params.latitude < -90 || params.latitude > 90 || params.longitude < -180 || params.longitude > 180) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Latitude or longitude is out of range.');
    }

    const capturedAt = params.capturedAt ? new Date(params.capturedAt) : new Date();
    if (Number.isNaN(capturedAt.getTime())) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'capturedAt is invalid.');
    }

    const result = await this.db.query<UserLocationLatestRow>(
      `INSERT INTO user_location_latest (
         user_id,
         latitude,
         longitude,
         accuracy_m,
         captured_at,
         source,
         created_at,
         updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       ON CONFLICT (user_id)
       DO UPDATE SET
         latitude = EXCLUDED.latitude,
         longitude = EXCLUDED.longitude,
         accuracy_m = EXCLUDED.accuracy_m,
         captured_at = EXCLUDED.captured_at,
         source = EXCLUDED.source,
         updated_at = NOW()
       RETURNING user_id, latitude, longitude, accuracy_m, captured_at, source`,
      [
        params.userId,
        params.latitude,
        params.longitude,
        params.accuracyM ?? null,
        capturedAt,
        params.source
      ]
    );

    if (params.source === 'precision_refresh' || params.source === 'manual_refresh') {
      await this.db.query(
        `UPDATE user_location_precision_requests
         SET consumed_at = NOW(),
             updated_at = NOW()
         WHERE user_id = $1
           AND consumed_at IS NULL`,
        [params.userId]
      );
    }

    return this.mapUserLocation(result.rows[0]);
  }

  async getMyLocationRefreshRequest(userId: string): Promise<UserLocationRefreshRequestDto> {
    const row = await this.getPendingLocationPrecisionRequest(userId);
    if (!row) {
      return { pending: false };
    }
    return {
      pending: true,
      requestId: row.user_id,
      requestedAt: row.requested_at.toISOString(),
      expiresAt: row.expires_at.toISOString()
    };
  }

  async listFamilyRoomLocations(params: {
    userId: string;
    roomId: string;
  }): Promise<{ items: Array<UserLocationDto & { name: string; avatarUri?: string }> }> {
    const membership = await this.getRoomMembership(params.roomId, params.userId);
    this.assertFamilyRoom(membership);

    const result = await this.db.query<FamilyRoomLocationRow>(
      `SELECT latest.user_id,
              u.display_name,
              u.email,
              u.avatar_url,
              latest.latitude,
              latest.longitude,
              latest.accuracy_m,
              latest.captured_at,
              latest.source
       FROM room_relationships rr
       INNER JOIN user_location_settings settings
               ON settings.user_id = rr.child_user_id
              AND settings.sharing_enabled = TRUE
       INNER JOIN user_location_latest latest
               ON latest.user_id = rr.child_user_id
       INNER JOIN users u ON u.id = rr.child_user_id
       WHERE rr.room_id = $1
         AND rr.relationship_type = 'guardian_child'
         AND rr.status = 'active'
         AND rr.guardian_user_id = $2
       ORDER BY latest.captured_at DESC`,
      [params.roomId, params.userId]
    );

    return {
      items: result.rows.map((row) => ({
        ...this.mapUserLocation({
          user_id: row.user_id,
          latitude: row.latitude,
          longitude: row.longitude,
          accuracy_m: row.accuracy_m,
          captured_at: row.captured_at,
          source: row.source
        }),
        name: normalizeName(row.display_name, row.email),
        ...(row.avatar_url ? { avatarUri: row.avatar_url } : {})
      }))
    };
  }

  async requestFamilyRoomLocationRefresh(params: {
    userId: string;
    roomId: string;
    targetUserId: string;
    backendBaseUrl?: string;
  }): Promise<UserLocationRefreshRequestDto> {
    const membership = await this.getRoomMembership(params.roomId, params.userId);
    this.assertFamilyRoom(membership);

    const targetUserId = params.targetUserId.trim();
    if (!targetUserId) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Target user id is required.');
    }

    const allowed = await this.db.query<{ exists: boolean }>(
      `SELECT EXISTS(
         SELECT 1
         FROM room_relationships rr
         WHERE rr.room_id = $1
           AND rr.relationship_type = 'guardian_child'
           AND rr.status = 'active'
           AND rr.guardian_user_id = $2
           AND rr.child_user_id = $3
       ) AS exists`,
      [params.roomId, params.userId, targetUserId]
    );

    if (!(allowed.rows[0]?.exists ?? false)) {
      throw new AppError(403, ErrorCodes.FORBIDDEN, 'You do not have access to request this member location.');
    }

    const { request, requestToken } = await this.upsertLocationPrecisionRequest({
      userId: targetUserId,
      requestedByKind: 'guardian_app',
      requestedByUserId: params.userId,
      roomId: params.roomId
    });

    this.logger.info(
      {
        tag: 'location_refresh.requested',
        roomId: params.roomId,
        requesterUserId: params.userId,
        targetUserId,
        requestedAt: request.requested_at.toISOString(),
        expiresAt: request.expires_at.toISOString(),
        requestTokenHashPrefix: hashLocationRequestToken(requestToken).slice(0, 12),
        backendBaseUrl: (params.backendBaseUrl || '').trim()
      },
      'Location precision refresh requested'
    );

    this.connectionManager.sendToUser(targetUserId, {
      event: 'location.precision.requested',
      data: {
        requestedAt: request.requested_at.toISOString(),
        expiresAt: request.expires_at.toISOString(),
        requestToken,
        backendBaseUrl: (params.backendBaseUrl || '').trim()
      }
    });

    if (this.pushService.isEnabled()) {
      const pushTokens = await this.db.query<{ push_token: string }>(
        `SELECT DISTINCT push_token
         FROM device_tokens
         WHERE user_id = $1`,
        [targetUserId]
      );
      this.logger.info(
        {
          tag: 'location_refresh.push.prepare',
          roomId: params.roomId,
          targetUserId,
          pushTokenCount: pushTokens.rows.length,
          requestTokenHashPrefix: hashLocationRequestToken(requestToken).slice(0, 12)
        },
        'Preparing location refresh push'
      );
      const result = await this.pushService.send({
        tokens: pushTokens.rows.map((row) => row.push_token),
        data: {
          locationAction: 'refresh',
          requestedAt: request.requested_at.toISOString(),
          expiresAt: request.expires_at.toISOString(),
          requestToken,
          backendBaseUrl: (params.backendBaseUrl || '').trim()
        },
        headless: true
      });
      this.logger.info(
        {
          tag: 'location_refresh.push.result',
          roomId: params.roomId,
          targetUserId,
          sentCount: result.sentCount,
          invalidTokens: result.invalidTokens,
          requestTokenHashPrefix: hashLocationRequestToken(requestToken).slice(0, 12)
        },
        'Location refresh push send result'
      );
      if (result.invalidTokens.length > 0) {
        await this.db.query('DELETE FROM device_tokens WHERE push_token = ANY($1::text[])', [result.invalidTokens]);
      }
    } else {
      this.logger.warn(
        {
          tag: 'location_refresh.push.disabled',
          roomId: params.roomId,
          targetUserId
        },
        'Push service disabled for location refresh request'
      );
    }

    return {
      pending: true,
      requestId: request.user_id,
      requestedAt: request.requested_at.toISOString(),
      expiresAt: request.expires_at.toISOString()
    };
  }

  async completeLocationPrecisionRequest(params: {
    requestToken: string;
    latitude: number;
    longitude: number;
    accuracyM?: number | null;
    capturedAt?: string;
    source?: 'precision_refresh' | 'manual_refresh';
  }): Promise<UserLocationDto> {
    const requestToken = params.requestToken.trim();
    if (!requestToken) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Location request token is required.');
    }
    if (!Number.isFinite(params.latitude) || !Number.isFinite(params.longitude)) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Latitude and longitude are required.');
    }
    if (params.latitude < -90 || params.latitude > 90 || params.longitude < -180 || params.longitude > 180) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Latitude or longitude is out of range.');
    }

    const capturedAt = params.capturedAt ? new Date(params.capturedAt) : new Date();
    if (Number.isNaN(capturedAt.getTime())) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'capturedAt is invalid.');
    }

    const requestTokenHash = hashLocationRequestToken(requestToken);
    const request = await this.db.query<UserLocationPrecisionRequestRow>(
      `SELECT user_id,
              requested_by_user_id,
              requested_by_kind,
              room_id,
              requested_at,
              expires_at,
              consumed_at,
              request_token_hash
       FROM user_location_precision_requests
       WHERE request_token_hash = $1
         AND consumed_at IS NULL
         AND expires_at > NOW()
       LIMIT 1`,
      [requestTokenHash]
    );

    const row = request.rows[0];
    if (!row) {
      this.logger.warn(
        {
          tag: 'location_refresh.consume.invalid',
          requestTokenHashPrefix: requestTokenHash.slice(0, 12)
        },
        'Location precision consume rejected due to invalid or expired token'
      );
      throw new AppError(401, ErrorCodes.AUTH_UNAUTHORIZED, 'Location request token is invalid or expired.');
    }

    this.logger.info(
      {
        tag: 'location_refresh.consume.start',
        targetUserId: row.user_id,
        requestedByUserId: row.requested_by_user_id,
        roomId: row.room_id,
        requestTokenHashPrefix: requestTokenHash.slice(0, 12),
        requestedAt: row.requested_at.toISOString(),
        expiresAt: row.expires_at.toISOString(),
        source: params.source || 'precision_refresh'
      },
      'Location precision consume started'
    );

    await this.upsertUserLocationSettings(row.user_id, true);

    const source = params.source === 'manual_refresh' ? 'manual_refresh' : 'precision_refresh';
    const result = await this.db.query<UserLocationLatestRow>(
      `INSERT INTO user_location_latest (
         user_id,
         latitude,
         longitude,
         accuracy_m,
         captured_at,
         source,
         created_at,
         updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       ON CONFLICT (user_id)
       DO UPDATE SET
         latitude = EXCLUDED.latitude,
         longitude = EXCLUDED.longitude,
         accuracy_m = EXCLUDED.accuracy_m,
         captured_at = EXCLUDED.captured_at,
         source = EXCLUDED.source,
         updated_at = NOW()
       RETURNING user_id, latitude, longitude, accuracy_m, captured_at, source`,
      [row.user_id, params.latitude, params.longitude, params.accuracyM ?? null, capturedAt, source]
    );

    await this.db.query(
      `UPDATE user_location_precision_requests
       SET consumed_at = NOW(),
           updated_at = NOW()
       WHERE user_id = $1
         AND request_token_hash = $2
         AND consumed_at IS NULL`,
      [row.user_id, requestTokenHash]
    );

    this.logger.info(
      {
        tag: 'location_refresh.consume.success',
        targetUserId: row.user_id,
        requestedByUserId: row.requested_by_user_id,
        roomId: row.room_id,
        requestTokenHashPrefix: requestTokenHash.slice(0, 12),
        capturedAt: result.rows[0].captured_at.toISOString(),
        source
      },
      'Location precision consume completed'
    );

    return this.mapUserLocation(result.rows[0]);
  }

  async issueAvatarUploadUrl(
    userId: string,
    params: {
      mimeType: string;
      size: number;
    }
  ): Promise<{ uploadUrl: string; fileUrl: string; expiresInSec: number }> {
    return this.issueMediaUploadUrl(userId, {
      kind: 'avatar',
      mimeType: params.mimeType,
      size: params.size
    });
  }

  async issueMediaUploadUrl(
    userId: string,
    params: {
      kind: 'image' | 'video' | 'avatar';
      mimeType: string;
      size: number;
    }
  ): Promise<{ uploadUrl: string; fileUrl: string; expiresInSec: number }> {
    const kind = params.kind;
    const mimeType = params.mimeType.trim().toLowerCase();
    const size = params.size;

    if (size <= 0 || size > MAX_MEDIA_UPLOAD_BYTES) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Invalid media size. Allowed range is 1 byte to 200MB.');
    }

    if (kind === 'image' && !mimeType.startsWith('image/')) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'mimeType must be image/* for kind=image.');
    }
    if (kind === 'video' && !mimeType.startsWith('video/')) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'mimeType must be video/* for kind=video.');
    }
    if (kind === 'avatar' && !mimeType.startsWith('image/')) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'mimeType must be image/* for avatar upload.');
    }

    const now = new Date();
    const y = String(now.getUTCFullYear());
    const m = String(now.getUTCMonth() + 1).padStart(2, '0');
    const ext = mapMimeToExtension(mimeType);
    const fileId = randomUUID();
    const relativePath = `${y}/${m}/${fileId}.${ext}`;
    const fileUrl = buildMediaFileUrl(relativePath);
    const uploadUrl = `${getMediaPublicBaseUrl()}/v1/media/upload?fileUrl=${encodeURIComponent(fileUrl)}`;

    await this.db.query(
      `INSERT INTO media_assets (owner_user_id, kind, mime_type, size_bytes, file_url, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')`,
      [userId, kind, mimeType, size, fileUrl]
    );

    return {
      uploadUrl,
      fileUrl,
      expiresInSec: 300
    };
  }

  async storeUploadedMedia(
    userId: string,
    params: {
      fileUrl: string;
      bytes: Buffer;
    }
  ): Promise<{ fileUrl: string; status: 'uploaded' }> {
    const fileUrl = params.fileUrl.trim();
    if (!fileUrl) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'fileUrl is required.');
    }

    const pending = await this.db.query<{ size_bytes: number }>(
      `SELECT size_bytes
       FROM media_assets
       WHERE owner_user_id = $1
         AND file_url = $2
         AND status = 'pending'
       LIMIT 1`,
      [userId, fileUrl]
    );

    const row = pending.rows[0];
    if (!row) {
      throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, 'Pending media asset not found.');
    }

    if (!params.bytes.length) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Media payload is empty.');
    }

    if (params.bytes.length > Number(row.size_bytes)) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Uploaded media exceeds the declared size.');
    }

    const storagePath = resolveMediaStoragePath(fileUrl);
    await fs.mkdir(dirname(storagePath), { recursive: true });
    await fs.writeFile(storagePath, params.bytes);

    return {
      fileUrl,
      status: 'uploaded'
    };
  }

  async completeMediaUpload(
    userId: string,
    params: {
      fileUrl: string;
      kind: 'image' | 'video' | 'avatar';
    }
  ): Promise<{ fileUrl: string; kind: 'image' | 'video' | 'avatar'; status: 'completed' }> {
    const storagePath = resolveMediaStoragePath(params.fileUrl);
    try {
      await fs.access(storagePath);
    } catch {
      throw new AppError(409, ErrorCodes.CONFLICT, 'Media file has not been uploaded yet.');
    }

    const result = await this.db.query<{ file_url: string; kind: 'image' | 'video' | 'avatar' }>(
      `UPDATE media_assets
       SET status = 'completed',
           updated_at = NOW()
       WHERE owner_user_id = $1
         AND file_url = $2
         AND kind = $3
         AND status = 'pending'
       RETURNING file_url, kind`,
      [userId, params.fileUrl, params.kind]
    );

    const row = result.rows[0];
    if (!row) {
      throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, 'Pending media asset not found.');
    }

    if (row.kind === 'avatar') {
      await this.db.query(
        `UPDATE users
         SET avatar_url = $2,
             updated_at = NOW()
         WHERE id = $1`,
        [userId, row.file_url]
      );
    }

    return {
      fileUrl: row.file_url,
      kind: row.kind,
      status: 'completed'
    };
  }

  async getCompletedMediaDownload(fileUrl: string): Promise<{ path: string; mimeType: string; size: number }> {
    const normalizedFileUrl = fileUrl.trim();
    let routePath = '';
    try {
      routePath = new URL(normalizedFileUrl).pathname;
    } catch {
      routePath = normalizedFileUrl.startsWith('/') ? normalizedFileUrl : '';
    }

    const result = await this.db.query<MediaAssetRow>(
      `SELECT file_url, mime_type, size_bytes
       FROM media_assets
       WHERE status = 'completed'
         AND (
           file_url = $1
           OR ($2 <> '' AND file_url LIKE '%' || $2)
         )
       ORDER BY CASE WHEN file_url = $1 THEN 0 ELSE 1 END, updated_at DESC
       LIMIT 1`,
      [normalizedFileUrl, routePath]
    );

    const row = result.rows[0];
    if (!row) {
      throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, 'Media asset not found.');
    }

    const path = resolveMediaStoragePath(row.file_url);
    const stat = await fs.stat(path).catch(() => null);
    if (!stat?.isFile()) {
      throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, 'Media file not found.');
    }

    return {
      path,
      mimeType: row.mime_type,
      size: stat.size || Number(row.size_bytes) || 0
    };
  }

  async listFriends(params: {
    userId: string;
    limit?: number;
    cursor?: string;
  }): Promise<{
    items: Array<{
      id: string;
      name: string;
      profileName: string;
      aliasName?: string;
      status?: string;
      avatarUri?: string;
      trusted: boolean;
      family?: {
        isFamily: true;
        relationshipId: string;
        relationshipType: 'parent_child';
        displayLabel?: 'mother' | 'father' | 'guardian' | 'child';
        familyGroupId?: string;
        status: 'active';
      };
    }>;
    nextCursor?: string;
  }> {
    const limit = normalizeLimit(params.limit, 30, 100);
    const cursor = decodeCursor(params.cursor);

    const result = await this.db.query<FriendRow>(
      `SELECT f.id,
              f.friend_user_id,
              f.trusted,
              f.created_at,
              u.display_name AS friend_name,
              u.status_message AS friend_status,
              u.avatar_url AS friend_avatar_url,
              u.email AS friend_email
       FROM friendships f
       INNER JOIN users u ON u.id = f.friend_user_id
       WHERE f.user_id = $1
          AND (
            $2::timestamptz IS NULL OR
           f.created_at < $2 OR
           (f.created_at = $2 AND f.id < $3::uuid)
         )
       ORDER BY f.created_at DESC, f.id DESC
       LIMIT $4`,
      [params.userId, cursor?.at ?? null, cursor?.id ?? null, limit + 1]
    );

    const hasMore = result.rows.length > limit;
    const rows = hasMore ? result.rows.slice(0, limit) : result.rows;
    const friendUserIds = rows.map((row) => row.friend_user_id);
    const aliasesByTarget = new Map<string, string>();
    const familyByPeer = new Map<string, FriendFamilySummaryRow>();

    if (friendUserIds.length > 0) {
      try {
        const aliasResult = await this.db.query<FriendAliasRow>(
          `SELECT target_user_id, alias
           FROM user_aliases
           WHERE owner_user_id = $1
             AND target_user_id = ANY($2::uuid[])`,
          [params.userId, friendUserIds]
        );
        aliasResult.rows.forEach((row) => {
          const alias = (row.alias || '').trim();
          if (alias) {
            aliasesByTarget.set(row.target_user_id, alias);
          }
        });
      } catch (error) {
        this.logger.warn({ error, userId: params.userId }, 'Failed to load friend aliases. Falling back to profile names.');
      }

      try {
        const familyResult = await this.db.query<FriendFamilySummaryRow>(
          `SELECT peer_user_id,
                  relationship_id,
                  family_group_id,
                  relationship_type,
                  status,
                  display_label,
                  custom_label
           FROM (
             SELECT CASE WHEN ur.user_a_id = $1 THEN ur.user_b_id ELSE ur.user_a_id END AS peer_user_id,
                    ur.id AS relationship_id,
                    ur.family_group_id,
                    ur.relationship_type,
                    ur.status,
                    CASE
                      WHEN ur.user_a_id = $1 THEN ur.label_for_user_a
                      ELSE ur.label_for_user_b
                    END AS display_label,
                    peer_member.custom_label
             FROM user_relationships ur
             LEFT JOIN family_group_members peer_member
                    ON peer_member.family_group_id = ur.family_group_id
                   AND peer_member.user_id = CASE WHEN ur.user_a_id = $1 THEN ur.user_b_id ELSE ur.user_a_id END
                   AND peer_member.status = 'active'
             WHERE ur.relationship_type = 'parent_child'
               AND ur.status = 'active'
               AND (ur.user_a_id = $1 OR ur.user_b_id = $1)
           ) AS family_links
           WHERE peer_user_id = ANY($2::uuid[])`,
          [params.userId, friendUserIds]
        );
        familyResult.rows.forEach((row) => {
          familyByPeer.set(row.peer_user_id, row);
        });
      } catch (error) {
        this.logger.warn({ error, userId: params.userId }, 'Failed to load family summaries. Returning friend list only.');
      }
    }

    const items = rows.map((row) => {
      const profileName = normalizeName(row.friend_name, row.friend_email);
      const family = familyByPeer.get(row.friend_user_id);
      const familyLabel = (family?.custom_label || '').trim();
      const aliasName = aliasesByTarget.get(row.friend_user_id) || familyLabel;
      return {
        id: row.friend_user_id,
        name: aliasName || profileName,
        profileName,
        ...(aliasName ? { aliasName } : {}),
        ...(row.friend_status ? { status: row.friend_status } : {}),
        ...(row.friend_avatar_url ? { avatarUri: row.friend_avatar_url } : {}),
        trusted: row.trusted,
        ...(family?.relationship_id && family.relationship_type && family.status
        ? {
            family: {
              isFamily: true as const,
              relationshipId: family.relationship_id,
              relationshipType: family.relationship_type,
              ...(family.display_label ? { displayLabel: family.display_label } : {}),
              ...(family.family_group_id ? { familyGroupId: family.family_group_id } : {}),
              status: family.status
            }
          }
        : {})
      };
    });

    const last = rows[rows.length - 1];
    return {
      items,
      ...(hasMore && last ? { nextCursor: encodeCursor({ at: last.created_at, id: last.id }) } : {})
    };
  }

  async searchUsersForFriend(params: {
    userId: string;
    q: string;
    limit?: number;
  }): Promise<{
    items: Array<{
      id: string;
      name: string;
      status?: string;
      email: string;
      avatarUri?: string;
      isFriend: boolean;
      outgoingPending: boolean;
      incomingPending: boolean;
    }>;
  }> {
    const q = params.q.trim().toLowerCase();
    if (q.length < 1) {
      return { items: [] };
    }

    const limit = normalizeLimit(params.limit, 20, 50);
    const like = `%${q}%`;

    const result = await this.db.query<FriendSearchRow>(
      `SELECT u.id,
              u.email,
              u.display_name,
              u.status_message,
              u.avatar_url,
              EXISTS (
                SELECT 1
                FROM friendships f
                WHERE f.user_id = $1
                  AND f.friend_user_id = u.id
              ) AS is_friend,
              EXISTS (
                SELECT 1
                FROM friend_requests fr
                WHERE fr.requester_id = $1
                  AND fr.target_id = u.id
                  AND fr.status = 'pending'
              ) AS outgoing_pending,
              EXISTS (
                SELECT 1
                FROM friend_requests fr
                WHERE fr.requester_id = u.id
                  AND fr.target_id = $1
                  AND fr.status = 'pending'
              ) AS incoming_pending
       FROM users u
       WHERE u.id <> $1
         AND (
           lower(u.email) LIKE $2 OR
           lower(COALESCE(u.display_name, '')) LIKE $2
         )
       ORDER BY
         CASE WHEN lower(u.email) = $3 THEN 0 ELSE 1 END,
         u.created_at DESC
       LIMIT $4`,
      [params.userId, like, q, limit]
    );

    return {
      items: result.rows.map((row) => ({
        id: row.id,
        name: normalizeName(row.display_name, row.email),
        ...(row.status_message ? { status: row.status_message } : {}),
        email: row.email,
        ...(row.avatar_url ? { avatarUri: row.avatar_url } : {}),
        isFriend: row.is_friend,
        outgoingPending: row.outgoing_pending,
        incomingPending: row.incoming_pending
      }))
    };
  }

  async listFriendRequests(userId: string): Promise<{
    incoming: Array<{
      id: string;
      peerUserId: string;
      peerName: string;
      createdAt: string;
    }>;
    outgoing: Array<{
      id: string;
      peerUserId: string;
      peerName: string;
      createdAt: string;
    }>;
  }> {
    const incomingResult = await this.db.query<FriendRequestRow>(
      `SELECT fr.id,
              fr.requester_id,
              fr.target_id,
              fr.status,
              fr.created_at,
              u.display_name AS peer_name,
              u.email AS peer_email
       FROM friend_requests fr
       INNER JOIN users u ON u.id = fr.requester_id
       WHERE fr.target_id = $1
         AND fr.status = 'pending'
       ORDER BY fr.created_at DESC`,
      [userId]
    );

    const outgoingResult = await this.db.query<FriendRequestRow>(
      `SELECT fr.id,
              fr.requester_id,
              fr.target_id,
              fr.status,
              fr.created_at,
              u.display_name AS peer_name,
              u.email AS peer_email
       FROM friend_requests fr
       INNER JOIN users u ON u.id = fr.target_id
       WHERE fr.requester_id = $1
         AND fr.status = 'pending'
       ORDER BY fr.created_at DESC`,
      [userId]
    );

    return {
      incoming: incomingResult.rows.map((row) => ({
        id: row.id,
        peerUserId: row.requester_id,
        peerName: normalizeName(row.peer_name, row.peer_email),
        createdAt: row.created_at.toISOString()
      })),
      outgoing: outgoingResult.rows.map((row) => ({
        id: row.id,
        peerUserId: row.target_id,
        peerName: normalizeName(row.peer_name, row.peer_email),
        createdAt: row.created_at.toISOString()
      }))
    };
  }

  async createFriendRequest(
    userId: string,
    targetUserId: string
  ): Promise<{
    requestId: string;
    status: 'pending';
    createdAt: string;
  }> {
    if (userId === targetUserId) {
      throw new AppError(409, ErrorCodes.CONFLICT, 'Cannot send friend request to yourself.');
    }

    const targetResult = await this.db.query<{ id: string }>(
      `SELECT id FROM users WHERE id = $1 LIMIT 1`,
      [targetUserId]
    );
    if (!targetResult.rows[0]) {
      throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, 'Target user not found.');
    }

    const friendshipExists = await this.isFriends(userId, targetUserId);
    if (friendshipExists) {
      throw new AppError(409, ErrorCodes.CONFLICT, 'Users are already friends.');
    }

    const pending = await this.db.query<{ id: string; requester_id: string; target_id: string }>(
      `SELECT id, requester_id, target_id
       FROM friend_requests
       WHERE status = 'pending'
         AND (
           (requester_id = $1 AND target_id = $2) OR
           (requester_id = $2 AND target_id = $1)
         )
       LIMIT 1`,
      [userId, targetUserId]
    );

    const pendingRow = pending.rows[0];
    if (pendingRow) {
      if (pendingRow.requester_id === targetUserId && pendingRow.target_id === userId) {
        throw new AppError(409, ErrorCodes.CONFLICT, 'Incoming friend request already exists. Accept it instead.');
      }
      throw new AppError(409, ErrorCodes.CONFLICT, 'Friend request is already pending.');
    }

    const inserted = await this.db.query<{ id: string; created_at: Date }>(
      `INSERT INTO friend_requests (requester_id, target_id, status, created_at, updated_at)
       VALUES ($1, $2, 'pending', NOW(), NOW())
       RETURNING id, created_at`,
      [userId, targetUserId]
    );

    const realtimePayload = {
      event: 'friend.updated',
      data: {
        type: 'request.incoming',
        fromUserId: userId,
        requestId: inserted.rows[0].id
      }
    };
    const delivered = this.connectionManager.sendToUser(targetUserId, realtimePayload);
    if (!delivered) {
      await this.sendPushToUsers({
        userIds: [targetUserId],
        resolveCopy: (locale) => getFriendPushCopy('request', locale),
        data: {
          type: 'friend.request',
          requestId: inserted.rows[0].id
        }
      });
    }

    return {
      requestId: inserted.rows[0].id,
      status: 'pending',
      createdAt: inserted.rows[0].created_at.toISOString()
    };
  }

  async acceptFriendRequest(
    userId: string,
    requestId: string
  ): Promise<{
    requestId: string;
    status: 'accepted';
    roomId: string;
  }> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      const requestResult = await client.query<{
        id: string;
        requester_id: string;
        target_id: string;
        status: 'pending' | 'accepted' | 'rejected' | 'canceled';
      }>(
        `SELECT id, requester_id, target_id, status
         FROM friend_requests
         WHERE id = $1
           AND target_id = $2
         FOR UPDATE`,
        [requestId, userId]
      );

      const request = requestResult.rows[0];
      if (!request) {
        throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, 'Friend request not found.');
      }
      if (request.status !== 'pending') {
        throw new AppError(409, ErrorCodes.CONFLICT, 'Friend request is already handled.');
      }

      await client.query(
        `UPDATE friend_requests
         SET status = 'accepted',
             responded_at = NOW(),
             updated_at = NOW()
         WHERE id = $1`,
        [requestId]
      );

      await this.createFriendshipPair(client, request.requester_id, request.target_id);
      const roomId = await this.ensureDirectRoomForUsers(client, request.requester_id, request.target_id, userId);

      await client.query('COMMIT');

      const friendPayload = {
        event: 'friend.updated',
        data: {
          type: 'accepted',
          requestId,
          roomId
        }
      };
      const requesterDelivered = this.connectionManager.sendToUser(request.requester_id, friendPayload);
      this.connectionManager.sendToUser(request.target_id, friendPayload);

      const roomPayload = {
        event: 'room.updated',
        data: {
          roomId
        }
      };
      this.connectionManager.sendToUser(request.requester_id, roomPayload);
      this.connectionManager.sendToUser(request.target_id, roomPayload);
      if (!requesterDelivered) {
        await this.sendPushToUsers({
          userIds: [request.requester_id],
          resolveCopy: (locale) => getFriendPushCopy('accepted', locale),
          data: {
            type: 'friend.accepted',
            requestId,
            roomId
          }
        });
      }

      return {
        requestId,
        status: 'accepted',
        roomId
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async rejectFriendRequest(userId: string, requestId: string): Promise<{ requestId: string; status: 'rejected' }> {
    const result = await this.db.query<{ id: string; requester_id: string }>(
      `UPDATE friend_requests
       SET status = 'rejected',
           responded_at = NOW(),
           updated_at = NOW()
       WHERE id = $1
         AND target_id = $2
         AND status = 'pending'
       RETURNING id, requester_id`,
      [requestId, userId]
    );

    const row = result.rows[0];
    if (!row) {
      throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, 'Pending friend request not found.');
    }

    const delivered = this.connectionManager.sendToUser(row.requester_id, {
      event: 'friend.updated',
      data: {
        type: 'rejected',
        requestId
      }
    });
    if (!delivered) {
      await this.sendPushToUsers({
        userIds: [row.requester_id],
        resolveCopy: (locale) => getFriendPushCopy('rejected', locale),
        data: {
          type: 'friend.rejected',
          requestId
        }
      });
    }

    return {
      requestId,
      status: 'rejected'
    };
  }

  async setFriendTrusted(userId: string, friendUserId: string, trusted: boolean): Promise<{ trusted: boolean }> {
    const result = await this.db.query<{ trusted: boolean }>(
      `UPDATE friendships
       SET trusted = $3,
           updated_at = NOW()
       WHERE user_id = $1
         AND friend_user_id = $2
       RETURNING trusted`,
      [userId, friendUserId, trusted]
    );

    if (!result.rows[0]) {
      throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, 'Friendship not found.');
    }

    this.emitToUsers([userId], {
      event: 'friend.updated',
      data: {
        type: 'trusted.changed',
        friendUserId,
        trusted
      }
    });

    return {
      trusted: result.rows[0].trusted
    };
  }

  async setFriendAlias(
    userId: string,
    friendUserId: string,
    aliasInput?: string | null
  ): Promise<{ friendUserId: string; profileName: string; displayName: string; aliasName?: string }> {
    if (!(await this.isFriends(userId, friendUserId))) {
      throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, 'Friendship not found.');
    }

    const alias = (aliasInput || '').trim();
    if (alias.length > 100) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Alias must be 1-100 characters.');
    }

    if (!alias) {
      await this.db.query(
        `DELETE FROM user_aliases
         WHERE owner_user_id = $1
           AND target_user_id = $2`,
        [userId, friendUserId]
      );
    } else {
      await this.db.query(
        `INSERT INTO user_aliases (owner_user_id, target_user_id, alias, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())
         ON CONFLICT (owner_user_id, target_user_id)
         DO UPDATE SET
           alias = EXCLUDED.alias,
           updated_at = NOW()`,
        [userId, friendUserId, alias]
      );
    }

    const friendResult = await this.db.query<{ display_name: string | null; email: string }>(
      `SELECT display_name, email
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [friendUserId]
    );
    const row = friendResult.rows[0];
    if (!row) {
      throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, 'Target user not found.');
    }
    const profileName = normalizeName(row.display_name, row.email);

    this.emitToUsers([userId], {
      event: 'friend.updated',
      data: {
        type: 'alias.changed',
        friendUserId
      }
    });

    return {
      friendUserId,
      profileName,
      displayName: alias || profileName,
      ...(alias ? { aliasName: alias } : {})
    };
  }

  async removeFriend(userId: string, friendUserId: string): Promise<{ removed: boolean }> {
    await this.db.query(
      `DELETE FROM friendships
       WHERE (user_id = $1 AND friend_user_id = $2)
          OR (user_id = $2 AND friend_user_id = $1)`,
      [userId, friendUserId]
    );

    await this.db.query(
      `UPDATE friend_requests
       SET status = 'canceled',
           updated_at = NOW()
       WHERE status = 'pending'
         AND (
           (requester_id = $1 AND target_id = $2) OR
           (requester_id = $2 AND target_id = $1)
         )`,
      [userId, friendUserId]
    );

    this.emitToUsers([userId, friendUserId], {
      event: 'friend.updated',
      data: {
        type: 'removed',
        peerUserId: friendUserId
      }
    });

    return {
      removed: true
    };
  }

  async listRooms(params: {
    userId: string;
    type?: RoomType;
    limit?: number;
    cursor?: string;
  }): Promise<{ items: RoomDto[]; nextCursor?: string }> {
    const limit = normalizeLimit(params.limit, 30, 100);
    const cursor = decodeCursor(params.cursor);

    const result = await this.db.query<RoomListRow>(
      `SELECT r.id,
              r.type,
              r.title,
              r.created_by,
              r.created_at,
              r.updated_at,
              rus.favorite,
              rus.muted,
              (
                SELECT COUNT(*)::int
                FROM room_messages rm
                WHERE rm.room_id = r.id
                  AND rm.kind <> 'system'
                  AND rm.sender_id IS DISTINCT FROM $1
                  AND (
                    (
                      rus.last_read_message_id IS NULL
                      AND rm.created_at > COALESCE(rus.last_read_at, to_timestamp(0))
                    )
                    OR (
                      rus.last_read_message_id IS NOT NULL
                      AND (
                        rm.created_at > COALESCE(lrm.created_at, rus.last_read_at, to_timestamp(0))
                        OR (
                          lrm.created_at IS NOT NULL
                          AND rm.created_at = lrm.created_at
                          AND rm.order_seq > lrm.order_seq
                        )
                      )
                    )
                  )
              ) AS unread_count,
              lm.kind AS preview_kind,
              lm.text AS preview_text,
              lm.media_url AS preview_media_url
       FROM room_members mem
       INNER JOIN rooms r ON r.id = mem.room_id
       LEFT JOIN room_user_settings rus ON rus.room_id = r.id AND rus.user_id = $1
       LEFT JOIN room_messages lrm ON lrm.id = rus.last_read_message_id
       LEFT JOIN LATERAL (
         SELECT kind, text, media_url
         FROM room_messages m
         WHERE m.room_id = r.id
          ORDER BY m.created_at DESC, m.order_seq DESC
         LIMIT 1
       ) lm ON TRUE
       WHERE mem.user_id = $1
         AND mem.left_at IS NULL
         AND r.deleted_at IS NULL
         AND ($5::text IS NULL OR r.type = $5)
         AND (
           r.type <> 'direct' OR
           2 <= (
             SELECT COUNT(*)::int
             FROM room_members rm_active
             WHERE rm_active.room_id = r.id
               AND rm_active.left_at IS NULL
           )
         )
         AND (
           $2::timestamptz IS NULL OR
           r.updated_at < $2 OR
           (r.updated_at = $2 AND r.id < $3::uuid)
         )
       ORDER BY r.updated_at DESC, r.id DESC
       LIMIT $4`,
      [params.userId, cursor?.at ?? null, cursor?.id ?? null, limit + 1, params.type ?? null]
    );

    const hasMore = result.rows.length > limit;
    const rows = hasMore ? result.rows.slice(0, limit) : result.rows;

    const roomIds = rows.map((row) => row.id);
    const [membersMap, directTitleMap] = await Promise.all([
      this.getRoomMembers(roomIds),
      this.getDirectPeerTitles(roomIds, params.userId)
    ]);

    const items = rows.map((row) => this.mapRoomDto(row, membersMap.get(row.id) ?? [], directTitleMap.get(row.id)));
    const last = rows[rows.length - 1];

    return {
      items,
      ...(hasMore && last ? { nextCursor: encodeCursor({ at: last.updated_at, id: last.id }) } : {})
    };
  }

  async createOrGetDirectRoom(userId: string, friendUserId: string): Promise<RoomDto> {
    if (userId === friendUserId) {
      throw new AppError(409, ErrorCodes.CONFLICT, 'Cannot create direct room with yourself.');
    }

    const userResult = await this.db.query<{ id: string }>('SELECT id FROM users WHERE id = $1 LIMIT 1', [friendUserId]);
    if (!userResult.rows[0]) {
      throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, 'Target user not found.');
    }

    const canOpen = await this.canOpenDirectRoom(userId, friendUserId);
    if (!canOpen) {
      throw new AppError(403, ErrorCodes.FORBIDDEN, 'Direct room can be opened only with friends (or active bot accounts).');
    }

    const client = await this.db.connect();
    let roomId = '';

    try {
      await client.query('BEGIN');
      roomId = await this.ensureDirectRoomForUsers(client, userId, friendUserId, userId);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    this.emitToUsers([userId, friendUserId], {
      event: 'room.updated',
      data: {
        roomId
      }
    });

    return this.getRoomByIdForUser(userId, roomId);
  }

  async createGroupRoom(
    userId: string,
    params: {
      title: string;
      memberUserIds: string[];
    }
  ): Promise<RoomDto> {
    return this.createSharedRoom(userId, params, 'group');
  }

  async createFamilyRoom(
    userId: string,
    params: {
      title: string;
      memberUserIds: string[];
    }
  ): Promise<RoomDto> {
    return this.createSharedRoom(userId, params, 'family');
  }

  async createRoom(
    userId: string,
    params: {
      type: 'group' | 'family';
      title: string;
      memberUserIds: string[];
    }
  ): Promise<RoomDto> {
    return this.createSharedRoom(userId, { title: params.title, memberUserIds: params.memberUserIds }, params.type);
  }

  async listRoomMembers(params: { userId: string; roomId: string }): Promise<RoomMemberListDto> {
    const membership = await this.getRoomMembership(params.roomId, params.userId);
    const result = await this.db.query<RoomMemberProfileRow>(
      `SELECT rm.user_id,
              rm.role,
              u.display_name,
              u.email,
              u.avatar_url,
              rmp.alias,
              rm.joined_at
       FROM room_members rm
       INNER JOIN users u ON u.id = rm.user_id
       LEFT JOIN room_member_profiles rmp
              ON rmp.room_id = rm.room_id
             AND rmp.user_id = rm.user_id
       WHERE rm.room_id = $1
         AND rm.left_at IS NULL
       ORDER BY CASE WHEN rm.user_id = $2 THEN 0 ELSE 1 END,
                CASE WHEN rm.user_id = $3 THEN 0 ELSE 1 END,
                CASE WHEN rm.role = 'admin' THEN 0 ELSE 1 END,
                rm.joined_at ASC`,
      [params.roomId, membership.created_by, params.userId]
    );

    return {
      roomId: params.roomId,
      ownerUserId: membership.created_by,
      myRole: membership.member_role,
      canTransferOwnership: membership.created_by === params.userId,
      canManageAdmins: membership.created_by === params.userId,
      canKickMembers: membership.created_by === params.userId || membership.member_role === 'admin',
      items: result.rows.map((row) => this.mapRoomMember(row, membership.created_by))
    };
  }

  async listRoomInvitations(userId: string): Promise<RoomInvitationListDto> {
    const result = await this.db.query<RoomInvitationRow>(
      `SELECT fri.id,
              fri.room_id,
              r.type AS room_type,
              r.title AS room_title,
              fri.inviter_user_id,
              inviter.display_name AS inviter_name,
              inviter.email AS inviter_email,
              inviter.avatar_url AS inviter_avatar_url,
              fri.target_user_id,
              target.display_name AS target_name,
              target.email AS target_email,
              fri.status,
              fri.created_at
       FROM family_room_invitations fri
       INNER JOIN rooms r ON r.id = fri.room_id
       INNER JOIN users inviter ON inviter.id = fri.inviter_user_id
       INNER JOIN users target ON target.id = fri.target_user_id
       WHERE fri.status = 'pending'
         AND r.deleted_at IS NULL
         AND r.type IN ('group', 'family')
         AND (fri.inviter_user_id = $1 OR fri.target_user_id = $1)
       ORDER BY fri.created_at DESC`,
      [userId]
    );

    const incoming: RoomInvitationDto[] = [];
    const outgoing: RoomInvitationDto[] = [];
    for (const row of result.rows) {
      const mapped = this.mapRoomInvitation(row);
      if (row.target_user_id === userId) {
        incoming.push(mapped);
      } else {
        outgoing.push(mapped);
      }
    }

    return { incoming, outgoing };
  }

  async createRoomInvitation(params: {
    userId: string;
    roomId: string;
    targetUserId: string;
  }): Promise<RoomInvitationDto> {
    const membership = await this.getRoomMembership(params.roomId, params.userId);
    this.assertSharedRoom(membership);

    const targetUserId = params.targetUserId.trim();
    if (!targetUserId) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Target user id is required.');
    }
    if (targetUserId === params.userId) {
      throw new AppError(409, ErrorCodes.CONFLICT, 'You cannot invite yourself to this room.');
    }

    const inviterProfile = await this.getUserProfileRow(params.userId);
    const targetProfile = await this.getUserProfileRow(targetUserId);
    if (await this.isActiveRoomMember(params.roomId, targetUserId)) {
      throw new AppError(409, ErrorCodes.CONFLICT, 'Target user is already in this room.');
    }

    const friendIds = new Set(await this.getFriendUserIds(params.userId));
    if (!friendIds.has(targetUserId)) {
      throw new AppError(403, ErrorCodes.FORBIDDEN, 'Room invitations require an existing friend relationship.');
    }

    const existingPending = await this.db.query<{ id: string }>(
      `SELECT id
       FROM family_room_invitations
       WHERE room_id = $1
         AND target_user_id = $2
         AND status = 'pending'
       LIMIT 1`,
      [params.roomId, targetUserId]
    );
    if (existingPending.rows[0]?.id) {
      throw new AppError(409, ErrorCodes.CONFLICT, 'A pending room invitation already exists.');
    }

    try {
      const created = await this.db.query<RoomInvitationRow>(
        `INSERT INTO family_room_invitations (
           room_id,
           inviter_user_id,
           target_user_id,
           status,
           note,
           created_at,
           updated_at,
           responded_at,
           expires_at
         )
         VALUES ($1, $2, $3, 'pending', NULL, NOW(), NOW(), NULL, NULL)
         RETURNING id,
                   room_id,
                   $4::text AS room_type,
                   $5::text AS room_title,
                   inviter_user_id,
                   $6::text AS inviter_name,
                   $7::text AS inviter_email,
                   $8::text AS inviter_avatar_url,
                   target_user_id,
                   $9::text AS target_name,
                   $10::text AS target_email,
                   status,
                   created_at`,
        [
          params.roomId,
          params.userId,
          targetUserId,
          membership.type,
          membership.title,
          inviterProfile.display_name,
          inviterProfile.email,
          inviterProfile.avatar_url,
          targetProfile.display_name,
          targetProfile.email,
        ]
      );

      const invitation = created.rows[0];
      const realtimePayload = {
        event: 'room.invitation.updated',
        data: {
          roomId: params.roomId,
          invitationId: invitation.id
        }
      };
      this.connectionManager.sendToUser(params.userId, realtimePayload);
      const delivered = this.connectionManager.sendToUser(targetUserId, realtimePayload);
      if (!delivered) {
        await this.sendPushToUsers({
          userIds: [targetUserId],
          resolveCopy: (locale) => getRoomInvitationPushCopy(locale, membership.title),
          data: {
            type: 'room.invitation',
            invitationId: invitation.id
          }
        });
      }
      return this.mapRoomInvitation(invitation);
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        throw new AppError(409, ErrorCodes.CONFLICT, 'A pending room invitation already exists.');
      }
      throw error;
    }
  }

  async acceptRoomInvitation(params: {
    userId: string;
    invitationId: string;
  }): Promise<{ invitationId: string; roomId: string; joined: true }> {
    const invitationId = params.invitationId.trim();
    if (!invitationId) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Invitation id is required.');
    }

    const client = await this.db.connect();
    let roomId = '';
    let inviterUserId = '';
    try {
      await client.query('BEGIN');
      const invitation = await this.getPendingRoomInvitation(invitationId, client);
      if (invitation.target_user_id !== params.userId) {
        throw new AppError(403, ErrorCodes.FORBIDDEN, 'Only the invited member can accept this room invitation.');
      }

      const room = await this.getSharedRoomRow(invitation.room_id, client);
      roomId = room.id;
      inviterUserId = invitation.inviter_user_id;

      await client.query(
        `UPDATE family_room_invitations
         SET status = 'accepted',
             responded_at = NOW(),
             updated_at = NOW()
         WHERE id = $1`,
        [invitationId]
      );

      await client.query(
        `INSERT INTO room_members (room_id, user_id, role, joined_at, left_at)
         VALUES ($1, $2, 'member', NOW(), NULL)
         ON CONFLICT (room_id, user_id)
         DO UPDATE SET
           role = 'member',
           left_at = NULL`,
        [roomId, params.userId]
      );

      await client.query(
        `INSERT INTO room_user_settings (room_id, user_id, favorite, muted, created_at, updated_at)
         VALUES ($1, $2, FALSE, FALSE, NOW(), NOW())
         ON CONFLICT (room_id, user_id)
         DO UPDATE SET
           hidden_at = NULL,
           updated_at = NOW()`,
        [roomId, params.userId]
      );

      await client.query(
        `UPDATE rooms
         SET updated_at = NOW()
         WHERE id = $1`,
        [roomId]
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    const activeMemberIds = await this.getActiveRoomMemberIds(roomId);
    this.emitToUsers(activeMemberIds, {
      event: 'room.updated',
      data: { roomId }
    });
    this.emitToUsers([params.userId, inviterUserId], {
      event: 'room.invitation.updated',
      data: {
        roomId,
        invitationId
      }
    });

    return {
      invitationId,
      roomId,
      joined: true
    };
  }

  async rejectRoomInvitation(params: {
    userId: string;
    invitationId: string;
  }): Promise<{ invitationId: string; rejected: true }> {
    const invitationId = params.invitationId.trim();
    if (!invitationId) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Invitation id is required.');
    }

    const client = await this.db.connect();
    let inviterUserId = '';
    let roomId = '';
    try {
      await client.query('BEGIN');
      const invitation = await this.getPendingRoomInvitation(invitationId, client);
      if (invitation.target_user_id !== params.userId) {
        throw new AppError(403, ErrorCodes.FORBIDDEN, 'Only the invited member can reject this room invitation.');
      }

      inviterUserId = invitation.inviter_user_id;
      roomId = invitation.room_id;
      await client.query(
        `UPDATE family_room_invitations
         SET status = 'rejected',
             responded_at = NOW(),
             updated_at = NOW()
         WHERE id = $1`,
        [invitationId]
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    this.emitToUsers([params.userId, inviterUserId], {
      event: 'room.invitation.updated',
      data: {
        roomId,
        invitationId
      }
    });

    return {
      invitationId,
      rejected: true
    };
  }

  async transferRoomOwnership(params: {
    userId: string;
    roomId: string;
    targetUserId: string;
  }): Promise<{ roomId: string; ownerUserId: string }> {
    const membership = await this.getRoomMembership(params.roomId, params.userId);
    this.assertSharedRoom(membership);
    if (membership.created_by !== params.userId) {
      throw new AppError(403, ErrorCodes.FORBIDDEN, 'Only the room owner can transfer ownership.');
    }

    const targetUserId = params.targetUserId.trim();
    if (!targetUserId) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Target user id is required.');
    }
    if (targetUserId === params.userId) {
      return { roomId: params.roomId, ownerUserId: targetUserId };
    }

    await this.assertActiveRoomMember(params.roomId, targetUserId);

    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE room_members
         SET role = 'admin'
         WHERE room_id = $1
           AND user_id = $2
           AND left_at IS NULL`,
        [params.roomId, targetUserId]
      );
      await client.query(
        `UPDATE rooms
         SET created_by = $2,
             updated_at = NOW()
         WHERE id = $1`,
        [params.roomId, targetUserId]
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    this.emitToUsers(await this.getActiveRoomMemberIds(params.roomId), {
      event: 'room.updated',
      data: { roomId: params.roomId }
    });

    return {
      roomId: params.roomId,
      ownerUserId: targetUserId
    };
  }

  async updateRoomMemberRole(params: {
    userId: string;
    roomId: string;
    targetUserId: string;
    role: 'admin' | 'member';
  }): Promise<{ userId: string; role: 'admin' | 'member' }> {
    const membership = await this.getRoomMembership(params.roomId, params.userId);
    this.assertSharedRoom(membership);
    if (membership.created_by !== params.userId) {
      throw new AppError(403, ErrorCodes.FORBIDDEN, 'Only the room owner can manage admins.');
    }

    const targetUserId = params.targetUserId.trim();
    if (!targetUserId) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Target user id is required.');
    }
    if (targetUserId === membership.created_by) {
      throw new AppError(409, ErrorCodes.CONFLICT, 'The room owner role must be transferred, not downgraded.');
    }

    await this.assertActiveRoomMember(params.roomId, targetUserId);

    await this.db.query(
      `UPDATE room_members
       SET role = $3
       WHERE room_id = $1
         AND user_id = $2
         AND left_at IS NULL`,
      [params.roomId, targetUserId, params.role]
    );

    this.emitToUsers(await this.getActiveRoomMemberIds(params.roomId), {
      event: 'room.updated',
      data: { roomId: params.roomId }
    });

    return {
      userId: targetUserId,
      role: params.role
    };
  }

  async kickRoomMember(params: {
    userId: string;
    roomId: string;
    targetUserId: string;
  }): Promise<{ userId: string; removed: true }> {
    const membership = await this.getRoomMembership(params.roomId, params.userId);
    this.assertSharedRoom(membership);

    const targetUserId = params.targetUserId.trim();
    if (!targetUserId) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Target user id is required.');
    }
    if (targetUserId === params.userId) {
      throw new AppError(409, ErrorCodes.CONFLICT, 'Use leave for removing yourself from a room.');
    }

    const targetMembership = await this.getRoomMembership(params.roomId, targetUserId);
    if (targetMembership.created_by === targetUserId) {
      throw new AppError(409, ErrorCodes.CONFLICT, 'The room owner cannot be removed.');
    }

    const actorIsOwner = membership.created_by === params.userId;
    const actorIsAdmin = membership.member_role === 'admin';
    if (!actorIsOwner && !actorIsAdmin) {
      throw new AppError(403, ErrorCodes.FORBIDDEN, 'Only the room owner or admins can remove members.');
    }
    if (!actorIsOwner && targetMembership.member_role === 'admin') {
      throw new AppError(403, ErrorCodes.FORBIDDEN, 'Only the room owner can remove another admin.');
    }

    await this.removeRoomMembership(params.roomId, targetUserId);

    this.emitToUsers(await this.getAllRoomMemberIds(params.roomId), {
      event: 'room.updated',
      data: { roomId: params.roomId }
    });

    return {
      userId: targetUserId,
      removed: true
    };
  }

  async listFamilyRoomMemberProfiles(params: {
    userId: string;
    roomId: string;
  }): Promise<{ canManage: boolean; items: FamilyRoomMemberProfileDto[] }> {
    const membership = await this.getRoomMembership(params.roomId, params.userId);
    this.assertFamilyRoom(membership);

    const result = await this.db.query<RoomMemberProfileRow>(
      `SELECT rm.user_id,
              rm.role,
              u.display_name,
              u.email,
              u.avatar_url,
              rmp.alias,
              settings.sharing_enabled AS location_sharing_enabled,
              rm.joined_at
       FROM room_members rm
       INNER JOIN users u ON u.id = rm.user_id
       LEFT JOIN room_member_profiles rmp
              ON rmp.room_id = rm.room_id
             AND rmp.user_id = rm.user_id
       LEFT JOIN user_location_settings settings
              ON settings.user_id = rm.user_id
       WHERE rm.room_id = $1
         AND rm.left_at IS NULL
       ORDER BY CASE WHEN rm.user_id = $2 THEN 0 ELSE 1 END,
               rm.joined_at ASC`,
      [params.roomId, params.userId]
    );

    return {
      canManage: membership.member_role === 'admin',
      items: result.rows.map((row) => ({
        userId: row.user_id,
        name: normalizeName(row.display_name, row.email),
        ...(row.avatar_url ? { avatarUri: row.avatar_url } : {}),
        ...(row.alias?.trim() ? { alias: row.alias.trim() } : {}),
        locationSharingEnabled: !!row.location_sharing_enabled
      }))
    };
  }

  async updateFamilyRoomMemberProfile(params: {
    userId: string;
    roomId: string;
    targetUserId: string;
    alias?: string | null;
  }): Promise<{ userId: string; alias?: string }> {
    const membership = await this.getRoomMembership(params.roomId, params.userId);
    this.assertFamilyRoom(membership);

    const targetUserId = params.targetUserId.trim();
    if (!targetUserId) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Target user id is required.');
    }

    if (targetUserId !== params.userId) {
      throw new AppError(403, ErrorCodes.FORBIDDEN, 'Members can edit only their own alias.');
    }

    await this.assertActiveRoomMember(params.roomId, targetUserId);

    const alias = (params.alias || '').trim();
    if (alias.length > 100) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Alias must be between 1 and 100 characters.');
    }

    if (!alias) {
      await this.db.query(
        `DELETE FROM room_member_profiles
         WHERE room_id = $1
           AND user_id = $2`,
        [params.roomId, targetUserId]
      );
    } else {
      await this.db.query(
        `INSERT INTO room_member_profiles (room_id, user_id, alias, role_label, membership_kind, created_at, updated_at)
         VALUES ($1, $2, $3, NULL, NULL, NOW(), NOW())
         ON CONFLICT (room_id, user_id)
         DO UPDATE SET
           alias = EXCLUDED.alias,
           updated_at = NOW()`,
        [params.roomId, targetUserId, alias]
      );
    }

    this.emitToUsers(await this.getActiveRoomMemberIds(params.roomId), {
      event: 'room.updated',
      data: { roomId: params.roomId }
    });

    return {
      userId: targetUserId,
      ...(alias ? { alias } : {})
    };
  }

  async listFamilyRoomRelationships(params: {
    userId: string;
    roomId: string;
  }): Promise<{
    items: FamilyRoomRelationshipDto[];
    pendingIncoming: FamilyRoomRelationshipRequestDto[];
    pendingOutgoing: FamilyRoomRelationshipRequestDto[];
  }> {
    const membership = await this.getRoomMembership(params.roomId, params.userId);
    this.assertFamilyRoom(membership);

    const result = await this.db.query<RoomRelationshipRow>(
      `SELECT rr.id,
              rr.guardian_user_id,
              guardian.display_name AS guardian_name,
              guardian.email AS guardian_email,
              rr.child_user_id,
              child.display_name AS child_name,
              child.email AS child_email,
              rr.status,
              rr.created_by,
              rr.responded_by_user_id,
              rr.responded_at,
              rr.created_at
       FROM room_relationships rr
       INNER JOIN users guardian ON guardian.id = rr.guardian_user_id
       INNER JOIN users child ON child.id = rr.child_user_id
       WHERE rr.room_id = $1
         AND rr.relationship_type = 'guardian_child'
       ORDER BY rr.created_at ASC, rr.id ASC`,
      [params.roomId]
    );

    return {
      items: result.rows.filter((row) => row.status === 'active').map((row) => this.mapFamilyRoomRelationship(row)),
      pendingIncoming: result.rows
        .filter((row) => row.status === 'pending' && row.created_by !== params.userId && (row.guardian_user_id === params.userId || row.child_user_id === params.userId))
        .map((row) => this.mapFamilyRoomRelationshipRequest(row)),
      pendingOutgoing: result.rows
        .filter((row) => row.status === 'pending' && row.created_by === params.userId)
        .map((row) => this.mapFamilyRoomRelationshipRequest(row))
    };
  }

  async createFamilyRoomRelationship(params: {
    userId: string;
    roomId: string;
    targetUserId: string;
    as: 'guardian' | 'child';
  }): Promise<FamilyRoomRelationshipRequestDto> {
    const membership = await this.getRoomMembership(params.roomId, params.userId);
    this.assertFamilyRoom(membership);

    const targetUserId = params.targetUserId.trim();
    if (!targetUserId) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Target user id is required.');
    }
    const guardianUserId = params.as === 'guardian' ? params.userId : targetUserId;
    const childUserId = params.as === 'child' ? params.userId : targetUserId;
    if (guardianUserId === childUserId) {
      throw new AppError(409, ErrorCodes.CONFLICT, 'Guardian and child cannot be the same member.');
    }

    await this.assertActiveRoomMember(params.roomId, guardianUserId);
    await this.assertActiveRoomMember(params.roomId, childUserId);

    const existing = await this.db.query<{
      id: string;
      status: 'pending' | 'active' | 'rejected' | 'removed';
      created_by: string | null;
    }>(
      `SELECT id, status, created_by
       FROM room_relationships
       WHERE room_id = $1
         AND guardian_user_id = $2
         AND child_user_id = $3
         AND relationship_type = 'guardian_child'
       LIMIT 1`,
      [params.roomId, guardianUserId, childUserId]
    );
    const reverse = await this.db.query<{ id: string; status: 'pending' | 'active' | 'rejected' | 'removed' }>(
      `SELECT id, status
       FROM room_relationships
       WHERE room_id = $1
         AND guardian_user_id = $2
         AND child_user_id = $3
         AND relationship_type = 'guardian_child'
         AND status IN ('pending', 'active')
       LIMIT 1`,
      [params.roomId, childUserId, guardianUserId]
    );
    if (reverse.rows[0]) {
      throw new AppError(409, ErrorCodes.CONFLICT, 'The reverse guardian-child link already exists.');
    }

    if (existing.rows[0]?.status === 'active') {
      throw new AppError(409, ErrorCodes.CONFLICT, 'Users are already connected by a guardian-child relationship.');
    }
    if (existing.rows[0]?.status === 'pending') {
      if (existing.rows[0].created_by === params.userId) {
        const pending = await this.getFamilyRoomRelationshipById(existing.rows[0].id);
        if (!pending) {
          throw new AppError(500, ErrorCodes.INTERNAL_ERROR, 'Failed to load pending guardian-child request.');
        }
        return this.mapFamilyRoomRelationshipRequest(pending);
      }
      throw new AppError(409, ErrorCodes.CONFLICT, 'A pending guardian-child request already exists.');
    }

    const result = await this.db.query<{ id: string }>(
      `INSERT INTO room_relationships (
         room_id,
         guardian_user_id,
         child_user_id,
         relationship_type,
         status,
         created_by,
         responded_by_user_id,
         responded_at,
         created_at,
         updated_at
       )
       VALUES ($1, $2, $3, 'guardian_child', 'pending', $4, NULL, NULL, NOW(), NOW())
       ON CONFLICT (room_id, guardian_user_id, child_user_id, relationship_type)
       DO UPDATE SET
         status = 'pending',
         created_by = EXCLUDED.created_by,
         responded_by_user_id = NULL,
         responded_at = NULL,
         updated_at = NOW()
       RETURNING id`,
      [params.roomId, guardianUserId, childUserId, params.userId]
    );

    const relationship = await this.getFamilyRoomRelationshipById(result.rows[0].id);
    if (!relationship) {
      throw new AppError(500, ErrorCodes.INTERNAL_ERROR, 'Failed to load pending guardian-child request.');
    }

    this.emitToUsers(await this.getActiveRoomMemberIds(params.roomId), {
      event: 'room.updated',
      data: { roomId: params.roomId }
    });

    return this.mapFamilyRoomRelationshipRequest(relationship);
  }

  async respondFamilyRoomRelationship(params: {
    userId: string;
    roomId: string;
    relationshipId: string;
    decision: 'accept' | 'reject';
  }): Promise<{ relationshipId: string; status: 'active' | 'rejected' }> {
    const membership = await this.getRoomMembership(params.roomId, params.userId);
    this.assertFamilyRoom(membership);

    const result = await this.db.query<{
      id: string;
      guardian_user_id: string;
      child_user_id: string;
      created_by: string | null;
      status: 'pending' | 'active' | 'rejected' | 'removed';
    }>(
      `SELECT id, guardian_user_id, child_user_id, created_by, status
       FROM room_relationships
       WHERE id = $1
         AND room_id = $2
         AND relationship_type = 'guardian_child'
       LIMIT 1`,
      [params.relationshipId, params.roomId]
    );

    const row = result.rows[0];
    if (!row || row.status !== 'pending') {
      throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, 'Pending guardian-child request not found.');
    }
    if (row.created_by === params.userId) {
      throw new AppError(409, ErrorCodes.CONFLICT, 'The requester cannot accept their own guardian-child request.');
    }
    if (row.guardian_user_id !== params.userId && row.child_user_id !== params.userId) {
      throw new AppError(403, ErrorCodes.FORBIDDEN, 'Only the target member can respond to this guardian-child request.');
    }

    const nextStatus = params.decision === 'accept' ? 'active' : 'rejected';
    await this.db.query(
      `UPDATE room_relationships
       SET status = $3,
           responded_by_user_id = $4,
           responded_at = NOW(),
           updated_at = NOW()
       WHERE id = $1
         AND room_id = $2`,
      [params.relationshipId, params.roomId, nextStatus, params.userId]
    );

    this.emitToUsers(await this.getActiveRoomMemberIds(params.roomId), {
      event: 'room.updated',
      data: { roomId: params.roomId }
    });

    return {
      relationshipId: params.relationshipId,
      status: nextStatus
    };
  }

  async deleteFamilyRoomRelationship(params: {
    userId: string;
    roomId: string;
    relationshipId: string;
  }): Promise<{ relationshipId: string; deleted: true }> {
    const membership = await this.getRoomMembership(params.roomId, params.userId);
    this.assertFamilyRoom(membership);
    const actorIsOwner = membership.created_by === params.userId;
    const actorIsAdmin = membership.member_role === 'admin';

    const existing = await this.db.query<{
      id: string;
      guardian_user_id: string;
      child_user_id: string;
      created_by: string | null;
      status: 'pending' | 'active' | 'rejected' | 'removed';
    }>(
      `SELECT id, guardian_user_id, child_user_id, created_by, status
       FROM room_relationships
       WHERE id = $1
         AND room_id = $2
         AND relationship_type = 'guardian_child'
       LIMIT 1`,
      [params.relationshipId, params.roomId]
    );

    const row = existing.rows[0];
    if (!row || !['pending', 'active'].includes(row.status)) {
      throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, 'Active guardian-child relationship not found.');
    }

    const actorIsParticipant = row.guardian_user_id === params.userId || row.child_user_id === params.userId;
    const actorCanCancelPending = row.status === 'pending' && row.created_by === params.userId;
    if (!actorIsOwner && !actorIsAdmin && !actorIsParticipant && !actorCanCancelPending) {
      throw new AppError(403, ErrorCodes.FORBIDDEN, 'You do not have access to this guardian-child relationship.');
    }

    const result = await this.db.query<{ id: string }>(
      `UPDATE room_relationships
       SET status = 'removed',
           updated_at = NOW()
       WHERE id = $1
         AND room_id = $2
         AND relationship_type = 'guardian_child'
         AND status IN ('pending', 'active')
       RETURNING id`,
      [params.relationshipId, params.roomId]
    );

    if (!result.rows[0]) {
      throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, 'Active guardian-child relationship not found.');
    }

    this.emitToUsers(await this.getActiveRoomMemberIds(params.roomId), {
      event: 'room.updated',
      data: { roomId: params.roomId }
    });

    return {
      relationshipId: result.rows[0].id,
      deleted: true
    };
  }

  async updateRoomSettings(
    userId: string,
    roomId: string,
    input: {
      favorite?: boolean;
      muted?: boolean;
      title?: string;
    }
  ): Promise<{ favorite: boolean; muted: boolean; title?: string }> {
    const membership = await this.getRoomMembership(roomId, userId);

    await this.db.query(
      `INSERT INTO room_user_settings (room_id, user_id, favorite, muted, created_at, updated_at)
       VALUES ($1, $2, FALSE, FALSE, NOW(), NOW())
       ON CONFLICT (room_id, user_id) DO NOTHING`,
      [roomId, userId]
    );

    const hasFavorite = input.favorite !== undefined;
    const hasMuted = input.muted !== undefined;
    const hasTitle = input.title !== undefined;
    const nextTitle = hasTitle ? (input.title?.trim() || '') : '';

    if (hasTitle && membership.type === 'direct') {
      throw new AppError(409, ErrorCodes.CONFLICT, 'Only group/family room title can be changed.');
    }
    if (hasTitle && membership.member_role !== 'admin') {
      throw new AppError(403, ErrorCodes.FORBIDDEN, 'Only room admins can change the room title.');
    }
    if (hasTitle && (nextTitle.length < 1 || nextTitle.length > 100)) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Shared room title must be 1-100 characters.');
    }

    const result = await this.db.query<{ favorite: boolean; muted: boolean }>(
      `UPDATE room_user_settings
       SET favorite = CASE WHEN $3::boolean THEN $4 ELSE favorite END,
           muted = CASE WHEN $5::boolean THEN $6 ELSE muted END,
           updated_at = NOW()
       WHERE room_id = $1
         AND user_id = $2
       RETURNING favorite, muted`,
      [roomId, userId, hasFavorite, input.favorite ?? false, hasMuted, input.muted ?? false]
    );

    const row = result.rows[0];
    if (!row) {
      throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, 'Room settings not found.');
    }

    if (hasTitle) {
      await this.db.query(
        `UPDATE rooms
         SET title = $2,
             updated_at = NOW()
         WHERE id = $1`,
        [roomId, nextTitle]
      );
    }

    const notifyTargets = hasTitle ? await this.getActiveRoomMemberIds(roomId) : [userId];
    this.emitToUsers(notifyTargets, {
      event: 'room.updated',
      data: {
        roomId
      }
    });

    return {
      favorite: row.favorite,
      muted: row.muted,
      ...(hasTitle ? { title: nextTitle } : {})
    };
  }

  async leaveRoom(userId: string, roomId: string): Promise<{ left: boolean }> {
    const membership = await this.getRoomMembership(roomId, userId);
    if (membership.type === 'direct') {
      throw new AppError(409, ErrorCodes.CONFLICT, 'Use DELETE /rooms/:roomId for direct rooms.');
    }

    const activeMembers = await this.getActiveRoomMemberIds(roomId);
    const remainingMembers = activeMembers.filter((memberId) => memberId !== userId);
    if (membership.created_by === userId && remainingMembers.length > 0) {
      throw new AppError(409, ErrorCodes.CONFLICT, 'Transfer room ownership before leaving this room.');
    }

    if (remainingMembers.length === 0) {
      const client = await this.db.connect();
      try {
        await client.query('BEGIN');
        await this.removeRoomMembership(roomId, userId, client);
        await client.query(
          `UPDATE rooms
           SET deleted_at = NOW(),
               updated_at = NOW()
           WHERE id = $1`,
          [roomId]
        );
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }

      this.emitToUsers([userId], {
        event: 'room.updated',
        data: { roomId, deleted: true }
      });

      return { left: true };
    }

    const profile = await this.getUserProfileRow(userId);
    const leaveText = makeSystemMessageToken('member_left', normalizeName(profile.display_name, profile.email));

    await this.removeRoomMembership(roomId, userId);

    await this.db.query(
      `UPDATE rooms
       SET updated_at = NOW()
       WHERE id = $1`,
      [roomId]
    );

    const inserted = await this.appendSystemRoomMessage(roomId, leaveText);
    const members = await this.getActiveRoomMemberIds(roomId);
    if (inserted) {
      this.emitToUsers(members, {
        event: 'message.new',
        data: {
          roomId,
          message: inserted
        }
      });
    }

    this.emitToUsers([...members, userId], {
      event: 'room.updated',
      data: {
        roomId
      }
    });

    return { left: true };
  }

  async deleteRoom(userId: string, roomId: string): Promise<{ deleted: boolean }> {
    const room = await this.getRoomMembership(roomId, userId);

    if (room.type === 'direct') {
      const client = await this.db.connect();
      let memberIds: string[] = [];

      try {
        await client.query('BEGIN');
        memberIds = await this.getAllRoomMemberIds(roomId, client);
        await this.closeDirectRoom(client, roomId);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }

      this.emitToUsers(memberIds, {
        event: 'room.updated',
        data: {
          roomId,
          deleted: true
        }
      });

      return { deleted: true };
    }

    if (room.created_by !== userId) {
      throw new AppError(403, ErrorCodes.FORBIDDEN, 'Only the room owner can delete this room.');
    }

    await this.db.query(
      `UPDATE rooms
       SET deleted_at = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [roomId]
    );

    const members = await this.getActiveRoomMemberIds(roomId);

    await this.db.query(
      `UPDATE room_members
       SET left_at = COALESCE(left_at, NOW())
       WHERE room_id = $1`,
      [roomId]
    );

    this.emitToUsers(members, {
      event: 'room.updated',
      data: {
        roomId,
        deleted: true
      }
    });

    return { deleted: true };
  }

  async listRoomMessages(params: {
    userId: string;
    roomId: string;
    limit?: number;
    cursor?: string;
  }): Promise<{ items: RoomMessageDto[]; nextCursor?: string }> {
    await this.assertRoomMembership(params.roomId, params.userId);

    const limit = normalizeLimit(params.limit, 50, 100);
    const cursor = decodeCursor(params.cursor);

    const result = await this.db.query<RoomMessageRow>(
      `SELECT m.id,
              m.room_id,
              m.sender_id,
              m.kind,
              m.text,
              m.media_url,
              m.delivery,
              m.created_at,
              m.order_seq,
              u.display_name AS sender_name,
              u.email AS sender_email,
              receipts.unread_count,
              receipts.read_by_names
       FROM room_messages m
       LEFT JOIN users u ON u.id = m.sender_id
       LEFT JOIN LATERAL (
         SELECT COUNT(*) FILTER (
                  WHERE m.sender_id IS NOT NULL
                    AND NOT (
                       (
                         rus.last_read_message_id IS NOT NULL
                         AND lrm.order_seq IS NOT NULL
                         AND m.order_seq <= lrm.order_seq
                       )
                       OR (
                         rus.last_read_message_id IS NULL
                         AND rus.last_read_at IS NOT NULL
                         AND rus.last_read_at >= m.created_at
                       )
                    )
                )::int AS unread_count,
                COALESCE(
                  array_agg(COALESCE(NULLIF(trim(ru.display_name), ''), ru.email) ORDER BY COALESCE(NULLIF(trim(ru.display_name), ''), ru.email))
                    FILTER (
                      WHERE m.sender_id IS NOT NULL
                        AND (
                           (
                             rus.last_read_message_id IS NOT NULL
                             AND lrm.order_seq IS NOT NULL
                             AND m.order_seq <= lrm.order_seq
                           )
                           OR (
                             rus.last_read_message_id IS NULL
                             AND rus.last_read_at IS NOT NULL
                             AND rus.last_read_at >= m.created_at
                           )
                        )
                    ),
                  ARRAY[]::text[]
                ) AS read_by_names
         FROM room_members rm
         INNER JOIN users ru ON ru.id = rm.user_id
          LEFT JOIN room_user_settings rus
            ON rus.room_id = m.room_id
           AND rus.user_id = rm.user_id
          LEFT JOIN room_messages lrm
            ON lrm.id = rus.last_read_message_id
          WHERE rm.room_id = m.room_id
            AND rm.left_at IS NULL
            AND (m.sender_id IS NULL OR rm.user_id IS DISTINCT FROM m.sender_id)
       ) receipts ON TRUE
       WHERE m.room_id = $1
         AND (
           $2::timestamptz IS NULL OR
           m.created_at < $2 OR
            (
              m.created_at = $2
              AND (
                ($3::bigint IS NOT NULL AND m.order_seq < $3::bigint)
                OR ($3::bigint IS NULL AND m.id < $4::uuid)
              )
            )
          )
        ORDER BY m.created_at DESC, m.order_seq DESC
        LIMIT $5`,
      [params.roomId, cursor?.at ?? null, cursor?.order ?? null, cursor?.id ?? null, limit + 1]
    );

    const hasMore = result.rows.length > limit;
    const rows = hasMore ? result.rows.slice(0, limit) : result.rows;
    const chronological = rows.reverse();

    const items = chronological.map((row) => this.mapMessageDto(row));
    const last = rows[rows.length - 1];

    return {
      items,
      ...(hasMore && last ? { nextCursor: encodeCursor({ at: last.created_at, id: last.id, order: last.order_seq }) } : {})
    };
  }

  async sendRoomMessage(params: {
    userId: string;
    roomId: string;
    kind: MessageKind;
    text?: string;
    uri?: string;
    clientMessageId?: string;
  }): Promise<RoomMessageDto> {
    const room = await this.assertRoomMembership(params.roomId, params.userId);
    const memberUserIds = await this.getActiveRoomMemberIds(params.roomId);

    if (memberUserIds.length < 1) {
      throw new AppError(409, ErrorCodes.CONFLICT, 'Room has no active members.');
    }

    if (room.type === 'direct' && memberUserIds.length < 2) {
      throw new AppError(409, ErrorCodes.CONFLICT, 'The other participant already left this room.');
    }

    const kind = params.kind;
    if (!['text', 'image', 'video', 'system'].includes(kind)) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Unsupported message kind.');
    }

    if ((kind === 'text' || kind === 'system') && !(params.text && params.text.trim().length > 0)) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Text is required for text/system message.');
    }

    if ((kind === 'image' || kind === 'video') && !(params.uri && params.uri.trim().length > 0)) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'uri is required for image/video message.');
    }

    if (params.clientMessageId) {
      const existing = await this.db.query<RoomMessageRow>(
        `SELECT m.id,
                m.room_id,
                m.sender_id,
                m.kind,
                m.text,
                m.media_url,
                m.delivery,
                m.created_at,
                u.display_name AS sender_name,
                u.email AS sender_email
         FROM room_messages m
         LEFT JOIN users u ON u.id = m.sender_id
         WHERE m.room_id = $1
           AND m.sender_id = $2
           AND m.client_message_id = $3
         LIMIT 1`,
        [params.roomId, params.userId, params.clientMessageId]
      );

      if (existing.rows[0]) {
        return this.mapMessageDto(existing.rows[0]);
      }
    }

    const insertResult = await this.db.query<RoomMessageRow>(
      `INSERT INTO room_messages (room_id, sender_id, kind, text, media_url, client_message_id, delivery, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'sent', NOW())
       RETURNING id,
                 room_id,
                 sender_id,
                 kind,
                 text,
                 media_url,
                 delivery,
                 created_at,
                 NULL::text AS sender_name,
                 NULL::text AS sender_email`,
      [
        params.roomId,
        params.userId,
        kind,
        kind === 'text' || kind === 'system' ? params.text?.trim() ?? null : null,
        kind === 'image' || kind === 'video' ? params.uri?.trim() ?? null : null,
        params.clientMessageId ?? null
      ]
    );

    const inserted = insertResult.rows[0];

    await this.db.query(
      `UPDATE rooms
       SET updated_at = NOW()
       WHERE id = $1`,
      [params.roomId]
    );

    await this.db.query(
      `INSERT INTO room_user_settings (room_id, user_id, favorite, muted, last_read_message_id, last_read_at, created_at, updated_at)
       VALUES ($1, $2, FALSE, FALSE, $3, $4, NOW(), NOW())
       ON CONFLICT (room_id, user_id)
       DO UPDATE SET
         last_read_message_id = EXCLUDED.last_read_message_id,
         last_read_at = EXCLUDED.last_read_at,
         updated_at = NOW()`,
      [params.roomId, params.userId, inserted.id, inserted.created_at]
    );

    const mappedInserted = await this.fetchMessageById(inserted.id);
    if (!mappedInserted) {
      throw new AppError(500, ErrorCodes.INTERNAL_ERROR, 'Failed to load inserted message.');
    }

    let finalMessage = mappedInserted;
    let delivered = false;
    const offlineRecipientIds: string[] = [];

    for (const memberId of memberUserIds) {
      const sent = this.connectionManager.sendToUser(memberId, {
        event: 'message.new',
        data: {
          roomId: params.roomId,
          message: finalMessage
        }
      });

      if (memberId !== params.userId && sent) {
        delivered = true;
      }
      if (memberId !== params.userId && !sent) {
        offlineRecipientIds.push(memberId);
      }
    }

    if (delivered && finalMessage.delivery === 'sent') {
      await this.db.query(
        `UPDATE room_messages
         SET delivery = 'delivered'
         WHERE id = $1
           AND delivery = 'sent'`,
        [finalMessage.id]
      );
      finalMessage = {
        ...finalMessage,
        delivery: 'delivered'
      };

      this.emitToUsers(memberUserIds, {
        event: 'message.delivery',
        data: {
          roomId: finalMessage.roomId,
          messageId: finalMessage.id,
          delivery: finalMessage.delivery,
          at: new Date().toISOString()
        }
      });
    }

    const senderIsBot = await this.isActiveBotUser(params.userId);
    if (!senderIsBot) {
      await this.sendPushForRoomMessage({
        room,
        message: finalMessage,
        targetUserIds: offlineRecipientIds
      });

      const recipientIds = memberUserIds.filter((memberId) => memberId !== params.userId);
      if (recipientIds.length > 0) {
        const bots = await this.findActiveBotsByUserIds(recipientIds);
        for (const bot of bots) {
          if (!this.shouldForwardToBot(room.type, finalMessage, bot)) {
            continue;
          }

          void this.forwardToClawAndBroadcast({
            room,
            sourceMessage: finalMessage,
            botUserId: bot.user_id,
            botKey: bot.bot_key,
            targetMembers: memberUserIds
          });
        }
      }
    }

    return finalMessage;
  }

  async markRoomRead(params: {
    userId: string;
    roomId: string;
    lastReadMessageId?: string;
  }): Promise<{ unread: number; lastReadMessageId?: string }> {
    await this.assertRoomMembership(params.roomId, params.userId);

    let readAt = new Date();
    let lastReadMessageId = params.lastReadMessageId;

    if (params.lastReadMessageId) {
      const messageResult = await this.db.query<{ id: string; created_at: Date }>(
        `SELECT id, created_at
         FROM room_messages
         WHERE id = $1
           AND room_id = $2
         LIMIT 1`,
        [params.lastReadMessageId, params.roomId]
      );

      const row = messageResult.rows[0];
      if (!row) {
        throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, 'Message not found in room.');
      }

      readAt = row.created_at;
      lastReadMessageId = row.id;
    } else {
      const latest = await this.db.query<{ id: string; created_at: Date }>(
        `SELECT id, created_at
         FROM room_messages
         WHERE room_id = $1
         ORDER BY created_at DESC, order_seq DESC
         LIMIT 1`,
         [params.roomId]
       );

      if (latest.rows[0]) {
        readAt = latest.rows[0].created_at;
        lastReadMessageId = latest.rows[0].id;
      }
    }

    await this.db.query(
      `INSERT INTO room_user_settings (room_id, user_id, favorite, muted, last_read_message_id, last_read_at, created_at, updated_at)
       VALUES ($1, $2, FALSE, FALSE, $3, $4, NOW(), NOW())
       ON CONFLICT (room_id, user_id)
       DO UPDATE SET
         last_read_message_id = EXCLUDED.last_read_message_id,
         last_read_at = EXCLUDED.last_read_at,
         updated_at = NOW()`,
      [params.roomId, params.userId, lastReadMessageId ?? null, readAt]
    );

    if (lastReadMessageId) {
      await this.db.query(
        `UPDATE room_messages
         SET delivery = 'read'
         WHERE room_id = $1
           AND sender_id IS DISTINCT FROM $2
           AND created_at <= $3
           AND delivery <> 'read'`,
        [params.roomId, params.userId, readAt]
      );
    }

    const unread = await this.countUnread(params.userId, params.roomId);

    this.emitToUsers([params.userId], {
      event: 'room.unread.updated',
      data: {
        roomId: params.roomId,
        unread
      }
    });

    this.emitToUsers(await this.getActiveRoomMemberIds(params.roomId), {
      event: 'message.delivery',
      data: {
        roomId: params.roomId,
        delivery: 'read',
        messageId: lastReadMessageId,
        at: readAt.toISOString(),
        byUserId: params.userId
      }
    });

    return {
      unread,
      ...(lastReadMessageId ? { lastReadMessageId } : {})
    };
  }

  async createRoomReport(
    userId: string,
    roomId: string,
    params: {
      reason: string;
      messageId?: string;
    }
  ): Promise<{ reportId: string; status: 'open'; createdAt: string }> {
    await this.assertRoomMembership(roomId, userId);

    const reason = params.reason.trim();
    if (reason.length < 2 || reason.length > 1000) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Reason must be 2-1000 characters.');
    }

    if (params.messageId) {
      const message = await this.db.query<{ id: string }>(
        `SELECT id
         FROM room_messages
         WHERE id = $1
           AND room_id = $2
         LIMIT 1`,
        [params.messageId, roomId]
      );

      if (!message.rows[0]) {
        throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, 'Reported message not found in room.');
      }
    }

    const inserted = await this.db.query<{ id: string; created_at: Date }>(
      `INSERT INTO reports (reporter_user_id, room_id, message_id, reason, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'open', NOW(), NOW())
       RETURNING id, created_at`,
      [userId, roomId, params.messageId ?? null, reason]
    );

    const parentUsers = await this.db.query<{ id: string }>(
      `SELECT id
       FROM users
       WHERE role = 'parent'`
    );

    this.emitToUsers(
      parentUsers.rows.map((row) => row.id),
      {
        event: 'report.received',
        data: {
          reportId: inserted.rows[0].id,
          roomId,
          messageId: params.messageId,
          reason,
          createdAt: inserted.rows[0].created_at.toISOString()
        }
      }
    );

    return {
      reportId: inserted.rows[0].id,
      status: 'open',
      createdAt: inserted.rows[0].created_at.toISOString()
    };
  }

  async listReports(params: {
    userId: string;
    status?: 'open' | 'reviewed' | 'closed';
    limit?: number;
    cursor?: string;
  }): Promise<{
    items: Array<{
      id: string;
      status: 'open' | 'reviewed' | 'closed';
      reason: string;
      roomId: string;
      messageId?: string;
      reporter: {
        id: string;
        name: string;
      };
      createdAt: string;
      updatedAt: string;
    }>;
    nextCursor?: string;
  }> {
    await this.assertParentRole(params.userId);

    const limit = normalizeLimit(params.limit, 30, 100);
    const cursor = decodeCursor(params.cursor);

    const result = await this.db.query<ReportRow>(
      `SELECT r.id,
              r.status,
              r.reason,
              r.room_id,
              r.message_id,
              r.created_at,
              r.updated_at,
              r.reporter_user_id AS reporter_id,
              u.display_name AS reporter_name,
              u.email AS reporter_email
       FROM reports r
       INNER JOIN users u ON u.id = r.reporter_user_id
       WHERE ($1::text IS NULL OR r.status = $1)
         AND (
           $2::timestamptz IS NULL OR
           r.created_at < $2 OR
           (r.created_at = $2 AND r.id < $3::uuid)
         )
       ORDER BY r.created_at DESC, r.id DESC
       LIMIT $4`,
      [params.status ?? null, cursor?.at ?? null, cursor?.id ?? null, limit + 1]
    );

    const hasMore = result.rows.length > limit;
    const rows = hasMore ? result.rows.slice(0, limit) : result.rows;

    const items = rows.map((row) => ({
      id: row.id,
      status: row.status,
      reason: row.reason,
      roomId: row.room_id,
      ...(row.message_id ? { messageId: row.message_id } : {}),
      reporter: {
        id: row.reporter_id,
        name: normalizeName(row.reporter_name, row.reporter_email)
      },
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    }));

    const last = rows[rows.length - 1];

    return {
      items,
      ...(hasMore && last ? { nextCursor: encodeCursor({ at: last.created_at, id: last.id }) } : {})
    };
  }

  async updateReportStatus(
    userId: string,
    reportId: string,
    status: 'reviewed' | 'closed'
  ): Promise<{ id: string; status: 'reviewed' | 'closed'; updatedAt: string }> {
    await this.assertParentRole(userId);

    const result = await this.db.query<{ id: string; status: 'reviewed' | 'closed'; updated_at: Date }>(
      `UPDATE reports
       SET status = $2,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, status, updated_at`,
      [reportId, status]
    );

    const row = result.rows[0];
    if (!row) {
      throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, 'Report not found.');
    }

    return {
      id: row.id,
      status: row.status,
      updatedAt: row.updated_at.toISOString()
    };
  }

  async registerPushToken(params: {
    userId: string;
    platform: 'android' | 'ios' | 'web';
    pushToken: string;
  }): Promise<{ registered: true; platform: 'android' | 'ios' | 'web'; pushToken: string }> {
    const pushToken = params.pushToken.trim();
    if (pushToken.length < 8 || pushToken.length > 4096) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Invalid push token.');
    }

    await this.db.query(
      `INSERT INTO device_tokens (user_id, platform, push_token, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (push_token)
       DO UPDATE SET
         user_id = EXCLUDED.user_id,
         platform = EXCLUDED.platform,
         updated_at = NOW()`,
      [params.userId, params.platform, pushToken]
    );
    const tokenCount = await this.db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM device_tokens
       WHERE user_id = $1`,
      [params.userId]
    );
    this.logger.info(
      {
        tag: 'push_token.registered',
        userId: params.userId,
        platform: params.platform,
        pushTokenSuffix: pushToken.slice(-12),
        tokenCount: Number(tokenCount.rows[0]?.count || '0')
      },
      'Push token registered'
    );

    return {
      registered: true,
      platform: params.platform,
      pushToken
    };
  }

  async removePushToken(params: { userId: string; pushToken: string }): Promise<{ removed: boolean }> {
    const result = await this.db.query(
      `DELETE FROM device_tokens
       WHERE user_id = $1
         AND push_token = $2`,
      [params.userId, params.pushToken]
    );
    this.logger.info(
      {
        tag: 'push_token.removed',
        userId: params.userId,
        pushTokenSuffix: params.pushToken.slice(-12),
        removedCount: result.rowCount || 0
      },
      'Push token removed'
    );

    return {
      removed: true
    };
  }

  private shouldForwardToBot(roomType: RoomType, message: RoomMessageDto, bot: BotRecipientRow): boolean {
    if (roomType === 'direct') {
      return true;
    }

    if (message.kind !== 'text' && message.kind !== 'system') {
      return false;
    }

    const rawText = message.text?.trim();
    if (!rawText || rawText.length === 0) {
      return false;
    }

    const lower = rawText.toLowerCase();
    const compact = lower.replace(/\s+/g, '');

    const genericCommands = ['/bot', '/claw', '/ask'];
    for (const cmd of genericCommands) {
      if (lower === cmd || lower.startsWith(`${cmd} `)) {
        return true;
      }
    }

    const botCandidates = Array.from(
      new Set([
        bot.bot_key.toLowerCase(),
        bot.bot_name.toLowerCase(),
        normalizeBotAlias(bot.bot_key),
        normalizeBotAlias(bot.bot_name)
      ])
    ).filter((candidate) => candidate.length > 0);

    for (const candidate of botCandidates) {
      if (lower === `/${candidate}` || lower.startsWith(`/${candidate} `)) {
        return true;
      }

      if (lower.includes(`@${candidate}`) || compact.includes(`@${candidate}`)) {
        return true;
      }
    }

    return false;
  }

  private async forwardToClawAndBroadcast(params: {
    room: RoomRow;
    sourceMessage: RoomMessageDto;
    botUserId: string;
    botKey: string;
    targetMembers: string[];
  }): Promise<void> {
    const sourceMessage = params.sourceMessage;

    try {
      const clawInputText =
        sourceMessage.kind === 'text' || sourceMessage.kind === 'system'
          ? sourceMessage.text ?? ''
          : `${sourceMessage.kind}:${sourceMessage.uri ?? ''}`;

      const response = await this.clawBridge.forwardMessage({
        messageId: sourceMessage.id,
        roomId: sourceMessage.roomId,
        senderId: sourceMessage.senderId ?? 'system',
        recipientId: params.botUserId,
        botKey: params.botKey,
        content: clawInputText
      });

      if (!response.replyText || response.replyText.trim().length === 0) {
        return;
      }

      const insertResult = await this.db.query<RoomMessageRow>(
        `INSERT INTO room_messages (room_id, sender_id, kind, text, media_url, delivery, created_at)
         VALUES ($1, $2, 'text', $3, NULL, 'sent', NOW())
         RETURNING id,
                   room_id,
                   sender_id,
                   kind,
                   text,
                   media_url,
                   delivery,
                   created_at,
                   NULL::text AS sender_name,
                   NULL::text AS sender_email`,
        [params.room.id, params.botUserId, response.replyText.trim()]
      );

      await this.db.query(
        `UPDATE rooms
         SET updated_at = NOW()
         WHERE id = $1`,
        [params.room.id]
      );

      const inserted = insertResult.rows[0];
      const mapped = await this.fetchMessageById(inserted.id);
      if (!mapped) {
        return;
      }

      let delivered = false;
      const offlineRecipientIds: string[] = [];
      for (const memberId of params.targetMembers) {
        const sent = this.connectionManager.sendToUser(memberId, {
          event: 'message.new',
          data: {
            roomId: params.room.id,
            message: mapped
          }
        });

        if (memberId !== params.botUserId && sent) {
          delivered = true;
        }
        if (memberId !== params.botUserId && !sent) {
          offlineRecipientIds.push(memberId);
        }
      }

      if (delivered && mapped.delivery === 'sent') {
        await this.db.query(
          `UPDATE room_messages
           SET delivery = 'delivered'
           WHERE id = $1
             AND delivery = 'sent'`,
          [mapped.id]
        );

        this.emitToUsers(params.targetMembers, {
          event: 'message.delivery',
          data: {
            roomId: mapped.roomId,
            messageId: mapped.id,
            delivery: 'delivered',
            at: new Date().toISOString()
          }
        });
      }

      await this.sendPushForRoomMessage({
        room: params.room,
        message: mapped,
        targetUserIds: offlineRecipientIds
      });

      this.emitToUsers(params.targetMembers, {
        event: 'room.updated',
        data: {
          roomId: params.room.id
        }
      });
    } catch (error) {
      this.logger.error(
        {
          error,
          provider: this.clawBridge.getProviderName(),
          roomId: params.room.id,
          botUserId: params.botUserId,
          sourceMessageId: sourceMessage.id
        },
        'Failed to forward message to OpenClaw in social room pipeline'
      );
    }
  }

  private async fetchMessageById(messageId: string): Promise<RoomMessageDto | null> {
    const result = await this.db.query<RoomMessageRow>(
      `SELECT m.id,
              m.room_id,
              m.sender_id,
              m.kind,
              m.text,
              m.media_url,
              m.delivery,
              m.created_at,
              m.order_seq,
              u.display_name AS sender_name,
              u.email AS sender_email,
              receipts.unread_count,
              receipts.read_by_names
       FROM room_messages m
       LEFT JOIN users u ON u.id = m.sender_id
       LEFT JOIN LATERAL (
         SELECT COUNT(*) FILTER (
                  WHERE m.sender_id IS NOT NULL
                    AND NOT (
                       (
                         rus.last_read_message_id IS NOT NULL
                         AND lrm.order_seq IS NOT NULL
                         AND m.order_seq <= lrm.order_seq
                       )
                       OR (
                         rus.last_read_message_id IS NULL
                         AND rus.last_read_at IS NOT NULL
                         AND rus.last_read_at >= m.created_at
                       )
                    )
                )::int AS unread_count,
                COALESCE(
                  array_agg(COALESCE(NULLIF(trim(ru.display_name), ''), ru.email) ORDER BY COALESCE(NULLIF(trim(ru.display_name), ''), ru.email))
                    FILTER (
                      WHERE m.sender_id IS NOT NULL
                        AND (
                           (
                             rus.last_read_message_id IS NOT NULL
                             AND lrm.order_seq IS NOT NULL
                             AND m.order_seq <= lrm.order_seq
                           )
                           OR (
                             rus.last_read_message_id IS NULL
                             AND rus.last_read_at IS NOT NULL
                             AND rus.last_read_at >= m.created_at
                           )
                        )
                    ),
                  ARRAY[]::text[]
                ) AS read_by_names
         FROM room_members rm
         INNER JOIN users ru ON ru.id = rm.user_id
          LEFT JOIN room_user_settings rus
            ON rus.room_id = m.room_id
           AND rus.user_id = rm.user_id
          LEFT JOIN room_messages lrm
            ON lrm.id = rus.last_read_message_id
          WHERE rm.room_id = m.room_id
            AND rm.left_at IS NULL
            AND (m.sender_id IS NULL OR rm.user_id IS DISTINCT FROM m.sender_id)
       ) receipts ON TRUE
       WHERE m.id = $1
       LIMIT 1`,
      [messageId]
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return this.mapMessageDto(row);
  }

  async getRoomByIdForUser(userId: string, roomId: string): Promise<RoomDto> {
    const result = await this.db.query<RoomListRow>(
      `SELECT r.id,
              r.type,
              r.title,
              r.created_by,
              r.created_at,
              r.updated_at,
              rus.favorite,
              rus.muted,
              (
                SELECT COUNT(*)::int
                FROM room_messages rm
                WHERE rm.room_id = r.id
                  AND rm.kind <> 'system'
                  AND rm.sender_id IS DISTINCT FROM $1
                  AND (
                    (
                      rus.last_read_message_id IS NULL
                      AND rm.created_at > COALESCE(rus.last_read_at, to_timestamp(0))
                    )
                    OR (
                      rus.last_read_message_id IS NOT NULL
                      AND (
                        rm.created_at > COALESCE(lrm.created_at, rus.last_read_at, to_timestamp(0))
                        OR (
                          lrm.created_at IS NOT NULL
                          AND rm.created_at = lrm.created_at
                          AND rm.order_seq > lrm.order_seq
                        )
                      )
                    )
                  )
              ) AS unread_count,
              lm.kind AS preview_kind,
              lm.text AS preview_text,
              lm.media_url AS preview_media_url
       FROM room_members mem
       INNER JOIN rooms r ON r.id = mem.room_id
       LEFT JOIN room_user_settings rus ON rus.room_id = r.id AND rus.user_id = $1
       LEFT JOIN room_messages lrm ON lrm.id = rus.last_read_message_id
       LEFT JOIN LATERAL (
         SELECT kind, text, media_url
         FROM room_messages m
         WHERE m.room_id = r.id
          ORDER BY m.created_at DESC, m.order_seq DESC
          LIMIT 1
        ) lm ON TRUE
       WHERE mem.user_id = $1
         AND mem.left_at IS NULL
         AND r.deleted_at IS NULL
         AND (
           r.type <> 'direct' OR
           2 <= (
             SELECT COUNT(*)::int
             FROM room_members rm_active
             WHERE rm_active.room_id = r.id
               AND rm_active.left_at IS NULL
           )
         )
         AND r.id = $2
       LIMIT 1`,
      [userId, roomId]
    );

    const row = result.rows[0];
    if (!row) {
      throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, 'Room not found.');
    }

    const [membersMap, directTitleMap] = await Promise.all([
      this.getRoomMembers([roomId]),
      this.getDirectPeerTitles([roomId], userId)
    ]);

    return this.mapRoomDto(row, membersMap.get(roomId) ?? [], directTitleMap.get(roomId));
  }

  private mapRoomDto(row: RoomListRow, members: string[], directTitle?: string): RoomDto {
    const preview = normalizeMessagePreview(row.preview_kind, row.preview_text);

    const title =
      row.type === 'group'
        ? row.title?.trim() || 'Group'
        : row.type === 'family'
          ? row.title?.trim() || 'Family'
          : directTitle ?? row.title?.trim() ?? 'Direct';

    return {
      id: row.id,
      type: row.type,
      title,
      members,
      ownerUserId: row.created_by,
      isGroup: row.type !== 'direct',
      favorite: row.favorite ?? false,
      muted: row.muted ?? false,
      unread: Number(row.unread_count) || 0,
      ...(preview ? { preview } : {}),
      updatedAt: row.updated_at.toISOString()
    };
  }

  private mapMessageDto(row: RoomMessageRow): RoomMessageDto {
    const senderName = row.sender_id
      ? normalizeName(row.sender_name, row.sender_email ?? 'unknown@ourhangout.local')
      : 'System';

    return {
      id: row.id,
      roomId: row.room_id,
      ...(row.sender_id ? { senderId: row.sender_id } : {}),
      senderName,
      kind: row.kind,
      ...(row.text ? { text: row.text } : {}),
      ...(row.media_url ? { uri: row.media_url } : {}),
      at: row.created_at.toISOString(),
      delivery: row.delivery,
      ...(typeof row.unread_count === 'number' ? { unreadCount: row.unread_count } : {}),
      ...(Array.isArray(row.read_by_names) && row.read_by_names.length > 0 ? { readByNames: row.read_by_names } : {})
    };
  }

  private async getRoomMembers(roomIds: string[]): Promise<Map<string, string[]>> {
    const map = new Map<string, string[]>();
    if (roomIds.length === 0) {
      return map;
    }

    const result = await this.db.query<RoomMemberRow>(
      `SELECT mem.room_id, mem.user_id
       FROM room_members mem
       INNER JOIN rooms r ON r.id = mem.room_id
       WHERE mem.room_id = ANY($1::uuid[])
         AND (r.type = 'direct' OR mem.left_at IS NULL)
       ORDER BY mem.joined_at ASC`,
      [roomIds]
    );

    for (const row of result.rows) {
      const existing = map.get(row.room_id) ?? [];
      existing.push(row.user_id);
      map.set(row.room_id, existing);
    }

    return map;
  }

  private async getDirectPeerTitles(roomIds: string[], userId: string): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (roomIds.length === 0) {
      return map;
    }

    const result = await this.db.query<DirectRoomPeerTitleRow>(
      `SELECT mem.room_id,
              COALESCE(NULLIF(trim(u.display_name), ''), u.email) AS peer_name
       FROM room_members mem
       INNER JOIN rooms r ON r.id = mem.room_id
       INNER JOIN users u ON u.id = mem.user_id
       WHERE mem.room_id = ANY($1::uuid[])
         AND r.type = 'direct'
         AND mem.user_id <> $2`,
      [roomIds, userId]
    );

    for (const row of result.rows) {
      map.set(row.room_id, row.peer_name);
    }

    return map;
  }

  private async countUnread(userId: string, roomId: string): Promise<number> {
    const result = await this.db.query<{ unread_count: number }>(
      `SELECT COUNT(*)::int AS unread_count
       FROM room_messages m
       LEFT JOIN room_user_settings rus
         ON rus.room_id = $2
        AND rus.user_id = $1
       LEFT JOIN room_messages lrm
         ON lrm.id = rus.last_read_message_id
       WHERE m.room_id = $2
         AND m.kind <> 'system'
         AND m.sender_id IS DISTINCT FROM $1
         AND (
           (
             rus.last_read_message_id IS NULL
             AND m.created_at > COALESCE(rus.last_read_at, to_timestamp(0))
           )
           OR (
             rus.last_read_message_id IS NOT NULL
             AND (
               m.created_at > COALESCE(lrm.created_at, rus.last_read_at, to_timestamp(0))
               OR (
                 lrm.created_at IS NOT NULL
                 AND m.created_at = lrm.created_at
                  AND m.order_seq > lrm.order_seq
                )
              )
            )
         )`,
      [userId, roomId]
    );

    return Number(result.rows[0]?.unread_count ?? 0);
  }

  private async sendPushForRoomMessage(params: {
    room: RoomRow;
    message: RoomMessageDto;
    targetUserIds: string[];
  }): Promise<void> {
    if (!this.pushService.isEnabled()) return;
    if (params.targetUserIds.length === 0) return;
    if (params.message.kind === 'system') return;

    const recipients = await this.getPushRecipients(params.room.id, params.targetUserIds);
    if (recipients.length === 0) return;

    const recipientsByLocale = new Map<string, PushRecipientRow[]>();
    for (const recipient of recipients) {
      const locale = normalizeLocaleTag(recipient.locale);
      const existing = recipientsByLocale.get(locale) ?? [];
      existing.push(recipient);
      recipientsByLocale.set(locale, existing);
    }

    for (const [locale, localeRecipients] of recipientsByLocale.entries()) {
      const preview = getPushMessagePreview(params.message.kind, params.message.text, locale);
      const isSharedRoom = params.room.type !== 'direct';
      const title =
        isSharedRoom
          ? params.room.title?.trim() || params.message.senderName
          : params.message.senderName;
      const body =
        isSharedRoom
          ? `${params.message.senderName}: ${preview}`.trim()
          : preview;

      const result = await this.pushService.send({
        tokens: localeRecipients.map((recipient) => recipient.push_token),
        title,
        body,
        data: {
          roomId: params.room.id,
          kind: params.message.kind
        }
      });

      if (result.invalidTokens.length > 0) {
        await this.db.query('DELETE FROM device_tokens WHERE push_token = ANY($1::text[])', [result.invalidTokens]);
      }
    }
  }

  private async sendPushToUsers(params: {
    userIds: string[];
    resolveCopy: (locale: string | null) => { title: string; body: string };
    data?: Record<string, string>;
  }): Promise<void> {
    if (!this.pushService.isEnabled()) return;

    const uniqueUserIds = Array.from(new Set(params.userIds.map((userId) => userId.trim()).filter(Boolean)));
    if (uniqueUserIds.length === 0) return;

    const recipients = await this.db.query<{ push_token: string; locale: string | null }>(
      `SELECT DISTINCT dt.push_token,
                       u.locale
       FROM device_tokens dt
       INNER JOIN users u ON u.id = dt.user_id
       WHERE user_id = ANY($1::uuid[])`,
      [uniqueUserIds]
    );

    const recipientsByLocale = new Map<string, string[]>();
    for (const row of recipients.rows) {
      const token = row.push_token?.trim();
      if (!token) continue;
      const locale = normalizeLocaleTag(row.locale);
      const existing = recipientsByLocale.get(locale) ?? [];
      existing.push(token);
      recipientsByLocale.set(locale, existing);
    }

    for (const [locale, tokens] of recipientsByLocale.entries()) {
      const copy = params.resolveCopy(locale);
      const result = await this.pushService.send({
        tokens,
        title: copy.title,
        body: copy.body,
        data: params.data
      });

      if (result.invalidTokens.length > 0) {
        await this.db.query('DELETE FROM device_tokens WHERE push_token = ANY($1::text[])', [result.invalidTokens]);
      }
    }
  }

  private async getPushRecipients(roomId: string, userIds: string[]): Promise<PushRecipientRow[]> {
    if (userIds.length === 0) return [];

    const result = await this.db.query<PushRecipientRow>(
      `SELECT dt.user_id,
              dt.platform,
              dt.push_token,
              u.locale
       FROM device_tokens dt
       INNER JOIN users u ON u.id = dt.user_id
       LEFT JOIN room_user_settings rus
         ON rus.room_id = $1
        AND rus.user_id = dt.user_id
       WHERE dt.user_id = ANY($2::uuid[])
         AND COALESCE(rus.muted, FALSE) = FALSE`,
      [roomId, userIds]
    );

    return result.rows;
  }

  private assertSharedRoom(room: RoomRow | RoomMembershipRow): void {
    if (room.type === 'direct') {
      throw new AppError(409, ErrorCodes.CONFLICT, 'This action is not available for direct rooms.');
    }
  }

  private async getRoomMembership(roomId: string, userId: string, client?: PoolClient): Promise<RoomMembershipRow> {
    const executor = client ?? this.db;
    const result = await executor.query<RoomMembershipRow>(
      `SELECT r.id,
              r.type,
              r.title,
              r.created_by,
              r.created_at,
              r.updated_at,
              r.deleted_at,
              m.role AS member_role
       FROM rooms r
       INNER JOIN room_members m ON m.room_id = r.id
       WHERE r.id = $1
         AND m.user_id = $2
         AND m.left_at IS NULL
         AND r.deleted_at IS NULL
       LIMIT 1`,
      [roomId, userId]
    );

    const row = result.rows[0];
    if (!row) {
      throw new AppError(403, ErrorCodes.FORBIDDEN, 'You are not an active member of this room.');
    }

    return row;
  }

  private assertFamilyRoom(room: RoomRow | RoomMembershipRow): void {
    if (room.type !== 'family') {
      throw new AppError(409, ErrorCodes.CONFLICT, 'This action is only available for family rooms.');
    }
  }

  private async assertActiveRoomMember(roomId: string, userId: string, client?: PoolClient): Promise<void> {
    const executor = client ?? this.db;
    const result = await executor.query<{ exists: boolean }>(
      `SELECT EXISTS(
         SELECT 1
         FROM room_members
         WHERE room_id = $1
           AND user_id = $2
           AND left_at IS NULL
       ) AS exists`,
      [roomId, userId]
    );

    if (!(result.rows[0]?.exists ?? false)) {
      throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, 'Target user is not an active member of this room.');
    }
  }

  private async isActiveRoomMember(roomId: string, userId: string, client?: PoolClient): Promise<boolean> {
    const executor = client ?? this.db;
    const result = await executor.query<{ exists: boolean }>(
      `SELECT EXISTS(
         SELECT 1
         FROM room_members
         WHERE room_id = $1
           AND user_id = $2
           AND left_at IS NULL
       ) AS exists`,
      [roomId, userId]
    );
    return result.rows[0]?.exists ?? false;
  }

  private async getSharedRoomRow(roomId: string, client?: PoolClient): Promise<RoomRow> {
    const executor = client ?? this.db;
    const result = await executor.query<RoomRow>(
      `SELECT id,
              type,
              title,
              created_by,
              created_at,
              updated_at,
              deleted_at
       FROM rooms
       WHERE id = $1
         AND deleted_at IS NULL
         AND type IN ('group', 'family')
       LIMIT 1`,
      [roomId]
    );
    const row = result.rows[0];
    if (!row) {
      throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, 'Shared room not found.');
    }
    return row;
  }

  private async getPendingRoomInvitation(invitationId: string, client?: PoolClient): Promise<RoomInvitationRow> {
    const executor = client ?? this.db;
    const result = await executor.query<RoomInvitationRow>(
      `SELECT fri.id,
              fri.room_id,
              r.type AS room_type,
              r.title AS room_title,
              fri.inviter_user_id,
              inviter.display_name AS inviter_name,
              inviter.email AS inviter_email,
              inviter.avatar_url AS inviter_avatar_url,
              fri.target_user_id,
              target.display_name AS target_name,
              target.email AS target_email,
              fri.status,
              fri.created_at
       FROM family_room_invitations fri
       INNER JOIN rooms r ON r.id = fri.room_id
       INNER JOIN users inviter ON inviter.id = fri.inviter_user_id
       INNER JOIN users target ON target.id = fri.target_user_id
       WHERE fri.id = $1
         AND fri.status = 'pending'
         AND r.deleted_at IS NULL
         AND r.type IN ('group', 'family')
       LIMIT 1
       FOR UPDATE`,
      [invitationId]
    );
    const row = result.rows[0];
    if (!row) {
      throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, 'Pending room invitation not found.');
    }
    return row;
  }

  private async assertRoomMembership(roomId: string, userId: string, client?: PoolClient): Promise<RoomRow> {
    const membership = await this.getRoomMembership(roomId, userId, client);
    return {
      id: membership.id,
      type: membership.type,
      title: membership.title,
      created_by: membership.created_by,
      created_at: membership.created_at,
      updated_at: membership.updated_at,
      deleted_at: membership.deleted_at
    };
  }

  private async getActiveRoomMemberIds(roomId: string, client?: PoolClient): Promise<string[]> {
    const executor = client ?? this.db;
    const result = await executor.query<{ user_id: string }>(
      `SELECT user_id
       FROM room_members
       WHERE room_id = $1
         AND left_at IS NULL`,
      [roomId]
    );

    return result.rows.map((row) => row.user_id);
  }

  private async getAllRoomMemberIds(roomId: string, client?: PoolClient): Promise<string[]> {
    const executor = client ?? this.db;
    const result = await executor.query<{ user_id: string }>(
      `SELECT user_id
       FROM room_members
       WHERE room_id = $1
       ORDER BY joined_at ASC`,
      [roomId]
    );

    return result.rows.map((row) => row.user_id);
  }

  private async removeRoomMembership(roomId: string, targetUserId: string, client?: PoolClient): Promise<void> {
    const executor = client ?? this.db;
    await executor.query(
      `UPDATE room_members
       SET left_at = NOW()
       WHERE room_id = $1
         AND user_id = $2
         AND left_at IS NULL`,
      [roomId, targetUserId]
    );

    await executor.query(
      `UPDATE room_relationships
       SET status = 'removed',
           updated_at = NOW()
       WHERE room_id = $1
         AND status IN ('pending', 'active')
         AND (guardian_user_id = $2 OR child_user_id = $2)`,
      [roomId, targetUserId]
    );
  }

  private async getUserProfileRow(userId: string): Promise<UserProfileRow> {
    const result = await this.db.query<UserProfileRow>(
      `SELECT u.id,
              u.email,
              u.display_name,
              u.status_message,
              u.avatar_url,
              u.locale,
              settings.sharing_enabled AS location_sharing_enabled
       FROM users u
       LEFT JOIN user_location_settings settings ON settings.user_id = u.id
       WHERE u.id = $1
       LIMIT 1`,
      [userId]
    );

    const row = result.rows[0];
    if (!row) {
      throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, 'User not found.');
    }

    return row;
  }

  private async appendSystemRoomMessage(roomId: string, text: string): Promise<RoomMessageDto | null> {
    const insertResult = await this.db.query<{ id: string }>(
      `INSERT INTO room_messages (room_id, sender_id, kind, text, media_url, client_message_id, delivery, created_at)
       VALUES ($1, NULL, 'system', $2, NULL, NULL, 'read', NOW())
       RETURNING id`,
      [roomId, text]
    );

    await this.db.query(
      `UPDATE rooms
       SET updated_at = NOW()
       WHERE id = $1`,
      [roomId]
    );

    return this.fetchMessageById(insertResult.rows[0].id);
  }

  private async getFamilyRoomRelationshipById(relationshipId: string): Promise<RoomRelationshipRow | null> {
    const result = await this.db.query<RoomRelationshipRow>(
      `SELECT rr.id,
              rr.guardian_user_id,
              guardian.display_name AS guardian_name,
              guardian.email AS guardian_email,
              rr.child_user_id,
              child.display_name AS child_name,
              child.email AS child_email,
              rr.status,
              rr.created_by,
              rr.responded_by_user_id,
              rr.responded_at,
              rr.created_at
       FROM room_relationships rr
       INNER JOIN users guardian ON guardian.id = rr.guardian_user_id
       INNER JOIN users child ON child.id = rr.child_user_id
       WHERE rr.id = $1
         AND rr.relationship_type = 'guardian_child'
       LIMIT 1`,
      [relationshipId]
    );

    return result.rows[0] ?? null;
  }

  private mapProfile(row: UserProfileRow): UserProfileDto {
    return {
      id: row.id,
      name: normalizeName(row.display_name, row.email),
      ...(row.status_message ? { status: row.status_message } : {}),
      email: row.email,
      ...(row.avatar_url ? { avatarUri: row.avatar_url } : {}),
      locale: normalizeLocaleTag(row.locale),
      locationSharingEnabled: !!row.location_sharing_enabled
    };
  }

  private async getUserLocationSettings(userId: string): Promise<{ sharingEnabled: boolean }> {
    const result = await this.db.query<{ sharing_enabled: boolean }>(
      `SELECT sharing_enabled
       FROM user_location_settings
       WHERE user_id = $1
       LIMIT 1`,
      [userId]
    );

    return {
      sharingEnabled: !!result.rows[0]?.sharing_enabled
    };
  }

  private async upsertUserLocationSettings(userId: string, sharingEnabled: boolean): Promise<void> {
    await this.db.query(
      `INSERT INTO user_location_settings (user_id, sharing_enabled, created_at, updated_at)
       VALUES ($1, $2, NOW(), NOW())
       ON CONFLICT (user_id)
       DO UPDATE SET
         sharing_enabled = EXCLUDED.sharing_enabled,
         updated_at = NOW()`,
      [userId, sharingEnabled]
    );
  }

  private async getPendingLocationPrecisionRequest(userId: string): Promise<UserLocationPrecisionRequestRow | null> {
    const result = await this.db.query<UserLocationPrecisionRequestRow>(
      `SELECT user_id,
              requested_by_user_id,
              requested_by_kind,
              room_id,
              requested_at,
              expires_at,
              consumed_at,
              request_token_hash
       FROM user_location_precision_requests
       WHERE user_id = $1
         AND consumed_at IS NULL
         AND expires_at > NOW()
       LIMIT 1`,
      [userId]
    );

    return result.rows[0] ?? null;
  }

  private async upsertLocationPrecisionRequest(params: {
    userId: string;
    requestedByKind: 'guardian_app' | 'guardian_console';
    requestedByUserId?: string | null;
    roomId?: string | null;
  }): Promise<{ request: UserLocationPrecisionRequestRow; requestToken: string }> {
    const expiresAt = new Date(Date.now() + 3 * 60 * 1000);
    const requestToken = createLocationRequestToken();
    const requestTokenHash = hashLocationRequestToken(requestToken);
    const result = await this.db.query<UserLocationPrecisionRequestRow>(
      `INSERT INTO user_location_precision_requests (
         user_id,
         requested_by_user_id,
         requested_by_kind,
         room_id,
         requested_at,
         expires_at,
          consumed_at,
         request_token_hash,
         created_at,
         updated_at
       )
       VALUES ($1, $2, $3, $4, NOW(), $5, NULL, $6, NOW(), NOW())
       ON CONFLICT (user_id)
       DO UPDATE SET
         requested_by_user_id = EXCLUDED.requested_by_user_id,
         requested_by_kind = EXCLUDED.requested_by_kind,
         room_id = EXCLUDED.room_id,
         requested_at = NOW(),
         expires_at = EXCLUDED.expires_at,
         consumed_at = NULL,
         request_token_hash = EXCLUDED.request_token_hash,
         updated_at = NOW()
       RETURNING user_id, requested_by_user_id, requested_by_kind, room_id, requested_at, expires_at, consumed_at, request_token_hash`,
      [params.userId, params.requestedByUserId ?? null, params.requestedByKind, params.roomId ?? null, expiresAt, requestTokenHash]
    );

    return {
      request: result.rows[0],
      requestToken,
    };
  }

  private mapUserLocation(row: UserLocationLatestRow): UserLocationDto {
    return {
      userId: row.user_id,
      latitude: row.latitude,
      longitude: row.longitude,
      ...(typeof row.accuracy_m === 'number' ? { accuracyM: row.accuracy_m } : {}),
      capturedAt: row.captured_at.toISOString(),
      source: row.source
    };
  }

  private async isFriends(userId: string, friendUserId: string, client?: PoolClient): Promise<boolean> {
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

    return result.rows[0]?.exists ?? false;
  }

  private async isActiveBotUser(userId: string): Promise<boolean> {
    const result = await this.db.query<{ exists: boolean }>(
      `SELECT EXISTS(
        SELECT 1
        FROM bots
        WHERE user_id = $1
          AND is_active = TRUE
      )`,
      [userId]
    );

    return result.rows[0]?.exists ?? false;
  }

  private async findActiveBotsByUserIds(userIds: string[]): Promise<BotRecipientRow[]> {
    if (userIds.length === 0) {
      return [];
    }

    const result = await this.db.query<BotRecipientRow>(
      `SELECT user_id, bot_key, name AS bot_name
       FROM bots
       WHERE is_active = TRUE
         AND user_id = ANY($1::uuid[])`,
      [userIds]
    );

    return result.rows;
  }

  private async canOpenDirectRoom(userId: string, targetUserId: string): Promise<boolean> {
    if (await this.isFriends(userId, targetUserId)) {
      return true;
    }

    if (await this.isActiveBotUser(targetUserId)) {
      return true;
    }

    return false;
  }

  private async createSharedRoom(
    userId: string,
    params: {
      title: string;
      memberUserIds: string[];
    },
    roomType: 'group' | 'family'
  ): Promise<RoomDto> {
    const title = params.title.trim();
    if (title.length < 1 || title.length > 100) {
      throw new AppError(
        400,
        ErrorCodes.VALIDATION_ERROR,
        roomType === 'family' ? 'Family room title must be 1-100 characters.' : 'Group title must be 1-100 characters.'
      );
    }

    const uniqMemberIds = Array.from(new Set([userId, ...params.memberUserIds]));
    if (uniqMemberIds.length < 2) {
      throw new AppError(
        400,
        ErrorCodes.VALIDATION_ERROR,
        roomType === 'family' ? 'Family room requires at least 2 members.' : 'Group room requires at least 2 members.'
      );
    }

    const existingUsers = await this.db.query<{ id: string }>(
      `SELECT id
       FROM users
       WHERE id = ANY($1::uuid[])`,
      [uniqMemberIds]
    );

    if (existingUsers.rows.length !== uniqMemberIds.length) {
      throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, 'One or more users do not exist.');
    }

    if (roomType === 'family') {
      const friendIds = new Set(await this.getFriendUserIds(userId));
      const nonFriends = uniqMemberIds.filter((memberId) => memberId !== userId && !friendIds.has(memberId));
      if (nonFriends.length > 0) {
        throw new AppError(403, ErrorCodes.FORBIDDEN, 'Family room members must already be friends.');
      }
    }

    const client = await this.db.connect();
    let roomId = '';

    try {
      await client.query('BEGIN');

      const roomResult = await client.query<{ id: string }>(
        `INSERT INTO rooms (type, title, created_by, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())
         RETURNING id`,
        [roomType, title, userId]
      );

      roomId = roomResult.rows[0].id;

      for (const memberId of uniqMemberIds) {
        await client.query(
          `INSERT INTO room_members (room_id, user_id, role, joined_at, left_at)
           VALUES ($1, $2, $3, NOW(), NULL)
           ON CONFLICT (room_id, user_id)
           DO UPDATE SET
             left_at = NULL,
             role = EXCLUDED.role`,
          [roomId, memberId, memberId === userId ? 'admin' : 'member']
        );

        await client.query(
          `INSERT INTO room_user_settings (room_id, user_id, favorite, muted, created_at, updated_at)
           VALUES ($1, $2, FALSE, FALSE, NOW(), NOW())
           ON CONFLICT (room_id, user_id)
           DO UPDATE SET
             hidden_at = NULL,
             updated_at = NOW()`,
          [roomId, memberId]
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    this.emitToUsers(uniqMemberIds, {
      event: 'room.updated',
      data: {
        roomId
      }
    });

    return this.getRoomByIdForUser(userId, roomId);
  }

  private async createFriendshipPair(client: PoolClient, userAId: string, userBId: string): Promise<void> {
    await client.query(
      `INSERT INTO friendships (user_id, friend_user_id, trusted, created_at, updated_at)
       VALUES ($1, $2, FALSE, NOW(), NOW())
       ON CONFLICT (user_id, friend_user_id) DO NOTHING`,
      [userAId, userBId]
    );

    await client.query(
      `INSERT INTO friendships (user_id, friend_user_id, trusted, created_at, updated_at)
       VALUES ($1, $2, FALSE, NOW(), NOW())
       ON CONFLICT (user_id, friend_user_id) DO NOTHING`,
      [userBId, userAId]
    );
  }

  private async ensureDirectRoomForUsers(
    client: PoolClient,
    userAId: string,
    userBId: string,
    createdBy: string
  ): Promise<string> {
    const directKey = getDirectKey(userAId, userBId);

    await this.archiveDirectRoomByKeyIfNeeded(client, directKey);

    const roomResult = await client.query<{ id: string }>(
      `INSERT INTO rooms (type, direct_key, title, created_by, created_at, updated_at, deleted_at)
       VALUES ('direct', $1, NULL, $2, NOW(), NOW(), NULL)
       ON CONFLICT (direct_key)
       DO UPDATE SET
         updated_at = NOW(),
         deleted_at = NULL
       RETURNING id`,
      [directKey, createdBy]
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

  private async archiveDirectRoomByKeyIfNeeded(client: PoolClient, directKey: string): Promise<void> {
    const existing = await client.query<{ id: string; deleted_at: Date | null; has_left_member: boolean }>(
      `SELECT r.id,
              r.deleted_at,
              EXISTS(
                SELECT 1
                FROM room_members rm
                WHERE rm.room_id = r.id
                  AND rm.left_at IS NOT NULL
              ) AS has_left_member
       FROM rooms r
       WHERE r.type = 'direct'
         AND r.direct_key = $1
       LIMIT 1
       FOR UPDATE`,
      [directKey]
    );

    const row = existing.rows[0];
    if (!row) {
      return;
    }

    if (!row.deleted_at && !row.has_left_member) {
      return;
    }

    await this.closeDirectRoom(client, row.id);
  }

  private async closeDirectRoom(client: PoolClient, roomId: string): Promise<void> {
    await client.query(
      `UPDATE room_members
       SET left_at = COALESCE(left_at, NOW())
       WHERE room_id = $1`,
      [roomId]
    );

    await client.query(
      `UPDATE rooms
       SET deleted_at = COALESCE(deleted_at, NOW()),
           updated_at = NOW(),
           direct_key = CASE
             WHEN direct_key IS NULL THEN NULL
             ELSE CONCAT(direct_key, '#closed#', $2)
           END
       WHERE id = $1`,
      [roomId, randomUUID()]
    );
  }

  private async getUserRole(userId: string): Promise<RoleRow['role']> {
    const result = await this.db.query<RoleRow>(
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

    return row.role;
  }

  private async getFriendUserIds(userId: string): Promise<string[]> {
    const result = await this.db.query<{ friend_user_id: string }>(
      `SELECT friend_user_id
       FROM friendships
       WHERE user_id = $1`,
      [userId]
    );

    return result.rows.map((row) => row.friend_user_id);
  }

  private async assertParentRole(userId: string): Promise<void> {
    const role = await this.getUserRole(userId);
    if (role !== 'parent') {
      throw new AppError(403, ErrorCodes.FORBIDDEN, 'Only parent/admin role can access report queue.');
    }
  }

  private mapRoomMember(row: RoomMemberProfileRow, ownerUserId: string): RoomMemberDto {
    return {
      userId: row.user_id,
      name: normalizeName(row.display_name, row.email),
      ...(row.avatar_url ? { avatarUri: row.avatar_url } : {}),
      ...(row.alias?.trim() ? { alias: row.alias.trim() } : {}),
      role: row.role,
      isOwner: row.user_id === ownerUserId
    };
  }

  private mapRoomInvitation(row: RoomInvitationRow): RoomInvitationDto {
    return {
      id: row.id,
      roomId: row.room_id,
      roomType: row.room_type,
      roomTitle: (row.room_title || '').trim(),
      inviterUserId: row.inviter_user_id,
      inviterName: normalizeName(row.inviter_name, row.inviter_email),
      ...(row.inviter_avatar_url ? { inviterAvatarUri: row.inviter_avatar_url } : {}),
      targetUserId: row.target_user_id,
      targetName: normalizeName(row.target_name, row.target_email),
      status: row.status,
      createdAt: row.created_at.toISOString()
    };
  }

  private mapFamilyRoomRelationship(row: RoomRelationshipRow): FamilyRoomRelationshipDto {
    return {
      id: row.id,
      guardianUserId: row.guardian_user_id,
      guardianName: normalizeName(row.guardian_name, row.guardian_email),
      childUserId: row.child_user_id,
      childName: normalizeName(row.child_name, row.child_email),
      createdAt: row.created_at.toISOString()
    };
  }

  private mapFamilyRoomRelationshipRequest(row: RoomRelationshipRow): FamilyRoomRelationshipRequestDto {
    return {
      id: row.id,
      guardianUserId: row.guardian_user_id,
      guardianName: normalizeName(row.guardian_name, row.guardian_email),
      childUserId: row.child_user_id,
      childName: normalizeName(row.child_name, row.child_email),
      ...(row.created_by ? { requestedByUserId: row.created_by } : {}),
      createdAt: row.created_at.toISOString()
    };
  }

  private emitToUsers(userIds: string[], payload: unknown): void {
    const unique = Array.from(new Set(userIds));
    for (const userId of unique) {
      this.connectionManager.sendToUser(userId, payload);
    }
  }
}
