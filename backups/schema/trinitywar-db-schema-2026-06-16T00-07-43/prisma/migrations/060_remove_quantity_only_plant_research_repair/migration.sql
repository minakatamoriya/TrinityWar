DELETE FROM "player_plant_research" ppr
USING "player_seed_inventory" psi, "seed_definition" sd
WHERE ppr."id" LIKE 'plant_research_repair_%'
  AND psi."player_id" = ppr."player_id"
  AND psi."seed_definition_id" = ppr."seed_definition_id"
  AND sd."id" = ppr."seed_definition_id"
  AND psi."unlocked_at" IS NULL
  AND sd."seed_id" NOT IN ('qilingya', 'qinglingmai', 'xunyamai');
