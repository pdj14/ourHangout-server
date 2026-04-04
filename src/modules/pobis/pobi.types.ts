import type { RoomDto } from '../social/social.types';

export interface PobiSummary {
  id: string;
  name: string;
  theme: string;
  botId: string;
  botKey: string;
  botUserId: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PobiRoomResult {
  pobi: PobiSummary;
  room: RoomDto;
}
