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
    connected: boolean;
    status: 'connected' | 'pairing_pending' | 'not_connected';
    deviceName?: string;
    lastSeenAt?: string;
    pairingCode?: string;
    pairingExpiresAt?: string;
    matchedConnectors: Array<{
      connectorId: string;
      wildcard: boolean;
      botKeys: string[];
      lastSeenAt: string;
    }>;
  };
}

export interface PobiOpenClawPairingResult {
  pairingCode: string;
  expiresAt: string;
  pobi: PobiSummary;
}
