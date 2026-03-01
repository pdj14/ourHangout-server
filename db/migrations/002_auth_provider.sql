ALTER TABLE users
  ALTER COLUMN password_hash DROP NOT NULL;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS auth_provider TEXT NOT NULL DEFAULT 'local'
    CHECK (auth_provider IN ('local', 'google'));

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS provider_user_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_provider_unique
  ON users(auth_provider, provider_user_id)
  WHERE provider_user_id IS NOT NULL;
