ALTER TABLE "player_field_slot" RENAME COLUMN "full_mature_at" TO "ready_at";
ALTER INDEX IF EXISTS "player_field_slot_full_mature_at_idx" RENAME TO "player_field_slot_ready_at_idx";

ALTER TABLE "seed_definition" RENAME COLUMN "ripe_window_seconds" TO "collect_window_seconds";

ALTER TABLE "player_building" RENAME COLUMN "ripe_window_tech_level" TO "collect_window_tech_level";
