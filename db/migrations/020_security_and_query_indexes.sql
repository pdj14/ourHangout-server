-- Invalidate reusable plaintext relationship pairing codes before switching to hashes.
DELETE FROM pairing_codes;

ALTER TABLE pairing_codes
  ADD COLUMN IF NOT EXISTS code_hash TEXT;

ALTER TABLE pairing_codes
  ALTER COLUMN code DROP NOT NULL;

ALTER TABLE pairing_codes
  ALTER COLUMN code_hash SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pairing_codes_code_hash
  ON pairing_codes(code_hash);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pairing_codes_pending_creator
  ON pairing_codes(created_by)
  WHERE consumed_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower_unique
  ON users(lower(email));

CREATE INDEX IF NOT EXISTS idx_friend_requests_target_pending_created
  ON friend_requests(target_id, created_at DESC)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_friend_requests_requester_pending_created
  ON friend_requests(requester_id, created_at DESC)
  WHERE status = 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS idx_friend_requests_pending_pair_unique
  ON friend_requests(LEAST(requester_id, target_id), GREATEST(requester_id, target_id))
  WHERE status = 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS idx_family_upgrade_requests_pending_pair_unique
  ON family_upgrade_requests(
    LEAST(requester_id, target_user_id),
    GREATEST(requester_id, target_user_id),
    requested_relationship_type
  )
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_room_members_user_active
  ON room_members(user_id, room_id)
  WHERE left_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_room_messages_sender
  ON room_messages(sender_id)
  WHERE sender_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_room_messages_room_order_seq
  ON room_messages(room_id, order_seq DESC);

CREATE INDEX IF NOT EXISTS idx_room_messages_media_url
  ON room_messages(media_url)
  WHERE media_url IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rooms_active_updated
  ON rooms(updated_at DESC, id DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_media_assets_owner_status_updated
  ON media_assets(owner_user_id, status, updated_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_reports_status_created
  ON reports(status, created_at DESC, id DESC);
