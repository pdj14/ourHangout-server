ALTER TABLE room_user_settings
  ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_room_user_settings_hidden_at
  ON room_user_settings(hidden_at);
