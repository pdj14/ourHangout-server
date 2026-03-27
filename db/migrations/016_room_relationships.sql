CREATE TABLE IF NOT EXISTS room_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  guardian_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  child_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL
    CHECK (relationship_type IN ('guardian_child')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'removed')),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (guardian_user_id <> child_user_id),
  UNIQUE (room_id, guardian_user_id, child_user_id, relationship_type)
);

CREATE INDEX IF NOT EXISTS idx_room_relationships_room_id
  ON room_relationships(room_id);

CREATE INDEX IF NOT EXISTS idx_room_relationships_guardian_user_id
  ON room_relationships(guardian_user_id);

CREATE INDEX IF NOT EXISTS idx_room_relationships_child_user_id
  ON room_relationships(child_user_id);
