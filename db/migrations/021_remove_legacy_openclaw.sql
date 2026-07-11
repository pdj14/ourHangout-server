-- Retire the legacy OpenClaw-only bot model without rewriting already-applied migrations.
-- Rooms containing a legacy bot are removed first so users do not retain unusable chats.
DELETE FROM rooms
WHERE id IN (
  SELECT DISTINCT rm.room_id
  FROM room_members rm
  INNER JOIN bots b ON b.user_id = rm.user_id
);

-- Legacy direct-chat rows cascade through chat_rooms when the bot user is deleted.
DELETE FROM users
WHERE id IN (
  SELECT user_id
  FROM bots
);

DROP TABLE IF EXISTS bots;

ALTER TABLE messages
  DROP COLUMN IF EXISTS claw_message_id;
