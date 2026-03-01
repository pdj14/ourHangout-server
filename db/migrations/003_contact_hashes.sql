CREATE TABLE IF NOT EXISTS contact_hashes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_type TEXT NOT NULL CHECK (contact_type IN ('email', 'phone')),
  contact_hash TEXT NOT NULL,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (owner_user_id, contact_type, contact_hash)
);

CREATE INDEX IF NOT EXISTS idx_contact_hashes_owner_user_id
  ON contact_hashes(owner_user_id);

CREATE INDEX IF NOT EXISTS idx_contact_hashes_type_hash
  ON contact_hashes(contact_type, contact_hash);