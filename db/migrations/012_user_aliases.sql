CREATE TABLE IF NOT EXISTS user_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (owner_user_id <> target_user_id),
  CHECK (char_length(btrim(alias)) BETWEEN 1 AND 100),
  UNIQUE (owner_user_id, target_user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_aliases_owner_user_id
  ON user_aliases(owner_user_id);

CREATE INDEX IF NOT EXISTS idx_user_aliases_target_user_id
  ON user_aliases(target_user_id);
