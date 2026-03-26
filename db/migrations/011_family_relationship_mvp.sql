CREATE TABLE IF NOT EXISTS family_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived')),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE user_relationships
  ADD COLUMN IF NOT EXISTS family_group_id UUID REFERENCES family_groups(id) ON DELETE SET NULL;

ALTER TABLE user_relationships
  ADD COLUMN IF NOT EXISTS label_for_user_a TEXT
    CHECK (label_for_user_a IS NULL OR label_for_user_a IN ('mother', 'father', 'guardian', 'child'));

ALTER TABLE user_relationships
  ADD COLUMN IF NOT EXISTS label_for_user_b TEXT
    CHECK (label_for_user_b IS NULL OR label_for_user_b IN ('mother', 'father', 'guardian', 'child'));

ALTER TABLE user_relationships
  ADD COLUMN IF NOT EXISTS upgraded_from_friendship BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE user_relationships
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;

ALTER TABLE user_relationships
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS family_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_group_id UUID NOT NULL REFERENCES family_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  member_role TEXT NOT NULL
    CHECK (member_role IN ('parent', 'child', 'guardian')),
  display_label TEXT NOT NULL
    CHECK (display_label IN ('mother', 'father', 'guardian', 'child')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'invited', 'removed')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  removed_at TIMESTAMPTZ,
  UNIQUE (family_group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_family_group_members_user_id
  ON family_group_members(user_id);

CREATE INDEX IF NOT EXISTS idx_family_group_members_family_group_id
  ON family_group_members(family_group_id);

CREATE TABLE IF NOT EXISTS family_service_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_group_id UUID NOT NULL REFERENCES family_groups(id) ON DELETE CASCADE,
  actor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  service_key TEXT NOT NULL
    CHECK (service_key IN ('location', 'schedule', 'todo', 'family_calendar')),
  permission_level TEXT NOT NULL
    CHECK (permission_level IN ('none', 'view', 'edit', 'manage')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_family_service_permissions_group_id
  ON family_service_permissions(family_group_id);

CREATE INDEX IF NOT EXISTS idx_family_service_permissions_actor_id
  ON family_service_permissions(actor_user_id);

CREATE INDEX IF NOT EXISTS idx_family_service_permissions_subject_id
  ON family_service_permissions(subject_user_id);

CREATE TABLE IF NOT EXISTS family_upgrade_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_relationship_id UUID REFERENCES user_relationships(id) ON DELETE SET NULL,
  requested_relationship_type TEXT NOT NULL
    CHECK (requested_relationship_type IN ('parent_child')),
  requester_label TEXT NOT NULL
    CHECK (requester_label IN ('mother', 'father', 'guardian', 'child')),
  target_label TEXT NOT NULL
    CHECK (target_label IN ('mother', 'father', 'guardian', 'child')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected', 'canceled', 'expired')),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  CHECK (requester_id <> target_user_id)
);

CREATE INDEX IF NOT EXISTS idx_family_upgrade_requests_requester_id
  ON family_upgrade_requests(requester_id);

CREATE INDEX IF NOT EXISTS idx_family_upgrade_requests_target_id
  ON family_upgrade_requests(target_user_id);

CREATE INDEX IF NOT EXISTS idx_family_upgrade_requests_status_created_at
  ON family_upgrade_requests(status, created_at DESC);
