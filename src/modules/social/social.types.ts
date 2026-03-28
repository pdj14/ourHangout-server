export type MessageKind = 'text' | 'image' | 'video' | 'system';
export type MessageDelivery = 'sent' | 'delivered' | 'read';
export type RoomType = 'direct' | 'group' | 'family';

export interface UserProfileDto {
  id: string;
  name: string;
  status?: string;
  email: string;
  avatarUri?: string;
  locale?: string;
  locationSharingEnabled?: boolean;
}

export interface FriendDto {
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
}

export interface RoomDto {
  id: string;
  type: RoomType;
  title: string;
  members: string[];
  ownerUserId: string;
  isGroup: boolean;
  favorite: boolean;
  muted: boolean;
  unread: number;
  preview?: string;
  updatedAt: string;
}

export interface RoomMemberDto {
  userId: string;
  name: string;
  avatarUri?: string;
  alias?: string;
  role: 'admin' | 'member';
  isOwner: boolean;
}

export interface RoomMemberListDto {
  roomId: string;
  ownerUserId: string;
  myRole: 'admin' | 'member';
  canTransferOwnership: boolean;
  canManageAdmins: boolean;
  canKickMembers: boolean;
  items: RoomMemberDto[];
}

export interface RoomInvitationDto {
  id: string;
  roomId: string;
  roomType: RoomType;
  roomTitle: string;
  inviterUserId: string;
  inviterName: string;
  inviterAvatarUri?: string;
  targetUserId: string;
  targetName: string;
  status: 'pending' | 'accepted' | 'rejected' | 'canceled' | 'expired';
  createdAt: string;
}

export interface RoomInvitationListDto {
  incoming: RoomInvitationDto[];
  outgoing: RoomInvitationDto[];
}

export interface UserLocationDto {
  userId: string;
  latitude: number;
  longitude: number;
  accuracyM?: number;
  capturedAt: string;
  source: 'heartbeat' | 'precision_refresh' | 'manual_refresh';
}

export interface UserLocationRefreshRequestDto {
  pending: boolean;
  requestId?: string;
  requestedAt?: string;
  expiresAt?: string;
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

export interface FamilyRoomMemberProfileDto {
  userId: string;
  name: string;
  avatarUri?: string;
  alias?: string;
  locationSharingEnabled?: boolean;
}

export interface FamilyRoomRelationshipDto {
  id: string;
  guardianUserId: string;
  guardianName: string;
  childUserId: string;
  childName: string;
  createdAt: string;
}

export interface FamilyRoomRelationshipRequestDto {
  id: string;
  guardianUserId: string;
  guardianName: string;
  childUserId: string;
  childName: string;
  requestedByUserId?: string;
  requestedByName?: string;
  createdAt: string;
}
