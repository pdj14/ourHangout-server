export interface ClawProviderInput {
  messageId: string;
  roomId: string;
  senderId: string;
  recipientId: string;
  botKey?: string;
  content: string;
}

export interface ClawProviderResult {
  providerMessageId?: string;
  replyText?: string;
  raw?: unknown;
}

export interface ClawPingResult {
  ok: boolean;
  details?: string;
}

export interface ClawProvider {
  readonly name: string;
  sendMessage(input: ClawProviderInput): Promise<ClawProviderResult>;
  ping(): Promise<ClawPingResult>;
}
