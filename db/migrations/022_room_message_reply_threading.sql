ALTER TABLE room_messages
  ADD COLUMN IF NOT EXISTS reply_to_message_id UUID REFERENCES room_messages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_room_messages_reply_to_message_id
  ON room_messages(reply_to_message_id);
