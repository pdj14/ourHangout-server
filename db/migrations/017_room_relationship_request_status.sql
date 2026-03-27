DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  FOR constraint_name IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'room_relationships'::regclass
      AND contype = 'c'
  LOOP
    EXECUTE format('ALTER TABLE room_relationships DROP CONSTRAINT %I', constraint_name);
  END LOOP;
END $$;

ALTER TABLE room_relationships
  ADD COLUMN IF NOT EXISTS responded_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE room_relationships
  ADD COLUMN IF NOT EXISTS responded_at TIMESTAMPTZ;

ALTER TABLE room_relationships
  ADD CONSTRAINT room_relationships_type_check
  CHECK (relationship_type IN ('guardian_child'));

ALTER TABLE room_relationships
  ADD CONSTRAINT room_relationships_status_check
  CHECK (status IN ('pending', 'active', 'rejected', 'removed'));

ALTER TABLE room_relationships
  ADD CONSTRAINT room_relationships_guardian_child_distinct_check
  CHECK (guardian_user_id <> child_user_id);
