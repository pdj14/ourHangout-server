CREATE TABLE IF NOT EXISTS openclaw_connectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  connector_key TEXT NOT NULL UNIQUE,
  device_name TEXT,
  platform TEXT NOT NULL DEFAULT 'linux',
  status TEXT NOT NULL DEFAULT 'offline'
    CHECK (status IN ('pending', 'online', 'offline', 'revoked')),
  auth_token_hash TEXT NOT NULL UNIQUE,
  connected_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_openclaw_connectors_owner_user_id
  ON openclaw_connectors(owner_user_id);

CREATE TABLE IF NOT EXISTS openclaw_connector_pairings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pobi_id UUID NOT NULL REFERENCES pobis(id) ON DELETE CASCADE,
  pairing_code TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  connector_id UUID REFERENCES openclaw_connectors(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_openclaw_connector_pairings_owner_user_id
  ON openclaw_connector_pairings(owner_user_id);

CREATE INDEX IF NOT EXISTS idx_openclaw_connector_pairings_pobi_id
  ON openclaw_connector_pairings(pobi_id);

CREATE TABLE IF NOT EXISTS openclaw_connector_pobis (
  connector_id UUID NOT NULL REFERENCES openclaw_connectors(id) ON DELETE CASCADE,
  pobi_id UUID NOT NULL UNIQUE REFERENCES pobis(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (connector_id, pobi_id)
);
