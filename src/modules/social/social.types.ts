export type MessageKind = 'text' | 'image' | 'video' | 'system';
export type MessageDelivery = 'sent' | 'delivered' | 'read';
export type RoomType = 'direct' | 'group';

export interface UserProfileDto {
  id: string;
  name: string;
  status?: string;
  email: string;
  avatarUri?: string;
  locale?: string;
}

export interface FriendDto {
  id: string;
  name: string;
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
}

export interface RoomDto {
  id: string;
  title: string;
  members: string[];
  isGroup: boolean;
  favorite: boolean;
  muted: boolean;
  unread: number;
  preview?: string;
  updatedAt: string;
}

export interface RoomMessageDto {
  id: string;
  roomId: string;
  senderId?: string;
  senderName: string;
  kind: MessageKind;
  text?: string;
  uri?: string;
  at: string;
  delivery: MessageDelivery;
  unreadCount?: number;
  readByNames?: string[];
}
