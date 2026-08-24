CREATE TABLE IF NOT EXISTS guardian_conversation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  relationship_id UUID NOT NULL REFERENCES room_relationships(id) ON DELETE CASCADE,
  client_log_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  message_count INTEGER NOT NULL DEFAULT 0 CHECK (message_count >= 0),
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (child_user_id, client_log_id)
);

CREATE INDEX IF NOT EXISTS idx_guardian_logs_child_synced_at
  ON guardian_conversation_logs(child_user_id, synced_at DESC);

CREATE INDEX IF NOT EXISTS idx_guardian_logs_room_id
  ON guardian_conversation_logs(room_id);

CREATE INDEX IF NOT EXISTS idx_guardian_logs_relationship_id
  ON guardian_conversation_logs(relationship_id);

CREATE INDEX IF NOT EXISTS idx_guardian_logs_messages_gin
  ON guardian_conversation_logs USING gin(messages);
