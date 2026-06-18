DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.player_social_relation'::regclass
      AND conname = 'player_social_relation_pkey'
  ) THEN
    ALTER TABLE "player_social_relation"
    ADD CONSTRAINT "player_social_relation_pkey" PRIMARY KEY ("id");
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "player_social_relation_player_id_target_player_id_relation_type_key"
ON "player_social_relation"("player_id", "target_player_id", "relation_type");

CREATE INDEX IF NOT EXISTS "player_social_relation_player_id_relation_type_status_idx"
ON "player_social_relation"("player_id", "relation_type", "status");

CREATE INDEX IF NOT EXISTS "player_social_relation_target_player_id_relation_type_status_idx"
ON "player_social_relation"("target_player_id", "relation_type", "status");

CREATE INDEX IF NOT EXISTS "player_social_relation_last_interacted_at_idx"
ON "player_social_relation"("last_interacted_at");
