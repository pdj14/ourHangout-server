import type { RoomDto } from '../social/social.types';

export interface BotSummary {
  id: string;
  botKey: string;
  name: string;
  description?: string;
  provider: 'openclaw';
  userId: string;
  isActive: boolean;
  createdAt: string;
}

export interface BotRoomResult {
  bot: BotSummary;
  room: RoomDto;
}
