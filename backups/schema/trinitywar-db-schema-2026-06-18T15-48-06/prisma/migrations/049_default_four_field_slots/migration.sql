INSERT INTO "player_field_slot" (
  "id",
  "player_id",
  "slot_index",
  "is_unlocked",
  "unlock_castle_level",
  "status",
  "created_at",
  "updated_at"
)
SELECT
  CONCAT('field_', p."id", '_', slots."slot_index"),
  p."id",
  slots."slot_index",
  TRUE,
  1,
  'EMPTY',
  NOW(),
  NOW()
FROM "player" p
CROSS JOIN (VALUES (1), (2), (3), (4)) AS slots("slot_index")
ON CONFLICT ("player_id", "slot_index") DO NOTHING;

UPDATE "player_field_slot"
SET
  "is_unlocked" = TRUE,
  "unlock_castle_level" = 1,
  "status" = CASE WHEN "status" = 'LOCKED' THEN 'EMPTY' ELSE "status" END,
  "status_version" = "status_version" + 1,
  "updated_at" = NOW()
WHERE "slot_index" BETWEEN 1 AND 4
  AND (
    "is_unlocked" = FALSE
    OR "unlock_castle_level" <> 1
    OR "status" = 'LOCKED'
  );

UPDATE "player_building"
SET
  "field_slot_level" = 4,
  "building_version" = "building_version" + 1,
  "updated_at" = NOW()
WHERE "field_slot_level" < 4;

UPDATE "player_land_deed_progress"
SET
  "status" = 'claimed',
  "claimed_at" = COALESCE("claimed_at", NOW()),
  "updated_at" = NOW()
WHERE "deed_key" IN ('field-2', 'field-3', 'field-4')
  AND "status" <> 'claimed';
