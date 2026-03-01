export type AckStatus = 'sent' | 'delivered';
export type MessageDirection = 'outbound' | 'inbound';

export interface ChatRoom {
  id: string;
  userAId: string;
  userBId: string;
  createdAt: string;
}

export interface ChatRoomSummary extends ChatRoom {
  peerUserId: string;
  lastMessage?: {
    content: string;
    ackStatus: AckStatus;
    createdAt: string;
  };
}

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  recipientId: string;
  content: string;
  direction: MessageDirection;
  ackStatus: AckStatus;
  clawMessageId?: string;
  createdAt: string;
  deliveredAt?: string;
}

export interface ChatEventMessageNew {
  type: 'message.new';
  targetUserId: string;
  message: ChatMessage;
}

export interface ChatEventMessageAck {
  type: 'message.ack';
  targetUserId: string;
  data: {
    messageId: string;
    roomId: string;
    ackStatus: AckStatus;
    updatedAt: string;
  };
}

export type ChatEvent = ChatEventMessageNew | ChatEventMessageAck;
