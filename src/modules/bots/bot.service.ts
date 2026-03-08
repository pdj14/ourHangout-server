import type { FastifyBaseLogger } from 'fastify';
import type { Pool } from 'pg';
import type { ChatService } from '../chat/chat.service';
import type { BotRoomResult, BotSummary } from './bot.types';
import { AppError, ErrorCodes } from '../../lib/errors';

type BotRow = {
  id: string;
  bot_key: string;
  name: string;
  description: string | null;
  provider: 'openclaw';
  user_id: string;
  is_active: boolean;
  created_at: Date;
};

type BotServiceDeps = {
  db: Pool;
  chatService: ChatService;
  logger: FastifyBaseLogger;
};

const DEFAULT_OPENCLAW_BOT = {
  key: 'openclaw-assistant',
  email: 'openclaw.bot@ourhangout.local',
  providerUserId: 'system:bot:openclaw-assistant',
  name: 'OpenClaw Assistant',
  description: 'OurHangout in-app bot bridged to OpenClaw provider.'
} as const;

export class BotService {
  private readonly db: Pool;
  private readonly chatService: ChatService;
  private readonly logger: FastifyBaseLogger;

  constructor(deps: BotServiceDeps) {
    this.db = deps.db;
    this.chatService = deps.chatService;
    this.logger = deps.logger;
  }

  async ensureDefaultBots(): Promise<void> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      const existingSystemUser = await client.query<{ id: string }>(
        `SELECT id
         FROM users
         WHERE provider_user_id = $1
         LIMIT 1`,
        [DEFAULT_OPENCLAW_BOT.providerUserId]
      );

      let botUserId = existingSystemUser.rows[0]?.id;
      if (!botUserId) {
        const insertUserResult = await client.query<{ id: string }>(
          `INSERT INTO users (email, password_hash, role, auth_provider, provider_user_id, display_name)
           VALUES ($1, NULL, 'user', 'local', $2, $3)
           ON CONFLICT (email)
           DO NOTHING
           RETURNING id`,
          [DEFAULT_OPENCLAW_BOT.email, DEFAULT_OPENCLAW_BOT.providerUserId, DEFAULT_OPENCLAW_BOT.name]
        );

        botUserId = insertUserResult.rows[0]?.id;
      }

      if (!botUserId) {
        throw new AppError(
          409,
          ErrorCodes.CONFLICT,
          `Cannot reserve default bot email (${DEFAULT_OPENCLAW_BOT.email}).`
        );
      }

      await client.query(
        `INSERT INTO bots (bot_key, name, description, user_id, provider, is_active)
         VALUES ($1, $2, $3, $4, 'openclaw', TRUE)
         ON CONFLICT (bot_key)
         DO UPDATE SET
           name = EXCLUDED.name,
           description = EXCLUDED.description,
           user_id = EXCLUDED.user_id,
           provider = EXCLUDED.provider,
           is_active = TRUE`,
        [DEFAULT_OPENCLAW_BOT.key, DEFAULT_OPENCLAW_BOT.name, DEFAULT_OPENCLAW_BOT.description, botUserId]
      );

      await client.query('COMMIT');
      this.logger.info({ botKey: DEFAULT_OPENCLAW_BOT.key }, 'Default OpenClaw bot ensured');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async listBots(): Promise<BotSummary[]> {
    const result = await this.db.query<BotRow>(
      `SELECT id, bot_key, name, description, provider, user_id, is_active, created_at
       FROM bots
       WHERE is_active = TRUE
       ORDER BY created_at ASC`
    );

    return result.rows.map((row) => this.mapBot(row));
  }

  async createOrGetRoomWithBot(userId: string, botId: string): Promise<BotRoomResult> {
    const bot = await this.getBotById(botId);

    if (!bot.is_active) {
      throw new AppError(409, ErrorCodes.CONFLICT, 'Bot is not active.');
    }

    if (bot.user_id === userId) {
      throw new AppError(409, ErrorCodes.CONFLICT, 'Cannot create bot room with the bot account itself.');
    }

    const room = await this.chatService.createDirectRoom(userId, bot.user_id);

    return {
      bot: this.mapBot(bot),
      room
    };
  }

  private async getBotById(botId: string): Promise<BotRow> {
    const result = await this.db.query<BotRow>(
      `SELECT id, bot_key, name, description, provider, user_id, is_active, created_at
       FROM bots
       WHERE id = $1
       LIMIT 1`,
      [botId]
    );

    const bot = result.rows[0];
    if (!bot) {
      throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, 'Bot not found.');
    }

    return bot;
  }

  private mapBot(row: BotRow): BotSummary {
    return {
      id: row.id,
      botKey: row.bot_key,
      name: row.name,
      provider: row.provider,
      userId: row.user_id,
      isActive: row.is_active,
      createdAt: row.created_at.toISOString(),
      ...(row.description ? { description: row.description } : {})
    };
  }
}
