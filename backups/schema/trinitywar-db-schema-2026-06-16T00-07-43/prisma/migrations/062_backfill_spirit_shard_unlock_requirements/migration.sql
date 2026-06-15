ALTER TABLE "spirit_definition"
DROP CONSTRAINT IF EXISTS "spirit_definition_shard_unlock_required_check";

ALTER TABLE "player_spirit_codex"
DROP CONSTRAINT IF EXISTS "player_spirit_codex_ready_check";

UPDATE "spirit_definition"
SET "shard_unlock_required" = CASE "rarity"
  WHEN 'COMMON' THEN 20
  WHEN 'RARE' THEN 60
  ELSE 100
END;

UPDATE "player_spirit_codex" psc
SET
  "ready_to_compose" = true,
  "ready_at" = COALESCE(psc."ready_at", CURRENT_TIMESTAMP)
FROM "spirit_definition" sd
WHERE psc."spirit_definition_id" = sd."id"
  AND psc."shard_count" >= CASE sd."rarity"
    WHEN 'COMMON' THEN 20
    WHEN 'RARE' THEN 60
    ELSE 100
  END;

UPDATE "player_spirit_codex" psc
SET
  "ready_to_compose" = false,
  "ready_at" = NULL
FROM "spirit_definition" sd
WHERE psc."spirit_definition_id" = sd."id"
  AND psc."shard_count" < CASE sd."rarity"
    WHEN 'COMMON' THEN 20
    WHEN 'RARE' THEN 60
    ELSE 100
  END;
