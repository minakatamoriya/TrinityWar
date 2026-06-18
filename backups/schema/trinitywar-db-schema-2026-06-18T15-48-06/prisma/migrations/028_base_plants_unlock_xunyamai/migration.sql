INSERT INTO "player_seed_inventory" (
  "id",
  "player_id",
  "seed_definition_id",
  "quantity",
  "inventory_version",
  "unlocked_at",
  "created_at",
  "updated_at"
)
SELECT
  'base_plant_' || p."id" || '_' || sd."seed_id",
  p."id",
  sd."id",
  0,
  1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "player" p
CROSS JOIN "seed_definition" sd
WHERE sd."seed_id" IN ('qinglingmai', 'xunyamai')
ON CONFLICT ("player_id", "seed_definition_id")
DO UPDATE SET
  "unlocked_at" = COALESCE("player_seed_inventory"."unlocked_at", CURRENT_TIMESTAMP),
  "inventory_version" = "player_seed_inventory"."inventory_version" + 1,
  "updated_at" = CURRENT_TIMESTAMP;

INSERT INTO "player_plant_research" (
  "id",
  "player_id",
  "seed_definition_id",
  "discovered_at",
  "research_version",
  "created_at",
  "updated_at"
)
SELECT
  'base_research_' || p."id" || '_' || sd."seed_id",
  p."id",
  sd."id",
  CURRENT_TIMESTAMP,
  1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "player" p
CROSS JOIN "seed_definition" sd
WHERE sd."seed_id" IN ('qinglingmai', 'xunyamai')
ON CONFLICT ("player_id", "seed_definition_id") DO NOTHING;
