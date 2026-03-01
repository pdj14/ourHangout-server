DROP INDEX IF EXISTS idx_users_provider_unique;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_provider_user_id_unique
  ON users(provider_user_id)
  WHERE provider_user_id IS NOT NULL;
