import type { RoomDto } from '../social/social.types';

export interface PobiSummary {
  id: string;
  name: string;
  theme: string;
  botId: string;
  botKey: string;
  botUserId: string;
  status?: string;
  avatarUri?: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PobiRoomResult {
  pobi: PobiSummary;
  room: RoomDto;
}

export interface PobiOpenClawInfo {
  pobi: PobiSummary;
  openclaw: {
    mode: 'mock' | 'http' | 'connector';
    botKey: string;
    wsUrl: string;
    connected: boolean;
    matchedConnectors: Array<{
      connectorId: string;
      wildcard: boolean;
      botKeys: string[];
      lastSeenAt: string;
    }>;
    sampleEnv: {
      HUB_WS_URL: string;
      CONNECTOR_ID: string;
      CONNECTOR_BOT_KEYS: string;
      CONNECTOR_MODE: 'http' | 'mock';
      OPENCLAW_LOCAL_BASE_URL: string;
    };
  };
}
