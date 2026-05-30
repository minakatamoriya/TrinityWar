UPDATE "player_spirit_codex" psc
SET
  "shard_count" = 0,
  "ready_to_compose" = false,
  "ready_at" = NULL,
  "codex_version" = "codex_version" + 1,
  "updated_at" = CURRENT_TIMESTAMP
FROM "spirit_definition" sd
WHERE psc."spirit_definition_id" = sd."id"
  AND sd."spirit_id" IN ('canglang', 'linglu', 'qingyuan')
  AND psc."owned_current" = false
  AND psc."owned_ever" = false
  AND psc."ready_to_compose" = true
  AND psc."shard_count" = sd."shard_unlock_required"
  AND EXISTS (
    SELECT 1
    FROM "player_spirit_codex" owned_psc
    JOIN "spirit_definition" owned_sd
      ON owned_psc."spirit_definition_id" = owned_sd."id"
    WHERE owned_psc."player_id" = psc."player_id"
      AND owned_psc."owned_current" = true
      AND owned_sd."spirit_id" IN ('canglang', 'linglu', 'qingyuan')
  );
