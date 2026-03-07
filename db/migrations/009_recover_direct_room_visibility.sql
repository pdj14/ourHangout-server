INSERT INTO room_user_settings (room_id, user_id, favorite, muted, hidden_at, created_at, updated_at)
SELECT rm.room_id,
       rm.user_id,
       FALSE,
       FALSE,
       rm.left_at,
       NOW(),
       NOW()
FROM room_members rm
INNER JOIN rooms r ON r.id = rm.room_id
WHERE r.type = 'direct'
  AND rm.left_at IS NOT NULL
ON CONFLICT (room_id, user_id)
DO UPDATE SET
  hidden_at = COALESCE(room_user_settings.hidden_at, EXCLUDED.hidden_at),
  updated_at = NOW();

UPDATE room_members rm
SET left_at = NULL
FROM rooms r
WHERE r.id = rm.room_id
  AND r.type = 'direct'
  AND rm.left_at IS NOT NULL;
