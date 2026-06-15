CREATE TABLE "robot_sim_snapshot" (
  "id" TEXT NOT NULL,
  "run_id" TEXT NOT NULL,
  "mode" TEXT NOT NULL,
  "robot_key" TEXT NOT NULL,
  "player_id" TEXT NOT NULL,
  "faction_code" TEXT,
  "vault_gold" INTEGER NOT NULL DEFAULT 0,
  "wallet_gold" INTEGER NOT NULL DEFAULT 0,
  "contribution_score" INTEGER NOT NULL DEFAULT 0,
  "spirit_soul" INTEGER NOT NULL DEFAULT 0,
  "ordinary_soul" INTEGER NOT NULL DEFAULT 0,
  "rare_soul" INTEGER NOT NULL DEFAULT 0,
  "legendary_soul" INTEGER NOT NULL DEFAULT 0,
  "main_spirit_level" INTEGER,
  "main_spirit_stage" INTEGER,
  "army_total" INTEGER NOT NULL DEFAULT 0,
  "army_available" INTEGER NOT NULL DEFAULT 0,
  "army_capacity" INTEGER NOT NULL DEFAULT 0,
  "queued_army" INTEGER NOT NULL DEFAULT 0,
  "mature_fields" INTEGER NOT NULL DEFAULT 0,
  "growing_fields" INTEGER NOT NULL DEFAULT 0,
  "empty_fields" INTEGER NOT NULL DEFAULT 0,
  "success_action_count" INTEGER NOT NULL DEFAULT 0,
  "blocked_action_count" INTEGER NOT NULL DEFAULT 0,
  "failed_action_count" INTEGER NOT NULL DEFAULT 0,
  "action_summary_json" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "robot_sim_snapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "robot_sim_snapshot_run_id_idx" ON "robot_sim_snapshot"("run_id");
CREATE INDEX "robot_sim_snapshot_mode_created_at_idx" ON "robot_sim_snapshot"("mode", "created_at");
CREATE INDEX "robot_sim_snapshot_player_id_created_at_idx" ON "robot_sim_snapshot"("player_id", "created_at");
CREATE INDEX "robot_sim_snapshot_robot_key_created_at_idx" ON "robot_sim_snapshot"("robot_key", "created_at");

ALTER TABLE "robot_sim_snapshot"
  ADD CONSTRAINT "robot_sim_snapshot_run_id_fkey"
  FOREIGN KEY ("run_id") REFERENCES "robot_test_run"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "robot_sim_snapshot"
  ADD CONSTRAINT "robot_sim_snapshot_player_id_fkey"
  FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
