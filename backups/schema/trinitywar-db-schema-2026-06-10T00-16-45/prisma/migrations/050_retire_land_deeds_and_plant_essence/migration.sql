UPDATE "player_field_slot"
SET
  "expected_essence_yield" = 0,
  "stolen_essence_yield" = 0,
  "harvested_essence_yield" = 0,
  "updated_at" = NOW()
WHERE
  "expected_essence_yield" <> 0
  OR "stolen_essence_yield" <> 0
  OR "harvested_essence_yield" <> 0;

INSERT INTO "player_seed_inventory" (
  "id",
  "player_id",
  "seed_definition_id",
  "quantity",
  "unlocked_at",
  "created_at",
  "updated_at"
)
SELECT
  CONCAT('seed_unlock_', p."id", '_', sd."seed_id"),
  p."id",
  sd."id",
  0,
  NOW(),
  NOW(),
  NOW()
FROM "player" p
CROSS JOIN "seed_definition" sd
WHERE sd."seed_id" IN ('qilingya', 'qinglingmai', 'xunyamai')
ON CONFLICT ("player_id", "seed_definition_id") DO UPDATE
SET
  "unlocked_at" = COALESCE("player_seed_inventory"."unlocked_at", EXCLUDED."unlocked_at"),
  "updated_at" = NOW(),
  "inventory_version" = CASE
    WHEN "player_seed_inventory"."unlocked_at" IS NULL THEN "player_seed_inventory"."inventory_version" + 1
    ELSE "player_seed_inventory"."inventory_version"
  END;

DELETE FROM "player_land_deed_progress";
