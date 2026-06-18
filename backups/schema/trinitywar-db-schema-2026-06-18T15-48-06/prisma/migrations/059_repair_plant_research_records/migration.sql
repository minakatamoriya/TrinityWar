DELETE FROM "player_plant_research" pr
USING (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "player_id", "seed_definition_id"
      ORDER BY "discovered_at", "created_at", "id"
    ) AS row_number
  FROM "player_plant_research"
) ranked
WHERE pr."id" = ranked."id"
  AND ranked.row_number > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "player_plant_research_player_id_seed_definition_id_key"
ON "player_plant_research"("player_id", "seed_definition_id");

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
  CONCAT('plant_research_repair_', psi."id"),
  psi."player_id",
  psi."seed_definition_id",
  COALESCE(psi."unlocked_at", psi."created_at", CURRENT_TIMESTAMP),
  1,
  COALESCE(psi."created_at", CURRENT_TIMESTAMP),
  CURRENT_TIMESTAMP
FROM "player_seed_inventory" psi
WHERE psi."quantity" > 0 OR psi."unlocked_at" IS NOT NULL
ON CONFLICT ("player_id", "seed_definition_id") DO NOTHING;

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
  CONCAT('base_plant_research_repair_', p."id", '_', sd."seed_id"),
  p."id",
  sd."id",
  CURRENT_TIMESTAMP,
  1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "player" p
CROSS JOIN "seed_definition" sd
WHERE sd."seed_id" IN ('qilingya', 'qinglingmai', 'xunyamai')
ON CONFLICT ("player_id", "seed_definition_id") DO NOTHING;
