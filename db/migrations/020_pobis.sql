CREATE TABLE IF NOT EXISTS pobis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bot_id UUID NOT NULL UNIQUE REFERENCES bots(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  theme TEXT NOT NULL DEFAULT 'seed',
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pobis_owner_user_id
  ON pobis(owner_user_id);

CREATE INDEX IF NOT EXISTS idx_pobis_is_active
  ON pobis(is_active);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pobis_owner_default_unique
  ON pobis(owner_user_id)
  WHERE is_default = TRUE AND is_active = TRUE;
