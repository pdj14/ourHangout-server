-- Backfill existing active family groups into family rooms.
-- This migration copies active family-group data into the new room-based model.
-- Legacy tables remain as-is for compatibility during cutover.

WITH groups_to_backfill AS (
  SELECT fg.id AS family_group_id,
         gen_random_uuid() AS room_id,
         COALESCE(
           NULLIF(btrim(fg.name), ''),
           'Family'
         ) AS room_title,
         COALESCE(
           fg.created_by,
           active_member.user_id,
           any_member.user_id,
           rel.user_a_id,
           rel.user_b_id
         ) AS created_by,
         fg.created_at,
         fg.updated_at
  FROM family_groups fg
  LEFT JOIN legacy_family_group_room_map existing_map
         ON existing_map.family_group_id = fg.id
  LEFT JOIN LATERAL (
    SELECT fgm.user_id
    FROM family_group_members fgm
    WHERE fgm.family_group_id = fg.id
      AND fgm.status = 'active'
    ORDER BY fgm.joined_at ASC, fgm.user_id ASC
    LIMIT 1
  ) AS active_member ON TRUE
  LEFT JOIN LATERAL (
    SELECT fgm.user_id
    FROM family_group_members fgm
    WHERE fgm.family_group_id = fg.id
    ORDER BY fgm.joined_at ASC, fgm.user_id ASC
    LIMIT 1
  ) AS any_member ON TRUE
  LEFT JOIN LATERAL (
    SELECT ur.user_a_id, ur.user_b_id
    FROM user_relationships ur
    WHERE ur.family_group_id = fg.id
      AND ur.relationship_type = 'parent_child'
    ORDER BY ur.created_at ASC, ur.id ASC
    LIMIT 1
  ) AS rel ON TRUE
  WHERE fg.status = 'active'
    AND existing_map.family_group_id IS NULL
),
inserted_rooms AS (
  INSERT INTO rooms (id, type, direct_key, title, created_by, created_at, updated_at, deleted_at)
  SELECT backfill.room_id,
         'family',
         NULL,
         backfill.room_title,
         backfill.created_by,
         COALESCE(backfill.created_at, NOW()),
         COALESCE(backfill.updated_at, NOW()),
         NULL
  FROM groups_to_backfill backfill
  WHERE backfill.created_by IS NOT NULL
  RETURNING id
)
INSERT INTO legacy_family_group_room_map (family_group_id, room_id, created_at)
SELECT backfill.family_group_id,
       backfill.room_id,
       NOW()
FROM groups_to_backfill backfill
INNER JOIN inserted_rooms ir ON ir.id = backfill.room_id;

INSERT INTO room_members (room_id, user_id, role, joined_at, left_at)
SELECT map.room_id,
       fgm.user_id,
       CASE
         WHEN fgm.member_role IN ('parent', 'guardian') THEN 'admin'
         ELSE 'member'
       END AS role,
       COALESCE(fgm.joined_at, NOW()),
       NULL
FROM family_group_members fgm
INNER JOIN legacy_family_group_room_map map
        ON map.family_group_id = fgm.family_group_id
INNER JOIN rooms r
        ON r.id = map.room_id
       AND r.type = 'family'
WHERE fgm.status = 'active'
ON CONFLICT (room_id, user_id)
DO UPDATE SET
  role = EXCLUDED.role,
  left_at = NULL;

INSERT INTO room_user_settings (room_id, user_id, favorite, muted, created_at, updated_at)
SELECT map.room_id,
       fgm.user_id,
       FALSE,
       FALSE,
       NOW(),
       NOW()
FROM family_group_members fgm
INNER JOIN legacy_family_group_room_map map
        ON map.family_group_id = fgm.family_group_id
INNER JOIN rooms r
        ON r.id = map.room_id
       AND r.type = 'family'
WHERE fgm.status = 'active'
ON CONFLICT (room_id, user_id) DO NOTHING;

INSERT INTO room_member_profiles (
  room_id,
  user_id,
  alias,
  role_label,
  membership_kind,
  created_at,
  updated_at
)
SELECT map.room_id,
       fgm.user_id,
       NULLIF(btrim(fgm.custom_label), ''),
       fgm.display_label,
       CASE
         WHEN fgm.member_role = 'child' THEN 'child'
         WHEN fgm.member_role = 'guardian' THEN 'guardian'
         ELSE 'adult'
       END AS membership_kind,
       NOW(),
       NOW()
FROM family_group_members fgm
INNER JOIN legacy_family_group_room_map map
        ON map.family_group_id = fgm.family_group_id
INNER JOIN rooms r
        ON r.id = map.room_id
       AND r.type = 'family'
WHERE fgm.status = 'active'
ON CONFLICT (room_id, user_id)
DO UPDATE SET
  alias = EXCLUDED.alias,
  role_label = EXCLUDED.role_label,
  membership_kind = EXCLUDED.membership_kind,
  updated_at = NOW();

INSERT INTO room_features (room_id, feature_key, enabled, created_at, updated_at)
SELECT DISTINCT map.room_id,
       fsp.service_key,
       TRUE,
       NOW(),
       NOW()
FROM family_service_permissions fsp
INNER JOIN legacy_family_group_room_map map
        ON map.family_group_id = fsp.family_group_id
INNER JOIN rooms r
        ON r.id = map.room_id
       AND r.type = 'family'
ON CONFLICT (room_id, feature_key)
DO UPDATE SET
  enabled = TRUE,
  updated_at = NOW();

INSERT INTO room_member_permissions (
  room_id,
  actor_user_id,
  subject_user_id,
  permission_key,
  permission_level,
  created_at,
  updated_at
)
SELECT map.room_id,
       fsp.actor_user_id,
       fsp.subject_user_id,
       fsp.service_key,
       fsp.permission_level,
       COALESCE(fsp.created_at, NOW()),
       COALESCE(fsp.updated_at, NOW())
FROM family_service_permissions fsp
INNER JOIN legacy_family_group_room_map map
        ON map.family_group_id = fsp.family_group_id
INNER JOIN rooms r
        ON r.id = map.room_id
       AND r.type = 'family'
ON CONFLICT DO NOTHING;
