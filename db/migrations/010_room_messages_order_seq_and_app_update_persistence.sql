DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_class
    WHERE relkind = 'S'
      AND relname = 'room_messages_order_seq_seq'
  ) THEN
    CREATE SEQUENCE room_messages_order_seq_seq;
  END IF;
END $$;

ALTER TABLE room_messages
  ADD COLUMN IF NOT EXISTS order_seq BIGINT;

WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) AS next_order_seq
  FROM room_messages
  WHERE order_seq IS NULL
)
UPDATE room_messages rm
SET order_seq = ordered.next_order_seq
FROM ordered
WHERE rm.id = ordered.id;

ALTER TABLE room_messages
  ALTER COLUMN order_seq SET DEFAULT nextval('room_messages_order_seq_seq');

DO $$
DECLARE
  max_order_seq BIGINT;
BEGIN
  SELECT COALESCE(MAX(order_seq), 0) INTO max_order_seq FROM room_messages;

  IF max_order_seq = 0 THEN
    PERFORM setval('room_messages_order_seq_seq', 1, false);
  ELSE
    PERFORM setval('room_messages_order_seq_seq', max_order_seq, true);
  END IF;
END $$;

ALTER TABLE room_messages
  ALTER COLUMN order_seq SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_room_messages_order_seq_unique
  ON room_messages(order_seq);

CREATE INDEX IF NOT EXISTS idx_room_messages_room_id_created_at_order_seq
  ON room_messages(room_id, created_at DESC, order_seq DESC);
