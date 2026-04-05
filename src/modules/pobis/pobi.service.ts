import { createHash, randomBytes, randomUUID } from 'crypto';
import type { FastifyBaseLogger } from 'fastify';
import type { Pool, PoolClient } from 'pg';
import { AppError, ErrorCodes } from '../../lib/errors';
import type { AppEnv } from '../../config/env';
import type { OpenClawChannelHub } from '../openclaw/channel-hub';
import type { OpenClawConnectorHub } from '../openclaw/connector-hub';
import type { SocialService } from '../social/social.service';
import type { RoomMessageDto } from '../social/social.types';
import type { PobiOpenClawInfo, PobiOpenClawPairingResult, PobiRoomResult, PobiSummary } from './pobi.types';
import { customAlphabet } from 'nanoid';

type PobiRow = {
  pobi_id: string;
  owner_user_id: string;
  display_name: string;
  theme: string;
  status_message: string | null;
  avatar_url: string | null;
  pobi_is_default: boolean;
  pobi_is_active: boolean;
  pobi_created_at: Date;
  pobi_updated_at: Date;
  bot_id: string;
  bot_key: string;
  bot_user_id: string;
};

type ConnectorRow = {
  id: string;
  owner_user_id: string;
  connector_key: string;
  device_name: string | null;
  platform?: string | null;
  status: 'pending' | 'online' | 'offline' | 'revoked';
  connected_at: Date | null;
  last_seen_at: Date | null;
};

type ChannelAccountBindingRow = {
  connector_db_id: string;
  account_id: string;
  owner_user_id: string;
  device_name: string | null;
  platform: string | null;
  status: 'pending' | 'online' | 'offline' | 'revoked';
  connected_at: Date | null;
  last_seen_at: Date | null;
  pobi_id: string;
  bot_key: string;
  bot_user_id: string;
};

type ChannelInboundMessageRow = {
  message_id: string;
  room_id: string;
  sender_user_id: string;
  kind: 'text' | 'image' | 'video' | 'system';
  text: string | null;
  media_url: string | null;
  reply_to_message_id?: string | null;
  created_at: Date;
  order_seq: number;
  pobi_id: string;
  bot_key: string;
  bot_user_id: string;
};

type PairingRow = {
  id: string;
  owner_user_id: string;
  pobi_id: string;
  pairing_code: string;
  expires_at: Date;
  consumed_at: Date | null;
  connector_id: string | null;
  created_at: Date;
};

type PobiServiceDeps = {
  db: Pool;
  socialService: SocialService;
  channelHub: OpenClawChannelHub;
  connectorHub: OpenClawConnectorHub;
  env: AppEnv;
  logger: FastifyBaseLogger;
};

const POBI_THEMES = new Set(['seed', 'fairy', 'pet', 'buddy']);
const connectorPairingCodeGenerator = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6);

export class PobiService {
  private readonly db: Pool;
  private readonly socialService: SocialService;
  private readonly channelHub: OpenClawChannelHub;
  private readonly connectorHub: OpenClawConnectorHub;
  private readonly env: AppEnv;
  private readonly logger: FastifyBaseLogger;

  constructor(deps: PobiServiceDeps) {
    this.db = deps.db;
    this.socialService = deps.socialService;
    this.channelHub = deps.channelHub;
    this.connectorHub = deps.connectorHub;
    this.env = deps.env;
    this.logger = deps.logger;
  }

  async listPobis(ownerUserId: string): Promise<PobiSummary[]> {
    const result = await this.db.query<PobiRow>(
      `SELECT p.id AS pobi_id,
              p.owner_user_id,
              p.display_name,
              p.theme,
              u.status_message,
              u.avatar_url,
              p.is_default AS pobi_is_default,
              p.is_active AS pobi_is_active,
              p.created_at AS pobi_created_at,
              p.updated_at AS pobi_updated_at,
              b.id AS bot_id,
              b.bot_key,
              b.user_id AS bot_user_id
       FROM pobis p
       INNER JOIN bots b ON b.id = p.bot_id
       INNER JOIN users u ON u.id = b.user_id
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
      status?: string;
      avatarUri?: string;
    }
  ): Promise<PobiSummary> {
    const name = input.name.trim();
    if (name.length < 1 || name.length > 40) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Pobi name must be 1-40 characters.');
    }

    const theme = this.normalizeTheme(input.theme);
    const status = (input.status || '').trim();
    const avatarUri = (input.avatarUri || '').trim();
    if (status.length > 200) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Pobi status must be 0-200 characters.');
    }

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

      await client.query(
        `UPDATE users
         SET status_message = $2,
             avatar_url = $3,
             updated_at = NOW()
         WHERE id = $1`,
        [botUserId, status || null, avatarUri || null]
      );

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
      status?: string;
      avatarUri?: string;
      setDefault?: boolean;
    }
  ): Promise<PobiSummary> {
    const current = await this.getPobiRowByIdForOwner(ownerUserId, pobiId);
    const nextName = input.name === undefined ? current.display_name : input.name.trim();
    const nextTheme = input.theme === undefined ? current.theme : this.normalizeTheme(input.theme);
    const nextStatus = input.status === undefined ? current.status_message ?? '' : input.status.trim();
    const nextAvatarUri = input.avatarUri === undefined ? current.avatar_url ?? '' : input.avatarUri.trim();

    if (nextName.length < 1 || nextName.length > 40) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Pobi name must be 1-40 characters.');
    }
    if (nextStatus.length > 200) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Pobi status must be 0-200 characters.');
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
             status_message = $3,
             avatar_url = $4,
             updated_at = NOW()
         WHERE id = $1`,
        [current.bot_user_id, nextName, nextStatus || null, nextAvatarUri || null]
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

  async createOpenClawPairing(
    ownerUserId: string,
    pobiId: string,
    ttlSeconds = 600
  ): Promise<PobiOpenClawPairingResult> {
    const pobi = await this.getPobiByIdForOwner(ownerUserId, pobiId);
    const existingPairing = await this.getPendingPairingForPobi(ownerUserId, pobiId);
    if (existingPairing) {
      return {
        pairingCode: existingPairing.pairing_code,
        expiresAt: existingPairing.expires_at.toISOString(),
        pobi
      };
    }

    const effectiveTtlSeconds = Math.max(60, Math.min(3600, Math.floor(ttlSeconds)));
    const expiresAt = new Date(Date.now() + effectiveTtlSeconds * 1000);

    await this.db.query(
      `DELETE FROM openclaw_connector_pairings
       WHERE owner_user_id = $1
         AND pobi_id = $2
         AND consumed_at IS NULL
         AND expires_at <= NOW()`,
      [ownerUserId, pobiId]
    );

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const pairingCode = connectorPairingCodeGenerator();

      try {
        await this.db.query(
          `INSERT INTO openclaw_connector_pairings (owner_user_id, pobi_id, pairing_code, expires_at)
           VALUES ($1, $2, $3, $4)`,
          [ownerUserId, pobiId, pairingCode, expiresAt]
        );

        return {
          pairingCode,
          expiresAt: expiresAt.toISOString(),
          pobi
        };
      } catch {
        // retry collision
      }
    }

    throw new AppError(500, ErrorCodes.INTERNAL_ERROR, 'Failed to generate OpenClaw pairing code.');
  }

  async getOpenClawInfo(ownerUserId: string, pobiId: string): Promise<PobiOpenClawInfo> {
    const pobi = await this.getPobiByIdForOwner(ownerUserId, pobiId);
    const matchedConnectors = this.connectorHub.getConnectorsForBotKey(pobi.botKey);
    const matchedChannels = this.channelHub.getSessionsForPobi(pobi.id);
    const connector = await this.getConnectorForPobi(pobi.id);
    const pairing = await this.getPendingPairingForPobi(ownerUserId, pobi.id);
    const connected = matchedConnectors.length > 0 || matchedChannels.length > 0;
    const status: 'connected' | 'pairing_pending' | 'not_connected' = connected
      ? 'connected'
      : pairing
        ? 'pairing_pending'
        : 'not_connected';

    return {
      pobi,
      openclaw: {
        mode: this.env.OPENCLAW_MODE,
        botKey: pobi.botKey,
        connected,
        status,
        ...(connector?.device_name ? { deviceName: connector.device_name } : {}),
        ...(connector?.last_seen_at ? { lastSeenAt: connector.last_seen_at.toISOString() } : {}),
        ...(pairing ? { pairingCode: pairing.pairing_code, pairingExpiresAt: pairing.expires_at.toISOString() } : {}),
        matchedConnectors: matchedConnectors.map((connector) => ({
          connectorId: connector.connectorId,
          wildcard: connector.wildcard,
          botKeys: connector.botKeys,
          lastSeenAt: connector.lastSeenAt
        })),
        matchedChannels: matchedChannels.map((channel) => ({
          accountId: channel.accountId,
          pobiIds: channel.pobiIds,
          botKeys: channel.botKeys,
          lastSeenAt: channel.lastSeenAt
        }))
      }
    };
  }

  async registerOpenClawChannelByPairing(input: {
    pairingCode: string;
    deviceKey: string;
    deviceName?: string;
    platform?: string;
  }): Promise<{
    accountId: string;
    ownerUserId: string;
    pobiId: string;
    botKey: string;
    authToken: string;
    wsUrl: string;
    syncUrl: string;
    messagesUrl: string;
    sessionKeyPrefix: string;
  }> {
    const registered = await this.registerOpenClawConnectorByPairing({
      pairingCode: input.pairingCode,
      connectorKey: input.deviceKey,
      deviceName: input.deviceName,
      platform: input.platform
    });

    const httpBaseUrl = this.getOpenClawHttpBaseUrl();

    return {
      accountId: registered.connectorId,
      ownerUserId: registered.ownerUserId,
      pobiId: registered.pobiId,
      botKey: registered.botKey,
      authToken: registered.connectorAuthToken,
      wsUrl: this.getOpenClawChannelWsUrl(),
      syncUrl: `${httpBaseUrl}/v1/openclaw/channel/messages/sync`,
      messagesUrl: `${httpBaseUrl}/v1/openclaw/channel/messages`,
      sessionKeyPrefix: 'ourhangout:direct'
    };
  }

  async resolveOpenClawChannelByAuthToken(token: string): Promise<{
    connectorDbId: string;
    accountId: string;
    ownerUserId: string;
    deviceName?: string;
    platform?: string;
    status: 'pending' | 'online' | 'offline' | 'revoked';
    connectedAt?: string;
    lastSeenAt?: string;
    pobiBindings: Array<{
      pobiId: string;
      botKey: string;
      botUserId: string;
    }>;
  } | null> {
    const trimmed = token.trim();
    if (!trimmed) {
      return null;
    }

    const tokenHash = this.hashConnectorToken(trimmed);
    const result = await this.db.query<ChannelAccountBindingRow>(
      `SELECT c.id AS connector_db_id,
              c.connector_key AS account_id,
              c.owner_user_id,
              c.device_name,
              c.platform,
              c.status,
              c.connected_at,
              c.last_seen_at,
              p.id AS pobi_id,
              b.bot_key,
              b.user_id AS bot_user_id
       FROM openclaw_connectors c
       INNER JOIN openclaw_connector_pobis cp ON cp.connector_id = c.id
       INNER JOIN pobis p ON p.id = cp.pobi_id
       INNER JOIN bots b ON b.id = p.bot_id
       WHERE c.auth_token_hash = $1
         AND c.status <> 'revoked'
       ORDER BY cp.created_at ASC`,
      [tokenHash]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const first = result.rows[0];
    return {
      connectorDbId: first.connector_db_id,
      accountId: first.account_id,
      ownerUserId: first.owner_user_id,
      ...(first.device_name ? { deviceName: first.device_name } : {}),
      ...(first.platform ? { platform: first.platform } : {}),
      status: first.status,
      ...(first.connected_at ? { connectedAt: first.connected_at.toISOString() } : {}),
      ...(first.last_seen_at ? { lastSeenAt: first.last_seen_at.toISOString() } : {}),
      pobiBindings: result.rows.map((row) => ({
        pobiId: row.pobi_id,
        botKey: row.bot_key,
        botUserId: row.bot_user_id
      }))
    };
  }

  async listOpenClawChannelInboundMessages(
    account: {
      connectorDbId: string;
      accountId: string;
      pobiBindings: Array<{
        pobiId: string;
        botKey: string;
        botUserId: string;
      }>;
    },
    params: {
      afterOrderSeq?: number;
      limit?: number;
      pobiId?: string;
    }
  ): Promise<{
    items: Array<{
      accountId: string;
      sessionKey: string;
      roomId: string;
      roomType: 'direct';
      pobiId: string;
      botKey: string;
      botUserId: string;
      senderUserId: string;
      messageId: string;
      kind: 'text' | 'image' | 'video' | 'system';
      text?: string;
      uri?: string;
      replyToMessageId?: string;
      orderSeq: number;
      createdAt: string;
    }>;
    nextAfterOrderSeq: number;
    hasMore: boolean;
  }> {
    const allowedPobiIds = new Set(account.pobiBindings.map((binding) => binding.pobiId));
    if (params.pobiId && !allowedPobiIds.has(params.pobiId)) {
      throw new AppError(403, ErrorCodes.FORBIDDEN, 'Pobi is not linked to this OpenClaw channel account.');
    }

    const afterOrderSeq =
      typeof params.afterOrderSeq === 'number' && Number.isFinite(params.afterOrderSeq)
        ? Math.max(0, Math.floor(params.afterOrderSeq))
        : 0;
    const limit =
      typeof params.limit === 'number' && Number.isFinite(params.limit)
        ? Math.min(200, Math.max(1, Math.floor(params.limit)))
        : 50;

    const bindings = params.pobiId ? [params.pobiId] : Array.from(allowedPobiIds);
    if (bindings.length === 0) {
      return {
        items: [],
        nextAfterOrderSeq: afterOrderSeq,
        hasMore: false
      };
    }

    const result = await this.db.query<ChannelInboundMessageRow>(
      `SELECT rm.id AS message_id,
              rm.room_id,
              rm.sender_id AS sender_user_id,
              rm.kind,
              rm.text,
              rm.media_url,
              rm.reply_to_message_id,
              rm.created_at,
              rm.order_seq,
              p.id AS pobi_id,
              b.bot_key,
              b.user_id AS bot_user_id
       FROM openclaw_connector_pobis cp
       INNER JOIN pobis p ON p.id = cp.pobi_id
       INNER JOIN bots b ON b.id = p.bot_id
       INNER JOIN room_members bot_member
               ON bot_member.user_id = b.user_id
              AND bot_member.left_at IS NULL
       INNER JOIN rooms r
               ON r.id = bot_member.room_id
              AND r.type = 'direct'
              AND r.deleted_at IS NULL
       INNER JOIN room_messages rm
               ON rm.room_id = r.id
              AND rm.sender_id IS NOT NULL
              AND rm.sender_id <> b.user_id
       WHERE cp.connector_id = $1
         AND cp.pobi_id = ANY($2::uuid[])
         AND rm.order_seq > $3
       ORDER BY rm.order_seq ASC
       LIMIT $4`,
      [account.connectorDbId, bindings, afterOrderSeq, limit + 1]
    );

    const hasMore = result.rows.length > limit;
    const rows = hasMore ? result.rows.slice(0, limit) : result.rows;
    const items = rows.map((row) => ({
      accountId: account.accountId,
      sessionKey: this.makeDirectSessionKey(row.room_id, row.pobi_id),
      roomId: row.room_id,
      roomType: 'direct' as const,
      pobiId: row.pobi_id,
      botKey: row.bot_key,
      botUserId: row.bot_user_id,
      senderUserId: row.sender_user_id,
      messageId: row.message_id,
      kind: row.kind,
      ...(row.text ? { text: row.text } : {}),
      ...(row.media_url ? { uri: row.media_url } : {}),
      ...(row.reply_to_message_id ? { replyToMessageId: row.reply_to_message_id } : {}),
      orderSeq: row.order_seq,
      createdAt: row.created_at.toISOString()
    }));

    return {
      items,
      nextAfterOrderSeq: items.length > 0 ? items[items.length - 1].orderSeq : afterOrderSeq,
      hasMore
    };
  }

  async sendOpenClawChannelMessage(
    account: {
      pobiBindings: Array<{
        pobiId: string;
        botKey: string;
        botUserId: string;
      }>;
    },
    input: {
      roomId: string;
      pobiId: string;
      text: string;
      clientMessageId?: string;
      replyToMessageId?: string;
    }
  ): Promise<RoomMessageDto> {
    const binding = account.pobiBindings.find((candidate) => candidate.pobiId === input.pobiId);
    if (!binding) {
      throw new AppError(403, ErrorCodes.FORBIDDEN, 'Pobi is not linked to this OpenClaw channel account.');
    }

    const text = input.text.trim();
    if (text.length === 0 || text.length > 5000) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Message text must be 1-5000 characters.');
    }

    const membership = await this.db.query<{
      exists: boolean;
    }>(
      `SELECT EXISTS(
         SELECT 1
         FROM rooms r
         INNER JOIN room_members rm ON rm.room_id = r.id
         WHERE r.id = $1
           AND r.type = 'direct'
           AND r.deleted_at IS NULL
           AND rm.user_id = $2
           AND rm.left_at IS NULL
       ) AS exists`,
      [input.roomId, binding.botUserId]
    );

    if (!(membership.rows[0]?.exists ?? false)) {
      throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, 'Direct room not found for linked Pobi.');
    }

    return this.socialService.sendRoomMessage({
      userId: binding.botUserId,
      roomId: input.roomId,
      clientMessageId: input.clientMessageId,
      kind: 'text',
      text,
      replyToMessageId: input.replyToMessageId
    });
  }

  async registerOpenClawConnectorByPairing(input: {
    pairingCode: string;
    connectorKey: string;
    deviceName?: string;
    platform?: string;
  }): Promise<{
    connectorId: string;
    ownerUserId: string;
    pobiId: string;
    botKey: string;
    connectorAuthToken: string;
    wsUrl: string;
  }> {
    const pairingCode = input.pairingCode.trim().toUpperCase();
    const connectorKey = input.connectorKey.trim();
    const deviceName = (input.deviceName || '').trim();
    const platform = (input.platform || 'linux').trim() || 'linux';

    if (!pairingCode || pairingCode.length < 6) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Pairing code is invalid.');
    }
    if (!connectorKey || connectorKey.length < 3 || connectorKey.length > 120) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'connectorKey must be 3-120 characters.');
    }

    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      const pairingResult = await client.query<PairingRow>(
        `SELECT id,
                owner_user_id,
                pobi_id,
                pairing_code,
                expires_at,
                consumed_at,
                connector_id,
                created_at
         FROM openclaw_connector_pairings
         WHERE pairing_code = $1
         FOR UPDATE`,
        [pairingCode]
      );

      const pairing = pairingResult.rows[0];
      if (!pairing) {
        throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, 'OpenClaw pairing code not found.');
      }
      if (pairing.consumed_at) {
        throw new AppError(409, ErrorCodes.CONFLICT, 'OpenClaw pairing code already consumed.');
      }
      if (pairing.expires_at.getTime() <= Date.now()) {
        throw new AppError(410, ErrorCodes.RESOURCE_NOT_FOUND, 'OpenClaw pairing code expired.');
      }

      const existingConnectorResult = await client.query<ConnectorRow & { auth_token_hash: string }>(
        `SELECT id,
                owner_user_id,
                connector_key,
                device_name,
                status,
                connected_at,
                last_seen_at,
                auth_token_hash
         FROM openclaw_connectors
         WHERE connector_key = $1
         LIMIT 1
         FOR UPDATE`,
        [connectorKey]
      );

      const connectorAuthToken = randomBytes(32).toString('hex');
      const connectorAuthTokenHash = this.hashConnectorToken(connectorAuthToken);

      let connectorId = existingConnectorResult.rows[0]?.id ?? '';
      const existingConnector = existingConnectorResult.rows[0];
      if (existingConnector && existingConnector.owner_user_id !== pairing.owner_user_id) {
        throw new AppError(409, ErrorCodes.CONFLICT, 'connectorKey is already registered to another owner.');
      }

      if (existingConnector) {
        await client.query(
          `UPDATE openclaw_connectors
           SET owner_user_id = $2,
               device_name = $3,
               platform = $4,
               status = 'offline',
               auth_token_hash = $5,
               updated_at = NOW()
           WHERE id = $1`,
          [existingConnector.id, pairing.owner_user_id, deviceName || existingConnector.device_name, platform, connectorAuthTokenHash]
        );
        connectorId = existingConnector.id;
      } else {
        const connectorInsert = await client.query<{ id: string }>(
          `INSERT INTO openclaw_connectors (
             owner_user_id,
             connector_key,
             device_name,
             platform,
             status,
             auth_token_hash,
             created_at,
             updated_at
           )
           VALUES ($1, $2, $3, $4, 'offline', $5, NOW(), NOW())
           RETURNING id`,
          [pairing.owner_user_id, connectorKey, deviceName || null, platform, connectorAuthTokenHash]
        );
        connectorId = connectorInsert.rows[0]?.id ?? '';
      }

      await client.query(
        `INSERT INTO openclaw_connector_pobis (connector_id, pobi_id)
         VALUES ($1, $2)
         ON CONFLICT (pobi_id)
         DO UPDATE SET connector_id = EXCLUDED.connector_id`,
        [connectorId, pairing.pobi_id]
      );

      await client.query(
        `UPDATE openclaw_connector_pairings
         SET consumed_at = NOW(),
             connector_id = $2
         WHERE id = $1`,
        [pairing.id, connectorId]
      );

      await client.query('COMMIT');

      const pobi = await this.getPobiByIdForOwner(pairing.owner_user_id, pairing.pobi_id);
      return {
        connectorId: connectorKey,
        ownerUserId: pairing.owner_user_id,
        pobiId: pairing.pobi_id,
        botKey: pobi.botKey,
        connectorAuthToken,
        wsUrl: this.getOpenClawWsUrl()
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async resolveConnectorByAuthToken(token: string): Promise<{
    connectorId: string;
    botKeys: string[];
    ownerUserId: string;
  } | null> {
    const trimmed = token.trim();
    if (!trimmed) return null;

    const tokenHash = this.hashConnectorToken(trimmed);
    const result = await this.db.query<{
      connector_id: string;
      owner_user_id: string;
      bot_key: string;
    }>(
      `SELECT c.connector_key AS connector_id,
              c.owner_user_id,
              b.bot_key
       FROM openclaw_connectors c
       INNER JOIN openclaw_connector_pobis cp ON cp.connector_id = c.id
       INNER JOIN pobis p ON p.id = cp.pobi_id
       INNER JOIN bots b ON b.id = p.bot_id
       WHERE c.auth_token_hash = $1
         AND c.status <> 'revoked'`,
      [tokenHash]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return {
      connectorId: result.rows[0].connector_id,
      ownerUserId: result.rows[0].owner_user_id,
      botKeys: Array.from(new Set(result.rows.map((row) => row.bot_key).filter(Boolean)))
    };
  }

  async markConnectorConnected(connectorId: string): Promise<void> {
    await this.db.query(
      `UPDATE openclaw_connectors
       SET status = 'online',
           connected_at = NOW(),
           last_seen_at = NOW(),
           updated_at = NOW()
       WHERE connector_key = $1`,
      [connectorId]
    );
  }

  async markConnectorDisconnected(connectorId: string): Promise<void> {
    await this.db.query(
      `UPDATE openclaw_connectors
       SET status = 'offline',
           last_seen_at = NOW(),
           updated_at = NOW()
       WHERE connector_key = $1`,
      [connectorId]
    );
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
              u.status_message,
              u.avatar_url,
              p.is_default AS pobi_is_default,
              p.is_active AS pobi_is_active,
              p.created_at AS pobi_created_at,
              p.updated_at AS pobi_updated_at,
              b.id AS bot_id,
              b.bot_key,
              b.user_id AS bot_user_id
       FROM pobis p
       INNER JOIN bots b ON b.id = p.bot_id
       INNER JOIN users u ON u.id = b.user_id
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

  private async getPendingPairingForPobi(ownerUserId: string, pobiId: string): Promise<PairingRow | null> {
    const result = await this.db.query<PairingRow>(
      `SELECT id,
              owner_user_id,
              pobi_id,
              pairing_code,
              expires_at,
              consumed_at,
              connector_id,
              created_at
       FROM openclaw_connector_pairings
       WHERE owner_user_id = $1
         AND pobi_id = $2
         AND consumed_at IS NULL
         AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 1`,
      [ownerUserId, pobiId]
    );

    return result.rows[0] ?? null;
  }

  private async getConnectorForPobi(pobiId: string): Promise<ConnectorRow | null> {
    const result = await this.db.query<ConnectorRow>(
      `SELECT c.id,
              c.owner_user_id,
              c.connector_key,
              c.device_name,
              c.status,
              c.connected_at,
              c.last_seen_at
       FROM openclaw_connector_pobis cp
       INNER JOIN openclaw_connectors c ON c.id = cp.connector_id
       WHERE cp.pobi_id = $1
       LIMIT 1`,
      [pobiId]
    );

    return result.rows[0] ?? null;
  }

  private hashConnectorToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private makeDirectSessionKey(roomId: string, pobiId: string): string {
    return `ourhangout:direct:${roomId}:${pobiId}`;
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

  private getOpenClawHttpBaseUrl(): string {
    return this.env.PUBLIC_BASE_URL.replace(/\/+$/, '');
  }

  private getOpenClawWsUrl(): string {
    const baseUrl = this.getOpenClawHttpBaseUrl();
    if (/^https:/i.test(baseUrl)) {
      return `${baseUrl.replace(/^https:/i, 'wss:')}/v1/openclaw/connector/ws`;
    }
    if (/^http:/i.test(baseUrl)) {
      return `${baseUrl.replace(/^http:/i, 'ws:')}/v1/openclaw/connector/ws`;
    }
    return `${baseUrl}/v1/openclaw/connector/ws`;
  }

  private getOpenClawChannelWsUrl(): string {
    const baseUrl = this.getOpenClawHttpBaseUrl();
    if (/^https:/i.test(baseUrl)) {
      return `${baseUrl.replace(/^https:/i, 'wss:')}/v1/openclaw/channel/ws`;
    }
    if (/^http:/i.test(baseUrl)) {
      return `${baseUrl.replace(/^http:/i, 'ws:')}/v1/openclaw/channel/ws`;
    }
    return `${baseUrl}/v1/openclaw/channel/ws`;
  }

  private mapPobi(row: PobiRow): PobiSummary {
    return {
      id: row.pobi_id,
      name: row.display_name,
      theme: row.theme,
      botId: row.bot_id,
      botKey: row.bot_key,
      botUserId: row.bot_user_id,
      ...(row.status_message ? { status: row.status_message } : {}),
      ...(row.avatar_url ? { avatarUri: row.avatar_url } : {}),
      isDefault: row.pobi_is_default,
      isActive: row.pobi_is_active,
      createdAt: row.pobi_created_at.toISOString(),
      updatedAt: row.pobi_updated_at.toISOString()
    };
  }
}
