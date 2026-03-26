-- Foundation schema for moving family UX onto rooms.
-- This migration is intentionally add-only for new tables.
-- Data backfill and read/write cutover should happen in later steps.

DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  -- Rebuild room type/direct_key checks so rooms.type can include 'family'.
  FOR constraint_name IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'rooms'::regclass
      AND contype = 'c'
  LOOP
    EXECUTE format('ALTER TABLE rooms DROP CONSTRAINT %I', constraint_name);
  END LOOP;
END $$;

ALTER TABLE rooms
  ADD CONSTRAINT rooms_type_check
  CHECK (type IN ('direct', 'group', 'family'));

ALTER TABLE rooms
  ADD CONSTRAINT rooms_direct_key_shape_check
  CHECK (
    (type = 'direct' AND direct_key IS NOT NULL) OR
    (type IN ('group', 'family') AND direct_key IS NULL)
  );

CREATE INDEX IF NOT EXISTS idx_rooms_type_updated_at
  ON rooms(type, updated_at DESC);

CREATE TABLE IF NOT EXISTS room_member_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  alias TEXT,
  role_label TEXT
    CHECK (role_label IS NULL OR role_label IN ('mother', 'father', 'guardian', 'child', 'adult', 'member')),
  membership_kind TEXT
    CHECK (membership_kind IS NULL OR membership_kind IN ('adult', 'child', 'guardian')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (alias IS NULL OR length(btrim(alias)) > 0),
  UNIQUE (room_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_room_member_profiles_room_id
  ON room_member_profiles(room_id);

CREATE INDEX IF NOT EXISTS idx_room_member_profiles_user_id
  ON room_member_profiles(user_id);

CREATE TABLE IF NOT EXISTS room_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL
    CHECK (feature_key IN ('location', 'schedule', 'todo', 'family_calendar')),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (room_id, feature_key)
);

CREATE INDEX IF NOT EXISTS idx_room_features_room_id
  ON room_features(room_id);

CREATE TABLE IF NOT EXISTS room_member_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  actor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL
    CHECK (permission_key IN ('location', 'schedule', 'todo', 'family_calendar')),
  permission_level TEXT NOT NULL
    CHECK (permission_level IN ('none', 'view', 'edit', 'manage')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_room_member_permissions_room_id
  ON room_member_permissions(room_id);

CREATE INDEX IF NOT EXISTS idx_room_member_permissions_actor_id
  ON room_member_permissions(actor_user_id);

CREATE INDEX IF NOT EXISTS idx_room_member_permissions_subject_id
  ON room_member_permissions(subject_user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_room_member_permissions_subject_unique
  ON room_member_permissions(room_id, actor_user_id, subject_user_id, permission_key)
  WHERE subject_user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_room_member_permissions_group_unique
  ON room_member_permissions(room_id, actor_user_id, permission_key)
  WHERE subject_user_id IS NULL;

CREATE TABLE IF NOT EXISTS family_room_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  inviter_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected', 'canceled', 'expired')),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  CHECK (inviter_user_id <> target_user_id)
);

CREATE INDEX IF NOT EXISTS idx_family_room_invitations_room_id
  ON family_room_invitations(room_id);

CREATE INDEX IF NOT EXISTS idx_family_room_invitations_inviter_id
  ON family_room_invitations(inviter_user_id);

CREATE INDEX IF NOT EXISTS idx_family_room_invitations_target_id
  ON family_room_invitations(target_user_id);

CREATE INDEX IF NOT EXISTS idx_family_room_invitations_status_created_at
  ON family_room_invitations(status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_family_room_invitations_pending_unique
  ON family_room_invitations(room_id, target_user_id)
  WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS legacy_family_group_room_map (
  family_group_id UUID PRIMARY KEY REFERENCES family_groups(id) ON DELETE CASCADE,
  room_id UUID NOT NULL UNIQUE REFERENCES rooms(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_legacy_family_group_room_map_room_id
  ON legacy_family_group_room_map(room_id);
