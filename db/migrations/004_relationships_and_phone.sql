ALTER TABLE pairing_codes
  ADD COLUMN IF NOT EXISTS relationship_type TEXT NOT NULL DEFAULT 'friend'
    CHECK (relationship_type IN ('friend', 'parent_child'));

CREATE TABLE IF NOT EXISTS user_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pair_key TEXT NOT NULL,
  user_a_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL CHECK (relationship_type IN ('friend', 'parent_child')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'blocked', 'deleted')),
  created_via TEXT NOT NULL DEFAULT 'pairing' CHECK (created_via IN ('pairing', 'contact', 'manual')),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (user_a_id <> user_b_id),
  UNIQUE (pair_key, relationship_type)
);

CREATE INDEX IF NOT EXISTS idx_user_relationships_user_a_id
  ON user_relationships(user_a_id);

CREATE INDEX IF NOT EXISTS idx_user_relationships_user_b_id
  ON user_relationships(user_b_id);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone_e164 TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone_e164_unique
  ON users(phone_e164)
  WHERE phone_e164 IS NOT NULL;
